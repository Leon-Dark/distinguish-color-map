#!/bin/bash
# Linux/Mac启动脚本

echo "🎨 Starting Distinguishable Colormap Generator..."

# 检查Python
echo ""
echo "📦 Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python not found! Please install Python first."
    exit 1
fi

# 检查Node.js
echo "📦 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found! Please install Node.js first."
    exit 1
fi

# 安装Python依赖
echo ""
echo "📥 Installing Python dependencies..."
pip3 install -r requirements.txt

# 启动Flask后端
echo ""
echo "🚀 Starting Flask backend on port 5000..."
export FLASK_APP=server.py
flask run -p 5000 &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 进入前端目录并安装依赖
echo ""
echo "📥 Installing frontend dependencies..."
cd frontend

if [ ! -d "node_modules" ]; then
    npm install
fi

# 启动React前端
echo ""
echo "🚀 Starting React frontend on port 3000..."
npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo "✅ Application started successfully!"
echo "   Backend: http://localhost:5000"
echo "   Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services..."

# 等待用户中断
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
