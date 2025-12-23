const Generator = (function() {
    
    const DEFAULT_WEIGHTS = {
        w1: 1.0,    // Contrast (mean step)
        w2: 0.3,    // Anchor separation
        w3: 0.5,    // Step smoothness
        w4: 0.2,    // Curvature smoothness
        w5: 0.8,    // Lightness profile matching
        w6: 0.4,    // Quantization robustness
        w7: 2.0     // Gamut/Clipping penalty
    };

    function targetLightness(u) {
        const peakU = 0.55;
        const minL = 0.3;
        const maxL = 0.85;
        
        if (u < peakU) {
            return minL + (maxL - minL) * (u / peakU);
        } else {
            return maxL - (maxL - minL) * ((u - peakU) / (1 - peakU)) * 0.7;
        }
    }

    function scoreColormap(knotValues, params) {
        const M = params.samples || 256;
        const Nq = params.nq || 33;
        const weights = { ...DEFAULT_WEIGHTS, ...params.weights };
        
        const rgbSamples = [];
        const labSamples = [];
        let totalClip = 0;
        
        for (let i = 0; i < M; i++) {
            const u = i / (M - 1);
            const rgb = Spline.evaluateRGB(u, knotValues);
            const lab = Perceptual.sRGBToOKLab(rgb);
            rgbSamples.push(rgb);
            labSamples.push(lab);
            totalClip += Spline.getClipAmount(u, knotValues);
        }
        
        const perceptualSteps = [];
        for (let i = 0; i < M - 1; i++) {
            const dist = Perceptual.distance3D(labSamples[i], labSamples[i + 1]);
            perceptualSteps.push(dist);
        }
        
        const meanStep = perceptualSteps.reduce((a, b) => a + b, 0) / perceptualSteps.length;
        
        let stepVariance = 0;
        for (let i = 0; i < perceptualSteps.length - 1; i++) {
            const diff = perceptualSteps[i + 1] - perceptualSteps[i];
            stepVariance += diff * diff;
        }
        stepVariance /= (perceptualSteps.length - 1);
        
        let curvaturePenalty = 0;
        for (let i = 1; i < M - 1; i++) {
            const p0 = labSamples[i - 1];
            const p1 = labSamples[i];
            const p2 = labSamples[i + 1];
            const d = Math.sqrt(
                Math.pow(p2[0] - 2*p1[0] + p0[0], 2) +
                Math.pow(p2[1] - 2*p1[1] + p0[1], 2) +
                Math.pow(p2[2] - 2*p1[2] + p0[2], 2)
            );
            curvaturePenalty += d * d;
        }
        curvaturePenalty /= (M - 2);
        
        let lightnessMismatch = 0;
        for (let i = 0; i < M; i++) {
            const u = i / (M - 1);
            const targetL = targetLightness(u);
            const actualL = labSamples[i][0];
            const diff = targetL - actualL;
            lightnessMismatch += diff * diff;
        }
        lightnessMismatch /= M;
        
        const K = 6;
        const anchors = [];
        for (let i = 0; i < K; i++) {
            const idx = Math.floor((i / (K - 1)) * (M - 1));
            anchors.push(labSamples[idx]);
        }
        
        let minAnchorDist = Infinity;
        for (let i = 0; i < K; i++) {
            for (let j = i + 1; j < K; j++) {
                const dist = Perceptual.distance3D(anchors[i], anchors[j]);
                minAnchorDist = Math.min(minAnchorDist, dist);
            }
        }
        
        let quantPenalty = 0;
        const qIndices = [];
        for (let i = 0; i < Nq; i++) {
            qIndices.push(Math.floor((i / (Nq - 1)) * (M - 1)));
        }
        
        for (let i = 0; i < qIndices.length - 1; i++) {
            const idx1 = qIndices[i];
            const idx2 = qIndices[i + 1];
            const dist = Perceptual.distance3D(labSamples[idx1], labSamples[idx2]);
            if (dist < 0.03) {
                quantPenalty += (0.03 - dist) * 10;
            }
        }
        
        const clipPenalty = totalClip;
        
        const score = 
            weights.w1 * meanStep +
            weights.w2 * minAnchorDist -
            weights.w3 * stepVariance -
            weights.w4 * curvaturePenalty -
            weights.w5 * lightnessMismatch -
            weights.w6 * quantPenalty -
            weights.w7 * clipPenalty;
        
        return {
            score,
            meanStep,
            stepVariance,
            curvaturePenalty,
            lightnessMismatch,
            minAnchorDist,
            quantPenalty,
            clipPenalty
        };
    }

    function optimizeColormap(params, progressCallback) {
        const iterations = params.iterations || 1000;
        const seed = params.seed || 42;
        const rng = Spline.seededRandom(seed);
        
        let currentKnots = Spline.initializeKnots(seed);
        let currentScore = scoreColormap(currentKnots, params).score;
        let bestKnots = JSON.parse(JSON.stringify(currentKnots));
        let bestScore = currentScore;
        
        let temperature = 1.0;
        const coolingRate = 0.995;
        
        const startTime = Date.now();
        
        for (let iter = 0; iter < iterations; iter++) {
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
            
            const candidateResult = scoreColormap(candidateKnots, params);
            const candidateScore = candidateResult.score;
            
            const accept = candidateScore > currentScore || 
                          rng() < Math.exp((candidateScore - currentScore) / temperature);
            
            if (accept) {
                currentKnots = candidateKnots;
                currentScore = candidateScore;
                
                if (candidateScore > bestScore) {
                    bestKnots = JSON.parse(JSON.stringify(candidateKnots));
                    bestScore = candidateScore;
                }
            }
            
            temperature *= coolingRate;
            
            if (progressCallback && iter % 10 === 0) {
                const progress = (iter + 1) / iterations;
                const elapsed = Date.now() - startTime;
                progressCallback({
                    progress,
                    iteration: iter + 1,
                    currentScore,
                    bestScore,
                    elapsed,
                    bestKnots: JSON.parse(JSON.stringify(bestKnots))
                });
            }
        }
        
        const finalTime = Date.now() - startTime;
        
        return {
            knots: bestKnots,
            score: bestScore,
            time: finalTime
        };
    }

    function exportColormap(knotValues, samples = 256) {
        const colors = [];
        const cssStops = [];
        
        for (let i = 0; i < samples; i++) {
            const u = i / (samples - 1);
            const rgb = Spline.evaluateRGB(u, knotValues);
            
            colors.push({
                u: u,
                r: rgb[0],
                g: rgb[1],
                b: rgb[2]
            });
            
            const r255 = Math.round(rgb[0] * 255);
            const g255 = Math.round(rgb[1] * 255);
            const b255 = Math.round(rgb[2] * 255);
            const pct = Math.round(u * 100 * 10) / 10;
            cssStops.push(`rgb(${r255},${g255},${b255}) ${pct}%`);
        }
        
        const cssGradient = `linear-gradient(to right, ${cssStops.join(', ')})`;
        
        return {
            colors,
            cssGradient,
            knots: knotValues
        };
    }

    return {
        DEFAULT_WEIGHTS,
        targetLightness,
        scoreColormap,
        optimizeColormap,
        exportColormap
    };
})();
