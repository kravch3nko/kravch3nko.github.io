/**
 * Parser module for DOT language.
 */
const Parser = (function() {
    /**
     * Parses DOT source to extract nodes and edges.
     * 
     * @param {string} dotSource - The DOT source code to parse
     * @returns {Object} Object containing arrays of nodes and edges
     */
    function parseDotSource(dotSource) {
        const nodes = [];
        const edges = [];
        
        // Extract nodes
        const nodeRegex = /"([^"]+)"\s*\[([^\]]+)\]/g;
        let match;
        while ((match = nodeRegex.exec(dotSource)) !== null) {
            const nodeId = match[1];
            const nodeAttrs = match[2];
            nodes.push({
                id: nodeId,
                attrs: nodeAttrs
            });
        }
        
        // Extract edges
        const edgeRegex = /"([^"]+)"\s*->\s*"([^"]+)"/g;
        while ((match = edgeRegex.exec(dotSource)) !== null) {
            const source = match[1];
            const target = match[2];
            edges.push({
                source: source,
                target: target
            });
        }
        
        return { nodes, edges };
    }
    
    /**
     * Find downstream nodes (nodes that depend on the selected service).
     * 
     * @param {string} serviceId - ID of the starting node
     * @param {Set} resultSet - Set to store found node IDs
     * @param {Map} hopsMap - Map to track hop distances
     * @param {number} maxHops - Maximum number of hops to traverse
     * @param {Array} edges - Array of edge objects with source and target
     */
    function findDownstreamNodes(serviceId, resultSet, hopsMap, maxHops, edges) {
        const currentHops = hopsMap.get(serviceId) || 0;
        if (currentHops >= maxHops) return;
        
        // Find direct dependencies
        const directDependencies = edges.filter(edge => edge.source === serviceId);
        
        directDependencies.forEach(edge => {
            const targetId = edge.target;
            const targetHops = currentHops + 1;
            
            // Only process if target is not yet visited or we found a shorter path
            if (!hopsMap.has(targetId) || hopsMap.get(targetId) > targetHops) {
                resultSet.add(targetId);
                hopsMap.set(targetId, targetHops);
                
                // Recursively find dependencies of dependencies if under max hops
                if (targetHops < maxHops) {
                    findDownstreamNodes(targetId, resultSet, hopsMap, maxHops, edges);
                }
            }
        });
    }
    
    /**
     * Find upstream nodes (nodes that the selected service depends on).
     * 
     * @param {string} serviceId - ID of the starting node
     * @param {Set} resultSet - Set to store found node IDs
     * @param {Map} hopsMap - Map to track hop distances
     * @param {number} maxHops - Maximum number of hops to traverse
     * @param {Array} edges - Array of edge objects with source and target
     */
    function findUpstreamNodes(serviceId, resultSet, hopsMap, maxHops, edges) {
        const currentHops = hopsMap.get(serviceId) || 0;
        if (currentHops >= maxHops) return;
        
        // Find direct dependencies
        const directDependencies = edges.filter(edge => edge.target === serviceId);
        
        directDependencies.forEach(edge => {
            const sourceId = edge.source;
            const sourceHops = currentHops + 1;
            
            // Only process if source is not yet visited or we found a shorter path
            if (!hopsMap.has(sourceId) || hopsMap.get(sourceId) > sourceHops) {
                resultSet.add(sourceId);
                hopsMap.set(sourceId, sourceHops);
                
                // Recursively find dependencies of dependencies if under max hops
                if (sourceHops < maxHops) {
                    findUpstreamNodes(sourceId, resultSet, hopsMap, maxHops, edges);
                }
            }
        });
    }

    // Public API
    return {
        parseDotSource,
        findDownstreamNodes,
        findUpstreamNodes
    };
})(); 