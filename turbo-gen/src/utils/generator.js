import * as Perceptual from './perceptual';
import * as Spline from './spline';

// Default weights corresponding to the user's Python formula
// w1: Lightness Fit, w2: Vibrancy, w3: Smoothness
export const DEFAULT_WEIGHTS = {
    w1: 1.0,    // Lightness Fit
    w2: 1.0,    // Vibrancy
    w3: 1.0     // Smoothness
};

function getCurvature(labSamples) {
    let curvatureSum = 0;
    // 2nd derivative (finite difference)
    // k = |P(t+1) - 2P(t) + P(t-1)|
    for (let i = 1; i < labSamples.length - 1; i++) {
        const pPrev = labSamples[i - 1];
        const pCurr = labSamples[i];
        const pNext = labSamples[i + 1];

        // Vector calculation in 3D OKLab space
        const d1 = [
            pCurr[0] - pPrev[0],
            pCurr[1] - pPrev[1],
            pCurr[2] - pPrev[2]
        ];
        const d2 = [
            pNext[0] - pCurr[0],
            pNext[1] - pCurr[1],
            pNext[2] - pCurr[2]
        ];

        const changeVector = [
            d2[0] - d1[0],
            d2[1] - d1[1],
            d2[2] - d1[2]
        ];

        const mag = Math.sqrt(
            changeVector[0] * changeVector[0] +
            changeVector[1] * changeVector[1] +
            changeVector[2] * changeVector[2]
        );
        curvatureSum += mag * mag; // Use squared magnitude for stricter penalty
    }
    return curvatureSum / (labSamples.length - 2);
}

function getMeanChroma(labSamples) {
    let sumChroma = 0;
    for (const lab of labSamples) {
        const C = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
        sumChroma += C;
    }
    return sumChroma / labSamples.length;
}

// Principle 1: Maximize dynamic range
function getLightnessDynamicRange(labSamples) {
    const lightnesses = labSamples.map(lab => lab[0]);
    const minL = Math.min(...lightnesses);
    const maxL = Math.max(...lightnesses);
    const range = maxL - minL;

    // Encourage maximum range (penalty if range < 0.5)
    const rangePenalty = Math.max(0, 0.5 - range);

    return rangePenalty;
}

// Principle 2: Avoid extreme values at endpoints
function getLightnessEndpointQuality(labSamples) {
    const lightnesses = labSamples.map(lab => lab[0]);
    const minL = Math.min(...lightnesses);
    const maxL = Math.max(...lightnesses);
    const range = maxL - minL;

    if (range < 0.01) return 100; // Invalid: no range

    // Calculate relative positions of endpoints within the dynamic range
    const startRelative = (lightnesses[0] - minL) / range;
    const endRelative = (lightnesses[lightnesses.length - 1] - minL) / range;

    // Start should be in lower range (5%-30%), end in mid range (30%-60%)
    // This prevents both endpoints from being too bright
    let penalty = 0;
    penalty += Math.max(0, 0.05 - startRelative);     // Start not too low
    penalty += Math.max(0, startRelative - 0.3);      // Start not too high
    penalty += Math.max(0, 0.3 - endRelative);        // End not too low
    penalty += Math.max(0, endRelative - 0.6);        // End not too high

    return penalty;
}

// Principle 3: Higher contrast in middle region + Monotonicity
function getMiddleRegionContrast(labSamples) {
    const midStart = Math.floor(labSamples.length * 0.3);
    const midEnd = Math.floor(labSamples.length * 0.7);

    // Calculate average perceptual distance in middle region
    let midDist = 0;
    let midCount = 0;
    for (let i = midStart; i < midEnd - 1; i++) {
        midDist += Perceptual.deltaE_OKLab(labSamples[i], labSamples[i + 1]);
        midCount++;
    }
    midDist = midCount > 0 ? midDist / midCount : 0;

    // Calculate average perceptual distance in edge regions
    let edgeDist = 0;
    let edgeCount = 0;
    for (let i = 0; i < midStart - 1; i++) {
        edgeDist += Perceptual.deltaE_OKLab(labSamples[i], labSamples[i + 1]);
        edgeCount++;
    }
    for (let i = midEnd; i < labSamples.length - 1; i++) {
        edgeDist += Perceptual.deltaE_OKLab(labSamples[i], labSamples[i + 1]);
        edgeCount++;
    }
    edgeDist = edgeCount > 0 ? edgeDist / edgeCount : 0;

    // Encourage middle region to have higher contrast (larger perceptual distance)
    // Return negative value so minimization encourages higher middle contrast
    const contrastDiff = midDist - edgeDist;
    return -contrastDiff; // Minimize this = maximize middle contrast
}

// Principle 4: Lightness monotonicity (prevent W-shape)
function getLightnessMonotonicity(labSamples) {
    const lightnesses = labSamples.map(lab => lab[0]);
    const midPoint = Math.floor(lightnesses.length / 2);

    let penalty = 0;

    // First half should be generally increasing (or at least not decreasing much)
    for (let i = 1; i < midPoint; i++) {
        const decrease = lightnesses[i - 1] - lightnesses[i];
        if (decrease > 0.02) { // Allow small fluctuations
            penalty += decrease * 10; // Penalize decreases in first half
        }
    }

    // Second half should be generally decreasing (or at least not increasing much)
    for (let i = midPoint + 1; i < lightnesses.length; i++) {
        const increase = lightnesses[i] - lightnesses[i - 1];
        if (increase > 0.02) { // Allow small fluctuations
            penalty += increase * 10; // Penalize increases in second half
        }
    }

    return penalty;
}

export function scoreColormap(knotValues, params) {
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

    // Hard constraints check
    let valid = true;
    let failReason = null;

    // 1. Gamut/Clipping constraint
    if (totalClip > 0.001) {
        valid = false;
        failReason = 'clipping';
    }

    // 2. Quantization robustness constraint
    if (valid) {
        const qIndices = [];
        for (let i = 0; i < Nq; i++) {
            qIndices.push(Math.floor((i / (Nq - 1)) * (M - 1)));
        }

        for (let i = 0; i < qIndices.length - 1; i++) {
            const idx1 = qIndices[i];
            const idx2 = qIndices[i + 1];
            const dist = Perceptual.distance3D(labSamples[idx1], labSamples[idx2]);
            if (dist < 0.015) {
                valid = false;
                failReason = 'quantization';
                break;
            }
        }
    }

    // 3. Hue Coverage constraint (≥ 180 degrees)
    if (valid) {
        const hues = labSamples.map(lab => Perceptual.OKLabToOKLCH(lab)[2]);

        // Calculate hue range considering circular nature (0-360)
        let minHue = Math.min(...hues);
        let maxHue = Math.max(...hues);
        let hueRange = maxHue - minHue;

        // Also check the complement range (going the other way around the circle)
        let complementRange = 360 - hueRange;
        let actualRange = Math.min(hueRange, complementRange);

        if (actualRange < 180) {
            valid = false;
            failReason = 'hue_coverage';
        }
    }

    // 4. Hue Monotonicity constraint (no reversals)
    if (valid) {
        const hues = labSamples.map(lab => Perceptual.OKLabToOKLCH(lab)[2]);

        // Detect hue direction reversals
        let reversalCount = 0;
        let prevDirection = 0; // -1: decreasing, 1: increasing, 0: not set

        for (let i = 1; i < hues.length; i++) {
            let delta = hues[i] - hues[i - 1];

            // Normalize delta to [-180, 180] to handle circular wrapping
            if (delta > 180) delta -= 360;
            if (delta < -180) delta += 360;

            if (Math.abs(delta) > 5) { // Ignore tiny fluctuations
                const currentDirection = delta > 0 ? 1 : -1;

                if (prevDirection !== 0 && currentDirection !== prevDirection) {
                    reversalCount++;
                }
                prevDirection = currentDirection;
            }
        }

        if (reversalCount > 0) {
            valid = false;
            failReason = 'hue_monotonicity';
        }
    }

    // Metrics for Scoring Function (Principle-based)
    // Principle 1: Dynamic range
    const dynamicRangeScore = getLightnessDynamicRange(labSamples);

    // Principle 2: Endpoint quality
    const endpointScore = getLightnessEndpointQuality(labSamples);

    // Principle 3: Middle contrast
    const middleContrastScore = getMiddleRegionContrast(labSamples);

    // Principle 4: Monotonicity (prevent W-shape)
    const monotonicityScore = getLightnessMonotonicity(labSamples);

    // L_smooth: Curvature (2nd derivative)
    const smoothnessScore = getCurvature(labSamples);

    // L_vibrancy: Mean Chroma
    const vibrancyScore = getMeanChroma(labSamples);

    // Scoring formula (Minimization):
    // Score = w1 * (DynamicRange + Endpoint + MiddleContrast) + w3 * Smoothness - w2 * Vibrancy
    // w1 -> Lightness Quality (dynamic range, endpoint, middle contrast)
    // w2 -> Vibrancy (mean chroma maximization)
    // w3 -> Smoothness (curvature minimization)

    const lightnessQualityScore =
        dynamicRangeScore * 20.0 +      // Heavily penalize insufficient range
        endpointScore * 10.0 +          // Penalize poor endpoint placement
        middleContrastScore * 3.0 +     // Reward higher middle contrast (reduced weight)
        monotonicityScore * 15.0;       // Heavily penalize W-shape

    const score =
        weights.w1 * lightnessQualityScore +
        weights.w3 * smoothnessScore * 50.0 -
        weights.w2 * vibrancyScore;

    return {
        score,
        valid,
        failReason,
        hueStd: 0, // Legacy
        lightStd: dynamicRangeScore + endpointScore, // For display
        satStd: vibrancyScore,    // Reused for display
        contrast: -middleContrastScore,  // For display (negate back to positive)
        uniformity: smoothnessScore, // Reused
        clipPenalty: totalClip
    };
}

export function optimizeColormap(params, progressCallback) {
    const iterations = params.iterations || 1000;
    const seed = params.seed || 42;
    const rng = Spline.seededRandom(seed);

    let currentKnots = Spline.initializeKnots(seed);
    let currentResult = scoreColormap(currentKnots, params);

    // Initialize score. For minimization, start with Infinity if invalid.
    let currentScore = currentResult.valid ? currentResult.score : Infinity;

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

        let accept = false;

        if (candidateResult.valid) {
            const candidateScore = candidateResult.score;

            // If current is invalid (Infinity), accept any valid
            if (currentScore === Infinity) {
                accept = true;
            } else {
                // Metropolis criterion for minimization: exp(-(new - old) / T)
                const deltaScore = candidateScore - currentScore;
                accept = deltaScore < 0 || rng() < Math.exp(-deltaScore / (temperature * 0.1));
                // Scaled temperature for reasonable probabilities
            }
        } else if (currentScore === Infinity) {
            // If both are invalid, try to minimize the failure penalty (e.g. clipping)
            // to guide the optimizer towards a valid state
            const currentPenalty = currentResult.clipPenalty || 100;
            const candidatePenalty = candidateResult.clipPenalty || 100;

            // Use annealing for penalty minimization too, to avoid getting stuck
            // Higher temperature effective for penalty search
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

        if (progressCallback && iter % 10 === 0) {
            const progress = (iter + 1) / iterations;
            const elapsed = Date.now() - startTime;
            progressCallback({
                progress,
                iteration: iter + 1,
                currentScore: currentScore,
                bestScore: bestScore,
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

export function exportColormap(knotValues, samples = 256) {
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
