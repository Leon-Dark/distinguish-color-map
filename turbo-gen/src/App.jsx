import React, { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';
import Visualization from './components/Visualization';
import * as Spline from './utils/spline';
import { exportColormap } from './utils/generator';

function App() {
  // State
  const [params, setParams] = useState({
    iterations: 1000,
    seed: 42,
    nq: 33,
    samples: 256,
    weights: { w1: 1.0, w2: 1.0, w3: 1.0 }
  });

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(null); // { progress, iteration, currentScore, bestScore, elapsed }
  const [generatedKnots, setGeneratedKnots] = useState(null);

  const workerRef = useRef(null);

  // Initialize
  useEffect(() => {
    // Initial knots
    const initialKnots = Spline.initializeKnots(params.seed);
    setGeneratedKnots(initialKnots);

    // Init worker
    workerRef.current = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = handleWorkerMessage;

    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  const handleWorkerMessage = useCallback((e) => {
    const { type, data } = e.data;
    if (type === 'progress') {
      setProgress(data);
      // Optional: Update visualization live? Might be too heavy. 
      // legacy app did: if (bestKnots) setGeneratedKnots(bestKnots)
      if (data.bestKnots) {
        setGeneratedKnots(data.bestKnots);
      }
    } else if (type === 'complete') {
      setGeneratedKnots(data.knots);
      setIsOptimizing(false);
      setProgress(prev => ({ ...prev, bestScore: data.score, elapsed: data.time, progress: 1 }));
    }
  }, []);

  const handleGenerate = () => {
    if (isOptimizing) return;

    // New seed for variety
    const newSeed = Math.floor(Math.random() * 1000000);
    const newParams = { ...params, seed: newSeed };
    setParams(newParams);

    setIsOptimizing(true);
    setProgress({ progress: 0, iteration: 0, currentScore: Infinity, bestScore: Infinity, elapsed: 0 });

    workerRef.current.postMessage({ type: 'optimize', params: newParams });
  };

  const handleExport = () => {
    if (!generatedKnots) return;
    const exported = exportColormap(generatedKnots, 256);
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-colormap.json';
    a.click();
    URL.revokeObjectURL(url);
    console.log('CSS Gradient:', exported.cssGradient);
    alert('Colormap exported! CSS Gradient logged to console.');
  };

  const updateParam = (key, value) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const updateWeight = (key, value) => {
    setParams(prev => ({ ...prev, weights: { ...prev.weights, [key]: parseFloat(value) } }));
  };

  return (
    <div className="container">
      <header>
        <h1>Turbo Colormap Generator</h1>
        <p>Optimizing perceptually uniform colormaps using Splines & OKLab</p>
      </header>

      <div className="controls-panel">
        <div className="control-group">
          <h3>Configuration</h3>
          <div className="control-row">
            <label>Iterations: {params.iterations}</label>
            <input type="range" min="100" max="5000" step="100"
              value={params.iterations}
              onChange={(e) => updateParam('iterations', parseInt(e.target.value))} />
          </div>
          <div className="control-row">
            <label>Quantization Steps (Nq): {params.nq}</label>
            <input type="range" min="5" max="256" step="1"
              value={params.nq}
              onChange={(e) => updateParam('nq', parseInt(e.target.value))} />
          </div>
        </div>

        <div className="control-group">
          <h3>Weights</h3>
          <div className="control-row">
            <label>Lightness Quality (w1): {params.weights.w1}</label>
            <input type="range" min="0" max="5" step="0.1"
              value={params.weights.w1}
              onChange={(e) => updateWeight('w1', e.target.value)} />
          </div>
          <div className="control-row">
            <label>Vibrancy (w2): {params.weights.w2}</label>
            <input type="range" min="0" max="5" step="0.1"
              value={params.weights.w2}
              onChange={(e) => updateWeight('w2', e.target.value)} />
          </div>
          <div className="control-row">
            <label>Smoothness (w3): {params.weights.w3}</label>
            <input type="range" min="0" max="5" step="0.1"
              value={params.weights.w3}
              onChange={(e) => updateWeight('w3', e.target.value)} />
          </div>
        </div>

        <div className="control-group">
          <h3>Actions</h3>
          <div className="button-row">
            <button className="primary-btn" onClick={handleGenerate} disabled={isOptimizing}>
              {isOptimizing ? '⏳ Optimizing...' : '🚀 Generate Colormap'}
            </button>
          </div>
          <div className="button-row">
            <button className="secondary-btn" onClick={handleExport} disabled={!generatedKnots}>
              💾 Export JSON
            </button>
          </div>

          {progress && (
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${progress.progress * 100}%` }}></div>
              <div className="progress-text">
                Iteration {progress.iteration} ({Math.round(progress.progress * 100)}%)
              </div>
            </div>
          )}

          <div className="stats">
            <div>Score: {progress?.bestScore?.toFixed(4) || '---'}</div>
            <div>Time: {(progress?.elapsed / 1000).toFixed(1) || '0.0'}s</div>
          </div>
        </div>
      </div>

      <Visualization generatedKnots={generatedKnots} />
    </div>
  );
}

export default App;
