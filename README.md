# FitData 可视化工具 - 本地离线版

## 🚀 快速启动

### Windows 用户
- **英文界面**: 双击 `start-local.bat` 文件即可启动
- **中文界面**: 双击 `start-local-cn.bat` 文件即可启动

### PowerShell 用户
右键 `start-local.ps1` 选择"用PowerShell运行"

### 手动启动
```bash
cd fitdata-visualizer
npm start
```

## 📋 系统要求

- Node.js 16.0+ （[下载地址](https://nodejs.org/)）
- 现代浏览器（Chrome、Firefox、Safari、Edge）

## 🎯 主要功能

- ✅ Excel/CSV 数据导入
- ✅ 交互式热力图可视化
- ✅ 多种数学拟合算法预测
- ✅ 完全离线运行（首次需联网安装依赖）

## 📖 详细说明

- 📄 [本地启动说明.md](./本地启动说明.md) - 完整使用文档
- 🌐 [离线使用指南.html](./离线使用指南.html) - 浏览器版指南

## 🔧 故障排除

**问题**: 启动脚本无反应  
**解决**: 确保已安装 Node.js，运行 `node --version` 验证

**问题**: npm 命令不存在  
**解决**: 重新安装 Node.js

---

**访问地址**: http://localhost:3000  
**停止服务**: 按 Ctrl+C