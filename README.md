# Graphviz Editor

An interactive web-based editor for creating and visualizing DOT graphs using Graphviz.

## Features

- Interactive graph visualization with D3 and Graphviz
- Monaco code editor with syntax highlighting for DOT language
- Multiple visualization modes:
  - Show all nodes and edges
  - Single node view (direct connections)
  - Downstream view (dependency tree)
  - Upstream view (reverse dependency tree)
  - Bidirectional view
- Hop limit control for large graphs
- Share functionality with URL compression
- Zoom and pan controls

## Architecture

The application follows a modular architecture for better testability and extensibility:

- **Utils**: Utility functions for URL handling and graph sharing
- **Parser**: Functions for parsing DOT syntax and traversing the graph
- **Editor**: Monaco editor integration
- **Graph**: D3 and Graphviz rendering and visualization
- **App**: Main application logic and UI interactions

## Development

### Setup

```bash
# Install dependencies
npm install

# Start the development server
npm start
```

### Testing

```bash
# Run tests
npm test
```

## Extension Points

The modular architecture makes it easy to extend the application:

1. **Add new visualization modes**: Extend the view mode options and implement new graph traversal algorithms in the Parser module.

2. **Add new graph layouts**: Modify the Graph module to support different layout engines or visualization styles.

3. **Enhance the editor**: Add features like autocompletion, validation, or templates in the Editor module.

4. **Add import/export options**: Add new functions to Utils for importing/exporting different formats.

## License

MIT 