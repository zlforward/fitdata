import React, { useMemo, useState } from 'react';
import { FittingResult, FittingData, performAllFittings } from '../utils/curveFitting';
import { BrightnessBlock } from '../utils/dataParser';

interface CurveFittingVisualizationProps {
  centerPixelValues: number[];
  grayScaleValues: number[];
  brightnessBlocks: BrightnessBlock[];
}

const CurveFittingVisualization: React.FC<CurveFittingVisualizationProps> = ({
  centerPixelValues,
  grayScaleValues,
  brightnessBlocks
}) => {
  const [inputBrightness, setInputBrightness] = useState('');
  const [calculatedGrayScales, setCalculatedGrayScales] = useState<{[key: string]: number}>({});
  

  
  // 中心像素拟合结果
  const centerFittingResults = useMemo(() => {
    if (centerPixelValues.length === 0 || grayScaleValues.length === 0) {
      return [];
    }
    
    const data: FittingData = {
      x: centerPixelValues,
      y: grayScaleValues
    };
    
    return performAllFittings(data);
  }, [centerPixelValues, grayScaleValues]);
  
  // 当前使用的拟合结果
  const fittingResults = centerFittingResults;
  const currentXValues = centerPixelValues;
  
  // 计算数据范围用于刻度显示
  const maxBrightness = useMemo(() => {
    return currentXValues.length > 0 ? Math.max(...currentXValues) : 100;
  }, [currentXValues]);
  
  const maxGrayScale = useMemo(() => {
    return grayScaleValues.length > 0 ? Math.max(...grayScaleValues) : 100;
  }, [grayScaleValues]);

  const generateSVGPath = (result: FittingResult, width: number, height: number) => {
    if (result.predictedValues.length === 0 || currentXValues.length === 0) return '';
    
    const xMin = Math.min(...currentXValues);
    const xMax = Math.max(...currentXValues);
    const yMin = Math.min(...result.predictedValues, ...grayScaleValues);
    const yMax = Math.max(...result.predictedValues, ...grayScaleValues);
    
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    
    // 生成更多点来绘制平滑曲线
    const numPoints = 100;
    const points: string[] = [];
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const x = xMin + t * xRange;
      let y = 0;
      
      // 根据拟合类型计算y值
      const [a, b, c, d] = result.coefficients;
      switch (result.type) {
        case 'logarithmic':
          if (x > 0) {
            y = a * Math.log(x) + b;
          } else {
            continue; // 跳过无效点
          }
          break;
        case 'exponential':
          y = a * Math.exp(b * x);
          break;
        case 'polynomial':
          y = a * Math.pow(x, 3) + b * Math.pow(x, 2) + c * x + d;
          break;
        case 'power':
          if (x > 0) {
            y = a * Math.pow(x, b);
          } else {
            continue; // 跳过无效点
          }
          break;
      }
      
      const svgX = ((x - xMin) / xRange) * (width - 40) + 20;
      const svgY = height - 20 - ((y - yMin) / yRange) * (height - 40);
      
      // 检查点是否在有效范围内
      if (svgX >= 20 && svgX <= width - 20 && svgY >= 20 && svgY <= height - 20) {
        points.push(`${svgX},${svgY}`);
      }
    }
    
    if (points.length === 0) return '';
    
    return `M ${points[0]} L ${points.slice(1).join(' L ')}`;
  };

  const generateScatterPoints = (width: number, height: number) => {
    if (currentXValues.length === 0) return [];
    
    const xMin = Math.min(...currentXValues);
    const xMax = Math.max(...currentXValues);
    const yMin = Math.min(...grayScaleValues);
    const yMax = Math.max(...grayScaleValues);
    
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    
    return currentXValues.map((x, i) => {
      const y = grayScaleValues[i];
      const svgX = ((x - xMin) / xRange) * (width - 40) + 20;
      const svgY = height - 20 - ((y - yMin) / yRange) * (height - 40);
      return { x: svgX, y: svgY, originalX: x, originalY: y };
    });
  };

  const getColorForFittingType = (type: string) => {
    switch (type) {
      case 'logarithmic': return '#ef4444'; // red
      case 'exponential': return '#3b82f6'; // blue
      case 'polynomial': return '#10b981'; // green
      case 'power': return '#f59e0b'; // amber
      case 'bivariate': return '#8b5cf6'; // purple
      default: return '#6b7280'; // gray
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'logarithmic': return '对数拟合';
      case 'exponential': return '指数拟合';
      case 'polynomial': return '三次多项式拟合';
      case 'power': return '幂函数拟合';
      case 'bivariate': return '二次多项式拟合';
      default: return type;
    }
  };

  // 根据拟合公式计算灰阶值
  const calculateGrayScaleFromBrightness = (brightness: number, result: FittingResult): number => {
    const { coefficients, type } = result;
    
    switch (type) {
      case 'logarithmic':
        // y = a * ln(x) + b
        return coefficients[0] * Math.log(brightness) + coefficients[1];
      case 'exponential':
        // y = a * e^(b * x)
        return coefficients[0] * Math.exp(coefficients[1] * brightness);
      case 'polynomial':
        // y = a * x^3 + b * x^2 + c * x + d
        return coefficients[0] * Math.pow(brightness, 3) + 
               coefficients[1] * Math.pow(brightness, 2) + 
               coefficients[2] * brightness + 
               coefficients[3];
      case 'power':
        // y = a * x^b
        return coefficients[0] * Math.pow(brightness, coefficients[1]);
      case 'bivariate':
        // y = a * x^2 + b * x + c
        return coefficients[0] * Math.pow(brightness, 2) + 
               coefficients[1] * brightness + 
               coefficients[2];
      default:
        return 0;
    }
  };

  // 处理输入亮度值计算
  const handleCalculateGrayScales = () => {
    const brightness = parseFloat(inputBrightness);
    if (isNaN(brightness) || brightness <= 0) {
      alert('请输入有效的正数亮度值');
      return;
    }

    const results: {[key: string]: number} = {};
    fittingResults.forEach(result => {
      try {
        const grayScale = calculateGrayScaleFromBrightness(brightness, result);
        results[result.type] = grayScale;
      } catch (error) {
        results[result.type] = NaN;
      }
    });
    
    setCalculatedGrayScales(results);
  };

  if (centerPixelValues.length === 0 || grayScaleValues.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">曲线拟合分析</h3>
        <p className="text-gray-500">暂无数据进行拟合分析</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-6">曲线拟合分析</h3>
      

      
      {/* 数据概览 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium mb-2">中心像素数据概览</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">数据点数量：</span>
            <span className="font-medium">{centerPixelValues.length}</span>
          </div>
          <div>
            <span className="text-gray-600">中心像素值范围：</span>
            <span className="font-medium">
              {centerPixelValues.length > 0 ? 
                `${Math.min(...centerPixelValues).toFixed(2)} - ${Math.max(...centerPixelValues).toFixed(2)}` : 
                'N/A'
              }
            </span>
          </div>
          <div>
            <span className="text-gray-600">灰阶值范围：</span>
            <span className="font-medium">
              {Math.min(...grayScaleValues).toFixed(2)} - {Math.max(...grayScaleValues).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 中心像素数据表格 */}
      <div className="mb-6">
        <h4 className="font-medium mb-3">中心像素数据表格</h4>
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-sm border-collapse border border-gray-200">
            <thead className="sticky top-0 bg-white">
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left">序号</th>
                <th className="border border-gray-200 px-3 py-2 text-left">中心像素灰度值</th>
                <th className="border border-gray-200 px-3 py-2 text-left">对应灰阶</th>
              </tr>
            </thead>
            <tbody>
              {centerPixelValues.map((pixelValue, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2">{index + 1}</td>
                  <td className="border border-gray-200 px-3 py-2 font-medium">
                    {pixelValue.toFixed(2)}
                  </td>
                  <td className="border border-gray-200 px-3 py-2 font-medium">
                    {grayScaleValues[index]?.toFixed(2) || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 输入亮度值计算灰阶 */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium mb-3">亮度值转换灰阶</h4>
        <div className="flex gap-3 items-end mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              输入绝对亮度值
            </label>
            <input
              type="number"
              value={inputBrightness}
              onChange={(e) => setInputBrightness(e.target.value)}
              placeholder="请输入正数亮度值"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="0.01"
              min="0"
            />
          </div>
          <button
            onClick={handleCalculateGrayScales}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            计算灰阶
          </button>
        </div>
        
        {Object.keys(calculatedGrayScales).length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-3 py-2 text-left">拟合类型</th>
                  <th className="border border-gray-200 px-3 py-2 text-left">计算得到的灰阶值</th>
                  <th className="border border-gray-200 px-3 py-2 text-left">状态</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(calculatedGrayScales).map(([type, value]) => (
                  <tr key={type} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: getColorForFittingType(type) }}
                        ></div>
                        {getTypeLabel(type)}
                      </div>
                    </td>
                    <td className="border border-gray-200 px-3 py-2 font-medium">
                      {isNaN(value) ? '计算错误' : value.toFixed(4)}
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        isNaN(value) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {isNaN(value) ? '失败' : '成功'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 拟合结果表格 */}
      <div className="mb-6">
        <h4 className="font-medium mb-3">拟合结果</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2 text-left">拟合类型</th>
                <th className="border border-gray-200 px-3 py-2 text-left">拟合公式</th>
                <th className="border border-gray-200 px-3 py-2 text-left">R²值</th>
                <th className="border border-gray-200 px-3 py-2 text-left">RMSE</th>
                <th className="border border-gray-200 px-3 py-2 text-left">MAE</th>
                <th className="border border-gray-200 px-3 py-2 text-left">最大误差</th>
                <th className="border border-gray-200 px-3 py-2 text-left">拟合质量</th>
              </tr>
            </thead>
            <tbody>
              {fittingResults.map((result, index) => {
                const quality = result.rSquared > 0.9 ? '优秀' : 
                               result.rSquared > 0.7 ? '良好' : 
                               result.rSquared > 0.5 ? '一般' : '较差';
                const qualityColor = result.rSquared > 0.9 ? 'text-green-600' : 
                                   result.rSquared > 0.7 ? 'text-blue-600' : 
                                   result.rSquared > 0.5 ? 'text-yellow-600' : 'text-red-600';
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: getColorForFittingType(result.type) }}
                        ></div>
                        {getTypeLabel(result.type)}
                      </div>
                    </td>
                    <td className="border border-gray-200 px-3 py-2 font-mono text-xs">
                      {result.formula}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 font-medium">
                      {result.rSquared.toFixed(4)}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 font-medium">
                      {result.rmse?.toFixed(4) || 'N/A'}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 font-medium">
                      {result.mae?.toFixed(4) || 'N/A'}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 font-medium">
                      {result.maxError?.toFixed(4) || 'N/A'}
                    </td>
                    <td className={`border border-gray-200 px-3 py-2 font-medium ${qualityColor}`}>
                      {quality}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 拟合曲线图 */}
      <div className="mb-4">
        <h4 className="font-medium mb-3">拟合曲线图</h4>
        <div className="bg-gray-50 p-4 rounded-lg">
          <svg width="100%" height="450" viewBox="0 0 800 450" className="border border-gray-200 bg-white">
            {/* 网格线 */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* 坐标轴 */}
            <line x1="20" y1="20" x2="20" y2="380" stroke="#374151" strokeWidth="2" />
            <line x1="20" y1="380" x2="780" y2="380" stroke="#374151" strokeWidth="2" />
            
            {/* X轴刻度和数值 */}
            {Array.from({ length: 9 }, (_, i) => {
              const x = 20 + (i * (760 / 8));
              const value = (i * (maxBrightness / 8)).toFixed(1);
              return (
                <g key={`x-tick-${i}`}>
                  <line x1={x} y1="380" x2={x} y2="385" stroke="#374151" strokeWidth="1" />
                  <text x={x} y="400" textAnchor="middle" className="text-xs fill-gray-600">
                    {value}
                  </text>
                </g>
              );
            })}
            
            {/* Y轴刻度和数值 */}
            {Array.from({ length: 9 }, (_, i) => {
              const y = 380 - (i * (360 / 8));
              const value = (i * (maxGrayScale / 8)).toFixed(1);
              return (
                <g key={`y-tick-${i}`}>
                  <line x1="15" y1={y} x2="20" y2={y} stroke="#374151" strokeWidth="1" />
                  <text x="10" y={y + 3} textAnchor="end" className="text-xs fill-gray-600">
                    {value}
                  </text>
                </g>
              );
            })}
            
            {/* 原始数据点 */}
            {generateScatterPoints(800, 400).map((point, i) => (
              <g key={`point-${i}`}>
                <circle 
                  cx={point.x} 
                  cy={point.y} 
                  r="4" 
                  fill="#1f2937" 
                  stroke="white" 
                  strokeWidth="2"
                />
                <title>{`中心像素值: ${point.originalX.toFixed(2)}, 灰阶值: ${point.originalY.toFixed(2)}`}</title>
              </g>
            ))}
            
            {/* 拟合曲线 */}
            {fittingResults.map((result, index) => {
              const path = generateSVGPath(result, 800, 400);
              if (!path) return null;
              
              return (
                <g key={`curve-${index}`}>
                  <path 
                    d={path} 
                    fill="none" 
                    stroke={getColorForFittingType(result.type)} 
                    strokeWidth="2" 
                    strokeDasharray={result.type === 'polynomial' ? '5,5' : 'none'}
                  />
                  {/* 显示拟合公式 */}
                  <text 
                    x={100 + index * 150} 
                    y={50 + index * 20} 
                    className="text-xs" 
                    fill={getColorForFittingType(result.type)}
                    fontFamily="monospace"
                  >
                    {result.formula}
                  </text>
                </g>
              );
            })}
            
            {/* 坐标轴标签 */}
            <text x="400" y="440" textAnchor="middle" className="text-sm fill-gray-600">
              中心像素值
            </text>
            <text x="-15" y="200" textAnchor="middle" className="text-sm fill-gray-600" transform="rotate(-90 -15 200)">
              灰阶值
            </text>
          </svg>
        </div>
      </div>

      {/* 图例 */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-800"></div>
          <span>原始数据点</span>
        </div>
        {fittingResults.map((result, index) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-1" 
              style={{ 
                backgroundColor: getColorForFittingType(result.type),
                borderStyle: result.type === 'polynomial' ? 'dashed' : 'solid'
              }}
            ></div>
            <span>{getTypeLabel(result.type)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CurveFittingVisualization;