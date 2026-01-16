// Import scripts once when worker is created
importScripts('turbo.js', 'perceptual.js', 'spline.js', 'generator.js');

self.onmessage = function(e) {
    const { type, params } = e.data;
    
    if (type === 'optimize') {
        const result = Generator.optimizeColormap(params, (progress) => {
            self.postMessage({
                type: 'progress',
                data: progress
            });
        });
        
        self.postMessage({
            type: 'complete',
            data: result
        });
    }
};
