import React, { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { FittingResult, performAllFittings } from '../utils/curveFitting';

interface RawData {
  values: number[];
  positions: string[];
  matrix: number[][];
}

interface PredictionResult {
  position: string;
  brightnessValue: number;
  predictions: {
    [key: string]: {
      predictedGrayScale: number;
      formula: string;
      confidence: number;
      fittingType: string;
    }
  };
}

interface TargetDataPredictionProps {
  grayScaleData: {
    values: number[];
    positions: string[];
  };
  brightnessBlocks: Array<{
    label: string;
    startRow: number;
    endRow: number;
    data: number[][];
    centerPixelValue: number;
    normalizedData?: number[][];
  }>;
}

const TargetDataPrediction: React.FC<TargetDataPredictionProps> = ({ grayScaleData, brightnessBlocks }) => {
  const [rawData, setRawData] = useState<RawData | null>(null);
  const [predictionResults, setPredictionResults] = useState<PredictionResult[]>([]);
  const [bestFittingResult, setBestFittingResult] = useState<FittingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [doubleClickedCell, setDoubleClickedCell] = useState<{ row: number; col: number } | null>(null);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // 将数字转换为Excel列名
  const numToCol = (num: number): string => {
    let result = '';
    while (num > 0) {
      num--;
      result = String.fromCharCode(65 + (num % 26)) + result;
      num = Math.floor(num / 26);
    }
    return result;
  };

  // 读取Excel Sheet3数据
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 检查是否有Sheet3
        if (!workbook.SheetNames.includes('Sheet3')) {
          throw new Error('未找到Sheet3工作表');
        }
        
        const worksheet = workbook.Sheets['Sheet3'];
        const values: number[] = [];
        const positions: string[] = [];
        
        // 读取A2-AF21范围的原始数据（20行×32列）
        const startRow = 2;
        const endRow = 21;
        const startCol = 'A';
        const endCol = 'AF';
        
        // 将列字母转换为数字
        const colToNum = (col: string): number => {
          let result = 0;
          for (let i = 0; i < col.length; i++) {
            result = result * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
          }
          return result;
        };
        
        const numToCol = (num: number): string => {
          let result = '';
          while (num > 0) {
            num--;
            result = String.fromCharCode('A'.charCodeAt(0) + (num % 26)) + result;
            num = Math.floor(num / 26);
          }
          return result;
        };
        
        const startColNum = colToNum(startCol);
        const endColNum = colToNum(endCol);
        
        // 创建矩阵结构
        const matrix: number[][] = [];
        
        // 按行读取数据
        for (let row = startRow; row <= endRow; row++) {
          const rowData: number[] = [];
          for (let colNum = startColNum; colNum <= endColNum; colNum++) {
            const col = numToCol(colNum);
            const cellAddress = `${col}${row}`;
            const cell = worksheet[cellAddress];
            
            if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
              const value = typeof cell.v === 'number' ? cell.v : parseFloat(cell.v.toString());
              if (!isNaN(value)) {
                values.push(value);
                positions.push(cellAddress);
                rowData.push(value);
              } else {
                rowData.push(0);
              }
            } else {
              rowData.push(0);
            }
          }
          matrix.push(rowData);
        }
        
        if (values.length === 0) {
          throw new Error('Sheet3中未找到有效的原始数据');
        }
        
        setRawData({ values, positions, matrix });
        
        // 自动生成预测结果
      setTimeout(async () => {
         await generatePredictions();
       }, 500);
      } catch (error) {
        setError(error instanceof Error ? error.message : '文件读取失败');
      } finally {
        setIsLoading(false);
      }
    };
    
    reader.onerror = () => {
      setError('文件读取失败');
      setIsLoading(false);
    };
    
    reader.readAsArrayBuffer(file);
  }, []);



  // 处理双击事件
  const handleDoubleClick = (rowIndex: number, colIndex: number) => {
    setDoubleClickedCell({ row: rowIndex, col: colIndex });
  };

  // 关闭双击卡片
  const handleCloseDoubleClickCard = () => {
    setDoubleClickedCell(null);
  };

  // 计算双击卡片的预测结果
  const doubleClickPredictionContent = useMemo(() => {
    if (!rawData || !grayScaleData.values.length || !brightnessBlocks.length || !doubleClickedCell) {
      return <p className="text-gray-500">预测数据尚未生成，请等待数据处理完成</p>;
    }
    
    // 计算该位置的预测结果
    const cellIndex = doubleClickedCell.row * 32 + doubleClickedCell.col;
    const rawValue = rawData.values[cellIndex];
    
    const centerPixelValues = brightnessBlocks.map(block => block.centerPixelValue);
    const grayScaleValues = grayScaleData.values;
    
    const allFittingResults = performAllFittings({
      x: centerPixelValues,
      y: grayScaleValues
    });
    
    const methodPredictions: { [key: string]: { predictedGrayScale: number; formula: string; confidence: number; fittingType: string } } = {};
    
    allFittingResults.forEach(fitting => {
      if (isNaN(fitting.rSquared) || fitting.rSquared < 0) return;
      
      let predictedGrayScale = 0;
      
      switch (fitting.type) {
        case 'logarithmic':
          if (rawValue > 0) {
            const [a, b] = fitting.coefficients;
            predictedGrayScale = a * Math.log(rawValue) + b;
          }
          break;
        case 'exponential':
          const [a_exp, b_exp] = fitting.coefficients;
          predictedGrayScale = a_exp * Math.exp(b_exp * rawValue);
          break;
        case 'polynomial':
          const [a_poly, b_poly, c_poly, d_poly] = fitting.coefficients;
          predictedGrayScale = a_poly * Math.pow(rawValue, 3) + 
                              b_poly * Math.pow(rawValue, 2) + 
                              c_poly * rawValue + d_poly;
          break;
        case 'power':
          if (rawValue > 0) {
            const [a_pow, b_pow] = fitting.coefficients;
            predictedGrayScale = a_pow * Math.pow(rawValue, b_pow);
          }
          break;
        case 'bivariate':
          const [a_biv, b_biv, c_biv] = fitting.coefficients;
          predictedGrayScale = a_biv * Math.pow(rawValue, 2) + 
                              b_biv * rawValue + c_biv;
          break;
      }
      
      methodPredictions[fitting.type] = {
        predictedGrayScale,
        formula: fitting.formula,
        confidence: fitting.rSquared,
        fittingType: fitting.type
      };
    });
    
    const predictions = Object.entries(methodPredictions);
    if (predictions.length === 0) {
      return <p className="text-gray-500">该位置暂无有效拟合结果</p>;
    }
    
    return (
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm mb-2">
            <span className="text-gray-600">亮度值:</span>
            <span className="ml-2 font-medium">{rawValue.toFixed(2)}</span>
          </div>
        </div>
        
        <div className="space-y-3">
          <h6 className="font-medium text-gray-700">所有拟合方法预测结果:</h6>
          {predictions.map(([method, prediction]) => (
            <div key={method} className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-700">
                  {getTypeLabel(method)}
                </span>
                <span className="text-lg font-bold text-blue-600">
                  {prediction.predictedGrayScale.toFixed(6)}
                </span>
              </div>
              <div className="text-sm text-gray-600 mb-2">
                置信度(R²): <span className="font-medium">{(prediction.confidence * 100).toFixed(2)}%</span>
              </div>
              <div className="text-sm text-gray-500 font-mono bg-white p-2 rounded border">
                {prediction.formula}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [doubleClickedCell, rawData, grayScaleData.values, brightnessBlocks]);

  // 生成预测结果
  const generatePredictions = useCallback(async () => {
    if (!rawData) {
      setError('请先上传原始数据');
      return;
    }

    if (!grayScaleData.values.length || !brightnessBlocks.length) {
      setError('无法获取有效的拟合数据');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setError(null);

    try {
      // 步骤1: 数据验证 (10%)
      setGenerationProgress(10);
      await new Promise(resolve => setTimeout(resolve, 100));

      // 提取中心像素值和灰阶值
      const centerPixelValues = brightnessBlocks.map(block => block.centerPixelValue);
      const grayScaleValues = grayScaleData.values;

      if (centerPixelValues.length !== grayScaleValues.length) {
        setError('拟合数据长度不匹配');
        return;
      }

      // 步骤2: 执行拟合算法 (30%)
      setGenerationProgress(30);
      await new Promise(resolve => setTimeout(resolve, 200));

      const allFittingResults = performAllFittings({
        x: centerPixelValues,
        y: grayScaleValues
      });

      // 步骤3: 找到最佳拟合结果 (50%)
      setGenerationProgress(50);
      await new Promise(resolve => setTimeout(resolve, 100));

      const bestFitting = allFittingResults.reduce((best, current) => {
        if (isNaN(current.rSquared) || current.rSquared < 0) return best;
        if (!best || current.rSquared > best.rSquared) return current;
        return best;
      }, null as FittingResult | null);

      if (!bestFitting) {
        setError('无法获取有效的拟合结果');
        return;
      }

      setBestFittingResult(bestFitting);

      // 步骤4: 计算预测结果 (80%)
      setGenerationProgress(80);
      await new Promise(resolve => setTimeout(resolve, 300));

      const totalValues = rawData.values.length;
      const predictions: PredictionResult[] = [];

      for (let index = 0; index < totalValues; index++) {
        const rawValue = rawData.values[index];
        // 计算对应的亮度值
        let brightnessValue = rawValue; // 使用原始数据值作为亮度值

        // 为每种拟合方法计算预测值
        const methodPredictions: { [key: string]: { predictedGrayScale: number; formula: string; confidence: number; fittingType: string } } = {};
        
        allFittingResults.forEach(fitting => {
          if (isNaN(fitting.rSquared) || fitting.rSquared < 0) return;
          
          let predictedGrayScale = 0;
          
          // 根据拟合类型计算预测值
          switch (fitting.type) {
            case 'logarithmic':
              if (rawValue > 0) {
                const [a, b] = fitting.coefficients;
                predictedGrayScale = a * Math.log(rawValue) + b;
              }
              break;
            case 'exponential':
              const [a_exp, b_exp] = fitting.coefficients;
              predictedGrayScale = a_exp * Math.exp(b_exp * rawValue);
              break;
            case 'polynomial':
              const [a_poly, b_poly, c_poly, d_poly] = fitting.coefficients;
              predictedGrayScale = a_poly * Math.pow(rawValue, 3) + 
                                  b_poly * Math.pow(rawValue, 2) + 
                                  c_poly * rawValue + d_poly;
              break;
            case 'power':
              if (rawValue > 0) {
                const [a_pow, b_pow] = fitting.coefficients;
                predictedGrayScale = a_pow * Math.pow(rawValue, b_pow);
              }
              break;
            case 'bivariate':
              const [a_biv, b_biv, c_biv] = fitting.coefficients;
              predictedGrayScale = a_biv * Math.pow(rawValue, 2) + 
                                  b_biv * rawValue + c_biv;
              break;
          }

          methodPredictions[fitting.type] = {
            predictedGrayScale,
            formula: fitting.formula,
            confidence: fitting.rSquared,
            fittingType: fitting.type
          };
        });

        predictions.push({
          position: rawData.positions[index],
          brightnessValue,
          predictions: methodPredictions
        });

        // 更新进度 (80% - 95%)
        const progress = 80 + Math.floor((index / totalValues) * 15);
        setGenerationProgress(progress);
        
        // 每处理100个数据点暂停一下，让UI更新
        if (index % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // 步骤5: 完成 (100%)
      setGenerationProgress(100);
      await new Promise(resolve => setTimeout(resolve, 200));

      setPredictionResults(predictions);
      setError(null);
    } catch (err) {
      console.error('预测生成错误:', err);
      setError(err instanceof Error ? err.message : '预测生成失败');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  }, [rawData, grayScaleData, brightnessBlocks]);

  // 导出预测结果到Excel
  const exportToExcel = useCallback(() => {
    if (predictionResults.length === 0 || !rawData) {
      setError('没有预测结果可导出');
      return;
    }

    const workbook = XLSX.utils.book_new();
    
    // 创建矩阵格式的预测结果工作表
    const rows = 20; // A2-AF21 共20行
    const cols = 32; // A-AF 共32列
    
    // 将列数字转换为字母的辅助函数
    const numToCol = (num: number): string => {
      let result = '';
      while (num > 0) {
        num--;
        result = String.fromCharCode('A'.charCodeAt(0) + (num % 26)) + result;
        num = Math.floor(num / 26);
      }
      return result;
    };
    
    // 创建列标题 (A-AF)
    const colHeaders: string[] = [];
    for (let i = 0; i < cols; i++) {
      colHeaders.push(numToCol(i + 1));
    }
    
    // 创建原始数据矩阵工作表
    const originalMatrixData = [];
    originalMatrixData.push(['', ...colHeaders]);
    
    for (let row = 0; row < rows; row++) {
      const rowData: (string | number)[] = [row + 2]; // 行号从2开始
      for (let col = 0; col < cols; col++) {
        if (row < rawData.matrix.length && col < rawData.matrix[row].length) {
          rowData.push(rawData.matrix[row][col]);
        } else {
          rowData.push('');
        }
      }
      originalMatrixData.push(rowData);
    }
    
    const originalWorksheet = XLSX.utils.aoa_to_sheet(originalMatrixData);
    XLSX.utils.book_append_sheet(workbook, originalWorksheet, '原始数据');
    
    // 获取所有拟合方法
    const allMethods = new Set<string>();
    predictionResults.forEach(result => {
      Object.keys(result.predictions).forEach(method => allMethods.add(method));
    });
    
    // 为每种拟合方法创建单独的预测结果矩阵
    Array.from(allMethods).forEach(method => {
      const methodMatrixData: (string | number)[][] = [];
      methodMatrixData.push(['', ...colHeaders]);
      
      for (let row = 0; row < rows; row++) {
        const rowData: (string | number)[] = [row + 2]; // 行号从2开始
        for (let col = 0; col < cols; col++) {
          const dataIndex = row * cols + col;
          if (dataIndex < predictionResults.length && predictionResults[dataIndex].predictions[method]) {
            rowData.push(parseFloat(predictionResults[dataIndex].predictions[method].predictedGrayScale.toFixed(6)));
          } else {
            rowData.push('');
          }
        }
        methodMatrixData.push(rowData);
      }
      
      const methodWorksheet = XLSX.utils.aoa_to_sheet(methodMatrixData);
      XLSX.utils.book_append_sheet(workbook, methodWorksheet, getTypeLabel(method));
    });
    
    // 创建详细预测结果工作表
    const detailData: any[] = [];
    detailData.push(['位置', '亮度值', '拟合方法', '预测灰阶值', '置信度(R²)', '拟合公式']);
    
    predictionResults.forEach(result => {
      Object.entries(result.predictions).forEach(([method, prediction]) => {
        detailData.push([
          result.position,
          result.brightnessValue.toFixed(2),
          getTypeLabel(method),
          prediction.predictedGrayScale.toFixed(6),
          prediction.confidence.toFixed(6),
          prediction.formula
        ]);
      });
    });
    
    const detailWorksheet = XLSX.utils.aoa_to_sheet(detailData);
    XLSX.utils.book_append_sheet(workbook, detailWorksheet, '详细结果');
    
    // 添加拟合信息工作表
    if (bestFittingResult) {
      const fittingInfo = [
        ['拟合信息', ''],
        ['最佳拟合类型', getTypeLabel(bestFittingResult.type)],
        ['拟合公式', bestFittingResult.formula],
        ['R²值', bestFittingResult.rSquared.toFixed(6)],
        ['RMSE', bestFittingResult.rmse.toFixed(6)],
        ['MAE', bestFittingResult.mae.toFixed(6)],
        ['最大误差', bestFittingResult.maxError.toFixed(6)]
      ];
      
      const fittingWs = XLSX.utils.aoa_to_sheet(fittingInfo);
      XLSX.utils.book_append_sheet(workbook, fittingWs, '拟合信息');
    }
    
    // 下载文件
    const fileName = `原始数据预测结果_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }, [predictionResults, bestFittingResult, rawData]);

  // 获取拟合类型标签
  const getTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'logarithmic': '对数拟合',
      'exponential': '指数拟合',
      'polynomial': '三次多项式拟合',
      'power': '幂函数拟合',
      'bivariate': '二次多项式拟合'
    };
    return labels[type] || type;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-6">原始数据预测</h3>
      
      {/* 文件上传区域 */}
      <div className="mb-6">
        <h4 className="font-medium mb-3">上传原始数据文件 (Sheet3)</h4>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="raw-file-upload"
          />
          <label
            htmlFor="raw-file-upload"
            className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            选择Excel文件
          </label>
          <p className="mt-2 text-sm text-gray-500">
            请选择包含Sheet3工作表的Excel文件，原始数据应位于A2-AF21范围
          </p>
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-700">正在读取文件...</p>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* 原始数据概览 */}
      {rawData && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">原始数据概览</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">矩阵维度:</span>
              <span className="ml-2 font-medium">{rawData.matrix.length} × {rawData.matrix[0]?.length || 0}</span>
            </div>
            <div>
              <span className="text-gray-600">数值范围:</span>
              <span className="ml-2 font-medium">
                {Math.min(...rawData.matrix.flat()).toFixed(2)} - {Math.max(...rawData.matrix.flat()).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 预测生成进度 */}
      {isGenerating && (
        <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-blue-800">正在生成预测数据...</h4>
            <span className="text-sm font-medium text-blue-600">{generationProgress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${generationProgress}%` }}
            ></div>
          </div>
          <div className="mt-2 text-sm text-blue-700">
            {generationProgress <= 10 && '正在验证数据...'}
            {generationProgress > 10 && generationProgress <= 30 && '正在执行拟合算法...'}
            {generationProgress > 30 && generationProgress <= 50 && '正在分析最佳拟合结果...'}
            {generationProgress > 50 && generationProgress <= 95 && '正在计算预测结果...'}
            {generationProgress > 95 && '即将完成...'}
          </div>
        </div>
      )}

      {/* 生成预测按钮 */}
      {rawData && grayScaleData.values.length > 0 && brightnessBlocks.length > 0 && (
        <div className="mb-6">
          <button
            onClick={generatePredictions}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            生成预测结果
          </button>
        </div>
      )}

      {/* 最佳拟合信息 */}
      {bestFittingResult && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium mb-2">使用的最佳拟合模型</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">拟合类型：</span>
              <span className="font-medium">{getTypeLabel(bestFittingResult.type)}</span>
            </div>
            <div>
              <span className="text-gray-600">R²值：</span>
              <span className="font-medium">{bestFittingResult.rSquared.toFixed(6)}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">拟合公式：</span>
              <span className="font-medium font-mono">{bestFittingResult.formula}</span>
            </div>
          </div>
        </div>
      )}

      {/* 原始数据热力图 */}
      {rawData && (
        <div className="mb-6">
          <h4 className="font-medium mb-3">原始数据热力图</h4>
          
          {/* 颜色图例 */}
          <div className="mb-3 flex items-center gap-4">
            <span className="text-sm text-gray-600">颜色图例:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-900 border border-gray-300"></div>
              <span className="text-xs text-gray-600">高值</span>
              <div className="w-20 h-4 bg-gradient-to-r from-blue-900 via-blue-400 to-blue-100 border border-gray-300"></div>
              <div className="w-4 h-4 bg-blue-100 border border-gray-300"></div>
              <span className="text-xs text-gray-600">低值</span>
            </div>
            <div className="text-xs text-gray-500">
              范围: {Math.min(...rawData.matrix.flat()).toFixed(2)} - {Math.max(...rawData.matrix.flat()).toFixed(2)}
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200 overflow-x-auto">
            <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${rawData.matrix[0]?.length || 32}, minmax(24px, 1fr))` }}>
              {rawData.matrix.map((row, rowIndex) =>
                row.map((value, colIndex) => {
                  const minValue = Math.min(...rawData.matrix.flat());
                  const maxValue = Math.max(...rawData.matrix.flat());
                  const normalizedValue = (value - minValue) / (maxValue - minValue);
                  
                  // 使用蓝色渐变色彩映射
                  const blueIntensity = Math.round(normalizedValue * 200 + 55); // 55-255范围
                  const backgroundColor = `rgb(${255 - blueIntensity}, ${255 - blueIntensity}, 255)`;
                  
                  // 根据背景色调整文字颜色
                  const textColor = normalizedValue > 0.5 ? 'white' : 'black';
                  
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className="aspect-square border border-gray-200 cursor-pointer hover:border-blue-600 hover:border-2 transition-all duration-200 flex items-center justify-center text-xs font-medium hover:shadow-md"
                      style={{ backgroundColor, color: textColor }}

                      onDoubleClick={() => handleDoubleClick(rowIndex, colIndex)}
                      title={`位置: ${numToCol(colIndex + 1)}${rowIndex + 2}, 值: ${value.toFixed(2)}`}
                    >
                      {value.toFixed(1)}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          
          {/* 双击拟合结果卡片 */}
          {doubleClickedCell && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleCloseDoubleClickCard}>
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h5 className="text-lg font-semibold">位置 {numToCol(doubleClickedCell.col + 1)}{doubleClickedCell.row + 2} 详细拟合结果</h5>
                  <button
                    onClick={handleCloseDoubleClickCard}
                    className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
                    aria-label="关闭"
                  >
                    ×
                  </button>
                </div>
                {doubleClickPredictionContent}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 预测结果 */}
      {predictionResults.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-medium">预测结果</h4>
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
            >
              导出到Excel
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {predictionResults.map((result, index) => (
              <div key={index} className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4 rounded-lg border border-blue-200 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600">位置: {result.position}</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">亮度值:</span>
                    <span className="text-sm font-medium">{result.brightnessValue.toFixed(2)}</span>
                  </div>
                  
                  {/* 显示所有拟合方法的预测结果 */}
                  <div className="mt-3 pt-2 border-t border-blue-200">
                    <div className="text-xs font-medium text-gray-700 mb-2">各拟合方法预测值:</div>
                    <div className="space-y-2">
                      {Object.entries(result.predictions).map(([method, prediction]) => (
                        <div key={method} className="bg-white rounded p-2 border">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-gray-600">
                              {getTypeLabel(method)}
                            </span>
                            <span className="text-xs text-blue-600 font-medium">
                              {prediction.predictedGrayScale.toFixed(4)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mb-1">
                            置信度: {(prediction.confidence * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-400 break-all font-mono">
                            {prediction.formula}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* 统计信息 */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h5 className="font-medium mb-2">预测统计</h5>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">预测数据点：</span>
                <span className="font-medium">{predictionResults.length}</span>
              </div>
              <div>
                <span className="text-gray-600">拟合方法数：</span>
                <span className="font-medium">
                  {predictionResults.length > 0 ? Object.keys(predictionResults[0].predictions).length : 0}
                </span>
              </div>
              <div>
                <span className="text-gray-600">最佳拟合：</span>
                <span className="font-medium">
                  {bestFittingResult ? getTypeLabel(bestFittingResult.type) : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 使用说明 */}
      {!rawData && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium mb-2 text-yellow-800">使用说明</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>1. 首先确保已上传并处理了原始数据文件</li>
            <li>2. 上传包含Sheet3工作表的Excel文件，目标数据应位于B列</li>
            <li>3. 系统将自动选择最佳拟合模型进行预测</li>
            <li>4. 生成预测结果后可导出到Excel文件</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default TargetDataPrediction;