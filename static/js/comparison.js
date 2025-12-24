/**
 * Colormap 对比页面主逻辑
 */

// 全局状态
let comparisonData = null;
let optimizedColormap = null;
let syncRotation = false;
let globalYaw = 0.8;
let globalPitch = 0.5;

// Colormap 配置（显示所有）
const COMPARISON_COLORMAPS = (typeof getAllColormapIds === 'function') 
    ? getAllColormapIds() 
    : (typeof BUILTIN_COLORMAPS !== 'undefined' 
        ? Object.keys(BUILTIN_COLORMAPS)
        : ['viridis', 'turbo', 'plasma', 'thermal', 'rainbow', 'spectral', 'jet']);

/**
 * 页面初始化
 */
document.addEventListener('DOMContentLoaded', function() {
    // 默认加载第一个数据集
    loadComparisonDataset(0);
});

/**
 * 加载对比数据集
 */
function loadComparisonDataset(datasetId) {
    let data_path = "";
    if (datasetId == 0) {
        data_path = "static/data/D15.txt";
    } else if (datasetId == 1) {
        data_path = "static/data/ID_0050_AGE_0074_CONTRAST_0_CT.txt";
    } else if (datasetId == 2) {
        data_path = "static/data/TLC trip.txt";
    } else if (datasetId == 3) {
        data_path = "static/data/HR_diagram.txt";
    }
    
    // 显示加载状态
    showLoading();
    
    fetch(data_path)
        .then(response => response.text())
        .then(data => {
            let source_data = d3.csvParseRows(data.replace(/\t/g, ','));
            comparisonData = source_data;
            
            // 使用纯前端 GMM 计算
            // Simulate async behavior to not block UI immediately (though GMM is sync)
            return new Promise(resolve => {
                setTimeout(() => {
                    try {
                        let result = window.GMM.calculate(source_data, 0); // 0 for auto
                        resolve(result);
                    } catch (e) {
                        console.error("GMM Calculation failed:", e);
                        resolve({ received_array: [], error: e });
                    }
                }, 10);
            });
        })
        .then(result => {
            if (result.error || !result.received_array) {
                console.error('GMM Error:', result.error);
                hideLoading();
                return;
            }
            
            // 保存优化后的控制点
            let control_colors = [];
            for (let i = 0; i < result.received_array.length; i++) {
                control_colors.push([
                    360 - i * 360 / result.received_array.length, 
                    0, 
                    i % 2 == 0 ? 10 : 90
                ]);
            }
            optimizedColormap = control_colors;
            
            // 渲染所有对比视图
            renderAllComparisons();
            hideLoading();
        })
        .catch(error => {
            console.error('加载数据出错:', error);
            hideLoading();
        });
}

/**
 * 渲染所有colormap的对比视图
 */
function renderAllComparisons() {
    if (!optimizedColormap) return;
    
    // 1. 渲染优化后的colormap
    renderSingleLab3D('optimized', optimizedColormap, true);
    calculateAndDisplayMetrics('optimized', optimizedColormap);
    
    // 2. 渲染每个内置colormap
    COMPARISON_COLORMAPS.forEach(name => {
        let colormapDef = BUILTIN_COLORMAPS[name];
        let controlColors = colormapDef.controlColors;
        let interpolationMode = colormapDef.interpolationMode || 'hcl';
        let rgbData = colormapDef.rgbData;
        renderSingleLab3D(name, controlColors, false, interpolationMode, rgbData);
        calculateAndDisplayMetrics(name, controlColors, interpolationMode, rgbData);
    });
}

/**
 * 渲染单个Lab 3D视图
 */
function renderSingleLab3D(name, controlColors, useRealColors, interpolationMode, rgbData) {
    interpolationMode = interpolationMode || 'hcl';
    rgbData = rgbData || null;
    
    // 调试输出
    if (name === 'rainbow') {
        console.log('[renderSingleLab3D] rainbow:', {
            name,
            hasControlColors: !!controlColors,
            controlColorsLength: controlColors ? controlColors.length : 0,
            hasRgbData: !!rgbData,
            rgbDataLength: rgbData ? rgbData.length : 0,
            interpolationMode,
            rgbData: rgbData
        });
    }
    
    if (!controlColors || controlColors.length === 0) return;
    let containerId = 'comp-lab3d-' + name; // Updated to match HTML ID
    let container = d3.select('#' + containerId);
    if (container.empty()) {
        // Fallback for backward compatibility or if ID is different
        containerId = 'lab3d-' + name;
        container = d3.select('#' + containerId);
        if (container.empty()) return;
    }
    
    // Make the card clickable
    let card = d3.select(container.node().closest('.colormap-card'));
    if (!card.empty()) {
        card.style("cursor", "pointer")
            .on("click", function() {
                // Removed call to switchMainColormap(name) to prevent affecting render view and editor.
                
                // Optional: visual feedback
                d3.selectAll('.colormap-card').style('opacity', '0.7').style('transform', 'scale(0.98)');
                d3.select(this).style('opacity', '1').style('transform', 'scale(1.02)');
                setTimeout(() => {
                    d3.selectAll('.colormap-card').style('opacity', '1').style('transform', 'scale(1)');
                }, 200);
            });
    }
    
    container.selectAll("*").remove();
    
    let rawWidth = container.node().clientWidth || 450;
    let rawHeight = container.node().clientHeight || 350;
    
    let colorbarHeight = 0;
    if (typeof window.drawLabColorbar === 'function') {
        colorbarHeight = window.drawLabColorbar(container, rawWidth, controlColors);
    } else {
        colorbarHeight = drawComparisonColorbar(container, rawWidth, controlColors, interpolationMode, rgbData);
    }
    
    let width = rawWidth;
    let height = Math.max(rawHeight - colorbarHeight, 120);
    
    let scale = Math.min(width, height) / 250;
    
    // 3D投影函数
    function project(l, a, b, yaw, pitch) {
        let x = a;
        let y = l - 50;
        let z = b;
        
        let x1 = x * Math.cos(yaw) - z * Math.sin(yaw);
        let z1 = x * Math.sin(yaw) + z * Math.cos(yaw);
        
        let y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
        let z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
        
        return [width / 2 + x1 * scale, height / 2 - y2 * scale, z2];
    }
    
    let svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", "#fff")
        .call(d3.drag().on("drag", function() {
            if (syncRotation) {
                globalYaw -= d3.event.dx * 0.01;
                globalPitch += d3.event.dy * 0.01;
                globalPitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, globalPitch));
                // 重新渲染所有视图
                renderAllComparisons();
            } else {
                let localYaw = globalYaw - d3.event.dx * 0.01;
                let localPitch = globalPitch + d3.event.dy * 0.01;
                localPitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, localPitch));
                renderSingleLab3D(name, controlColors, useRealColors, interpolationMode, rgbData);
            }
        }));
    
    let elements = [];
    
    // 坐标轴
    let axes = [
        { start: [50, -100, 0], end: [50, 100, 0], color: "#e74c3c", label: "a" },
        { start: [50, 0, -100], end: [50, 0, 100], color: "#3498db", label: "b" },
        { start: [0, 0, 0], end: [100, 0, 0], color: "#2c3e50", label: "L" }
    ];
    
    axes.forEach(axis => {
        let p1 = project(axis.start[0], axis.start[1], axis.start[2], globalYaw, globalPitch);
        let p2 = project(axis.end[0], axis.end[1], axis.end[2], globalYaw, globalPitch);
        elements.push({ 
            type: 'line', 
            x1: p1[0], y1: p1[1], 
            x2: p2[0], y2: p2[1], 
            z: (p1[2] + p2[2]) / 2, 
            color: axis.color, 
            width: 2
        });
    });
    
    // 绘制colormap轨迹
    let labPoints = (interpolationMode === 'rgb' && rgbData) 
        ? getColormapArrayLabFromRGB(rgbData)
        : getColormapArrayLabFromHCL(controlColors);
    let step = Math.max(1, Math.floor(labPoints.length / 200));
    
    for (let i = 0; i < labPoints.length - step; i += step) {
        let p1 = project(labPoints[i][0], labPoints[i][1], labPoints[i][2], globalYaw, globalPitch);
        let p2 = project(labPoints[i + step][0], labPoints[i + step][1], labPoints[i + step][2], globalYaw, globalPitch);
        
        let color = "#333";
        if (useRealColors) {
            // 使用真实颜色
            if (interpolationMode === 'rgb' && rgbData) {
                let rgb = interpolateRGB(rgbData, i / labPoints.length);
                color = d3.rgb(rgb[0], rgb[1], rgb[2]).toString();
            } else {
                let hcl = interpolateHCL(controlColors, i / labPoints.length);
                color = d3.hcl(hcl[0], hcl[1], hcl[2]).toString();
            }
        }
        
        elements.push({ 
            type: 'line', 
            x1: p1[0], y1: p1[1], 
            x2: p2[0], y2: p2[1], 
            z: (p1[2] + p2[2]) / 2, 
            color: color, 
            width: useRealColors ? 3 : 2.5
        });
    }
    
    // 按深度排序
    elements.sort((a, b) => a.z - b.z);
    
    // 渲染
    elements.forEach(el => {
        if (el.type === 'line') {
            svg.append("line")
                .attr("x1", el.x1)
                .attr("y1", el.y1)
                .attr("x2", el.x2)
                .attr("y2", el.y2)
                .attr("stroke", el.color)
                .attr("stroke-width", el.width)
                .attr("stroke-dasharray", el.dash || "")
                .attr("opacity", el.opacity || 1);
        }
    });
}

/**
 * 从HCL控制点获取Lab数组
 */
function getColormapArrayLabFromHCL(controlColors) {
    let colormap = [];
    let totalSteps = 1000;
    let stepPerSegment = Math.floor(totalSteps / (controlColors.length - 1));
    
    for (let i = 0; i < controlColors.length - 1; i++) {
        for (let j = 0; j < stepPerSegment; j++) {
            let t = j / stepPerSegment;
            let hcl = [0, 0, 0];
            
            // 色相插值（考虑环形）
            let h1 = controlColors[i][0];
            let h2 = controlColors[i + 1][0];
            if (h2 < h1) {
                hcl[0] = (h1 + (h2 - h1) * t) % 360;
            } else {
                hcl[0] = (h1 + (h2 - h1 - 360) * t + 360) % 360;
            }
            
            hcl[1] = controlColors[i][1] + (controlColors[i + 1][1] - controlColors[i][1]) * t;
            hcl[2] = controlColors[i][2] + (controlColors[i + 1][2] - controlColors[i][2]) * t;
            
            let lab = d3.lab(d3.hcl(hcl[0], hcl[1], hcl[2]));
            colormap.push([lab.L, lab.a, lab.b]);
        }
    }
    
    // 添加最后一个点
    let lastHCL = controlColors[controlColors.length - 1];
    let lastLab = d3.lab(d3.hcl(lastHCL[0], lastHCL[1], lastHCL[2]));
    colormap.push([lastLab.L, lastLab.a, lastLab.b]);
    
    return colormap;
}

/**
 * 从RGB控制点获取Lab数组
 */
function getColormapArrayLabFromRGB(rgbData) {
    let colormap = [];
    let totalSteps = 1000;
    let stepPerSegment = Math.floor(totalSteps / (rgbData.length - 1));
    
    for (let i = 0; i < rgbData.length - 1; i++) {
        for (let j = 0; j < stepPerSegment; j++) {
            let t = j / stepPerSegment;
            let r = rgbData[i][0] + (rgbData[i + 1][0] - rgbData[i][0]) * t;
            let g = rgbData[i][1] + (rgbData[i + 1][1] - rgbData[i][1]) * t;
            let b = rgbData[i][2] + (rgbData[i + 1][2] - rgbData[i][2]) * t;
            
            let lab = d3.lab(d3.rgb(r, g, b));
            colormap.push([lab.L, lab.a, lab.b]);
        }
    }
    
    // 添加最后一个点
    let lastRGB = rgbData[rgbData.length - 1];
    let lastLab = d3.lab(d3.rgb(lastRGB[0], lastRGB[1], lastRGB[2]));
    colormap.push([lastLab.L, lastLab.a, lastLab.b]);
    
    return colormap;
}

/**
 * RGB插值
 */
function interpolateRGB(rgbData, t) {
    let index = t * (rgbData.length - 1);
    let i = Math.floor(index);
    let frac = index - i;
    
    if (i >= rgbData.length - 1) {
        return rgbData[rgbData.length - 1];
    }
    
    let r = rgbData[i][0] + (rgbData[i + 1][0] - rgbData[i][0]) * frac;
    let g = rgbData[i][1] + (rgbData[i + 1][1] - rgbData[i][1]) * frac;
    let b = rgbData[i][2] + (rgbData[i + 1][2] - rgbData[i][2]) * frac;
    
    return [r, g, b];
}

/**
 * HCL插值
 */
function interpolateHCL(controlColors, t) {
    let index = t * (controlColors.length - 1);
    let i = Math.floor(index);
    let frac = index - i;
    
    if (i >= controlColors.length - 1) {
        return controlColors[controlColors.length - 1];
    }
    
    let hcl = [0, 0, 0];
    let h1 = controlColors[i][0];
    let h2 = controlColors[i + 1][0];
    
    if (h2 < h1) {
        hcl[0] = (h1 + (h2 - h1) * frac) % 360;
    } else {
        hcl[0] = (h1 + (h2 - h1 - 360) * frac + 360) % 360;
    }
    
    hcl[1] = controlColors[i][1] + (controlColors[i + 1][1] - controlColors[i][1]) * frac;
    hcl[2] = controlColors[i][2] + (controlColors[i + 1][2] - controlColors[i][2]) * frac;
    
    return hcl;
}

/**
 * 计算并显示指标
 */
function calculateAndDisplayMetrics(name, controlColors, interpolationMode, rgbData) {
    interpolationMode = interpolationMode || 'hcl';
    
    // 如果是RGB插值模式，需要先转换为HCL格式供metrics计算
    let metricsColors = controlColors;
    if (interpolationMode === 'rgb' && rgbData && typeof d3 !== 'undefined') {
        metricsColors = [];
        rgbData.forEach(rgb => {
            let c = d3.hcl(d3.rgb(rgb[0], rgb[1], rgb[2]));
            if (isNaN(c.h)) {
                c.h = (metricsColors.length > 0) ? metricsColors[metricsColors.length-1][0] : 0;
            }
            metricsColors.push([c.h, c.c, c.l]);
        });
    }
    
    const metrics = (typeof computeCardMetrics === 'function')
        ? computeCardMetrics(metricsColors)
        : { smoothness: 0, discriminatoryCie: 0, contrastSensitivity: 0, hue: 0, luminanceVariation: 0, chromaticVariation: 0, labLength: 0, nameVariation: 0, categorization: 0, categoryCount: 0, categoryMeanDeltaE: 0 };

    // Prefer the shared panel updater if it exists
    if (typeof updateMetricPanel === 'function') {
        updateMetricPanel(name, metrics);
        return;
    }

    const formatValue = (val, digits = 2) => (isFinite(val) ? val.toFixed(digits) : '--');

    d3.select('#smoothness-' + name).text(formatValue(metrics.smoothness, 4));
    d3.select('#cie-' + name).text(formatValue(metrics.discriminatoryCie, 2));
    d3.select('#csens-' + name).text(formatValue(metrics.contrastSensitivity, 2));
    d3.select('#hue-' + name).text(formatValue(metrics.hue, 2));
    d3.select('#luminance-' + name).text(formatValue(metrics.luminanceVariation, 2));
    d3.select('#chromatic-' + name).text(formatValue(metrics.chromaticVariation, 2));
    d3.select('#lablen-' + name).text(formatValue(metrics.labLength, 2));
    d3.select('#namevar-' + name).text(formatValue(metrics.nameVariation, 2));
    const catText = (isFinite(metrics.categorization))
        ? `${metrics.categorization.toFixed(2)} (K=${metrics.categoryCount || 0})`
        : '--';
    d3.select('#categorization-' + name).text(catText);
}

/**
 * 切换同步旋转
 */
function toggleSyncRotation() {
    syncRotation = !syncRotation;
    let btn = d3.select('#sync-rotation-btn');
    if (syncRotation) {
        btn.classed('active', true);
        d3.select('#sync-icon').text('🔗');
    } else {
        btn.classed('active', false);
        d3.select('#sync-icon').text('🔓');
    }
}

/**
 * 显示加载状态
 */
function showLoading() {
    document.querySelectorAll('.lab3d-container').forEach(container => {
        let overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="loading-spinner"></div>';
        container.appendChild(overlay);
    });
}

/**
 * Switch the main application colormap to the selected one
 * @param {string} name - The name of the colormap ('optimized' or builtin name)
 */
function switchMainColormap(name) {
    if (typeof current_data_id === 'undefined' || typeof data_arr === 'undefined' || !data_arr[current_data_id]) return;

    let newControlColors = null;
    if (name === 'optimized') {
        if (optimizedColormap) {
            newControlColors = optimizedColormap;
        }
    } else if (BUILTIN_COLORMAPS[name]) {
        newControlColors = BUILTIN_COLORMAPS[name].controlColors;
    }

    if (newControlColors) {
        console.log("Switching to colormap:", name);
        
        // Deep copy to prevent reference issues
        let clonedColors = newControlColors.map(c => c.slice());
        
        // Update data object
        if (data_arr[current_data_id].setControlColors) {
            data_arr[current_data_id].setControlColors(clonedColors);
        } else {
            // Fallback if method doesn't exist (though it should)
            data_arr[current_data_id].controlColors = clonedColors;
            if (data_arr[current_data_id].getColormapArray) {
                data_arr[current_data_id].colormap = data_arr[current_data_id].getColormapArray();
            }
        }

        // Redraw Main Canvas
        if (typeof renderCanvas === 'function') {
            renderCanvas(data_arr[current_data_id]);
        }
        
        // Redraw 3D View if needed
        // Note: renderLab3D might be used for the main view too
        if (typeof renderLab3D === 'function') {
             // Check if #lab3d-container exists (which implies we are in 3D mode for main view)
             if (!d3.select("#lab3d-container").empty()) {
                 renderLab3D(data_arr[current_data_id]);
             }
        }

        // Update the color bar/legend if separate
        if (typeof drawColormap === 'function') {
            drawColormap(data_arr[current_data_id]);
        }
        
        // Note: We deliberately DO NOT call drawControlPoints or drawColorWheel 
        // as per user request ("control panel 不用")
    }
}

/**
 * 隐藏加载状态
 */
function hideLoading() {
    document.querySelectorAll('.loading-overlay').forEach(overlay => {
        overlay.remove();
    });
}

function drawComparisonColorbar(container, width, controlColors, interpolationMode, rgbData) {
    interpolationMode = interpolationMode || 'hcl';
    if (!controlColors || !controlColors.length) return 0;
    const height = 12;
    const margin = 8;
    const dpr = window.devicePixelRatio || 1;
    const canvas = container.append('canvas')
        .attr('width', Math.max(1, Math.round(width * dpr)))
        .attr('height', Math.round(height * dpr))
        .style('width', '100%')
        .style('height', height + 'px')
        .style('display', 'block')
        .style('margin-bottom', margin + 'px');
    const ctx = canvas.node().getContext('2d');
    
    if (interpolationMode === 'rgb' && rgbData) {
        // RGB插值模式：逐像素绘制以确保真正的线性RGB插值
        const scaledWidth = Math.round(width * dpr);
        const scaledHeight = Math.round(height * dpr);
        const imageData = ctx.createImageData(scaledWidth, scaledHeight);
        const data = imageData.data;
        
        // 调试输出 - 只对前几个colorbar输出
        if (window.debugColorbarCount === undefined) window.debugColorbarCount = 0;
        if (window.debugColorbarCount < 2) {
            console.log('[Colorbar Debug]', {
                interpolationMode,
                rgbDataLength: rgbData.length,
                rgbData: rgbData,
                scaledWidth,
                scaledHeight,
                width,
                dpr
            });
            
            // 测试插值
            console.log('[Colorbar] Interpolation test:');
            for (let testT = 0; testT <= 1; testT += 0.1) {
                const testRgb = interpolateRGB(rgbData, testT);
                console.log(`  t=${testT.toFixed(1)}: rgb(${Math.round(testRgb[0])}, ${Math.round(testRgb[1])}, ${Math.round(testRgb[2])})`);
            }
            
            window.debugColorbarCount++;
        }
        
        for (let x = 0; x < scaledWidth; x++) {
            const t = x / (scaledWidth - 1);
            const rgb = interpolateRGB(rgbData, t);
            const r = Math.round(rgb[0]);
            const g = Math.round(rgb[1]);
            const b = Math.round(rgb[2]);
            
            for (let y = 0; y < scaledHeight; y++) {
                const idx = (y * scaledWidth + x) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    } else {
        // HCL插值模式：使用gradient（向后兼容）
        ctx.scale(dpr, dpr);
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        const stops = controlColors.length === 1 ? [0, 1] : controlColors.map((_, idx) => idx / (controlColors.length - 1));
        stops.forEach((t, idx) => {
            const sourceIdx = controlColors.length === 1 ? 0 : idx;
            const hcl = controlColors[sourceIdx];
            const rgb = d3.hcl(hcl[0], hcl[1], hcl[2]).rgb();
            gradient.addColorStop(t, `rgb(${rgb.r},${rgb.g},${rgb.b})`);
        });
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }
    return height + margin;
}
