function renderCanvas(dataObj) {
    let data = dataObj.data, width = dataObj.width, height = dataObj.height

    // 移除 empty-state（如果存在）
    d3.select(".canvasDiv .empty-state").remove();
    
    // 获取上下文
    d3.select(".canvasDiv").selectAll("canvas").remove()
    d3.select(".canvasDiv").append("canvas").attr("id", "renderCanvasId-" + render_canvas_id).attr("width", width).attr("height", height)
    let canvas = document.getElementById("renderCanvasId-" + render_canvas_id)
    render_canvas_id++
    let context = canvas.getContext('2d');

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
            // Y 轴翻转以匹配数据坐标系
            context.fillRect(j, canvas.height - 1 - i, 1, 1);
        }
    }

    // 鼠标交互逻辑
    let isDrawing = false;
    let startX, startY;
    let pre_imageData = context.getImageData(0, 0, canvas.width, canvas.height); // 保存之前的像素

    canvas.addEventListener('mousedown', function (e) {
        isDrawing = true;
        startX = e.offsetX;
        startY = e.offsetY;
    });

    canvas.addEventListener('mousemove', function (e) {
        if (isDrawing) {
            let currentX = e.offsetX;
            let currentY = e.offsetY;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.putImageData(pre_imageData, 0, 0); // 重新绘制之前的像素
            context.strokeStyle = 'red';
            context.lineWidth = 2; // 调整红色边框的粗细
            context.strokeRect(startX, startY, currentX - startX, currentY - startY);
        }
    });

    canvas.addEventListener('mouseup', function (e) {
        if (isDrawing) {
            isDrawing = false;
            let endX = e.offsetX;
            let endY = e.offsetY;
            let rectWidth = endX - startX - 4;
            let rectHeight = endY - startY - 4;

            // 创建一个新的canvas来显示放大的区域
            let zoomCanvas = document.createElement('canvas');
            zoomCanvas.width = rectWidth * 10;
            zoomCanvas.height = rectHeight * 10;
            document.body.appendChild(zoomCanvas);
            let zoomContext = zoomCanvas.getContext('2d');

            // 获取选定区域的图像数据并使用双线性插值放大
            let imageData = context.getImageData(startX + 2, startY + 2, rectWidth, rectHeight);
            let zoomedImageData = zoomContext.createImageData(zoomCanvas.width, zoomCanvas.height);

            // 缩放比例
            const scaleX = rectWidth / zoomCanvas.width;
            const scaleY = rectHeight / zoomCanvas.height;

            for (let y = 0; y < zoomCanvas.height; y++) {
                for (let x = 0; x < zoomCanvas.width; x++) {
                    let srcX = x * scaleX;
                    let srcY = y * scaleY;

                    let x1 = Math.floor(srcX);
                    let x2 = Math.min(Math.ceil(srcX), rectWidth - 1);
                    let y1 = Math.floor(srcY);
                    let y2 = Math.min(Math.ceil(srcY), rectHeight - 1);

                    let weightX = srcX - x1;
                    let weightY = srcY - y1;

                    let index11 = (y1 * rectWidth + x1) * 4;
                    let index12 = (y1 * rectWidth + x2) * 4;
                    let index21 = (y2 * rectWidth + x1) * 4;
                    let index22 = (y2 * rectWidth + x2) * 4;

                    let zoomIndex = (y * zoomCanvas.width + x) * 4;
                    for (let c = 0; c < 3; c++) {
                        let value =
                            imageData.data[index11 + c] * (1 - weightX) * (1 - weightY) +
                            imageData.data[index12 + c] * weightX * (1 - weightY) +
                            imageData.data[index21 + c] * (1 - weightX) * weightY +
                            imageData.data[index22 + c] * weightX * weightY;

                        zoomedImageData.data[zoomIndex + c] = Math.round(value);
                    }
                    zoomedImageData.data[zoomIndex + 3] = 255;
                }
            }

            zoomContext.putImageData(zoomedImageData, 0, 0);
            updateExampleCanvas(startX + 2, startY + 2, rectWidth, rectHeight)
        }
    });
    
    // 如果当前是 3D 模式，隐藏 canvas
    if (typeof renderViewMode !== 'undefined' && renderViewMode === '3d') {
        d3.select(canvas).style("display", "none");
    }
}

function updateCanvas() {
    if (current_data_id === undefined || !data_arr[current_data_id]) return;
    
    let dataObj = data_arr[current_data_id];
    let data = dataObj.data;
    
    //get context 
    let canvas = d3.select(".canvasDiv").select("canvas").node()
    if (!canvas) return;
    
    let context = canvas.getContext('2d');
    let width = canvas.width;
    let height = canvas.height;
    
    // 性能优化：预计算 Colormap 的 RGB 查找表
    // 避免在 25万次循环中调用 d3.color 转换
    let colormapRGB = dataObj.colormap.map(hcl => {
        let rgb = color2rgb(hcl);
        return [Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2]), 255];
    });
    
    let extent = dataObj.extent;
    let min = extent[0];
    let range = extent[1] - extent[0];
    let colormapLen = colormapRGB.length;

    // 使用 ImageData 优化渲染性能
    let imageData = context.createImageData(width, height);
    let pixels = imageData.data;
    
    // traverse the image data
    for (let i = 0; i < height; i++) { // data 行
        for (let j = 0; j < width; j++) { // data 列
            let scalar_value = data[i][j];
            let r, g, b, a;
            
            if (isNaN(scalar_value)) {
                r = 255; g = 255; b = 255; a = 255;
            } else {
                // 快速查表
                let id = Math.floor((scalar_value - min) / range * (colormapLen - 1));
                if (id < 0) id = 0;
                if (id >= colormapLen) id = colormapLen - 1;
                
                let color = colormapRGB[id];
                r = color[0];
                g = color[1];
                b = color[2];
                a = color[3];
            }
            
            // Y 轴翻转以匹配数据坐标系
            let y = height - 1 - i;
            let index = (y * width + j) * 4;
            pixels[index] = r;
            pixels[index + 1] = g;
            pixels[index + 2] = b;
            pixels[index + 3] = a;
        }
    }
    
    context.putImageData(imageData, 0, 0);
    
    // 如果当前处于 3D 模式，同步更新 3D 视图
    if (renderViewMode === '3d') {
        renderLab3D(dataObj);
    }
}

// 视图模式状态
let renderViewMode = '2d';
let lab3dYaw = 0.8;        // 调整初始角度，更好地展示 L 轴
let lab3dPitch = 0.5;      // 调整俯视角度

function switchRenderView(mode) {
    renderViewMode = mode;
    
    // Toggle active class
    d3.selectAll(".tab-btn").classed("active", false);
    d3.select("#btn-view-" + mode).classed("active", true);
    
    if (mode === '2d') {
        d3.select(".canvasDiv canvas").style("display", "block");
        // 恢复 empty-state 的显示状态（如果没有数据）
        if (current_data_id === undefined) {
            d3.select(".canvasDiv .empty-state").style("display", "flex");
        } else {
            d3.select(".canvasDiv .empty-state").style("display", "none");
        }
        d3.select("#lab3d-container").remove(); // 完全移除，避免干扰
    } else {
        d3.select(".canvasDiv canvas").style("display", "none");
        d3.select(".canvasDiv .empty-state").remove(); // 完全移除而不是隐藏
        
        let container = d3.select("#lab3d-container");
        if (container.empty()) {
            container = d3.select(".canvasDiv").append("div")
                .attr("id", "lab3d-container")
                .attr("class", "lab-3d-container")
                .style("width", "100%")
                .style("height", "100%")
                .style("display", "block");
        }
        
        // 即使没有数据，也渲染坐标轴
        let data = (current_data_id !== undefined && data_arr[current_data_id]) ? data_arr[current_data_id] : null;
        renderLab3D(data);
    }
}

function renderLab3D(dataObj) {
    let container = d3.select("#lab3d-container");
    if (container.empty()) return;
    
    // 强制获取父容器尺寸，确保非零
    let parentNode = container.node().parentNode;
    let width = parentNode ? parentNode.clientWidth : 500;
    let height = parentNode ? parentNode.clientHeight : 500;
    
    // 确保最小尺寸
    width = Math.max(width, 300);
    height = Math.max(height, 300);
    
    // 调整缩放：Lab 空间 L:0-100, a/b:-100~100（实际可显示范围）
    let scale = Math.min(width, height) / 250; // 增大缩放
    
    // 投影函数：将 (L, a, b) 转换为屏幕坐标 (x, y)
    function project(l, a, b) {
        // 中心化：L: 0-100 -> -50-50（垂直），a,b: -100-100 -> 相对原点
        let x = a;       // a 轴 -> X
        let y = l - 50;  // L 轴 -> Y (垂直，中心在 L=50)
        let z = b;       // b 轴 -> Z
        
        // 绕 Y 轴旋转 (Yaw)
        let x1 = x * Math.cos(lab3dYaw) - z * Math.sin(lab3dYaw);
        let z1 = x * Math.sin(lab3dYaw) + z * Math.cos(lab3dYaw);
        
        // 绕 X 轴旋转 (Pitch)
        let y2 = y * Math.cos(lab3dPitch) - z1 * Math.sin(lab3dPitch);
        let z2 = y * Math.sin(lab3dPitch) + z1 * Math.cos(lab3dPitch);
        
        // 屏幕投影
        let sx = width / 2 + x1 * scale;
        let sy = height / 2 - y2 * scale; // Y 轴翻转
        
        return [sx, sy, z2]; // 返回 z2 用于深度排序
    }
    
    container.selectAll("*").remove();
    
    // 背景提示
    container.style("background", "#f5f5f5").style("border", "1px solid #ddd");
    
    let svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", "#fff")
        .call(d3.drag().on("drag", function() {
            lab3dYaw -= d3.event.dx * 0.01;  // 反转水平旋转方向
            lab3dPitch += d3.event.dy * 0.01;
            // 限制 Pitch 角度防止翻转
            lab3dPitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, lab3dPitch));
            renderLab3D(dataObj);
        }));
    
    // 检测数据质量
    let lowChroma = false;
    if (dataObj && dataObj.controlColors) {
        let avgChroma = dataObj.controlColors.reduce((sum, c) => sum + c[1], 0) / dataObj.controlColors.length;
        lowChroma = avgChroma < 5; // Chroma 低于 5 认为是低彩度
    }
        
    // 定义坐标轴（在合理的位置）
    let axes = [
        { start: [50, -100, 0], end: [50, 100, 0], color: "#e74c3c", label: "a (green↔red)", width: 2 },   // a-axis 在 L=50, b=0
        { start: [50, 0, -100], end: [50, 0, 100], color: "#3498db", label: "b (blue↔yellow)", width: 2 }, // b-axis 在 L=50, a=0
        { start: [0, 0, 0], end: [100, 0, 0], color: "#2c3e50", label: "L (lightness)", width: 2.5 }       // L-axis 在 a=0, b=0
    ];
    
    // 色域边界框（简化为立方体，实际 sRGB 色域更复杂）
    let boundingBox = [
        // L=0 平面（黑色底面）
        { p1: [0, -80, -80], p2: [0, 80, -80] },
        { p1: [0, 80, -80], p2: [0, 80, 80] },
        { p1: [0, 80, 80], p2: [0, -80, 80] },
        { p1: [0, -80, 80], p2: [0, -80, -80] },
        // L=100 平面（白色顶面）
        { p1: [100, -80, -80], p2: [100, 80, -80] },
        { p1: [100, 80, -80], p2: [100, 80, 80] },
        { p1: [100, 80, 80], p2: [100, -80, 80] },
        { p1: [100, -80, 80], p2: [100, -80, -80] },
        // 垂直边
        { p1: [0, -80, -80], p2: [100, -80, -80] },
        { p1: [0, 80, -80], p2: [100, 80, -80] },
        { p1: [0, 80, 80], p2: [100, 80, 80] },
        { p1: [0, -80, 80], p2: [100, -80, 80] }
    ];
    
    // 准备绘制数据
    let elements = [];
    
    // 1. 色域边界框（浅灰色虚线）
    boundingBox.forEach(edge => {
        let pp1 = project(edge.p1[0], edge.p1[1], edge.p1[2]);
        let pp2 = project(edge.p2[0], edge.p2[1], edge.p2[2]);
        elements.push({ 
            type: 'line', 
            x1: pp1[0], y1: pp1[1], 
            x2: pp2[0], y2: pp2[1], 
            z: (pp1[2] + pp2[2]) / 2, 
            color: "#ddd", 
            width: 0.5, 
            dash: "2,2" 
        });
    });
    
    // 2. 坐标轴
    axes.forEach(axis => {
        let p1 = project(axis.start[0], axis.start[1], axis.start[2]);
        let p2 = project(axis.end[0], axis.end[1], axis.end[2]);
        elements.push({ 
            type: 'line', 
            x1: p1[0], y1: p1[1], 
            x2: p2[0], y2: p2[1], 
            z: (p1[2] + p2[2]) / 2, 
            color: axis.color, 
            width: axis.width 
        });
        
        // 轴标签
        elements.push({ 
            type: 'text', 
            x: p2[0], 
            y: p2[1], 
            z: p2[2], 
            text: axis.label.split(' ')[0], // 只取第一个字符
            color: axis.color,
            size: "11px",
            bold: true
        });
    });
    
    if (dataObj) {
        // 3. 初始轨迹 (虚线)
        if (dataObj.initialControlColors) {
            let initPoints = dataObj.getColormapArrayLab(dataObj.initialControlColors);
            // 降采样以提高性能
            let step = Math.max(1, Math.floor(initPoints.length / 200));
            for (let i = 0; i < initPoints.length - step; i += step) {
                // initPoints[i] = [L, a, b] 数组，直接使用
                let p1 = project(initPoints[i][0], initPoints[i][1], initPoints[i][2]);
                let p2 = project(initPoints[i + step][0], initPoints[i + step][1], initPoints[i + step][2]);
                elements.push({ 
                    type: 'line', 
                    x1: p1[0], y1: p1[1], 
                    x2: p2[0], y2: p2[1], 
                    z: (p1[2] + p2[2]) / 2, 
                    color: "#bbb", 
                    width: 1.5, 
                    dash: "4,2" 
                });
            }
        }
        
        // 4. 当前轨迹 (实线 + 真实颜色)
        if (dataObj.colormap) {
            let currentPoints = dataObj.getColormapArrayLab();
            let colormapHCL = dataObj.colormap;
            
            // 降采样
            let step = Math.max(1, Math.floor(currentPoints.length / 200));
            for (let i = 0; i < currentPoints.length - step; i += step) {
                // currentPoints[i] = [L, a, b] 数组，直接使用
                let p1 = project(currentPoints[i][0], currentPoints[i][1], currentPoints[i][2]);
                let p2 = project(currentPoints[i + step][0], currentPoints[i + step][1], currentPoints[i + step][2]);
                
                // 使用实际颜色
                let color = "#333";
                if (colormapHCL[i]) {
                    color = d3.hcl(colormapHCL[i][0], colormapHCL[i][1], colormapHCL[i][2]).toString();
                }
                elements.push({ 
                    type: 'line', 
                    x1: p1[0], y1: p1[1], 
                    x2: p2[0], y2: p2[1], 
                    z: (p1[2] + p2[2]) / 2, 
                    color: color, 
                    width: 2.5 
                });
            }
        }
        
        // 5. 控制点（关键节点）
        if (dataObj.controlColors) {
            for (let i = 0; i < dataObj.controlColors.length; i++) {
                let hcl = dataObj.controlColors[i];
                // 基本验证：确保 HCL 数组有效
                if (!hcl || hcl.length < 3) continue;
                
                let lab = d3.lab(d3.hcl(hcl[0], hcl[1], hcl[2]));
                
                // D3 v4 使用大写 L
                let p = project(lab.L, lab.a, lab.b);
                
                elements.push({ 
                    type: 'circle', 
                    x: p[0], y: p[1], 
                    z: p[2], 
                    r: 5, 
                    color: "#000", 
                    fill: d3.hcl(hcl[0], hcl[1], hcl[2]).toString(),
                    strokeWidth: 1.5
                });
            }
        }
    }

    // 深度排序 (Painter's Algorithm)
    elements.sort((a, b) => a.z - b.z);
    
    // 渲染
    elements.forEach(el => {
        if (el.type === 'line') {
            let line = svg.append("line")
                .attr("x1", el.x1).attr("y1", el.y1)
                .attr("x2", el.x2).attr("y2", el.y2)
                .style("stroke", el.color)
                .style("stroke-width", el.width);
            if (el.dash) line.style("stroke-dasharray", el.dash);
        } else if (el.type === 'text') {
            svg.append("text")
                .attr("x", el.x).attr("y", el.y)
                .text(el.text)
                .style("fill", el.color)
                .style("font-size", el.size || "11px")
                .style("font-weight", el.bold ? "bold" : "normal")
                .style("text-anchor", "middle");
        } else if (el.type === 'circle') {
             svg.append("circle")
                .attr("cx", el.x).attr("cy", el.y)
                .attr("r", el.r)
                .style("stroke", el.color)
                .style("stroke-width", el.strokeWidth || 1)
                .style("fill", el.fill);
        }
    });
    
    // 添加说明
    svg.append("text")
        .attr("x", 10).attr("y", 20)
        .text("Lab Color Space | Drag to Rotate")
        .style("font-size", "12px").style("fill", "#555").style("font-weight", "600");
    
    if (dataObj && dataObj.initialControlColors) {
        svg.append("text")
            .attr("x", 10).attr("y", 35)
            .text("■ Current  ┄┄ Initial")
            .style("font-size", "10px").style("fill", "#999");
    }
    
    // 低彩度提示
    if (lowChroma) {
        svg.append("text")
            .attr("x", width / 2).attr("y", height - 20)
            .text("⚠ Low chroma detected. Use 'Generate Colormap' or drag control points to add color saturation.")
            .style("font-size", "10px").style("fill", "#e74c3c").style("text-anchor", "middle");
    }
}

function scaleValue(x, extent, target) {
    return (x - extent[0]) * (target[1] - target[0]) / (extent[1] - extent[0]) + target[0]
}

function drawColormap(dataObj) {
    drawOriginalColormap(dataObj)
    return
    let width = colormap_width, height = colormap_height
    //get context 
    d3.select(".colormapDiv").append("canvas").attr("class", "colormap").attr("id", "colormapCanvasId-" + colormap_canvas_id)
        .attr("width", width).attr("height", height).style("marin-top", "10px")
    let canvas = document.getElementById("colormapCanvasId-" + colormap_canvas_id)
    colormap_canvas_id++
    let context = canvas.getContext('2d');

    //traverse the image data
    for (let j = 0; j < canvas.width; j++) {
        let jj = Math.floor(j / (canvas.width - 1) * (dataObj.colormap.length - 1))
        let hcl = dataObj.colormap[jj]
        let tuple = color2rgb(hcl)
        for (let i = 0; i < canvas.height; i++) {
            context.fillStyle = 'rgba(' + tuple[0] +
                ',' + tuple[1] +
                ',' + tuple[2] +
                ',' + tuple[3] + ')';
            context.fillRect(j, i, 1, 1);
        }
    }

}

function updateColormap() {
    return
    let canvas = d3.select(".colormapDiv").select("canvas.colormap").node()
    let context = canvas.getContext('2d');
    // console.log("update canvas", canvas.width, canvas.height);

    //traverse the image data
    for (let j = 0; j < canvas.width; j++) {
        let jj = Math.floor(j / (canvas.width - 1) * (data_arr[current_data_id].colormap.length - 1))
        let hcl = data_arr[current_data_id].colormap[jj]
        let tuple = color2rgb(hcl)
        for (let i = 0; i < canvas.height; i++) {
            context.fillStyle = 'rgba(' + tuple[0] +
                ',' + tuple[1] +
                ',' + tuple[2] +
                ',' + tuple[3] + ')';
            context.fillRect(j, i, 1, 1);
        }
    }
}

function drawControlPoints(dataObj) {
    return
    let controlPoints = dataObj.controlPoints, controlColors = dataObj.controlColors
    d3.select(".colormapDiv").selectAll("svg.controlPoints").remove()
    // draw control point position
    let svg = d3.select(".colormapDiv").append("svg").attr("class", "controlPoints")
        .style("width", "380px").style("height", "30px")
        .style("background-color", "#fff").style("display", "inline-block").style("margin-top", "-5px")
    let range = controlPoints[controlPoints.length - 1] - controlPoints[0]

    var drag = d3.drag()
        .on("start", dragStart)
        .on("end", dragEnd)
        .on("drag", dragMove);

    function dragStart() {
        last_coords = d3.mouse(this);
    }

    function dragMove() {
        var coords = d3.mouse(this);
        var id = +d3.select(this).attr("id").split("_")[1]
        if (id === 0 || id == controlPoints.length - 1) return
        var offset = [coords[0] - last_coords[0], coords[1] - last_coords[1]];
        // console.log(coords);
        let curr_x = +d3.select(this).attr("cx")
        if ((curr_x + offset[0]) > (colormap_width * (controlPoints[id - 1] - controlPoints[0]) / range + 10) && (curr_x + offset[0]) < (colormap_width * (controlPoints[id + 1] - controlPoints[0]) / range + 10)) {
            d3.select(this)
                .attr("cx", curr_x + offset[0])
                .attr("cy", +d3.select(this).attr("cy"));
            svg.select("#controlLine-" + id)
                .attr("x1", curr_x + offset[0])
                .attr("y1", 0)
                .attr("x2", curr_x + offset[0])
                .attr("y2", 10)
        }

        last_coords = coords;
    }

    function dragEnd() {
        // update the colormap
        var id = +d3.select(this).attr("id").split("_")[1]
        if (id === 0 || id == controlPoints.length - 1) return
        controlPoints[id] = (+d3.select(this).attr("cx") - 10) * range / colormap_width + controlPoints[0]

        dataObj.colormap = dataObj.getColormapArray()
        updateColormap()
        updateCanvas()
    }

    for (let i = 0; i < controlColors.length; i++) {
        let x = colormap_width * (controlPoints[i] - controlPoints[0]) / range + 10
        svg.append("line")
            .style("stroke", "black").style("stroke-width", 1)
            .attr("x1", x)
            .attr("y1", 0)
            .attr("x2", x)
            .attr("y2", 10)
            .attr("id", "controlLine-" + i)
        // draw control colors
        svg.append("circle")
            .attr("r", 10)
            .attr("cx", x)
            .attr("cy", 20)
            .attr("fill", d3.rgb(color2Lab(controlColors[i])))
            .attr("id", "controlPoints_" + i)
            .call(drag)
    }
}

function isClockwise(hue1, hue2) {
    // 计算两个色相的差值
    const diff = (hue2 - hue1 + 360) % 360;

    // 判断方向：如果差值在0到180度之间，则为顺时针方向
    return diff > 0 && diff <= 180;
}
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

function drawColorWheel(dataObj) {
    // 优先使用新的 .control-content 容器
    let container = d3.select(".control-content");
    let infoContainer = d3.select(".control-info");
    
    // 兼容性：如果HTML结构未更新，回退到旧模式
    if (container.empty()) {
        let mainDiv = d3.select(".controlDiv");
        mainDiv.selectAll("*").remove();
        mainDiv.append("h3").text("Color Wheel Control");
        mainDiv.append("hr");
        container = mainDiv; // 这种情况下 container 就是 mainDiv
        
        // 在旧模式下，我们需要手动创建 infoContainer 并追加到 mainDiv
        infoContainer = mainDiv.append("div").attr("class", "control-info")
            .style("background", "#f8f9fa").style("border-radius", "4px").style("margin-top", "10px").style("border", "1px solid #eee");
    } else {
        // 新模式：只清空内容容器
        container.selectAll("*").remove();
    }
    
    let controlColors = dataObj.controlColors
    let control_colors = controlColors
    // 内部逻辑坐标系保持 300x300 不变
    let m_SVGWIDTH = 300,
        m_SVGHEIGHT = 300
    
    // 防抖更新大图
    const debouncedUpdateCanvas = debounce(() => {
        dataObj.colormap = dataObj.getColormapArray()
        updateCanvas()
    }, 50);
    
    // 更新信息面板的函数
    function updateInfoPanel(id) {
        const hcl = control_colors[id];
        const rgb = d3.rgb(color2Lab(hcl));
        const hex = rgb.toString();
        
        // 直接更新 infoContainer 的内容
        infoContainer.html(`
            <div style="padding: 10px 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                <div style="display: flex; align-items: center;">
                    <span style="display: inline-block; width: 12px; height: 12px; background: ${hex}; border-radius: 50%; margin-right: 8px; border: 1px solid rgba(0,0,0,0.1);"></span>
                    <strong style="font-size: 0.9rem;">Point ${id + 1}</strong>
                </div>
                <div style="text-align: right;">
                    <span style="font-family: monospace; font-size: 0.8rem; background: #eee; padding: 2px 6px; border-radius: 3px; color: #555;">${hex.toUpperCase()}</span>
                </div>
                
                <div style="grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; border-top: 1px solid #eee; padding-top: 8px; margin-top: 5px;">
                    <div style="text-align: center;">
                        <div style="color: #999; font-size: 0.7rem; margin-bottom: 2px;">Hue</div>
                        <div style="font-weight: 600;">${Math.round(hcl[0])}°</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="color: #999; font-size: 0.7rem; margin-bottom: 2px;">Chroma</div>
                        <div style="font-weight: 600;">${Math.round(hcl[1])}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="color: #999; font-size: 0.7rem; margin-bottom: 2px;">Light</div>
                        <div style="font-weight: 600;">${Math.round(hcl[2])}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="color: #999; font-size: 0.7rem; margin-bottom: 2px;">RGB</div>
                        <div style="font-weight: 600; font-family: monospace;">${Math.round(rgb.r)},${Math.round(rgb.g)},${Math.round(rgb.b)}</div>
                    </div>
                </div>
            </div>
        `);
    }
        
    // 使用 viewBox 实现自适应缩放
    let svg = container.append("svg")
        .attr("viewBox", `0 0 ${m_SVGWIDTH} ${m_SVGHEIGHT}`)
        .style("width", "100%")
        .style("max-width", "320px") // 限制最大宽度
        .style("height", "auto")
        .style("display", "block")
        .style("margin", "0 auto") // 居中
        .style("overflow", "visible")

    // 添加一个圆形背景，增强“区域感”
    svg.append("circle")
        .attr("cx", m_SVGWIDTH / 2)
        .attr("cy", m_SVGHEIGHT / 2)
        .attr("r", 110)
        .attr("fill", "#f8f9fa")
        .attr("stroke", "#e9ecef")
        .attr("stroke-width", 1);

    let tmp = svg.append("g")

    for (let i = 0; i < 100; i += 20) { // 减少同心圆数量，更清爽
        tmp.append("circle")
            .attr("r", i)
            .attr("cx", m_SVGWIDTH / 2)
            .attr("cy", m_SVGHEIGHT / 2)
            .attr("fill", "none")
            .style("stroke", "#ddd") // 颜色更淡
            .style("stroke-width", 1)
            .style("stroke-dasharray", "4,4") // 虚线
    }
    // 添加十字准线
    tmp.append("line")
        .attr("x1", m_SVGWIDTH / 2 - 100).attr("y1", m_SVGHEIGHT / 2)
        .attr("x2", m_SVGWIDTH / 2 + 100).attr("y2", m_SVGHEIGHT / 2)
        .style("stroke", "#eee").style("stroke-width", 1)
    tmp.append("line")
        .attr("x1", m_SVGWIDTH / 2).attr("y1", m_SVGHEIGHT / 2 - 100)
        .attr("x2", m_SVGWIDTH / 2).attr("y2", m_SVGHEIGHT / 2 + 100)
        .style("stroke", "#eee").style("stroke-width", 1)

    var dragControlColors = d3.drag()
        .on("start", function () {
            last_coords = d3.mouse(this);
            var id = +d3.select(this).attr("id").split("_")[1]
            svg.selectAll(".controlColors").style("stroke", "red").style("stroke-width", 0)
            svg.select("#controlColors_" + id).style("stroke", "red").style("stroke-width", 2)
            // 显示当前控制点的详细信息
            updateInfoPanel(id);
        })
        .on("end", function () {
            // update the colormap
            var id = +d3.select(this).attr("id").split("_")[1]
            svg.selectAll(".controlColors").style("stroke", "red").style("stroke-width", 0)
            svg.select("#controlColors_" + id).style("stroke", "red").style("stroke-width", 2)
            d3.select(".colormapDiv").selectAll("#controlPoints_" + id).attr("fill", d3.rgb(color2Lab(control_colors[id])))
            
            // 更新信息面板
            updateInfoPanel(id);
            
            if (!d3.select(".switch input").property("checked")) {
                initial_hue_id = id
                updateColormapEqual()
                dataObj.colormap = dataObj.getColormapArray()
                updateColormap()
                updateCanvas()
            } else {
                initial_hue = control_colors[id][0]
                generateColormap()
            }

        })
        .on("drag", function () {
            var coords = d3.mouse(this);
            var id = +d3.select(this).attr("id").split("_")[1]
            svg.selectAll(".controlColors").style("stroke", "red").style("stroke-width", 0)
            svg.select("#controlColors_" + id).style("stroke", "red").style("stroke-width", 2)
            
            let hue = getRotatedHue([last_coords[0] - m_SVGWIDTH / 2, last_coords[1] - m_SVGHEIGHT / 2], [coords[0] - m_SVGWIDTH / 2, coords[1] - m_SVGHEIGHT / 2], control_colors[id][0])

            if (isClockwise(controlColors[(id - 1 + controlColors.length) % controlColors.length][0], hue) || isClockwise(hue, controlColors[(id + 1 + controlColors.length) % controlColors.length][0])) {
                return
            }

            control_colors[id][0] = hue
            d3.select("#controlColors_" + id).attr("fill", d3.rgb(color2Lab(control_colors[id])))

            // 实时更新信息面板
            updateInfoPanel(id);

            // 实时更新 Colormap Panel 的 Canvas
            let canvas = d3.select(".colormap-content canvas").node();
            if (canvas) renderColormapPixels(dataObj, canvas);
            
            // 实时更新左侧大图 (防抖)
            debouncedUpdateCanvas();

            d3.select(this)
                .attr("cx", m_SVGWIDTH / 2 + 140 * Math.cos(control_colors[id][0] / 180 * Math.PI))
                .attr("cy", m_SVGHEIGHT / 2 + 140 * Math.sin(control_colors[id][0] / 180 * Math.PI))
            tmp.select("#controlLines_" + id)
                .attr("x2", m_SVGWIDTH / 2 + 140 * Math.cos(control_colors[id][0] / 180 * Math.PI))
                .attr("y2", m_SVGHEIGHT / 2 + 140 * Math.sin(control_colors[id][0] / 180 * Math.PI))
            tmp.select("#lumiCircles_" + id)
                .attr("cx", m_SVGWIDTH / 2 + control_colors[id][2] * Math.cos(control_colors[id][0] / 180 * Math.PI))
                .attr("cy", m_SVGHEIGHT / 2 + control_colors[id][2] * Math.sin(control_colors[id][0] / 180 * Math.PI))
            let i_pre = (id - 1 + control_colors.length) % control_colors.length,
                i_aft = (id + 1 + control_colors.length) % control_colors.length
            tmp.select("#lumiLines_" + id)
                .attr("x1", m_SVGWIDTH / 2 + control_colors[id][2] * Math.cos(control_colors[id][0] / 180 * Math.PI))
                .attr("y1", m_SVGHEIGHT / 2 + control_colors[id][2] * Math.sin(control_colors[id][0] / 180 * Math.PI))
                .attr("x2", m_SVGWIDTH / 2 + control_colors[i_aft][2] * Math.cos(control_colors[i_aft][0] / 180 * Math.PI))
                .attr("y2", m_SVGHEIGHT / 2 + control_colors[i_aft][2] * Math.sin(control_colors[i_aft][0] / 180 * Math.PI))
            tmp.select("#lumiLines_" + i_pre)
                .attr("x1", m_SVGWIDTH / 2 + control_colors[i_pre][2] * Math.cos(control_colors[i_pre][0] / 180 * Math.PI))
                .attr("y1", m_SVGHEIGHT / 2 + control_colors[i_pre][2] * Math.sin(control_colors[i_pre][0] / 180 * Math.PI))
                .attr("x2", m_SVGWIDTH / 2 + control_colors[id][2] * Math.cos(control_colors[id][0] / 180 * Math.PI))
                .attr("y2", m_SVGHEIGHT / 2 + control_colors[id][2] * Math.sin(control_colors[id][0] / 180 * Math.PI))

            last_coords = d3.mouse(this);
        });


    var dragLumiCircles = d3.drag()
        .on("start", function () {
            last_coords = d3.mouse(this);
            var id = +d3.select(this).attr("id").split("_")[1]
            // 显示当前控制点的详细信息
            updateInfoPanel(id);
        })
        .on("end", function () {
            // update the colormap
            var id = +d3.select(this).attr("id").split("_")[1]
            d3.select(".colormapDiv").selectAll("#controlPoints_" + id).attr("fill", d3.rgb(color2Lab(control_colors[id])))
            
            // 更新信息面板
            updateInfoPanel(id);
            
            updateColormapEqual()
            dataObj.colormap = dataObj.getColormapArray()
            updateColormap()
            updateCanvas()
        })
        .on("drag", function () {
            var coords = d3.mouse(this);
            var id = +d3.select(this).attr("id").split("_")[1]
            let offset = Math.sqrt((last_coords[0] - coords[0]) * (last_coords[0] - coords[0]) + (last_coords[1] - coords[1]) * (last_coords[1] - coords[1])),
                offset_l_center = Math.sqrt((last_coords[0] - m_SVGWIDTH / 2) * (last_coords[0] - m_SVGWIDTH / 2) + (last_coords[1] - m_SVGHEIGHT / 2) * (last_coords[1] - m_SVGHEIGHT / 2)),
                offset_c_center = Math.sqrt((coords[0] - m_SVGWIDTH / 2) * (coords[0] - m_SVGWIDTH / 2) + (coords[1] - m_SVGHEIGHT / 2) * (coords[1] - m_SVGHEIGHT / 2))

            if (offset_l_center > offset_c_center && control_colors[id][2] - offset >= 0) {
                control_colors[id][2] -= offset
            }
            if (offset_l_center < offset_c_center && control_colors[id][2] + offset <= 100) {
                control_colors[id][2] += offset
            }

            // d3.select("#lumiCircles_" + id).attr("fill", d3.rgb(color2Lab(control_colors[id])))
            d3.select("#lumiCircles_" + id).attr("fill", d3.rgb(d3.lab(control_colors[id][2], 0, 0)))
            d3.select("#controlColors_" + id).attr("fill", d3.rgb(color2Lab(control_colors[id])))

            // 实时更新信息面板
            updateInfoPanel(id);

            // 实时更新 Colormap Panel 的 Canvas
            let canvas = d3.select(".colormap-content canvas").node();
            if (canvas) renderColormapPixels(dataObj, canvas);
            
            // 实时更新左侧大图 (防抖)
            debouncedUpdateCanvas();

            tmp.select("#lumiCircles_" + id)
                .attr("cx", m_SVGWIDTH / 2 + control_colors[id][2] * Math.cos(control_colors[id][0] / 180 * Math.PI))
                .attr("cy", m_SVGHEIGHT / 2 + control_colors[id][2] * Math.sin(control_colors[id][0] / 180 * Math.PI))
            let i_pre = (id - 1 + control_colors.length) % control_colors.length,
                i_aft = (id + 1 + control_colors.length) % control_colors.length
            tmp.select("#lumiLines_" + id)
                .attr("x1", m_SVGWIDTH / 2 + control_colors[id][2] * Math.cos(control_colors[id][0] / 180 * Math.PI))
                .attr("y1", m_SVGHEIGHT / 2 + control_colors[id][2] * Math.sin(control_colors[id][0] / 180 * Math.PI))
                .attr("x2", m_SVGWIDTH / 2 + control_colors[i_aft][2] * Math.cos(control_colors[i_aft][0] / 180 * Math.PI))
                .attr("y2", m_SVGHEIGHT / 2 + control_colors[i_aft][2] * Math.sin(control_colors[i_aft][0] / 180 * Math.PI))
            tmp.select("#lumiLines_" + i_pre)
                .attr("x1", m_SVGWIDTH / 2 + control_colors[i_pre][2] * Math.cos(control_colors[i_pre][0] / 180 * Math.PI))
                .attr("y1", m_SVGHEIGHT / 2 + control_colors[i_pre][2] * Math.sin(control_colors[i_pre][0] / 180 * Math.PI))
                .attr("x2", m_SVGWIDTH / 2 + control_colors[id][2] * Math.cos(control_colors[id][0] / 180 * Math.PI))
                .attr("y2", m_SVGHEIGHT / 2 + control_colors[id][2] * Math.sin(control_colors[id][0] / 180 * Math.PI))

            last_coords = d3.mouse(this);
        });

    for (let i = 0; i < control_colors.length; i++) {
        tmp.append("line")
            .style("stroke", "black").style("stroke-width", 1)
            .attr("x1", m_SVGWIDTH / 2)
            .attr("y1", m_SVGHEIGHT / 2)
            .attr("x2", m_SVGWIDTH / 2 + 140 * Math.cos(control_colors[i][0] / 180 * Math.PI))
            .attr("y2", m_SVGHEIGHT / 2 + 140 * Math.sin(control_colors[i][0] / 180 * Math.PI))
            .attr("id", "controlLines_" + i)
        // draw control colors
        tmp.append("circle")
            .attr("r", 10)
            .attr("cx", m_SVGWIDTH / 2 + 140 * Math.cos(control_colors[i][0] / 180 * Math.PI))
            .attr("cy", m_SVGHEIGHT / 2 + 140 * Math.sin(control_colors[i][0] / 180 * Math.PI))
            .attr("fill", d3.rgb(color2Lab(control_colors[i])))
            .attr("id", "controlColors_" + i)
            .attr("class", "controlColors")
            // .on("click", function () {
            //     console.log(control_colors[i]);
            // })
            .call(dragControlColors)
        // draw luminance interpolation line
        let i_aft = (i + 1 + control_colors.length) % control_colors.length
        tmp.append("line")
            .style("stroke", "black").style("stroke-width", 1)
            .attr("x1", m_SVGWIDTH / 2 + control_colors[i][2] * Math.cos(control_colors[i][0] / 180 * Math.PI))
            .attr("y1", m_SVGHEIGHT / 2 + control_colors[i][2] * Math.sin(control_colors[i][0] / 180 * Math.PI))
            .attr("x2", m_SVGWIDTH / 2 + control_colors[i_aft][2] * Math.cos(control_colors[i_aft][0] / 180 * Math.PI))
            .attr("y2", m_SVGHEIGHT / 2 + control_colors[i_aft][2] * Math.sin(control_colors[i_aft][0] / 180 * Math.PI))
            .attr("id", "lumiLines_" + i)
        // draw luminance circles
        tmp.append("circle")
            .attr("r", 4)
            .attr("cx", m_SVGWIDTH / 2 + control_colors[i][2] * Math.cos(control_colors[i][0] / 180 * Math.PI))
            .attr("cy", m_SVGHEIGHT / 2 + control_colors[i][2] * Math.sin(control_colors[i][0] / 180 * Math.PI))
            .attr("fill", d3.rgb(d3.lab(control_colors[i][2], 0, 0)))
            .attr("id", "lumiCircles_" + i)
            .call(dragLumiCircles)
    }


    // draw the ring
    for (let i = 0; i < 360; i++) {
        let hcl = d3.hcl(i, 70, 50)
        tmp.append("line")
            .style("stroke", hcl).style("stroke-width", 5)
            .attr("x1", m_SVGWIDTH / 2 + 100 * Math.cos(hcl.h / 180 * Math.PI))
            .attr("y1", m_SVGHEIGHT / 2 + 100 * Math.sin(hcl.h / 180 * Math.PI))
            .attr("x2", m_SVGWIDTH / 2 + 120 * Math.cos(hcl.h / 180 * Math.PI))
            .attr("y2", m_SVGHEIGHT / 2 + 120 * Math.sin(hcl.h / 180 * Math.PI))
    }
    // tmp.append("line")
    //     .style("stroke", "red").style("stroke-width", 1)
    //     .attr("id", "test")
    // tmp.append("text")
    //     .attr("id", "testText")


    // let div = d3.select("#chartDiv")
    //     .style("border", "1px solid black").style("margin-top", "10px")
    //     .style("padding", "5px")
    // drawHCLDistribution(dataObj.controlColors, div, 0)
    // drawHCLDistribution(dataObj.controlColors, div, 1)
    // drawHCLDistribution(dataObj.controlColors, div, 2)
    // div.append("br")
}

function calculateAngleBetweenVectors(A, B) {
    // 计算点积
    const dotProduct = A[0] * B[0] + A[1] * B[1] + (A[2] || 0) * (B[2] || 0);
    // 计算向量 A 的模长
    const magnitudeA = Math.sqrt(A[0] ** 2 + A[1] ** 2 + (A[2] || 0) ** 2);
    // 计算向量 B 的模长
    const magnitudeB = Math.sqrt(B[0] ** 2 + B[1] ** 2 + (B[2] || 0) ** 2);
    // 计算 cos(θ)
    const cosTheta = dotProduct / (magnitudeA * magnitudeB);
    // 通过 arccos 计算夹角（以弧度表示）
    const angleRadians = Math.acos(cosTheta);
    // 将弧度转换为度数
    const angleDegrees = angleRadians * (180 / Math.PI);
    return angleDegrees;
}
function crossProduct2D(A, B) {
    return A[0] * B[1] - A[1] * B[0];
}
function getDirection(A, B) {
    const cross = crossProduct2D(A, B);

    if (cross > 0) {
        return 1//'B 在 A 的左侧（逆时针方向）';
    } else if (cross < 0) {
        return -1//'B 在 A 的右侧（顺时针方向）';
    } else {
        return 0//'A 和 B 共线';
    }
}
function getRotatedHue(A, B, hue) {
    const angle = getDirection(A, B) * calculateAngleBetweenVectors(A, B)

    if (isNaN(angle)) return hue

    if (hue + angle < 0) return hue + angle + 360
    if (hue + angle >= 360) return hue + angle - 360
    return hue + angle
}

function drawHCLDistribution(controlColors, div, id) {
    let x = 0, y = 1
    let data = []
    for (let i = 0; i < controlColors.length; i++) {
        data.push([i, controlColors[i][id]])
    }

    var svg_width = 400, svg_height = 200, margin = 30
    let linechart_svg = div.append("svg").attr("typeId", "line")
        .attr("width", svg_width).attr("height", svg_height).style("display", "inline-block");

    let linechart = linechart_svg.style("background-color", "#FFF")
        .append("g")
        .attr("transform", "translate(" + margin + "," + margin + ")");

    let m_xScale = d3.scaleLinear().range([0, svg_width - margin * 2]), // value -> display
        m_yScale = d3.scaleLinear().range([svg_height - margin * 2, 0]); // value -> display
    // Scale the range of the data
    m_xScale.domain([0, data.length - 1]);
    if (id == 0)
        m_yScale.domain([0, 360]);
    else if (id == 1)
        m_yScale.domain([0, 100])
    else if (id == 2)
        m_yScale.domain([0, 100])

    // define the line
    let valueline = d3.line()
        .x(function (d) {
            return m_xScale(d[x]);
        })
        .y(function (d) {
            return m_yScale(d[y]);
        })//.curve(d3.curveCatmullRom);

    // Add the valueline path.
    linechart.selectAll('path')
        .data([data]).enter().append("path")
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

    let axisName = ["Hue", "Chroma", "Luminance"]
    linechart_svg.append("text").attr("x", 0).attr("y", 20).text(axisName[id]);
}

function showTrend(data, div, text, x = 0, y = 1) {

    var svg_width = 400, svg_height = 200, margin = 30
    let linechart_svg = div.append("svg").attr("typeId", "line")
        .attr("width", svg_width).attr("height", svg_height).style("display", "inline-block");

    let linechart = linechart_svg.style("background-color", "#FFF")
        .append("g")
        .attr("transform", "translate(" + margin + "," + margin + ")");

    let m_xScale = d3.scaleLinear().range([0, svg_width - margin * 2]), // value -> display
        m_yScale = d3.scaleLinear().range([svg_height - margin * 2, 0]); // value -> display
    // Scale the range of the data
    m_xScale.domain([0, data.length - 1]);
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

    let samples_num = 50
    let samples_interval = 5; Math.floor(data.length / samples_num)
    let sampled_data = []
    for (let i = 0; i < data.length; i++) {
        if (i % samples_interval === 0)
            sampled_data.push(data[i])
    }
    sampled_data.push(data[data.length - 1])

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

    linechart_svg.append("text").attr("x", 0).attr("y", 20).text("Score:" + text.toFixed(2));

}

function renderColormapPixels(dataObj, canvas) {
    if (!canvas) return;
    let context = canvas.getContext('2d');
    let width = canvas.width;
    let height = canvas.height;
    
    // traverse the image data
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
    
    // 使用 ImageData 优化渲染
    let imageData = context.createImageData(width, height);
    let pixels = imageData.data;
    
    for (let x = 0; x < width; x++) {
        let jj = Math.floor(x / (width - 1) * (colormap.length - 1))
        let hcl = colormap[jj]
        let rgb = color2rgb(hcl)
        
        let r = Math.round(rgb[0]);
        let g = Math.round(rgb[1]);
        let b = Math.round(rgb[2]);
        let a = 255; // Alpha
        
        // 填充这一列 (x) 的所有行
        for (let y = 0; y < height; y++) {
            let index = (y * width + x) * 4;
            pixels[index] = r;
            pixels[index + 1] = g;
            pixels[index + 2] = b;
            pixels[index + 3] = a;
        }
    }
    
    context.putImageData(imageData, 0, 0);
}

function drawOriginalColormap(dataObj) {
    // 确保目标容器存在
    let container = d3.select(".colormap-content");
    if (container.empty()) {
        // 兼容旧结构：如果找不到 .colormap-content，就临时创建一个
        if (d3.select(".colormapDiv .colormap-content").empty()) {
            d3.select(".colormapDiv").append("div").attr("class", "colormap-content");
        }
        container = d3.select(".colormap-content");
    }
    
    container.selectAll("*").remove(); // 只清除内容区，保留标题
    
    // 获取容器实际宽度
    let containerWidth = container.node().getBoundingClientRect().width;
    // 减去 padding (左右各 12px，这里留 30px 余量)
    colormap_width = containerWidth > 0 ? containerWidth : 360; // 防止宽度为0
    let width = colormap_width, height = colormap_height

    //get context 
    container.append("canvas").attr("class", "colormap-origin").attr("id", "colormapCanvasId-origin")
        .attr("width", width).attr("height", height)
    let canvas = document.getElementById("colormapCanvasId-origin")
    
    // 使用提取的函数绘制
    renderColormapPixels(dataObj, canvas);

    let controlPoints = dataObj.controlPoints, controlColors = dataObj.controlColors
    container.selectAll("svg.controlPoints-origin").remove()
    // draw control point position
    let svg = container.append("svg").attr("class", "controlPoints-origin")
        .style("width", "100%").style("height", "80px")
        .style("background-color", "transparent")
        .style("display", "block")
        .style("overflow", "visible") // 允许圆球超出边界显示
    var drag = d3.drag()
        .on("start", dragStart)
        .on("end", dragEnd)
        .on("drag", dragMove);

    function dragStart() {
        last_coords = d3.mouse(this);
    }

    function dragMove() {
        var coords = d3.mouse(this);
        var id = +d3.select(this).attr("id").split("_")[1]
        if (id === 0 || id == controlPoints.length - 1) return
        var offset = [coords[0] - last_coords[0], coords[1] - last_coords[1]];
        // console.log(coords);
        let curr_x = +d3.select(this).attr("cx")
        if ((curr_x + offset[0]) > svg.select("#controlPoints_" + (id - 1)).attr("cx") && (curr_x + offset[0]) < svg.select("#controlPoints_" + (id + 1)).attr("cx")) {
            d3.select(this)
                .attr("cx", curr_x + offset[0])
                .attr("cy", +d3.select(this).attr("cy"));
            svg.select("#controlLine-" + id)
                .attr("x1", curr_x + offset[0])
                .attr("y1", 0)
                .attr("x2", curr_x + offset[0])
                .attr("y2", 10)
        }

        last_coords = coords;
        
        // 拖拽过程中不实时重绘 Canvas，以免卡顿，或者可以开启
    }

    function dragEnd() {
        // update the colormap
        var id = +d3.select(this).attr("id").split("_")[1]
        if (id === 0 || id == controlPoints.length - 1) return
        let offset = +d3.select(this).attr("pre_x") - (+d3.select(this).attr("cx"))
        if (offset < 0) {
            // i, i+1
            let x1 = +svg.select("#controlPoints_" + (id + 1)).attr("cx")
            controlPoints[id] += Math.abs(offset / (x1 - (+d3.select(this).attr("pre_x")))) * (controlPoints[id + 1] - controlPoints[id])
        } else {
            // i-1, i
            let x1 = +svg.select("#controlPoints_" + (id - 1)).attr("cx")
            controlPoints[id] += Math.abs(offset / (x1 - (+d3.select(this).attr("pre_x")))) * (controlPoints[id - 1] - controlPoints[id])
        }
        d3.select(this).attr("pre_x", d3.select(this).attr("cx"))

        svg.select("#text-" + id).attr("x", d3.select(this).attr("cx"))
            .attr("transform", "rotate(-30," + (d3.select(this).attr("cx")) + ",50)")
            .text(function () {
                let value = controlPoints[id];
                if (value != 0 && (Math.abs(value) > 10000 || Math.abs(value) < 0.0001)) {
                    return value.toExponential(2);
                } else if (Number.isInteger(value)) {
                    return value;
                } else {
                    return value.toFixed(2);
                }
            })


        // update the colormap
        // 使用新的绘制函数，确保 Canvas 更新
        renderColormapPixels(dataObj, canvas);

        dataObj.colormap = dataObj.getColormapArray()
        updateCanvas()
    }


    for (let i = 0; i < controlColors.length; i++) {
        // 移除 +10 偏移，使控制点中心对齐色带边缘
        let x = width * i / (controlColors.length - 1)
        svg.append("line")
            .style("stroke", "black").style("stroke-width", 1)
            .attr("x1", x)
            .attr("y1", 0)
            .attr("x2", x)
            .attr("y2", 10)
            .attr("id", "controlLine-" + i)
        // draw control colors
        svg.append("circle")
            .attr("r", 10)
            .attr("cx", x)
            .attr("cy", 20)
            .attr("fill", d3.rgb(color2Lab(controlColors[i])))
            .attr("id", "controlPoints_" + i)
            .attr("pre_x", x)
            .call(drag)
        svg.append("text")
            .attr("x", x)
            .attr("y", 50)
            .attr("id", "text-" + i)
            .style("text-anchor", "middle")
            .style("font-size", "10px")
            .attr("transform", "rotate(-30," + (x) + ",50)")
            .text(function () {
                let value = controlPoints[i];
                if (value != 0 && (Math.abs(value) > 10000 || Math.abs(value) < 0.0001)) {
                    return value.toExponential(2);
                } else if (Number.isInteger(value)) {
                    return value;
                } else {
                    return value.toFixed(2);
                }
            });
    }
}

function updateColormapEqual() {
    // console.log("update colormap:", JSON.stringify(data_arr[current_data_id].controlColors));
    let dataObj = data_arr[current_data_id]
    
    // 使用新的渲染函数，复用已有的 Canvas，不再依赖 SVG DOM 计算
    let canvas = d3.select(".colormap-content canvas").node();
    if (canvas) {
        renderColormapPixels(dataObj, canvas);
    }
}

/**
 * 绘制直方图并在其上绘制多个高斯曲线
 * @param {Array} dataArray - 二维数组，包含数据
 * @param {Array} gaussianParamsArray - 高斯参数数组，每个元素是一个对象，格式为 { mean: 均值, stdDev: 标准差 }
 */
function drawHistogramWithMultipleGaussians(dataArray, gaussianParamsArray) {

    // 设置直方图的尺寸和边距
    const margin = { top: 20, right: 30, bottom: 40, left: 40 },
        width = 800 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;

    // 创建SVG容器
    const svg = d3.select("#chartDiv").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", 'translate(' + margin.left + ',' + margin.top + ')');

    // 将二维数组展平成一维数组，并过滤掉NaN值
    const data = dataArray.flat().map(d => Number(d)).filter(d => !isNaN(d));

    // 设置x轴和y轴的比例尺
    const x = d3.scaleLinear()
        .domain(d3.extent(data))
        .range([0, width]);

    const histogram = d3.histogram()
        .domain(x.domain())
        .thresholds(x.ticks(100));

    const bins = histogram(data);

    const y = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)])
        .range([height, 0]);

    // 绘制x轴
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    // 绘制y轴
    svg.append("g")
        .call(d3.axisLeft(y));

    // 绘制直方图的矩形条
    svg.selectAll("rect")
        .data(bins)
        .enter().append("rect")
        .attr("x", 1)
        .attr("transform", d => `translate(${x(d.x0)},${y(d.length)})`)
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1)) // 确保宽度不为负
        .attr("height", d => height - y(d.length))
        .style("fill", "#69b3a2");

    // 根据gaussianParamsArray在histogram上绘制高斯曲线
    // 设置统一的y轴比例尺
    const yGaussian = d3.scaleLinear()
        .domain([0, d3.max(gaussianParamsArray, params => {
            const { mean, stdDev } = params;
            return (1 / (stdDev * Math.sqrt(2 * Math.PI)));
        })])
        .range([height, 0]);

    // 定义颜色比例尺
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    gaussianParamsArray.forEach((params, index) => {
        const { mean, stdDev } = params;

        // 生成高斯曲线数据
        const gaussianData = d3.range(x.domain()[0], x.domain()[1], (x.domain()[1] - x.domain()[0]) / 1000).map(xValue => {
            const exponent = -0.5 * Math.pow((xValue - mean) / stdDev, 2);
            const yValue = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
            return { x: xValue, y: yValue };
        });

        // 绘制高斯曲线
        const line = d3.line()
            .x(d => x(d.x))
            .y(d => yGaussian(d.y));

        svg.append("path")
            .datum(gaussianData)
            .attr("fill", "none")
            .attr("stroke", colorScale(index))
            .attr("stroke-width", 1.5)
            .attr("d", line);
    });
}



