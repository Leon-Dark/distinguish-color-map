# Colormap 对比分析页面

## 📊 功能说明

这个页面用于展示优化算法生成的 colormap 与传统配色方案在 Lab 3D 空间中的对比效果。

## 🚀 访问方式

启动服务器后，访问：
- 主页工具：`http://localhost:5000/`
- 对比分析：`http://localhost:5000/comparison`

或在主页点击顶部的 **"📊 查看 Colormap 对比分析"** 按钮。

## 🎨 对比的 Colormap

页面展示以下配色方案的对比：

1. **✨ 优化后** - 使用我们的算法优化生成的 colormap
2. **🌈 Rainbow** - 经典彩虹配色
3. **🔥 Thermal** - 热力图配色
4. **🟣 Viridis** - Matplotlib 的感知均匀配色
5. **⚠️ Jet** - 传统 Jet 配色（存在感知问题，不推荐）

## 📈 对比指标

每个 colormap 显示以下指标：

- **平滑度 ↓**: Lab 空间中颜色轨迹的曲率，越小越好
- **平均对比度 ↑**: 不同区域的可区分性，越大越好
- **颜色区分度 ↑**: 基于颜色命名的语义差异，越大越好
- **综合评分**: 加权后的总分，越大越优秀

## 🎮 交互功能

- **旋转视图**: 在任意 3D 视图中拖动鼠标来旋转 Lab 空间
- **同步旋转**: 点击 "🔗 同步旋转" 按钮，所有视图将同步旋转
- **切换数据集**: 使用顶部的下拉菜单切换不同的测试数据集

## 📁 文件结构

```
templates/
  └── comparison.html         # 对比页面 HTML
static/
  ├── css/
  │   └── comparison.css      # 对比页面样式
  └── js/
      ├── builtinColormaps.js # 内置 colormap 定义
      └── comparison.js       # 对比页面逻辑
```

## 🔧 自定义配色

要添加更多内置 colormap，编辑 `static/js/builtinColormaps.js`：

```javascript
const BUILTIN_COLORMAPS = {
    my_colormap: {
        name: "My Colormap",
        description: "自定义配色说明",
        controlColors: [
            [0, 80, 50],    // HCL: [Hue, Chroma, Lightness]
            [120, 80, 50],
            [240, 80, 50]
        ],
        category: "自定义"
    }
};
```

然后在 `comparison.js` 的 `COMPARISON_COLORMAPS` 数组中添加名称。

## 💡 使用建议

1. **演示用途**: 适合用于论文、报告、演讲中展示算法优势
2. **视觉对比**: 清晰展示平滑度优化的效果
3. **量化分析**: 提供客观的数值指标支持结论

## 🎯 预期效果

优化后的 colormap 应该在以下方面表现更好：
- Lab 3D 空间中的轨迹更加平滑（更少的急转弯）
- 平滑度指标数值更低
- 综合评分更高

传统 colormap（特别是 Rainbow 和 Jet）通常会显示：
- 不规则的折线轨迹
- 较高的平滑度惩罚
- 较低的综合评分
