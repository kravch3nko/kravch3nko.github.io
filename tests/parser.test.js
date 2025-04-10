/**
 * Tests for the Parser module.
 */

describe('Parser Module', () => {
    describe('parseDotSource', () => {
        test('should parse nodes and edges from DOT source', () => {
            const dotSource = `
                digraph G {
                  "Node1" [label="First Node"];
                  "Node2" [label="Second Node"];
                  "Node3" [label="Third Node"];
                  
                  "Node1" -> "Node2";
                  "Node2" -> "Node3";
                  "Node1" -> "Node3";
                }
            `;
            
            const result = Parser.parseDotSource(dotSource);
            
            // Check nodes
            expect(result.nodes).toHaveLength(3);
            expect(result.nodes[0].id).toBe('Node1');
            expect(result.nodes[1].id).toBe('Node2');
            expect(result.nodes[2].id).toBe('Node3');
            
            // Check edges
            expect(result.edges).toHaveLength(3);
            expect(result.edges[0]).toEqual({ source: 'Node1', target: 'Node2' });
            expect(result.edges[1]).toEqual({ source: 'Node2', target: 'Node3' });
            expect(result.edges[2]).toEqual({ source: 'Node1', target: 'Node3' });
        });
        
        test('should handle empty DOT source', () => {
            const result = Parser.parseDotSource('');
            expect(result.nodes).toEqual([]);
            expect(result.edges).toEqual([]);
        });
        
        test('should handle DOT source with no nodes or edges', () => {
            const dotSource = 'digraph G { }';
            const result = Parser.parseDotSource(dotSource);
            expect(result.nodes).toEqual([]);
            expect(result.edges).toEqual([]);
        });
    });
    
    describe('findDownstreamNodes', () => {
        const testEdges = [
            { source: 'A', target: 'B' },
            { source: 'B', target: 'C' },
            { source: 'C', target: 'D' },
            { source: 'A', target: 'E' },
            { source: 'E', target: 'F' }
        ];
        
        test('should find nodes downstream with specified hop limit', () => {
            const resultSet = new Set();
            const hopsMap = new Map();
            hopsMap.set('A', 0);
            
            Parser.findDownstreamNodes('A', resultSet, hopsMap, 2, testEdges);
            
            // Within 2 hops: B, C, E, F
            expect(resultSet.has('B')).toBe(true);
            expect(resultSet.has('C')).toBe(true);
            expect(resultSet.has('E')).toBe(true);
            expect(resultSet.has('F')).toBe(true);
            expect(resultSet.has('D')).toBe(false); // 3 hops away from A
            expect(resultSet.size).toBe(4);
            
            // Verify hop distances
            expect(hopsMap.get('B')).toBe(1);
            expect(hopsMap.get('E')).toBe(1);
            expect(hopsMap.get('C')).toBe(2);
            expect(hopsMap.get('F')).toBe(2);
        });
        
        test('should not exceed max hops', () => {
            const resultSet = new Set();
            const hopsMap = new Map();
            hopsMap.set('A', 0);
            
            Parser.findDownstreamNodes('A', resultSet, hopsMap, 1, testEdges);
            
            // Within 1 hop: B, E
            expect(resultSet.has('B')).toBe(true);
            expect(resultSet.has('E')).toBe(true);
            expect(resultSet.has('C')).toBe(false);
            expect(resultSet.has('F')).toBe(false);
            expect(resultSet.has('D')).toBe(false);
            expect(resultSet.size).toBe(2);
        });
        
        test('should handle nodes with no downstream dependencies', () => {
            const resultSet = new Set();
            const hopsMap = new Map();
            hopsMap.set('F', 0);
            
            Parser.findDownstreamNodes('F', resultSet, hopsMap, 5, testEdges);
            
            // F has no downstream nodes
            expect(resultSet.size).toBe(0);
        });
        
        test('should update hop distance if shorter path is found', () => {
            // Add a direct edge from A to C
            const customEdges = [
                ...testEdges,
                { source: 'A', target: 'C' } // This creates a direct path A->C (1 hop) in addition to A->B->C (2 hops)
            ];
            
            const resultSet = new Set();
            const hopsMap = new Map();
            hopsMap.set('A', 0);
            
            Parser.findDownstreamNodes('A', resultSet, hopsMap, 3, customEdges);
            
            // C should be 1 hop away (not 2)
            expect(hopsMap.get('C')).toBe(1);
        });
    });
    
    describe('findUpstreamNodes', () => {
        const testEdges = [
            { source: 'A', target: 'B' },
            { source: 'B', target: 'C' },
            { source: 'C', target: 'D' },
            { source: 'A', target: 'E' },
            { source: 'E', target: 'F' }
        ];
        
        test('should find nodes upstream with specified hop limit', () => {
            const resultSet = new Set();
            const hopsMap = new Map();
            hopsMap.set('D', 0);
            
            Parser.findUpstreamNodes('D', resultSet, hopsMap, 2, testEdges);
            
            // Within 2 hops: C, B
            expect(resultSet.has('C')).toBe(true);
            expect(resultSet.has('B')).toBe(true);
            expect(resultSet.has('A')).toBe(false); // 3 hops away from D
            expect(resultSet.size).toBe(2);
            
            // Verify hop distances
            expect(hopsMap.get('C')).toBe(1);
            expect(hopsMap.get('B')).toBe(2);
        });
        
        test('should not exceed max hops', () => {
            const resultSet = new Set();
            const hopsMap = new Map();
            hopsMap.set('D', 0);
            
            Parser.findUpstreamNodes('D', resultSet, hopsMap, 1, testEdges);
            
            // Within 1 hop: C
            expect(resultSet.has('C')).toBe(true);
            expect(resultSet.has('B')).toBe(false);
            expect(resultSet.has('A')).toBe(false);
            expect(resultSet.size).toBe(1);
        });
        
        test('should handle nodes with no upstream dependencies', () => {
            const resultSet = new Set();
            const hopsMap = new Map();
            hopsMap.set('A', 0);
            
            Parser.findUpstreamNodes('A', resultSet, hopsMap, 5, testEdges);
            
            // A has no upstream nodes
            expect(resultSet.size).toBe(0);
        });
    });
}); 