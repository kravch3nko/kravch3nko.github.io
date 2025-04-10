/**
 * Utilities module for the Graphviz Editor.
 */
const Utils = (function() {
    /**
     * Loads graph data from URL parameters.
     * 
     * @param {string} defaultDotSource - Default DOT source to use if none is in URL
     * @returns {string} The loaded DOT source
     */
    function loadGraphFromUrl(defaultDotSource) {
        const urlParams = new URLSearchParams(window.location.search);
        const encodedDot = urlParams.get('graph');
        const compressedDot = urlParams.get('c');
        let dotSource;
        
        if (compressedDot) {
            try {
                // Decompress the DOT data from URL
                dotSource = LZString.decompressFromEncodedURIComponent(compressedDot);
                if (!dotSource) {
                    console.error("Decompression resulted in null/empty data");
                    dotSource = defaultDotSource;
                }
            } catch (e) {
                console.error("Error decompressing graph from URL:", e);
                dotSource = defaultDotSource;
            }
        } else if (encodedDot) {
            try {
                // Decode the DOT data from URL (legacy support)
                dotSource = decodeURIComponent(encodedDot);
            } catch (e) {
                console.error("Error decoding graph from URL:", e);
                dotSource = defaultDotSource;
            }
        } else {
            dotSource = defaultDotSource;
        }
        
        return dotSource;
    }
    
    /**
     * Updates the URL with compressed graph data.
     * 
     * @param {string} graphData - The DOT source to encode in the URL
     */
    function updateUrlWithGraph(graphData) {
        // Use LZ-based compression to reduce URL size
        const compressedGraph = LZString.compressToEncodedURIComponent(graphData);
        
        // Create URL with compressed data
        const newUrl = window.location.origin + 
                      window.location.pathname + 
                      '?c=' + compressedGraph;
        
        // Update URL without reloading the page
        window.history.pushState({ graph: graphData }, '', newUrl);
    }
    
    /**
     * Creates a shareable URL for the current graph and copies it to clipboard.
     * 
     * @param {string} dotSource - The current DOT source
     * @param {Element} button - The button element that was clicked
     */
    function shareGraph(dotSource, button) {
        // Create shareable URL with current graph
        const compressedGraph = LZString.compressToEncodedURIComponent(dotSource);
        const shareableUrl = window.location.origin + 
                            window.location.pathname + 
                            '?c=' + compressedGraph;
        
        // Copy to clipboard
        navigator.clipboard.writeText(shareableUrl)
            .then(() => {
                // Temporarily change button text to indicate success
                const originalText = button.textContent;
                button.textContent = 'Link Copied!';
                setTimeout(() => {
                    button.textContent = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Could not copy URL: ', err);
                alert('Failed to copy URL. Please copy it manually: ' + shareableUrl);
            });
    }

    // Public API
    return {
        loadGraphFromUrl,
        updateUrlWithGraph,
        shareGraph
    };
})(); 