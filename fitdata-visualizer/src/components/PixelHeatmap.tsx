import React, { useState, useMemo } from 'react';
import { BrightnessBlock } from '../utils/dataParser';
import { FittingResult, FittingData, performAllFittings } from '../utils/curveFitting';

interface PixelHeatmapProps {
  brightnessBlocks: BrightnessBlock[];
  grayScaleValues: number[];
  dataType: 'original' | 'normalized';
  onPositionSelect?: (row: number, col: number) => void;
}

interface PositionFittingResult {
  row: number;
  col: number;
  fittingResults: FittingResult[];
  xValues: number[];
}

const PixelHeatmap: React.FC<PixelHeatmapProps> = ({
  brightnessBlocks,
  grayScaleValues,
  dataType,
  onPositionSelect
}) => {
  const [selectedPosition, setSelectedPosition] = useState<{row: number, col: number} | null>(null);
  const [showFittingModal, setShowFittingModal] = useState(false);
  const [hoveredPosition, setHoveredPosition] = useState<{row: number, col: number, x: number, y: number} | null>(null);
  const [predictionInput, setPredictionInput] = useState<string>('');
  const [predictionResults, setPredictionResults] = useState<Array<{
    type: string;
    prediction?: number;
    error?: string;
    rSquared: number;
  }> | null>(null);

  // 计算热力图数据
  const heatmapData = useMemo(() => {
    if (brightnessBlocks.length === 0) return [];
    
    const rows = 20;
    const cols = 32;
    const data: number[][] = [];
    
    for (let row = 0; row < rows; row++) {
      const rowData: number[] = [];
      for (let col = 0; col < cols; col++) {
        // 计算该位置所有数据块的平均值
        let sum = 0;
        let count = 0;
        
        brightnessBlocks.forEach(block => {
          if (row < block.data.length && col < block.data[row].length) {
            const value = dataType === 'original' 
              ? block.data[row][col]
              : (block.normalizedData?.[row]?.[col] ?? block.data[row][col] / (block.centerPixelValue || 1));
            sum += value;
            count++;
          }
        });
        
        rowData.push(count > 0 ? sum / count : 0);
      }
      data.push(rowData);
    }
    
    return data;
  }, [brightnessBlocks, dataType]);

  // 计算选中位置的拟合结果
  const positionFittingResult = useMemo((): PositionFittingResult | null => {
    if (!selectedPosition || brightnessBlocks.length === 0 || grayScaleValues.length === 0) {
      return null;
    }
    
    const { row, col } = selectedPosition;
    const positionValues: number[] = [];
    
    brightnessBlocks.forEach(block => {
      if (row < block.data.length && col < block.data[row].length) {
        const value = dataType === 'original' 
          ? block.data[row][col] 
          : (block.normalizedData?.[row]?.[col] ?? block.data[row][col] / (block.centerPixelValue || 1));
        positionValues.push(value);
      }
    });
    
    if (positionValues.length !== grayScaleValues.length) {
      return null;
    }
    
    const data: FittingData = {
      x: positionValues,
      y: grayScaleValues
    };
    
    const fittingResults = performAllFittings(data);
    
    return {
      row,
      col,
      fittingResults,
      xValues: positionValues
    };
  }, [selectedPosition, brightnessBlocks, grayScaleValues, dataType]);

  // 计算热力图颜色范围
  const { minValue, maxValue } = useMemo(() => {
    const flatData = heatmapData.flat();
    return {
      minValue: Math.min(...flatData),
      maxValue: Math.max(...flatData)
    };
  }, [heatmapData]);

  // 获取颜色值
  const getColor = (value: number) => {
    if (maxValue === minValue) return 'rgb(255, 255, 255)';
    
    const normalized = (value - minValue) / (maxValue - minValue);
    const intensity = Math.floor(normalized * 255);
    
    // 使用蓝色到红色的渐变
    const red = intensity;
    const blue = 255 - intensity;
    const green = Math.floor(128 * (1 - Math.abs(normalized - 0.5) * 2));
    
    return `rgb(${red}, ${green}, ${blue})`;
  };

  // 处理像素点击
  const handlePixelDoubleClick = (row: number, col: number) => {
    setSelectedPosition({ row, col });
    setShowFittingModal(true);
    onPositionSelect?.(row, col);
  };

  // 处理鼠标悬停
  const handlePixelMouseEnter = (row: number, col: number, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredPosition({
      row,
      col,
      x: rect.right + 10,
      y: rect.top
    });
  };

  const handlePixelMouseLeave = () => {
    setHoveredPosition(null);
  };

  // 计算悬停位置的拟合数据
  const hoveredFittingData = useMemo(() => {
    if (!hoveredPosition || brightnessBlocks.length === 0 || grayScaleValues.length === 0) {
      return null;
    }
    
    const { row, col } = hoveredPosition;
    const positionValues: number[] = [];
    
    brightnessBlocks.forEach(block => {
      if (row < block.data.length && col < block.data[row].length) {
        const value = dataType === 'original' 
          ? block.data[row][col] 
          : (block.normalizedData?.[row]?.[col] ?? block.data[row][col] / (block.centerPixelValue || 1));
        positionValues.push(value);
      }
    });
    
    if (positionValues.length !== grayScaleValues.length) {
      return null;
    }
    
    const data: FittingData = {
      x: positionValues,
      y: grayScaleValues
    };
    
    const fittingResults = performAllFittings(data);
    const bestFit = fittingResults.reduce((best, current) => 
      current.rSquared > best.rSquared ? current : best
    );
    
    return {
      bestFit,
      dataPoints: positionValues.length,
      avgValue: positionValues.reduce((sum, val) => sum + val, 0) / positionValues.length
    };
  }, [hoveredPosition, brightnessBlocks, grayScaleValues, dataType]);

  // 预测功能
  const handlePrediction = (inputValue: string) => {
    if (!positionFittingResult || !inputValue.trim()) return null;
    
    const x = parseFloat(inputValue);
    if (isNaN(x)) return null;
    
    return positionFittingResult.fittingResults.map(result => {
      const [a, b, c, d] = result.coefficients;
      let y = 0;
      
      switch (result.type) {
        case 'logarithmic':
          if (x > 0) {
            y = a * Math.log(x) + b;
          } else {
            return { ...result, prediction: undefined, error: '输入值必须大于0' };
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
            return { ...result, prediction: undefined, error: '输入值必须大于0' };
          }
          break;
      }
      
      return { ...result, prediction: y, error: undefined };
    });
  };

  // 处理预测输入变化
   const handlePredictionInputChange = (value: string) => {
     setPredictionInput(value);
     if (value && !isNaN(Number(value)) && positionFittingResult) {
       const results = handlePrediction(value);
       setPredictionResults(results);
     } else {
       setPredictionResults(null);
     }
   };

   // 获取拟合类型标签
  const getTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'logarithmic': '对数拟合',
      'exponential': '指数拟合',
      'polynomial': '多项式拟合',
      'power': '幂函数拟合',
      'bivariate': '二次多项式拟合'
    };
    return labels[type] || type;
  };

  // 获取拟合类型颜色
  const getColorForFittingType = (type: string) => {
    const colors: { [key: string]: string } = {
      'logarithmic': '#ef4444',
      'exponential': '#3b82f6',
      'polynomial': '#10b981',
      'power': '#f59e0b',
      'bivariate': '#8b5cf6'
    };
    return colors[type] || '#6b7280';
  };

  // 生成SVG路径
  const generateSVGPath = (result: FittingResult, xValues: number[], width: number, height: number) => {
    if (result.predictedValues.length === 0 || xValues.length === 0) return '';
    
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...result.predictedValues, ...grayScaleValues);
    const yMax = Math.max(...result.predictedValues, ...grayScaleValues);
    
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    
    const numPoints = 100;
    const points: string[] = [];
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const x = xMin + t * xRange;
      let y = 0;
      
      const [a, b, c, d] = result.coefficients;
      switch (result.type) {
        case 'logarithmic':
          if (x > 0) {
            y = a * Math.log(x) + b;
          } else {
            continue;
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
            continue;
          }
          break;
      }
      
      const svgX = ((x - xMin) / xRange) * (width - 40) + 20;
      const svgY = height - 20 - ((y - yMin) / yRange) * (height - 40);
      
      if (svgX >= 20 && svgX <= width - 20 && svgY >= 20 && svgY <= height - 20) {
        points.push(`${svgX},${svgY}`);
      }
    }
    
    if (points.length === 0) return '';
    return `M ${points[0]} L ${points.slice(1).join(' L ')}`;
  };

  // 生成散点图
  const generateScatterPoints = (xValues: number[], width: number, height: number) => {
    if (xValues.length === 0) return [];
    
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...grayScaleValues);
    const yMax = Math.max(...grayScaleValues);
    
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    
    return xValues.map((x, i) => {
      const y = grayScaleValues[i];
      const svgX = ((x - xMin) / xRange) * (width - 40) + 20;
      const svgY = height - 20 - ((y - yMin) / yRange) * (height - 40);
      return { x: svgX, y: svgY, originalX: x, originalY: y };
    });
  };

  if (heatmapData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">像素热力图</h3>
        <p className="text-gray-500">暂无数据显示热力图</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-4">
        像素热力图 ({dataType === 'original' ? '原始数据' : '归一化数据'})
      </h3>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          双击任意像素位置查看该位置的拟合结果
        </p>
        
        {/* 热力图 */}
        <div className="border border-gray-300 rounded-lg overflow-hidden inline-block">
          <svg width="640" height="400" className="bg-white">
            {heatmapData.map((row, rowIndex) =>
              row.map((value, colIndex) => (
                <rect
                  key={`${rowIndex}-${colIndex}`}
                  x={colIndex * 20}
                  y={rowIndex * 20}
                  width="20"
                  height="20"
                  fill={getColor(value)}
                  stroke="#e5e7eb"
                  strokeWidth="0.5"
                  className="cursor-pointer hover:stroke-2 hover:stroke-blue-500"
                  onDoubleClick={() => handlePixelDoubleClick(rowIndex, colIndex)}
                  onMouseEnter={(e) => handlePixelMouseEnter(rowIndex, colIndex, e)}
                  onMouseLeave={handlePixelMouseLeave}
                >
                  <title>{`位置(${rowIndex},${colIndex}): ${value.toFixed(4)}`}</title>
                </rect>
              ))
            )}
            
            {/* 坐标轴标签 */}
            <text x="320" y="390" textAnchor="middle" className="text-xs fill-gray-600">
              列 (0-31)
            </text>
            <text x="10" y="200" textAnchor="middle" className="text-xs fill-gray-600" transform="rotate(-90 10 200)">
              行 (0-19)
            </text>
          </svg>
        </div>
        
        {/* 颜色图例 */}
        <div className="mt-4 flex items-center gap-4">
          <span className="text-sm text-gray-600">数值范围:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4" style={{ backgroundColor: getColor(minValue) }}></div>
            <span className="text-xs">{minValue.toFixed(2)}</span>
            <div className="w-20 h-4 bg-gradient-to-r" 
                 style={{ 
                   backgroundImage: `linear-gradient(to right, ${getColor(minValue)}, ${getColor(maxValue)})` 
                 }}>
            </div>
            <span className="text-xs">{maxValue.toFixed(2)}</span>
            <div className="w-4 h-4" style={{ backgroundColor: getColor(maxValue) }}></div>
          </div>
        </div>
      </div>

      {/* 悬停提示框 */}
      {hoveredPosition && hoveredFittingData && (
        <div 
          className="fixed bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-40 pointer-events-none"
          style={{
            left: hoveredPosition.x,
            top: hoveredPosition.y,
            transform: 'translateY(-50%)'
          }}
        >
          <div className="text-sm">
            <div className="font-semibold mb-1">
              位置({hoveredPosition.row},{hoveredPosition.col})
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <div>数据点: {hoveredFittingData.dataPoints}个</div>
              <div>平均值: {hoveredFittingData.avgValue.toFixed(4)}</div>
              <div className="border-t pt-1 mt-1">
                <div className="font-medium">最佳拟合: {getTypeLabel(hoveredFittingData.bestFit.type)}</div>
                <div>R²: {hoveredFittingData.bestFit.rSquared.toFixed(4)}</div>
                <div className="text-xs font-mono">{hoveredFittingData.bestFit.formula}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 拟合结果模态框 */}
      {showFittingModal && positionFittingResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold">
                位置({positionFittingResult.row},{positionFittingResult.col})的拟合结果
              </h4>
              <button
                onClick={() => setShowFittingModal(false)}
                className="text-gray-500 hover:text-gray-700 text-xl font-bold"
              >
                ×
              </button>
            </div>
            
            {/* 拟合结果表格 */}
            <div className="mb-6">
              <h5 className="font-medium mb-3">拟合结果对比</h5>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-3 py-2 text-left">拟合类型</th>
                      <th className="border border-gray-200 px-3 py-2 text-left">公式</th>
                      <th className="border border-gray-200 px-3 py-2 text-left">R²值</th>
                      <th className="border border-gray-200 px-3 py-2 text-left">RMSE</th>
                      <th className="border border-gray-200 px-3 py-2 text-left">MAE</th>
                      <th className="border border-gray-200 px-3 py-2 text-left">最大误差</th>
                      <th className="border border-gray-200 px-3 py-2 text-left">拟合质量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positionFittingResult.fittingResults.map((result, index) => {
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
            
            {/* 预测功能 */}
            <div className="mb-6">
              <h5 className="font-medium mb-3">预测功能</h5>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-4 mb-4">
                  <label className="text-sm font-medium">输入{dataType === 'original' ? '原始' : '归一化'}数据值:</label>
                  <input
                    type="number"
                    value={predictionInput}
                    onChange={(e) => handlePredictionInputChange(e.target.value)}
                    placeholder="请输入数值进行预测"
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                {predictionResults && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-200">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-200 px-3 py-2 text-left">拟合类型</th>
                          <th className="border border-gray-200 px-3 py-2 text-left">预测结果</th>
                          <th className="border border-gray-200 px-3 py-2 text-left">R²值</th>
                          <th className="border border-gray-200 px-3 py-2 text-left">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {predictionResults.map((result, index) => (
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
                            <td className="border border-gray-200 px-3 py-2 font-medium">
                              {result.error ? (
                                <span className="text-red-600">{result.error}</span>
                              ) : (
                                <span className="text-green-600">{result.prediction?.toFixed(4) || 'N/A'}</span>
                              )}
                            </td>
                            <td className="border border-gray-200 px-3 py-2">
                              {result.rSquared.toFixed(4)}
                            </td>
                            <td className="border border-gray-200 px-3 py-2">
                              {result.error ? (
                                <span className="text-red-600">错误</span>
                              ) : (
                                <span className="text-green-600">成功</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 输入输出数据表格 */}
            <div className="mb-6">
              <h5 className="font-medium mb-3">拟合输入输出数据</h5>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full border-collapse border border-gray-200">
                    <thead className="sticky top-0 bg-white">
                      <tr>
                        <th className="border border-gray-200 px-3 py-2 text-left">序号</th>
                        <th className="border border-gray-200 px-3 py-2 text-left">
                          输入({dataType === 'original' ? '原始' : '归一化'}数据值)
                        </th>
                        <th className="border border-gray-200 px-3 py-2 text-left">输出(灰阶值)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positionFittingResult.xValues.map((xValue, index) => (
                        <tr key={index} className="hover:bg-gray-100">
                          <td className="border border-gray-200 px-3 py-2 text-center">{index + 1}</td>
                          <td className="border border-gray-200 px-3 py-2 font-mono">
                            {xValue.toFixed(4)}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 font-mono">
                            {grayScaleValues[index]?.toFixed(4) || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>总数据点: {positionFittingResult.xValues.length}</span>
                    <span>输入范围: {Math.min(...positionFittingResult.xValues).toFixed(4)} ~ {Math.max(...positionFittingResult.xValues).toFixed(4)}</span>
                    <span>输出范围: {Math.min(...grayScaleValues).toFixed(4)} ~ {Math.max(...grayScaleValues).toFixed(4)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 拟合曲线图 */}
            <div className="mb-4">
              <h5 className="font-medium mb-3">拟合曲线图</h5>
              <div className="bg-gray-50 p-4 rounded-lg">
                <svg width="100%" height="400" viewBox="0 0 800 400" className="border border-gray-200 bg-white">
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
                  
                  {/* 原始数据点 */}
                  {generateScatterPoints(positionFittingResult.xValues, 800, 400).map((point, i) => (
                    <g key={`point-${i}`}>
                      <circle 
                        cx={point.x} 
                        cy={point.y} 
                        r="4" 
                        fill="#1f2937" 
                        stroke="white" 
                        strokeWidth="2"
                      />
                      <title>{`${dataType === 'original' ? '原始' : '归一化'}数据: ${point.originalX.toFixed(2)}, 灰阶值: ${point.originalY.toFixed(2)}`}</title>
                    </g>
                  ))}
                  
                  {/* 拟合曲线 */}
                  {positionFittingResult.fittingResults.map((result, index) => {
                    const path = generateSVGPath(result, positionFittingResult.xValues, 800, 400);
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
                  <text x="400" y="395" textAnchor="middle" className="text-sm fill-gray-600">
                    {dataType === 'original' ? '原始数据值' : '归一化数据值'}
                  </text>
                  <text x="10" y="200" textAnchor="middle" className="text-sm fill-gray-600" transform="rotate(-90 10 200)">
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
              {positionFittingResult.fittingResults.map((result, index) => (
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
        </div>
      )}
    </div>
  );
};

export default PixelHeatmap;