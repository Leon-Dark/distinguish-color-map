function F_Open_dialog() {
    let file_btn = document.getElementById("fileLoad");
    file_btn.click();
}

d3.select('#fileLoad').on('change', function () {
    // 检查文件API支持
    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
        alert('该浏览器不完全支持文件API。');
        return;
    }

    let file = event.target.files[0];
    if (!file) {
        return;
    }

    let reader = new FileReader();
    reader.onload = function (e) {
        let content = e.target.result;
        let source_data = d3.csvParseRows(content.replace(/\t/g, ','));
        console.log("已读取文件数据:", source_data);

        d3.select("#statusId").style("display", "block")
        document.body.style.pointerEvents = 'none'; // 设置当前页面无法点击
        let data_obj = new DataObj(source_data);
        data_arr.push(data_obj);
        current_data_id = data_arr.length - 1;
        // renderCanvas(data_obj);
    };

    reader.onerror = function () {
        console.error('读取文件时出错');
    };

    // 开始读取文件
    reader.readAsText(file);

});

function selectExample(option) {
    if (option.value == "") return
    d3.select("#statusId").style("display", "block")
    document.body.style.pointerEvents = 'none'; // 设置当前页面无法点击
    let data_path = ""
    if (option.value == 0) {
        data_path = "/static/data/D15.txt"
    } else if (option.value == 1) {
        data_path = "/static/data/ID_0050_AGE_0074_CONTRAST_0_CT.txt"
    } else if (option.value == 2) {
        data_path = "/static/data/TLC trip.txt"
    } else if (option.value == 3) {
        data_path = "/static/data/HR_diagram.txt"
    }
    fetch(data_path)
        .then(response => {
            if (!response.ok) {
                throw new Error('网络响应失败');
            }
            return response.text(); // 读取文件内容为文本
        })
        .then(data => {
            // console.log('文件内容:', data);
            let source_data = d3.csvParseRows(data.replace(/\t/g, ','))
            // console.log("source_data", source_data);
            let data_obj = new DataObj(source_data)
            data_arr.push(data_obj)
            current_data_id = data_arr.length - 1
            // renderCanvas(data_obj)
            // drawAllExamples()
        })
        .catch(error => {
            console.error('读取文件时出错:', error);
        });
}

function setAttrPalette(palette) {
    //output the palette
    var data_palette_attr = "";
    for (let i = 0; i < palette.length - 1; i++) {
        data_palette_attr += palette[i] + ";";
    }
    data_palette_attr += palette[palette.length - 1];
    return data_palette_attr
}

function addToHistory() {
    // 从内容容器中选择 canvas
    let canvas = d3.select(".colormap-content").select("canvas");
    if (canvas.empty()) return;
    
    let li = d3.select(".historyDiv").append("div")
        .attr("data-id", current_data_id)
        .attr("data-palette", setAttrPalette(data_arr[current_data_id].controlColors))
        .style('cursor', 'pointer')
        .style("white-space", "nowrap")
        .on("click", function () {
            // 点击历史记录：恢复数据并重绘
            
            // 1. 将当前的 Colormap 先存入历史 (可选，这里保留逻辑)
            addToHistory();
            
            // 2. 恢复数据
            current_data_id = +d3.select(this).attr("data-id")
            let palette = d3.select(this).attr('data-palette').split(';');
            palette = palette.map(function (d) {
                let dd = d.split(',')
                return [+dd[0], +dd[1], +dd[2]]
            })
            
            data_arr[current_data_id].setControlColors(palette)
            
            // 3. 重绘所有面板
            // 注意：drawControlPoints 在 drawOriginalColormap 内部被调用（或者代码合并了）
            // 所以这里主要调用 drawOriginalColormap
            drawOriginalColormap(data_arr[current_data_id])
            drawColorWheel(data_arr[current_data_id])
            
            // 根据当前视图模式更新渲染
            if (typeof renderViewMode !== 'undefined' && renderViewMode === '3d') {
                renderLab3D(data_arr[current_data_id])
            } else {
                renderCanvas(data_arr[current_data_id])
            }
            
            // 4. 移除该历史条目
            d3.select(this).remove();
        });

    // append delete sign
    li.append("i").attr("class", "icon_trash").style("color", "black").on("click", function () {
        li.remove();
        d3.event.stopPropagation()
    });

    // append render result
    // 将当前的 canvas 移动到历史记录里
    li.node().appendChild(canvas.node());
}

function generateColormap() {
    // move the previous colormap to the history
    addToHistory()

    let preferredObj = simulatedAnnealing()
    data_arr[current_data_id].setControlColors(preferredObj.palette)

    drawColormap(data_arr[current_data_id])
    drawControlPoints(data_arr[current_data_id])
    drawColorWheel(data_arr[current_data_id])
    
    // 根据当前视图模式更新渲染
    if (typeof renderViewMode !== 'undefined' && renderViewMode === '3d') {
        renderLab3D(data_arr[current_data_id])
    } else {
        renderCanvas(data_arr[current_data_id])
    }
    // findBestPalette()
}


function downloadColormap(option) {
    let dataObj = data_arr[current_data_id]
    let colormapText = "V\tR\tG\tB\n";

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

    if (option.value == "") return
    if (option.value == 0) {
        colormapText = "V\tH\tC\tL\n";
        let export_colormap = dataObj.controlColors
        export_colormap.forEach((color, index) => {
            let v = dataObj.controlPoints[index]
            let r = color[0].toFixed(0);
            let g = color[1].toFixed(0);
            let b = color[2].toFixed(0);
            colormapText += `${v}\t${r}\t${g}\t${b}\n`;
        });
    } else if (option.value == 1) {
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
        for (let j = 0; j < colormap_width; j++) {
            let jj = Math.floor(j / (colormap_width - 1) * (colormap.length - 1))
            let hcl = colormap[jj]
            export_colormap.push(hcl.slice())
        }
        var resultsColorSpace = 'RGB'
        colormapText = "V\tR\tG\tB\n";
        export_colormap.forEach((color, index) => {
            let v = (index / (export_colormap.length - 1)).toFixed(2);
            let colorConversionFn = colorConversionFns[resultsColorSpace];
            let rgb = colorConversionFn(color);
            let r = rgb[0].toFixed(2);
            let g = rgb[1].toFixed(2);
            let b = rgb[2].toFixed(2);
            colormapText += `${v}\t${r}\t${g}\t${b}\n`;
        });
    } else if (option.value == 2) {
        let export_colormap = dataObj.getColormapArray()
        var resultsColorSpace = 'RGB'
        colormapText = "V\tR\tG\tB\n";
        export_colormap.forEach((color, index) => {
            let v = (index / (export_colormap.length - 1)).toFixed(2);
            let colorConversionFn = colorConversionFns[resultsColorSpace];
            let rgb = colorConversionFn(color);
            let r = rgb[0].toFixed(2);
            let g = rgb[1].toFixed(2);
            let b = rgb[2].toFixed(2);
            colormapText += `${v}\t${r}\t${g}\t${b}\n`;
        });
    }

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

    // 重置select选择框到默认选项
    option.value = "";
}

function selectControlPointsNumber(num) {
    d3.select("#statusId").style("display", "block")
    document.body.style.pointerEvents = 'none'; // 设置当前页面无法点击
    let data_obj = new DataObj(data_arr[current_data_id].data, num)
    data_arr.push(data_obj)
    current_data_id = data_arr.length - 1

}