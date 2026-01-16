const Spline = (function() {
    
    const KNOT_POSITIONS = [0, 1/6, 2/6, 3/6, 4/6, 5/6, 1];
    const NUM_KNOTS = 7;

    function catmullRom(t, p0, p1, p2, p3) {
        const t2 = t * t;
        const t3 = t2 * t;
        
        return 0.5 * (
            (2 * p1) +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        );
    }

    function evaluateSpline(u, knotValues, channel) {
        u = Math.max(0, Math.min(1, u));
        
        let segmentIndex = 0;
        for (let i = 0; i < NUM_KNOTS - 1; i++) {
            if (u >= KNOT_POSITIONS[i] && u <= KNOT_POSITIONS[i + 1]) {
                segmentIndex = i;
                break;
            }
        }
        
        const u0 = KNOT_POSITIONS[segmentIndex];
        const u1 = KNOT_POSITIONS[segmentIndex + 1];
        const localT = (u - u0) / (u1 - u0);
        
        const i0 = Math.max(0, segmentIndex - 1);
        const i1 = segmentIndex;
        const i2 = segmentIndex + 1;
        const i3 = Math.min(NUM_KNOTS - 1, segmentIndex + 2);
        
        const p0 = knotValues[i0][channel];
        const p1 = knotValues[i1][channel];
        const p2 = knotValues[i2][channel];
        const p3 = knotValues[i3][channel];
        
        return catmullRom(localT, p0, p1, p2, p3);
    }

    function evaluateRGB(u, knotValues) {
        const r = evaluateSpline(u, knotValues, 0);
        const g = evaluateSpline(u, knotValues, 1);
        const b = evaluateSpline(u, knotValues, 2);
        
        return [
            Math.max(0, Math.min(1, r)),
            Math.max(0, Math.min(1, g)),
            Math.max(0, Math.min(1, b))
        ];
    }

    function getClipAmount(u, knotValues) {
        const r = evaluateSpline(u, knotValues, 0);
        const g = evaluateSpline(u, knotValues, 1);
        const b = evaluateSpline(u, knotValues, 2);
        
        let clipAmount = 0;
        clipAmount += Math.max(0, -r) + Math.max(0, r - 1);
        clipAmount += Math.max(0, -g) + Math.max(0, g - 1);
        clipAmount += Math.max(0, -b) + Math.max(0, b - 1);
        
        return clipAmount;
    }

    function initializeKnotsFromRainbow() {
        // Rainbow colormap: Blue -> Cyan -> Green -> Yellow -> Red
        const rainbowRGB = [
            [0, 0, 255],      // Blue
            [0, 255, 255],    // Cyan
            [0, 255, 0],      // Green
            [255, 255, 0],    // Yellow
            [255, 0, 0],      // Red
        ];
        
        const knots = [];
        
        for (let i = 0; i < NUM_KNOTS; i++) {
            const u = KNOT_POSITIONS[i];
            
            // Interpolate between rainbow colors
            const scaledU = u * (rainbowRGB.length - 1);
            const idx0 = Math.floor(scaledU);
            const idx1 = Math.min(idx0 + 1, rainbowRGB.length - 1);
            const t = scaledU - idx0;
            
            const rgb0 = rainbowRGB[idx0];
            const rgb1 = rainbowRGB[idx1];
            
            // Linear interpolation in RGB space, then normalize to 0-1
            const r = (rgb0[0] * (1 - t) + rgb1[0] * t) / 255;
            const g = (rgb0[1] * (1 - t) + rgb1[1] * t) / 255;
            const b = (rgb0[2] * (1 - t) + rgb1[2] * t) / 255;
            
            knots.push([r, g, b]);
        }
        
        return knots;
    }

    function initializeKnots(seed) {
        // Start with rainbow as base
        const knots = initializeKnotsFromRainbow();
        
        // Add seed-based perturbation to create variety
        if (seed !== undefined && seed !== null) {
            const rng = seededRandom(seed);
            
            // Add small random perturbations to each knot
            for (let i = 0; i < knots.length; i++) {
                for (let c = 0; c < 3; c++) {
                    // Add ±10% random variation
                    const perturbation = (rng() - 0.5) * 0.2;
                    knots[i][c] = Math.max(0, Math.min(1, knots[i][c] + perturbation));
                }
            }
        }
        
        return knots;
    }
    
    function initializeKnotsRandom(seed) {
        const rng = seededRandom(seed);
        const knots = [];
        
        // Randomize the hue sweep to allow different colormap orientations
        // e.g. Red->Blue, Blue->Red, or other rainbow segments
        const startHue = rng() * 360; 
        const direction = rng() > 0.5 ? 1 : -1;
        const hueRange = 200 + rng() * 100; // Sweep between 240 and 340 degrees
        
        for (let i = 0; i < NUM_KNOTS; i++) {
            const u = KNOT_POSITIONS[i];
            
            // Calculate hue with random start and direction
            let hue = startHue + direction * (u * hueRange);
            // Normalize hue to 0-360
            hue = ((hue % 360) + 360) % 360;
            
            // Reduce saturation to avoid immediate gamut clipping
            // Previous 0.8-1.0 was too aggressive for random hues
            const saturation = 0.5 + rng() * 0.3;
            
            let lightness;
            if (u < 0.5) {
                lightness = 0.3 + u * 0.8;
            } else {
                lightness = 0.7 - (u - 0.5) * 0.6;
            }
            
            const hueRad = (hue / 360) * 2 * Math.PI;
            const L = lightness;
            const a = saturation * Math.cos(hueRad) * 0.4;
            const b = saturation * Math.sin(hueRad) * 0.4;
            
            const rgb = Perceptual.okLabToSRGB([L, a, b]);
            knots.push(rgb);
        }
        
        return knots;
    }

    function seededRandom(seed) {
        let state = seed;
        return function() {
            state = (state * 1664525 + 1013904223) % 4294967296;
            return state / 4294967296;
        };
    }

    return {
        KNOT_POSITIONS,
        NUM_KNOTS,
        evaluateRGB,
        getClipAmount,
        initializeKnots,
        initializeKnotsRandom,
        initializeKnotsFromRainbow,
        seededRandom
    };
})();
