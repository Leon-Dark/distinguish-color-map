function drawAllExamples() {
    let div = d3.select("#exampleDiv")
    div.style("border", "1px solid black").style("margin-top", "10px")
    div.selectAll("*").remove()
    async function drawAll() {
        try {
            await drawExample("RB_ParaviewRainbow", div);
            await new Promise(resolve => setTimeout(resolve, 100)); // 等待绘制完成
            await drawExample("VI_ViridisRGB", div);
            await new Promise(resolve => setTimeout(resolve, 100)); // 等待绘制完成
            await drawExample("TH_Thermal_6", div);
            await new Promise(resolve => setTimeout(resolve, 100)); // 等待绘制完成
            await drawOMCExample("OMC", div);
            await new Promise(resolve => setTimeout(resolve, 100)); // 等待绘制完成
            await drawZellerColormap(div);
        } catch (error) {
            console.error('执行过程中出错:', error);
        }
    }
    drawAll();
}

/**
 * 
 * @param {string} example "RB_ParaviewRainbow"
 */
function drawExample(example, div) {
    // load the colormap
    fetch("/static/data/colormap/" + example + ".txt")
        .then(response => {
            if (!response.ok) {
                throw new Error('网络响应失败');
            }
            return response.text(); // 读取文件内容为文本
        })
        .then(data => {
            // console.log('文件内容:', data);
            let source_data = d3.csvParseRows(data.replace(/\t/g, ','))
            console.log(example, "source_data", source_data);
            // render the colormap
            renderExampleColormap(example, source_data, div)
        })
        .catch(error => {
            console.error('读取文件时出错:', error);
        });

}

function renderExampleColormap(example, colormap, div) {
    div.append("h3").text(example)
    let width = colormap_width, height = colormap_height
    div.append("canvas").attr("id", example + "ColormapCanvasId")
        .attr("width", width).attr("height", height)
    let canvas = document.getElementById(example + "ColormapCanvasId")
    let context = canvas.getContext('2d');

    //traverse the image data
    let range = +colormap[colormap.length - 1][0] - (+colormap[1][0])
    let rgb = [0, 0, 0]
    for (let j = 0; j < canvas.width; j++) {
        let jj = j / (canvas.width - 1) * range
        for (let k = 1; k < colormap.length - 1; k++) {
            if (jj >= +colormap[k][0] && jj <= +colormap[k + 1][0]) {
                rgb[0] = +colormap[k][1] + (+colormap[k + 1][1] - colormap[k][1]) * (jj - colormap[k][0]) / (+colormap[k + 1][0] - colormap[k][0])
                rgb[1] = +colormap[k][2] + (+colormap[k + 1][2] - colormap[k][2]) * (jj - colormap[k][0]) / (+colormap[k + 1][0] - colormap[k][0])
                rgb[2] = +colormap[k][3] + (+colormap[k + 1][3] - colormap[k][3]) * (jj - colormap[k][0]) / (+colormap[k + 1][0] - colormap[k][0])
                break
            }
        }
        for (let i = 0; i < canvas.height; i++) {
            context.fillStyle = 'rgba(' + rgb[0] * 255 +
                ',' + rgb[1] * 255 +
                ',' + rgb[2] * 255 +
                ',' + 1 + ')';
            context.fillRect(j, i, 1, 1);
        }
    }

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

        // var curve = []
        // for (var i = 1; i < pal.length; i++) {
        //     var c = d3.lab(d3.rgb(pal[i][1] * 255, pal[i][2] * 255, pal[i][3] * 255))
        //     curve.push([i, c.L])
        // }
        console.log("curve", curve);
        return curve
    }
    // drawOptimizationCurve(getLumiCurve(colormap), div)

    // render the visualization
    let dataObj = data_arr[current_data_id]
    div.append("canvas").attr("id", example + "renderCanvasId").attr("width", dataObj.width).attr("height", dataObj.height).style("margin-left", "10px").attr("class", "exampleCanvas")
    canvas = document.getElementById(example + "renderCanvasId")
    context = canvas.getContext('2d');

    //traverse the image data
    for (let i = 0; i < canvas.height; i++) {
        for (let j = 0; j < canvas.width; j++) {
            let tuple = [0, 0, 0, 1]
            let scalar_value = dataObj.data[i][j]
            if (isNaN(scalar_value)) {
                tuple = [255, 255, 255, 1]
            } else {
                let x = (+scalar_value - dataObj.extent[0]) / (dataObj.extent[1] - dataObj.extent[0])
                for (let k = 1; k < colormap.length - 1; k++) {
                    if (x >= +colormap[k][0] && x <= +colormap[k + 1][0]) {
                        tuple[0] = +colormap[k][1] + (+colormap[k + 1][1] - colormap[k][1]) * (x - colormap[k][0]) / (+colormap[k + 1][0] - colormap[k][0])
                        tuple[1] = +colormap[k][2] + (+colormap[k + 1][2] - colormap[k][2]) * (x - colormap[k][0]) / (+colormap[k + 1][0] - colormap[k][0])
                        tuple[2] = +colormap[k][3] + (+colormap[k + 1][3] - colormap[k][3]) * (x - colormap[k][0]) / (+colormap[k + 1][0] - colormap[k][0])
                        break
                    }
                }
            }
            context.fillStyle = 'rgba(' + tuple[0] * 255 +
                ',' + tuple[1] * 255 +
                ',' + tuple[2] * 255 +
                ',' + tuple[3] * 255 + ')';
            context.fillRect(j, canvas.height - i, 1, 1);
        }
    }
    standardHistogramEqualization(div, example, colormap);
}

function drawOMCExample(example, div) {
    // load the colormap
    fetch("/static/data/colormap/omc.csv")
        .then(response => {
            if (!response.ok) {
                throw new Error('网络响应失败');
            }
            return response.text(); // 读取文件内容为文本
        })
        .then(data => {
            // console.log('文件内容:', data);
            let source_data = d3.csvParseRows(data)
            console.log("omc source_data", source_data);
            // render the colormap
            let colormap = [["V", "R", "G", "B"]]
            div.append("h3").text(example)
            for (let i = 1; i < source_data.length; i++) {
                let x = source_data[i][0].split(";")
                colormap.push([(i - 1) / 17, +x[1], +x[2], +x[3]])
                div.append("span").style("width", "20px")
                    .style("display", "inline-block")
                    .style("height", "20px")
                    .style("background-color", "rgba(" + colormap[i][1] * 255 + "," + colormap[i][2] * 255 + "," + colormap[i][3] * 255 + ",1)")
            }
            div.append("br")
            console.log(colormap);

            let width = colormap_width, height = colormap_height
            div.append("canvas").attr("id", example + "ColormapCanvasId")
                .attr("width", width).attr("height", height)
            let canvas = document.getElementById(example + "ColormapCanvasId")
            let context = canvas.getContext('2d');

            let colormap_data = []
            let offset = Math.floor(canvas.width / 6)
            for (let m = 0; m < 6; m++) {
                let rgb = [0, 0, 0]
                for (let j = 0; j < offset; j++) {
                    let jj = j / (offset - 1)
                    if (jj <= 0.5) {
                        rgb[0] = +colormap[m * 3 + 1][1] + (+colormap[m * 3 + 2][1] - colormap[m * 3 + 1][1]) * jj * 2
                        rgb[1] = +colormap[m * 3 + 1][2] + (+colormap[m * 3 + 2][2] - colormap[m * 3 + 1][2]) * jj * 2
                        rgb[2] = +colormap[m * 3 + 1][3] + (+colormap[m * 3 + 2][3] - colormap[m * 3 + 1][3]) * jj * 2
                    } else {
                        rgb[0] = +colormap[m * 3 + 2][1] + (+colormap[m * 3 + 3][1] - colormap[m * 3 + 2][1]) * (jj - 0.5) * 2
                        rgb[1] = +colormap[m * 3 + 2][2] + (+colormap[m * 3 + 3][2] - colormap[m * 3 + 2][2]) * (jj - 0.5) * 2
                        rgb[2] = +colormap[m * 3 + 2][3] + (+colormap[m * 3 + 3][3] - colormap[m * 3 + 2][3]) * (jj - 0.5) * 2
                    }
                    for (let i = 0; i < canvas.height; i++) {
                        context.fillStyle = 'rgba(' + rgb[0] * 255 +
                            ',' + rgb[1] * 255 +
                            ',' + rgb[2] * 255 +
                            ',' + 1 + ')';
                        context.fillRect(j + offset * m, i, 1, 1);
                    }
                    colormap_data.push(rgb.slice())
                }
            }
            console.log("colormap_data", colormap_data);


            // render the visualization
            let dataObj = data_arr[current_data_id]
            div.append("canvas").attr("id", example + "renderCanvasId").attr("width", dataObj.width).attr("height", dataObj.height).style("margin-left", "10px").attr("class", "exampleCanvas")
            canvas = document.getElementById(example + "renderCanvasId")
            context = canvas.getContext('2d');

            // calculate the range
            // let min_x = getScientificNumber(dataObj.extent[0]), max_x = getScientificNumber(dataObj.extent[1])
            // console.log(min_x, max_x);
            // let axis_values = []
            // if ((max_x[1] - min_x[1] + 1) <= 7) {
            //     for (let i = (6 + min_x[1] - max_x[1]); i > 0; i--) {
            //         axis_values.push([1, min_x[1] - i])
            //     }
            //     for (let i = min_x[1]; i <= max_x[1]; i++) {
            //         if (i == min_x[1])
            //             axis_values.push(min_x)
            //         else if (i == max_x[1]) {
            //             axis_values.push(max_x)
            //         } else {
            //             axis_values.push([1, i])
            //         }
            //     }
            //     console.log(axis_values);
            // } else {
            //     let scale = Math.floor((max_x[1] - min_x[1] + 1) / 6)
            //     for (let i = max_x[1]; i >= min_x[1]; i -= scale) {
            //         if (axis_values.length == 6)
            //             axis_values.unshift(min_x)
            //         else if (i == max_x[1]) {
            //             axis_values.unshift(max_x)
            //         } else {
            //             axis_values.unshift([1, i])
            //         }
            //     }
            //     console.log(axis_values);
            // }
            // axis_values = [[1, -5], [1, -4], [1, -3], [1, -2], [1, -1], [1, 0], [1, 1]]
            // axis_values = [[1, 0 / 6], [1, 1 / 6], [1, 2 / 6], [1, 3 / 6], [1, 4 / 6], [1, 5 / 6], [1, 1]]

            //traverse the image data
            for (let i = 0; i < canvas.height; i++) {
                for (let j = 0; j < canvas.width; j++) {
                    let tuple = [0, 0, 0, 1]
                    let scalar_value = dataObj.data[i][j]
                    if (isNaN(scalar_value)) {
                        tuple = [255, 255, 255, 1]
                    } else {
                        let x = (Math.log10(+scalar_value) + 5) / 6
                        tuple = colormap_data[Math.round(x * colormap_data.length)]
                        // for (let k = 0; k < axis_values.length - 1; k++) {
                        //     // let l = axis_values[k][0] * Math.pow(10, axis_values[k][1]),
                        //     //     r = axis_values[k + 1][0] * Math.pow(10, axis_values[k + 1][1])
                        //     let l = axis_values[k][1],
                        //         r = axis_values[k + 1][1]

                        //     if (x >= l && x <= r) {
                        //         x = (x - l) / (r - l)
                        //         if (x <= 0.5) {
                        //             tuple[0] = +colormap[k * 3 + 1][1] + (+colormap[k * 3 + 2][1] - colormap[k * 3 + 1][1]) * x * 2
                        //             tuple[1] = +colormap[k * 3 + 1][2] + (+colormap[k * 3 + 2][2] - colormap[k * 3 + 1][2]) * x * 2
                        //             tuple[2] = +colormap[k * 3 + 1][3] + (+colormap[k * 3 + 2][3] - colormap[k * 3 + 1][3]) * x * 2
                        //         } else {
                        //             tuple[0] = +colormap[k * 3 + 2][1] + (+colormap[k * 3 + 3][1] - colormap[k * 3 + 2][1]) * (x - 0.5) * 2
                        //             tuple[1] = +colormap[k * 3 + 2][2] + (+colormap[k * 3 + 3][2] - colormap[k * 3 + 2][2]) * (x - 0.5) * 2
                        //             tuple[2] = +colormap[k * 3 + 2][3] + (+colormap[k * 3 + 3][3] - colormap[k * 3 + 2][3]) * (x - 0.5) * 2
                        //         }
                        //     }
                        // }
                    }
                    context.fillStyle = 'rgba(' + tuple[0] * 255 +
                        ',' + tuple[1] * 255 +
                        ',' + tuple[2] * 255 +
                        ',' + 1 + ')';
                    context.fillRect(j, canvas.height - i, 1, 1);
                }
            }
        })
        .catch(error => {
            console.error('读取文件时出错:', error);
        });

}

function getScientificNumber(x) {
    let mantissa, exp = 0, tmp = x
    if (x < 0) tmp = Math.abs(x)
    if (x < 1) {
        while (tmp * 10 < 10) {
            exp -= 1
            tmp *= 10
        }
    } else {
        while (tmp / 10 > 1) {
            exp += 1
            tmp /= 10
        }
    }
    mantissa = tmp
    if (x < 0) {
        mantissa = -tmp
    }
    return [mantissa, exp]
}

// find control points for data
function histogramEqualization(div, example, colormap) {
    let dataObj = data_arr[current_data_id],
        data = dataObj.data,
        interval_num = colormap.length - 2,
        levels = [dataObj.extent[0]],
        idx = 0,
        bin_counts = [0]
    interval_num = dataObj.controlColors.length - 1
    let data_tmp = []
    for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < data[i].length; j++) {
            if (data[i][j] != 'NaN') {
                data_tmp.push(+data[i][j])
            }
        }
    }
    data_tmp.sort(function (a, b) { return a - b })
    // console.log(data_tmp);

    while (interval_num > 0) {
        let step = Math.floor((data_tmp.length - idx - 1) / interval_num)
        idx += step
        levels.push(data_tmp[idx])
        bin_counts.push(idx)
        interval_num -= 1
    }
    console.log(example, "HE", levels, bin_counts);

    // calculate the colormap
    let colormap_1000 = []
    if (1000 / (colormap.length - 1) > 1) {
        let step_num = Math.round(1000 / (colormap.length - 1))
        for (let i = 1; i < colormap.length - 1; i++) {
            for (let j = 0; j < step_num; j++) {
                let rgb = [0, 0, 0]
                rgb[0] = +colormap[i][1] + (+colormap[i + 1][1] - colormap[i][1]) * j / step_num
                rgb[1] = +colormap[i][2] + (+colormap[i + 1][2] - colormap[i][2]) * j / step_num
                rgb[2] = +colormap[i][3] + (+colormap[i + 1][3] - colormap[i][3]) * j / step_num
                colormap_1000.push(rgb)
            }
        }
        colormap_1000.push(colormap[colormap.length - 1].map(parseFloat).slice(1, 4))
    } else {
        colormap_1000 = colormap
    }
    // console.log("colormap_1000", colormap_1000)
    // new colormap for HE
    let colormap_HE = []
    let step_num = Math.floor(colormap_1000.length / (levels.length - 1))
    for (let i = 0; i < levels.length - 1; i++) {
        let pre_num = 10 * Math.floor(colormap_1000.length * (dataObj.controlPoints[i + 1] - dataObj.extent[0]) / (dataObj.extent[1] - dataObj.extent[0]))
        // resampling
        let new_step_num = step_num
        while (new_step_num < pre_num) {
            new_step_num *= 2
        }
        let inter_num = Math.floor(new_step_num / step_num)
        let tmp_colormap = []
        for (let j = 0; j < step_num - 1; j++) {
            for (let k = 0; k < inter_num; k++) {
                let rgb = [0, 0, 0]
                rgb[0] = colormap_1000[j + i * step_num][0] + (colormap_1000[j + 1 + i * step_num][0] - colormap_1000[j + i * step_num][0]) * k / inter_num
                rgb[1] = colormap_1000[j + i * step_num][1] + (colormap_1000[j + 1 + i * step_num][1] - colormap_1000[j + i * step_num][1]) * k / inter_num
                rgb[2] = colormap_1000[j + i * step_num][2] + (colormap_1000[j + 1 + i * step_num][2] - colormap_1000[j + i * step_num][2]) * k / inter_num
                tmp_colormap.push(rgb)
            }
        }
        for (let j = 0; j < pre_num; j++) {
            let idx = Math.floor(j / (pre_num - 1) * (tmp_colormap.length - 1))
            colormap_HE.push(tmp_colormap[idx])
        }
    }
    console.log("colormap_HE", colormap_HE)


    div.append("h3").text("Histogram Equalization:" + levels.join(", "))
    let width = colormap_width, height = colormap_height
    div.append("canvas").attr("id", example + "HEColormapCanvasId")
        .attr("width", width).attr("height", height)
    let canvas = document.getElementById(example + "HEColormapCanvasId")
    let context = canvas.getContext('2d');

    //traverse the image data
    let rgb = [0, 0, 0]
    for (let j = 0; j < canvas.width; j++) {
        let x = Math.floor(j / (canvas.width - 1) * (colormap_HE.length - 1))
        rgb = colormap_HE[x]

        for (let i = 0; i < canvas.height; i++) {
            context.fillStyle = 'rgba(' + rgb[0] * 255 +
                ',' + rgb[1] * 255 +
                ',' + rgb[2] * 255 +
                ',' + 1 + ')';
            context.fillRect(j, i, 1, 1);
        }
    }
    // render the visualization
    div.append("canvas").attr("id", example + "renderHECanvasId").attr("width", dataObj.width).attr("height", dataObj.height).style("margin-left", "10px").attr("class", "exampleCanvas")
    canvas = document.getElementById(example + "renderHECanvasId")
    context = canvas.getContext('2d');

    //traverse the image data
    for (let i = 0; i < canvas.height; i++) {
        for (let j = 0; j < canvas.width; j++) {
            let tuple = [0, 0, 0, 1]
            let scalar_value = dataObj.data[i][j]
            if (isNaN(scalar_value)) {
                tuple = [255, 255, 255, 1]
            } else {
                let x = (+scalar_value - dataObj.extent[0]) / (dataObj.extent[1] - dataObj.extent[0])
                tuple = colormap_HE[Math.floor(x * (colormap_HE.length - 1))]
            }
            context.fillStyle = 'rgba(' + tuple[0] * 255 +
                ',' + tuple[1] * 255 +
                ',' + tuple[2] * 255 +
                ',' + 1 + ')';
            context.fillRect(j, canvas.height - i, 1, 1);
        }
    }
}

function drawZellerColormap(div) {
    let example = "zeller"
    div.append("h3").text(example + ": hue-cycled rainbow")
    let width = 1277, height = colormap_height
    div.append("canvas").attr("id", example + "ColormapCanvasId")
        .attr("width", width).attr("height", height)
    let canvas = document.getElementById(example + "ColormapCanvasId")
    var context = canvas.getContext('2d');
    var image = new Image();
    image.onload = function () {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let imgData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
        d3.select("#" + example + "ColormapCanvasId").remove();

        width = colormap_width
        div.append("br")
        div.append("canvas").attr("id", example + "renderColormapCanvasId")
            .attr("width", width).attr("height", height)
        canvas = document.getElementById(example + "renderColormapCanvasId")
        context = canvas.getContext('2d');

        let colormap = [['V', 'R', 'G', 'B']]
        for (let j = 0; j < canvas.width; j++) {
            let w = Math.round(j / (canvas.width - 1) * 1276)
            w = (w >= 1276) ? 1275 : w
            let index = w * 4;
            colormap.push([j / (canvas.width - 1), imgData.data[index + 0] / 255, imgData.data[index + 1] / 255, imgData.data[index + 2] / 255])
            for (let i = 0; i < canvas.height; i++) {
                context.fillStyle = 'rgba(' + imgData.data[index + 0] +
                    ',' + imgData.data[index + 1] +
                    ',' + imgData.data[index + 2] +
                    ',' + 1 + ')';
                context.fillRect(j, i, 1, 1);
            }
        }

        // render the visualization
        let dataObj = data_arr[current_data_id]
        div.append("canvas").attr("id", example + "renderCanvasId").attr("width", dataObj.width).attr("height", dataObj.height).style("margin-left", "10px").attr("class", "exampleCanvas")
        canvas = document.getElementById(example + "renderCanvasId")
        context = canvas.getContext('2d');

        //traverse the image data
        for (let i = 0; i < canvas.height; i++) {
            for (let j = 0; j < canvas.width; j++) {
                let tuple = [0, 0, 0, 1]
                let scalar_value = dataObj.data[i][j]
                if (isNaN(scalar_value)) {
                    tuple = [255, 255, 255, 1]
                } else {
                    let x = (+scalar_value - dataObj.extent[0]) / (dataObj.extent[1] - dataObj.extent[0])
                    let index = Math.round(x * 1276) * 4
                    tuple[0] = imgData.data[index + 0]
                    tuple[1] = imgData.data[index + 1]
                    tuple[2] = imgData.data[index + 2]
                }
                context.fillStyle = 'rgba(' + tuple[0] +
                    ',' + tuple[1] +
                    ',' + tuple[2] +
                    ',' + tuple[3] + ')';
                context.fillRect(j, canvas.height - i, 1, 1);
            }
        }
        standardHistogramEqualization(div, example, colormap);
    };
    image.src = "/static/data/colormap/" + example + ".png";
}

function getRGB2LabExtent() {
    var l_extent = [10000, -10000],
        a_extent = [10000, -10000],
        b_extent = [10000, -10000]

    for (var r = 0; r <= 255; r++) {
        for (var g = 0; g <= 255; g++) {
            for (var b = 0; b <= 255; b++) {
                var rgb = d3.rgb(r, g, b)
                var lab = d3.lab(rgb)
                l_extent[0] = l_extent[0] > lab.L ? lab.L : l_extent[0]
                l_extent[1] = l_extent[1] < lab.L ? lab.L : l_extent[1]
                a_extent[0] = a_extent[0] > lab.a ? lab.a : a_extent[0]
                a_extent[1] = a_extent[1] < lab.a ? lab.a : a_extent[1]
                b_extent[0] = b_extent[0] > lab.b ? lab.b : b_extent[0]
                b_extent[1] = b_extent[1] < lab.b ? lab.b : b_extent[1]
            }
        }
    }
    console.log("lab range in rgb: ", l_extent, a_extent, b_extent);
}

function standardHistogramEqualization(div, example, colormap) {
    let dataObj = data_arr[current_data_id];
    let data = dataObj.data;

    // 1. 计算直方图
    let histogram = new Array(256).fill(0);
    let validPixels = 0;
    let data_values = [];

    // 收集有效数据
    for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < data[i].length; j++) {
            if (data[i][j] !== 'NaN') {
                let value = +data[i][j];
                data_values.push(value);
                let normalizedValue = Math.floor(255 * (value - dataObj.extent[0]) / (dataObj.extent[1] - dataObj.extent[0]));
                histogram[normalizedValue]++;
                validPixels++;
            }
        }
    }

    // 2. 计算CDF
    let cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + histogram[i];
    }

    // 3. 归一化CDF并计算新的控制点
    let newControlPoints = [];
    newControlPoints.push(dataObj.extent[0]); // 添加最小值

    for (let i = 1; i < dataObj.controlPoints.length - 1; i++) {
        let targetPercentile = i / (dataObj.controlPoints.length - 1);
        let targetCount = targetPercentile * validPixels;

        // 在CDF中找到最接近目标数量的位置
        let j = 0;
        while (j < 256 && cdf[j] < targetCount) {
            j++;
        }

        // 将索引转换回原始数据范围
        let value = dataObj.extent[0] + (j / 255) * (dataObj.extent[1] - dataObj.extent[0]);
        newControlPoints.push(value);
    }

    newControlPoints.push(dataObj.extent[1]); // 添加最大值

    console.log("newControlPoints", newControlPoints);
    let levels = newControlPoints


    // calculate the colormap
    let colormap_1000 = []
    if (1000 / (colormap.length - 1) > 1) {
        let step_num = Math.round(1000 / (colormap.length - 1))
        for (let i = 1; i < colormap.length - 1; i++) {
            for (let j = 0; j < step_num; j++) {
                let rgb = [0, 0, 0]
                rgb[0] = +colormap[i][1] + (+colormap[i + 1][1] - colormap[i][1]) * j / step_num
                rgb[1] = +colormap[i][2] + (+colormap[i + 1][2] - colormap[i][2]) * j / step_num
                rgb[2] = +colormap[i][3] + (+colormap[i + 1][3] - colormap[i][3]) * j / step_num
                colormap_1000.push(rgb)
            }
        }
        colormap_1000.push(colormap[colormap.length - 1].map(parseFloat).slice(1, 4))
    } else {
        colormap_1000 = colormap
    }
    // console.log("colormap_1000", colormap_1000)
    // new colormap for HE
    let colormap_HE = []
    let step_num = Math.floor(colormap_1000.length / (levels.length - 1))
    for (let i = 0; i < levels.length - 1; i++) {
        let pre_num = 1 * Math.floor(colormap_1000.length * (dataObj.controlPoints[i + 1] - dataObj.extent[0]) / (dataObj.extent[1] - dataObj.extent[0]))
        // resampling
        let new_step_num = step_num
        while (new_step_num < pre_num) {
            new_step_num *= 2
        }
        let inter_num = Math.floor(new_step_num / step_num)
        let tmp_colormap = []
        for (let j = 0; j < step_num - 1; j++) {
            for (let k = 0; k < inter_num; k++) {
                let rgb = [0, 0, 0]
                rgb[0] = colormap_1000[j + i * step_num][0] + (colormap_1000[j + 1 + i * step_num][0] - colormap_1000[j + i * step_num][0]) * k / inter_num
                rgb[1] = colormap_1000[j + i * step_num][1] + (colormap_1000[j + 1 + i * step_num][1] - colormap_1000[j + i * step_num][1]) * k / inter_num
                rgb[2] = colormap_1000[j + i * step_num][2] + (colormap_1000[j + 1 + i * step_num][2] - colormap_1000[j + i * step_num][2]) * k / inter_num
                tmp_colormap.push(rgb)
            }
        }
        for (let j = 0; j < pre_num; j++) {
            let idx = Math.floor(j / (pre_num - 1) * (tmp_colormap.length - 1))
            colormap_HE.push(tmp_colormap[idx])
        }
    }
    console.log("colormap_HE", colormap_HE)


    div.append("h3").text("Histogram Equalization:" + levels.join(", "))
    let width = colormap_width, height = colormap_height
    div.append("canvas").attr("id", example + "HEColormapCanvasId")
        .attr("width", width).attr("height", height)
    let canvas = document.getElementById(example + "HEColormapCanvasId")
    let context = canvas.getContext('2d');

    //traverse the image data
    let rgb = [0, 0, 0]
    for (let j = 0; j < canvas.width; j++) {
        let x = Math.floor(j / (canvas.width - 1) * (colormap_HE.length - 1))
        rgb = colormap_HE[x]

        for (let i = 0; i < canvas.height; i++) {
            context.fillStyle = 'rgba(' + rgb[0] * 255 +
                ',' + rgb[1] * 255 +
                ',' + rgb[2] * 255 +
                ',' + 1 + ')';
            context.fillRect(j, i, 1, 1);
        }
    }
    // render the visualization
    div.append("canvas").attr("id", example + "renderHECanvasId").attr("width", dataObj.width).attr("height", dataObj.height).style("margin-left", "10px").attr("class", "exampleCanvas")
    canvas = document.getElementById(example + "renderHECanvasId")
    context = canvas.getContext('2d');

    //traverse the image data
    for (let i = 0; i < canvas.height; i++) {
        for (let j = 0; j < canvas.width; j++) {
            let tuple = [0, 0, 0, 1]
            let scalar_value = dataObj.data[i][j]
            if (isNaN(scalar_value)) {
                tuple = [255, 255, 255, 1]
            } else {
                let x = (+scalar_value - dataObj.extent[0]) / (dataObj.extent[1] - dataObj.extent[0])
                tuple = colormap_HE[Math.floor(x * (colormap_HE.length - 1))]
            }
            context.fillStyle = 'rgba(' + tuple[0] * 255 +
                ',' + tuple[1] * 255 +
                ',' + tuple[2] * 255 +
                ',' + 1 + ')';
            context.fillRect(j, canvas.height - i, 1, 1);
        }
    }
}
histogramEqualization = standardHistogramEqualization

function updateExampleCanvas(startX, startY, rectWidth, rectHeight) {
    // 获取所有class为exampleCanvas的canvas
    let exampleCanvases = document.querySelectorAll('.exampleCanvas');
    exampleCanvases.forEach(canvas => {
        let context = canvas.getContext('2d');
        // 绘制红色边框
        context.strokeStyle = 'red';
        context.lineWidth = 2;
        context.strokeRect(startX - 2, startY - 2, rectWidth + 4, rectHeight + 4);

        // 创建一个新的canvas来显示放大的区域
        let zoomCanvas = document.createElement('canvas');
        zoomCanvas.width = rectWidth * 10;
        zoomCanvas.height = rectHeight * 10;
        document.getElementById('zoomDiv').appendChild(zoomCanvas);
        let zoomContext = zoomCanvas.getContext('2d');

        // 获取选定区域的图像数据并使用双线性插值放大，但不插值红色边框
        let imageData = context.getImageData(startX, startY, rectWidth, rectHeight);
        let zoomedImageData = zoomContext.createImageData(zoomCanvas.width, zoomCanvas.height);

        // 缩放比例
        const scaleX = rectWidth / zoomCanvas.width;
        const scaleY = rectHeight / zoomCanvas.height;

        for (let y = 0; y < zoomCanvas.height; y++) {
            for (let x = 0; x < zoomCanvas.width; x++) {
                // 计算原图中对应的坐标(可能是小数)
                let srcX = x * scaleX;
                let srcY = y * scaleY;

                // 获取周围四个像素的坐标
                let x1 = Math.floor(srcX);
                let x2 = Math.min(Math.ceil(srcX), rectWidth - 1);
                let y1 = Math.floor(srcY);
                let y2 = Math.min(Math.ceil(srcY), rectHeight - 1);

                // 计算权重
                let weightX = srcX - x1;
                let weightY = srcY - y1;

                // 获取周围四个像素的颜色值
                let index11 = (y1 * rectWidth + x1) * 4;
                let index12 = (y1 * rectWidth + x2) * 4;
                let index21 = (y2 * rectWidth + x1) * 4;
                let index22 = (y2 * rectWidth + x2) * 4;

                // 计算插值后的颜色值
                let zoomIndex = (y * zoomCanvas.width + x) * 4;
                for (let c = 0; c < 3; c++) { // 只插值RGB通道
                    let value =
                        imageData.data[index11 + c] * (1 - weightX) * (1 - weightY) +
                        imageData.data[index12 + c] * weightX * (1 - weightY) +
                        imageData.data[index21 + c] * (1 - weightX) * weightY +
                        imageData.data[index22 + c] * weightX * weightY;

                    zoomedImageData.data[zoomIndex + c] = Math.round(value);
                }
                zoomedImageData.data[zoomIndex + 3] = 255; // 保持alpha通道为不透明
            }
        }

        zoomContext.putImageData(zoomedImageData, 0, 0);
    });
}

function getHistogramEqualizationData(dataObj) {
    let data = dataObj.data;

    // 1. 计算直方图
    let histogram = new Array(256).fill(0);
    let validPixels = 0;
    let data_values = [];

    // 收集有效数据
    for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < data[i].length; j++) {
            if (data[i][j] !== 'NaN') {
                let value = +data[i][j];
                data_values.push(value);
                let normalizedValue = Math.floor(255 * (value - dataObj.extent[0]) / (dataObj.extent[1] - dataObj.extent[0]));
                histogram[normalizedValue]++;
                validPixels++;
            }
        }
    }

    // 2. 计算CDF
    let cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + histogram[i];
    }

    // 3. 归一化CDF并计算新的数据值
    let equalizedData = [];
    for (let i = 0; i < data.length; i++) {
        equalizedData[i] = [];
        for (let j = 0; j < data[i].length; j++) {
            if (data[i][j] !== 'NaN') {
                let value = +data[i][j];
                let normalizedValue = Math.floor(255 * (value - dataObj.extent[0]) / (dataObj.extent[1] - dataObj.extent[0]));
                let equalizedValue = dataObj.extent[0] + (cdf[normalizedValue] / validPixels) * (dataObj.extent[1] - dataObj.extent[0]);
                equalizedData[i].push(equalizedValue);
            } else {
                equalizedData[i].push('NaN');
            }
        }
    }

    return equalizedData;
}

function exportColormap(colormap) {
    if (colormap == null) {
        colormap = data_arr[current_data_id].getColormapArray();
    }
    var colorConversionFns = {
        RGB: function (c) {
            let c2 = d3.rgb(d3.lab(d3.hcl(c[0], c[1], c[2])));
            return [c2.r / 255.0, c2.g / 255.0, c2.b / 255.0]
        },
        Lab: function (c) {
            let c2 = d3.lab(d3.hcl(c[0], c[1], c[2]));
            return [c2.L, c2.a, c2.b]
        },
        HCL: function (c) {
            return c
        }
    };
    var resultsColorSpace = 'RGB'

    let colormapText = "V\tR\tG\tB\n";

    colormap.forEach((color, index) => {
        let v = (index / (colormap.length - 1)).toFixed(2);
        let colorConversionFn = colorConversionFns[resultsColorSpace];
        let rgb = colorConversionFn(color);
        let r = rgb[0].toFixed(2);
        let g = rgb[1].toFixed(2);
        let b = rgb[2].toFixed(2);
        colormapText += `${v}\t${r}\t${g}\t${b}\n`;
    });

    let blob = new Blob([colormapText], { type: 'text/plain' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'colormap.txt';
    a.textContent = 'Download Colormap';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
function findBestPalette() {
    d3.selectAll(".tmpExampleDiv").remove()
    let dataObj = data_arr[current_data_id];

    function findOne(id) {
        let preferredObj = simulatedAnnealing()
        dataObj.setControlColors(preferredObj.palette)

        let div = d3.select("body").append("div").attr("class", "tmpExampleDiv")

        // output
        div.append("br")
        div.append("span").text("score: " + preferredObj.score.toFixed(2))
        div.append("br")
        div.append("span").text("palette: " + JSON.stringify(preferredObj.palette))
        div.append("br")
        div.append("span").text("control points: " + JSON.stringify(dataObj.controlPoints))


        div.append("br")
        let data = dataObj.data, width = colormap_width, height = colormap_height
        //get context 
        div.append("canvas").attr("class", "colormap-origin").attr("id", "colormapCanvasId-origin" + id)
            .attr("width", width).attr("height", height)
        let canvas = document.getElementById("colormapCanvasId-origin" + id)
        let context = canvas.getContext('2d');

        //traverse the image data
        let step_num = 100
        let colormap = []
        for (let i = 0; i < dataObj.controlColors.length - 1; i++) {
            for (let j = 0; j < step_num; j++) {
                let hcl = [0, 0, 0]
                if (dataObj.controlColors[i + 1][0] < dataObj.controlColors[i][0])
                    hcl[0] = (dataObj.controlColors[i][0] + (dataObj.controlColors[i + 1][0] - dataObj.controlColors[i][0]) * j / step_num) % 360
                else
                    hcl[0] = (dataObj.controlColors[i][0] + (dataObj.controlColors[i + 1][0] - dataObj.controlColors[i][0] - 360) * j / step_num + 360) % 360
                hcl[1] = dataObj.controlColors[i][1] + (dataObj.controlColors[i + 1][1] - dataObj.controlColors[i][1]) * j / step_num
                hcl[2] = dataObj.controlColors[i][2] + (dataObj.controlColors[i + 1][2] - dataObj.controlColors[i][2]) * j / step_num
                colormap.push(hcl)
            }
        }
        let export_colormap = []
        for (let j = 0; j < canvas.width; j++) {
            let jj = Math.floor(j / (canvas.width - 1) * (colormap.length - 1))
            let hcl = colormap[jj]
            export_colormap.push(hcl.slice())
            let tuple = color2rgb(hcl)
            for (let i = 0; i < canvas.height; i++) {
                context.fillStyle = 'rgba(' + tuple[0] +
                    ',' + tuple[1] +
                    ',' + tuple[2] +
                    ',' + tuple[3] + ')';
                context.fillRect(j, i, 1, 1);
            }
        }
        div.append("a")
            .attr("href", "#")
            .text("Export")
            .on("click", function () {
                exportColormap(export_colormap);
            });

        width = dataObj.width, height = dataObj.height
        // 获取上下文
        div.append("canvas").attr("id", "tmprenderCanvasId" + id).attr("width", width).attr("height", height)
        canvas = document.getElementById("tmprenderCanvasId" + id)
        context = canvas.getContext('2d');

        // 遍历图像数据
        for (let i = 0; i < canvas.height; i++) {
            for (let j = 0; j < canvas.width; j++) {
                let tuple
                let scalar_value = data[i][j]
                if (isNaN(scalar_value)) {
                    tuple = [255, 255, 255, 1]
                } else {
                    tuple = dataObj.getColor(+scalar_value)
                }
                context.fillStyle = 'rgba(' + tuple[0] +
                    ',' + tuple[1] +
                    ',' + tuple[2] +
                    ',' + tuple[3] + ')';
                context.fillRect(j, canvas.height - i, 1, 1);
            }
        }

    }

    function drawNext(i) {
        if (i >= 10) return;
        initial_hue = getRandomIntInclusive(0, 360);
        findOne(i);
        console.log("********************find ", i, " done");
        setTimeout(() => drawNext(i + 1), 0);
    }
    drawNext(0);
}