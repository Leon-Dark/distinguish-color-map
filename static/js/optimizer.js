// Global scoring weights (lambdas) - can be adjusted via UI
window.scoringLambdas = {
    alloc: 10.0,
    uniform: 1.0,
    in: 0.5,
    bt: 2.0
};

function simulatedAnnealing(initial_temperature = 100000, end_temperature = 0.0001, cooling_param = 0.99) {
    // initialize colors with thermal-like zigzag luminance (alternating high-low)
    let palette_size = data_arr[current_data_id].controlPoints.length;
    let initial_colors = []
    for (let i = 0; i < palette_size; i++) {
        let hue = (initial_hue - i * 360 / palette_size + 360) % 360
        // Thermal-like: alternating between low (20-40) and high (60-80) luminance
        let luminance;
        if (i % 2 === 0) {
            // Even index: low luminance
            luminance = 20 + Math.random() * 20
        } else {
            // Odd index: high luminance
            luminance = 60 + Math.random() * 20
        }
        let c = gamutMappingHCL(hue, 100, luminance)
        initial_colors.push([hue, c, luminance])
    }
    for (let i = 0; i < palette_size; i++) {
        disturbColor(initial_colors, i)
    }

    //default parameters
    let iterate_times = 0;
    let max_iteration_times = 10000000;
    cur_temper = initial_temperature;

    let o = {
        palette: initial_colors,
        score: getPaletteScore(initial_colors)
    },
        preferredObj = o;

    function deepCopy(arr) {
        let array = []
        for (let i = 0; i < arr.length; i++) {
            array.push(arr[i].slice())
        }
        return array
    }
    function hueDistance(h1, h2) {
        let diff = Math.abs(h1 - h2) % 360;
        return Math.min(diff, 360 - diff);
    }
    function disturbColor(pal, idx) {

        let c = pal[idx]
        if (idx != 0) {
            // disturb hue
            c[0] = (c[0] + getRandomIntInclusive(-5, 5) + 360) % 360
            while (hueDistance(c[0], pal[(idx - 1 + pal.length) % pal.length][0]) < 10 || hueDistance(c[0], pal[(idx + 1) % pal.length][0]) < 10 || isClockwise(c[0], pal[(idx + 1) % pal.length][0]) || isClockwise(pal[(idx - 1 + pal.length) % pal.length][0], c[0])) {
                c[0] = (c[0] + getRandomIntInclusive(-5, 5) + 360) % 360
            }
        }

        // once the hue changed, we need to find a suitable luminance
        // Random perturbation of luminance (no monotonicity constraint)
        c[2] = Math.max(10, Math.min(90, c[2] + getRandomIntInclusive(-10, 10)))
        c[1] = gamutMappingHCL(c[0], 100, c[2])
        // 寻找一个合适的luminance，使得该颜色不是黑色或白色
        for (let j = 0; j < 30; j++) {
            let hcl = d3.hcl(c[0], c[1], c[2])
            let name = getColorName(hcl).slice(0, 3),
                nd_black = getNameDifference(d3.lab(hcl), d3.lab(d3.rgb(0, 0, 0))),
                nd_white = getNameDifference(d3.lab(hcl), d3.lab(d3.rgb(255, 255, 255))),
                has_name = name.every(item => item != undefined && item != 'grey')
            if (has_name && nd_black > 0.95 && nd_white > 0.95) {
                // console.log(idx, hcl, name, nd_black, nd_white);
                break
            }
            // Adjust luminance within global bounds only
            if (nd_black < 0.95 && c[2] < 90)
                c[2] += 1
            if (nd_white < 0.95 && c[2] > 10)
                c[2] -= 1
            // Clamp to global bounds
            c[2] = Math.max(10, Math.min(90, c[2]))
            // luminance change, max chroma should also change
            c[1] = gamutMappingHCL(c[0], 100, c[2])

            // find a color that has a name
            if (!has_name) {
                for (let i = 0; i < 30; i++) {
                    for (let k = 0; k < 50; k++) {
                        // Search within global bounds
                        let searchL = c[2]
                        
                        if (Math.abs(90 - c[2]) < Math.abs(c[2] - 10)) {
                            searchL = Math.max(10, c[2] - i)
                        }
                        else {
                            searchL = Math.min(90, c[2] + i)
                        }
                        hcl = d3.hcl(c[0], c[1] - k, searchL)
                        name = getColorName(hcl).slice(0, 3)
                        has_name = name.every(item => item != undefined && item != 'grey')
                        if (has_name) {
                            c[1] = hcl.c
                            c[2] = hcl.l
                            // console.log(idx, i, k, c, name);
                            break
                        }
                    }
                    if (has_name) {
                        break
                    }
                }
            }
        }
        // }

        // now we get the min or max luminance, disturb the chroma
        // c[1] = normScope(c[1] - getRandomIntInclusive(0, 5), [0, 100]) // Chroma
    }

    let intermediate_scores = []
    while (cur_temper > end_temperature) {
        for (let i = 0; i < 1; i++) { //disturb multiple times at each temperature
            intermediate_scores.push([iterate_times, o.score])
            iterate_times++;

            // disturb the parameters
            let curr_colors = deepCopy(o.palette)
            let idx = getRandomIntInclusive(0, palette_size - 1)
            disturbColor(curr_colors, idx)
            // for (let j = 0; j < 25; j++) {
            //     if (checkCDConstraint(curr_colors)) {
            //         break
            //     }
            //     curr_colors = deepCopy(o.palette)
            //     idx = getRandomIntInclusive(0, palette_size - 1)
            //     disturbColor(curr_colors, idx)
            // }

            let o2 = {
                palette: curr_colors,
                score: getPaletteScore(curr_colors)
            };
            // console.log(idx, "o.score", o.score, "palette", o.palette[idx], "o2.score", o2.score, "palette", curr_colors[idx]);


            let delta_score = o.score - o2.score;
            let prob = Math.exp((-delta_score) / cur_temper)
            if (delta_score <= 0 || delta_score > 0 && Math.random() <= prob) {
                o = o2;
                if (preferredObj.score - o.score < 0) {
                    preferredObj = o;
                }
            }
            if (iterate_times > max_iteration_times) {
                break;
            }
        }

        cur_temper *= cooling_param;
    }
    preferredObj.curve = intermediate_scores
    preferredObj.initialization = initial_colors
    // preferredObj.palette = initial_colors
    console.log("preferredObj", preferredObj, iterate_times, JSON.stringify(preferredObj.palette));
    
    // Update UI with final scoring details
    if (typeof updateScoreBreakdown === 'function' && window.lastScoringDetails) {
        updateScoreBreakdown(window.lastScoringDetails);
    }
    
    let min_dis = 10000
    for (let i = 0; i < preferredObj.palette.length; i++) {
        let hcl = d3.hcl(preferredObj.palette[i][0], preferredObj.palette[i][1], preferredObj.palette[i][2])
        let name = getColorName(hcl).slice(0, 3),
            nd_black = getNameDifference(d3.lab(hcl), d3.lab(d3.rgb(0, 0, 0))),
            nd_white = getNameDifference(d3.lab(hcl), d3.lab(d3.rgb(255, 255, 255)))
        console.log(i, preferredObj.palette[i], name, name.every(item => item != undefined && item != 'grey'), nd_black, nd_white, getColorSaliency(hcl));
        for (let j = i + 1; j < preferredObj.palette.length; j++) {
            let dis = d3_ciede2000(d3.lab(hcl), d3.lab(d3.hcl(preferredObj.palette[j][0], preferredObj.palette[j][1], preferredObj.palette[j][2])))
            min_dis = min_dis > dis ? dis : min_dis
        }
    }
    console.log("minimum color distance", min_dis);

    let div = d3.select("#chartDiv")
    // showTrend(intermediate_scores, div, preferredObj.score)
    d3.select("#scoreId").style("display", "block").text(preferredObj.score.toFixed(2))
    return preferredObj;
}


function hclToRgb(h, c, l) {
    // 1️⃣ HCL → Lab
    let hRad = (h / 360) * 2 * Math.PI; // 角度转弧度
    let a = c * Math.cos(hRad);
    let b = c * Math.sin(hRad);

    // 2️⃣ Lab → XYZ
    let y = (l + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;

    // Lab 非线性转换
    const labToXyz = t => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
    x = labToXyz(x) * 95.047;
    y = labToXyz(y) * 100.000;
    z = labToXyz(z) * 108.883;

    // 3️⃣ XYZ → RGB
    r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    b = x * 0.0557 + y * -0.2040 + z * 1.0570;

    // Gamma 校正
    const gammaCorrect = t => (t > 0.0031308 ? 1.055 * Math.pow(t, 1 / 2.4) - 0.055 : 12.92 * t);
    r = gammaCorrect(r / 100);
    g = gammaCorrect(g / 100);
    b = gammaCorrect(b / 100);

    // 归一化到 [0, 255]
    // r = Math.round(Math.max(0, Math.min(1, r)) * 255);
    // g = Math.round(Math.max(0, Math.min(1, g)) * 255);
    // b = Math.round(Math.max(0, Math.min(1, b)) * 255);

    return d3.rgb(r, g, b)
}
// 通过 Gamut Mapping 调整 HCL 颜色，使其落入可表示的 RGB 颜色空间
function gamutMappingHCL(h, c, l, maxIterations = 100, tolerance = 1e-5) {
    let cAdjusted = c;

    for (let i = 0; i < maxIterations; i++) {
        // 使用 d3-color 进行 HCL 转换
        // let color = d3.hcl(h, cAdjusted, l);
        // let rgb = d3.rgb(d3.lab(color));
        // hcl转rgb
        let rgb = hclToRgb(h, cAdjusted, l);

        // 检查是否落在 [0, 255] 的 RGB 颜色空间
        if (rgb.r >= 0 && rgb.r <= 255 && rgb.g >= 0 && rgb.g <= 255 && rgb.b >= 0 && rgb.b <= 255) {
            return cAdjusted;
        }

        // 如果超出 RGB 颜色空间，则减少 Chroma
        cAdjusted *= 0.95;

        // 如果 C 值已经极小，则停止调整
        if (cAdjusted < tolerance) break;
    }

    // 返回最终调整后的chroma
    return cAdjusted;
}

function color2Lab(c) {
    return d3.lab(d3.hcl(c[0], c[1], c[2]))
}

function color2rgb(c) {
    let cc = d3.rgb(d3.lab(d3.hcl(c[0], c[1], c[2])))
    return [cc.r, cc.g, cc.b, 1]
}

function checkCDConstraint(pal) {
    let cd
    for (let i = 0; i < pal.length; i++) {
        for (let j = i + 1; j < pal.length; j++) {
            cd = d3_ciede2000(color2Lab(pal[i]), color2Lab(pal[j]))
            if (cd < 3) return false
        }
        cd = d3_ciede2000(color2Lab(pal[i]), d3.lab(d3.rgb(255, 255, 255)))
        if (cd < 3) return false
    }
    return true
}

// contrast sensitivity
function calcContrastSensitivity(pal, i, j) {
    let lab_i = pal[i], lab_j = pal[j]
    let dE = Math.sqrt((lab_i.L - lab_j.L) * (lab_i.L - lab_j.L) + (lab_i.a - lab_j.a) * (lab_i.a - lab_j.a) + (lab_i.b - lab_j.b) * (lab_i.b - lab_j.b))
    let ds = Math.abs(i - j) / pal.length
    return 3.4 * Math.pow(dE / ds, 0.879)
}

// --- Smoothness Helper Functions ---

function delta(v1, v2) {
    return [v2.L - v1.L, v2.a - v1.a, v2.b - v1.b];
}

function dot(v1, v2) {
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
}

function vecLength(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

// ---------------------------------

/**
 * Natural cubic spline interpolation
 * @param {Array} x - Parameter values (0, 1, 2, ..., n-1)
 * @param {Array} y - Data values to interpolate
 * @param {Array} xi - Query points
 * @returns {Array} - Interpolated values at query points
 */
function cubicSplineInterpolation(x, y, xi) {
    const n = x.length;
    
    // Compute second derivatives using natural spline (zero second derivative at endpoints)
    const h = [];
    const alpha = [];
    
    for (let i = 0; i < n - 1; i++) {
        h[i] = x[i + 1] - x[i];
    }
    
    for (let i = 1; i < n - 1; i++) {
        alpha[i] = (3 / h[i]) * (y[i + 1] - y[i]) - (3 / h[i - 1]) * (y[i] - y[i - 1]);
    }
    
    // Solve tridiagonal system
    const l = new Array(n).fill(0);
    const mu = new Array(n).fill(0);
    const z = new Array(n).fill(0);
    
    l[0] = 1;
    mu[0] = 0;
    z[0] = 0;
    
    for (let i = 1; i < n - 1; i++) {
        l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
        mu[i] = h[i] / l[i];
        z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
    }
    
    l[n - 1] = 1;
    z[n - 1] = 0;
    
    const c = new Array(n).fill(0);
    const b = new Array(n).fill(0);
    const d = new Array(n).fill(0);
    
    c[n - 1] = 0;
    
    for (let j = n - 2; j >= 0; j--) {
        c[j] = z[j] - mu[j] * c[j + 1];
        b[j] = (y[j + 1] - y[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
        d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
    }
    
    // Evaluate spline at query points
    const yi = [];
    for (let k = 0; k < xi.length; k++) {
        let xk = xi[k];
        
        // Find the interval
        let i = 0;
        for (let j = 0; j < n - 1; j++) {
            if (xk >= x[j] && xk <= x[j + 1]) {
                i = j;
                break;
            }
        }
        
        // Evaluate cubic polynomial
        const dx = xk - x[i];
        yi[k] = y[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx;
    }
    
    return yi;
}

/**
 * Interpolate hue with circular wrapping
 * @param {Array} hues - Hue values at control points
 * @param {Array} params - Parameter values (0 to palette.length-1)
 * @param {Array} queryParams - Query parameter values
 * @returns {Array} - Interpolated hue values
 */
function interpolateHue(hues, params, queryParams) {
    // Convert hues to unwrapped values for spline interpolation
    let unwrappedHues = [hues[0]];
    for (let i = 1; i < hues.length; i++) {
        let diff = hues[i] - hues[i - 1];
        // Take shortest path
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        unwrappedHues[i] = unwrappedHues[i - 1] + diff;
    }
    
    // Interpolate unwrapped hues
    let interpolatedUnwrapped = cubicSplineInterpolation(params, unwrappedHues, queryParams);
    
    // Wrap back to [0, 360)
    return interpolatedUnwrapped.map(h => (h % 360 + 360) % 360);
}

function resampleControlColors(palette) {
    /**
     * resample the control colors to get the colormap
     * using natural cubic spline interpolation
     */
    let sample_num = 10;
    let totalSamples = (palette.length - 1) * sample_num + 1;
    
    // Control point parameters (0, 1, 2, ..., n-1)
    let controlParams = [];
    for (let i = 0; i < palette.length; i++) {
        controlParams.push(i);
    }
    
    // Query parameters
    let queryParams = [];
    for (let i = 0; i < totalSamples; i++) {
        queryParams.push(i / sample_num);
    }
    
    // Extract H, C, L channels
    let hues = palette.map(c => c[0]);
    let chromas = palette.map(c => c[1]);
    let luminances = palette.map(c => c[2]);
    
    // Interpolate each channel
    let interpHues = interpolateHue(hues, controlParams, queryParams);
    let interpChromas = cubicSplineInterpolation(controlParams, chromas, queryParams);
    let interpLuminances = cubicSplineInterpolation(controlParams, luminances, queryParams);
    
    // Combine into colormap
    let colormap = [];
    for (let i = 0; i < totalSamples; i++) {
        colormap.push([interpHues[i], interpChromas[i], interpLuminances[i]]);
    }
    
    return colormap;
}

/**
 * New scoring function based on cluster allocation, perceptual uniformity, and color-name constraints.
 * The colormap is treated as a continuous curve c(u) where u ∈ [0, 1].
 * 
 * @param {Array} palette - Control points in HCL space [[h, c, l], ...]
 * @returns {number} - Score (lower is better, this is a LOSS function)
 */
function getPaletteScore(palette) {
    // Get GMM model from current data
    const dataObj = data_arr[current_data_id];
    if (!dataObj || !dataObj.gmmModel) {
        console.warn("GMM model not available, using fallback scoring");
        return 0;
    }
    
    const gmmModel = dataObj.gmmModel;
    const K = gmmModel.nComponents;
    const pi_k = gmmModel.weights;  // Cluster weights (sum to 1)
    
    // Dense sampling parameter
    const R = 512;  // Number of dense samples along the curve
    
    // 1. Dense sampling along the colormap curve using cubic spline
    let samples = [];  // {u, lab}
    
    // Control point parameters
    let controlParams = [];
    for (let i = 0; i < palette.length; i++) {
        controlParams.push(i);
    }
    
    // Query parameters for dense sampling
    let queryParams = [];
    for (let i = 0; i < R; i++) {
        queryParams.push((i / (R - 1)) * (palette.length - 1));
    }
    
    // Extract H, C, L channels
    let hues = palette.map(c => c[0]);
    let chromas = palette.map(c => c[1]);
    let luminances = palette.map(c => c[2]);
    
    // Interpolate each channel using cubic spline
    let interpHues = interpolateHue(hues, controlParams, queryParams);
    let interpChromas = cubicSplineInterpolation(controlParams, chromas, queryParams);
    let interpLuminances = cubicSplineInterpolation(controlParams, luminances, queryParams);
    
    for (let i = 0; i < R; i++) {
        let u = i / (R - 1);
        let h = interpHues[i];
        let c = interpChromas[i];
        let l = interpLuminances[i];
        
        let lab = d3.lab(d3.hcl(h, c, l));
        samples.push({u: u, lab: lab});
    }
    
    // Helper: Perceptual distance in Lab space (CIEDE2000 if available, else Euclidean)
    function perceptualDist(lab1, lab2) {
        if (typeof d3_ciede2000 === 'function') {
            return d3_ciede2000(lab1, lab2);
        }
        let dL = lab1.L - lab2.L;
        let da = lab1.a - lab2.a;
        let db = lab1.b - lab2.b;
        return Math.sqrt(dL*dL + da*da + db*db);
    }
    
    // 2. Compute arc-length density
    let d_i = [];  // Arc-length between adjacent samples
    let S_total = 0;
    for (let i = 0; i < R - 1; i++) {
        let dist = perceptualDist(samples[i].lab, samples[i + 1].lab);
        d_i.push(dist);
        S_total += dist;
    }
    
    // 3. Cluster allocation term (L_alloc)
    // Map cluster means to u coordinates via global CDF
    const extent = dataObj.extent;
    let U_bounds = [0];  // U_0 = 0
    for (let k = 0; k < K; k++) {
        let cumSum = 0;
        for (let j = 0; j <= k; j++) {
            cumSum += pi_k[j];
        }
        U_bounds.push(cumSum);
    }
    
    // Compute actual arc-length allocated to each cluster
    let S_k = new Array(K).fill(0);
    for (let i = 0; i < R - 1; i++) {
        let u_i = samples[i].u;
        // Find which cluster this sample belongs to
        for (let k = 0; k < K; k++) {
            if (u_i >= U_bounds[k] && u_i < U_bounds[k + 1]) {
                S_k[k] += d_i[i];
                break;
            }
        }
    }
    
    // Compute allocation loss
    let L_alloc = 0;
    for (let k = 0; k < K; k++) {
        let pi_hat_k = S_k[k] / S_total;
        L_alloc += Math.pow(pi_hat_k - pi_k[k], 2);
    }
    
    // 4. Global perceptual uniformity term (L_uniform)
    // Compute arc-length density s_i = d_i / delta_u
    let delta_u = 1 / (R - 1);
    let s_i = d_i.map(d => d / delta_u);
    let s_bar = s_i.reduce((sum, s) => sum + s, 0) / s_i.length;
    
    let variance_s = 0;
    for (let i = 0; i < s_i.length; i++) {
        variance_s += Math.pow(s_i[i] - s_bar, 2);
    }
    let L_uniform = (1 / Math.max(s_bar, 1e-10)) * Math.sqrt(variance_s / s_i.length);
    
    // 5. Color-name constraints
    // 5a. Compute representative colors (CDF median) for each cluster
    let rep_colors = [];
    for (let k = 0; k < K; k++) {
        // Use cluster mean mapped to u-space
        let clusterMean = gmmModel.means[k];
        let u_rep = (clusterMean - extent[0]) / (extent[1] - extent[0]);
        u_rep = Math.max(0, Math.min(1, u_rep));
        
        // Find corresponding sample
        let repIndex = Math.round(u_rep * (R - 1));
        rep_colors.push(samples[repIndex].lab);
    }
    
    // 5b. Intra-cluster semantic consistency (L_name_in)
    let L_name_in = 0;
    for (let k = 0; k < K; k++) {
        let clusterSamples = [];
        for (let i = 0; i < R; i++) {
            let u_i = samples[i].u;
            if (u_i >= U_bounds[k] && u_i < U_bounds[k + 1]) {
                clusterSamples.push(samples[i].lab);
            }
        }
        
        if (clusterSamples.length > 0) {
            let totalDist = 0;
            for (let lab of clusterSamples) {
                totalDist += getNameDifference(lab, rep_colors[k]);
            }
            L_name_in += totalDist / clusterSamples.length;
        }
    }
    
    // 5c. Inter-cluster semantic separability (R_name_between)
    let R_name_between = 0;
    for (let k = 0; k < K - 1; k++) {
        R_name_between += getNameDifference(rep_colors[k], rep_colors[k + 1]);
    }
    
    // 6. Final loss function using global lambdas
    const lambda_alloc = window.scoringLambdas.alloc;
    const lambda_uniform = window.scoringLambdas.uniform;
    const lambda_in = window.scoringLambdas.in;
    const lambda_bt = window.scoringLambdas.bt;
    
    let totalLoss = lambda_alloc * L_alloc 
                  + lambda_uniform * L_uniform 
                  + lambda_in * L_name_in 
                  - lambda_bt * R_name_between;
    
    // Store detailed scoring for UI display
    if (typeof window.lastScoringDetails === 'undefined') {
        window.lastScoringDetails = {};
    }
    window.lastScoringDetails = {
        totalScore: -totalLoss,
        totalLoss: totalLoss,
        L_alloc: L_alloc,
        L_uniform: L_uniform,
        L_name_in: L_name_in,
        R_name_between: R_name_between,
        weighted: {
            alloc: lambda_alloc * L_alloc,
            uniform: lambda_uniform * L_uniform,
            nameIn: lambda_in * L_name_in,
            nameBt: lambda_bt * R_name_between
        }
    };
    
    // Return NEGATIVE loss (since optimizer maximizes score)
    return -totalLoss;
}

function getPaletteScoreResampled(palette) {

    // resampling the control points
    let resampled_palette = resampleControlColors(palette)

    let palette_lab = []
    for (let i = 0; i < resampled_palette.length; i++) {
        palette_lab.push(color2Lab(resampled_palette[i]))
    }

    // average contrast sensitivity
    let avg_contrast_sen = 0
    // average name difference
    let avg_name_diff = 0
    for (let i = 0; i < resampled_palette.length; i++) {
        for (let j = i + 1; j < resampled_palette.length; j++) {
            let cs = calcContrastSensitivity(palette_lab, i, j),
                nd = getNameDifference(palette_lab[i], palette_lab[j])
            avg_contrast_sen += cs
            avg_name_diff += nd
        }
    }
    let divider = resampled_palette.length * (resampled_palette.length - 1) / 2
    avg_contrast_sen /= divider
    avg_name_diff /= divider

    let total_score = 0.003 * avg_contrast_sen + avg_name_diff
    console.log("total_score", total_score, avg_contrast_sen, avg_name_diff);
    return total_score
}

// getPaletteScore = getPaletteScoreResampled


function swapHue(pal, x, y) {
    pal[x] = [pal[y][0], pal[x][1], pal[x][2]]
    pal[y] = [pal[x][0], pal[y][1], pal[y][2]]
}

function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
}

function normScope(v, vscope) {
    let normV = Math.max(vscope[0], v);
    normV = Math.min(normV, vscope[1]);
    return normV;
}

c3.load("static/js/lib/c3_data.json");
// color name lookup table
let color_name_map = {};
let name_range = [100000, -100000, 100000, -100000, 100000, -100000]
for (var c = 0; c < c3.color.length; ++c) {
    var x = c3.color[c];
    if (name_range[0] > x.L) name_range[0] = x.L;
    if (name_range[1] < x.L) name_range[1] = x.L;
    if (name_range[2] > x.a) name_range[2] = x.a;
    if (name_range[3] < x.a) name_range[3] = x.a;
    if (name_range[4] > x.b) name_range[4] = x.b;
    if (name_range[5] < x.b) name_range[5] = x.b;
    color_name_map[[x.L, x.a, x.b].join(",")] = c;
}
console.log("name_range", name_range);

var name_index_map = {};
for (var i = 0; i < c3.terms.length; ++i) {
    name_index_map[c3.terms[i]] = i;
}

function getColorNameIndex(c) {
    var x = d3.lab(c),
        L = 5 * Math.round(x.L / 5),
        a = 5 * Math.round(x.a / 5),
        b = 5 * Math.round(x.b / 5),
        s = [L, a, b].join(",");
    return color_name_map[s];
}

function getNameDifference(x1, x2) {
    let c1 = getColorNameIndex(x1),
        c2 = getColorNameIndex(x2);
    return 1 - c3.color.cosine(c1, c2);
}

function getColorName(color) {
    let c = getColorNameIndex(color),
        t = c3.color.relatedTerms(c, 3);
    if (t[0] != undefined) {
        return [c3.terms[t[0].index], c3.terms[t[1].index], c3.terms[t[2].index]]
    }
    return [undefined]
}


function getColorSaliency(x) {
    // color saliency range
    let minE = -4.5,
        maxE = 0;
    let c = getColorNameIndex(x);
    return (c3.color.entropy(c) - minE) / (maxE - minE);
}
