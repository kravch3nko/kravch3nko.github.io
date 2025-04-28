/**
 * Main application module for the Graphviz Editor.
 */
const App = (function() {
    // Default DOT source if none is provided in URL
    const defaultDotSource = `digraph G {
  rankdir="LR";
  node [shape=box, style=filled, fillcolor=lightblue];
  
  // Define nodes
  "Service A" [tooltip="Main API Gateway"];
  "Service B" [tooltip="Authentication Service"];
  "Service C" [tooltip="User Management"];
  "Service D" [tooltip="Content Delivery"];
  "Service E" [tooltip="Analytics"];
  
  // Define edges
  "Service A" -> "Service B" [label="auth"];
  "Service A" -> "Service C" [label="users"];
  "Service A" -> "Service D" [label="content"];
  "Service B" -> "Service C" [label="verify"];
  "Service C" -> "Service E" [label="events"];
  "Service D" -> "Service E" [label="metrics"];
}`;

    // Private variables
    let nodes = [];
    let edges = [];
    let serviceSelect;
    let hopLimitSlider;
    let hopValueDisplay;
    let unlimitedHopsCheckbox;
    let viewModeRadios;
    
    /**
     * Initialize the application.
     */
    function initialize() {
        // Load graph from URL or use default
        const dotSource = Utils.loadGraphFromUrl(defaultDotSource);
        
        // Initialize the editor
        Editor.initialize(dotSource, updateDotSource);
        
        // Initialize the graph with node click handler
        Graph.initialize(dotSource, handleNodeClick);
        
        // Get the nodes and edges
        nodes = Graph.getNodes();
        edges = Graph.getEdges();
        
        // Set up UI references
        serviceSelect = document.getElementById("node-select");
        hopLimitSlider = document.getElementById("hop-limit");
        hopValueDisplay = document.getElementById("hop-value");
        unlimitedHopsCheckbox = document.getElementById("unlimited-hops");
        viewModeRadios = document.querySelectorAll('input[name="view-mode"]');
        
        // Set default view mode to downstream
        const downstreamRadio = document.querySelector('input[name="view-mode"][value="downstream"]');
        if (downstreamRadio) {
            downstreamRadio.checked = true;
        }
        
        // Set unlimited hops by default
        unlimitedHopsCheckbox.checked = false;
        hopLimitSlider.disabled = false;
        
        // Populate node select dropdown
        populateNodeSelect();
        
        // Set up event listeners
        setupEventListeners();
    }
    
    /**
     * Populate the node select dropdown.
     */
    function populateNodeSelect() {
        // Clear existing options
        serviceSelect.innerHTML = '<option value="">Select a node...</option>';
        
        // Sort nodes by ID for a better user experience
        const sortedNodes = [...nodes].sort((a, b) => {
            return a.id.localeCompare(b.id, undefined, { sensitivity: 'base' });
        });
        
        // Add new options, filtering out invisible nodes
        sortedNodes.forEach(node => {
            // Skip invisible/hidden nodes
            if (node.attrs && 
                (node.attrs.includes('style="invis"') || 
                 node.attrs.includes('style=invis') || 
                 node.attrs.includes('style="invisible"') || 
                 node.attrs.includes('style=invisible') ||
                 node.attrs.includes('style="hidden"') ||
                 node.attrs.includes('style=hidden'))) {
                return;
            }
            
            const option = document.createElement("option");
            option.value = node.id;
            option.textContent = node.id;
            serviceSelect.appendChild(option);
        });
    }

    function toggleUnlimitedHops() {
        if (unlimitedHopsCheckbox.checked) {
            hopLimitSlider.disabled = true;
            hopValueDisplay.textContent = "∞";
        } else {
            hopLimitSlider.disabled = false;
            hopValueDisplay.textContent = hopLimitSlider.value;
        }
        updateView();
    }
    
    
    /**
     * Set up event listeners for UI controls.
     */
    function setupEventListeners() {
        // Set up view mode and service select event listeners
        viewModeRadios.forEach(radio => {
            radio.addEventListener("change", updateView);
        });
        
        // Service select change
        serviceSelect.addEventListener("change", updateView);
        
        // Hop limit slider
        hopLimitSlider.addEventListener("input", function() {
            hopValueDisplay.textContent = this.value;
            updateView();
        });
        
        // Unlimited hops checkbox
        unlimitedHopsCheckbox.addEventListener("change", toggleUnlimitedHops);
    }
    
    /**
     * Handle node click event.
     * 
     * @param {string} nodeId - ID of the clicked node
     */
    function handleNodeClick(nodeId) {
        serviceSelect.value = nodeId;
        updateView();
    }
    
    /**
     * Update the view based on current selections.
     */
    function updateView() {
        const selectedNodeId = serviceSelect.value;
        const viewMode = document.querySelector('input[name="view-mode"]:checked').value;
        const unlimitedHops = unlimitedHopsCheckbox.checked;
        const maxHops = unlimitedHops ? Number.MAX_SAFE_INTEGER : parseInt(hopLimitSlider.value);
        
        // First clear previous selections using direct DOM manipulation
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
            
        // Reset the Graph's internal selection array
        if (window.Graph && window.Graph.currentSelection) {
            window.Graph.currentSelection = [];
        }
        
        // Now apply new highlighting if needed
        if (selectedNodeId) {
            Graph.updateView(selectedNodeId, viewMode, maxHops);
        }
    }
    
    /**
     * Update the DOT source and refresh the graph.
     * 
     * @param {string} newDotSource - New DOT source
     */
    function updateDotSource(newDotSource) {
        // Update the graph with new DOT source
        const { nodes: newNodes, edges: newEdges } = Graph.updateGraph(newDotSource, handleNodeClick);
        
        // Update nodes and edges
        nodes = newNodes;
        edges = newEdges;
        
        // Repopulate the node select dropdown
        populateNodeSelect();
        
        // Update the view
        updateView();
    }
    
    // Public API
    return {
        initialize
    };
})();

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    App.initialize();
}); 