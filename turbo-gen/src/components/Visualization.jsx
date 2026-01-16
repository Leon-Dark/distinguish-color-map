import React, { useEffect, useRef } from 'react';
import { turboRGB } from '../utils/turbo';
import * as Spline from '../utils/spline';
import * as Perceptual from '../utils/perceptual';

export default function Visualization({ generatedKnots, deltaEMax }) {
    const turboStripRef = useRef(null);
    const genStripRef = useRef(null);
    const rgbChartRef = useRef(null);
    const lightChartRef = useRef(null);
    const deltaChartRef = useRef(null);

    // Image refs
    const gradTurboRef = useRef(null);
    const gradGenRef = useRef(null);
    const radialTurboRef = useRef(null);
    const radialGenRef = useRef(null);
    const patternTurboRef = useRef(null);
    const patternGenRef = useRef(null);

    useEffect(() => {
        if (!generatedKnots) return;

        const render = () => {
            renderColorStrip(turboStripRef.current, turboRGB);
            renderColorStrip(genStripRef.current, (u) => Spline.evaluateRGB(u, generatedKnots));

            renderRGBChart(rgbChartRef.current, generatedKnots);
            renderLightnessChart(lightChartRef.current, generatedKnots);
            renderDeltaChart(deltaChartRef.current, generatedKnots);

            renderImages(
                gradTurboRef.current, gradGenRef.current,
                radialTurboRef.current, radialGenRef.current,
                patternTurboRef.current, patternGenRef.current,
                generatedKnots
            );
        };

        requestAnimationFrame(render);
    }, [generatedKnots]);

    return (
        <div className="visualization-panel">
            <h2>Visualization</h2>

            <div className="colormap-strips">
                <div className="strip-container">
                    <h3>Turbo (Target)</h3>
                    <canvas ref={turboStripRef} id="turbo-strip" width="300" height="40"></canvas>
                </div>
                <div className="strip-container">
                    <h3>Generated</h3>
                    <canvas ref={genStripRef} id="generated-strip" width="300" height="40"></canvas>
                </div>
            </div>

            <div className="charts-grid">
                <div className="chart-container">
                    <h3>RGB Components</h3>
                    <canvas ref={rgbChartRef} id="rgb-chart" width="400" height="200"></canvas>
                </div>
                <div className="chart-container">
                    <h3>Lightness (OKLab L)</h3>
                    <canvas ref={lightChartRef} id="lightness-chart" width="400" height="200"></canvas>
                </div>
                <div className="chart-container">
                    <h3>Perceptual Difference (ΔE OK)</h3>
                    <canvas ref={deltaChartRef} id="delta-chart" width="400" height="200"></canvas>
                </div>
            </div>

            <div className="image-comparison">
                <div className="image-set">
                    <h3>Smooth Gradient</h3>
                    <div className="image-pair">
                        <div className="image-item">
                            <h4>Turbo</h4>
                            <canvas ref={gradTurboRef} width="256" height="256"></canvas>
                        </div>
                        <div className="image-item">
                            <h4>Generated</h4>
                            <canvas ref={gradGenRef} width="256" height="256"></canvas>
                        </div>
                    </div>
                </div>

                <div className="image-set">
                    <h3>Radial Gradient</h3>
                    <div className="image-pair">
                        <div className="image-item">
                            <h4>Turbo</h4>
                            <canvas ref={radialTurboRef} width="256" height="256"></canvas>
                        </div>
                        <div className="image-item">
                            <h4>Generated</h4>
                            <canvas ref={radialGenRef} width="256" height="256"></canvas>
                        </div>
                    </div>
                </div>

                <div className="image-set">
                    <h3>Multi-Frequency</h3>
                    <div className="image-pair">
                        <div className="image-item">
                            <h4>Turbo</h4>
                            <canvas ref={patternTurboRef} width="256" height="256"></canvas>
                        </div>
                        <div className="image-item">
                            <h4>Generated</h4>
                            <canvas ref={patternGenRef} width="256" height="256"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper functions (Ported from app.js)

function renderColorStrip(canvas, colorFunc) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    for (let x = 0; x < width; x++) {
        const u = x / (width - 1);
        const rgb = colorFunc(u);
        const r = Math.round(rgb[0] * 255);
        const g = Math.round(rgb[1] * 255);
        const b = Math.round(rgb[2] * 255);

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, 0, 1, height);
    }
}

function drawGrid(ctx, width, height) {
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
        const y = (i / 4) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    for (let i = 0; i <= 4; i++) {
        const x = (i / 4) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
}

function drawCurve(ctx, data, width, height, color, lineWidth, dashed) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    if (dashed) {
        ctx.setLineDash([5, 5]);
    } else {
        ctx.setLineDash([]);
    }

    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * width;
        const y = height - data[i] * height; // Invert Y

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    ctx.setLineDash([]);
}

function renderRGBChart(canvas, knots) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const samples = 256;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    drawGrid(ctx, width, height);

    const turboR = [], turboG = [], turboB = [];
    const genR = [], genG = [], genB = [];

    for (let i = 0; i < samples; i++) {
        const u = i / (samples - 1);
        const trgb = turboRGB(u);
        const grgb = Spline.evaluateRGB(u, knots);

        turboR.push(trgb[0]); turboG.push(trgb[1]); turboB.push(trgb[2]);
        genR.push(grgb[0]); genG.push(grgb[1]); genB.push(grgb[2]);
    }

    drawCurve(ctx, turboR, width, height, '#ff4444', 2, false);
    drawCurve(ctx, turboG, width, height, '#44ff44', 2, false);
    drawCurve(ctx, turboB, width, height, '#4444ff', 2, false);

    drawCurve(ctx, genR, width, height, '#ff0000', 1.5, true);
    drawCurve(ctx, genG, width, height, '#00ff00', 1.5, true);
    drawCurve(ctx, genB, width, height, '#0000ff', 1.5, true);

    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.fillText('Solid: Turbo | Dashed: Generated', 10, 20);
}

function renderLightnessChart(canvas, knots) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const samples = 256;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    drawGrid(ctx, width, height);

    const turboL = [];
    const genL = [];

    for (let i = 0; i < samples; i++) {
        const u = i / (samples - 1);
        const tlab = Perceptual.sRGBToOKLab(turboRGB(u));
        const glab = Perceptual.sRGBToOKLab(Spline.evaluateRGB(u, knots));

        turboL.push(tlab[0]);
        genL.push(glab[0]);
    }

    drawCurve(ctx, turboL, width, height, '#667eea', 2, false);
    drawCurve(ctx, genL, width, height, '#764ba2', 2, true);

    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.fillText('Blue: Turbo (Target) | Purple: Generated', 10, 20);
}

function renderDeltaChart(canvas, knots) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const samples = 256;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    drawGrid(ctx, width, height);

    const deltaE = [];

    for (let i = 0; i < samples; i++) {
        const u = i / (samples - 1);
        const tlab = Perceptual.sRGBToOKLab(turboRGB(u));
        const glab = Perceptual.sRGBToOKLab(Spline.evaluateRGB(u, knots));
        const de = Perceptual.deltaE_OKLab(tlab, glab);
        deltaE.push(de / 0.5); // Scaled
    }

    drawCurve(ctx, deltaE, width, height, '#ff6b6b', 2, false);

    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.fillText('Scaled to 0.5 max', 10, 20);
}

function renderImages(c1, c2, c3, c4, c5, c6, knots) {
    const size = 256;

    // Generate fields only once or memoize ideally, but quick recalc is fine
    const gradient = generateSmoothGradient(size);
    const radial = generateRadialGradient(size);
    const pattern = generateMultiFrequencyPattern(size);

    applyColormapToImage(gradient, c1, turboRGB);
    applyColormapToImage(gradient, c2, (u) => Spline.evaluateRGB(u, knots));

    applyColormapToImage(radial, c3, turboRGB);
    applyColormapToImage(radial, c4, (u) => Spline.evaluateRGB(u, knots));

    applyColormapToImage(pattern, c5, turboRGB);
    applyColormapToImage(pattern, c6, (u) => Spline.evaluateRGB(u, knots));
}

function generateSmoothGradient(size) {
    const field = [];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            field.push(x / (size - 1));
        }
    }
    return field;
}

function generateRadialGradient(size) {
    const field = [];
    const cx = size / 2, cy = size / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            field.push(Math.min(1, dist / maxDist));
        }
    }
    return field;
}

function generateMultiFrequencyPattern(size) {
    const field = [];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const nx = x / size, ny = y / size;
            let val = 0.5 * Math.sin(nx * Math.PI * 4) +
                0.3 * Math.sin(ny * Math.PI * 8) +
                0.2 * Math.sin((nx + ny) * Math.PI * 12);
            field.push(Math.max(0, Math.min(1, (val + 1) / 2)));
        }
    }
    return field;
}

function applyColormapToImage(field, canvas, colorFunc) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let i = 0; i < field.length; i++) {
        const rgb = colorFunc(field[i]);
        data[i * 4 + 0] = Math.round(rgb[0] * 255);
        data[i * 4 + 1] = Math.round(rgb[1] * 255);
        data[i * 4 + 2] = Math.round(rgb[2] * 255);
        data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
}
