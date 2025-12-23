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

    function initializeKnots(seed) {
        const rng = seededRandom(seed);
        const knots = [];
        
        for (let i = 0; i < NUM_KNOTS; i++) {
            const u = KNOT_POSITIONS[i];
            
            const hue = u * 280;
            const saturation = 0.8 + rng() * 0.2;
            
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
        seededRandom
    };
})();
