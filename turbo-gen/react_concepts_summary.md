# React 核心概念总结 - Turbo Colormap案例

这份文档总结了我们在重构 "Turbo Colormap Generator" 项目时学到的 React 核心概念。

## 1. 基础三剑客：构建界面的基石

### 组件 (Components)
*   **概念**：将这一大坨 HTML/JS 拆分成独立的、可复用的积木。
*   **代码**：`function App() { ... }`
*   **作用**：描述 UI 在某一时刻长什么样（声明式）。

### 状态 (State) - `useState`
*   **概念**：组件的“记性”。它是**驱动 React 更新的唯一动力**。
*   **代码**：`const [params, setParams] = useState(...)`
*   **规则**：
    *   **不能**直接改 (`params.seed = 1`)。
    *   **必须**用 `setParams`，一旦调用，React 立刻重新运行组件函数，计算差异并更新 DOM。

### 属性 (Props)
*   **概念**：组件之间的“传话筒”。父组件把数据传给子组件。
*   **代码**：`<Visualization generatedKnots={generatedKnots} />`
*   **作用**：子组件是被动的，Props 变了，子组件就会重绘。

---

## 2. 进阶钩子 (Hooks)：连接功能的桥梁

### 引用 (Refs) - `useRef`
*   **比喻**：穿越次元壁的**抓手**，或者是“低调”的**保险箱**。
*   **核心特性**：
    1.  **持久**：组件刷新它不丢。
    2.  **低调**：修改它**不会**触发组件重绘（和 State 相反）。
*   **用途**：
    *   抓取真实的 DOM 元素（如 `<canvas>`）。
    *   存储不需要驱动 UI 的对象（如 `Worker` 实例、定时器 ID）。

### 副作用 (Effects) - `useEffect`
*   **比喻**：告诉 React “**做完渲染后**，顺便帮我干点坏事”。
*   **代码**：
    ```javascript
    useEffect(() => {
        // 画图逻辑...
    }, [generatedKnots]); 
    ```
*   **依赖数组 `[]`**：
    *   **有内容 `[data]`**：当 `data` 变化时执行。
    *   **空数组 `[]`**：只在组件**出生（挂载）时**执行一次（如：初始化 Worker）。
    *   **没数组**：每次渲染都执行（危险！）。

### 回调 (Callback) - `useCallback`
*   **比喻**：一个**制造工厂**。
*   **作用**：为了**性能优化**。
*   **与 `useEffect` 的区别**：
    *   `useEffect` 是**自动执行**里面的动作。
    *   `useCallback` 是**返回一个函数**给你，以后用。
*   **空数组 `[]` 的含义**：只在第一次制造这个函数，以后永远复用同一个老函数（保证函数地址不变，适合传给 Worker 或子组件）。

---

## 3. 架构优化：Web Workers

### 为什么在 React 里它很重要？
JavaScript 是**单线程**（只有一个厨师）。如果 React 忙着算颜色（炒大菜），它就没法响应点击（招待客人），界面就会卡死。

### 最佳实践
1.  **利用 `useRef` 存储 Worker**：
    *   不能用普通变量（每次渲染都会重置）。
    *   不用 `useState`（Worker 仅仅是工具，不需要触发 UI 刷新）。
2.  **通信机制**：
    *   主线程 -> Worker：`worker.postMessage()` （传纸条进后厨）
    *   Worker -> 主线程：`onmessage` 回调 （后厨递菜出来）
    *   **Update State**：在 `onmessage` 里调用 `setProgress`，触发 React 重绘进度条。

---

## 4. 总结图谱

| 需求 | 使用什么？ | 会触发重绘吗？ | 典型场景 |
| :--- | :--- | :--- | :--- |
| **界面显示的数据** | `useState` | ✅ 会 | 输入框文字、进度条、颜色值 |
| **父传子数据** | `props` | ✅ (子组件) | 这里的 `generatedKnots` 传给图表 |
| **DOM /长存对象** | `useRef` | ❌ 不会 | Canvas 元素、Worker 实例 |
| **同步/绘图逻辑** | `useEffect` | - | 当数据变了，去操作 Canvas |
| **稳定函数引用** | `useCallback`| - | 给 Worker 绑定的回调函数 |
