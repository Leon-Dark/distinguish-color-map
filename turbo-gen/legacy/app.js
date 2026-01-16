const App = (function() {
    
    let generatedKnots = null;
    let worker = null;
    let isOptimizing = false;

    const elements = {
        generateBtn: null,
        exportBtn: null,
        progressBar: null,
        progressText: null,
        currentScore: null,
        bestScore: null,
        avgDeltaE: null,
        timeElapsed: null,
        iterations: null,
        iterationsValue: null,
        seed: null,
        nq: null,
        nqValue: null,
        samples: null,
        samplesValue: null,
        w1: null,
        w1Value: null,
        w2: null,
        w2Value: null,
        w3: null,
        w3Value: null
    };

    function init() {
        bindElements();
        attachEventListeners();
        initializeWorker();
        
        generatedKnots = Spline.initializeKnots(42);
        
        renderAll();
    }

    function bindElements() {
        elements.generateBtn = document.getElementById('generate-btn');
        elements.exportBtn = document.getElementById('export-btn');
        elements.progressBar = document.getElementById('progress-bar');
        elements.progressText = document.getElementById('progress-text');
        elements.currentScore = document.getElementById('current-score');
        elements.bestScore = document.getElementById('best-score');
        elements.avgDeltaE = document.getElementById('avg-delta-e');
        elements.timeElapsed = document.getElementById('time-elapsed');
        
        elements.iterations = document.getElementById('iterations');
        elements.iterationsValue = document.getElementById('iterations-value');
        elements.seed = document.getElementById('seed');
        elements.nq = document.getElementById('nq');
        elements.nqValue = document.getElementById('nq-value');
        elements.samples = document.getElementById('samples');
        elements.samplesValue = document.getElementById('samples-value');
        
        elements.w1 = document.getElementById('w1');
        elements.w1Value = document.getElementById('w1-value');
        elements.w2 = document.getElementById('w2');
        elements.w2Value = document.getElementById('w2-value');
        elements.w3 = document.getElementById('w3');
        elements.w3Value = document.getElementById('w3-value');
    }

    function attachEventListeners() {
        elements.generateBtn.addEventListener('click', handleGenerate);
        elements.exportBtn.addEventListener('click', handleExport);
        
        elements.iterations.addEventListener('input', (e) => {
            elements.iterationsValue.textContent = e.target.value;
        });
        
        elements.nq.addEventListener('input', (e) => {
            elements.nqValue.textContent = e.target.value;
        });
        
        elements.samples.addEventListener('input', (e) => {
            elements.samplesValue.textContent = e.target.value;
        });
        
        elements.w1.addEventListener('input', (e) => {
            elements.w1Value.textContent = parseFloat(e.target.value).toFixed(1);
        });
        
        elements.w2.addEventListener('input', (e) => {
            elements.w2Value.textContent = parseFloat(e.target.value).toFixed(1);
        });
        
        elements.w3.addEventListener('input', (e) => {
            elements.w3Value.textContent = parseFloat(e.target.value).toFixed(1);
        });
    }

    function initializeWorker() {
        try {
            worker = new Worker('worker.js');
            worker.onmessage = handleWorkerMessage;
            worker.onerror = (error) => {
                console.error('Worker error:', error);
                alert('Worker failed. Running optimization in main thread (may freeze UI).');
                worker = null;
            };
        } catch (err) {
            console.warn('Worker not available, will run in main thread');
            worker = null;
        }
    }

    function handleGenerate() {
        if (isOptimizing) return;
        
        // Auto-generate a new random seed for each optimization to ensure variety
        const newSeed = Math.floor(Math.random() * 1000000);
        elements.seed.value = newSeed;
        
        const params = {
            iterations: parseInt(elements.iterations.value),
            seed: newSeed,
            nq: parseInt(elements.nq.value),
            samples: parseInt(elements.samples.value),
            weights: {
                w1: parseFloat(elements.w1.value),
                w2: parseFloat(elements.w2.value),
                w3: parseFloat(elements.w3.value)
            }
        };
        
        isOptimizing = true;
        elements.generateBtn.disabled = true;
        elements.generateBtn.textContent = '⏳ Optimizing...';
        elements.progressBar.style.width = '0%';
        elements.progressText.textContent = 'Starting optimization...';
        
        if (worker) {
            worker.postMessage({ type: 'optimize', params });
        } else {
            runOptimizationMainThread(params);
        }
    }

    function runOptimizationMainThread(params) {
        let frameCount = 0;
        const maxFrames = params.iterations;
        
        let currentKnots = Spline.initializeKnots(params.seed);
        let currentResult = Generator.scoreColormap(currentKnots, params);
        
        // Ensure initial state is valid or accept it as starting point
        let currentScore = currentResult.valid ? currentResult.score : Infinity;
        
        let bestKnots = JSON.parse(JSON.stringify(currentKnots));
        let bestScore = currentScore;
        
        const rng = Spline.seededRandom(params.seed);
        let temperature = 1.0;
        const coolingRate = 0.995;
        
        const startTime = Date.now();
        
        function step() {
            // Create a candidate by modifying current knots
            const candidateKnots = JSON.parse(JSON.stringify(currentKnots));
            
            const numMutations = Math.floor(rng() * 3) + 1;
            for (let m = 0; m < numMutations; m++) {
                const knotIdx = Math.floor(rng() * Spline.NUM_KNOTS);
                const channel = Math.floor(rng() * 3);
                const delta = (rng() - 0.5) * temperature * 0.3;
                candidateKnots[knotIdx][channel] = Math.max(0, Math.min(1, 
                    candidateKnots[knotIdx][channel] + delta
                ));
            }
            
            const candidateResult = Generator.scoreColormap(candidateKnots, params);
            
            let accept = false;
            if (candidateResult.valid) {
                const candidateScore = candidateResult.score;
                
                if (currentScore === Infinity) {
                    accept = true;
                } else {
                    // Minimization logic
                    const deltaScore = candidateScore - currentScore;
                    accept = deltaScore < 0 || rng() < Math.exp(-deltaScore / (temperature * 0.1));
                }
            } else if (currentScore === Infinity) {
                // If both are invalid, try to minimize the failure penalty (e.g. clipping)
                // to guide the optimizer towards a valid state
                const currentPenalty = currentResult.clipPenalty || 100;
                const candidatePenalty = candidateResult.clipPenalty || 100;
                
                // Use annealing for penalty minimization too, to avoid getting stuck
                const deltaPenalty = candidatePenalty - currentPenalty;
                accept = deltaPenalty < 0 || rng() < Math.exp(-deltaPenalty / (temperature * 0.05));
            }
                
            if (accept) {
                currentKnots = candidateKnots;
                currentScore = candidateResult.valid ? candidateResult.score : Infinity;
                currentResult = candidateResult;
                
                if (candidateResult.valid && candidateResult.score < bestScore) {
                    bestKnots = JSON.parse(JSON.stringify(candidateKnots));
                    bestScore = candidateResult.score;
                }
            }
            
            temperature *= coolingRate;
            frameCount++;
            
            if (frameCount % 20 === 0) {
                const progress = frameCount / maxFrames;
                const elapsed = Date.now() - startTime;
                updateProgress({
                    progress,
                    iteration: frameCount,
                    currentScore: currentScore,
                    bestScore: bestScore,
                    elapsed,
                    bestKnots: JSON.parse(JSON.stringify(bestKnots))
                });
            }
            
            if (frameCount < maxFrames) {
                requestAnimationFrame(step);
            } else {
                finishOptimization({
                    knots: bestKnots,
                    score: bestScore,
                    time: Date.now() - startTime
                });
            }
        }
        
        requestAnimationFrame(step);
    }

    function handleWorkerMessage(e) {
        const { type, data } = e.data;
        
        if (type === 'progress') {
            updateProgress(data);
        } else if (type === 'complete') {
            finishOptimization(data);
        }
    }

    function updateProgress(data) {
        const pct = Math.round(data.progress * 100);
        elements.progressBar.style.width = pct + '%';
        elements.progressText.textContent = `Iteration ${data.iteration} (${pct}%)`;
        
        const formatScore = (s) => (s === Infinity || s >= 9999) ? 'Searching...' : s.toFixed(4);
        
        elements.currentScore.textContent = formatScore(data.currentScore);
        elements.bestScore.textContent = formatScore(data.bestScore);
        elements.timeElapsed.textContent = (data.elapsed / 1000).toFixed(1) + 's';
        
        if (data.bestKnots && data.bestScore !== Infinity && data.bestScore < 9999) {
            generatedKnots = data.bestKnots;
            renderColorStrips();
            renderCharts();
            renderImages();
        }
    }

    function finishOptimization(result) {
        generatedKnots = result.knots;
        
        elements.progressBar.style.width = '100%';
        elements.progressText.textContent = 'Optimization complete!';
        elements.bestScore.textContent = result.score.toFixed(4);
        elements.timeElapsed.textContent = (result.time / 1000).toFixed(1) + 's';
        
        isOptimizing = false;
        elements.generateBtn.disabled = false;
        elements.generateBtn.textContent = '🚀 Generate Colormap';
        
        renderAll();
    }

    function handleExport() {
        if (!generatedKnots) {
            alert('Please generate a colormap first!');
            return;
        }
        
        const exported = Generator.exportColormap(generatedKnots, 256);
        
        const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'generated-colormap.json';
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('CSS Gradient:', exported.cssGradient);
        alert('Colormap exported! Check console for CSS gradient string.');
    }

    function renderAll() {
        renderColorStrips();
        renderCharts();
        renderImages();
        calculateDeltaE();
    }

    function renderColorStrips() {
        renderColorStrip('turbo-strip', turboRGB);
        renderColorStrip('generated-strip', (u) => Spline.evaluateRGB(u, generatedKnots));
    }

    function renderColorStrip(canvasId, colorFunc) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        for (let x = 0; x < width; x++) {
            const u = x / (width - 1);
            const rgb = colorFunc(u);
            const r = Math.round(rgb[0] * 255);
            const g = Math.round(rgb[1] * 255);
            const b = Math.round(rgb[2] * 255);
            
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, 0, 1, height);
        }
    }

    function renderCharts() {
        renderRGBChart();
        renderLightnessChart();
        renderDeltaChart();
    }

    function renderRGBChart() {
        const canvas = document.getElementById('rgb-chart');
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const samples = 256;
        
        ctx.clearRect(0, 0, width, height);
        
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);
        
        drawGrid(ctx, width, height);
        
        const turboR = [];
        const turboG = [];
        const turboB = [];
        const genR = [];
        const genG = [];
        const genB = [];
        
        for (let i = 0; i < samples; i++) {
            const u = i / (samples - 1);
            const trgb = turboRGB(u);
            const grgb = Spline.evaluateRGB(u, generatedKnots);
            
            turboR.push(trgb[0]);
            turboG.push(trgb[1]);
            turboB.push(trgb[2]);
            genR.push(grgb[0]);
            genG.push(grgb[1]);
            genB.push(grgb[2]);
        }
        
        drawCurve(ctx, turboR, width, height, '#ff4444', 2, false);
        drawCurve(ctx, turboG, width, height, '#44ff44', 2, false);
        drawCurve(ctx, turboB, width, height, '#4444ff', 2, false);
        
        drawCurve(ctx, genR, width, height, '#ff0000', 1.5, true);
        drawCurve(ctx, genG, width, height, '#00ff00', 1.5, true);
        drawCurve(ctx, genB, width, height, '#0000ff', 1.5, true);
        
        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.fillText('Solid: Turbo | Dashed: Generated', 10, 20);
    }

    function renderLightnessChart() {
        const canvas = document.getElementById('lightness-chart');
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const samples = 256;
        
        ctx.clearRect(0, 0, width, height);
        
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);
        
        drawGrid(ctx, width, height);
        
        const turboL = [];
        const genL = [];
        
        for (let i = 0; i < samples; i++) {
            const u = i / (samples - 1);
            const tlab = Perceptual.sRGBToOKLab(turboRGB(u));
            const glab = Perceptual.sRGBToOKLab(Spline.evaluateRGB(u, generatedKnots));
            
            turboL.push(tlab[0]);
            genL.push(glab[0]);
        }
        
        drawCurve(ctx, turboL, width, height, '#667eea', 2, false);
        drawCurve(ctx, genL, width, height, '#764ba2', 2, true);
        
        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.fillText('Blue: Turbo (Target) | Purple: Generated', 10, 20);
    }

    function renderDeltaChart() {
        const canvas = document.getElementById('delta-chart');
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const samples = 256;
        
        ctx.clearRect(0, 0, width, height);
        
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);
        
        drawGrid(ctx, width, height);
        
        const deltaE = [];
        let sumDelta = 0;
        
        for (let i = 0; i < samples; i++) {
            const u = i / (samples - 1);
            const tlab = Perceptual.sRGBToOKLab(turboRGB(u));
            const glab = Perceptual.sRGBToOKLab(Spline.evaluateRGB(u, generatedKnots));
            const de = Perceptual.deltaE_OKLab(tlab, glab);
            deltaE.push(de / 0.5);
            sumDelta += de;
        }
        
        const avgDelta = sumDelta / samples;
        elements.avgDeltaE.textContent = avgDelta.toFixed(4);
        
        drawCurve(ctx, deltaE, width, height, '#ff6b6b', 2, false);
        
        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.fillText(`Avg ΔE: ${avgDelta.toFixed(4)} (scaled to 0.5 max)`, 10, 20);
    }

    function drawGrid(ctx, width, height) {
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= 4; i++) {
            const y = (i / 4) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        for (let i = 0; i <= 4; i++) {
            const x = (i / 4) * width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }

    function drawCurve(ctx, data, width, height, color, lineWidth, dashed) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        
        if (dashed) {
            ctx.setLineDash([5, 5]);
        } else {
            ctx.setLineDash([]);
        }
        
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
            const x = (i / (data.length - 1)) * width;
            const y = height - data[i] * height;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function renderImages() {
        const size = 256;
        
        const gradientField = generateSmoothGradient(size);
        const radialField = generateRadialGradient(size);
        const patternField = generateMultiFrequencyPattern(size);
        
        applyColormapToImage(gradientField, 'img-gradient-turbo', turboRGB);
        applyColormapToImage(gradientField, 'img-gradient-gen', (u) => Spline.evaluateRGB(u, generatedKnots));
        
        applyColormapToImage(radialField, 'img-radial-turbo', turboRGB);
        applyColormapToImage(radialField, 'img-radial-gen', (u) => Spline.evaluateRGB(u, generatedKnots));
        
        applyColormapToImage(patternField, 'img-pattern-turbo', turboRGB);
        applyColormapToImage(patternField, 'img-pattern-gen', (u) => Spline.evaluateRGB(u, generatedKnots));
    }

    function generateSmoothGradient(size) {
        const field = [];
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const u = x / (size - 1);
                field.push(u);
            }
        }
        return field;
    }

    function generateRadialGradient(size) {
        const field = [];
        const cx = size / 2;
        const cy = size / 2;
        const maxDist = Math.sqrt(cx * cx + cy * cy);
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const u = Math.min(1, dist / maxDist);
                field.push(u);
            }
        }
        return field;
    }

    function generateMultiFrequencyPattern(size) {
        const field = [];
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const nx = x / size;
                const ny = y / size;
                
                let value = 0;
                value += 0.5 * Math.sin(nx * Math.PI * 4);
                value += 0.3 * Math.sin(ny * Math.PI * 8);
                value += 0.2 * Math.sin((nx + ny) * Math.PI * 12);
                
                const u = (value + 1) / 2;
                field.push(Math.max(0, Math.min(1, u)));
            }
        }
        return field;
    }

    function applyColormapToImage(field, canvasId, colorFunc) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        const size = canvas.width;
        
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;
        
        for (let i = 0; i < field.length; i++) {
            const u = field[i];
            const rgb = colorFunc(u);
            
            data[i * 4 + 0] = Math.round(rgb[0] * 255);
            data[i * 4 + 1] = Math.round(rgb[1] * 255);
            data[i * 4 + 2] = Math.round(rgb[2] * 255);
            data[i * 4 + 3] = 255;
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    function calculateDeltaE() {
        const samples = 256;
        let sumDelta = 0;
        
        for (let i = 0; i < samples; i++) {
            const u = i / (samples - 1);
            const tlab = Perceptual.sRGBToOKLab(turboRGB(u));
            const glab = Perceptual.sRGBToOKLab(Spline.evaluateRGB(u, generatedKnots));
            sumDelta += Perceptual.deltaE_OKLab(tlab, glab);
        }
        
        const avgDelta = sumDelta / samples;
        elements.avgDeltaE.textContent = avgDelta.toFixed(4);
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
