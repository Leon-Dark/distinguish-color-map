
import numpy as np
import matplotlib.pyplot as plt
from sklearn.mixture import GaussianMixture as GMM
from concurrent.futures import ThreadPoolExecutor
from flask import Flask, request, render_template, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend
executor = ThreadPoolExecutor(2)

print("Running the Flask backend...")


@app.route('/calcGmm/<int:num>', methods=['POST'])
def calcGmm(num):
    # return jsonify({"message": "Array received successfully", "received_array": [0.00079546, 0.06730715180016834, 0.19494812093848618, 0.45675050273561446, 0.8809913677303491, 2.5502]})
    # 获取 JSON 数据
    data = request.json
    array = data.get('data', [])
    # 打印接收到的数组（调试用）
    # print("Received array:", array[0])

    # Handle ragged arrays by flattening first
    # This prevents "inhomogeneous shape" errors when rows have different lengths
    flat_list = []
    for row in array:
        if isinstance(row, list):
            for val in row:
                try:
                    # Convert to float, handling 'NaN' strings and empty strings
                    if val == '' or val is None:
                        flat_list.append(np.nan)
                    else:
                        flat_list.append(float(val))
                except (ValueError, TypeError):
                    flat_list.append(np.nan)
        else:
            try:
                flat_list.append(float(row))
            except (ValueError, TypeError):
                flat_list.append(np.nan)
    
    filtered_map = np.array(flat_list)
    # print("filtered_map array:", filtered_map)
    x = filtered_map[~np.isnan(filtered_map)]
    
    # Check if we have enough valid data
    if len(x) == 0:
        return jsonify({"error": "No valid data points after filtering NaN values"}), 400
    
    x = x.reshape(-1, 1)
    # print(x)

    mdls = []
    min_mdl = 0
    counter=1
    lamda=40
    
    # Determine optimal number of components
    if num==0:
        # Auto mode: test up to 10 components or number of unique values, whichever is smaller
        max_components = min(10, len(x))
        for i in range(max_components):
            gmm = GMM(n_components = counter, max_iter=1000, random_state=10, covariance_type = 'full')
            labels = gmm.fit(x).predict(x)
            mdl = -gmm.score(x)*x.size+lamda*3*counter*np.log(x.size)
            mdls.append(mdl)
            if mdl < min_mdl or min_mdl == 0:
                min_mdl = mdl
                opt_mdl = counter
            counter = counter + 1
    else:
        opt_mdl = num
        # Validate requested number of components
        if opt_mdl > len(x):
            return jsonify({"error": f"Requested {opt_mdl} components but only have {len(x)} data points"}), 400

    # print('Opt. components = '+str(opt_mdl))
    # print(mdls)

    # MDL to control points
    try:
        gmm = GMM(n_components = opt_mdl, max_iter=1000, random_state=10, covariance_type = 'full').fit(x)
    except Exception as e:
        return jsonify({"error": f"GMM fitting failed: {str(e)}"}), 500
    mean = gmm.means_
    std_dev = np.sqrt(gmm.covariances_.flatten())
    gmm_results = [{"mean": m, "stdDev": s} for m, s in zip(mean.flatten(), std_dev)]
    levels = sorted(mean.flatten())
    if levels[0] > filtered_map[~ np.isnan(filtered_map)].min():
        levels = [filtered_map[~ np.isnan(filtered_map)].min()] + levels
    if levels[-1] < filtered_map[~ np.isnan(filtered_map)].max():
        levels = levels+[filtered_map[~ np.isnan(filtered_map)].max()]
    
    # 返回响应
    return jsonify({"message": "Array received successfully", "received_array": levels, "GMM":gmm_results})

@app.route('/calcGmm2/<int:num>', methods=['POST'])
def calcGmm2(num):
    # return jsonify({"message": "Array received successfully", "received_array": [0.00079546, 0.06730715180016834, 0.19494812093848618, 0.45675050273561446, 0.8809913677303491, 2.5502]})
    # 获取 JSON 数据
    data = request.json
    array = data.get('data', [])
    # 打印接收到的数组（调试用）
    # print("Received array:", array[0])

    # Handle ragged arrays by flattening first
    flat_list = []
    for row in array:
        if isinstance(row, list):
            for val in row:
                try:
                    if val == '' or val is None:
                        flat_list.append(np.nan)
                    else:
                        flat_list.append(float(val))
                except (ValueError, TypeError):
                    flat_list.append(np.nan)
        else:
            try:
                flat_list.append(float(row))
            except (ValueError, TypeError):
                flat_list.append(np.nan)
    
    filtered_map = np.array(flat_list)
    # print("filtered_map array:", filtered_map)
    x = filtered_map[filtered_map > 0]
    
    # Check if we have enough valid data
    if len(x) == 0:
        return jsonify({"error": "No valid data points after filtering"}), 400
    
    x = x.reshape(-1, 1)
    # print(x)

    # Validate requested number of components
    if num > len(x):
        return jsonify({"error": f"Requested {num} components but only have {len(x)} data points"}), 400
    
    try:
        gmm = GMM(n_components = num, max_iter=1000, random_state=10, covariance_type = 'full').fit(x)
    except Exception as e:
        return jsonify({"error": f"GMM fitting failed: {str(e)}"}), 500
    mean = gmm.means_
    levels = sorted(mean.flatten())
    if levels[0] > filtered_map[~ np.isnan(filtered_map)].min():
        levels = [filtered_map[~ np.isnan(filtered_map)].min()] + levels
    if levels[-1] < filtered_map[~ np.isnan(filtered_map)].max():
        levels = levels+[filtered_map[~ np.isnan(filtered_map)].max()]
    
    # 返回响应
    return jsonify({"message": "Array received successfully", "received_array": levels})

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0')
