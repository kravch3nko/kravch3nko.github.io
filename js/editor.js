/**
 * Editor module for Monaco editor integration.
 */
const Editor = (function() {
    // Private variables
    let monacoEditor;
    let errorDecorations = []; // Move to module scope so it persists across function calls
    let validationTimeout = null; // For debouncing validation
    let autoApplyChanges = localStorage.getItem('autoApplyChanges') === 'true'; // Load from localStorage
    let lastGraphvizError = null; // For tracking Graphviz errors
    
    /**
     * Initialize the Monaco editor.
     * 
     * @param {string} dotSource - The initial DOT source for the editor
     * @param {Function} onApplyChanges - Callback for when changes are applied
     */
    function initialize(dotSource, onApplyChanges) {
        // Monaco configuration is moved to HTML to prevent duplicate loading
        
        require(['vs/editor/editor.main'], function() {
            try {
                // Register DOT language
                monaco.languages.register({ id: 'dot' });
                
                // Define DOT syntax highlighting
                monaco.languages.setMonarchTokensProvider('dot', {
                    defaultToken: '',
                    tokenPostfix: '.dot',
                    
                    keywords: [
                        'strict', 'graph', 'digraph', 'node', 'edge', 'subgraph', 'rank'
                    ],
                    
                    attributes: [
                        'style', 'color', 'fillcolor', 'fontcolor', 'fontname', 'fontsize', 
                        'label', 'shape', 'penwidth', 'splines', 'overlap', 'margin'
                    ],
                    
                    tokenizer: {
                        root: [
                            // Identifiers and keywords
                            [/[a-zA-Z_]\w*/, {
                                cases: {
                                    '@keywords': 'keyword',
                                    '@attributes': 'attribute',
                                    '@default': 'identifier'
                                }
                            }],
                            
                            // Comments
                            [/\/\/.*$/, 'comment'],
                            [/\/\*/, 'comment', '@comment'],
                            
                            // Strings
                            [/"/, 'string', '@string'],
                            
                            // Numbers
                            [/\d+(\.\d+)?/, 'number'],
                            
                            // Operators and special characters
                            [/[=;,{}[\]()]/, 'delimiter'],
                            [/->|--/, 'operator'],
                        ],
                        
                        comment: [
                            [/[^/*]+/, 'comment'],
                            [/\*\//, 'comment', '@pop'],
                            [/[/*]/, 'comment']
                        ],
                        
                        string: [
                            [/[^\\"]+/, 'string'],
                            [/\\./, 'string.escape'],
                            [/"/, 'string', '@pop']
                        ]
                    }
                });
                
                // Create the editor
                monacoEditor = monaco.editor.create(document.getElementById('editor'), {
                    value: dotSource,
                    language: 'dot',
                    theme: 'vs-dark',
                    automaticLayout: true,
                    wordWrap: 'on',
                    minimap: {
                        enabled: true
                    },
                    glyphMargin: true, // Enable glyph margin for error indicators
                    lineNumbersMinChars: 3,
                    folding: true,
                    scrollBeyondLastLine: false
                });
                
                // Create a validation status element
                const editorContainer = document.getElementById('editor-container');
                let validationStatus = document.getElementById('validation-status');
                
                if (!validationStatus) {
                    validationStatus = document.createElement('div');
                    validationStatus.id = 'validation-status';
                    validationStatus.style.padding = '5px 10px';
                    validationStatus.style.color = 'white';
                    validationStatus.style.backgroundColor = '#333';
                    validationStatus.style.borderTop = '1px solid #555';
                    editorContainer.insertBefore(validationStatus, document.getElementById('editor'));
                }
                
                // Add auto-apply toggle to the editor header
                const editorHeader = document.querySelector('.editor-header .editor-buttons');
                if (editorHeader) {
                    // Create container for auto-apply toggle
                    const autoApplyContainer = document.createElement('div');
                    autoApplyContainer.className = 'auto-apply-container';
                    
                    // Create toggle switch
                    const autoApplyToggle = document.createElement('input');
                    autoApplyToggle.type = 'checkbox';
                    autoApplyToggle.id = 'auto-apply-toggle';
                    autoApplyToggle.checked = autoApplyChanges;
                    
                    // Create label
                    const autoApplyLabel = document.createElement('label');
                    autoApplyLabel.htmlFor = 'auto-apply-toggle';
                    autoApplyLabel.textContent = 'Auto-apply';
                    
                    // Add event listener
                    autoApplyToggle.addEventListener('change', function() {
                        autoApplyChanges = this.checked;
                        // Save to localStorage
                        localStorage.setItem('autoApplyChanges', autoApplyChanges);
                        console.log('Auto-apply changes:', autoApplyChanges);
                    });
                    
                    // Append elements
                    autoApplyContainer.appendChild(autoApplyToggle);
                    autoApplyContainer.appendChild(autoApplyLabel);
                    editorHeader.insertBefore(autoApplyContainer, editorHeader.firstChild);
                }
                
                // Register a callback for Graphviz rendering errors
                window.handleGraphvizError = function(error) {
                    console.log("Handling Graphviz error in editor:", error);
                    
                    // Extract line number and error information
                    const errorInfo = parseGraphvizError(error, monacoEditor.getValue());
                    
                    if (errorInfo) {
                        console.log("Error info:", errorInfo);
                        
                        // Update validation status
                        validationStatus.textContent = `Error: ${errorInfo.message}`;
                        validationStatus.style.backgroundColor = '#aa3333';
                        validationStatus.classList.add('invalid');
                        validationStatus.classList.remove('valid');
                        
                        // Create decoration for the error
                        highlightErrorInEditor(errorInfo.lineNumber, errorInfo.column, errorInfo.message, true);
                    }
                };
                
                // Set up apply changes button
                document.getElementById('apply-changes').addEventListener('click', function() {
                    const newDotSource = monacoEditor.getValue();
                    
                    // Clear previous error decorations
                    clearErrorHighlighting();
                    
                    // Show "validating" status
                    validationStatus.textContent = 'Validating...';
                    validationStatus.style.backgroundColor = '#666';
                    validationStatus.classList.remove('valid');
                    validationStatus.classList.remove('invalid');
                    validationStatus.classList.add('validating');
                    
                    // Reset last error
                    lastGraphvizError = null;
                    
                    // Validate the DOT source before applying changes
                    const validationResult = validateDOTSyntax(newDotSource);
                    
                    // Remove the validating class
                    validationStatus.classList.remove('validating');
                    
                    if (validationResult.valid) {
                        // Update validation status
                        validationStatus.textContent = 'Syntax is valid';
                        validationStatus.style.backgroundColor = '#2d882d';
                        validationStatus.classList.add('valid');
                        validationStatus.classList.remove('invalid');
                        
                        try {
                            // Add validating state while rendering the graph
                            validationStatus.textContent = 'Applying changes...';
                            validationStatus.classList.add('validating');
                            
                            // Call the callback with the new source
                            onApplyChanges(newDotSource);
                            
                            // Success - will be caught by the error handler if there's an issue
                            setTimeout(function() {
                                if (validationStatus.classList.contains('validating')) {
                                    validationStatus.textContent = 'Changes applied successfully';
                                    validationStatus.classList.remove('validating');
                                }
                            }, 300);
                        } catch (error) {
                            validationStatus.classList.remove('validating');
                            validationStatus.classList.add('invalid');
                            validationStatus.textContent = 'Error: ' + error.message;
                            validationStatus.style.backgroundColor = '#aa3333';
                            alert('Error parsing DOT: ' + error.message);
                        }
                    } else {
                        // Show validation error and highlight in editor if possible
                        validationStatus.textContent = 'Syntax Error: ' + validationResult.error;
                        validationStatus.style.backgroundColor = '#aa3333';
                        validationStatus.classList.add('invalid');
                        validationStatus.classList.remove('valid');
                        
                        // Check if error contains line information
                        const match = validationResult.error.match(/line\s+(\d+)/i);
                        if (match) {
                            const lineNumber = parseInt(match[1], 10);
                            highlightErrorInEditor(lineNumber, 1, validationResult.error, true);
                        }
                    }
                });
                
                // Add validation on content change
                monacoEditor.onDidChangeModelContent(function() {
                    // Clear previous error decorations
                    clearErrorHighlighting();
                    
                    const content = monacoEditor.getValue();
                    
                    // Show "validating" status
                    validationStatus.textContent = 'Validating...';
                    validationStatus.style.backgroundColor = '#666';
                    validationStatus.classList.remove('valid');
                    validationStatus.classList.remove('invalid');
                    validationStatus.classList.add('validating');
                    
                    // Reset last error
                    lastGraphvizError = null;
                    
                    // Clear any pending validations
                    clearTimeout(validationTimeout);
                    
                    // Store current content for validation
                    const currentContent = content;
                    
                    // Add a small delay before validating to prevent excessive validation during typing
                    validationTimeout = setTimeout(function() {
                        // Skip if content has changed since timeout was set
                        if (currentContent !== monacoEditor.getValue()) {
                            return;
                        }
                        
                        // Basic syntax validation happens immediately
                        const validationResult = validateDOTSyntax(currentContent);
                        
                        // Remove the validating class
                        validationStatus.classList.remove('validating');
                        
                        if (validationResult.valid) {
                            validationStatus.textContent = 'Syntax is valid';
                            validationStatus.style.backgroundColor = '#2d882d';
                            validationStatus.classList.add('valid');
                            validationStatus.classList.remove('invalid');
                            
                            // Try real-time preview validation with Graphviz
                            try {
                                // Show validating again for Graphviz validation
                                validationStatus.textContent = 'Validating with Graphviz...';
                                validationStatus.classList.add('validating');
                                
                                // Create a temporary graphviz instance to check for errors
                                const tempDotSource = sanitizeDotSource(currentContent);
                                
                                // Use a temporary div for validation
                                const tempDiv = document.createElement('div');
                                tempDiv.style.position = 'absolute';
                                tempDiv.style.visibility = 'hidden';
                                tempDiv.style.width = '1px';
                                tempDiv.style.height = '1px';
                                document.body.appendChild(tempDiv);
                                
                                // Flag to track if validation is complete
                                let validationCompleted = false;
                                
                                // Create temporary graphviz instance
                                const tempGraphviz = d3.select(tempDiv)
                                    .graphviz()
                                    .onerror(function(error) {
                                        validationCompleted = true;
                                        const errorInfo = parseGraphvizError(error, currentContent);
                                        if (errorInfo) {
                                            validationStatus.textContent = `Error: ${errorInfo.message}`;
                                            validationStatus.style.backgroundColor = '#aa3333';
                                            validationStatus.classList.add('invalid');
                                            validationStatus.classList.remove('valid', 'validating');
                                            highlightErrorInEditor(errorInfo.lineNumber, errorInfo.column, errorInfo.message, false);
                                        }
                                    })
                                    .on("end", function() {
                                        // Handle successful rendering
                                        if (!validationCompleted) {
                                            validationStatus.textContent = 'Syntax is valid';
                                            validationStatus.style.backgroundColor = '#2d882d';
                                            validationStatus.classList.add('valid');
                                            validationStatus.classList.remove('validating');
                                            validationCompleted = true;
                                            
                                            // Auto-apply changes if enabled and content hasn't changed
                                            if (autoApplyChanges && currentContent === monacoEditor.getValue()) {
                                                validationStatus.textContent = 'Auto-applying changes...';
                                                try {
                                                    // Call the callback with the new source
                                                    onApplyChanges(currentContent);
                                                    validationStatus.textContent = 'Changes applied automatically';
                                                } catch (error) {
                                                    validationStatus.textContent = `Error applying changes: ${error.message}`;
                                                    validationStatus.style.backgroundColor = '#aa3333';
                                                    validationStatus.classList.add('invalid');
                                                    validationStatus.classList.remove('valid');
                                                    console.error("Error auto-applying changes:", error);
                                                }
                                            }
                                        }
                                    });
                                
                                // Try rendering to catch graphviz-specific errors
                                try {
                                    tempGraphviz.renderDot(tempDotSource);
                                    
                                    // Set a timeout as a fallback in case the "end" event doesn't fire
                                    setTimeout(function() {
                                        // Skip if content has changed
                                        if (currentContent !== monacoEditor.getValue()) {
                                            return;
                                        }
                                        
                                        // If validating class is still present and validation not completed
                                        if (validationStatus.classList.contains('validating') && !validationCompleted) {
                                            // Check if we have a recent Graphviz error
                                            if (lastGraphvizError) {
                                                const errorInfo = parseGraphvizError(lastGraphvizError, currentContent);
                                                if (errorInfo) {
                                                    validationStatus.textContent = `Error: ${errorInfo.message}`;
                                                    validationStatus.style.backgroundColor = '#aa3333';
                                                    validationStatus.classList.add('invalid');
                                                    validationStatus.classList.remove('valid', 'validating');
                                                    highlightErrorInEditor(errorInfo.lineNumber, errorInfo.column, errorInfo.message, false);
                                                    validationCompleted = true;
                                                    // Reset the last error so we don't reuse it for future validations
                                                    lastGraphvizError = null;
                                                    return;
                                                }
                                            }
                                            
                                            // No errors found, it's valid
                                            validationStatus.textContent = 'Syntax is valid (timeout)';
                                            validationStatus.style.backgroundColor = '#2d882d';
                                            validationStatus.classList.add('valid');
                                            validationStatus.classList.remove('validating');
                                            validationCompleted = true;
                                            
                                            // Auto-apply changes if enabled and content hasn't changed
                                            if (autoApplyChanges && currentContent === monacoEditor.getValue()) {
                                                validationStatus.textContent = 'Auto-applying changes...';
                                                try {
                                                    // Call the callback with the new source
                                                    onApplyChanges(currentContent);
                                                    validationStatus.textContent = 'Changes applied automatically';
                                                } catch (error) {
                                                    validationStatus.textContent = `Error applying changes: ${error.message}`;
                                                    validationStatus.style.backgroundColor = '#aa3333';
                                                    validationStatus.classList.add('invalid');
                                                    validationStatus.classList.remove('valid');
                                                    console.error("Error auto-applying changes:", error);
                                                }
                                            }
                                        }
                                    }, 2000); // Longer timeout as a fallback
                                } catch (e) {
                                    // If we catch an error directly, report it
                                    validationCompleted = true;
                                    console.error("Direct rendering error:", e);
                                    validationStatus.textContent = `Error: ${e.message || "Unknown error"}`;
                                    validationStatus.style.backgroundColor = '#aa3333';
                                    validationStatus.classList.add('invalid');
                                    validationStatus.classList.remove('valid', 'validating');
                                    
                                    // Try to extract line information if possible
                                    const errorInfo = parseGraphvizError(e, currentContent);
                                    if (errorInfo) {
                                        highlightErrorInEditor(errorInfo.lineNumber, errorInfo.column, errorInfo.message, false);
                                    }
                                }
                                
                                // Clean up the temporary element after a delay
                                setTimeout(function() {
                                    if (tempDiv && tempDiv.parentNode) {
                                        tempDiv.parentNode.removeChild(tempDiv);
                                    }
                                }, 2500);
                            } catch (error) {
                                // Ignore errors in the validation preview
                                console.log("Error in preview validation:", error);
                                validationStatus.classList.remove('validating');
                                validationStatus.classList.add('invalid');
                                validationStatus.textContent = `Error: ${error.message || "Unknown error"}`;
                                validationStatus.style.backgroundColor = '#aa3333';
                            }
                        } else {
                            validationStatus.textContent = 'Syntax Error: ' + validationResult.error;
                            validationStatus.style.backgroundColor = '#aa3333';
                            validationStatus.classList.add('invalid');
                            validationStatus.classList.remove('valid');
                            
                            // Check if error contains line information
                            const match = validationResult.error.match(/line\s+(\d+)/i);
                            if (match) {
                                const lineNumber = parseInt(match[1], 10);
                                highlightErrorInEditor(lineNumber, 1, validationResult.error, false);
                            }
                        }
                    }, 300); // Shorter delay for basic validation
                });
                
                // Initial validation
                const initialValidation = validateDOTSyntax(dotSource);
                if (initialValidation.valid) {
                    validationStatus.textContent = 'Syntax is valid';
                    validationStatus.style.backgroundColor = '#2d882d';
                    validationStatus.classList.add('valid');
                } else {
                    validationStatus.textContent = 'Syntax Error: ' + initialValidation.error;
                    validationStatus.style.backgroundColor = '#aa3333';
                    validationStatus.classList.add('invalid');
                    
                    // Check if error contains line information
                    const match = initialValidation.error.match(/line\s+(\d+)/i);
                    if (match) {
                        const lineNumber = parseInt(match[1], 10);
                        highlightErrorInEditor(lineNumber, 1, initialValidation.error, true);
                    }
                }
                
                // Set up editor toggle button
                document.getElementById('editor-toggle').addEventListener('click', function() {
                    toggleEditor();
                });
                
                // Set up close editor button
                document.getElementById('close-editor').addEventListener('click', function() {
                    closeEditor();
                });
            } catch (error) {
                console.error("Error initializing editor:", error);
                alert("There was an error initializing the editor. Some features may not work properly.");
            }
        });
    }
    
    /**
     * Clear any error highlighting in the editor.
     */
    function clearErrorHighlighting() {
        if (monacoEditor) {
            errorDecorations = monacoEditor.deltaDecorations(errorDecorations, []);
        }
    }
    
    /**
     * Highlight an error in the editor.
     * 
     * @param {number} lineNumber - The line number where the error occurred (1-indexed)
     * @param {number} column - The column where the error occurred (1-indexed)
     * @param {string} message - The error message
     * @param {boolean} [moveCursor=false] - Whether to move the cursor to the error location
     */
    function highlightErrorInEditor(lineNumber, column, message, moveCursor = false) {
        if (!monacoEditor) return;
        
        console.log(`Highlighting error at line ${lineNumber}, column ${column}: ${message}`);
        
        // Adjust line number to 0-indexed for Monaco
        const monacoLineNumber = Math.max(1, lineNumber);
        
        // Create decoration
        const newDecorations = [
            // Main squiggly underline decoration
            {
                range: new monaco.Range(
                    monacoLineNumber, 
                    column, 
                    monacoLineNumber, 
                    1000 // End of line
                ),
                options: {
                    className: 'syntax-error',
                    hoverMessage: { value: message },
                    inlineClassName: 'syntax-error-inline',
                    overviewRuler: {
                        color: "#ff0000",
                        position: monaco.editor.OverviewRulerLane.Right
                    },
                    minimap: {
                        color: "#ff0000",
                        position: monaco.editor.MinimapPosition.Inline
                    }
                }
            },
            // Glyph margin icon
            {
                range: new monaco.Range(monacoLineNumber, 1, monacoLineNumber, 1),
                options: {
                    glyphMarginClassName: 'codicon-error',
                    glyphMarginHoverMessage: { value: message },
                    isWholeLine: true
                }
            }
        ];
        
        // Apply decorations
        errorDecorations = monacoEditor.deltaDecorations(errorDecorations, newDecorations);
        
        // Only move the cursor when explicitly requested (e.g., from Apply Changes button)
        if (moveCursor) {
            monacoEditor.revealLineInCenter(monacoLineNumber);
            monacoEditor.setPosition({
                lineNumber: monacoLineNumber,
                column: Math.max(1, column)
            });
        }
    }
    
    /**
     * Parse a Graphviz error message to extract line and column information.
     * 
     * @param {Error} error - The error object from Graphviz
     * @param {string} dotSource - The DOT source that caused the error
     * @returns {Object|null} Object with line, column and message information, or null if parsing failed
     */
    function parseGraphvizError(error, dotSource) {
        // Ensure we have a proper error to parse
        if (!error) {
            console.warn("No error object to parse");
            return null;
        }
        
        // Handle both string errors and Error objects
        const errorMessage = typeof error === 'string' 
            ? error 
            : (error.message || error.toString());
        
        if (!errorMessage) {
            console.warn("Empty error message");
            return null;
        }
        
        console.log("Parsing error message:", errorMessage);
        
        // Try to parse line number from error message
        const lineMatch = errorMessage.match(/(?:in |at |near )line\s+(\d+)/i);
        let lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : null;
        
        // If no line number was found in the standard format, try to look for other patterns
        if (!lineNumber) {
            // Look for "syntax error in line X near Y" pattern
            const syntaxLineMatch = errorMessage.match(/syntax error in line (\d+)/i);
            if (syntaxLineMatch) {
                lineNumber = parseInt(syntaxLineMatch[1], 10);
            } else {
                // Try to find any number that might be a line number
                const numberMatch = errorMessage.match(/(\d+)/);
                if (numberMatch) {
                    lineNumber = parseInt(numberMatch[1], 10);
                    // Only use if it's a reasonable line number (not too large)
                    if (lineNumber > 1000) lineNumber = 1;
                }
            }
        }
        
        // If still no line number, default to line 1
        if (!lineNumber) {
            lineNumber = 1;
            console.warn("Could not parse line number from error message, defaulting to line 1");
        }
        
        // Try to parse token/character information
        let column = 1;
        const nearMatch = errorMessage.match(/near\s+['"]?([^'")\s]+)['"]?/i);
        
        if (nearMatch) {
            const problematicToken = nearMatch[1].trim();
            console.log("Problematic token:", problematicToken);
            
            const lines = dotSource.split('\n');
            
            if (lines.length >= lineNumber) {
                const line = lines[lineNumber - 1];
                const tokenIndex = line.indexOf(problematicToken);
                
                if (tokenIndex >= 0) {
                    column = tokenIndex + 1; // 1-indexed column
                    console.log(`Token "${problematicToken}" found at column ${column}`);
                } else {
                    // For special characters like '-', try a more specific search
                    if (problematicToken === '-') {
                        // Find the position of '-' that's part of an edge definition
                        const edgeOpIndex = line.indexOf('->');
                        if (edgeOpIndex >= 0) {
                            column = edgeOpIndex + 1; // Point to the '-' in '->'
                            console.log(`Edge operator found at column ${column}`);
                        } else {
                            const dashIndex = line.indexOf('-');
                            if (dashIndex >= 0) {
                                column = dashIndex + 1;
                                console.log(`Dash found at column ${column}`);
                            } else {
                                console.warn(`Character "${problematicToken}" not found in line ${lineNumber}`);
                            }
                        }
                    } else {
                        console.warn(`Token "${problematicToken}" not found in line ${lineNumber}`);
                    }
                }
            } else {
                console.warn(`Line ${lineNumber} is out of bounds (file has ${lines.length} lines)`);
            }
        }
        
        return {
            lineNumber: lineNumber,
            column: column,
            message: errorMessage
        };
    }
    
    /**
     * Validate DOT syntax.
     * 
     * @param {string} dotSource - The DOT source to validate
     * @returns {Object} Object with validation result (valid: boolean, error: string)
     */
    function validateDOTSyntax(dotSource) {
        try {
            // Basic structure validation - only check when dotparser is not available
            if (!window.parser) {
                // Basic structure validation
                if (!dotSource.trim()) {
                    return { valid: false, error: 'Empty DOT source' };
                }
                
                // Check for digraph or graph definition
                if (!dotSource.match(/\b(di)?graph\s+[^{]*{/i)) {
                    return { valid: false, error: 'Missing graph definition' };
                }
                
                // Check for balanced braces
                let braceCount = 0;
                let inString = false;
                let inComment = false;
                let inBlockComment = false;
                
                for (let i = 0; i < dotSource.length; i++) {
                    const char = dotSource[i];
                    const nextChar = dotSource[i + 1] || '';
                    
                    // Skip characters in string literals
                    if (char === '"' && !inComment && !inBlockComment) {
                        // Handle escaped quotes
                        if (i > 0 && dotSource[i - 1] === '\\') {
                            continue;
                        }
                        inString = !inString;
                        continue;
                    }
                    
                    // Skip characters in comments
                    if (!inString) {
                        if (char === '/' && nextChar === '/' && !inBlockComment) {
                            inComment = true;
                            i++; // Skip the next character
                            continue;
                        }
                        
                        if (char === '/' && nextChar === '*' && !inComment) {
                            inBlockComment = true;
                            i++; // Skip the next character
                            continue;
                        }
                        
                        if (char === '*' && nextChar === '/' && inBlockComment) {
                            inBlockComment = false;
                            i++; // Skip the next character
                            continue;
                        }
                        
                        if (char === '\n' && inComment) {
                            inComment = false;
                            continue;
                        }
                    }
                    
                    // Only count braces outside of strings and comments
                    if (!inString && !inComment && !inBlockComment) {
                        if (char === '{') {
                            braceCount++;
                        } else if (char === '}') {
                            braceCount--;
                            if (braceCount < 0) {
                                return { valid: false, error: 'Unbalanced braces: too many closing braces' };
                            }
                        }
                    }
                }
                
                if (inString) {
                    return { valid: false, error: 'Unclosed string literal' };
                }
                
                if (inBlockComment) {
                    return { valid: false, error: 'Unclosed block comment' };
                }
                
                if (braceCount > 0) {
                    return { valid: false, error: 'Unbalanced braces: missing closing braces' };
                }
                
                if (braceCount < 0) {
                    return { valid: false, error: 'Unbalanced braces: too many closing braces' };
                }
                
                // Check for edge definitions
                const isDigraph = dotSource.match(/\bdigraph\b/i);
                const edgeOp = isDigraph ? '->' : '--';
                
                // Basic validation for edge definitions
                const edgeRegex = new RegExp(`["\\w]+\\s*${edgeOp.replace('-', '\\-')}\\s*["\\w]+`, 'g');
                
                // If we have node definitions but no valid edge syntax
                if (dotSource.match(/\[.+\]/g) && !dotSource.match(edgeRegex) && dotSource.includes(edgeOp)) {
                    return { valid: false, error: `Invalid edge syntax. Use "${edgeOp}" to connect nodes` };
                }
                
                return { valid: true, error: '' };
            }
            
            // Use dotparser for validation if available
            return validateWithDotParser(dotSource);
        } catch (e) {
            console.error("Validation error:", e);
            return { valid: false, error: e.message };
        }
    }
    
    /**
     * Use the dotparser library to validate DOT syntax.
     * 
     * @param {string} dotSource - The DOT source to validate
     * @returns {Object} Object with validation result (valid: boolean, error: string)
     */
    function validateWithDotParser(dotSource) {
        try {
            // If empty input, return early with a meaningful error
            if (!dotSource.trim()) {
                return { valid: false, error: 'Empty DOT source' };
            }
            
            // Make sure parser is available
            if (typeof parser === 'undefined' || !parser) {
                console.warn("dotparser library not available, falling back to basic validation");
                return { valid: true, error: '' }; // Assume valid if parser not available
            }
            
            try {
                // Try to parse the DOT source using the dotparser library
                const ast = parser.parse(dotSource);
                return { valid: true, error: '', ast: ast };
            } catch (parseError) {
                // Extract line and column information if available
                let errorMessage = parseError.message || "Syntax error";
                
                if (parseError.location) {
                    errorMessage += ` at line ${parseError.location.start.line}, column ${parseError.location.start.column}`;
                }
                
                // Return detailed error information
                return { 
                    valid: false, 
                    error: errorMessage
                };
            }
        } catch (e) {
            console.error("Error in validation function:", e);
            return { valid: true, error: '' }; // Fallback to allow content if validation itself fails
        }
    }
    
    /**
     * Toggle the editor visibility.
     */
    function toggleEditor() {
        const editorContainer = document.getElementById('editor-container');
        const graphContainer = document.getElementById('graph-container');
        const toggleButton = document.getElementById('editor-toggle');
        
        editorContainer.classList.toggle('active');
        graphContainer.classList.toggle('editor-active');
        
        // Update button text
        toggleButton.textContent = editorContainer.classList.contains('active') ? 'Hide Editor' : 'Show Editor';
    }
    
    /**
     * Close the editor.
     */
    function closeEditor() {
        const editorContainer = document.getElementById('editor-container');
        const graphContainer = document.getElementById('graph-container');
        const toggleButton = document.getElementById('editor-toggle');
        
        editorContainer.classList.remove('active');
        graphContainer.classList.remove('editor-active');
        toggleButton.textContent = 'Show Editor';
    }
    
    /**
     * Update the editor content.
     * 
     * @param {string} dotSource - New DOT source to set in the editor
     */
    function updateContent(dotSource) {
        if (monacoEditor) {
            monacoEditor.setValue(dotSource);
        }
    }
    
    /**
     * Get the current editor content.
     * 
     * @returns {string} Current DOT source from the editor
     */
    function getContent() {
        return monacoEditor ? monacoEditor.getValue() : '';
    }
    
    /**
     * Sanitize DOT source for validation
     * Duplicated from graph.js for validation purposes
     */
    function sanitizeDotSource(dotSource) {
        if (!dotSource || typeof dotSource !== 'string') {
            return 'digraph G { node [label="Error: Invalid DOT source"]; }';
        }
        
        try {
            // Make sure the digraph has a name and proper structure
            if (!dotSource.match(/\b(di)?graph\s+[A-Za-z0-9_]*\s*\{/)) {
                // Fix missing graph name or missing space after name
                if (dotSource.match(/\b(di)?graph\s*\{/)) {
                    dotSource = dotSource.replace(/\b(di)?graph\s*\{/, '$1graph G {');
                }
                // If completely missing proper structure, create a fallback
                else if (!dotSource.includes('{')) {
                    return 'digraph G { node [label="Error: Invalid DOT format"]; }';
                }
            }
            
            // Ensure proper closing brace
            if (!dotSource.trim().endsWith('}')) {
                if ((dotSource.match(/{/g) || []).length > (dotSource.match(/}/g) || []).length) {
                    dotSource = dotSource + '\n}';
                }
            }
            
            return dotSource;
        } catch (e) {
            console.error("Error sanitizing DOT source:", e);
            return 'digraph G { node [label="Error: Could not process DOT source"]; }';
        }
    }
    
    // Add a custom console error interceptor for catching Graphviz errors
    const originalConsoleError = console.error;

    // Override console.error to intercept Graphviz errors
    console.error = function() {
        // Call the original console.error
        originalConsoleError.apply(console, arguments);
        
        // Check if this is a Graphviz error
        const errorMsg = Array.from(arguments).join(' ');
        if (errorMsg.includes('Graphviz') && errorMsg.includes('error')) {
            lastGraphvizError = errorMsg;
            
            // If we have an active editor with validation status
            const validationStatus = document.getElementById('validation-status');
            if (validationStatus && validationStatus.classList.contains('validating')) {
                // Find the error line information
                const errorInfo = parseGraphvizError(errorMsg, monacoEditor ? monacoEditor.getValue() : '');
                if (errorInfo) {
                    validationStatus.textContent = `Error: ${errorInfo.message}`;
                    validationStatus.style.backgroundColor = '#aa3333';
                    validationStatus.classList.add('invalid');
                    validationStatus.classList.remove('valid', 'validating');
                    
                    if (monacoEditor) {
                        highlightErrorInEditor(errorInfo.lineNumber, errorInfo.column, errorInfo.message, false);
                    }
                }
            }
        }
    };
    
    // Public API
    return {
        initialize,
        toggleEditor,
        closeEditor,
        updateContent,
        getContent,
        validateDOTSyntax,
        sanitizeDotSource
    };
})(); 