# Automatic Turbo-like Colormap Generator

一个基于浏览器的自动化感知优化颜色映射生成器，可与 Google 的 Turbo colormap 进行对比展示。

## 特性

- 🎨 **自动生成**：通过感知优化自动生成类 Turbo 的颜色映射
- 📊 **全面对比**：颜色条、RGB 曲线、感知亮度、ΔE 差异对比
- 🖼️ **图像测试**：三种测试标量场的可视化对比
- ⚙️ **可调参数**：迭代次数、随机种子、量化级数、优化权重
- 🚀 **非阻塞优化**：使用 Web Worker 保持 UI 响应
- 💾 **导出功能**：导出为 JSON 和 CSS gradient 格式

## 快速开始

### 直接运行

1. 将所有文件放在同一目录下
2. 用浏览器打开 `index.html`
3. 点击 "🚀 Generate Colormap" 开始优化

**注意**：由于使用了 Web Worker，建议通过本地服务器运行以避免 CORS 问题。如果直接打开 HTML 文件，Worker 可能无法加载，系统会自动降级到主线程运行（可能会短暂冻结 UI）。

### 使用本地服务器（推荐）

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server

# PHP
php -S localhost:8000
```

然后访问 `http://localhost:8000`

## 使用说明

### 1. 调整参数

**优化参数：**
- **Iterations（迭代次数）**：200-5000，默认 1000
  - 更多迭代 = 更好的结果，但耗时更长
- **Seed（随机种子）**：0-999999，默认 42
  - 相同种子产生相同结果，便于复现
- **Quantization Points（量化级数）**：16-64，默认 33
  - 用于评估量化后的颜色区分度
- **Samples (M)（采样数）**：64-512，默认 256
  - 评估 colormap 的采样点数量

**优化权重（可调节三个关键权重）：**
- **w1 - Contrast（对比度）**：0-5，默认 1.0
  - 鼓励感知步长，提高细节可见性
- **w3 - Step Smoothness（步长平滑度）**：0-2，默认 0.5
  - 抑制 banding 效应，确保均匀过渡
- **w5 - Lightness Match（亮度匹配）**：0-2，默认 0.8
  - 匹配目标亮度曲线（低-高-低）

### 2. 生成 Colormap

点击 "🚀 Generate Colormap" 按钮开始优化过程。

优化期间会实时显示：
- 当前得分和最佳得分
- 优化进度和已用时间
- 实时更新的颜色条和曲线图

### 3. 查看对比

**Colormap Comparison（颜色映射对比）：**
- **Color Strips**：256 个采样点的颜色条
- **RGB Channels**：红绿蓝三通道曲线（实线 = Turbo，虚线 = Generated）
- **Perceptual Lightness**：OKLab 色彩空间中的亮度曲线
- **Difference ΔE**：两个 colormap 在 OKLab 空间中的欧氏距离

**Image Comparison（图像对比）：**
- **Smooth Gradient**：平滑渐变
- **Radial Gradient**：径向渐变
- **Multi-frequency Pattern**：多频率波纹图案

### 4. 导出结果

点击 "💾 Export" 按钮导出生成的 colormap：
- JSON 文件包含：256 个颜色采样点、RGB 值、7 个 knot 控制点
- CSS gradient 字符串会输出到浏览器控制台

## 默认参数

### 优化参数
```javascript
iterations: 1000        // 迭代次数
seed: 42               // 随机种子
nq: 33                 // 量化级数
samples: 256           // 采样数 M
```

### 优化权重
```javascript
w1: 1.0    // Contrast (mean perceptual step)
w2: 0.3    // Anchor separation
w3: 0.5    // Step smoothness (variance penalty)
w4: 0.2    // Curvature smoothness
w5: 0.8    // Lightness profile matching
w6: 0.4    // Quantization robustness
w7: 2.0    // Gamut/Clipping penalty
```

## 技术实现

### 文件结构

```
turbo-gen/
├── index.html          # 主页面布局和 UI
├── styles.css          # 样式表
├── turbo.js           # Official Turbo 多项式实现
├── perceptual.js      # OKLab 色彩空间转换
├── spline.js          # 7-knot 三次样条插值
├── generator.js       # 评分系统和优化器
├── worker.js          # Web Worker（非阻塞优化）
├── app.js             # UI 连接和渲染逻辑
└── README.md          # 本文档
```

### 核心算法

**1. Turbo Colormap**
- 使用 Google 提供的 7 次多项式近似
- 每个通道（R/G/B）独立计算
- 输出 sRGB [0,1] 范围

**2. 生成器参数化**
- 7 个固定位置的控制点（knots）：[0, 1/6, 2/6, 3/6, 4/6, 5/6, 1]
- Catmull-Rom 三次样条插值保证平滑过渡
- 初始化：基于 HSV/OKLab 的自动色相扫描

**3. 感知评分系统**
在 OKLab 色彩空间中评估以下指标：
- **Contrast**：最大化平均感知步长
- **Step smoothness**：最小化步长方差（防止 banding）
- **Curvature**：最小化二阶差分（平滑度）
- **Lightness profile**：匹配目标亮度曲线（低-高-低）
- **Anchor separation**：最大化关键点间距离
- **Quantization**：确保量化后仍可区分
- **Clipping penalty**：惩罚超出 sRGB 色域的值

**4. 优化算法**
- 模拟退火（Simulated Annealing）
- 随机扰动 knot 的 RGB 值
- 温度衰减率：0.995
- 接受概率：exp((new_score - old_score) / temperature)

**5. 感知色彩空间**
- OKLab：更符合人眼感知的均匀色彩空间
- ΔE 距离：欧氏距离 sqrt(ΔL² + Δa² + Δb²)
- sRGB ↔ Linear RGB ↔ OKLab 完整转换链

## 性能优化

- **Web Worker**：将优化过程移到后台线程，避免阻塞 UI
- **分帧更新**：每 10 次迭代更新一次进度
- **降级策略**：Worker 不可用时自动使用 requestAnimationFrame 分帧执行

## 浏览器兼容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

需要支持：
- Canvas API
- Web Workers（推荐但非必需）
- ES6+（箭头函数、模板字符串、解构等）

## 调优建议

### 追求最佳质量
- 增加迭代次数到 3000-5000
- 提高 w1（对比度）和 w5（亮度匹配）
- 降低 w3（步长平滑度）以允许更多变化

### 追求平滑过渡
- 提高 w3（步长平滑度）和 w4（曲率平滑度）
- 降低 w1（对比度）
- 增加采样数到 512

### 匹配 Turbo 风格
- 保持默认权重
- 增加迭代次数
- 尝试不同随机种子

## 导出格式示例

### JSON 格式
```json
{
  "colors": [
    {"u": 0.0, "r": 0.19, "g": 0.07, "b": 0.48},
    {"u": 0.004, "r": 0.20, "g": 0.09, "b": 0.51},
    ...
  ],
  "cssGradient": "linear-gradient(to right, rgb(48,18,122) 0%, ...)",
  "knots": [
    [0.19, 0.07, 0.48],
    ...
  ]
}
```

### CSS Gradient（控制台输出）
```css
background: linear-gradient(to right, 
  rgb(48,18,122) 0%, 
  rgb(51,21,130) 0.4%, 
  ...
  rgb(122,4,3) 100%
);
```

## 常见问题

**Q: 为什么优化结果每次都不一样？**  
A: 使用不同的随机种子会产生不同的结果。固定 seed 可以复现结果。

**Q: 优化过程中浏览器卡死了？**  
A: 可能是 Web Worker 未加载，降级到主线程运行。建议通过本地服务器运行。

**Q: 如何让生成的 colormap 更接近 Turbo？**  
A: 增加 w5（亮度匹配）权重，增加迭代次数，调整随机种子。

**Q: ΔE 值的合理范围是多少？**  
A: 一般 0.05-0.15 表示接近 Turbo，<0.05 表示非常接近，>0.2 表示差异较大。

## 许可

本项目仅供学习和研究使用。Turbo colormap 版权归 Google LLC 所有。

## 参考资料

- [Turbo Colormap by Google](https://ai.googleblog.com/2019/08/turbo-improved-rainbow-colormap-for.html)
- [OKLab Color Space](https://bottosson.github.io/posts/oklab/)
- [Catmull-Rom Splines](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline)
- [Simulated Annealing](https://en.wikipedia.org/wiki/Simulated_annealing)
