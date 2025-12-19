# 🎨 Distinguishable Colormap 生成算法完整流程文档

## 一、系统概述

这是一个基于**感知优化**的高可区分性色图（Colormap）生成系统，使用**模拟退火算法**在**HCL色彩空间**中优化控制点颜色，目标是生成在标量场可视化中具有高区分度的色图。

**核心技术栈：**
- **颜色空间**：HCL (Hue-Chroma-Luminance)，基于人眼感知的均匀色彩空间
- **优化算法**：Simulated Annealing（模拟退火）
- **控制点检测**：Gaussian Mixture Model (GMM) 用于自动确定最优控制点数量和簇权重
- **评分指标**：三重优化目标
  - 簇大小分配（Cluster Allocation）：确保大簇获得更多感知色彩分辨率
  - 全局感知均匀性（Perceptual Uniformity）：稳定弧长密度
  - 颜色名称约束（Color-Name Constraints）：簇内一致性和簇间可区分性

---

## 二、完整算法流程

### **阶段1: 数据加载与控制点生成**

#### 1.1 数据输入
```javascript
// 位置: dataObj.js
class DataObj {
    constructor(data, num = 0) {
        this.data = data  // 2D标量场数据
        this.extent = [min, max]  // 数据值域范围
    }
}
```

**输入**：2D数组的标量场数据（CSV/TSV格式）

**处理**：
- 计算数据范围 `[min, max]`
- 扁平化所有有效数值点

#### 1.2 GMM控制点自动检测
```javascript
// 位置: gmm.js - calculateGMM()
function calculateGMM(data, num) {
    // 1. 数据扁平化与子采样（最多5000样本）
    let flatData = flatten(data).filter(isValid)
    if (flatData.length > 5000) {
        flatData = randomSubsample(flatData, 5000)
    }
    
    // 2. 如果num=0，自动选择最优K
    if (num === 0) {
        let minMdlScore = Infinity
        for (let k = 1; k <= 10; k++) {
            let gmm = new GMM1D(k)
            gmm.fit(flatData)  // EM算法拟合
            let score = gmm.score(flatData)  // MDL评分
            // MDL = -logLikelihood + λ * 3 * K * log(N)
            if (score < minMdlScore) {
                optMdl = k
            }
        }
    }
    
    // 3. 返回排序后的means作为控制点位置
    return {
        received_array: sortedMeans,  // 控制点的数据值
        GMM: [{mean, stdDev}, ...]
    }
}
```

**GMM算法细节：**
- **初始化**：均匀分布K个高斯分量的均值
- **EM迭代**：
  - **E-step**：计算每个数据点属于各分量的后验概率 `γ[n][k]`
  - **M-step**：更新均值、方差、权重
  ```javascript
  weights[k] = N_k / N
  means[k] = Σ(γ[n][k] * data[n]) / N_k
  variances[k] = Σ(γ[n][k] * (data[n] - means[k])²) / N_k
  ```
- **收敛判断**：Log-likelihood变化 < 1e-4
- **MDL评分**：`-logLikelihood + 40 * 3 * K * log(N)`（λ=40）

**输出**：
- `controlPoints`：控制点在数据值域的位置 `[v1, v2, ..., vK]`
- 控制点数量K（2-10个）

---

### **阶段2: 初始颜色分配**

#### 2.1 初始化策略
```javascript
// 位置: optimizer.js - simulatedAnnealing()
let palette_size = controlPoints.length
let initial_colors = []

for (let i = 0; i < palette_size; i++) {
    // 色相：逆时针均匀分布
    let hue = (initial_hue - i * 360 / palette_size + 360) % 360
    
    // 明度：单调递增（10 → 90）
    let luminance = 10 + (80 / (palette_size - 1)) * i
    
    // 饱和度：Gamut Mapping到可表示范围
    let chroma = gamutMappingHCL(hue, 100, luminance)
    
    initial_colors.push([hue, chroma, luminance])
}
```

**关键参数：**
- `initial_hue`：用户指定的起始色相（默认值由UI控制）
- **明度策略**：单调递增从10到90，确保colormap从暗到亮
- **色相分布**：360° / K 均匀分布

#### 2.2 Gamut Mapping（色域映射）
```javascript
// 位置: optimizer.js - gamutMappingHCL()
function gamutMappingHCL(h, c, l) {
    let cAdjusted = c
    for (let iter = 0; iter < 100; iter++) {
        // HCL → Lab → RGB 转换
        let rgb = hclToRgb(h, cAdjusted, l)
        
        // 检查是否在RGB [0,255]范围内
        if (rgb.r >= 0 && rgb.r <= 255 && 
            rgb.g >= 0 && rgb.g <= 255 && 
            rgb.b >= 0 && rgb.b <= 255) {
            return cAdjusted  // 找到最大可表示chroma
        }
        
        // 不可表示，降低饱和度
        cAdjusted *= 0.95
    }
    return cAdjusted
}
```

**目的**：找到给定(H, L)下，最大可表示的Chroma值，避免颜色越界

#### 2.3 颜色约束扰动
```javascript
// 位置: optimizer.js - disturbColor()
function disturbColor(palette, idx) {
    // 1. 扰动色相（除了第一个控制点）
    if (idx != 0) {
        hue += random(-5, 5)
        // 确保色相单调性（逆时针）和最小间隔10°
        while (违反约束) {
            hue += random(-5, 5)
        }
    }
    
    // 2. 重置明度（保持交替策略）
    luminance = (idx % 2 == 0) ? 10 : 90
    chroma = gamutMappingHCL(hue, 100, luminance)
    
    // 3. 调整明度避免黑白色
    for (let j = 0; j < 30; j++) {
        let hcl = d3.hcl(hue, chroma, luminance)
        let name = getColorName(hcl)
        let nd_black = getNameDifference(hcl, black)
        let nd_white = getNameDifference(hcl, white)
        
        // 约束条件：
        // - 有颜色名称（非灰色）
        // - 与黑色距离 > 0.95
        // - 与白色距离 > 0.95
        if (has_name && nd_black > 0.95 && nd_white > 0.95) {
            break
        }
        
        // 调整策略
        if (nd_black < 0.95) luminance += 1
        if (nd_white < 0.95) luminance -= 1
        if (!has_name) {
            // 搜索附近有名称的颜色
            // 降低chroma和调整luminance
        }
    }
}
```

**约束条件：**
1. **色相单调性**：逆时针递减，相邻间隔≥10°
2. **亮度单调性**：L[i-1] < L[i] < L[i+1]，确保从暗到亮
3. **避免黑白**：与纯黑、纯白的名称差异>0.95
4. **可命名性**：颜色有明确的C3颜色名称（非灰色）

---

### **阶段3: 模拟退火优化**

#### 3.1 算法框架
```javascript
// 位置: optimizer.js - simulatedAnnealing()
function simulatedAnnealing(
    initial_temperature = 100000,
    end_temperature = 0.0001,
    cooling_param = 0.99
) {
    let cur_temper = initial_temperature
    let o = {
        palette: initial_colors,
        score: getPaletteScore(initial_colors)
    }
    let preferredObj = o
    
    while (cur_temper > end_temperature) {
        // 1. 扰动：随机选择一个控制点
        let curr_colors = deepCopy(o.palette)
        let idx = random(0, palette_size - 1)
        disturbColor(curr_colors, idx)
        
        // 2. 评分
        let o2 = {
            palette: curr_colors,
            score: getPaletteScore(curr_colors)
        }
        
        // 3. Metropolis准则
        let delta_score = o.score - o2.score
        let prob = exp(-delta_score / cur_temper)
        
        if (delta_score <= 0 || random() <= prob) {
            o = o2  // 接受新状态
            if (o.score > preferredObj.score) {
                preferredObj = o  // 更新最优解
            }
        }
        
        // 4. 降温
        cur_temper *= cooling_param
    }
    
    return preferredObj
}
```

**关键参数：**
- **初始温度**：100,000（高温允许爬坡）
- **终止温度**：0.0001
- **冷却系数**：0.99（几何冷却）
- **最大迭代**：10,000,000次（通常提前收敛）

**优化目标**：最大化 `getPaletteScore()`

---

### **阶段4: 评分机制（核心）**

评分函数将colormap视为连续曲线 c(u)，其中 u ∈ [0, 1]，优化三个目标：

#### 4.1 总体设置

```javascript
// 位置: optimizer.js - getPaletteScore()
function getPaletteScore(palette) {
    const R = 512  // 密集采样点数
    
    // 沿colormap曲线密集采样
    let samples = []  // {u, lab}
    for (let i = 0; i < R; i++) {
        let u = i / (R - 1)
        // HCL插值（色相最短路径）
        let lab = interpolateAndConvert(palette, u)
        samples.push({u: u, lab: lab})
    }
}
```

**关键概念：**
- 不假设固定数量的离散颜色点
- 使用密集采样仅用于数值积分
- 最终离散采样将通过固定JND弧长采样完成（在其他地方处理）

---

#### 4.2 簇大小分配项 (L_alloc)

**目标**：确保较大的数据簇获得成比例的感知颜色分辨率

```javascript
// 1. GMM簇权重
const K = gmmModel.nComponents
const pi_k = gmmModel.weights  // 权重和为1

// 2. 根据簇大小划分u轴 [0,1]
let U_bounds = [0]
for (let k = 0; k < K; k++) {
    U_bounds.push(sum(pi_j for j <= k))
}
// 例: K=3, weights=[0.2, 0.5, 0.3] → U_bounds=[0, 0.2, 0.7, 1.0]

// 3. 计算每个簇的实际弧长
let d_i = []  // 相邻样本间的感知距离
let S_total = 0
for (let i = 0; i < R - 1; i++) {
    let dist = ciede2000(samples[i].lab, samples[i+1].lab)
    d_i.push(dist)
    S_total += dist
}

let S_k = new Array(K).fill(0)
for (let i = 0; i < R - 1; i++) {
    let u_i = samples[i].u
    // 确定u_i属于哪个簇
    for (let k = 0; k < K; k++) {
        if (u_i >= U_bounds[k] && u_i < U_bounds[k+1]) {
            S_k[k] += d_i[i]
            break
        }
    }
}

// 4. 计算分配损失
let L_alloc = 0
for (let k = 0; k < K; k++) {
    let pi_hat_k = S_k[k] / S_total  // 实际比例
    L_alloc += (pi_hat_k - pi_k[k])^2
}
```

**物理意义：**
- 大簇应该在感知色彩空间中占据更长的"弧长"
- 最小化实际分配与期望分配的平方误差

---

#### 4.3 全局感知均匀性项 (L_uniform)

**目标**：稳定沿曲线的弧长密度，避免局部波动

```javascript
// 1. 计算弧长密度
let delta_u = 1 / (R - 1)
let s_i = []  // 局部弧长密度
for (let i = 0; i < R - 1; i++) {
    s_i.push(d_i[i] / delta_u)
}

// 2. 计算平均密度和标准差
let s_bar = mean(s_i)
let std_s = sqrt(variance(s_i))

// 3. 归一化变异系数
let L_uniform = (1 / s_bar) * std_s
```

**关键特性：**
- 不强制特定的间隔目标
- 仅惩罚弧长密度的大幅波动
- 与数据驱动的分配不冲突
- 不引入显式的平滑度或单调性约束

---

#### 4.4 颜色名称约束

**4.4.1 代表颜色（CDF中位数）**

```javascript
// 对每个簇k，计算代表颜色
let rep_colors = []
for (let k = 0; k < K; k++) {
    // 将簇均值映射到u坐标
    let clusterMean = gmmModel.means[k]
    let u_rep = (clusterMean - dataExtent[0]) / (dataExtent[1] - dataExtent[0])
    
    // 获取对应的颜色
    let repIndex = round(u_rep * (R - 1))
    rep_colors.push(samples[repIndex].lab)
}
```

**4.4.2 簇内语义一致性 (L_name_in)**

```javascript
let L_name_in = 0
for (let k = 0; k < K; k++) {
    // 找到属于簇k的所有样本
    let clusterSamples = samples.filter(s => 
        s.u >= U_bounds[k] && s.u < U_bounds[k+1]
    )
    
    // 计算与代表颜色的平均名称距离
    let totalDist = 0
    for (let sample of clusterSamples) {
        totalDist += name_dist(sample.lab, rep_colors[k])
    }
    L_name_in += totalDist / clusterSamples.length
}
```

**4.4.3 簇间语义可区分性 (R_name_between)**

```javascript
let R_name_between = 0
for (let k = 0; k < K - 1; k++) {
    // 只比较相邻簇以保持连续性
    R_name_between += name_dist(rep_colors[k], rep_colors[k+1])
}
```

**名称距离函数：**
```javascript
function name_dist(lab1, lab2) {
    let c1 = getColorNameIndex(lab1)
    let c2 = getColorNameIndex(lab2)
    // 使用C3颜色名称库的余弦距离
    return 1 - c3.color.cosine(c1, c2)
}
```

---

#### 4.5 最终损失函数

```javascript
const lambda_alloc = 10.0    // 簇分配权重
const lambda_uniform = 1.0   // 均匀性权重
const lambda_in = 0.5        // 簇内一致性权重
const lambda_bt = 2.0        // 簇间区分度权重

let totalLoss = lambda_alloc * L_alloc 
              + lambda_uniform * L_uniform 
              + lambda_in * L_name_in 
              - lambda_bt * R_name_between

// 返回负损失（因为优化器最大化分数）
return -totalLoss
```

**设计原则：**
- ✅ 数据驱动的簇分配
- ✅ 全局曲线级别的稳定性
- ✅ 语义约束作为软约束
- ❌ 不引入固定颜色样本数
- ❌ 不引入显式JND惩罚
- ❌ 不引入平滑度、单调性或色域损失
- ❌ 均匀性仅定义为弧长密度的相对稳定性

---

#### 4.6 评分示例输出

```javascript
{
    L_alloc: 0.0234,        // 簇分配误差
    L_uniform: 0.1567,      // 密度变异系数
    L_name_in: 0.4523,      // 簇内名称距离
    R_name_between: 2.3456, // 簇间名称距离
    totalLoss: 0.8912       // 总损失
}
```

---

### **阶段5: 色彩空间与颜色转换**

#### 5.1 HCL色彩空间
```javascript
// HCL (Hue-Chroma-Luminance) 基于Lab的极坐标表示
// H: 0-360° 色相（色轮角度）
// C: 0-100+ 饱和度（彩度半径）
// L: 0-100 明度（亮度）

// HCL → Lab
let a = C * cos(H * π/180)
let b = C * sin(H * π/180)
Lab = [L, a, b]

// Lab → RGB (D65白点，sRGB色域)
// D3.js库自动处理完整的转换链
```

**为什么选择HCL？**
1. **感知均匀性**：等距离的HCL值在人眼中有相似的色差
2. **直观操作**：H控制颜色类型，C控制鲜艳度，L控制明暗
3. **单调性约束**：便于实施色相单调递减的约束

#### 5.2 颜色插值策略
```javascript
// 位置: dataObj.js - getColormapArray()
function interpolateHCL(hcl1, hcl2, t) {
    // 色相：最短路径插值（避免经过色轮长弧）
    let h1 = hcl1[0], h2 = hcl2[0]
    let diff = h2 - h1
    if (diff > 180) diff -= 360   // 跨越0°红色
    if (diff < -180) diff += 360
    let h = (h1 + diff * t + 360) % 360
    
    // 饱和度、明度：线性插值
    let c = lerp(hcl1[1], hcl2[1], t)
    let l = lerp(hcl1[2], hcl2[2], t)
    
    return [h, c, l]
}
```

---

### **阶段6: 度量指标系统**

系统提供多种质量度量（用于对比分析）：

#### 6.1 平滑度（Smoothness）
```javascript
// 方法1: 曲率惩罚（metrics.js）
function calcSmoothness(palette) {
    let cosinePenalty = 0
    for (let i = 0; i < palette.length - 2; i++) {
        let d1 = delta(lab[i+1], lab[i])
        let d2 = delta(lab[i+2], lab[i+1])
        let cosine = dot(d1, d2) / (length(d1) * length(d2))
        cosinePenalty += cosine * -0.5 + 0.5  // 转换到[0,1]
    }
    return cosinePenalty / (palette.length - 2)
}

// 方法2: 最小色差（optimizer.js）
function calcSmoothnessMinDiff(palette) {
    // 与getPaletteScore相同的逻辑
    // 返回256个采样点中满足JND的最小色差
}
```

#### 6.2 区分度（Discriminatory Power）
```javascript
// CIE色差版本
function discriminatory_cie(colormap) {
    let totalSpeed = 0
    for (let i = 0; i < 256; i++) {
        for (let j = i + 1; j < 256; j++) {
            let deltaE = ciede2000(lab[i], lab[j])
            let v_ij = deltaE / abs((j-i) / 255)  // 归一化空间距离
            totalSpeed += v_ij
        }
    }
    return totalSpeed / pairCount
}

// 对比度敏感性版本
function discriminatory_contrast_sensitivity(colormap) {
    // 使用3.4 * (v_ij)^0.879 的感知模型
}
```

#### 6.3 颜色分类倾向（Color Categorization）
```javascript
function calculate_color_categorization_tendency(colormap) {
    // 1. 采样60个颜色
    // 2. 基于名称差异的凝聚聚类
    // 3. 计算聚类数K和质心间平均CIEDE2000
    return K * meanDeltaE
}
```

#### 6.4 其他指标
- **明度变化**：`luminance_variation` - 相邻L值变化总和
- **饱和度变化**：`chromatic_variation` - 相邻C值变化总和
- **Lab长度**：`calculate_lab_length` - Lab空间中的轨迹长度
- **名称变化**：`calculate_color_name_variation` - C3名称差异总和

---

## 三、完整流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    用户上传数据                               │
│                  (CSV/TSV标量场)                              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│           数据预处理 (dataObj.js)                             │
│  • 计算数据范围 [min, max]                                    │
│  • 扁平化数值数组                                             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│         GMM控制点检测 (gmm.js)                                │
│  • 数据子采样（最多5000点）                                    │
│  • EM算法拟合1D GMM                                           │
│  • MDL准则选择最优K (1-10)                                    │
│  • 输出: controlPoints = [v1, v2, ..., vK]                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│       初始颜色分配 (optimizer.js)                              │
│  • 色相: 逆时针均匀分布 360°/K                                 │
│  • 明度: 单调递增 (10→90)                                     │
│  • 饱和度: Gamut Mapping到最大可表示值                         │
│  • 约束: 避免黑白色、确保可命名、保持亮度单调性                 │
│  • 输出: initial_colors = [[h1,c1,l1], ..., [hK,cK,lK]]     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│       模拟退火优化 (optimizer.js)                              │
│  初始温度: 100,000                                            │
│  冷却系数: 0.99                                               │
│  终止温度: 0.0001                                             │
│                                                               │
│  循环（直到温度降至阈值）:                                      │
│  ┌─────────────────────────────────────────┐                 │
│  │ 1. 随机选择控制点idx                     │                 │
│  │ 2. 扰动颜色 disturbColor(palette, idx)   │                 │
│  │    • 色相 ±5°（保持单调性）               │                 │
│  │    • 重新计算L,C（避免黑白）              │                 │
│  │ 3. 评分 score = getPaletteScore()       │                 │
│  │ 4. Metropolis接受准则                    │                 │
│  │    if Δscore≤0 or rand≤exp(-Δs/T):     │                 │
│  │        accept new state                 │                 │
│  │ 5. 降温 T *= 0.99                        │                 │
│  └─────────────────────────────────────────┘                 │
│                                                               │
│  输出: optimized_colors (最高分配置)                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│         评分机制 (getPaletteScore)                            │
│                                                               │
│  1. 密集采样512个点沿colormap曲线 c(u), u∈[0,1]              │
│     • HCL空间插值（色相最短路径）→ Lab                        │
│                                                               │
│  2. 簇大小分配 (L_alloc)                                      │
│     • 根据GMM权重划分u轴: U_k = Σπ_j (j≤k)                   │
│     • 计算每个簇的实际弧长比例                                │
│     • 最小化 Σ(π̂_k - π_k)²                                   │
│                                                               │
│  3. 全局感知均匀性 (L_uniform)                                │
│     • 计算弧长密度 s_i = d_i / Δu                            │
│     • 归一化变异系数: (1/s̄)·√Var(s_i)                        │
│                                                               │
│  4. 颜色名称约束                                              │
│     • L_name_in: 簇内与代表色的名称距离                       │
│     • R_name_between: 相邻簇间名称距离                        │
│                                                               │
│  5. 总损失 (最小化):                                          │
│     10·L_alloc + 1·L_uniform + 0.5·L_name_in - 2·R_between  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│       色图生成 (dataObj.js)                                   │
│  • 根据控制点值域分段                                          │
│  • HCL插值生成连续色图                                         │
│  • 转换为RGB用于渲染                                           │
│  • 输出: colormap数组                                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│       可视化渲染 (render.js)                                  │
│  • 2D标量场映射                                               │
│  • 3D Lab空间轨迹                                             │
│  • 控制点色轮显示                                              │
│  • 度量指标对比                                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、关键算法伪代码

### 完整的Colormap生成流程

```python
# === 主流程 ===
function generateColormap(scalarData, initialHue):
    # 第1步: GMM控制点检测
    flatData = flatten(scalarData)
    optimalK = findOptimalGMMComponents(flatData)  # MDL准则
    controlPoints = fitGMM(flatData, K=optimalK).means
    
    # 第2步: 初始化控制点颜色
    palette = []
    for i in range(len(controlPoints)):
        h = (initialHue - i * 360 / len(controlPoints)) % 360
        l = 10 + (80 / (len(controlPoints) - 1)) * i  # 明度单调递增
        c = gamutMapping(h, 100, l)   # 最大可表示饱和度
        palette.append([h, c, l])
    
    # 对每个控制点应用约束扰动
    for i in range(len(palette)):
        palette[i] = disturbWithConstraints(palette, i)
    
    # 第3步: 模拟退火优化
    optimizedPalette = simulatedAnnealing(
        initial_palette=palette,
        scoringFunction=getPaletteScore,
        T_init=100000,
        T_end=0.0001,
        cooling=0.99
    )
    
    # 第4步: 生成连续色图
    colormap = interpolateControlPoints(optimizedPalette, controlPoints, n=256)
    
    return colormap, optimizedPalette


# === 核心评分函数（新版）===
function getPaletteScore(palette, gmmModel, dataExtent):
    R = 512  # 密集采样数
    
    # 1. 沿曲线密集采样
    samples = []
    for i in range(R):
        u = i / (R - 1)
        hcl = interpolateHCL(palette, u)
        lab = hclToLab(hcl)
        samples.append({u: u, lab: lab})
    
    # 2. 计算弧长
    d_i = []
    S_total = 0
    for i in range(R - 1):
        dist = ciede2000(samples[i].lab, samples[i+1].lab)
        d_i.append(dist)
        S_total += dist
    
    # 3. 簇大小分配损失
    K = gmmModel.nComponents
    pi_k = gmmModel.weights
    
    # 构建u轴边界
    U_bounds = [0]
    for k in range(K):
        U_bounds.append(sum(pi_k[0:k+1]))
    
    # 计算每个簇的实际弧长比例
    S_k = [0] * K
    for i in range(R - 1):
        u_i = samples[i].u
        for k in range(K):
            if u_i >= U_bounds[k] and u_i < U_bounds[k+1]:
                S_k[k] += d_i[i]
                break
    
    L_alloc = sum((S_k[k]/S_total - pi_k[k])**2 for k in range(K))
    
    # 4. 全局感知均匀性
    delta_u = 1 / (R - 1)
    s_i = [d / delta_u for d in d_i]
    s_bar = mean(s_i)
    L_uniform = (1 / s_bar) * sqrt(variance(s_i))
    
    # 5. 颜色名称约束
    # 代表颜色
    rep_colors = []
    for k in range(K):
        clusterMean = gmmModel.means[k]
        u_rep = (clusterMean - dataExtent[0]) / (dataExtent[1] - dataExtent[0])
        u_rep = clip(u_rep, 0, 1)
        repIndex = round(u_rep * (R - 1))
        rep_colors.append(samples[repIndex].lab)
    
    # 簇内一致性
    L_name_in = 0
    for k in range(K):
        clusterSamples = [s.lab for s in samples 
                          if s.u >= U_bounds[k] and s.u < U_bounds[k+1]]
        if len(clusterSamples) > 0:
            L_name_in += mean([name_dist(lab, rep_colors[k]) 
                               for lab in clusterSamples])
    
    # 簇间可区分性
    R_name_between = sum(name_dist(rep_colors[k], rep_colors[k+1]) 
                         for k in range(K-1))
    
    # 6. 总损失
    lambda_alloc = 10.0
    lambda_uniform = 1.0
    lambda_in = 0.5
    lambda_bt = 2.0
    
    totalLoss = (lambda_alloc * L_alloc + 
                 lambda_uniform * L_uniform + 
                 lambda_in * L_name_in - 
                 lambda_bt * R_name_between)
    
    return -totalLoss  # 返回负损失（优化器最大化）


# === 约束扰动函数 ===
function disturbWithConstraints(palette, idx):
    color = palette[idx]
    
    # 扰动色相（保持单调性）
    if idx > 0:
        repeat:
            color.h += random(-5, 5)
            color.h = color.h % 360
        until:
            # 相邻色相间隔≥10°
            hueDistance(color.h, palette[idx-1].h) >= 10 and
            hueDistance(color.h, palette[idx+1].h) >= 10 and
            # 保持逆时针单调性
            isCounterClockwise(palette[idx-1].h, color.h, palette[idx+1].h)
    
    # 计算目标明度（单调递增）
    targetL = 10 + (80 / (len(palette) - 1)) * idx
    color.l = targetL
    color.c = gamutMapping(color.h, 100, color.l)
    
    # 避免黑白色和灰色（同时保持单调性）
    for attempt in range(30):
        colorName = getC3ColorName(color)
        nameDiff_black = getNameDifference(color, BLACK)
        nameDiff_white = getNameDifference(color, WHITE)
        
        if (hasValidColorName(colorName) and
            nameDiff_black > 0.95 and
            nameDiff_white > 0.95):
            break
        
        # 计算亮度约束边界
        minL = palette[idx-1].l + 1 if idx > 0 else 10
        maxL = palette[idx+1].l - 1 if idx < len(palette)-1 else 90
        
        # 调整策略（保持在边界内）
        if nameDiff_black < 0.95 and color.l < maxL:
            color.l += 1
        if nameDiff_white < 0.95 and color.l > minL:
            color.l -= 1
        
        # 强制限制在单调范围内
        color.l = clip(color.l, minL, maxL)
        
        # 如果无颜色名称，搜索附近有名称的颜色
        if not hasValidColorName(colorName):
            color = searchNearbyNamedColor(color.h, color.c, color.l)
        
        # 重新计算饱和度
        color.c = gamutMapping(color.h, 100, color.l)
    
    return color


# === GMM MDL评分 ===
function scoreGMM(data, K):
    gmm = fitGMM(data, K)
    logLikelihood = sum(log(P(x | gmm)) for x in data)
    numParams = 3 * K - 1  # K个(均值+方差+权重) - 1个权重约束
    mdlScore = -logLikelihood + 40 * numParams * log(len(data))
    return mdlScore  # 越小越好
```

---

## 五、核心设计原则

### 5.1 连续曲线优化
- 将colormap视为连续曲线 c(u)，u ∈ [0, 1]
- 不假设固定数量的离散颜色点
- 密集采样仅用于数值计算
- 最终离散化通过JND弧长采样（外部处理）

### 5.2 数据驱动的分配
- GMM自动检测数据分布的簇结构
- 簇权重 π_k 决定u轴的分区
- 大簇获得更多感知色彩分辨率
- MDL准则自动选择最优簇数量（2-10个）

### 5.3 全局感知稳定性
- 弧长密度 s_i = d_i / Δu 测量局部分辨率
- 最小化归一化变异系数 (1/s̄)·√Var(s_i)
- 不强制特定间隔，仅惩罚大幅波动
- 与数据驱动分配不冲突

### 5.4 语义软约束
- **簇内一致性**：同簇颜色语义相近
- **簇间可区分性**：相邻簇颜色语义可辨
- 使用C3颜色名称的余弦距离
- 作为软约束，不破坏连续性

### 5.5 分离关注点
- ✅ 评分函数：优化控制点配置（簇分配、均匀性、语义约束）
- ✅ 初始化/扰动：处理几何和物理约束（色相单调性、**亮度单调性**、Gamut Mapping）
- ❌ 不在评分中引入：JND硬阈值、平滑度约束
- ❌ 亮度单调性作为硬约束在扰动阶段强制执行

---

## 六、技术亮点

1. **纯前端实现**：无需后端服务器，GMM和优化算法全部在浏览器运行
2. **实时交互**：用户可拖动控制点实时调整颜色
3. **多维度评估**：提供10+种度量指标用于质量评估
4. **历史管理**：保存优化历史，支持回滚
5. **对比分析**：与内置colormap（Viridis, Plasma等）实时对比

---

## 七、参数配置建议

### 7.1 优化器参数

| 参数 | 默认值 | 说明 | 调优建议 |
|------|--------|------|----------|
| `initial_temperature` | 100,000 | 模拟退火初始温度 | 数据复杂时可增大到500,000 |
| `cooling_param` | 0.99 | 温度衰减系数 | 0.95-0.999，越大收敛越慢但更精细 |
| `initial_hue` | 用户指定 | 起始色相 | 0-360°，推荐0(红)或240(蓝) |

### 7.2 评分函数参数

| 参数 | 默认值 | 说明 | 调优建议 |
|------|--------|------|----------|
| `R` (采样数) | 512 | 密集采样点数 | 256-1024，越大越精确但更慢 |
| `lambda_alloc` | 10.0 | 簇分配权重 | 5-20，主要优化目标 |
| `lambda_uniform` | 1.0 | 均匀性权重 | 0.5-2.0，控制密度稳定性 |
| `lambda_in` | 0.5 | 簇内名称一致性 | 0.1-1.0，语义软约束 |
| `lambda_bt` | 2.0 | 簇间名称区分度 | 1-5，鼓励语义对比 |

### 7.3 GMM参数

| 参数 | 默认值 | 说明 | 调优建议 |
|------|--------|------|----------|
| `lambda` (MDL) | 40 | 复杂度惩罚系数 | 20-60，越大倾向更少簇 |
| `maxComponents` | 10 | 最大簇数量 | 5-15，取决于数据复杂度 |
| `MAX_SAMPLES` | 5000 | GMM子采样大小 | 3000-10000，平衡速度与精度 |

---

## 八、输出格式

### 优化后的控制点颜色
```javascript
[
    [h1, c1, l1],  // 控制点1 (HCL)
    [h2, c2, l2],  // 控制点2
    ...
    [hK, cK, lK]   // 控制点K
]
```

### 最终色图数组（256-1000个颜色）
```javascript
[
    [h1, c1, l1],
    [h2, c2, l2],
    ...  // 在控制点间线性插值
]
```

### 质量评分（新版）
```javascript
{
    score: -0.8912,          // 负损失（最大化）
    L_alloc: 0.0234,         // 簇分配误差
    L_uniform: 0.1567,       // 密度变异系数
    L_name_in: 0.4523,       // 簇内名称距离
    R_name_between: 2.3456,  // 簇间名称距离
    totalLoss: 0.8912        // 原始损失值
}
```

---

## 九、代码文件结构

### 核心算法文件

| 文件 | 功能 | 关键函数 |
|------|------|----------|
| `optimizer.js` | 模拟退火优化、评分机制 | `simulatedAnnealing()`, `getPaletteScore()`, `disturbColor()`, `gamutMappingHCL()` |
| `gmm.js` | GMM控制点检测 | `GMM1D` class, `calculateGMM()`, EM算法 |
| `dataObj.js` | 数据对象、色图生成 | `DataObj` class, `getColormapArray()`, HCL插值 |
| `metrics.js` | 质量度量指标 | `calcSmoothness()`, `discriminatory_cie()`, `calculate_color_categorization_tendency()` |
| `render.js` | 可视化渲染 | `renderCanvas()`, `renderLab3D()`, `drawColorWheel()` |
| `index.js` | 主交互逻辑 | `generateColormap()`, `selectExample()`, 历史管理 |

### 数据流

```
用户数据 (CSV/TSV)
    ↓
DataObj 构造函数
    ↓
GMM.calculate() → controlPoints
    ↓
simulatedAnnealing() → optimizedColors
    ↓
getColormapArray() → colormap
    ↓
renderCanvas() → 2D可视化
```

---

## 十、总结

这个算法的核心创新在于：

1. **自动化**：GMM自动确定控制点数量，无需手动指定
2. **感知优化**：基于CIEDE2000和JND的评分机制，确保实际可区分
3. **全局优化**：模拟退火避免局部最优，找到最佳配色方案
4. **约束丰富**：融合感知、几何、语义、物理多种约束
5. **实时性**：纯前端实现，秒级生成高质量色图

这个文档详细描述了从数据输入到色图输出的完整流程，包括：
- 每个阶段的具体算法实现
- 关键参数的含义和调优建议
- 代码位置和函数调用关系
- 设计原则和技术亮点

适合作为算法理解、代码维护、或与其他AI系统交流的技术文档。
