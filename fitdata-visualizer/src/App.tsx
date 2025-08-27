import React, { useState, useCallback } from 'react';
import FileUpload from './components/FileUpload';
import DataVisualization from './components/DataVisualization';
import TargetDataPrediction from './components/TargetDataPrediction';
import { parseExcelData, ParsedData } from './utils/dataParser';

const App: React.FC = () => {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'analysis' | 'prediction'>('analysis');

  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setParsedData(null);

    try {
      const data = await parseExcelData(file);
      setParsedData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '解析文件时发生未知错误';
      setError(errorMessage);
      console.error('解析错误:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setParsedData(null);
    setError(null);
  }, []);

  const handleExportData = useCallback(() => {
    if (!parsedData) return;

    const exportData = {
      timestamp: new Date().toISOString(),
      grayScaleData: {
        count: parsedData.grayScale.values.length,
        values: parsedData.grayScale.values,
        positions: parsedData.grayScale.positions,
        statistics: {
          min: Math.min(...parsedData.grayScale.values),
          max: Math.max(...parsedData.grayScale.values),
          average: parsedData.grayScale.values.reduce((a: number, b: number) => a + b, 0) / parsedData.grayScale.values.length
        }
      },
      brightnessBlocks: parsedData.brightnessBlocks.map((block: any) => ({
        label: block.label,
        startRow: block.startRow,
        endRow: block.endRow,
        dimensions: `${block.data[0]?.length || 0} × ${block.data.length}`,
        data: block.data,
        statistics: {
          min: Math.min(...block.data.flat()),
          max: Math.max(...block.data.flat()),
          average: block.data.flat().reduce((a: number, b: number) => a + b, 0) / block.data.flat().length
        }
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitdata-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [parsedData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* 头部 */}
      <header className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">FitData Visualizer</h1>
              <p className="text-lg text-gray-600 mt-2 font-medium">Excel数据解析与可视化工具</p>
            </div>
            {parsedData && (
              <div className="flex space-x-3">
                <button
                  onClick={handleExportData}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  导出数据
                </button>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center px-6 py-3 border border-gray-200 text-sm font-semibold rounded-xl text-gray-700 bg-white/80 backdrop-blur-sm hover:bg-white hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  重新开始
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {error && (
          <div className="mb-8 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl p-6 shadow-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="h-6 w-6 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-red-800">解析错误</h3>
                <div className="mt-2 text-red-700">
                  <p className="text-sm leading-relaxed">{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    className="bg-white text-red-700 border border-red-200 rounded-lg px-4 py-2 inline-flex items-center text-sm font-medium hover:bg-red-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
                    onClick={() => setError(null)}
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!parsedData ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 文件上传区域 */}
            <div className="order-2 lg:order-1">
              <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} />
            </div>
            
            {/* 使用说明区域 */}
            <div className="order-1 lg:order-2">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 h-full">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    使用说明
                  </h2>
                </div>
                
                <div className="space-y-6">
                  {/* 支持的文件格式 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-2">1</span>
                      支持的文件格式
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          .xlsx
                        </span>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          .xls
                        </span>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          .csv
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 数据格式要求 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-2">2</span>
                      数据格式要求
                    </h3>
                    <div className="space-y-3">
                      <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg">
                        <p className="text-sm text-blue-800">
                          <span className="font-semibold">灰阶数据：</span>包含位置信息(X,Y坐标)和对应的灰度值
                        </p>
                      </div>
                      <div className="bg-purple-50 border-l-4 border-purple-400 p-3 rounded-r-lg">
                        <p className="text-sm text-purple-800">
                          <span className="font-semibold">亮度数据块：</span>按区域分组的亮度矩阵数据
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 功能特性 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold mr-2">3</span>
                      主要功能
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                        <svg className="w-4 h-4 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-700">数据可视化分析</span>
                      </div>
                      <div className="flex items-center p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                        <svg className="w-4 h-4 text-purple-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-700">目标数据预测</span>
                      </div>
                      <div className="flex items-center p-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                        <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-700">交互式热力图</span>
                      </div>
                      <div className="flex items-center p-2 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg">
                        <svg className="w-4 h-4 text-orange-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-700">数据导出功能</span>
                      </div>
                    </div>
                  </div>

                  {/* 操作提示 */}
                  <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-semibold text-amber-800 mb-1">操作提示</h4>
                        <p className="text-xs text-amber-700 leading-relaxed">
                          点击或拖拽文件到左侧上传区域，系统将自动解析并展示数据可视化结果。支持多种图表类型和交互功能。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 主标签页导航 */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveMainTab('analysis')}
                  className={`flex-1 px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-300 ${
                    activeMainTab === 'analysis'
                      ? 'bg-white text-blue-600 shadow-md transform scale-105'
                      : 'text-gray-600 hover:text-blue-500 hover:bg-white/50'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>数据分析</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveMainTab('prediction')}
                  className={`flex-1 px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-300 ${
                    activeMainTab === 'prediction'
                      ? 'bg-white text-purple-600 shadow-md transform scale-105'
                      : 'text-gray-600 hover:text-purple-500 hover:bg-white/50'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>目标数据预测</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 内容区域 */}
            {activeMainTab === 'analysis' ? (
              <DataVisualization 
                grayScaleData={parsedData.grayScale} 
                brightnessBlocks={parsedData.brightnessBlocks} 
              />
            ) : (
              <TargetDataPrediction 
                grayScaleData={parsedData.grayScale} 
                brightnessBlocks={parsedData.brightnessBlocks} 
              />
            )}
          </div>
        )}
      </main>

      {/* 页脚 */}
      <footer className="bg-white/60 backdrop-blur-sm border-t border-white/20 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-lg font-semibold bg-gradient-to-r from-gray-600 to-gray-800 bg-clip-text text-transparent">FitData Visualizer</p>
            <p className="mt-2 text-gray-600">专业的Excel数据解析与可视化工具</p>
            <p className="mt-1 text-sm text-gray-500">支持灰阶数据和亮度数据块的智能解析与可视化展示</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;