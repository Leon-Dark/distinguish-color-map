import { optimizeColormap } from './utils/generator';

self.onmessage = function (e) {
    const { type, params } = e.data;

    if (type === 'optimize') {
        const result = optimizeColormap(params, (progress) => {
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
