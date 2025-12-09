/**
 * 内置的 Colormap 定义
 * 优先级:
 * 1. 全局 COLOR_PRESETS (来自 metrics.js，如果已加载)
 * 2. D3 内置插值器 (d3.interpolateXXX)
 * 3. 手动定义的近似值
 */

// 辅助函数：从 D3 插值器采样 HCL 控制点
function sampleFromD3(interpolator, samples = 15) {
    let colors = [];
    for (let i = 0; i < samples; i++) {
        let t = i / (samples - 1);
        let c = d3.hcl(interpolator(t));
        // 处理 Hue 为 NaN 的情况 (灰度)
        if (isNaN(c.h)) {
             c.h = (colors.length > 0) ? colors[colors.length-1][0] : 0;
        }
        colors.push([c.h, c.c, c.l]);
    }
    return colors;
}

// 辅助函数：从 COLOR_PRESETS 获取并转换/采样
function getFromPreset(presetName, sampleCount = 15) {
    if (typeof COLOR_PRESETS === 'undefined' || !COLOR_PRESETS[presetName]) {
        return null;
    }
    
    let source = COLOR_PRESETS[presetName];
    // 如果 source 是函数（metrics.js 中 viridis/plasma 是函数生成的数组，但 COLOR_PRESETS 存储的是结果数组）
    // 检查 source 是否为数组
    if (!Array.isArray(source)) return null;

    let colors = [];
    for (let i = 0; i < sampleCount; i++) {
        // 均匀采样索引
        let idx = Math.round(i / (sampleCount - 1) * (source.length - 1));
        let rgb = source[idx];
        // RGB [r, g, b] -> HCL
        let c = d3.hcl(d3.rgb(rgb[0], rgb[1], rgb[2]));
        
        if (isNaN(c.h)) {
             c.h = (colors.length > 0) ? colors[colors.length-1][0] : 0;
        }
        colors.push([c.h, c.c, c.l]);
    }
    return colors;
}

const BUILTIN_COLORMAPS = {
    rainbow: {
        name: "Rainbow",
        description: "经典彩虹配色",
        // 优先使用 COLOR_PRESETS.rainbow，然后是 D3
        controlColors: getFromPreset('rainbow') || (typeof d3 !== 'undefined' && d3.interpolateRainbow ? sampleFromD3(d3.interpolateRainbow, 12) : [
            [0, 75, 45], [30, 80, 55], [60, 85, 65], [120, 70, 55], [180, 65, 50], [240, 70, 45], [300, 75, 50]
        ]),
        category: "传统"
    },
    
    thermal: {
        name: "Thermal",
        description: "热力图配色",
        // Data from TH_Thermal_6.txt
        controlColors: (function() {
            const rgbData = [
                [0,0,0],[25,0,0],[60,0,4],[102,0,51],[156,0,102],[191,12,153],[229,38,204],[255,68,255],[204,51,225],[140,43,195],
                [89,30,165],[51,20,135],[0,0,76],[12,51,135],[25,76,165],[38,114,195],[51,178,225],[63,255,255],[25,219,110],[0,183,76],
                [0,156,51],[0,130,25],[0,97,0],[51,144,0],[102,181,0],[153,210,0],[204,237,12],[255,255,25],[235,216,0],[216,153,0],
                [193,102,0],[159,51,0],[102,12,25],[130,51,63],[159,89,96],[188,127,140],[216,165,178],[235,204,204],[255,229,229],[255,255,255]
            ];
            
            if (typeof d3 !== 'undefined') {
                let colors = [];
                rgbData.forEach(p => {
                    const c = d3.hcl(d3.rgb(p[0], p[1], p[2]));
                    if (isNaN(c.h)) c.h = (colors.length > 0) ? colors[colors.length-1][0] : 0;
                    colors.push([c.h, c.c, c.l]);
                });
                return colors;
            }
            
            // Fallback (generated via Python script)
            return [
                [0,0,0], [19,9,2], [23,31,9], [360,43,20], [348,62,34], [338,78,44], [333,93,55], [328,104,64], [324,97,53], [316,88,40],
                [311,81,29], [308,73,20], [305,54,5], [294,55,24], [289,56,34], [277,49,48], [241,38,68], [197,47,92], [148,79,77], [145,75,65],
                [142,72,56], [139,68,47], [136,59,35], [132,74,53], [126,83,67], [119,88,78], [112,92,89], [103,95,97], [97,86,86], [79,73,68],
                [63,69,53], [49,66,37], [25,43,21], [15,37,33], [16,31,46], [6,25,60], [2,21,73], [20,12,85], [20,9,93], [0,0,100]
            ];
        })(),
        category: "传统"
    },
    
    viridis: {
        name: "Viridis",
        description: "感知均匀 (Matplotlib)",
        controlColors: getFromPreset('viridis') || (typeof d3 !== 'undefined' && d3.interpolateViridis ? sampleFromD3(d3.interpolateViridis, 12) : [
            [270, 50, 15], [260, 60, 30], [240, 55, 45], [200, 50, 55], [150, 60, 65], [90, 70, 75], [80, 80, 85]
        ]),
        category: "感知均匀"
    },
    
    jet: {
        name: "Jet",
        description: "传统 Jet 配色",
        // metrics.js 中使用的是 'rainbowjet'
        controlColors: getFromPreset('rainbowjet') || [
            [240, 100, 25], [210, 100, 40], [180, 80, 50], [150, 90, 60], [120, 85, 60], 
            [90, 90, 70], [60, 100, 80], [30, 100, 60], [0, 100, 50], [350, 100, 30]
        ],
        category: "不推荐"
    },
    
    plasma: {
        name: "Plasma",
        description: "感知均匀 (Matplotlib)",
        controlColors: getFromPreset('plasma') || (typeof d3 !== 'undefined' && d3.interpolatePlasma ? sampleFromD3(d3.interpolatePlasma, 12) : [
            [260, 45, 15], [280, 70, 30], [310, 85, 45], [340, 90, 55], [20, 95, 65], [50, 95, 75], [80, 85, 90]
        ]),
        category: "感知均匀"
    },
    
    cool: {
        name: "Cool",
        description: "冷色调配色",
        controlColors: getFromPreset('cool') || (typeof d3 !== 'undefined' && d3.interpolateCool ? sampleFromD3(d3.interpolateCool, 9) : [
            [180, 70, 50], [300, 70, 50]
        ]),
        category: "单色调"
    },
    
    hot: {
        name: "Hot",
        description: "热色调配色",
        // metrics.js 有 'hot' (Black-Red-Yellow-White)
        controlColors: getFromPreset('hot') || (typeof d3 !== 'undefined' && d3.interpolateWarm ? sampleFromD3(d3.interpolateWarm, 12) : [
            [0, 0, 0], [0, 80, 25], [0, 90, 45], [60, 95, 70], [0, 0, 100]
        ]),
        category: "单色调"
    }
};

/**
 * 获取指定 colormap 的控制点
 * @param {string} name - colormap 名称
 * @returns {Array} 控制点数组
 */
function getBuiltinColormap(name) {
    if (!BUILTIN_COLORMAPS[name]) {
        console.warn(`Colormap "${name}" not found`);
        return null;
    }
    return BUILTIN_COLORMAPS[name].controlColors;
}

/**
 * 获取所有可用的 colormap 列表
 * @returns {Object} colormap 定义对象
 */
function getAllBuiltinColormaps() {
    return BUILTIN_COLORMAPS;
}
