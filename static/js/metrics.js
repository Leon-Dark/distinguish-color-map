
/**
 * calculate the color name variation: the average of the name difference between all adjacent pairs of colors
 * @param {array} palette 
 */
function calcCNV(palette) {
    let m_palette = []
    // for (let i = 0; i < palette.length; i++) {
    //     m_palette.push(d3.lab(palette[i]))
    // }
    for (let i = 0; i < 8; i++) {
        var idx = Math.round(i / 7 * (palette.length - 1))
        m_palette.push(d3.lab(palette[idx]))
    }
    let sum = 0
    for (let i = 0; i < m_palette.length - 1; i++) {
        sum += getNameDifference(m_palette[i], m_palette[i + 1])
    }
    return sum / (palette.length - 1)
}

/**
 * discriminative power: the average color distance between all pairs of colors
 * @param {array} palette 
 */
function calcDiscPower(palette) {
    let m_palette = []
    for (let i = 0; i < palette.length; i++) {
        m_palette.push(d3.lab(palette[i]))
    }
    let sum = 0
    for (let i = 0; i < palette.length; i++) {
        for (let j = i + 1; j < palette.length; j++) {
            sum += d3_ciede2000(m_palette[i], m_palette[j])
        }
    }
    return sum / (palette.length * (palette.length - 1)) / 100.0 * 2.0
}

/**
 * perceptual uniformity: the standard deviation of adjacent color distances
 * @param {array} palette 
 */
function calcPercUnif(palette) {
    let m_palette = []
    for (let i = 0; i < palette.length; i++) {
        m_palette.push(d3.lab(palette[i]))
    }
    var meanDist = 0;
    var distances = [];
    for (let i = 0; i < palette.length - 1; i++) {
        var distance = d3_ciede2000(m_palette[i], m_palette[i + 1])
        meanDist += distance
        distances.push(distance);
    }
    meanDist /= (palette.length - 1);

    var stdDist = 0;
    for (var i = 0, len = distances.length; i < len; i++) {
        stdDist += Math.pow(distances[i] - meanDist, 2);
    }
    var penalty = Math.sqrt(stdDist / (distances.length - 1)) / meanDist;
    return penalty;
}

function delta(v1, v2) {
    return [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
}

function dot(v1, v2) {
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
}
function vecLength(v) {
    var l =
        Math.pow(v[0], 2) +
        Math.pow(v[1], 2) +
        Math.pow(v[2], 2);
    return Math.sqrt(l);
}
/**
 * smoothness: the curvature between adjacent colors
 * @param {array} palette 
 */
function calcSmoothness(palette) {
    let m_palette = []
    for (let i = 0; i < palette.length; i++) {
        let color = d3.lab(palette[i])
        m_palette.push([color.L, color.a, color.b])
    }
    var cosinePenalty = 0;
    for (var i = 0, len = palette.length - 2; i < len; i++) {
        var c1 = m_palette[i];
        var c2 = m_palette[i + 1];
        var c3 = m_palette[i + 2];

        var d1 = delta(c2, c1);
        var d2 = delta(c3, c2);

        var cosine = dot(d1, d2) / (vecLength(d1) * vecLength(d2) + 0.000000001);

        // transform cosine penalty to [0, 1] range
        cosinePenalty += cosine * -.5 + .5;
    }
    return cosinePenalty / (palette.length - 2);
}


/**
 * Smoothness: Calculate minimum color difference of 256 resampled points
 * Logic adapted from optimizer.js
 * @param {array} palette Array of HCL control points [[h, c, l], ...]
 */
function calcSmoothnessMinDiff(palette) {
    let min_color_diff = 0;
    try {
        let numSamples = 256;
        let samples = [];
        
        for (let k = 0; k < numSamples; k++) {
            let t_total = k / (numSamples - 1); 
            
            // Find segment index
            let segmentIndex = Math.floor(t_total * (palette.length - 1));
            if (segmentIndex >= palette.length - 1) segmentIndex = palette.length - 2;
            
            let segmentLength = 1 / (palette.length - 1);
            let t = (t_total - segmentIndex * segmentLength) / segmentLength;
            
            let c1 = palette[segmentIndex]; // [h, c, l]
            let c2 = palette[segmentIndex + 1];
            
            // Ensure c1 and c2 are arrays
            if (!Array.isArray(c1) || !Array.isArray(c2)) {
                // If they are not arrays (e.g. Lab objects), this function might not work as intended for HCL interpolation
                // Assume input is HCL array for now as per optimizer.js
                 // Convert Lab/Object to [h, c, l] if possible or fallback
                 // But typically this is called with controlColors which are HCL arrays.
            }

            let h1 = c1[0], h2 = c2[0];
            let diff = h2 - h1;
            // Shortest path interpolation for hue
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            
            let h = (h1 + diff * t + 360) % 360;
            let c = c1[1] + (c2[1] - c1[1]) * t;
            let l = c1[2] + (c2[2] - c1[2]) * t;
            
            // Convert to Lab
            samples.push(d3.lab(d3.hcl(h, c, l)));
        }
        
        let minDeltaE = Number.MAX_VALUE;
        for (let k = 0; k < samples.length - 1; k++) {
            // Calculate color difference using d3_ciede2000
            let deltaE;
            if (typeof d3_ciede2000 === 'function') {
                deltaE = d3_ciede2000(samples[k], samples[k+1]);
            } else {
                // Fallback to Euclidean if d3_ciede2000 is not available
                let dL = samples[k].l - samples[k+1].l;
                let da = samples[k].a - samples[k+1].a;
                let db = samples[k].b - samples[k+1].b;
                deltaE = Math.sqrt(dL*dL + da*da + db*db);
            }
            
            if (deltaE < minDeltaE) {
                minDeltaE = deltaE;
            }
        }
        min_color_diff = minDeltaE;
    } catch (e) {
        console.warn("Error in smoothness calculation:", e);
    }
    return min_color_diff;
}


/**
 * luminance profile: monotonically increasing, diverging, wave(thermal)
 * @param {array} palette 
 */
function calcLumiProf(palette, profile) {
    let sum = 0
    if (profile == 0) {
        // [5,95]
        for (let i = 0; i < palette.length; i++) {
            sum += Math.abs(palette[i].L - (5 + 90 / palette.length * i))
        }
    } else if (profile == 1) {
        var middle = Math.floor(palette.length / 2)
        for (let i = 0; i < palette.length; i++) {
            if (i < middle) {
                sum += Math.abs(palette[i].L - (5 + 90 / middle * i))
            } else {
                sum += Math.abs(palette[i].L - (95 - 90 / middle * (i - middle)))
            }
        }
    } else {
        var target = [30, 80, 30, 80, 30, 80, 30, 80]
        var colormap = []
        for (var i = 0; i < target.length - 1; i++) {
            if (i % 2 === 0) {
                for (var j = target[i]; j < target[i + 1]; j++) {
                    colormap.push(j)
                }
            } else {
                for (var j = target[i]; j > target[i + 1]; j--) {
                    colormap.push(j)
                }
            }
        }
        for (let i = 0; i < palette.length; i++) {
            var idx = Math.round(i / palette.length * colormap.length)
            sum += Math.abs(palette[i].L - colormap[idx])
        }
    }
    return sum / palette.length / 100
}


function generateSpecifiedColormap(setting) {
    var cnv_options = [0, 1, 2],
        dp_options = [0, 1, 2],
        pu_options = [0, 1, 2],
        sm_options = [0, 1, 2],
        lumin_options = [0, 1, 2]

    var solution, maximum_score = -100000, best_solution
    for (var i = 0; i < 1; i++) {
        solution = optimizerSA(setting)
        console.log(i, solution.score.toFixed(2));
        if (maximum_score <= solution.score) {
            maximum_score = solution.score
            best_solution = solution
        }
    }
    console.log("final score: ", best_solution.score.toFixed(2));
    console.log("extent", d3.extent(cnv_arr), d3.extent(dp_arr), d3.extent(pu_arr), d3.extent(sm_arr), d3.extent(lumin_arr));


    // render the best_solution
    let div = d3.select("body").append("div")
        .style("border", "1px solid black").style("margin-top", "10px")
        .style("padding", "5px")
    div.append("h3").text(setting.join(", "))
    drawSpecifiedColormap(best_solution.initialization, div, "ini_colormap", setting)
    drawSpecifiedColormap(best_solution.palette, div, "best_colormap", setting)
    drawOptimizationCurve(best_solution.curve, div)
}

function drawSpecifiedColormap(palette, div, canvasId, setting = [0, 0, 0, 0, 0]) {

    let cnv = calcCNV(palette),
        dp = calcDiscPower(palette),
        pu = calcPercUnif(palette),
        sm = calcSmoothness(palette),
        lumin = calcLumiProf(palette, setting[4])
    console.log(canvasId, "cnv = " + cnv.toFixed(2), "dp = " + dp.toFixed(2), "pu = " + pu.toFixed(2), "sm = " + sm.toFixed(2), "lumi = " + lumin.toFixed(2));

    // get the colormap
    var colormap = []
    for (var i = 0; i < palette.length - 1; i++) {
        for (var j = 0; j < 100; j++) {
            var l = palette[i].L + j * (palette[i + 1].L - palette[i].L) / 100,
                a = palette[i].a + j * (palette[i + 1].a - palette[i].a) / 100,
                b = palette[i].b + j * (palette[i + 1].b - palette[i].b) / 100
            colormap.push(d3.lab(l, a, b))
        }
    }
    colormap.push(palette[palette.length - 1])
    // console.log("generated colormap:", colormap);

    let width = 360, height = 45
    //get context 
    div.append("canvas").attr("id", canvasId)
        .attr("width", width).attr("height", height).style("margin-left", "20px")
    let canvas = document.getElementById(canvasId)
    let context = canvas.getContext('2d');

    //traverse the image data
    for (var i = 0; i < canvas.width; i++) {
        var idx = Math.round(i / (canvas.width - 1) * colormap.length)
        let tuple = d3.rgb(colormap[idx])
        for (var j = 0; j < canvas.height; j++) {
            context.fillStyle = 'rgba(' + tuple.r +
                ',' + tuple.g +
                ',' + tuple.b +
                ',' + 1 + ')';
            context.fillRect(i, j, 1, 1);
        }
    }

}

var cnv_arr = [], dp_arr = [], pu_arr = [], sm_arr = [], lumin_arr = []
function getPaletteScoreMetric(palette, setting) {
    let cnv = calcCNV(palette),
        dp = calcDiscPower(palette),
        pu = calcPercUnif(palette),
        sm = calcSmoothness(palette),
        lumin = calcLumiProf(palette, setting[4])

    // console.log(cnv, dp, pu, sm, lumin);
    cnv_arr.push(cnv)
    dp_arr.push(dp)
    pu_arr.push(pu)
    sm_arr.push(sm)
    lumin_arr.push(lumin)

    var score = Math.abs(cnv - setting[0]) + Math.abs(dp - setting[1]) + Math.abs(pu - setting[2]) + Math.abs(sm - setting[3])// + lumin
    return -score
}

function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
}

function disturbColor(pal, idx) {
    let c = pal[idx]
    c.L = normScope(c.L + getRandomIntInclusive(-5, 5), [5, 95])
    c.a = normScope(c.a + getRandomIntInclusive(-5, 5), [-100, 100])
    c.b = normScope(c.b + getRandomIntInclusive(-5, 5), [-100, 100])
    pal[idx] = c
}

function deepCopy(arr) {
    let array = []
    for (let i = 0; i < arr.length; i++) {
        array.push(d3.lab(arr[i].L, arr[i].a, arr[i].b))
    }
    return array
}

function optimizerSA(setting) {
    let initial_temperature = 100000, end_temperature = 0.0001, cooling_param = 0.999
    // initialize colors
    let palette_size = 30;
    let initial_colors = []
    if (setting[4] === 0) {
        for (let i = 0; i < palette_size; i++) {
            initial_colors.push(d3.lab(d3.hcl(i * 360 / palette_size, 70, 5 + i * 3)))
        }
    } else if (setting[4] === 1) {
        var middle = Math.floor(palette_size / 2)
        for (let i = 0; i < palette_size; i++) {
            if (i < middle) {
                initial_colors.push(d3.lab(d3.hcl(i * 360 / palette_size, 70, (5 + 90 / middle * i))))
            } else {
                initial_colors.push(d3.lab(d3.hcl(i * 360 / palette_size, 70, (95 - 90 / middle * (i - middle)))))
            }
        }
    } else {
        var target = [30, 80, 30, 80, 30, 80, 30, 80]
        var colormap = []
        for (var i = 0; i < target.length - 1; i++) {
            if (i % 2 === 0) {
                for (var j = target[i]; j < target[i + 1]; j++) {
                    colormap.push(j)
                }
            } else {
                for (var j = target[i]; j > target[i + 1]; j--) {
                    colormap.push(j)
                }
            }
        }
        for (let i = 0; i < palette_size; i++) {
            var idx = Math.round(i / palette_size * colormap.length)
            initial_colors.push(d3.lab(d3.hcl(i * 360 / palette_size, 70, colormap[idx])))
        }
    }


    //default parameters
    let iterate_times = 0;
    let max_iteration_times = 10000000;
    cur_temper = initial_temperature;

    let o = {
        palette: initial_colors,
        score: getPaletteScoreMetric(initial_colors, setting)
    },
        preferredObj = o;
    let intermediate_scores = []

    while (cur_temper > end_temperature) {
        for (let i = 0; i < 1; i++) { //disturb multiple times at each temperature
            intermediate_scores.push([iterate_times, o.score])
            iterate_times++;
            // disturb the parameters
            let curr_colors = deepCopy(o.palette)
            let idx = getRandomIntInclusive(0, palette_size - 1)
            disturbColor(curr_colors, idx)

            let o2 = {
                palette: curr_colors,
                score: getPaletteScoreMetric(curr_colors, setting)
            };
            // console.log(o2.score);

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
    console.log("preferredObj", preferredObj, iterate_times);
    return preferredObj;
}

function drawOptimizationCurve(data, div, x = 0, y = 1) {
    var svg_width = 400, svg_height = 200, margin = 30
    let linechart_svg = div.append("svg").attr("id", "renderSvg").attr("typeId", "line")
        .attr("width", svg_width).attr("height", svg_height).style("display", "inline-block");

    let linechart = linechart_svg.style("background-color", "#FFF")
        .append("g")
        .attr("transform", "translate(" + margin + "," + margin + ")");

    let m_xScale = d3.scaleLinear().range([0, svg_width - margin * 2]), // value -> display
        m_yScale = d3.scaleLinear().range([svg_height - margin * 2, 0]); // value -> display
    // Scale the range of the data
    m_xScale.domain(d3.extent(data, function (d) {
        return d[x];
    }));
    m_yScale.domain(d3.extent(data, function (d) {
        return d[y];
    }));
    // define the line
    let valueline = d3.line()
        .x(function (d) {
            return m_xScale(d[x]);
        })
        .y(function (d) {
            return m_yScale(d[y]);
        })//.curve(d3.curveCatmullRom);

    let sampled_data = data
    // if (y === 1) {
    //     valueline.curve(d3.curveCatmullRom);
    // }
    let samples_num = 50
    let samples_interval = 1; Math.floor(data.length / samples_num)
    sampled_data = []
    for (let i = 0; i < data.length; i++) {
        if (i % samples_interval === 0)
            sampled_data.push(data[i])
    }
    sampled_data.push(data[data.length - 1])
    // console.log("sampled_data", sampled_data);

    // Add the valueline path.
    linechart.selectAll('path')
        .data([sampled_data]).enter().append("path")
        .attr("d", function (d) {
            return valueline(d);
        })
        .attr("class", "linechart")
        .attr("fill", "none")
        // .attr("stroke", "#444")
        .attr("stroke", function () {
            if (y === 1) {
                return "#c30d23"
            }
            return "#036eb8"
        })
        .style("stroke-width", 1)

    // Add the X Axis
    linechart.append("g")
        .attr("transform", "translate(0," + (svg_height - margin * 2) + ")")
        .call(d3.axisBottom(m_xScale)); //.tickFormat("")

    // Add the Y Axis
    linechart.append("g")
        .call(d3.axisLeft(m_yScale)); //.tickFormat("")

    linechart_svg.append("text").attr("x", 0).attr("y", 20).text("");
}
var ALL_COLORMAPS = [
    'blues',
    'purples',
    'reds',

    'redpurple',
    'viridis',
    'plasma',

    'coolwarm',
    'greyred',
    'spectral',

    'rainbowjet',
    'turbo',
    'rainbowcie'
];
var COLOR_PRESETS = {

    greyscale: [
        [0, 0, 0],
        [255, 255, 255]
    ],

    rainbow: [
        [0, 0, 255],
        [0, 255, 255],
        [0, 255, 0],
        [255, 255, 0],
        [255, 0, 0],
    ],

    rainbowcie: [
        [0, 0, 255],
        [0, 255, 255],
        [0, 255, 0],
        [255, 255, 0],
        [255, 0, 0],
    ],

    rainbowjet: [
        [0, 0, 143],
        [0, 0, 159],
        [0, 0, 175],
        [0, 0, 191],
        [0, 0, 207],
        [0, 0, 223],
        [0, 0, 239],
        [0, 0, 255],
        [0, 15, 255],
        [0, 31, 255],
        [0, 47, 255],
        [0, 63, 255],
        [0, 79, 255],
        [0, 95, 255],
        [0, 111, 255],
        [0, 127, 255],
        [0, 143, 255],
        [0, 159, 255],
        [0, 175, 255],
        [0, 191, 255],
        [0, 207, 255],
        [0, 223, 255],
        [0, 239, 255],
        [0, 255, 255],
        [15, 255, 239],
        [31, 255, 223],
        [47, 255, 207],
        [63, 255, 191],
        [79, 255, 175],
        [95, 255, 159],
        [111, 255, 143],
        [127, 255, 127],
        [143, 255, 111],
        [159, 255, 95],
        [175, 255, 79],
        [191, 255, 63],
        [207, 255, 47],
        [223, 255, 31],
        [239, 255, 15],
        [255, 255, 0],
        [255, 239, 0],
        [255, 223, 0],
        [255, 207, 0],
        [255, 191, 0],
        [255, 175, 0],
        [255, 159, 0],
        [255, 143, 0],
        [255, 127, 0],
        [255, 111, 0],
        [255, 95, 0],
        [255, 79, 0],
        [255, 63, 0],
        [255, 47, 0],
        [255, 31, 0],
        [255, 15, 0],
        [255, 0, 0],
        [239, 0, 0],
        [223, 0, 0],
        [207, 0, 0],
        [191, 0, 0],
        [175, 0, 0],
        [159, 0, 0],
        [143, 0, 0],
        [127, 0, 0]
    ],

    viridis: (function () {
        var out = [];
        for (var i = 0; i <= 100; i++) {
            var c = d3.interpolateViridis(i / 100);
            var rgb = d3.color(c);
            out.push([rgb.r, rgb.g, rgb.b]);
        }
        return out
    })(),

    plasma: (function () {
        var out = [];
        for (var i = 0; i <= 100; i++) {
            var c = d3.interpolatePlasma(i / 100);
            var rgb = d3.color(c);
            out.push([rgb.r, rgb.g, rgb.b]);
        }
        return out
    })(),

    redpurple: [
        [255, 247, 243],
        [253, 224, 221],
        [252, 197, 192],
        [250, 159, 181],
        [247, 104, 161],
        [221, 52, 151],
        [174, 1, 126],
        [122, 1, 119],
        [73, 0, 106]
    ].reverse(),

    greyred: [
        [178, 24, 43],
        [214, 96, 77],
        [244, 165, 130],
        [253, 219, 199],
        [255, 255, 255],
        [224, 224, 224],
        [186, 186, 186],
        [135, 135, 135],
        [77, 77, 77]
    ].reverse(),

    coolwarm: [
        [63, 0, 242],
        [83, 41, 240],
        [121, 98, 245],
        [169, 158, 249],
        [225, 223, 252],
        [244, 208, 209],
        [232, 135, 135],
        [221, 70, 73],
        [221, 25, 29],
    ],

    reds:
        [
            [226, 202, 100],
            [225, 180, 87],
            [225, 159, 79],
            [227, 140, 75],
            [219, 118, 71],
            [205, 95, 67],
            [191, 73, 63],
            [169, 50, 57],
            [147, 27, 51]
        ].reverse(),

    purples: [
        [59, 27, 80],
        [79, 37, 94],
        [95, 52, 108],
        [112, 68, 123],
        [135, 84, 140],
        [160, 101, 157],
        [186, 116, 169],
        [206, 131, 176],
        [215, 146, 171],
    ],

    blues:
        [
            [253, 244, 249],
            [214, 207, 230],
            [169, 180, 214],
            [122, 158, 201],
            [76, 133, 184],
            [49, 107, 174],
            [39, 82, 149],
            [27, 61, 103],
            [18, 41, 70],
        ].reverse(),

    spectral:
        [
            [213, 62, 79],
            [244, 109, 67],
            [253, 174, 97],
            [254, 224, 139],
            [255, 255, 191],
            [230, 245, 152],
            [171, 221, 164],
            [102, 194, 165],
            [50, 136, 189]
        ].reverse(),

    turbo: [[48, 18, 59], [50, 21, 67], [51, 24, 74], [52, 27, 81], [53, 30, 88], [54, 33, 95], [55, 36, 102], [56, 39, 109], [57, 42, 115], [58, 45, 121], [59, 47, 128], [60, 50, 134], [61, 53, 139], [62, 56, 145], [63, 59, 151], [63, 62, 156], [64, 64, 162], [65, 67, 167], [65, 70, 172], [66, 73, 177], [66, 75, 181], [67, 78, 186], [68, 81, 191], [68, 84, 195], [68, 86, 199], [69, 89, 203], [69, 92, 207], [69, 94, 211], [70, 97, 214], [70, 100, 218], [70, 102, 221], [70, 105, 224], [70, 107, 227], [71, 110, 230], [71, 113, 233], [71, 115, 235], [71, 118, 238], [71, 120, 240], [71, 123, 242], [70, 125, 244], [70, 128, 246], [70, 130, 248], [70, 133, 250], [70, 135, 251], [69, 138, 252], [69, 140, 253], [68, 143, 254], [67, 145, 254], [66, 148, 255], [65, 150, 255], [64, 153, 255], [62, 155, 254], [61, 158, 254], [59, 160, 253], [58, 163, 252], [56, 165, 251], [55, 168, 250], [53, 171, 248], [51, 173, 247], [49, 175, 245], [47, 178, 244], [46, 180, 242], [44, 183, 240], [42, 185, 238], [40, 188, 235], [39, 190, 233], [37, 192, 231], [35, 195, 228], [34, 197, 226], [32, 199, 223], [31, 201, 221], [30, 203, 218], [28, 205, 216], [27, 208, 213], [26, 210, 210], [26, 212, 208], [25, 213, 205], [24, 215, 202], [24, 217, 200], [24, 219, 197], [24, 221, 194], [24, 222, 192], [24, 224, 189], [25, 226, 187], [25, 227, 185], [26, 228, 182], [28, 230, 180], [29, 231, 178], [31, 233, 175], [32, 234, 172], [34, 235, 170], [37, 236, 167], [39, 238, 164], [42, 239, 161], [44, 240, 158], [47, 241, 155], [50, 242, 152], [53, 243, 148], [56, 244, 145], [60, 245, 142], [63, 246, 138], [67, 247, 135], [70, 248, 132], [74, 248, 128], [78, 249, 125], [82, 250, 122], [85, 250, 118], [89, 251, 115], [93, 252, 111], [97, 252, 108], [101, 253, 105], [105, 253, 102], [109, 254, 98], [113, 254, 95], [117, 254, 92], [121, 254, 89], [125, 255, 86], [128, 255, 83], [132, 255, 81], [136, 255, 78], [139, 255, 75], [143, 255, 73], [146, 255, 71], [150, 254, 68], [153, 254, 66], [156, 254, 64], [159, 253, 63], [161, 253, 61], [164, 252, 60], [167, 252, 58], [169, 251, 57], [172, 251, 56], [175, 250, 55], [177, 249, 54], [180, 248, 54], [183, 247, 53], [185, 246, 53], [188, 245, 52], [190, 244, 52], [193, 243, 52], [195, 241, 52], [198, 240, 52], [200, 239, 52], [203, 237, 52], [205, 236, 52], [208, 234, 52], [210, 233, 53], [212, 231, 53], [215, 229, 53], [217, 228, 54], [219, 226, 54], [221, 224, 55], [223, 223, 55], [225, 221, 55], [227, 219, 56], [229, 217, 56], [231, 215, 57], [233, 213, 57], [235, 211, 57], [236, 209, 58], [238, 207, 58], [239, 205, 58], [241, 203, 58], [242, 201, 58], [244, 199, 58], [245, 197, 58], [246, 195, 58], [247, 193, 58], [248, 190, 57], [249, 188, 57], [250, 186, 57], [251, 184, 56], [251, 182, 55], [252, 179, 54], [252, 177, 54], [253, 174, 53], [253, 172, 52], [254, 169, 51], [254, 167, 50], [254, 164, 49], [254, 161, 48], [254, 158, 47], [254, 155, 45], [254, 153, 44], [254, 150, 43], [254, 147, 42], [254, 144, 41], [253, 141, 39], [253, 138, 38], [252, 135, 37], [252, 132, 35], [251, 129, 34], [251, 126, 33], [250, 123, 31], [249, 120, 30], [249, 117, 29], [248, 114, 28], [247, 111, 26], [246, 108, 25], [245, 105, 24], [244, 102, 23], [243, 99, 21], [242, 96, 20], [241, 93, 19], [240, 91, 18], [239, 88, 17], [237, 85, 16], [236, 83, 15], [235, 80, 14], [234, 78, 13], [232, 75, 12], [231, 73, 12], [229, 71, 11], [228, 69, 10], [226, 67, 10], [225, 65, 9], [223, 63, 8], [221, 61, 8], [220, 59, 7], [218, 57, 7], [216, 55, 6], [214, 53, 6], [212, 51, 5], [210, 49, 5], [208, 47, 5], [206, 45, 4], [204, 43, 4], [202, 42, 4], [200, 40, 3], [197, 38, 3], [195, 37, 3], [193, 35, 2], [190, 33, 2], [188, 32, 2], [185, 30, 2], [183, 29, 2], [180, 27, 1], [178, 26, 1], [175, 24, 1], [172, 23, 1], [169, 22, 1], [167, 20, 1], [164, 19, 1], [161, 18, 1], [158, 16, 1], [155, 15, 1], [152, 14, 1], [149, 13, 1], [146, 11, 1], [142, 10, 1], [139, 9, 2], [136, 8, 2], [133, 7, 2], [129, 6, 2], [126, 5, 2], [122, 4, 3]]

};

function testColormaps() {

    for (let m = 0; m < ALL_COLORMAPS.length; m++) {
        let div = d3.select("body").append("div")
            .style("border", "1px solid black").style("margin-top", "10px")
            .style("padding", "5px")
        div.append("h3").text(ALL_COLORMAPS[m])

        // calculate the colormap
        var colormap_preset = COLOR_PRESETS[ALL_COLORMAPS[m]]
        console.log(ALL_COLORMAPS[m], colormap_preset);
        var colormap_inter = []
        if (colormap_preset.length < 1000) {
            var step = Math.floor((1000 / colormap_preset.length - 1))
            for (var i = 0; i < colormap_preset.length - 1; i++) {
                for (var j = 0; j < step; j++) {
                    var r = colormap_preset[i][0] + j * (colormap_preset[i + 1][0] - colormap_preset[i][0]) / step,
                        g = colormap_preset[i][1] + j * (colormap_preset[i + 1][1] - colormap_preset[i][1]) / step,
                        b = colormap_preset[i][2] + j * (colormap_preset[i + 1][2] - colormap_preset[i][2]) / step
                    colormap_inter.push([r, g, b])
                }
            }
            colormap_inter.push(colormap_preset[colormap_preset.length - 1])
        }
        console.log(colormap_inter);
        function getLumiCurve(pal) {
            var curve = []
            for (var i = 0; i < pal.length; i++) {
                let tuple = d3.lab(d3.rgb(pal[i][0], pal[i][1], pal[i][2]))
                curve.push([i, tuple.L])
            }

            return curve
        }
        drawOptimizationCurve(getLumiCurve(colormap_inter), div)
        function getChromaCurve(pal) {
            var curve = []
            for (var i = 0; i < pal.length; i++) {
                let tuple = d3.hcl(d3.lab(d3.rgb(pal[i][0], pal[i][1], pal[i][2])))
                curve.push([i, tuple.c])
            }

            return curve
        }
        drawOptimizationCurve(getChromaCurve(colormap_inter), div)

        var palette = []
        for (var i = 0; i < 30; i++) {
            var idx = Math.round(i / 29 * (colormap_inter.length - 1))
            var color = colormap_inter[idx],
                lab = d3.lab(d3.rgb(color[0], color[1], color[2]))
            palette.push(lab)
        }

        let cnv = calcCNV(palette),
            dp = calcDiscPower(palette),
            pu = calcPercUnif(palette),
            sm = calcSmoothness(palette),
            lumin = calcLumiProf(palette, 0)
        console.log(ALL_COLORMAPS[m], "cnv = " + cnv.toFixed(2), "dp = " + dp.toFixed(2), "pu = " + pu.toFixed(2), "sm = " + sm.toFixed(2), "lumi = " + lumin.toFixed(2));
        div.append("h3").text(["cnv = " + cnv.toFixed(2), "dp = " + dp.toFixed(2), "pu = " + pu.toFixed(2), "sm = " + sm.toFixed(2)].join(", "))

        // get the colormap
        var colormap = []
        for (var i = 0; i < palette.length - 1; i++) {
            for (var j = 0; j < 100; j++) {
                var l = palette[i].L + j * (palette[i + 1].L - palette[i].L) / 100,
                    a = palette[i].a + j * (palette[i + 1].a - palette[i].a) / 100,
                    b = palette[i].b + j * (palette[i + 1].b - palette[i].b) / 100
                colormap.push(d3.lab(l, a, b))
            }
        }
        colormap.push(palette[palette.length - 1])
        // console.log("generated colormap:", colormap);

        let width = 360, height = 45
        //get context 
        div.append("canvas").attr("id", ALL_COLORMAPS[m])
            .attr("width", width).attr("height", height).style("margin-left", "20px")
        let canvas = document.getElementById(ALL_COLORMAPS[m])
        let context = canvas.getContext('2d');

        //traverse the image data
        for (var i = 0; i < canvas.width; i++) {
            var idx = Math.round(i / (canvas.width - 1) * colormap.length)
            let tuple = d3.rgb(colormap[idx])
            for (var j = 0; j < canvas.height; j++) {
                context.fillStyle = 'rgba(' + tuple.r +
                    ',' + tuple.g +
                    ',' + tuple.b +
                    ',' + 1 + ')';
                context.fillRect(i, j, 1, 1);
            }
        }

        // interpolate in RGB
        if (false) {
            colormap = []
            var rgb_palette = []
            for (var i = 0; i < palette.length; i++) {
                rgb_palette.push(d3.rgb(palette[i]))
            }
            for (var i = 0; i < palette.length - 1; i++) {
                for (var j = 0; j < 100; j++) {
                    var l = rgb_palette[i].r + j * (rgb_palette[i + 1].r - rgb_palette[i].r) / 100,
                        a = rgb_palette[i].g + j * (rgb_palette[i + 1].g - rgb_palette[i].g) / 100,
                        b = rgb_palette[i].b + j * (rgb_palette[i + 1].b - rgb_palette[i].b) / 100
                    colormap.push(d3.rgb(l, a, b))
                }
            }
            colormap.push(rgb_palette[rgb_palette.length - 1])

            //get context 
            div.append("canvas").attr("id", ALL_COLORMAPS[m] + "-rgb")
                .attr("width", width).attr("height", height).style("margin-left", "20px")
            canvas = document.getElementById(ALL_COLORMAPS[m] + "-rgb")
            context = canvas.getContext('2d');

            //traverse the image data
            for (var i = 0; i < canvas.width; i++) {
                var idx = Math.round(i / (canvas.width - 1) * colormap.length)
                let tuple = d3.rgb(colormap[idx])
                for (var j = 0; j < canvas.height; j++) {
                    context.fillStyle = 'rgba(' + tuple.r +
                        ',' + tuple.g +
                        ',' + tuple.b +
                        ',' + 1 + ')';
                    context.fillRect(i, j, 1, 1);
                }
            }
        }
    }
}

function drawColormapM(palette, div, str, initialization) {
    div.append("hr")
    div.append("h3").text(str)
    let cnv = calcCNV(palette),
        dp = calcDiscPower(palette),
        pu = calcPercUnif(palette),
        sm = calcSmoothness(palette),
        lumin = calcLumiDiff(palette, initialization)//calcLumiProf(palette, 0)
    console.log(str, "cnv = " + cnv.toFixed(2), "dp = " + dp.toFixed(2), "pu = " + pu.toFixed(2), "sm = " + sm.toFixed(2));
    div.append("h3").text(["cnv = " + cnv.toFixed(2), "dp = " + dp.toFixed(2), "pu = " + pu.toFixed(2), "sm = " + sm.toFixed(2)].join(", "))

    var names = [], hcls = []
    for (var i = 0; i < palette.length; i++) {
        names.push(getColorName(palette[i])[0])
        var hcl = labToHcl(palette[i])
        hcls.push("HCL(" + hcl.h.toFixed(0) + "," + hcl.c.toFixed(0) + "," + hcl.l.toFixed(0) + ")")
        div.append("span").style("width", "20px")
            .style("display", "inline-block").style("margin-left", "10px")
            .style("height", "20px")
            .style("background-color", palette[i])

    }
    div.append("h3").text(names.join(", "))
    div.append("h3").text(hcls.join(", "))

    // get the colormap
    var colormap = []
    for (var i = 0; i < palette.length - 1; i++) {
        for (var j = 0; j < 100; j++) {
            var l = palette[i].L + j * (palette[i + 1].L - palette[i].L) / 100,
                a = palette[i].a + j * (palette[i + 1].a - palette[i].a) / 100,
                b = palette[i].b + j * (palette[i + 1].b - palette[i].b) / 100
            colormap.push(d3.lab(l, a, b))
        }
    }
    colormap.push(palette[palette.length - 1])
    // console.log("generated colormap:", colormap);

    let width = 360, height = 45
    //get context 
    div.append("canvas").attr("id", str)
        .attr("width", width).attr("height", height).style("margin-left", "20px").style("display", "inline-block")
    let canvas = document.getElementById(str)
    let context = canvas.getContext('2d');

    //traverse the image data
    for (var i = 0; i < canvas.width; i++) {
        var idx = Math.round(i / (canvas.width - 1) * colormap.length)
        let tuple = d3.rgb(colormap[idx])
        for (var j = 0; j < canvas.height; j++) {
            context.fillStyle = 'rgba(' + tuple.r +
                ',' + tuple.g +
                ',' + tuple.b +
                ',' + 1 + ')';
            context.fillRect(i, j, 1, 1);
        }
    }

}
function calcLumiDiff(palette, palette2) {
    let sum = 0
    // [5,95]
    for (let i = 0; i < palette.length; i++) {
        sum += Math.abs(palette[i].L - palette2[i].L)
    }
    return -sum / palette.length / 100
}
function generateDiffRainbows() {
    // base colormap: rainbowjet
    var base_colormap = COLOR_PRESETS['rainbowjet']

    // get control points
    var colormap_inter = []
    if (base_colormap.length < 1000) {
        var step = Math.floor((1000 / base_colormap.length - 1))
        for (var i = 0; i < base_colormap.length - 1; i++) {
            for (var j = 0; j < step; j++) {
                var r = base_colormap[i][0] + j * (base_colormap[i + 1][0] - base_colormap[i][0]) / step,
                    g = base_colormap[i][1] + j * (base_colormap[i + 1][1] - base_colormap[i][1]) / step,
                    b = base_colormap[i][2] + j * (base_colormap[i + 1][2] - base_colormap[i][2]) / step
                colormap_inter.push([r, g, b])
            }
        }
        colormap_inter.push(base_colormap[base_colormap.length - 1])
    }
    console.log(colormap_inter);
    var palette = [], pal_size = 8
    for (var i = 0; i < pal_size; i++) {
        var idx = Math.round(i / (pal_size - 1) * (colormap_inter.length - 1))
        var color = colormap_inter[idx],
            lab = d3.lab(d3.rgb(color[0], color[1], color[2]))
        palette.push(lab)
    }

    var div = d3.select("body").append("div")
        .style("border", "1px solid black").style("margin-top", "10px")
        .style("padding", "5px")

    drawColormapM(palette, div, "rainbowjet", palette)

    var solution = optimizerForRainbow(palette, calcDiscPower)
    drawColormapM(solution.palette, div, "DiscriminativePower", palette)

    solution = optimizerForRainbow(palette, calcPercUnif)
    drawColormapM(solution.palette, div, "PerceptualUniformity", palette)

    solution = optimizerForRainbow(palette, calcSmoothness)
    drawColormapM(solution.palette, div, "Smoothness", palette)

    solution = optimizerForRainbow(palette, calcLumiDiff)
    drawColormapM(solution.palette, div, "LuminanceDifference", palette)
}

function optimizerForRainbow(initial_colors, metric) {
    let initial_temperature = 100000, end_temperature = 0.0001, cooling_param = 0.999
    // initialize colors
    let palette_size = initial_colors.length;

    //default parameters
    let iterate_times = 0;
    let max_iteration_times = 10000000;
    cur_temper = initial_temperature;

    var initial_score = metric(initial_colors, initial_colors), initial_cnv = calcCNV(initial_colors)

    function getPaletteScore(palette) {
        return Math.abs(metric(palette, initial_colors) - initial_score) - Math.abs(calcCNV(palette) - initial_cnv) * 10
    }

    let o = {
        palette: initial_colors,
        score: getPaletteScore(initial_colors)
    },
        preferredObj = o;
    let intermediate_scores = []

    while (cur_temper > end_temperature) {
        for (let i = 0; i < 1; i++) { //disturb multiple times at each temperature
            intermediate_scores.push([iterate_times, o.score])
            iterate_times++;
            // disturb the parameters
            let curr_colors = deepCopy(o.palette)
            let idx = getRandomIntInclusive(0, palette_size - 1)
            disturbColor(curr_colors, idx)

            let o2 = {
                palette: curr_colors,
                score: getPaletteScore(curr_colors)
            };
            // console.log(o2.score);

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
    console.log("preferredObj", preferredObj, iterate_times);
    return preferredObj;
}


function generateDiffRainbows2() {
    // base colormap: rainbowjet
    var base_colormap = COLOR_PRESETS['rainbowjet']

    // get control points
    var colormap_inter = []
    if (base_colormap.length < 1000) {
        var step = Math.floor((1000 / base_colormap.length - 1))
        for (var i = 0; i < base_colormap.length - 1; i++) {
            for (var j = 0; j < step; j++) {
                var r = base_colormap[i][0] + j * (base_colormap[i + 1][0] - base_colormap[i][0]) / step,
                    g = base_colormap[i][1] + j * (base_colormap[i + 1][1] - base_colormap[i][1]) / step,
                    b = base_colormap[i][2] + j * (base_colormap[i + 1][2] - base_colormap[i][2]) / step
                colormap_inter.push([r, g, b])
            }
        }
        colormap_inter.push(base_colormap[base_colormap.length - 1])
    }
    console.log(colormap_inter);
    var palette = [], pal_size = 8
    for (var i = 0; i < pal_size; i++) {
        var idx = Math.round(i / (pal_size - 1) * (colormap_inter.length - 1))
        var color = colormap_inter[idx],
            lab = d3.lab(d3.rgb(color[0], color[1], color[2]))
        palette.push(lab)
    }

    var div = d3.select("body").append("div")
        .style("border", "1px solid black").style("margin-top", "10px")
        .style("padding", "5px")

    drawColormapM(palette, div, "rainbowjet reference", palette)

    var solution = optimizerForRainbow2(palette, [1, -1, -1, -1])
    drawColormapM(solution.palette, div, "DiscriminativePower only", palette)

    solution = optimizerForRainbow2(palette, [-1, 1, -1, -1])
    drawColormapM(solution.palette, div, "PerceptualUniformity only", palette)

    solution = optimizerForRainbow2(palette, [-1, -1, 1, -1])
    drawColormapM(solution.palette, div, "Smoothness only", palette)

    solution = optimizerForRainbow2(palette, [-1, -1, -1, 1])
    drawColormapM(solution.palette, div, "LuminanceDifference only", palette)
}

function optimizerForRainbow2(initial_colors, combination) {
    let initial_temperature = 100000, end_temperature = 0.0001, cooling_param = 0.999
    // initialize colors
    let palette_size = initial_colors.length;

    //default parameters
    let iterate_times = 0;
    let max_iteration_times = 10000000;
    cur_temper = initial_temperature;

    var initial_score = [calcDiscPower(initial_colors, initial_colors), calcPercUnif(initial_colors, initial_colors), calcSmoothness(initial_colors, initial_colors), calcLumiDiff(initial_colors, initial_colors)], initial_cnv = calcCNV(initial_colors)

    function getPaletteScore(palette) {
        return combination[0] * Math.abs(calcDiscPower(palette, initial_colors) - initial_score[0]) + combination[1] * Math.abs(calcPercUnif(palette, initial_colors) - initial_score[1]) + combination[2] * Math.abs(calcSmoothness(palette, initial_colors) - initial_score[2]) + combination[3] * Math.abs(calcLumiDiff(palette, initial_colors) - initial_score[3]) - Math.abs(calcCNV(palette) - initial_cnv) * 10
    }

    let o = {
        palette: initial_colors,
        score: getPaletteScore(initial_colors)
    },
        preferredObj = o;
    let intermediate_scores = []

    while (cur_temper > end_temperature) {
        for (let i = 0; i < 1; i++) { //disturb multiple times at each temperature
            intermediate_scores.push([iterate_times, o.score])
            iterate_times++;
            // disturb the parameters
            let curr_colors = deepCopy(o.palette)
            let idx = getRandomIntInclusive(0, palette_size - 1)
            disturbColor(curr_colors, idx)

            let o2 = {
                palette: curr_colors,
                score: getPaletteScore(curr_colors)
            };
            // console.log(o2.score);

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
    console.log("preferredObj", preferredObj, iterate_times);
    return preferredObj;
}


/**
 * with different luminance profile
 */
function generateDiffRainbows3() {
    // base colormap: rainbowcie
    var base_colormap = COLOR_PRESETS['rainbowcie']

    // get control points
    var colormap_inter = []
    if (base_colormap.length < 1000) {
        var step = Math.floor((1000 / base_colormap.length - 1))
        for (var i = 0; i < base_colormap.length - 1; i++) {
            for (var j = 0; j < step; j++) {
                var r = base_colormap[i][0] + j * (base_colormap[i + 1][0] - base_colormap[i][0]) / step,
                    g = base_colormap[i][1] + j * (base_colormap[i + 1][1] - base_colormap[i][1]) / step,
                    b = base_colormap[i][2] + j * (base_colormap[i + 1][2] - base_colormap[i][2]) / step
                colormap_inter.push([r, g, b])
            }
        }
        colormap_inter.push(base_colormap[base_colormap.length - 1])
    }
    console.log(colormap_inter);
    var palette = [], pal_size = 9
    for (var i = 0; i < pal_size; i++) {
        var idx = Math.round(i / (pal_size - 1) * (colormap_inter.length - 1))
        var color = colormap_inter[idx],
            lab = d3.lab(d3.rgb(color[0], color[1], color[2]))
        palette.push(lab)
    }

    function getLumiCurve(pal) {
        var curve = []
        for (var i = 0; i < pal.length; i++) {
            curve.push([i, pal[i].L])
        }
        return curve
    }

    var div = d3.select("body").append("div")
        .style("border", "1px solid black").style("margin-top", "10px")
        .style("padding", "5px")

    drawColormapM(palette, div, "rainbow reference", palette)
    div.append("br")
    drawOptimizationCurve(getLumiCurve(palette), div)
    var dataObj = data_arr[current_data_id]
    dataObj.controlPoints = []
    dataObj.controlColors = []
    for (let i = 0; i < palette.length; i++) {
        dataObj.controlPoints.push(dataObj.extent[0] + i / (pal_size - 1) * (dataObj.extent[1] - dataObj.extent[0]))
        dataObj.controlColors.push([palette[i].L, palette[i].a, palette[i].b])
    }
    renderCanvasTest(data_arr[current_data_id], div, "rainbow-reference")

    function drawSetting(profile, text) {
        var best_solution, best_score = -1000000000
        for (var i = 0; i < 5; i++) {
            var solution = optimizerForRainbow3(palette, profile)
            if (solution.score > best_score) {
                best_solution = solution
                best_score = solution.score
            }
        }
        drawColormapM(best_solution.initialization, div, "Initialization-" + text, palette)
        drawColormapM(best_solution.palette, div, text + ": " + best_solution.score.toFixed(2), palette)
        div.append("br")
        drawOptimizationCurve(getLumiCurve(best_solution.palette), div)
        dataObj.controlColors = []
        for (let i = 0; i < best_solution.palette.length; i++) {
            dataObj.controlColors.push([best_solution.palette[i].L, best_solution.palette[i].a, best_solution.palette[i].b])
        }
        renderCanvasTest(data_arr[current_data_id], div, text)
    }

    drawSetting(0, "Linear")
    drawSetting(1, "Diverging")
    drawSetting(2, "Wave")
}

function renderCanvasTest(dataObj, div, text) {
    let data = dataObj.data, width = dataObj.width, height = dataObj.height
    // console.log("dataObj", dataObj, width, height);

    let colormap = generateColormapMetric(dataObj)
    function getColor(x) {
        let idx = Math.round(x / (dataObj.extent[1] - dataObj.extent[0]) * (colormap.length - 1))
        return colormap[idx]
    }

    div.append("canvas").attr("id", text)
        .attr("width", width).attr("height", height).style("margin-left", "20px")
    //get context 
    var canvas = document.getElementById(text)
    var context = canvas.getContext('2d');

    //traverse the image data
    for (let i = 0; i < canvas.height; i++) {
        for (let j = 0; j < canvas.width; j++) {
            let tuple
            let scalar_value = data[i][j]
            if (isNaN(scalar_value)) {
                tuple = [0, 0, 0, 1]
            } else {
                tuple = getColor(+scalar_value)
            }
            context.fillStyle = 'rgba(' + tuple[0] +
                ',' + tuple[1] +
                ',' + tuple[2] +
                ',' + tuple[3] + ')';
            context.fillRect(j, canvas.height - i, 1, 1);
        }
    }

}
function hclToLab(hcl) {
    let [H, C, L] = [hcl.h, hcl.c, hcl.l]
    let a = C * Math.cos(H * (Math.PI / 180)); // 角度转弧度
    let b = C * Math.sin(H * (Math.PI / 180));
    return d3.lab(L, a, b);
}

function labToHcl(lab) {
    let [L, a, b] = [lab.L, lab.a, lab.b]
    let C = Math.sqrt(a * a + b * b);
    let H = Math.atan2(b, a) * (180 / Math.PI); // 弧度转角度
    if (H < 0) H += 360; // 确保 H 在 [0, 360] 之间
    return d3.hcl(H, C, L);
}

function keepHueConsistent(initial_colors, profile) {
    let luminance_range = [10, 90]
    // initialize colors
    var initial_palette = []
    if (profile == 0) {
        for (var i = 0; i < initial_colors.length; i++) {
            var color = d3.hcl(initial_colors[i])
            var color_hcl = d3.hcl(color.h, color.c, luminance_range[0] + i / (initial_colors.length - 1) * (luminance_range[1] - luminance_range[0]))
            initial_palette.push(d3.lab(color_hcl))
        }
    } else if (profile == 1) {
        var middle = Math.floor(initial_colors.length / 2)
        for (var i = 0; i < initial_colors.length; i++) {
            var color = d3.hcl(initial_colors[i])
            if (i <= middle) {
                var color_hcl = d3.hcl(color.h, color.c, luminance_range[0] + i / middle * (luminance_range[1] - luminance_range[0]))
                initial_palette.push(d3.lab(color_hcl))
            }
            else {
                var color_hcl = d3.hcl(color.h, color.c, luminance_range[1] - (i - middle) / middle * (luminance_range[1] - luminance_range[0]))
                initial_palette.push(d3.lab(color_hcl))
            }
        }
    } else if (profile == 2) {
        for (var i = 0; i < initial_colors.length; i++) {
            var color = d3.hcl(initial_colors[i])
            var color_hcl = d3.hcl(color.h, color.c, i % 2 == 0 ? 30 : 80)
            // var color_hcl = d3.hcl(color.h, color.c, applyThermalProfile(i, initial_colors.length))
            initial_palette.push(d3.lab(color_hcl))
        }
    }
    return {
        palette: initial_palette,
        score: 0,
        curve: []
    }
}

function optimizerForRainbow3(initial_colors, profile) {
    return keepHueConsistent(initial_colors, profile)
    let initial_temperature = 100000, end_temperature = 0.0001, cooling_param = 0.999
    let luminance_range = [10, 90]
    // initialize colors
    let palette_size = initial_colors.length;
    var initial_palette = []
    if (profile == 0) {
        for (var i = 0; i < initial_colors.length; i++) {
            initial_palette.push(d3.lab(luminance_range[0] + i / (initial_colors.length - 1) * (luminance_range[1] - luminance_range[0]), initial_colors[i].a, initial_colors[i].b))
        }
    } else if (profile == 1) {
        var middle = Math.floor(initial_colors.length / 2)
        for (var i = 0; i < initial_colors.length; i++) {
            if (i <= middle)
                initial_palette.push(d3.lab(luminance_range[0] + i / middle * (luminance_range[1] - luminance_range[0]), initial_colors[i].a, initial_colors[i].b))
            else {
                initial_palette.push(d3.lab(luminance_range[1] - (i - middle) / middle * (luminance_range[1] - luminance_range[0]), initial_colors[i].a, initial_colors[i].b))
            }
        }
    } else if (profile == 2) {
        for (var i = 0; i < initial_colors.length; i++) {
            initial_palette.push(d3.lab(i % 2 == 0 ? 30 : 80, initial_colors[i].a, initial_colors[i].b))
        }
    }


    //default parameters
    let iterate_times = 0;
    let max_iteration_times = 10000000;
    cur_temper = initial_temperature;

    var initial_colors_hcl = []
    for (var i = 0; i < initial_colors.length; i++) {
        initial_colors_hcl.push(d3.hcl(initial_colors[i]))
    }

    function getPaletteScore(palette) {
        var sum = 0
        // for (var i = 0; i < palette.length; i++) {
        //     var nd = getNameDifference(palette[i], initial_colors[i])
        //     // if (nd > 0.5) return -1000
        //     sum += nd
        // }
        for (var i = 0; i < palette.length; i++) {
            var h0 = d3.hcl(palette[i]).h, h1 = initial_colors_hcl[i].h
            var dist = Math.min(Math.abs(h0 - h1), 360 - Math.abs(h0 - h1))
            sum += dist
        }
        return -sum
    }

    function disturbAB(pal, idx) {
        let c = pal[idx]
        // c.L = normScope(c.L + getRandomIntInclusive(-5, 5), [5, 95])
        c.a = normScope(c.a + getRandomIntInclusive(-5, 5), [-100, 100])
        c.b = normScope(c.b + getRandomIntInclusive(-5, 5), [-100, 100])
        pal[idx] = c
    }

    let o = {
        palette: initial_palette,
        score: getPaletteScore(initial_palette)
    },
        preferredObj = o;
    let intermediate_scores = []

    while (cur_temper > end_temperature) {
        for (let i = 0; i < 10; i++) { //disturb multiple times at each temperature
            intermediate_scores.push([iterate_times, o.score])
            iterate_times++;
            // disturb the parameters
            let curr_colors = deepCopy(o.palette)
            let idx = getRandomIntInclusive(0, palette_size - 1)
            disturbAB(curr_colors, idx)

            let o2 = {
                palette: curr_colors,
                score: getPaletteScore(curr_colors)
            };
            // console.log(o2.score);

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
    preferredObj.initialization = initial_palette
    console.log("preferredObj", preferredObj, iterate_times);
    return preferredObj;
}



/**
 * with different chroma profile
 */
function generateDiffRainbows4() {
    // base colormap: rainbowcie
    var base_colormap = COLOR_PRESETS['rainbowcie']

    // get control points
    var colormap_inter = []
    if (base_colormap.length < 1000) {
        var step = Math.floor((1000 / base_colormap.length - 1))
        for (var i = 0; i < base_colormap.length - 1; i++) {
            for (var j = 0; j < step; j++) {
                var r = base_colormap[i][0] + j * (base_colormap[i + 1][0] - base_colormap[i][0]) / step,
                    g = base_colormap[i][1] + j * (base_colormap[i + 1][1] - base_colormap[i][1]) / step,
                    b = base_colormap[i][2] + j * (base_colormap[i + 1][2] - base_colormap[i][2]) / step
                colormap_inter.push([r, g, b])
            }
        }
        colormap_inter.push(base_colormap[base_colormap.length - 1])
    }
    console.log(colormap_inter);
    var palette = [], pal_size = 9
    for (var i = 0; i < pal_size; i++) {
        var idx = Math.round(i / (pal_size - 1) * (colormap_inter.length - 1))
        var color = colormap_inter[idx],
            lab = d3.lab(d3.rgb(color[0], color[1], color[2]))
        palette.push(lab)
    }

    function getChromaCurve(pal) {
        var curve = []
        for (var i = 0; i < pal.length; i++) {
            var hcl = d3.hcl(pal[i])
            curve.push([i, hcl.c])
        }
        return curve
    }

    var div = d3.select("body").append("div")
        .style("border", "1px solid black").style("margin-top", "10px")
        .style("padding", "5px")

    drawColormapM(palette, div, "rainbow reference", palette)
    div.append("br")
    drawOptimizationCurve(getChromaCurve(palette), div)
    var dataObj = data_arr[current_data_id]
    dataObj.controlPoints = []
    dataObj.controlColors = []
    for (let i = 0; i < palette.length; i++) {
        dataObj.controlPoints.push(dataObj.extent[0] + i / (pal_size - 1) * (dataObj.extent[1] - dataObj.extent[0]))
        dataObj.controlColors.push([palette[i].L, palette[i].a, palette[i].b])
    }
    renderCanvasTest(data_arr[current_data_id], div, "rainbow-reference")

    function change2Lab(pal) {
        var pal2 = []
        for (var i = 0; i < pal_size; i++) {
            pal2.push(d3.lab(pal[i]))
        }
        return pal2
    }

    function drawSetting(profile, text) {
        var best_solution, best_score = -1000000000
        for (var i = 0; i < 5; i++) {
            var solution = optimizerForRainbow4(palette, profile)
            if (solution.score > best_score) {
                best_solution = solution
                best_score = solution.score
            }
        }
        var ini_pal = change2Lab(best_solution.initialization)
        var best_pal = change2Lab(best_solution.palette)

        drawColormapM(ini_pal, div, "Initialization-" + text, palette)
        drawOptimizationCurve(getChromaCurve(best_solution.initialization), div)
        drawColormapM(best_pal, div, text + ": " + best_solution.score.toFixed(2), palette)
        div.append("br")
        drawOptimizationCurve(getChromaCurve(best_solution.palette), div)
        // drawOptimizationCurve(best_solution.curve, div)
        dataObj.controlColors = []
        for (let i = 0; i < best_pal.length; i++) {
            dataObj.controlColors.push([best_pal[i].L, best_pal[i].a, best_pal[i].b])
        }
        renderCanvasTest(data_arr[current_data_id], div, text)
    }

    drawSetting(0, "Linear")
    drawSetting(1, "Diverging")
    drawSetting(2, "Wave")
}

function optimizerForRainbow4(initial_colors, profile) {
    let initial_temperature = 100000, end_temperature = 0.0001, cooling_param = 0.999
    var chroma_range = [50, 130]
    // initialize colors
    let palette_size = initial_colors.length;
    var initial_palette = [], hcl_color
    if (profile == 0) {
        for (var i = 0; i < initial_colors.length; i++) {
            var hcl = d3.hcl(initial_colors[i])
            hcl_color = d3.hcl(hcl.h, chroma_range[0] + i / (initial_colors.length - 1) * (chroma_range[1] - chroma_range[0]), hcl.l)
            initial_palette.push(hcl_color)
        }
    } else if (profile == 1) {
        var middle = Math.floor(initial_colors.length / 2)
        for (var i = 0; i < initial_colors.length; i++) {
            var hcl = d3.hcl(initial_colors[i])
            if (i <= middle) {
                hcl_color = d3.hcl(hcl.h, chroma_range[0] + i / middle * (chroma_range[1] - chroma_range[0]), hcl.l)
                initial_palette.push(hcl_color)
            }
            else {
                hcl_color = d3.hcl(hcl.h, chroma_range[1] - (i - middle) / middle * (chroma_range[1] - chroma_range[0]), hcl.l)
                initial_palette.push(hcl_color)
            }
        }
    } else if (profile == 2) {
        for (var i = 0; i < initial_colors.length; i++) {
            var hcl = d3.hcl(initial_colors[i])
            hcl_color = d3.hcl(hcl.h, i % 2 == 0 ? chroma_range[0] : chroma_range[1], hcl.l)
            initial_palette.push(hcl_color)
        }
    }
    // console.log("initial_palette", initial_palette);


    //default parameters
    let iterate_times = 0;
    let max_iteration_times = 10000000;
    cur_temper = initial_temperature;

    function getPaletteScore(palette) {
        var sum = 0
        for (var i = 0; i < palette.length; i++) {
            var nd = getNameDifference(d3.lab(palette[i]), initial_colors[i])
            // console.log(nd, palette[i], initial_colors[i]);
            // var cd = Math.abs(palette[i].c - initial_palette[i].c)

            // if (nd > 0.5) return -1000
            sum += nd //+ cd
        }
        return -sum
    }

    function disturbColor(pal, idx) {
        let c = pal[idx]
        c.h = normScope(c.h + getRandomIntInclusive(-5, 5), [0, 360])
        c.l = normScope(c.l + getRandomIntInclusive(-5, 5), [0, 100])
        pal[idx] = c
    }
    function deepCopy(arr) {
        let array = []
        for (let i = 0; i < arr.length; i++) {
            array.push(d3.hcl(arr[i].h, arr[i].c, arr[i].l))
        }
        return array
    }

    let o = {
        palette: initial_palette,
        score: getPaletteScore(initial_palette)
    },
        preferredObj = o;
    let intermediate_scores = []

    while (cur_temper > end_temperature) {
        for (let i = 0; i < 10; i++) { //disturb multiple times at each temperature
            intermediate_scores.push([iterate_times, o.score])
            iterate_times++;
            // disturb the parameters
            let curr_colors = deepCopy(o.palette)
            let idx = getRandomIntInclusive(0, palette_size - 1)
            disturbColor(curr_colors, idx)

            let o2 = {
                palette: curr_colors,
                score: getPaletteScore(curr_colors)
            };
            // console.log(o2.score);
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
    preferredObj.initialization = initial_palette
    console.log("preferredObj", preferredObj, iterate_times);
    return preferredObj;
}

const lineup_number_global = 6
lineup_datas = new Array(lineup_number_global)
lineup_datas_extent = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]
function loadLineups() {
    // 创建一个Promise数组用于存储所有文件加载的Promise
    let promises = [];
    // 循环加载6个文件
    for (var i = 0; i < lineup_number_global; i++) {
        promises.push(
            // 使用fetch API加载文件
            fetch("/static/data/lineupdata/" + i + ".txt")
                .then(response => {
                    // 检查响应是否成功
                    if (!response.ok) {
                        throw new Error('网络响应失败');
                    }
                    return response.text();
                })
                .then(data => {
                    // 将制表符替换为逗号并解析CSV数据
                    return d3.csvParseRows(data.replace(/\t/g, ','));
                })
        );
    }

    // 等待所有Promise完成
    Promise.all(promises)
        .then(results => {
            // 将加载的数据存储到lineup_datas数组中
            for (let i = 0; i < results.length; i++) {
                lineup_datas[i] = results[i];
                console.log("loading " + i, lineup_datas[i]);
            }
            let all_data = []
            for (let i = 0; i < lineup_datas.length; i++) {
                if (lineup_datas[i]) {
                    all_data = all_data.concat(lineup_datas[i])
                }
            }
            for (let i = 0; i < all_data.length; i++) {
                for (let j = 0; j < all_data[i].length; j++) {
                    if (all_data[i][j] != 'NaN') {
                        if (lineup_datas_extent[0] > +all_data[i][j]) lineup_datas_extent[0] = +all_data[i][j]
                        if (lineup_datas_extent[1] < +all_data[i][j]) lineup_datas_extent[1] = +all_data[i][j]
                    }
                }
            }
            console.log("lineup_datas_extent", lineup_datas_extent);

        })
        .catch(error => {
            // 处理错误情况
            console.error('读取文件时出错:', error);
        });
}
function loadRealData() {
    lineup_datas = []
    fetch("/static/data/D15.txt")
        .then(response => {
            if (!response.ok) {
                throw new Error('网络响应失败');
            }
            return response.text();
        })
        .then(data => {
            lineup_datas.push(d3.csvParseRows(data.replace(/\t/g, ',')));
        })
        .catch(error => {
            console.error('加载数据失败:', error);
        });
}
// loadLineups()
// loadRealData()


var used_colormaps_global = {
    'blues': [[253, 244, 249],
    [214, 207, 230],
    [169, 180, 214],
    [122, 158, 201],
    [76, 133, 184],
    [49, 107, 174],
    [39, 82, 149],
    [27, 61, 103],
    [18, 41, 70]].reverse(),
    'viridis': (function () {
        var out = [];
        for (var i = 0; i <= 100; i++) {
            var c = d3.interpolateViridis(i / 100);
            var rgb = d3.color(c);
            out.push([rgb.r, rgb.g, rgb.b]);
        }
        return out
    })(),
    'blueorange': [{
        "v": "0",
        "o": "1",
        "r": "0.0862745098039216",
        "g": "0.00392156862745098",
        "b": "0.298039215686275"
    },
    {
        "v": "0.030334",
        "o": "1",
        "r": "0.113725",
        "g": "0.0235294",
        "b": "0.45098"
    },
    {
        "v": "0.055527",
        "o": "1",
        "r": "0.105882",
        "g": "0.0509804",
        "b": "0.509804"
    },
    {
        "v": "0.073008",
        "o": "1",
        "r": "0.0392157",
        "g": "0.0392157",
        "b": "0.560784"
    },
    {
        "v": "0.089974",
        "o": "1",
        "r": "0.0313725",
        "g": "0.0980392",
        "b": "0.6"
    },
    {
        "v": "0.106427",
        "o": "1",
        "r": "0.0431373",
        "g": "0.164706",
        "b": "0.639216"
    },
    {
        "v": "0.130077",
        "o": "1",
        "r": "0.054902",
        "g": "0.243137",
        "b": "0.678431"
    },
    {
        "v": "0.16144",
        "o": "1",
        "r": "0.054902",
        "g": "0.317647",
        "b": "0.709804"
    },
    {
        "v": "0.2",
        "o": "1",
        "r": "0.0509804",
        "g": "0.396078",
        "b": "0.741176"
    },
    {
        "v": "0.225",
        "o": "1",
        "r": "0.0392157",
        "g": "0.466667",
        "b": "0.768627"
    },
    {
        "v": "0.25",
        "o": "1",
        "r": "0.0313725",
        "g": "0.537255",
        "b": "0.788235"
    },
    {
        "v": "0.276093",
        "o": "1",
        "r": "0.0313725",
        "g": "0.615686",
        "b": "0.811765"
    },
    {
        "v": "0.302828",
        "o": "1",
        "r": "0.0235294",
        "g": "0.709804",
        "b": "0.831373"
    },
    {
        "v": "0.329563",
        "o": "1",
        "r": "0.0509804",
        "g": "0.8",
        "b": "0.85098"
    },
    {
        "v": "0.351671",
        "o": "1",
        "r": "0.0705882",
        "g": "0.854902",
        "b": "0.870588"
    },
    {
        "v": "0.372237",
        "o": "1",
        "r": "0.262745",
        "g": "0.901961",
        "b": "0.862745"
    },
    {
        "v": "0.390231",
        "o": "1",
        "r": "0.423529",
        "g": "0.941176",
        "b": "0.87451"
    },
    {
        "v": "0.417995",
        "o": "1",
        "r": "0.572549",
        "g": "0.964706",
        "b": "0.835294"
    },
    {
        "v": "0.436504",
        "o": "1",
        "r": "0.658824",
        "g": "0.980392",
        "b": "0.843137"
    },
    {
        "v": "0.456041",
        "o": "1",
        "r": "0.764706",
        "g": "0.980392",
        "b": "0.866667"
    },
    {
        "v": "0.468895",
        "o": "1",
        "r": "0.827451",
        "g": "0.980392",
        "b": "0.886275"
    },
    {
        "v": "0.482262",
        "o": "1",
        "r": "0.890196078431372",
        "g": "0.988235294117647",
        "b": "0.925490196078431"
    },
    {
        "v": "0.492545",
        "o": "1",
        "r": "0.913725",
        "g": "0.988235",
        "b": "0.937255"
    },
    {
        "v": "0.501285",
        "o": "1",
        "r": "1",
        "g": "1",
        "b": "0.972549019607843"
    },
    {
        "v": "0.510026",
        "o": "1",
        "r": "0.988235294117647",
        "g": "0.988235294117647",
        "b": "0.905882352941176"
    },
    {
        "v": "0.526478",
        "o": "1",
        "r": "0.992156862745098",
        "g": "0.972549019607843",
        "b": "0.803921568627451"
    },
    {
        "v": "0.539846",
        "o": "1",
        "r": "0.992157",
        "g": "0.964706",
        "b": "0.713725"
    },
    {
        "v": "0.554756",
        "o": "1",
        "r": "0.988235",
        "g": "0.956863",
        "b": "0.643137"
    },
    {
        "v": "0.576864",
        "o": "1",
        "r": "0.980392",
        "g": "0.917647",
        "b": "0.509804"
    },
    {
        "v": "0.599486",
        "o": "1",
        "r": "0.968627",
        "g": "0.87451",
        "b": "0.407843"
    },
    {
        "v": "0.620051",
        "o": "1",
        "r": "0.94902",
        "g": "0.823529",
        "b": "0.321569"
    },
    {
        "v": "0.636504",
        "o": "1",
        "r": "0.929412",
        "g": "0.776471",
        "b": "0.278431"
    },
    {
        "v": "0.660668",
        "o": "1",
        "r": "0.909804",
        "g": "0.717647",
        "b": "0.235294"
    },
    {
        "v": "0.682262",
        "o": "1",
        "r": "0.890196",
        "g": "0.658824",
        "b": "0.196078"
    },
    {
        "v": "0.7",
        "o": "1",
        "r": "0.878431",
        "g": "0.619608",
        "b": "0.168627"
    },
    {
        "v": "0.725",
        "o": "1",
        "r": "0.870588",
        "g": "0.54902",
        "b": "0.156863"
    },
    {
        "v": "0.75",
        "o": "1",
        "r": "0.85098",
        "g": "0.47451",
        "b": "0.145098"
    },
    {
        "v": "0.775",
        "o": "1",
        "r": "0.831373",
        "g": "0.411765",
        "b": "0.133333"
    },
    {
        "v": "0.8",
        "o": "1",
        "r": "0.811765",
        "g": "0.345098",
        "b": "0.113725"
    },
    {
        "v": "0.825",
        "o": "1",
        "r": "0.788235",
        "g": "0.266667",
        "b": "0.0941176"
    },
    {
        "v": "0.85",
        "o": "1",
        "r": "0.741176",
        "g": "0.184314",
        "b": "0.0745098"
    },
    {
        "v": "0.875",
        "o": "1",
        "r": "0.690196",
        "g": "0.12549",
        "b": "0.0627451"
    },
    {
        "v": "0.9",
        "o": "1",
        "r": "0.619608",
        "g": "0.0627451",
        "b": "0.0431373"
    },
    {
        "v": "0.923393",
        "o": "1",
        "r": "0.54902",
        "g": "0.027451",
        "b": "0.0705882"
    },
    {
        "v": "0.943959",
        "o": "1",
        "r": "0.470588",
        "g": "0.0156863",
        "b": "0.0901961"
    },
    {
        "v": "0.967095",
        "o": "1",
        "r": "0.4",
        "g": "0.00392157",
        "b": "0.101961"
    },
    {
        "v": "1",
        "o": "1",
        "r": "0.188235294117647",
        "g": "0",
        "b": "0.0705882352941176"
    }],
    'rainbowjet': [[0, 0, 143],
    [0, 0, 159],
    [0, 0, 175],
    [0, 0, 191],
    [0, 0, 207],
    [0, 0, 223],
    [0, 0, 239],
    [0, 0, 255],
    [0, 15, 255],
    [0, 31, 255],
    [0, 47, 255],
    [0, 63, 255],
    [0, 79, 255],
    [0, 95, 255],
    [0, 111, 255],
    [0, 127, 255],
    [0, 143, 255],
    [0, 159, 255],
    [0, 175, 255],
    [0, 191, 255],
    [0, 207, 255],
    [0, 223, 255],
    [0, 239, 255],
    [0, 255, 255],
    [15, 255, 239],
    [31, 255, 223],
    [47, 255, 207],
    [63, 255, 191],
    [79, 255, 175],
    [95, 255, 159],
    [111, 255, 143],
    [127, 255, 127],
    [143, 255, 111],
    [159, 255, 95],
    [175, 255, 79],
    [191, 255, 63],
    [207, 255, 47],
    [223, 255, 31],
    [239, 255, 15],
    [255, 255, 0],
    [255, 239, 0],
    [255, 223, 0],
    [255, 207, 0],
    [255, 191, 0],
    [255, 175, 0],
    [255, 159, 0],
    [255, 143, 0],
    [255, 127, 0],
    [255, 111, 0],
    [255, 95, 0],
    [255, 79, 0],
    [255, 63, 0],
    [255, 47, 0],
    [255, 31, 0],
    [255, 15, 0],
    [255, 0, 0],
    [239, 0, 0],
    [223, 0, 0],
    [207, 0, 0],
    [191, 0, 0],
    [175, 0, 0],
    [159, 0, 0],
    [143, 0, 0],
    [127, 0, 0]]
}

function generateColormapMetric(dataObj) {

    let colormap = [], tmp_c = [0, 0, 0]
    let step_size = (dataObj.extent[1] - dataObj.extent[0]) / 1000
    for (let i = 0; i < 1000; i++) {
        for (let j = 0; j < dataObj.controlColors.length - 1; j++) {
            if (i * step_size >= dataObj.controlPoints[j] && i * step_size < dataObj.controlPoints[j + 1]) {
                tmp_c[0] = dataObj.controlColors[j][0] + (dataObj.controlColors[j + 1][0] - dataObj.controlColors[j][0]) * (i * step_size - dataObj.controlPoints[j]) / (dataObj.controlPoints[j + 1] - dataObj.controlPoints[j])
                tmp_c[1] = dataObj.controlColors[j][1] + (dataObj.controlColors[j + 1][1] - dataObj.controlColors[j][1]) * (i * step_size - dataObj.controlPoints[j]) / (dataObj.controlPoints[j + 1] - dataObj.controlPoints[j])
                tmp_c[2] = dataObj.controlColors[j][2] + (dataObj.controlColors[j + 1][2] - dataObj.controlColors[j][2]) * (i * step_size - dataObj.controlPoints[j]) / (dataObj.controlPoints[j + 1] - dataObj.controlPoints[j])
                let tuple = d3.rgb(d3.lab(tmp_c[0], tmp_c[1], tmp_c[2]))
                colormap.push([tuple.r, tuple.g, tuple.b, 1])

                break;
            }
        }
    }
    // for (let i = 0; i < dataObj.controlColors.length - 1; i++) {
    //     var start = Math.floor(dataObj.controlPoints[i] * 1000)
    //     var end = Math.floor(dataObj.controlPoints[i + 1] * 1000)
    //     var step = end - start

    //     for (let j = 0; j < step; j++) {
    //         tmp_c[0] = dataObj.controlColors[i][0] + (dataObj.controlColors[i + 1][0] - dataObj.controlColors[i][0]) * (j / step)
    //         tmp_c[1] = dataObj.controlColors[i][1] + (dataObj.controlColors[i + 1][1] - dataObj.controlColors[i][1]) * (j / step)
    //         tmp_c[2] = dataObj.controlColors[i][2] + (dataObj.controlColors[i + 1][2] - dataObj.controlColors[i][2]) * (j / step)
    //         let tuple = d3.rgb(d3.lab(tmp_c[0], tmp_c[1], tmp_c[2]))
    //         colormap.push([tuple.r, tuple.g, tuple.b, 1])
    //     }
    // }
    // tmp_c = d3.rgb(d3.lab(dataObj.controlColors[dataObj.controlColors.length - 1][0], dataObj.controlColors[dataObj.controlColors.length - 1][1], dataObj.controlColors[dataObj.controlColors.length - 1][2]))
    // colormap.push([tmp_c.r, tmp_c.g, tmp_c.b, 1])
    return colormap
}
function drawColormapAligned(dataObj, div, text) {
    let colormap = generateColormapMetric(dataObj)
    // console.log("colormap=====", colormap);
    //get context 
    div.append("canvas").attr("id", text + "-colormap")
        .attr("width", colormap.length).attr("height", 45).style("margin-left", "20px").style("display", "inline-block")
    let canvas = document.getElementById(text + "-colormap")
    let context = canvas.getContext('2d');

    //traverse the image data
    for (var i = 0; i < canvas.width; i++) {
        for (var j = 0; j < canvas.height; j++) {
            context.fillStyle = 'rgba(' + colormap[i][0] +
                ',' + colormap[i][1] +
                ',' + colormap[i][2] +
                ',' + 1 + ')';
            context.fillRect(i, j, 1, 1);
        }
    }
}
function renderLineups() {
    // testColormaps()
    // return
    // base colormap: blues, viridis, blueorange, rainbowjet
    var base_colormap = used_colormaps_global['rainbowjet']

    // get control points
    var colormap_inter = []
    if (base_colormap.length < 1000) {
        if (Array.isArray(base_colormap[0])) {
            var step = Math.floor((1000 / base_colormap.length - 1))
            for (var i = 0; i < base_colormap.length - 1; i++) {
                for (var j = 0; j < step; j++) {
                    var r = base_colormap[i][0] + j * (base_colormap[i + 1][0] - base_colormap[i][0]) / step,
                        g = base_colormap[i][1] + j * (base_colormap[i + 1][1] - base_colormap[i][1]) / step,
                        b = base_colormap[i][2] + j * (base_colormap[i + 1][2] - base_colormap[i][2]) / step
                    colormap_inter.push([r, g, b])
                }
            }
            colormap_inter.push(base_colormap[base_colormap.length - 1])
        }
        else {
            // console.log("blue orange");

            for (var i = 0; i < base_colormap.length - 1; i++) {
                var start = (+base_colormap[i]['v']) * 1000
                var end = (+base_colormap[i + 1]['v']) * 1000
                var step = end - start
                for (var j = 0; j < step; j++) {
                    var r = +base_colormap[i]['r'] + j * (+base_colormap[i + 1]['r'] - +base_colormap[i]['r']) / step,
                        g = +base_colormap[i]['g'] + j * (+base_colormap[i + 1]['g'] - +base_colormap[i]['g']) / step,
                        b = +base_colormap[i]['b'] + j * (+base_colormap[i + 1]['b'] - +base_colormap[i]['b']) / step
                    colormap_inter.push([r * 255, g * 255, b * 255])
                }
            }
            colormap_inter.push([+base_colormap[base_colormap.length - 1]['r'] * 255, +base_colormap[base_colormap.length - 1]['g'] * 255, +base_colormap[base_colormap.length - 1]['b'] * 255])
        }
    }
    // console.log("colormap_inter", colormap_inter);
    var palette = [], pal_size = 9
    for (var i = 0; i < pal_size; i++) {
        var idx = Math.round(i / (pal_size - 1) * (colormap_inter.length - 1))
        var color = colormap_inter[idx],
            lab = d3.lab(d3.rgb(color[0], color[1], color[2]))
        palette.push(lab)
    }

    function getLumiCurve(pal) {
        var curve = []
        for (var i = 0; i < pal.length; i++) {
            curve.push([i, pal[i].L])
        }
        return curve
    }

    var div = d3.select("body").append("div")
        .style("border", "1px solid black").style("margin-top", "10px")
        .style("padding", "5px")

    drawColormapM(palette, div, "rainbow reference", palette)
    div.append("br")
    drawOptimizationCurve(getLumiCurve(palette), div)

    function getExtent(data) {
        let extent = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]
        for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < data[i].length; j++) {
                if (data[i][j] != 'NaN') {
                    extent[0] = Math.min(extent[0], data[i][j])
                    extent[1] = Math.max(extent[1], data[i][j])
                }
            }
        }
        return extent
    }

    let all_data = []
    for (let i = 0; i < lineup_datas.length; i++) {
        if (lineup_datas[i]) {
            all_data = all_data.concat(lineup_datas[i])
        }
    }

    let all_data_obj2 = new DataObj(all_data)
    let real_data_obj = new DataObj(data_arr[current_data_id].data, pal_size - 2)
    console.log("拼接后的数据:", all_data)
    let all_data_obj = new DataObj(all_data, pal_size - 2)
    let extent = all_data_obj.extent
    console.log("total extent", extent);
    // 等待所有数据加载完成
    function waitForStatusId() {
        let waitTime = 0;
        return new Promise((resolve) => {
            let checkInterval = setInterval(() => {
                waitTime += 1;
                console.log(`已等待 ${waitTime} 秒...`);

                if (all_data_obj.controlPoints.length > 2 && all_data_obj2.controlPoints.length > 2 && real_data_obj.controlPoints.length > 2) {
                    console.log(`总共等待了 ${waitTime} 秒`);
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 1000);
        });
    }

    // 使用 async/await 等待
    (async () => {
        await waitForStatusId();
        // 后续代码会在 statusId 消失后继续执行

        let dataObj = {}
        dataObj.extent = extent
        dataObj.controlPoints = []
        dataObj.controlColors = []
        for (let j = 0; j < palette.length; j++) {
            dataObj.controlPoints.push(dataObj.extent[0] + j / (palette.length - 1) * (dataObj.extent[1] - dataObj.extent[0]))
            dataObj.controlColors.push([palette[j].L, palette[j].a, palette[j].b])
        }

        div.append("br")
        for (let i = 0; i < lineup_datas.length; i++) {
            dataObj.data = lineup_datas[i]
            dataObj.width = lineup_datas[i][0].length
            dataObj.height = lineup_datas[i].length
            if (i == 0) {
                // all_data_obj.controlPoints = [0, 0.10696272721585506, 0.35972964910393603, 0.39166873432713967, 0.63308711148282, 0.6693810392301757, 0.7975799071391243, 0.9069692149614524, 1]
                // console.log("controlPoints", all_data_obj.controlPoints, dataObj.controlPoints);
                drawColormapAligned(dataObj, div, "reference")
                div.append("br")
            }
            renderCanvasTest(dataObj, div, "rainbow-reference-" + i)
        }

        div.append("br")
        for (let i = 0; i < lineup_datas.length; i++) {
            dataObj.data = lineup_datas[i]
            dataObj.width = lineup_datas[i][0].length
            dataObj.height = lineup_datas[i].length
            dataObj.controlPoints = all_data_obj.controlPoints
            if (i == 0) {
                drawColormapAligned(dataObj, div, "aligned-reference")
                div.append("br")
            }
            renderCanvasTest(dataObj, div, "aligned-rainbow-reference-" + i)
        }

        div.append("br")
        dataObj.data = real_data_obj.data
        dataObj.extent = real_data_obj.extent
        dataObj.width = real_data_obj.width
        dataObj.height = real_data_obj.height
        dataObj.controlPoints = []
        for (let j = 0; j < palette.length; j++) {
            dataObj.controlPoints.push(dataObj.extent[0] + j / (palette.length - 1) * (dataObj.extent[1] - dataObj.extent[0]))
        }
        renderCanvasTest(dataObj, div, "reference-real-data")
        dataObj.controlPoints = real_data_obj.controlPoints
        renderCanvasTest(dataObj, div, "aligned-reference-real-data")

        // return 0
        function drawSetting(profile, text) {
            var best_solution, best_score = -1000000000
            for (var i = 0; i < 5; i++) {
                var solution = optimizerForRainbow3(palette, profile)
                if (solution.score > best_score) {
                    best_solution = solution
                    best_score = solution.score
                }
            }
            drawColormapM(best_solution.initialization, div, "Initialization-" + text, palette)
            drawColormapM(best_solution.palette, div, text + ": " + best_solution.score.toFixed(2), palette)
            div.append("br")
            drawOptimizationCurve(getLumiCurve(best_solution.palette), div)

            div.append("br")
            for (let i = 0; i < lineup_datas.length; i++) {
                dataObj.extent = extent
                dataObj.data = lineup_datas[i]
                dataObj.width = lineup_datas[i][0].length
                dataObj.height = lineup_datas[i].length
                dataObj.controlPoints = []
                dataObj.controlColors = []
                for (let j = 0; j < best_solution.palette.length; j++) {
                    dataObj.controlPoints.push(dataObj.extent[0] + j / (best_solution.palette.length - 1) * (dataObj.extent[1] - dataObj.extent[0]))
                    dataObj.controlColors.push([best_solution.palette[j].L, best_solution.palette[j].a, best_solution.palette[j].b])
                }
                if (i == 0) {
                    drawColormapAligned(dataObj, div, text)
                    div.append("br")
                }
                renderCanvasTest(dataObj, div, text + i)
            }

            div.append("br")
            for (let i = 0; i < lineup_datas.length; i++) {
                dataObj.data = lineup_datas[i]
                dataObj.width = lineup_datas[i][0].length
                dataObj.height = lineup_datas[i].length
                dataObj.controlPoints = all_data_obj.controlPoints
                if (i == 0) {
                    drawColormapAligned(dataObj, div, "aligned-" + text)
                    div.append("br")
                }
                renderCanvasTest(dataObj, div, "aligned-" + text + i)
            }


            div.append("br")
            dataObj.data = real_data_obj.data
            dataObj.extent = real_data_obj.extent
            dataObj.width = real_data_obj.width
            dataObj.height = real_data_obj.height
            dataObj.controlPoints = []
            for (let j = 0; j < best_solution.palette.length; j++) {
                dataObj.controlPoints.push(dataObj.extent[0] + j / (best_solution.palette.length - 1) * (dataObj.extent[1] - dataObj.extent[0]))
            }
            renderCanvasTest(dataObj, div, "real-data" + text)
            console.log("current_data_id", current_data_id, real_data_obj.controlPoints);
            dataObj.controlPoints = real_data_obj.controlPoints
            renderCanvasTest(dataObj, div, "aligned-real-data" + text)
        }

        drawSetting(0, "Linear")
        drawSetting(1, "Diverging")
        drawSetting(2, "Wave")

        data_arr.push(all_data_obj2)
        current_data_id = data_arr.length - 1
        let preferredObj = simulatedAnnealing()
        palette = []
        let curve_data = []
        for (let i = 0; i < preferredObj.palette.length; i++) {
            var color = color2Lab(preferredObj.palette[i])
            palette.push([color.L, color.a, color.b])
            curve_data.push([i, color.L])
        }
        div.append("br")
        div.append("hr")
        div.append("h3").text("Ours without alignment V.S. with alignment")
        drawOptimizationCurve(curve_data, div)
        div.append("br")
        for (let i = 0; i < lineup_datas.length; i++) {
            dataObj.extent = all_data_obj2.extent
            dataObj.data = lineup_datas[i]
            dataObj.width = lineup_datas[i][0].length
            dataObj.height = lineup_datas[i].length
            dataObj.controlColors = palette
            dataObj.controlPoints = []
            for (let j = 0; j < palette.length; j++) {
                dataObj.controlPoints.push(dataObj.extent[0] + j / (palette.length - 1) * (dataObj.extent[1] - dataObj.extent[0]))
            }
            if (i == 0) {
                drawColormapAligned(dataObj, div, "ours-default")
                div.append("br")
            }
            renderCanvasTest(dataObj, div, "ours-default-" + i)
        }
        div.append("br")
        for (let i = 0; i < lineup_datas.length; i++) {
            dataObj.extent = all_data_obj2.extent
            dataObj.data = lineup_datas[i]
            dataObj.width = lineup_datas[i][0].length
            dataObj.height = lineup_datas[i].length
            dataObj.controlPoints = all_data_obj2.controlPoints
            dataObj.controlColors = palette
            if (i == 0) {
                drawColormapAligned(dataObj, div, "ours-aligned")
                div.append("br")
            }
            renderCanvasTest(dataObj, div, "ours-aligned-" + i)
        }
        drawOptimizationCurve(preferredObj.curve, div)

        div.append("br")
        div.append("hr")
        div.append("h3").text("Ours without alignment V.S. with alignment")
        current_data_id -= 1
        dataObj.data = data_arr[current_data_id].data
        dataObj.extent = data_arr[current_data_id].extent
        dataObj.width = data_arr[current_data_id].width
        dataObj.height = data_arr[current_data_id].height
        dataObj.controlPoints = []
        preferredObj = simulatedAnnealing()
        palette = []
        curve_data = []
        for (let i = 0; i < preferredObj.palette.length; i++) {
            var color = color2Lab(preferredObj.palette[i])
            palette.push([color.L, color.a, color.b])
            curve_data.push([i, color.L])
        }
        drawOptimizationCurve(curve_data, div)
        div.append("br")
        dataObj.controlColors = palette
        for (let j = 0; j < palette.length; j++) {
            dataObj.controlPoints.push(dataObj.extent[0] + j / (palette.length - 1) * (dataObj.extent[1] - dataObj.extent[0]))
        }

        drawColormapAligned(dataObj, div, "ours-real-without-aligned")
        div.append("br")
        renderCanvasTest(dataObj, div, "real-data-ours")
        div.append("br")
        dataObj.controlPoints = data_arr[current_data_id].controlPoints
        drawColormapAligned(dataObj, div, "ours-real-aligned")
        div.append("br")
        renderCanvasTest(dataObj, div, "aligned-real-data-ours")

        drawOptimizationCurve(preferredObj.curve, div)
    })();

}
// renderLineups = renderLineupsAligned
function renderLineupsAligned() {
    // testColormaps()
    // return
    // base colormap: blues, viridis, blueorange, rainbowjet
    var base_colormap = used_colormaps_global['rainbowjet']
    base_colormap = COLOR_PRESETS['turbo']

    // get control points
    var colormap_inter = []
    if (base_colormap.length < 1000) {
        if (Array.isArray(base_colormap[0])) {
            var step = Math.floor((1000 / base_colormap.length - 1))
            for (var i = 0; i < base_colormap.length - 1; i++) {
                for (var j = 0; j < step; j++) {
                    var r = base_colormap[i][0] + j * (base_colormap[i + 1][0] - base_colormap[i][0]) / step,
                        g = base_colormap[i][1] + j * (base_colormap[i + 1][1] - base_colormap[i][1]) / step,
                        b = base_colormap[i][2] + j * (base_colormap[i + 1][2] - base_colormap[i][2]) / step
                    colormap_inter.push([r, g, b])
                }
            }
            colormap_inter.push(base_colormap[base_colormap.length - 1])
        }
        else {
            // console.log("blue orange");

            for (var i = 0; i < base_colormap.length - 1; i++) {
                var start = (+base_colormap[i]['v']) * 1000
                var end = (+base_colormap[i + 1]['v']) * 1000
                var step = end - start
                for (var j = 0; j < step; j++) {
                    var r = +base_colormap[i]['r'] + j * (+base_colormap[i + 1]['r'] - +base_colormap[i]['r']) / step,
                        g = +base_colormap[i]['g'] + j * (+base_colormap[i + 1]['g'] - +base_colormap[i]['g']) / step,
                        b = +base_colormap[i]['b'] + j * (+base_colormap[i + 1]['b'] - +base_colormap[i]['b']) / step
                    colormap_inter.push([r * 255, g * 255, b * 255])
                }
            }
            colormap_inter.push([+base_colormap[base_colormap.length - 1]['r'] * 255, +base_colormap[base_colormap.length - 1]['g'] * 255, +base_colormap[base_colormap.length - 1]['b'] * 255])
        }
    }
    // console.log("colormap_inter", colormap_inter);
    var palette = [], pal_size = 7
    for (var i = 0; i < pal_size; i++) {
        var idx = Math.round(i / (pal_size - 1) * (colormap_inter.length - 1))
        var color = colormap_inter[idx],
            lab = d3.lab(d3.rgb(color[0], color[1], color[2]))
        palette.push(lab)
    }

    function getLumiCurve(pal) {
        var curve = []
        for (var i = 0; i < pal.length; i++) {
            curve.push([i, pal[i].L])
        }
        return curve
    }
    function getHueCurve(pal) {
        var curve = []
        for (var i = 0; i < pal.length; i++) {
            var hcl = labToHcl(pal[i])
            curve.push([i, hcl.h])
        }
        return curve
    }

    var div = d3.select("body").append("div")
        .style("border", "1px solid black").style("margin-top", "10px")
        .style("padding", "5px")

    drawColormapM(palette, div, "Initial colormap", palette)
    div.append("br")
    drawOptimizationCurve(getLumiCurve(palette), div)
    drawOptimizationCurve(getHueCurve(palette), div)

    let all_data = []
    for (let i = 0; i < lineup_datas.length; i++) {
        if (lineup_datas[i]) {
            all_data = all_data.concat(lineup_datas[i])
        }
    }

    let all_data_obj2 = new DataObj(all_data)
    console.log("拼接后的数据:", all_data)
    let all_data_obj = new DataObj(all_data, pal_size - 2)
    console.log("total extent", all_data_obj.extent);
    // 等待所有数据加载完成
    function waitForStatusId() {
        let waitTime = 0;
        return new Promise((resolve) => {
            let checkInterval = setInterval(() => {
                waitTime += 1;
                console.log(`已等待 ${waitTime} 秒...`);

                if (all_data_obj.controlPoints.length > 2 && all_data_obj2.controlPoints.length > 2) {
                    console.log(`总共等待了 ${waitTime} 秒`);
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 1000);
        });
    }

    // 使用 async/await 等待
    (async () => {
        await waitForStatusId();
        // 后续代码会在 statusId 消失后继续执行

        let dataObj = {}
        dataObj.extent = all_data_obj.extent
        dataObj.controlColors = []
        for (let j = 0; j < palette.length; j++) {
            dataObj.controlColors.push([palette[j].L, palette[j].a, palette[j].b])
        }
        dataObj.controlPoints = all_data_obj.controlPoints

        div.append("br")
        for (let i = 0; i < lineup_datas.length; i++) {
            dataObj.data = lineup_datas[i]
            dataObj.width = lineup_datas[i][0].length
            dataObj.height = lineup_datas[i].length
            renderCanvasTest(dataObj, div, "aligned-rainbow-reference-" + i)
        }

        // return 0
        function drawSetting(profile, text) {
            var best_solution, best_score = -1000000000
            // let str = ""
            // for (let i = 0; i < palette.length; i++) {
            //     str += labToHcl(palette[i]).h.toFixed(0) + ", "
            // }
            // console.log("before:", str);

            for (var i = 0; i < 5; i++) {
                var solution = optimizerForRainbow3(palette, profile)
                if (solution.score > best_score) {
                    best_solution = solution
                    best_score = solution.score
                }
            }
            // str = ""
            // for (let i = 0; i < best_solution.palette.length; i++) {
            //     str += labToHcl(best_solution.palette[i]).h.toFixed(0) + ", "
            // }
            // console.log("after:", str);
            // drawColormapM(best_solution.initialization, div, "Initialization-" + text, palette)
            drawColormapM(best_solution.palette, div, text + ": " + best_solution.score.toFixed(2), palette)
            div.append("br")
            drawOptimizationCurve(getLumiCurve(best_solution.palette), div)
            drawOptimizationCurve(getHueCurve(best_solution.palette), div)

            dataObj.controlColors = []
            for (let j = 0; j < best_solution.palette.length; j++) {
                dataObj.controlColors.push([best_solution.palette[j].L, best_solution.palette[j].a, best_solution.palette[j].b])
            }
            div.append("br")
            for (let i = 0; i < lineup_datas.length; i++) {
                dataObj.data = lineup_datas[i]
                dataObj.width = lineup_datas[i][0].length
                dataObj.height = lineup_datas[i].length
                renderCanvasTest(dataObj, div, "aligned-" + text + i)
            }

        }

        drawSetting(0, "Linear")
        drawSetting(1, "Diverging")
        drawSetting(2, "Wave")

        data_arr.push(all_data_obj2)
        current_data_id = data_arr.length - 1
        let preferredObj = simulatedAnnealing()
        palette = []
        let curve_data = [], curve_data2 = [], ours_palette = []
        for (let i = 0; i < preferredObj.palette.length; i++) {
            var color = color2Lab(preferredObj.palette[i])
            ours_palette.push(color)
            palette.push([color.L, color.a, color.b])
            curve_data.push([i, color.L])
            curve_data2.push([i, labToHcl(color).h])
        }
        div.append("br")
        div.append("hr")
        div.append("h3").text("Ours")
        drawColormapM(ours_palette, div, "Ours: " + preferredObj.score.toFixed(2), ours_palette)
        drawOptimizationCurve(curve_data, div)
        drawOptimizationCurve(curve_data2, div)
        div.append("br")
        for (let i = 0; i < lineup_datas.length; i++) {
            dataObj.extent = all_data_obj2.extent
            dataObj.data = lineup_datas[i]
            dataObj.width = lineup_datas[i][0].length
            dataObj.height = lineup_datas[i].length
            dataObj.controlPoints = all_data_obj2.controlPoints
            dataObj.controlColors = palette
            renderCanvasTest(dataObj, div, "ours-aligned-" + i)
        }
        drawOptimizationCurve(preferredObj.curve, div)

    })();

}

let thermal_luminance_profile = []
function getThermalProfile() {
    function getLumiCurve(pal) {
        let curve = [], tmp_c = [0, 0, 0]
        let step_size = (pal[pal.length - 1][0] - pal[1][0]) / 1000
        for (let i = 0; i < 1000; i++) {
            for (let j = 1; j < pal.length - 1; j++) {
                if (i * step_size >= pal[j][0] && i * step_size < pal[j + 1][0]) {
                    tmp_c[0] = +pal[j][1] + (+pal[j + 1][1] - pal[j][1]) * (i * step_size - pal[j][0]) / (+pal[j + 1][0] - pal[j][0])
                    tmp_c[1] = +pal[j][2] + (+pal[j + 1][2] - pal[j][2]) * (i * step_size - pal[j][0]) / (+pal[j + 1][0] - pal[j][0])
                    tmp_c[2] = +pal[j][3] + (+pal[j + 1][3] - pal[j][3]) * (i * step_size - pal[j][0]) / (+pal[j + 1][0] - pal[j][0])
                    let tuple = d3.lab(d3.rgb(tmp_c[0] * 255, tmp_c[1] * 255, tmp_c[2] * 255))
                    curve.push([i, tuple.L])

                    break;
                }
            }
        }

        return curve
    }
    // load the colormap
    fetch("/static/data/colormap/TH_Thermal_6.txt")
        .then(response => {
            if (!response.ok) {
                throw new Error('网络响应失败');
            }
            return response.text(); // 读取文件内容为文本
        })
        .then(data => {
            // console.log('文件内容:', data);
            let source_data = d3.csvParseRows(data.replace(/\t/g, ','))
            thermal_luminance_profile = getLumiCurve(source_data)
            console.log("thermal_luminance_profile", thermal_luminance_profile);

        })
        .catch(error => {
            console.error('读取文件时出错:', error);
        });
}
// getThermalProfile()
function applyThermalProfile(idx, len) {

    let thermal_idx = Math.floor(idx / (len - 1) * (thermal_luminance_profile.length - 1))
    return thermal_luminance_profile[thermal_idx][1]
}
