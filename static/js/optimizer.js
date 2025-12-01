function simulatedAnnealing(initial_temperature = 100000, end_temperature = 0.0001, cooling_param = 0.99) {
    // initialize colors
    let palette_size = data_arr[current_data_id].controlPoints.length;
    let initial_colors = []
    for (let i = 0; i < palette_size; i++) {
        let hue = (initial_hue - i * 360 / palette_size + 360) % 360
        let c = gamutMappingHCL(hue, 100, i % 2 == 0 ? 10 : 90)
        initial_colors.push([hue, c, i % 2 == 0 ? 10 : 90])
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
        // 开始和结束的luminance不进行修改
        // if (idx != 0 && idx != pal.length-1) {
        // 初始化luminance和chroma
        c[2] = idx % 2 == 0 ? 10 : 90
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
            if (nd_black < 0.95)
                c[2] += 1
            if (nd_white < 0.95)
                c[2] -= 1
            // luminance change, max chroma should also change
            c[1] = gamutMappingHCL(c[0], 100, c[2])

            // find a color that has a name
            if (!has_name) {
                for (let i = 0; i < 30; i++) {
                    for (let k = 0; k < 50; k++) {
                        if (Math.abs(90 - c[2]) < Math.abs(c[2] - 10)) {
                            hcl = d3.hcl(c[0], c[1] - k, c[2] - i)
                        }
                        else {
                            hcl = d3.hcl(c[0], c[1] - k, c[2] + i)
                        }
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

function calcSmoothness(palette) {
    if (palette.length < 3) return 0;

    let cosinePenalty = 0;
    for (let i = 0; i < palette.length - 2; i++) {
        let c1 = palette[i];
        let c2 = palette[i + 1];
        let c3 = palette[i + 2];

        // d1: c1 -> c2
        let d1 = delta(c1, c2);
        // d2: c2 -> c3
        let d2 = delta(c2, c3);

        let len1 = vecLength(d1);
        let len2 = vecLength(d2);

        // If points are too close, ignore direction penalty (handled by contrast metric)
        if (len1 < 1e-5 || len2 < 1e-5) {
            continue;
        }

        let cosine = dot(d1, d2) / (len1 * len2);

        // Transform cosine to penalty [0, 1]
        // cosine = 1 (straight) -> penalty = 0
        // cosine = -1 (sharp turn) -> penalty = 1
        cosinePenalty += (1 - cosine) / 2;
    }
    return cosinePenalty / (palette.length - 2);
}
// ---------------------------------

function resampleControlColors(palette) {
    /**
     * resample the control colors to get the colormap
     * here we use the linear interpolation and equally sampling to get the colormap
     */
    let colormap = [], tmp_c = [0, 0, 0, 1], sample_num = 10
    for (let i = 0; i < palette.length - 1; i++) {
        for (let j = 0; j < sample_num; j++) {
            tmp_c[0] = palette[i][0] + (palette[i + 1][0] - palette[i][0]) * j / sample_num
            tmp_c[1] = palette[i][1] + (palette[i + 1][1] - palette[i][1]) * j / sample_num
            tmp_c[2] = palette[i][2] + (palette[i + 1][2] - palette[i][2]) * j / sample_num
            colormap.push(tmp_c)
        }
    }
    colormap.push(palette[palette.length - 1])
    return colormap
}

function getPaletteScore(palette) {

    // whether resampling the control points? to do~
    let palette_lab = []
    for (let i = 0; i < palette.length; i++) {
        palette_lab.push(color2Lab(palette[i]))
    }

    // average contrast sensitivity
    let average_contrast_sen = 0
    // minimum name difference
    let min_name_diff = Number.MAX_SAFE_INTEGER
    for (let i = 0; i < palette.length; i++) {
        for (let j = i + 1; j < palette.length; j++) {
            let cs = calcContrastSensitivity(palette_lab, i, j),
                nd = getNameDifference(palette_lab[i], palette_lab[j])
            average_contrast_sen += cs
            min_name_diff = (min_name_diff > nd) ? nd : min_name_diff
        }
    }
    average_contrast_sen /= (palette.length * (palette.length - 1) / 2)

    // smoothness penalty (range [0, 1], smaller is better)
    let smoothness_penalty = calcSmoothness(palette_lab)
    // weight for smoothness
    let weight_smooth = 0.2

    // Total Score = (Contrast) + (Name Diff) - (Smoothness Penalty)
    let total_score = 0.003 * average_contrast_sen + min_name_diff - weight_smooth * smoothness_penalty
    
    return total_score
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

c3.load("/static/js/lib/c3_data.json");
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
