/**
 * Jest setup file to mock browser APIs and global dependencies.
 */

// Mock D3 and D3-Graphviz
global.d3 = {
    select: jest.fn(() => ({
        graphviz: jest.fn(() => ({
            width: jest.fn().mockReturnThis(),
            height: jest.fn().mockReturnThis(),
            zoom: jest.fn().mockReturnThis(),
            fit: jest.fn().mockReturnThis(),
            zoomIn: jest.fn(),
            zoomOut: jest.fn(),
            resetZoom: jest.fn(),
            renderDot: jest.fn().mockReturnThis(),
            on: jest.fn((event, callback) => {
                if (event === 'end') {
                    callback();
                }
                return {
                    render: jest.fn()
                };
            })
        })),
        style: jest.fn().mockReturnThis(),
        html: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnValue('Node1'),
        select: jest.fn().mockReturnThis(),
        classed: jest.fn().mockReturnThis(),
        empty: jest.fn().mockReturnValue(false),
        on: jest.fn()
    })),
    selectAll: jest.fn(() => ({
        classed: jest.fn().mockReturnThis(),
        each: jest.fn((callback) => {
            // Mock a few nodes to iterate through
            const nodes = [
                { id: 'Node1' },
                { id: 'Node2' },
                { id: 'Node3' }
            ];
            nodes.forEach(node => {
                callback.call(node);
            });
        }),
        on: jest.fn()
    }))
};

// Mock document
global.document = {
    getElementById: jest.fn(() => ({
        addEventListener: jest.fn(),
        classList: {
            toggle: jest.fn(),
            contains: jest.fn(() => true),
            remove: jest.fn(),
            add: jest.fn()
        },
        value: '',
        disabled: false,
        textContent: 'Button Text',
        innerHTML: ''
    })),
    querySelector: jest.fn(() => ({
        classList: {
            toggle: jest.fn(),
            contains: jest.fn(() => true)
        },
        textContent: 'Text',
        value: 'all'
    })),
    querySelectorAll: jest.fn(() => [
        {
            addEventListener: jest.fn(),
            checked: true,
            value: 'all'
        }
    ]),
    addEventListener: jest.fn(),
    createElement: jest.fn(() => ({
        value: '',
        textContent: '',
        title: '',
        id: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn()
    }))
};

// Mock window
global.window = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: jest.fn(),
    location: {
        origin: 'http://localhost',
        pathname: '/',
        search: ''
    },
    history: {
        pushState: jest.fn()
    }
};

// Mock Monaco Editor
global.monaco = {
    languages: {
        register: jest.fn(),
        setMonarchTokensProvider: jest.fn()
    },
    editor: {
        create: jest.fn(() => ({
            getValue: jest.fn(() => 'test dot source'),
            setValue: jest.fn()
        }))
    }
};

// Mock require
global.require = {
    config: jest.fn()
};
global.require.call = jest.fn((paths, callback) => {
    if (callback) callback();
});

// Make the modules globally available for tests
global.Utils = require('../js/utils');
global.Parser = require('../js/parser');
global.Editor = require('../js/editor');
global.Graph = require('../js/graph');
global.App = require('../js/app'); 