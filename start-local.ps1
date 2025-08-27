# FitData 可视化工具 PowerShell 启动脚本

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "    FitData 可视化工具本地启动" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# 检查Node.js环境
Write-Host "正在检查Node.js环境..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "✓ Node.js 版本: $nodeVersion" -ForegroundColor Green
    } else {
        throw "Node.js未安装"
    }
} catch {
    Write-Host "✗ 错误: 未检测到Node.js环境" -ForegroundColor Red
    Write-Host "请先安装Node.js: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit 1
}

Write-Host ""

# 进入项目目录
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectPath = Join-Path $scriptPath "fitdata-visualizer"

Write-Host "进入项目目录: $projectPath" -ForegroundColor Yellow
Set-Location $projectPath

# 检查依赖
if (-not (Test-Path "node_modules")) {
    Write-Host "正在安装项目依赖..." -ForegroundColor Yellow
    Write-Host "注意: 首次运行需要联网下载依赖包" -ForegroundColor Cyan
    
    try {
        npm install
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ 依赖安装完成" -ForegroundColor Green
        } else {
            throw "npm install 失败"
        }
    } catch {
        Write-Host "✗ 依赖安装失败，请检查网络连接" -ForegroundColor Red
        Read-Host "按回车键退出"
        exit 1
    }
} else {
    Write-Host "✓ 依赖已存在，跳过安装" -ForegroundColor Green
}

Write-Host ""
Write-Host "启动开发服务器..." -ForegroundColor Yellow
Write-Host "服务器启动后将自动打开浏览器" -ForegroundColor Cyan
Write-Host "访问地址: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 可停止服务器" -ForegroundColor Yellow
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# 启动服务
try {
    npm start
} catch {
    Write-Host "服务器启动失败" -ForegroundColor Red
} finally {
    Write-Host ""
    Write-Host "服务器已停止" -ForegroundColor Yellow
    Read-Host "按回车键退出"
}