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

        // var url = "/calcGmm",
        //     data = {
        //         data: JSON.stringify(data)
        //     };
        // $.post(url, data, function (d) {
        //     window.location.href = d;
        // });
        fetch('/calcGmm/' + num, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data: data })
        })
            .then(response => response.json()) // 解析 JSON 响应
            .then(data => {
                d3.select("#statusId").style("display", "none")
                document.body.style.pointerEvents = 'auto'; // 恢复页面点击
                console.log(data);
                this.controlPoints = data['received_array']
                // this.controlPoints = [1.2786, 32.956163950670096, 33.189054280287735, 34.14079113688461, 34.669144017347115, 35.41237756621667, 36.26739419083998, 39.829]
                // this.controlPoints = [1.2786, 30.838503269882978, 32.90590692296, 34.444300260344086, 35.38504796661167, 36.30432687062196, 39.829]
                // console.log(this, this.controlPoints);
                // regenerate control colors
                let control_colors = []
                for (let i = 0; i < this.controlPoints.length; i++) {
                    // let v = 10 + 80 * i / (this.controlPoints.length - 1)
                    control_colors.push([360 - i * 360 / this.controlPoints.length, 0, i % 2 == 0 ? 10 : 90])
                }
                // control_colors = [[345, 39.72143184582182, 16], [312, 57, 77], [302, 54.03600876626366, 10], [162, 69.83372960937498, 90], [137, 44.012666865176534, 23], [79, 65.25, 87], [33, 41.812033521917705, 29.848857801796104], [13, 85.7375, 55]]
                // control_colors = [[340, 41.812033521917705, 25], [312, 57, 77], [300, 48.76749791155295, 10], [162, 69.83372960937498, 90], [139, 41.812033521917705, 23], [121, 100, 90], [56.77557352250712, 44.012666865176534, 28.349030329381918], [18.972487622738083, 77.37809374999999, 48]]
                // control_colors = [[327, 44.012666865176534, 18], [267.57142857142856, 51.33420832795048, 60], [226.1428571428571, 17.482461472379697, 27.946161784905936], [157.71428571428578, 73.50918906249998, 90], [136.28571428571428, 44.012666865176534, 31.414213562373096], [100.85714285714289, 90.25, 90], [3.428571428571445, 39.72143184582182, 33]]
                // control_colors = [[270, 23.782688525533217, 18], [221, 34.05616262881148, 60], [183, 22.593554099256554, 28], [136, 100, 90], [108, 37.73536025353073, 28], [94, 85.7375, 90], [33, 41.812033521917705, 15], [21, 88.25, 57], [314, 51.33420832795048, 10]]
                // teaser[[270, 23.782688525533217, 18], [169, 63.02494097246091, 90], [145, 35.84859224085419, 23], [101, 90.25, 90], [34, 44.012666865176534, 16], [322, 100, 62]]
                // [[270, 23.782688525533217, 18], [172, 59.87369392383786, 90], [145, 35.84859224085419, 23], [95, 85.7375, 90], [13, 39.72143184582182, 17], [321, 99, 63]]
                // [[270, 23.782688525533217, 18], [169, 63.02494097246091, 90], [144, 35.84859224085419, 23], [112, 90.25, 90], [23, 41.812033521917705, 17], [13, 85.7375, 55]]
                // [[270, 23.782688525533217, 18], [169, 63.02494097246091, 90], [145, 35.84859224085419, 23], [113, 95, 90], [34, 44.012666865176534, 16], [322, 100, 62]]
                this.controlColors = control_colors
                // 保存初始状态用于对比
                this.initialControlColors = JSON.parse(JSON.stringify(control_colors))
                
                this.colormap = this.getColormapArray()
                console.log(this);

                addToHistory()
                drawColormap(this)
                drawControlPoints(this)
                drawColorWheel(this)
                renderCanvas(this)
                // drawAllExamples()
                // drawHistogramWithMultipleGaussians(this.data, data['GMM'])
            })
            .catch(error => console.error('Error:', error));

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