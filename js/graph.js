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
        
        // Render the graph
        renderGraph(onNodeClick);
        
        // Set up zoom controls
        document.getElementById("zoom-in").addEventListener("click", function() {
            graphviz.zoomIn();
        });

        document.getElementById("zoom-out").addEventListener("click", function() {
            graphviz.zoomOut();
        });

        document.getElementById("reset").addEventListener("click", function() {
            graphviz.resetZoom();
            document.getElementById("node-select").value = "";
            document.querySelector('input[name="view-mode"][value="downstream"]').checked = true;
            updateView();
        });
        
        // Set up controls toggle
        document.getElementById("controls-toggle").addEventListener("click", function() {
            const controls = document.querySelector(".controls");
            controls.classList.toggle("expanded");
            this.textContent = controls.classList.contains("expanded") ? "×" : "⚙";
        });
        
        // Set up share button
        document.getElementById("share-graph").addEventListener("click", function() {
            Utils.shareGraph(currentDotSource, this);
        });
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
                        .on("click", function() {
                            const nodeId = d3.select(this).select("text").text();
                            if (onNodeClick) {
                                onNodeClick(nodeId);
                            }
                        });
                });
        } catch (error) {
            console.error("Error rendering graph:", error);
            showRenderingError();
        }
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
     * Update the graph with new DOT source.
     * 
     * @param {string} newDotSource - New DOT source
     * @param {Function} onNodeClick - Callback function when a node is clicked
     */
    function updateGraph(newDotSource, onNodeClick) {
        try {
            // Update the DOT source
            currentDotSource = newDotSource;
            
            // Update URL with the new graph
            Utils.updateUrlWithGraph(newDotSource);
            
            // Re-parse the DOT source and update nodes and edges
            const parsed = Parser.parseDotSource(newDotSource);
            nodes = parsed.nodes;
            edges = parsed.edges;
            
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
     * Update the view based on selected node and view mode.
     * 
     * @param {string} selectedNodeId - ID of the selected node
     * @param {string} viewMode - View mode ('all', 'single', 'downstream', 'upstream', 'bidirectional')
     * @param {number} maxHops - Maximum number of hops
     */
    function updateView(selectedNodeId, viewMode, maxHops) {
        if (!selectedNodeId || viewMode === 'all') {
            // Reset to show all nodes and edges
            d3.selectAll(".node").classed("highlighted", false).classed("faded", false);
            d3.selectAll(".edge").classed("highlighted", false).classed("faded", false).classed("selected-arrow", false);
            return;
        }
        
        // Find all edges connected to the selected service
        const connectedEdges = edges.filter(edge => 
            edge.source === selectedNodeId || edge.target === selectedNodeId
        );
        
        // Find all nodes connected to the selected service
        const connectedNodeIds = new Set();
        connectedNodeIds.add(selectedNodeId);
        
        connectedEdges.forEach(edge => {
            connectedNodeIds.add(edge.source);
            connectedNodeIds.add(edge.target);
        });
        
        // Find downstream nodes (nodes that depend on the selected service) with hop limit
        const downstreamNodeIds = new Set();
        const downstreamHops = new Map(); // Track hops for each node
        if (viewMode === 'downstream' || viewMode === 'bidirectional') {
            downstreamHops.set(selectedNodeId, 0); // Starting node has 0 hops
            Parser.findDownstreamNodes(selectedNodeId, downstreamNodeIds, downstreamHops, maxHops, edges);
        }
        
        // Find upstream nodes (nodes that the selected service depends on) with hop limit
        const upstreamNodeIds = new Set();
        const upstreamHops = new Map(); // Track hops for each node
        if (viewMode === 'upstream' || viewMode === 'bidirectional') {
            upstreamHops.set(selectedNodeId, 0); // Starting node has 0 hops
            Parser.findUpstreamNodes(selectedNodeId, upstreamNodeIds, upstreamHops, maxHops, edges);
        }
        
        // Apply highlighting based on view mode
        d3.selectAll(".node").each(function() {
            const nodeId = d3.select(this).select("text").text();
            let shouldHighlight = false;
            
            if (viewMode === 'single') {
                shouldHighlight = nodeId === selectedNodeId || connectedNodeIds.has(nodeId);
            } else if (viewMode === 'downstream') {
                shouldHighlight = nodeId === selectedNodeId || downstreamNodeIds.has(nodeId);
            } else if (viewMode === 'upstream') {
                shouldHighlight = nodeId === selectedNodeId || upstreamNodeIds.has(nodeId);
            } else if (viewMode === 'bidirectional') {
                shouldHighlight = nodeId === selectedNodeId || 
                                 downstreamNodeIds.has(nodeId) || 
                                 upstreamNodeIds.has(nodeId);
            }
            
            d3.select(this)
                .classed("highlighted", shouldHighlight)
                .classed("faded", !shouldHighlight);
        });
        
        // Apply highlighting to edges
        d3.selectAll(".edge").each(function() {
            const edge = d3.select(this);
            // Get the title element inside the edge which contains source and target
            const titleEl = edge.select("title");
            if (!titleEl.empty()) {
                // Title format is typically "source->target"
                const titleText = titleEl.text();
                const parts = titleText.split("->");
                if (parts.length === 2) {
                    const sourceId = parts[0].trim();
                    const targetId = parts[1].trim();
                    
                    let shouldHighlight = false;
                    let isDirectConnection = false;
                    
                    // Check if nodes are highlighted according to current visualization mode
                    const sourceHighlighted = sourceId === selectedNodeId || 
                        (viewMode === 'downstream' && (sourceId === selectedNodeId || downstreamNodeIds.has(sourceId))) ||
                        (viewMode === 'upstream' && (sourceId === selectedNodeId || upstreamNodeIds.has(sourceId))) ||
                        (viewMode === 'bidirectional' && (sourceId === selectedNodeId || downstreamNodeIds.has(sourceId) || upstreamNodeIds.has(sourceId)));
                        
                    const targetHighlighted = targetId === selectedNodeId || 
                        (viewMode === 'downstream' && (targetId === selectedNodeId || downstreamNodeIds.has(targetId))) ||
                        (viewMode === 'upstream' && (targetId === selectedNodeId || upstreamNodeIds.has(targetId))) ||
                        (viewMode === 'bidirectional' && (targetId === selectedNodeId || downstreamNodeIds.has(targetId) || upstreamNodeIds.has(targetId)));

                    if (viewMode === 'single') {
                        shouldHighlight = sourceId === selectedNodeId || targetId === selectedNodeId;
                        isDirectConnection = sourceId === selectedNodeId || targetId === selectedNodeId;
                    } else if (viewMode === 'downstream') {
                        // If both nodes are highlighted in downstream mode, the edge should be highlighted too
                        if (sourceHighlighted && targetHighlighted) {
                            // Ensure direction is correct (from parent to child in dependency tree)
                            const sourceHops = downstreamHops.get(sourceId) || Infinity;
                            const targetHops = downstreamHops.get(targetId) || Infinity;
                            
                            // Allow the edge if it connects nodes in the correct direction of dependency flow
                            shouldHighlight = sourceHops < targetHops || sourceId === selectedNodeId;
                        }
                        isDirectConnection = sourceId === selectedNodeId;
                    } else if (viewMode === 'upstream') {
                        // If both nodes are highlighted in upstream mode, the edge should be highlighted too
                        if (sourceHighlighted && targetHighlighted) {
                            // Ensure direction is correct (from child to parent in dependency tree)
                            const sourceHops = upstreamHops.get(sourceId) || Infinity;
                            const targetHops = upstreamHops.get(targetId) || Infinity;
                            
                            // Allow the edge if it connects nodes in the correct direction of dependency flow
                            shouldHighlight = targetHops < sourceHops || targetId === selectedNodeId;
                        }
                        isDirectConnection = targetId === selectedNodeId;
                    } else if (viewMode === 'bidirectional') {
                        // If both nodes are highlighted in bidirectional mode, the edge should be highlighted
                        if (sourceHighlighted && targetHighlighted) {
                            shouldHighlight = true;
                            
                            // Additional check for valid path in the dependency tree
                            const sourceUpHops = upstreamHops.get(sourceId) || Infinity;
                            const targetUpHops = upstreamHops.get(targetId) || Infinity;
                            const sourceDownHops = downstreamHops.get(sourceId) || Infinity;
                            const targetDownHops = downstreamHops.get(targetId) || Infinity;
                            
                            // Check if this follows a valid path in the dependency graph
                            if (sourceUpHops < Infinity && targetDownHops < Infinity) {
                                // This is a path from upstream to downstream
                                shouldHighlight = true;
                            } else if (targetUpHops < Infinity && sourceDownHops < Infinity) {
                                // This is a path from downstream to upstream
                                shouldHighlight = true;
                            } else if (sourceId === selectedNodeId || targetId === selectedNodeId) {
                                // Direct connection to the selected service
                                shouldHighlight = true;
                            } else if (sourceUpHops < Infinity && targetUpHops < Infinity) {
                                // Both in upstream path
                                shouldHighlight = Math.abs(sourceUpHops - targetUpHops) === 1;
                            } else if (sourceDownHops < Infinity && targetDownHops < Infinity) {
                                // Both in downstream path
                                shouldHighlight = Math.abs(sourceDownHops - targetDownHops) === 1;
                            }
                        }
                        isDirectConnection = sourceId === selectedNodeId || targetId === selectedNodeId;
                    }
                    
                    // Make sure edge labels stay visible and properly styled
                    edge.selectAll("text").each(function() {
                        const textElement = d3.select(this);
                        textElement
                            .style("opacity", "1")
                            .style("fill-opacity", "1")
                            .style("fill", "#333333")
                            .style("stroke", "none")
                            .style("font-weight", "normal");
                    });
                    
                    edge.classed("highlighted", shouldHighlight)
                        .classed("faded", !shouldHighlight)
                        .classed("selected-arrow", isDirectConnection && shouldHighlight);
                }
            }
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