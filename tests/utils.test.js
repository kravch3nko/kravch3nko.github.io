/**
 * Tests for the Utils module.
 */

// Mock the LZString library
global.LZString = {
    compressToEncodedURIComponent: jest.fn(str => `compressed_${str}`),
    decompressFromEncodedURIComponent: jest.fn(str => str.replace('compressed_', ''))
};

// Mock window.location
const originalLocation = window.location;
delete window.location;
window.location = {
    origin: 'http://example.com',
    pathname: '/index.html',
    search: '?c=compressed_testDotSource',
};

// Mock window.history
window.history = {
    pushState: jest.fn()
};

// Mock navigator.clipboard
navigator.clipboard = {
    writeText: jest.fn().mockResolvedValue(undefined)
};

describe('Utils Module', () => {
    describe('loadGraphFromUrl', () => {
        test('should load compressed graph from URL parameter', () => {
            const result = Utils.loadGraphFromUrl('defaultSource');
            expect(result).toBe('testDotSource');
            expect(LZString.decompressFromEncodedURIComponent).toHaveBeenCalledWith('compressed_testDotSource');
        });
        
        test('should use default source when URL has no graph parameter', () => {
            window.location.search = '';
            const result = Utils.loadGraphFromUrl('defaultSource');
            expect(result).toBe('defaultSource');
        });
        
        test('should handle legacy uncompressed format', () => {
            window.location.search = '?graph=legacyFormat';
            const result = Utils.loadGraphFromUrl('defaultSource');
            expect(result).toBe('legacyFormat');
        });
        
        test('should handle decompression errors', () => {
            LZString.decompressFromEncodedURIComponent.mockImplementationOnce(() => {
                throw new Error('Decompression failed');
            });
            window.location.search = '?c=invalid_compressed';
            const result = Utils.loadGraphFromUrl('defaultSource');
            expect(result).toBe('defaultSource');
        });
    });
    
    describe('updateUrlWithGraph', () => {
        test('should update URL with compressed graph data', () => {
            Utils.updateUrlWithGraph('newDotSource');
            expect(LZString.compressToEncodedURIComponent).toHaveBeenCalledWith('newDotSource');
            expect(window.history.pushState).toHaveBeenCalledWith(
                { graph: 'newDotSource' },
                '',
                'http://example.com/index.html?c=compressed_newDotSource'
            );
        });
    });
    
    describe('shareGraph', () => {
        test('should create shareable URL and copy to clipboard', async () => {
            const mockButton = { textContent: 'Share Graph' };
            jest.useFakeTimers();
            
            Utils.shareGraph('shareDotSource', mockButton);
            
            expect(LZString.compressToEncodedURIComponent).toHaveBeenCalledWith('shareDotSource');
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                'http://example.com/index.html?c=compressed_shareDotSource'
            );
            
            // Button text should be updated
            expect(mockButton.textContent).toBe('Link Copied!');
            
            // Fast-forward time
            jest.advanceTimersByTime(2000);
            
            // Button text should be restored
            expect(mockButton.textContent).toBe('Share Graph');
            
            jest.useRealTimers();
        });
        
        test('should handle clipboard errors', async () => {
            const mockButton = { textContent: 'Share Graph' };
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
            
            navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Clipboard error'));
            
            await Utils.shareGraph('errorDotSource', mockButton);
            
            expect(consoleSpy).toHaveBeenCalled();
            expect(alertSpy).toHaveBeenCalled();
            expect(mockButton.textContent).toBe('Share Graph'); // Text should not change
            
            consoleSpy.mockRestore();
            alertSpy.mockRestore();
        });
    });
}); 