import React, { useState, useMemo } from 'react';
import { GrayScaleData, BrightnessBlock } from '../utils/dataParser';
import CurveFittingVisualization from './CurveFittingVisualization';
import PixelHeatmap from './PixelHeatmap';

interface DataVisualizationProps {
  grayScaleData: GrayScaleData;
  brightnessBlocks: BrightnessBlock[];
}

const DataVisualization: React.FC<DataVisualizationProps> = ({ grayScaleData, brightnessBlocks }) => {
  const [showNormalizedData, setShowNormalizedData] = useState(false);
  const [activeTab, setActiveTab] = useState<'center' | 'heatmap' | 'grayscale' | 'datablock'>('center');
  const [heatmapDataType, setHeatmapDataType] = useState<'original' | 'normalized'>('original');
  
  // 提取中心像素值和灰阶值用于曲线拟合
  const { centerPixelValues, grayScaleValues } = useMemo(() => {
    const centerValues = brightnessBlocks.map(block => block.centerPixelValue || 0);
    const grayValues = grayScaleData.values.slice(0, brightnessBlocks.length);
    return {
      centerPixelValues: centerValues,
      grayScaleValues: grayValues
    };
  }, [brightnessBlocks, grayScaleData]);

  // 计算归一化数据（原始数据/中心像素数据）
  const calculateNormalizedData = (block: BrightnessBlock) => {
    if (!block.centerPixelValue || block.centerPixelValue === 0) {
      return block.data; // 如果中心像素值为0，返回原始数据
    }
    return block.data.map(row => 
      row.map(value => value / block.centerPixelValue!)
    );
  };



  // 渲染亮度数据块的矩阵热力图
  const renderBrightnessBlock = (block: BrightnessBlock, blockIndex: number) => {
    const currentData = showNormalizedData ? calculateNormalizedData(block) : block.data;
    const flatData = currentData.flat();
    const maxValue = Math.max(...flatData);
    const minValue = Math.min(...flatData);
    const avgValue = flatData.reduce((a: number, b: number) => a + b, 0) / flatData.length;
    
    return (
      <div key={blockIndex} className="mb-12">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">{block.label}</h3>
              <p className="text-blue-100 text-sm mt-1">32列 × 20行数据矩阵</p>
            </div>
            <div className="text-sm bg-white bg-opacity-20 rounded-lg px-3 py-2">
              <div className="font-medium mb-1">中心像素值:</div>
              <div className="font-mono text-xs">{block.centerPixelValue?.toFixed(6) || 'N/A'}</div>
            </div>
          </div>
        </div>
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-b-2xl shadow-xl border border-gray-100">
          {/* 数据显示模式切换 */}
          <div className="mb-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id={`normalized-${blockIndex}`}
                  checked={showNormalizedData}
                  onChange={(e) => setShowNormalizedData(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor={`normalized-${blockIndex}`} className="text-sm font-medium text-gray-600">
                  显示归一化数据 (原始数据/中心像素值)
                </label>
              </div>
            </div>
          </div>

          {/* 矩阵热力图 */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-4 text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {showNormalizedData ? '归一化数据热力图' : '原始数据热力图'}
            </h4>
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="overflow-auto bg-white rounded-lg border-2 border-gray-200 shadow-inner" style={{ maxHeight: '600px' }}>
                <div className="inline-block min-w-full">
                  {/* 列标题 */}
                  <div className="flex sticky top-0 z-10 mb-1">
                    <div className="w-12 h-10 flex items-center justify-center text-xs font-bold text-gray-600 bg-gradient-to-r from-gray-100 to-gray-200 border border-gray-300 rounded-tl-lg sticky left-0 z-20"></div>
                    {Array.from({ length: 32 }, (_, i) => (
                      <div key={i} className="w-12 h-10 flex items-center justify-center text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-400">
                        {String.fromCharCode(65 + i)}
                      </div>
                    ))}
                  </div>
                  {/* 矩阵数据 */}
                  {currentData.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex mb-1">
                      {/* 行标题 */}
                      <div className="w-12 h-10 flex items-center justify-center text-xs font-bold text-white bg-gradient-to-r from-purple-500 to-purple-600 border border-purple-400 sticky left-0 z-10">
                        {block.startRow + rowIndex}
                      </div>
                      {/* 数据单元格 */}
                      {row.map((value, colIndex) => {
                        const isCenter = rowIndex === 9 && colIndex === 15; // 中心像素位置
                        // 计算颜色强度 (0-1)
                        const intensity = maxValue > minValue ? (value - minValue) / (maxValue - minValue) : 0;
                        const backgroundColor = value === 0 
                          ? '#f8fafc' 
                          : `rgba(59, 130, 246, ${0.1 + intensity * 0.8})`; // 蓝色渐变
                        const textColor = intensity > 0.7 ? '#ffffff' : '#1e293b';
                        
                        // 智能数值显示格式
                        const displayValue = value === 0 ? '' : 
                          Math.abs(value) >= 1000 ? value.toExponential(2) :
                          Math.abs(value) >= 1 ? value.toFixed(2) :
                          Math.abs(value) >= 0.01 ? value.toFixed(4) :
                          value.toExponential(2);
                        
                        return (
                          <div
                            key={`${rowIndex}-${colIndex}`}
                            className={`w-12 h-10 flex items-center justify-center text-xs border cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all duration-200 hover:scale-110 hover:z-30 relative group ${
                              isCenter ? 'border-red-500 border-2 ring-2 ring-red-200' : 'border-gray-300'
                            }`}
                            style={{ backgroundColor, color: textColor }}
                          >
                            {/* 数值显示 */}
                            {value !== 0 && (
                              <span className="font-mono font-semibold text-center leading-tight" style={{ fontSize: '10px' }}>
                                {displayValue}
                              </span>
                            )}
                            
                            {/* 悬停提示框 */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-40">
                              <div className="font-semibold">位置: {String.fromCharCode(65 + colIndex)}{block.startRow + rowIndex} {isCenter ? '(中心像素)' : ''}</div>
                              <div className="font-mono">值: {value.toFixed(6)}</div>
                              {showNormalizedData && (
                                <div className="font-mono text-yellow-300">原始值: {block.data[rowIndex][colIndex].toFixed(6)}</div>
                              )}
                              <div className="text-gray-300">强度: {(intensity * 100).toFixed(1)}%</div>
                              {/* 箭头 */}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* 数据统计 */}
          <div className="mt-8">
            <h5 className="text-md font-semibold mb-4 text-gray-800 flex items-center">
              <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {showNormalizedData ? '归一化数据统计' : '原始数据统计'}
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-xs font-medium text-gray-500 mb-1">最小值</div>
                <div className="font-mono text-lg font-bold text-red-600">{minValue.toFixed(6)}</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-xs font-medium text-gray-500 mb-1">最大值</div>
                <div className="font-mono text-lg font-bold text-green-600">{maxValue.toFixed(6)}</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-xs font-medium text-gray-500 mb-1">平均值</div>
                <div className="font-mono text-lg font-bold text-blue-600">{avgValue.toFixed(6)}</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-xs font-medium text-gray-500 mb-1">中心像素值</div>
                <div className="font-mono text-lg font-bold text-purple-600">{block.centerPixelValue?.toFixed(6) || 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 标签页导航 */}
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex space-x-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('center')}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'center'
                ? 'bg-blue-500 text-white border-b-2 border-blue-500'
                : 'text-gray-600 hover:text-blue-500 hover:bg-gray-50'
            }`}
          >
            中心像素拟合
          </button>
          <button
            onClick={() => setActiveTab('heatmap')}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'heatmap'
                ? 'bg-blue-500 text-white border-b-2 border-blue-500'
                : 'text-gray-600 hover:text-blue-500 hover:bg-gray-50'
            }`}
          >
            像素热力图
          </button>
          <button
            onClick={() => setActiveTab('grayscale')}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'grayscale'
                ? 'bg-blue-500 text-white border-b-2 border-blue-500'
                : 'text-gray-600 hover:text-blue-500 hover:bg-gray-50'
            }`}
          >
            灰阶曲线数据
          </button>
          <button
            onClick={() => setActiveTab('datablock')}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'datablock'
                ? 'bg-blue-500 text-white border-b-2 border-blue-500'
                : 'text-gray-600 hover:text-blue-500 hover:bg-gray-50'
            }`}
          >
            数据块显示
          </button>
        </div>
        
        {/* 热力图数据类型选择 */}
        {activeTab === 'heatmap' && (
          <div className="mt-4 flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">数据类型:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setHeatmapDataType('original')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  heatmapDataType === 'original'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                原始数据
              </button>
              <button
                onClick={() => setHeatmapDataType('normalized')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  heatmapDataType === 'normalized'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                归一化数据
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 内容区域 */}
      {activeTab === 'center' && (
        <CurveFittingVisualization 
          centerPixelValues={centerPixelValues}
          grayScaleValues={grayScaleValues}
          brightnessBlocks={brightnessBlocks}
        />
      )}
      
      {activeTab === 'heatmap' && (
        <PixelHeatmap
          brightnessBlocks={brightnessBlocks}
          grayScaleValues={grayScaleValues}
          dataType={heatmapDataType}
          onPositionSelect={(row, col) => {
            console.log(`选中位置: (${row}, ${col})`);
          }}
        />
      )}
      
      {activeTab === 'datablock' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">数据块显示</h3>
          
          {/* 数据类型切换 */}
          <div className="mb-6 flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">显示数据类型:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNormalizedData(false)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  !showNormalizedData
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                原始数据
              </button>
              <button
                onClick={() => setShowNormalizedData(true)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  showNormalizedData
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                归一化数据
              </button>
            </div>
          </div>
          
          {/* 数据块列表 */}
          <div className="space-y-8">
            {brightnessBlocks.map((block, index) => renderBrightnessBlock(block, index))}
          </div>
        </div>
      )}
      
      {activeTab === 'grayscale' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">灰阶曲线数据</h3>
          
          {/* 灰阶数据表格 */}
          <div className="mb-6">
            <h4 className="font-medium mb-3">灰阶值序列</h4>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-8 gap-2 text-sm">
                {grayScaleValues.map((value, index) => (
                  <div key={index} className="bg-white p-2 rounded border text-center">
                    <div className="text-xs text-gray-500">#{index + 1}</div>
                    <div className="font-medium">{value.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* 灰阶曲线图 */}
          <div className="mb-4">
            <h4 className="font-medium mb-3">灰阶变化曲线</h4>
            <div className="bg-gray-50 p-4 rounded-lg">
              <svg width="100%" height="300" viewBox="0 0 800 300" className="border border-gray-200 bg-white">
                {/* 网格线 */}
                <defs>
                  <pattern id="grayscale-grid" width="40" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grayscale-grid)" />
                
                {/* 坐标轴 */}
                <line x1="40" y1="20" x2="40" y2="280" stroke="#374151" strokeWidth="2" />
                <line x1="40" y1="280" x2="760" y2="280" stroke="#374151" strokeWidth="2" />
                
                {/* 灰阶曲线 */}
                {grayScaleValues.length > 1 && (() => {
                  const minValue = Math.min(...grayScaleValues);
                  const maxValue = Math.max(...grayScaleValues);
                  const valueRange = maxValue - minValue || 1;
                  const xStep = 720 / (grayScaleValues.length - 1);
                  
                  const pathData = grayScaleValues.map((value, index) => {
                    const x = 40 + index * xStep;
                    const y = 280 - ((value - minValue) / valueRange) * 260;
                    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ');
                  
                  return (
                    <g>
                      {/* 曲线 */}
                      <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="3" />
                      
                      {/* 数据点 */}
                      {grayScaleValues.map((value, index) => {
                        const x = 40 + index * xStep;
                        const y = 280 - ((value - minValue) / valueRange) * 260;
                        return (
                          <g key={index}>
                            <circle cx={x} cy={y} r="4" fill="#3b82f6" stroke="white" strokeWidth="2" />
                            <title>{`数据点 ${index + 1}: ${value.toFixed(2)}`}</title>
                          </g>
                        );
                      })}
                      
                      {/* Y轴刻度 */}
                      {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                        const value = minValue + ratio * valueRange;
                        const y = 280 - ratio * 260;
                        return (
                          <g key={ratio}>
                            <line x1="35" y1={y} x2="45" y2={y} stroke="#374151" strokeWidth="1" />
                            <text x="30" y={y + 4} textAnchor="end" className="text-xs fill-gray-600">
                              {value.toFixed(1)}
                            </text>
                          </g>
                        );
                      })}
                      
                      {/* X轴刻度 */}
                      {grayScaleValues.map((_, index) => {
                        if (index % Math.ceil(grayScaleValues.length / 10) === 0) {
                          const x = 40 + index * xStep;
                          return (
                            <g key={index}>
                              <line x1={x} y1="275" x2={x} y2="285" stroke="#374151" strokeWidth="1" />
                              <text x={x} y="295" textAnchor="middle" className="text-xs fill-gray-600">
                                {index + 1}
                              </text>
                            </g>
                          );
                        }
                        return null;
                      })}
                    </g>
                  );
                })()}
                
                {/* 坐标轴标签 */}
                <text x="400" y="295" textAnchor="middle" className="text-sm fill-gray-600">
                  数据点序号
                </text>
                <text x="20" y="150" textAnchor="middle" className="text-sm fill-gray-600" transform="rotate(-90 20 150)">
                  灰阶值
                </text>
              </svg>
            </div>
          </div>
          
          {/* 统计信息 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">数据点数量</div>
              <div className="text-lg font-bold text-blue-800">{grayScaleValues.length}</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-sm text-green-600 font-medium">最小值</div>
              <div className="text-lg font-bold text-green-800">
                {grayScaleValues.length > 0 ? Math.min(...grayScaleValues).toFixed(2) : 'N/A'}
              </div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-sm text-red-600 font-medium">最大值</div>
              <div className="text-lg font-bold text-red-800">
                {grayScaleValues.length > 0 ? Math.max(...grayScaleValues).toFixed(2) : 'N/A'}
              </div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-sm text-purple-600 font-medium">平均值</div>
              <div className="text-lg font-bold text-purple-800">
                {grayScaleValues.length > 0 
                  ? (grayScaleValues.reduce((a, b) => a + b, 0) / grayScaleValues.length).toFixed(2) 
                  : 'N/A'
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataVisualization;