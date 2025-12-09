# 🎨 Distinguishable Colormap Generator

基于高斯混合模型(GMM)的高可区分性色图生成系统，现已转换为 **纯前端 (Pure Frontend)** 架构。

## 🚀 快速开始

本项目已移除 Python 后端依赖，作为纯静态网站运行。

### 启动方式

**推荐使用 VS Code Live Server 插件** 或任意静态文件服务器。

**使用 Python 快速启动静态服务器:**

```bash
# 进入项目目录
python -m http.server 5000
```

然后打开浏览器访问:
```
http://localhost:5000/templates/index.html
```

(注意: 由于浏览器安全策略，直接双击打开 HTML 文件可能无法加载本地数据文件，建议使用静态服务器)

## 📁 项目结构

```
distinguishable-colormap/
├── templates/            # HTML 页面
│   ├── index.html       # 主页面
│   └── comparison.html  # 对比分析页面
├── static/               # 静态资源
│   ├── css/             # 样式文件
│   ├── js/              # JavaScript 模块
│   │   ├── index.js     # 主交互逻辑
│   │   ├── gmm.js       # GMM 算法 (纯前端实现)
│   │   ├── dataObj.js   # 数据对象类
│   │   ├── render.js    # 渲染功能
│   │   ├── optimizer.js # 模拟退火优化
│   │   ├── comparison.js # 对比模块逻辑
│   │   └── ...
│   └── data/            # 示例数据集
└── README.md            # 项目说明
```

## 🛠️ 技术栈

### 前端
- **HTML5** - 语义化标记
- **CSS3** - 现代化样式
- **JavaScript (ES6+)** - 原生 JavaScript
- **D3.js v4** - 数据可视化和颜色处理
- **GMM (JS)** - 原生 JavaScript 实现的高斯混合模型算法

### 后端
- **无** - 本项目不再需要后端服务器

## ✨ 功能特性

### 核心功能
- 📁 **数据加载**: 上传自定义CSV/TSV数据或使用预置示例
- 🎨 **颜色优化**: 基于模拟退火算法的色图优化
- 🤖 **智能控制点**: 前端 GMM 自动检测最优控制点数量
- 🌈 **HCL色彩空间**: 保证感知一致性
- 📊 **实时可视化**: 即时预览色图效果
- 🎯 **交互式调整**: 自定义初始色相和颜色数量

### 面板功能
- **Parameter Panel**: 数据加载、颜色数量选择、优化控制
- **Render Panel**: 标量场可视化渲染
- **Colormap Panel**: 色图渐变显示
- **Control Panel**: 控制点颜色轮显示
- **History Panel**: 历史记录管理
- **Comparison View**: 实时对比多种配色方案 (独立页面)

### 导出格式
- 💾 CSV格式
- 📋 JSON格式  
- 🔬 ParaView格式
- 📈 VisIt格式

