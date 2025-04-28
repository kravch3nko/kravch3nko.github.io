/**
 * Graph module for graphviz rendering and visualization.
 */
const Graph = (function() {
    // Private variables
    let graphviz;
    let tooltip;
    let nodes = [];
    let edges = [];
    let currentDotSource = '';
    let currentSelection = []; // Track multiple selections
    
    /**
     * Initialize the graphviz renderer.
     * 
     * @param {string} dotSource - Initial DOT source
     * @param {Function} onNodeClick - Callback when a node is clicked
     */
    function initialize(dotSource, onNodeClick) {
        currentDotSource = dotSource;
        
        // Set up the SVG and graphviz
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Create the graphviz instance
        // Note: Using 'graphviz' method which will be replaced with 'Graphviz' in v2.0
        // This is safe to use with current version, just generates a deprecation warning
        try {
            graphviz = d3.select("#graph")
                .graphviz()
                .width(width)
                .height(height)
                .zoom(true)
                .fit(true);
        } catch (error) {
            console.error("Error initializing graphviz:", error);
            alert("There was an error initializing the graph visualization. Please reload the page.");
            return;
        }
        
        // Initialize tooltip
        tooltip = d3.select("#tooltip");
        
        // Parse the DOT source
        const parsed = Parser.parseDotSource(dotSource);
        nodes = parsed.nodes;
        edges = parsed.edges;
        
        // Set up window resize handler
        window.addEventListener("resize", function() {
            graphviz
                .width(window.innerWidth)
                .height(window.innerHeight)
                .render();
        });
        
        // Set up hop limit slider
        const hopLimitSlider = document.getElementById("hop-limit");
        const hopValueSpan = document.getElementById("hop-value");
        const unlimitedHopsCheckbox = document.getElementById("unlimited-hops");
        
        if (hopLimitSlider && hopValueSpan) {
            hopLimitSlider.addEventListener("input", function() {
                hopValueSpan.textContent = this.value;
                
                // If we have active selections, reapply with new hop limit
                if (currentSelection.length > 0) {
                    // Update each selection with the new max hops
                    currentSelection.forEach(selection => {
                        selection.maxHops = parseInt(this.value);
                    });
                    applySelections();
                }
            });
        }
        
        if (unlimitedHopsCheckbox) {
            unlimitedHopsCheckbox.addEventListener("change", function() {
                if (hopLimitSlider) {
                    hopLimitSlider.disabled = this.checked;
                }
                
                // If we have active selections, reapply with unlimited/limited hop setting
                if (currentSelection.length > 0) {
                    // Update each selection with the new max hops
                    currentSelection.forEach(selection => {
                        selection.maxHops = this.checked ? 100 : (hopLimitSlider ? parseInt(hopLimitSlider.value) : 5);
                    });
                    applySelections();
                }
            });
        }
        
        // Render the graph
        renderGraph(onNodeClick);
        
        // Set up zoom controls
        const zoomInBtn = document.getElementById("zoom-in");
        if (zoomInBtn) {
            zoomInBtn.addEventListener("click", function() {
                graphviz.zoomIn();
            });
        }

        const zoomOutBtn = document.getElementById("zoom-out");
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener("click", function() {
                graphviz.zoomOut();
            });
        }

        const resetBtn = document.getElementById("reset");
        if (resetBtn) {
            resetBtn.addEventListener("click", function() {
                graphviz.resetZoom();
                const nodeSelect = document.getElementById("node-select");
                if (nodeSelect) {
                    nodeSelect.value = "";
                }
                const viewModeRadio = document.querySelector('input[name="view-mode"][value="downstream"]');
                if (viewModeRadio) {
                    viewModeRadio.checked = true;
                }
                resetHighlights();
                currentSelection = []; // Clear selections on reset
            });
        }
        
        // Improved controls toggle with multiple approaches
        setupControlsToggle();
        
        // Set up share button
        const shareBtn = document.getElementById("share-graph");
        if (shareBtn) {
            shareBtn.addEventListener("click", function() {
                Utils.shareGraph(currentDotSource, this);
            });
        }
        
        // Set up escape key to clear selections
        document.addEventListener("keydown", function(event) {
            if (event.key === "Escape") {
                resetHighlights();
                currentSelection = [];
            }
        });
    }
    
    /**
     * Set up the controls toggle button with multiple fallback methods
     */
    function setupControlsToggle() {
        const toggleButton = document.getElementById("controls-toggle");
        if (!toggleButton) {
            console.warn("Controls toggle button not found");
            return;
        }
        
        const controls = document.querySelector(".controls");
        if (!controls) {
            console.warn("Controls container not found");
            return;
        }
        
        // Make sure controls start expanded
        controls.classList.add("expanded");
        toggleButton.textContent = "×";
        
        // Force any existing inline styles to be removed that might interfere
        controls.style.display = "";
        
        // Remove any existing click listeners to prevent duplicates
        toggleButton.removeEventListener("click", toggleControls);
        
        // Add our new click listener
        toggleButton.addEventListener("click", toggleControls);
        
        // Also handle it through jQuery if available for maximum compatibility
        if (window.$ && typeof window.$ === 'function') {
            try {
                $(toggleButton).off("click").on("click", toggleControls);
            } catch (e) {
                console.warn("jQuery event binding failed:", e);
            }
        }
        
        // Function to toggle the controls
        function toggleControls(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            // Toggle the expanded class
            controls.classList.toggle("expanded");
            
            // Ensure display property is set correctly based on expanded state
            if (controls.classList.contains("expanded")) {
                toggleButton.textContent = "×";
                controls.style.display = ""; // Use CSS default
            } else {
                toggleButton.textContent = "⚙";
            }
            
            console.log("Controls toggled. Expanded:", controls.classList.contains("expanded"));
        }
        
        // Add a backup global access method
        window.toggleGraphControls = toggleControls;
        
        // Also handle the toggle on DOMContentLoaded to ensure it's set up properly
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", function() {
                // Reattach the event listener after DOM is fully loaded
                toggleButton.removeEventListener("click", toggleControls);
                toggleButton.addEventListener("click", toggleControls);
            });
        }
        
        console.log("Controls toggle initialized");
    }
    
    /**
     * Render the graph with the current DOT source.
     * 
     * @param {Function} onNodeClick - Callback function when a node is clicked
     */
    function renderGraph(onNodeClick) {
        try {
            // Add some basic sanitization to prevent common errors
            const sanitizedDotSource = sanitizeDotSource(currentDotSource);
            
            // Render the graph with error handling
            graphviz
                .onerror(handleGraphvizError)
                .renderDot(sanitizedDotSource)
                .on("end", function() {
                    // Set up node interactions
                    d3.selectAll(".node")
                        .on("mouseover", function(event) {
                            const nodeLabel = d3.select(this).select("text").text();
                            tooltip
                                .style("opacity", 1)
                                .html(nodeLabel)
                                .style("left", (event.pageX + 10) + "px")
                                .style("top", (event.pageY - 20) + "px");
                        })
                        .on("mouseout", function() {
                            tooltip.style("opacity", 0);
                        })
                        .on("mousemove", function(event) {
                            tooltip
                                .style("left", (event.pageX + 10) + "px")
                                .style("top", (event.pageY - 20) + "px");
                        })
                        .on("click", function(event) {
                            const nodeId = getNodeId(this);
                            if (nodeId) {
                                handleNodeClick(nodeId, event, onNodeClick);
                            }
                        });
                        
                    // Set up edge interactions
                    d3.selectAll(".edge")
                        .on("mouseover", function() {
                            d3.select(this).select("path").style("stroke-width", "3px");
                            d3.select(this).select("text").style("fill-opacity", "1");
                        })
                        .on("mouseout", function() {
                            const isHighlighted = d3.select(this).classed("highlighted");
                            d3.select(this).select("path")
                                .style("stroke-width", isHighlighted ? "2px" : "1px");
                            d3.select(this).select("text")
                                .style("fill-opacity", isHighlighted ? "1" : "0.5");
                        });
                });
        } catch (error) {
            console.error("Error rendering graph:", error);
            showRenderingError();
        }
    }
    
    /**
     * Handle node click events with multi-selection support.
     * 
     * @param {string} nodeId - ID of the clicked node
     * @param {Event} event - Click event
     * @param {Function} onNodeClick - Callback when a node is clicked
     */
    function handleNodeClick(nodeId, event, onNodeClick) {
        // Get the current view mode
        const viewModeInput = document.querySelector('input[name="view-mode"]:checked');
        const viewMode = viewModeInput ? viewModeInput.value : 'downstream'; // Default to downstream if not found
        
        // Get max hops, checking for unlimited hops first
        let maxHops = 5; // Default fallback
        const unlimitedHopsCheckbox = document.getElementById("unlimited-hops");
        const hopLimitSlider = document.getElementById("hop-limit");
        
        if (unlimitedHopsCheckbox && unlimitedHopsCheckbox.checked) {
            // Use a very high value for unlimited hops
            maxHops = 100;
        } else if (hopLimitSlider) {
            // Use the slider value
            maxHops = parseInt(hopLimitSlider.value);
            if (isNaN(maxHops) || maxHops <= 0) {
                maxHops = 5; // Fallback if value is invalid
            }
        }
        
        console.log(`Max hops: ${maxHops}, View mode: ${viewMode}`);
        
        // Create selection object
        const selection = {
            nodeId: nodeId,
            viewMode: viewMode,
            maxHops: maxHops
        };
        
        // Handle multi-selection with Ctrl/Cmd or Shift key
        if (event.ctrlKey || event.metaKey || event.shiftKey) {
            // Add to current selection if not already selected
            if (!currentSelection.some(s => s.nodeId === nodeId)) {
                currentSelection.push(selection);
            }
        } else {
            // Replace selection
            currentSelection = [selection];
        }
        
        // Apply highlighting for all selections
        applySelections();
        
        // Call the callback
        if (onNodeClick) {
            onNodeClick(nodeId);
        }
    }
    
    /**
     * Apply all current selections to the graph.
     */
    function applySelections() {
        // Reset all highlights first
        resetHighlights();
        
        // Process each selection
        currentSelection.forEach(selection => {
            updateView(selection.nodeId, selection.viewMode, selection.maxHops);
        });
        
        // Always highlight legend elements if present
        highlightLegendElements();
    }
    
    /**
     * Reset all highlights in the graph.
     */
    function resetHighlights() {
        d3.selectAll(".node")
            .classed("highlighted", false)
            .classed("faded", false)
            .classed("selected", false);
            
        d3.selectAll(".edge")
            .classed("highlighted", false)
            .classed("faded", false)
            .classed("selected-arrow", false);
            
        d3.selectAll(".cluster")
            .classed("highlighted-cluster", false)
            .classed("faded-cluster", false);
    }
    
    /**
     * Highlight legend elements in the graph.
     */
    function highlightLegendElements() {
        // Find legend nodes and edges (typically in a subgraph named "cluster_legend")
        d3.selectAll(".cluster").each(function() {
            const clusterId = d3.select(this).attr("id") || "";
            if (clusterId.includes("legend") || clusterId.includes("Legend")) {
                // This is a legend cluster, highlight it and its contents
                d3.select(this).classed("highlighted-cluster", true).classed("faded-cluster", false);
                
                // Highlight all nodes in the legend
                d3.select(this).selectAll(".node")
                    .classed("highlighted", true)
                    .classed("faded", false);
                    
                // Highlight all edges in the legend
                d3.select(this).selectAll(".edge")
                    .classed("highlighted", true)
                    .classed("faded", false);
            }
        });
    }
    
    /**
     * Sanitize the DOT source to prevent common errors.
     * 
     * @param {string} dotSource - The DOT source to sanitize
     * @returns {string} The sanitized DOT source
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
    
    /**
     * Handle graphviz rendering errors.
     * 
     * @param {Error} error - The error object
     */
    function handleGraphvizError(error) {
        console.error("Graphviz rendering error:", error);
        
        // Ensure error is in the right format for the editor
        if (typeof error === 'string') {
            error = new Error(error);
        }
        
        // Send error to editor for highlighting if the global handler exists
        if (window.handleGraphvizError) {
            console.log("Forwarding error to editor for highlighting");
            window.handleGraphvizError(error);
        }
        
        // Show the error in the graph area
        showRenderingError(error);
    }
    
    /**
     * Show a rendering error message in the graph container.
     * 
     * @param {Error} [error] - The error object (optional)
     */
    function showRenderingError(error) {
        const errorMessage = error ? error.message || "Unknown error" : "Failed to render graph";
        
        // Create a simple error message in the graph
        const simpleDot = `digraph G {
            node [shape=box, style=filled, fillcolor="#ffcccc", fontcolor="#990000"];
            error [label="Rendering Error\\n${errorMessage.replace(/"/g, "'")}"];
        }`;
        
        try {
            // Attempt to show error graph
            graphviz.renderDot(simpleDot);
        } catch (e) {
            // If that fails too, try direct DOM manipulation
            const graphElement = document.getElementById("graph");
            if (graphElement) {
                graphElement.innerHTML = `
                    <div style="padding: 20px; color: #990000; background-color: #ffcccc; 
                                border: 1px solid #990000; border-radius: 5px; margin: 20px;">
                        <h3>Graph Rendering Error</h3>
                        <p>${errorMessage}</p>
                        <p>Try editing the DOT code to fix any syntax errors.</p>
                    </div>
                `;
            }
        }
    }
    
    /**
     * Make the graph deterministic by ensuring consistent layout.
     * 
     * @param {string} dotSource - The DOT source
     * @returns {string} Modified DOT source with deterministic settings
     */
    function makeGraphDeterministic(dotSource) {
        // If the DOT source already contains layout settings, don't modify it
        if (dotSource.includes("layout=") || dotSource.includes("ordering=")) {
            return dotSource;
        }
        
        // Add deterministic settings to the graph
        // Insert after the first opening brace of the digraph
        return dotSource.replace(/(\b(?:di)?graph\s+[A-Za-z0-9_]*\s*\{)/,
            '$1\n  // Deterministic layout settings\n  layout="dot";\n  ordering=out;\n  rankdir="LR";\n');
    }
    
    /**
     * Update the graph with new DOT source.
     * 
     * @param {string} newDotSource - New DOT source
     * @param {Function} onNodeClick - Callback function when a node is clicked
     */
    function updateGraph(newDotSource, onNodeClick) {
        try {
            // Make the graph deterministic
            newDotSource = makeGraphDeterministic(newDotSource);
            
            // Update the DOT source
            currentDotSource = newDotSource;
            
            // Update URL with the new graph
            Utils.updateUrlWithGraph(newDotSource);
            
            // Re-parse the DOT source and update nodes and edges
            const parsed = Parser.parseDotSource(newDotSource);
            nodes = parsed.nodes;
            edges = parsed.edges;
            
            // Reset selections
            currentSelection = [];
            
            // Render the updated graph with sanitization
            renderGraph(onNodeClick);
            
            return { nodes, edges };
        } catch (error) {
            console.error("Error updating graph:", error);
            showRenderingError(error);
            return { nodes: [], edges: [] };
        }
    }
    
    /**
     * Get a node's ID from its SVG element.
     * 
     * @param {SVGElement} nodeElement - The node SVG element
     * @returns {string|null} The node ID or null if not found
     */
    function getNodeId(nodeElement) {
        // Try to get from title first
        const title = d3.select(nodeElement).select("title");
        if (!title.empty()) {
            return title.text();
        }
        
        // Try to get from text
        const text = d3.select(nodeElement).select("text");
        if (!text.empty()) {
            return text.text();
        }
        
        return null;
    }
    
    /**
     * Get an edge's source and target nodes.
     * 
     * @param {SVGElement} edgeElement - The edge SVG element
     * @returns {Object|null} Object with source and target, or null if not found
     */
    function getEdgeNodes(edgeElement) {
        // Try to get from title
        const title = d3.select(edgeElement).select("title");
        if (!title.empty()) {
            const titleText = title.text();
            if (titleText.includes('->')) {
                const parts = titleText.split("->");
                if (parts.length === 2) {
                    return {
                        source: parts[0].trim(),
                        target: parts[1].trim()
                    };
                }
            }
        }
        
        return null;
    }
    
    /**
     * Update the view based on selected node and view mode.
     * 
     * @param {string} selectedNodeId - ID of the selected node
     * @param {string} viewMode - View mode ('all', 'single', 'downstream', 'upstream', 'bidirectional')
     * @param {number} maxHops - Maximum number of hops
     */
    function updateView(selectedNodeId, viewMode, maxHops) {
        // Skip if no node selected or showing all
        if (!selectedNodeId || viewMode === 'all') {
            return;
        }
        
        console.log(`Updating view: node=${selectedNodeId}, mode=${viewMode}, maxHops=${maxHops}`);
        
        // Ensure maxHops is a valid number
        maxHops = (maxHops === undefined || isNaN(parseInt(maxHops)) || parseInt(maxHops) <= 0) 
            ? 5   // Default if not specified or invalid
            : parseInt(maxHops);
            
        // Get graph connections
        const connections = getGraphConnections();
        
        // Find nodes to highlight based on the selected view mode
        const nodesToHighlight = new Set([selectedNodeId]);
        const edgesToHighlight = new Set();
        const directEdges = new Set();
        
        if (viewMode === 'single') {
            // For single mode, add direct connections only
            if (connections.outgoing[selectedNodeId]) {
                connections.outgoing[selectedNodeId].forEach(targetId => {
                    nodesToHighlight.add(targetId);
                    const edgeId = `${selectedNodeId}->${targetId}`;
                    edgesToHighlight.add(edgeId);
                    directEdges.add(edgeId);
                });
            }
            
            if (connections.incoming[selectedNodeId]) {
                connections.incoming[selectedNodeId].forEach(sourceId => {
                    nodesToHighlight.add(sourceId);
                    const edgeId = `${sourceId}->${selectedNodeId}`;
                    edgesToHighlight.add(edgeId);
                    directEdges.add(edgeId);
                });
            }
        } else {
            // For other modes, do traversal
            if (viewMode === 'downstream' || viewMode === 'bidirectional') {
                traverseConnections('downstream', selectedNodeId, maxHops, connections, 
                                    nodesToHighlight, edgesToHighlight, directEdges);
            }
            
            if (viewMode === 'upstream' || viewMode === 'bidirectional') {
                traverseConnections('upstream', selectedNodeId, maxHops, connections, 
                                    nodesToHighlight, edgesToHighlight, directEdges);
            }
        }
        
        // Apply highlighting to nodes
        d3.selectAll(".node").each(function() {
            const nodeId = getNodeId(this);
            if (nodeId) {
                const isHighlighted = nodesToHighlight.has(nodeId);
                const isSelected = nodeId === selectedNodeId;
                
                // If the node is already highlighted from another selection, keep it highlighted
                const wasHighlighted = d3.select(this).classed("highlighted");
                
                d3.select(this)
                    .classed("highlighted", isHighlighted || wasHighlighted)
                    .classed("faded", !isHighlighted && !wasHighlighted)
                    .classed("selected", isSelected || d3.select(this).classed("selected"));
            }
        });
        
        // Create a map of edge elements by their source->target for faster lookup
        const edgeElementMap = new Map();
        
        // First pass: build the edge element map
        d3.selectAll(".edge").each(function() {
            const edgeNodes = getEdgeNodes(this);
            if (edgeNodes && edgeNodes.source && edgeNodes.target) {
                const edgeId = `${edgeNodes.source}->${edgeNodes.target}`;
                edgeElementMap.set(edgeId, this);
            }
        });
        
        // Apply highlighting to edges using the edgeElementMap
        edgesToHighlight.forEach(edgeId => {
            // Get the edge element from the map
            const edgeElement = edgeElementMap.get(edgeId);
            
            if (edgeElement) {
                const isDirectConnection = directEdges.has(edgeId);
                
                // Apply highlighting classes
                d3.select(edgeElement)
                    .classed("highlighted", true)
                    .classed("faded", false)
                    .classed("selected-arrow", isDirectConnection);
                    
                // Apply additional styles to ensure visibility
                d3.select(edgeElement).select("path")
                    .style("stroke-width", isDirectConnection ? "2.5px" : "1.5px")
                    .style("stroke-opacity", "1");
                    
                d3.select(edgeElement).selectAll("text")
                    .style("fill-opacity", "1");
            }
        });
        
        // Fade non-highlighted edges
        d3.selectAll(".edge").each(function() {
            const edge = d3.select(this);
            if (!edge.classed("highlighted")) {
                edge.classed("faded", true);
                
                // Make path semi-transparent
                edge.select("path")
                    .style("stroke-opacity", "0.3")
                    .style("stroke-width", "1px");
                    
                // Make text semi-transparent
                edge.selectAll("text")
                    .style("fill-opacity", "0.3");
            }
        });
        
        // Apply highlighting to clusters
        updateClusterHighlighting(nodesToHighlight);
    }
    
    /**
     * Get connections between nodes in the graph.
     * 
     * @returns {Object} Object with outgoing and incoming connections
     */
    function getGraphConnections() {
        const connections = {
            outgoing: {}, // source -> [targets]
            incoming: {}  // target -> [sources]
        };
        
        // Initialize connection arrays for all nodes
        d3.selectAll(".node").each(function() {
            const nodeId = getNodeId(this);
            if (nodeId) {
                connections.outgoing[nodeId] = [];
                connections.incoming[nodeId] = [];
            }
        });
        
        // Use the parsed edges from Parser, which will include invisible edges
        edges.forEach(edge => {
            const source = edge.source;
            const target = edge.target;
            
            // Skip if source or target is invalid
            if (!source || !target || source === target) {
                return;
            }
            
            // Ensure arrays exist
            if (!connections.outgoing[source]) {
                connections.outgoing[source] = [];
            }
            if (!connections.incoming[target]) {
                connections.incoming[target] = [];
            }
            
            // Add connection if not already added
            if (!connections.outgoing[source].includes(target)) {
                connections.outgoing[source].push(target);
            }
            if (!connections.incoming[target].includes(source)) {
                connections.incoming[target].push(source);
            }
        });
        
        // Also check visible edges in the DOM as a fallback
        d3.selectAll(".edge").each(function() {
            const edgeNodes = getEdgeNodes(this);
            if (edgeNodes && edgeNodes.source && edgeNodes.target) {
                const source = edgeNodes.source;
                const target = edgeNodes.target;
                
                // Skip if invalid
                if (source === target) {
                    return;
                }
                
                // Ensure arrays exist
                if (!connections.outgoing[source]) {
                    connections.outgoing[source] = [];
                }
                if (!connections.incoming[target]) {
                    connections.incoming[target] = [];
                }
                
                // Add connection if not already added
                if (!connections.outgoing[source].includes(target)) {
                    connections.outgoing[source].push(target);
                }
                if (!connections.incoming[target].includes(source)) {
                    connections.incoming[target].push(source);
                }
            }
        });
        
        return connections;
    }
    
    /**
     * Traverse connections in the specified direction.
     * 
     * @param {string} direction - 'upstream' or 'downstream'
     * @param {string} startNodeId - ID of the starting node
     * @param {number} maxHops - Maximum number of hops
     * @param {Object} connections - Object with outgoing and incoming connections
     * @param {Set} nodesToHighlight - Set of nodes to highlight (modified in place)
     * @param {Set} edgesToHighlight - Set of edges to highlight (modified in place)
     * @param {Set} directEdges - Set of direct edges (modified in place)
     */
    function traverseConnections(direction, startNodeId, maxHops, connections, 
                                nodesToHighlight, edgesToHighlight, directEdges) {
        // Track visited nodes with distances
        const visited = new Map();
        visited.set(startNodeId, 0);
        
        // Queue for BFS
        const queue = [{ id: startNodeId, distance: 0 }];
        
        while (queue.length > 0) {
            const { id: currentId, distance } = queue.shift();
            
            // Stop if we've reached max hops
            if (distance >= maxHops) {
                continue;
            }
            
            // Get neighbors based on direction
            const neighbors = direction === 'downstream' 
                ? connections.outgoing[currentId] || []
                : connections.incoming[currentId] || [];
            
            for (const neighborId of neighbors) {
                // Create edge ID based on direction
                const edgeId = direction === 'downstream'
                    ? `${currentId}->${neighborId}`
                    : `${neighborId}->${currentId}`;
                
                // Add the edge
                edgesToHighlight.add(edgeId);
                
                // Mark direct connections from start node
                if (currentId === startNodeId) {
                    directEdges.add(edgeId);
                }
                
                // If we haven't visited this neighbor or found a shorter path
                if (!visited.has(neighborId) || visited.get(neighborId) > distance + 1) {
                    // Add to highlight set and visited
                    nodesToHighlight.add(neighborId);
                    visited.set(neighborId, distance + 1);
                    
                    // Add to queue
                    queue.push({ id: neighborId, distance: distance + 1 });
                }
            }
        }
    }
    
    /**
     * Update cluster highlighting based on highlighted nodes.
     * 
     * @param {Set} nodesToHighlight - Set of nodes to highlight
     */
    function updateClusterHighlighting(nodesToHighlight) {
        d3.selectAll(".cluster").each(function() {
            // Skip legend clusters which are always highlighted
            const clusterId = d3.select(this).attr("id") || "";
            if (clusterId.includes("legend") || clusterId.includes("Legend")) {
                return;
            }
            
            // Check if any node in this cluster should be highlighted
            const containsHighlightedNode = Array.from(
                d3.select(this).selectAll(".node").nodes()
            ).some(nodeEl => {
                const nodeId = getNodeId(nodeEl);
                return nodeId && nodesToHighlight.has(nodeId);
            });
            
            // Apply highlighting
            const wasHighlighted = d3.select(this).classed("highlighted-cluster");
            d3.select(this)
                .classed("highlighted-cluster", containsHighlightedNode || wasHighlighted)
                .classed("faded-cluster", !containsHighlightedNode && !wasHighlighted);
        });
    }
    
    /**
     * Get the current nodes in the graph.
     * 
     * @returns {Array} Array of node objects
     */
    function getNodes() {
        return nodes;
    }
    
    /**
     * Get the current edges in the graph.
     * 
     * @returns {Array} Array of edge objects
     */
    function getEdges() {
        return edges;
    }
    
    /**
     * Get the current DOT source.
     * 
     * @returns {string} The current DOT source
     */
    function getDotSource() {
        return currentDotSource;
    }
    
    // Public API
    return {
        initialize,
        updateGraph,
        updateView,
        getNodes,
        getEdges,
        getDotSource
    };
})(); 