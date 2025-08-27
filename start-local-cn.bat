@echo off
chcp 936 >nul
echo ====================================
echo     FitData 可视化工具本地启动
echo ====================================
echo.

echo 正在检查Node.js环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未检测到Node.js环境
    echo 请先安装Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js环境检查通过
echo.

echo 进入项目目录...
cd /d "%~dp0fitdata-visualizer"

echo 检查依赖是否已安装...
if not exist "node_modules" (
    echo 正在安装项目依赖...
    echo 注意: 首次运行需要联网下载依赖包
    npm install
    if %errorlevel% neq 0 (
        echo 依赖安装失败，请检查网络连接
        pause
        exit /b 1
    )
    echo 依赖安装完成
) else (
    echo 依赖已存在，跳过安装
)

echo.
echo 启动开发服务器...
echo 服务器启动后将自动打开浏览器
echo 访问地址: http://localhost:3000
echo.
echo 按 Ctrl+C 可停止服务器
echo ====================================
echo.

npm start

echo.
echo 服务器已停止
pause