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
        category: "传统"
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
    
    
    turbo: {
        name: "Turbo",
        description: "Google Turbo (改进的 Jet)",
        // Turbo colormap by Google - RGB values at key positions
        controlColors: (function() {
            const rgbData = [
                [48,18,59], [62,24,90], [72,40,120], [78,62,137], [80,85,145],
                [79,107,143], [75,128,139], [68,148,133], [59,167,126], [50,184,121],
                [43,199,119], [39,212,120], [40,223,123], [47,232,129], [61,239,139],
                [80,244,153], [104,247,170], [132,249,189], [161,250,210], [190,249,231],
                [220,246,247], [243,238,248], [252,224,228], [253,205,196], [251,183,161],
                [247,159,123], [241,135,88], [232,110,61], [220,87,42], [206,67,32],
                [190,50,27], [173,37,25], [155,27,24], [138,20,22], [122,16,20]
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
            
            // Fallback HCL approximation
            return [
                [285, 35, 15], [280, 45, 25], [270, 50, 35], [260, 50, 45], [250, 45, 55],
                [235, 40, 60], [215, 45, 65], [195, 50, 70], [175, 55, 75], [155, 60, 80],
                [140, 65, 85], [125, 70, 88], [110, 75, 90], [95, 80, 92], [80, 85, 94],
                [65, 85, 95], [50, 85, 96], [40, 80, 96], [30, 75, 95], [20, 70, 93],
                [15, 65, 90], [10, 60, 85], [5, 55, 78], [0, 50, 70], [355, 48, 60],
                [350, 50, 50], [345, 55, 42], [340, 60, 35], [335, 65, 28], [330, 70, 22]
            ];
        })(),
        category: "感知均匀"
    },
    
    inferno: {
        name: "Inferno",
        description: "感知均匀 (Matplotlib)",
        controlColors: getFromPreset('inferno') || (typeof d3 !== 'undefined' && d3.interpolateInferno ? sampleFromD3(d3.interpolateInferno, 12) : [
            [270, 20, 5], [285, 40, 15], [300, 60, 25], [320, 75, 35], [340, 85, 45],
            [10, 95, 55], [30, 100, 65], [50, 95, 75], [70, 85, 85], [80, 60, 92]
        ]),
        category: "感知均匀"
    },
    
    magma: {
        name: "Magma",
        description: "感知均匀 (Matplotlib)",
        controlColors: getFromPreset('magma') || (typeof d3 !== 'undefined' && d3.interpolateMagma ? sampleFromD3(d3.interpolateMagma, 12) : [
            [300, 20, 5], [310, 45, 15], [320, 65, 25], [330, 80, 35], [345, 90, 45],
            [10, 95, 55], [30, 95, 65], [50, 90, 75], [70, 75, 85], [90, 50, 95]
        ]),
        category: "感知均匀"
    },
    
    
    warm: {
        name: "Warm",
        description: "暖色调渐变",
        controlColors: typeof d3 !== 'undefined' && d3.interpolateWarm ? sampleFromD3(d3.interpolateWarm, 10) : [
            [300, 50, 30], [330, 60, 40], [0, 70, 50], [30, 80, 60], [60, 90, 70], [90, 85, 80]
        ],
        category: "单色调"
    },
    
    cubehelix: {
        name: "Cubehelix",
        description: "螺旋色彩空间",
        controlColors: typeof d3 !== 'undefined' && d3.interpolateCubehelixDefault ? sampleFromD3(d3.interpolateCubehelixDefault, 12) : [
            [300, 40, 10], [280, 50, 25], [250, 55, 40], [210, 50, 55], [170, 40, 65],
            [130, 35, 75], [90, 40, 80], [60, 50, 85], [40, 55, 88], [30, 45, 90]
        ],
        category: "传统"
    },
    
    sinebow: {
        name: "Sinebow",
        description: "正弦彩虹配色",
        controlColors: typeof d3 !== 'undefined' && d3.interpolateSinebow ? sampleFromD3(d3.interpolateSinebow, 12) : [
            [0, 75, 50], [45, 80, 60], [90, 85, 70], [135, 80, 75], [180, 75, 70],
            [225, 80, 60], [270, 85, 55], [315, 80, 50], [360, 75, 50]
        ],
        category: "传统"
    },
    
    spectral: {
        name: "Spectral",
        description: "ColorBrewer 发散配色",
        controlColors: typeof d3 !== 'undefined' && d3.interpolateSpectral ? sampleFromD3(d3.interpolateSpectral, 11) : [
            [0, 80, 40], [20, 90, 55], [45, 95, 70], [70, 90, 82], [90, 75, 90],
            [180, 10, 97], [240, 75, 90], [270, 90, 82], [290, 95, 70], [310, 90, 55], [340, 80, 40]
        ],
        category: "发散"
    },
    
    rdbu: {
        name: "RdBu",
        description: "红-蓝发散 (ColorBrewer)",
        controlColors: typeof d3 !== 'undefined' && d3.interpolateRdBu ? sampleFromD3(d3.interpolateRdBu, 11) : [
            [10, 85, 35], [15, 90, 50], [20, 80, 65], [25, 60, 80], [0, 20, 92],
            [0, 0, 97], [210, 20, 92], [220, 60, 80], [230, 80, 65], [240, 90, 50], [250, 85, 35]
        ],
        category: "发散"
    },
    
    rdylgn: {
        name: "RdYlGn",
        description: "红-黄-绿发散 (ColorBrewer)",
        controlColors: typeof d3 !== 'undefined' && d3.interpolateRdYlGn ? sampleFromD3(d3.interpolateRdYlGn, 11) : [
            [0, 90, 40], [10, 95, 55], [40, 95, 70], [55, 85, 85], [70, 50, 95],
            [90, 10, 97], [100, 50, 95], [120, 85, 85], [135, 95, 70], [145, 95, 55], [155, 90, 40]
        ],
        category: "发散"
    },
    
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

/**
 * 获取按分类组织的 colormap 列表
 * @returns {Array} 分类数组，每个元素包含 {category, colormaps}
 */
function getColormapsByCategory() {
    // 定义分类顺序和中文名称
    const categoryOrder = [
        { key: "感知均匀", name: "感知均匀 (推荐)", icon: "✨" },
        { key: "发散", name: "发散配色", icon: "🔄" },
        { key: "单色调", name: "单色调", icon: "🎨" },
        { key: "传统", name: "传统配色", icon: "🌈" }
    ];
    
    // 每个分类内的推荐顺序
    const orderWithinCategory = {
        "感知均匀": ['viridis', 'plasma', 'inferno', 'magma', 'turbo'],
        "发散": ['spectral', 'rdbu', 'rdylgn'],
        "单色调": ['cool', 'warm'],
        "传统": ['rainbow', 'thermal', 'cubehelix', 'sinebow','jet'],
    };
    
    let result = [];
    
    categoryOrder.forEach(cat => {
        let colormapsInCategory = [];
        
        // 按推荐顺序添加
        if (orderWithinCategory[cat.key]) {
            orderWithinCategory[cat.key].forEach(id => {
                if (BUILTIN_COLORMAPS[id]) {
                    colormapsInCategory.push({
                        id: id,
                        name: BUILTIN_COLORMAPS[id].name,
                        description: BUILTIN_COLORMAPS[id].description,
                        controlColors: BUILTIN_COLORMAPS[id].controlColors
                    });
                }
            });
        }
        
        // 添加未在推荐列表中的colormap
        Object.keys(BUILTIN_COLORMAPS).forEach(id => {
            if (BUILTIN_COLORMAPS[id].category === cat.key) {
                let alreadyAdded = colormapsInCategory.find(c => c.id === id);
                if (!alreadyAdded) {
                    colormapsInCategory.push({
                        id: id,
                        name: BUILTIN_COLORMAPS[id].name,
                        description: BUILTIN_COLORMAPS[id].description,
                        controlColors: BUILTIN_COLORMAPS[id].controlColors
                    });
                }
            }
        });
        
        if (colormapsInCategory.length > 0) {
            result.push({
                category: cat.name,
                icon: cat.icon,
                colormaps: colormapsInCategory
            });
        }
    });
    
    return result;
}

/**
 * 获取推荐用于对比的 colormap 列表（精选）
 * @returns {Array} colormap ID 数组
 */
function getRecommendedColormaps() {
    return [
        'viridis',   // 感知均匀代表
        'turbo',     // 改进的Jet
        'plasma',    // 另一个感知均匀
        'thermal',   // 传统热力图
        'rainbow',   // 经典彩虹
        'spectral',  // 发散配色代表
        'jet'        // 传统但常用
    ];
}

/**
 * 获取所有 colormap ID 列表（按分类排序）
 * @returns {Array} colormap ID 数组
 */
function getAllColormapIds() {
    let categories = getColormapsByCategory();
    let allIds = [];
    categories.forEach(cat => {
        cat.colormaps.forEach(cm => {
            allIds.push(cm.id);
        });
    });
    return allIds;
}
