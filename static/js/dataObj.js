class DataObj {
    constructor(data, num = 0) {
        this.data = data
        this.extent = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]
        for (let i = 0; i < data.length; i++) {
            for (let j = 0; j < data[i].length; j++) {
                if (!isNaN(data[i][j])) {
                    let value = Number(data[i][j]);
                    if (this.extent[0] > value) this.extent[0] = value;
                    if (this.extent[1] < value) this.extent[1] = value;
                }
            }
        }
        console.log("extent:", this.extent);

        this.height = data.length
        this.width = data[0].length
        this.controlPoints = this.extent
        this.controlColors = [[0, 0, 10], [0, 0, 90]]

        // Use local pure frontend GMM calculation
        setTimeout(() => {
            try {
                let result = window.GMM.calculate(data, num);
                let responseData = result; // Match the structure
                
                d3.select("#statusId").style("display", "none");
                document.body.style.pointerEvents = 'auto'; // 恢复页面点击
                console.log(responseData);
                this.controlPoints = responseData['received_array'];
                
                // regenerate control colors
                let control_colors = [];
                for (let i = 0; i < this.controlPoints.length; i++) {
                    control_colors.push([360 - i * 360 / this.controlPoints.length, 0, i % 2 == 0 ? 10 : 90]);
                }
                
                this.controlColors = control_colors;
                // 保存初始状态用于对比
                this.initialControlColors = JSON.parse(JSON.stringify(control_colors));
                
                this.colormap = this.getColormapArray();
                console.log(this);

                addToHistory();
                drawColormap(this);
                drawControlPoints(this);
                drawColorWheel(this);
                renderCanvas(this);
                
                // Update comparison if available
                if (typeof updateFullComparison === 'function') {
                    updateFullComparison(this);
                }
            } catch (error) {
                console.error('GMM Calculation Error:', error);
                d3.select("#statusId").style("display", "none");
                document.body.style.pointerEvents = 'auto';
            }
        }, 10);

    }

    getWidth() {
        return this.width
    }

    getHeight() {
        return this.height
    }

    setControlPoints(x) {
        this.controlPoints = x
        this.colormap = this.getColormapArray()
    }

    setControlColors(x) {
        this.controlColors = x
        this.colormap = this.getColormapArray()
    }

    getColor(x) {
        let hcl = [0, 0, 0]
        let id = Math.floor((x - this.extent[0]) / (this.extent[1] - this.extent[0]) * (this.colormap.length - 1))
        hcl = this.colormap[id]
        let tuple = color2rgb(hcl)
        return tuple
    }

    getColormapArrayLab(targetControlColors = null) {
        let sourceControlColors = targetControlColors || this.controlColors;
        let colormap = []
        let step = (this.extent[1] - this.extent[0]) / 1000
        for (let i = 0; i < sourceControlColors.length - 1; i++) {
            let step_num = Math.floor((this.controlPoints[i + 1] - this.controlPoints[i]) / step)
            step_num = Math.max(step_num, 1)
            for (let j = 0; j < step_num; j++) {
                let hcl = [0, 0, 0]
                // 使用与 getColormapArray 一致的 Hue 插值逻辑（最短路径）
                let h1 = sourceControlColors[i][0];
                let h2 = sourceControlColors[i + 1][0];
                let diff = h2 - h1;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                
                hcl[0] = (h1 + diff * (j / step_num) + 360) % 360;
                
                hcl[1] = sourceControlColors[i][1] + (sourceControlColors[i + 1][1] - sourceControlColors[i][1]) * j / step_num
                hcl[2] = sourceControlColors[i][2] + (sourceControlColors[i + 1][2] - sourceControlColors[i][2]) * j / step_num
                
                // 转换为 Lab (D3 v4 使用大写 L)
                let color = d3.lab(d3.hcl(hcl[0], hcl[1], hcl[2]))
                colormap.push([color.L, color.a, color.b])
            }
        }
        
        // 添加最后一个点
        let lastHCL = sourceControlColors[sourceControlColors.length - 1];
        let lastColor = d3.lab(d3.hcl(lastHCL[0], lastHCL[1], lastHCL[2]));
        colormap.push([lastColor.L, lastColor.a, lastColor.b]);

        return colormap
    }
    getColormapArray() {
        let colormap = []
        let step = (this.extent[1] - this.extent[0]) / 1000
        for (let i = 0; i < this.controlColors.length - 1; i++) {
            let step_num = Math.floor((this.controlPoints[i + 1] - this.controlPoints[i]) / step)
            step_num = Math.max(step_num, 1)
            for (let j = 0; j < step_num; j++) {
                let hcl = [0, 0, 0]

                // 使用最短路径插值
                let h1 = this.controlColors[i][0];
                let h2 = this.controlColors[i + 1][0];
                let diff = h2 - h1;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                
                hcl[0] = (h1 + diff * (j / step_num) + 360) % 360;

                hcl[1] = this.controlColors[i][1] + (this.controlColors[i + 1][1] - this.controlColors[i][1]) * j / step_num
                hcl[2] = this.controlColors[i][2] + (this.controlColors[i + 1][2] - this.controlColors[i][2]) * j / step_num
                colormap.push(hcl)
            }
        }
        colormap.push(this.controlColors[this.controlColors.length - 1])

        return colormap
    }
}