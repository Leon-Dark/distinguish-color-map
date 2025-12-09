/**
 * 1D Gaussian Mixture Model (GMM) Implementation in JavaScript
 * Optimized for comparison view histogram analysis
 */

class GMM1D {
    /**
     * @param {number} nComponents - Number of Gaussian components
     * @param {number} maxIter - Maximum iterations for EM algorithm
     * @param {number} tol - Convergence tolerance
     */
    constructor(nComponents, maxIter = 100, tol = 1e-4) {
        this.nComponents = nComponents;
        this.maxIter = maxIter;
        this.tol = tol;
        
        // Model parameters
        this.means = [];
        this.variances = [];
        this.weights = [];
    }

    /**
     * Fit the model to 1D data using Expectation-Maximization
     * @param {Array<number>} data - 1D array of data points
     */
    fit(data) {
        if (!data || data.length === 0) return;
        
        const N = data.length;
        const K = this.nComponents;
        
        // 1. Initialization (K-Means++ style or simple quantile spread)
        this._initializeParameters(data);

        let logLikelihood = -Infinity;
        let prevLogLikelihood = -Infinity;

        for (let iter = 0; iter < this.maxIter; iter++) {
            // 2. E-Step: Calculate responsibilities
            // gamma[n][k] = P(z_n = k | x_n)
            let gamma = new Array(N).fill(0).map(() => new Array(K).fill(0));
            
            for (let n = 0; n < N; n++) {
                let x = data[n];
                let sumProb = 0;
                
                for (let k = 0; k < K; k++) {
                    let prob = this.weights[k] * this._gaussianPdf(x, this.means[k], this.variances[k]);
                    gamma[n][k] = prob;
                    sumProb += prob;
                }
                
                // Normalize responsibilities
                if (sumProb > 0) {
                    for (let k = 0; k < K; k++) {
                        gamma[n][k] /= sumProb;
                    }
                } else {
                    // Fallback for numerical stability
                    for (let k = 0; k < K; k++) {
                        gamma[n][k] = 1.0 / K;
                    }
                }
            }

            // 3. M-Step: Update parameters
            let Nk = new Array(K).fill(0);
            
            // Calculate sum of responsibilities for each component
            for (let k = 0; k < K; k++) {
                for (let n = 0; n < N; n++) {
                    Nk[k] += gamma[n][k];
                }
            }

            for (let k = 0; k < K; k++) {
                // Update weights
                this.weights[k] = Nk[k] / N;
                
                if (Nk[k] < 1e-10) continue; // Avoid division by zero

                // Update means
                let sumMean = 0;
                for (let n = 0; n < N; n++) {
                    sumMean += gamma[n][k] * data[n];
                }
                this.means[k] = sumMean / Nk[k];

                // Update variances
                let sumVar = 0;
                for (let n = 0; n < N; n++) {
                    let diff = data[n] - this.means[k];
                    sumVar += gamma[n][k] * diff * diff;
                }
                this.variances[k] = sumVar / Nk[k];
                
                // Add regularization to variance to prevent collapse
                this.variances[k] += 1e-6; 
            }

            // Calculate Log-Likelihood to check convergence
            logLikelihood = 0;
            for (let n = 0; n < N; n++) {
                let sumL = 0;
                for (let k = 0; k < K; k++) {
                    sumL += this.weights[k] * this._gaussianPdf(data[n], this.means[k], this.variances[k]);
                }
                if (sumL > 0) logLikelihood += Math.log(sumL);
            }

            if (Math.abs(logLikelihood - prevLogLikelihood) < this.tol) {
                break;
            }
            prevLogLikelihood = logLikelihood;
        }
        
        // Sort components by mean for consistent output (important for colormap ordering)
        this._sortComponents();
    }
    
    _initializeParameters(data) {
        const K = this.nComponents;
        const minVal = Math.min(...data);
        const maxVal = Math.max(...data);
        const variance = (maxVal - minVal) ** 2 / (K * K);

        this.weights = new Array(K).fill(1.0 / K);
        this.variances = new Array(K).fill(variance || 1.0);
        this.means = [];

        // Simple initialization: spread means evenly across the data range
        if (minVal === maxVal) {
             for (let k = 0; k < K; k++) this.means.push(minVal);
        } else {
            const step = (maxVal - minVal) / (K + 1);
            for (let k = 0; k < K; k++) {
                this.means.push(minVal + step * (k + 1));
            }
        }
    }

    _gaussianPdf(x, mean, variance) {
        let std = Math.sqrt(variance);
        if (std < 1e-9) std = 1e-9;
        const exponent = -0.5 * Math.pow((x - mean) / std, 2);
        return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
    }
    
    _sortComponents() {
        // Zip parameters together
        let components = this.means.map((m, i) => ({
            mean: m,
            variance: this.variances[i],
            weight: this.weights[i]
        }));
        
        // Sort by mean
        components.sort((a, b) => a.mean - b.mean);
        
        // Unzip
        this.means = components.map(c => c.mean);
        this.variances = components.map(c => c.variance);
        this.weights = components.map(c => c.weight);
    }
    
    /**
     * Calculate Bayesian Information Criterion (BIC)
     * BIC = k * ln(n) - 2 * ln(L)
     * k: number of parameters estimated (3 * K - 1)
     * n: number of data points
     * L: likelihood of the model
     */
    score(data) {
        const n = data.length;
        const K = this.nComponents;
        
        // Calculate Log Likelihood
        let logLikelihood = 0;
        for (let i = 0; i < n; i++) {
            let sumL = 0;
            for (let k = 0; k < K; k++) {
                sumL += this.weights[k] * this._gaussianPdf(data[i], this.means[k], this.variances[k]);
            }
            if (sumL > 0) logLikelihood += Math.log(sumL);
        }
        
        // Number of free parameters: K means + K variances + (K-1) weights
        const kParams = 3 * K - 1;
        
        // BIC formula (lower is better usually, but here we return a score to MINIMIZE)
        // Standard BIC = k*ln(n) - 2*ln(L)
        // Python code used: -gmm.score(x)*x.size + lamda*3*counter*np.log(x.size)
        // gmm.score() in sklearn returns per-sample average log-likelihood. 
        // So gmm.score(x)*x.size is total log likelihood.
        // Python Logic: MDL = -TotalLogLikelihood + lambda * 3 * K * log(N)
        
        const lambda = 40; // Matching server.py
        return -logLikelihood + lambda * 3 * K * Math.log(n);
    }
}

/**
 * Main function to replace the backend endpoint /calcGmm
 * @param {Array} data - Raw 2D array data
 * @param {number} num - Desired number of components (0 for auto)
 * @returns {Object} Result object similar to backend response
 */
function calculateGMM(data, num) {
    // 1. Flatten and filter data
    let flatData = [];
    data.forEach(row => {
        row.forEach(val => {
            let numVal = parseFloat(val);
            if (!isNaN(numVal)) {
                flatData.push(numVal);
            }
        });
    });

    if (flatData.length === 0) {
        throw new Error("No valid data points found");
    }
    
    // Subsample if data is too large for JS performance (optional, but recommended for large datasets)
    const MAX_SAMPLES = 5000; 
    if (flatData.length > MAX_SAMPLES) {
        // Random subsampling
        let sampled = [];
        for(let i=0; i<MAX_SAMPLES; i++) {
            sampled.push(flatData[Math.floor(Math.random() * flatData.length)]);
        }
        flatData = sampled;
    }

    let optMdl = num;
    let finalModel = null;

    if (num === 0) {
        // Auto mode
        let minMdlScore = Infinity;
        let maxComponents = Math.min(10, flatData.length);
        
        for (let k = 1; k <= maxComponents; k++) {
            let gmm = new GMM1D(k);
            gmm.fit(flatData);
            let score = gmm.score(flatData);
            
            if (score < minMdlScore) {
                minMdlScore = score;
                optMdl = k;
                finalModel = gmm;
            }
        }
    } else {
        // Fixed number mode
        finalModel = new GMM1D(num);
        finalModel.fit(flatData);
    }
    
    // Extract means (levels)
    let levels = finalModel.means.slice(); // Sorted means
    
    // Add min/max range padding if needed (matching backend logic)
    const minVal = Math.min(...flatData);
    const maxVal = Math.max(...flatData);
    
    if (levels[0] > minVal) {
        levels.unshift(minVal);
    }
    if (levels[levels.length - 1] < maxVal) {
        levels.push(maxVal);
    }

    return {
        received_array: levels,
        GMM: finalModel.means.map((m, i) => ({
            mean: m,
            stdDev: Math.sqrt(finalModel.variances[i])
        }))
    };
}

// Export for use
window.GMM = {
    calculate: calculateGMM
};
