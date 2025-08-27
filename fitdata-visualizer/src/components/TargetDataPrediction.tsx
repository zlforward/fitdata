import React, { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { FittingResult, performAllFittings } from '../utils/curveFitting';
import { parseExcelData } from '../utils/dataParser';

interface RawData {
  values: number[];
  positions: string[];
  matrix: number[][];
}

interface CachedPredictionResult {
  rawValue: number;
  methodPredictions: {
    [key: string]: {
      predictedGrayScale: number;
      formula: string;
      confidence: number;
      fittingType: string;
    }
  };
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
  
  // 本地状态用于存储从文件解析的数据
  const [localGrayScaleData, setLocalGrayScaleData] = useState<{ values: number[]; positions: string[]; } | null>(null);
  const [localBrightnessBlocks, setLocalBrightnessBlocks] = useState<Array<{ label: string; startRow: number; endRow: number; data: number[][]; centerPixelValue: number; normalizedData?: number[][]; }> | null>(null);

  const [doubleClickedCell, setDoubleClickedCell] = useState<{ row: number; col: number } | null>(null);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [cachedPredictionResults, setCachedPredictionResults] = useState<CachedPredictionResult[] | null>(null);

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
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      // 清除缓存的预测结果
      setCachedPredictionResults(null);
      
      // 使用parseExcelData解析完整数据
      const parsedData = await parseExcelData(file);
      
      // 更新本地的grayScaleData和brightnessBlocks
      setLocalGrayScaleData(parsedData.grayScale);
      setLocalBrightnessBlocks(parsedData.brightnessBlocks);
      
      // 设置原始数据（从Sheet3读取）
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
      
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
      
      // 自动生成预测结果（延迟确保状态更新完成）
      setTimeout(async () => {
        await generatePredictions();
      }, 100);
    } catch (error) {
      setError(error instanceof Error ? error.message : '文件读取失败');
    } finally {
      setIsLoading(false);
    }
  }, []);



  // 获取颜色值
  const getColor = (value: number) => {
    if (!rawData || !rawData.matrix || rawData.matrix.length === 0) {
      return 'rgb(255, 255, 255)';
    }
    
    const minValue = Math.min(...rawData.matrix.flat());
    const maxValue = Math.max(...rawData.matrix.flat());
    
    if (maxValue === minValue) return 'rgb(255, 255, 255)';
    
    const normalized = (value - minValue) / (maxValue - minValue);
    const intensity = Math.floor(normalized * 255);
    
    // 使用蓝色到红色的渐变
    const red = intensity;
    const blue = 255 - intensity;
    const green = Math.floor(128 * (1 - Math.abs(normalized - 0.5) * 2));
    
    return `rgb(${red}, ${green}, ${blue})`;
  };

  // 处理双击事件
  const handleDoubleClick = useCallback((rowIndex: number, colIndex: number) => {
    // 如果没有缓存的预测结果，提示用户先生成预测数据
    if (!cachedPredictionResults) {
      setError('请先生成预测数据后再查看详细结果');
      return;
    }
    setDoubleClickedCell({ row: rowIndex, col: colIndex });
  }, [cachedPredictionResults]);

  // 关闭双击卡片
  const handleCloseDoubleClickCard = useCallback(() => {
    setDoubleClickedCell(null);
  }, []);

  // 计算双击卡片的预测结果
  const doubleClickPredictionContent = useMemo(() => {
    // 使用本地数据（如果有）或传入的props数据
    const currentGrayScaleData = localGrayScaleData || grayScaleData;
    const currentBrightnessBlocks = localBrightnessBlocks || brightnessBlocks;
    
    if (!rawData || !currentGrayScaleData.values.length || !currentBrightnessBlocks.length || !doubleClickedCell) {
      return <p className="text-gray-500">预测数据尚未生成，请等待数据处理完成</p>;
    }
    
    // 使用缓存的预测结果，如果没有缓存则返回提示
    if (!cachedPredictionResults) {
      return <p className="text-gray-500">请先生成预测数据</p>;
    }
    
    // 直接从缓存中读取该位置的预测结果
    const cellIndex = doubleClickedCell.row * 32 + doubleClickedCell.col;
    const cachedResult = cachedPredictionResults[cellIndex];
    
    if (!cachedResult) {
      return <p className="text-gray-500">该位置暂无有效拟合结果</p>;
    }
    
    const { rawValue, methodPredictions } = cachedResult;
    const predictions = Object.entries(methodPredictions);
    
    if (predictions.length === 0) {
      return <p className="text-gray-500">该位置暂无有效拟合结果</p>;
    }
    
    return (
      <div className="space-y-2">
        <div className="bg-gray-50 p-2 rounded-lg">
          <div className="text-xs mb-1">
            <span className="text-gray-600">亮度值:</span>
            <span className="ml-2 font-medium">{rawValue.toFixed(2)}</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <h6 className="text-sm font-medium text-gray-700">所有拟合方法预测结果:</h6>
          {(() => {
            // 找出置信度最高的拟合方法
            let bestMethod = '';
            let bestConfidence = -1;
            predictions.forEach(([method, prediction]) => {
              const pred = prediction as {
                predictedGrayScale: number;
                formula: string;
                confidence: number;
                fittingType: string;
              };
              if (pred.confidence > bestConfidence) {
                bestConfidence = pred.confidence;
                bestMethod = method;
              }
            });
            
            return predictions.map(([method, prediction]) => {
              const pred = prediction as {
                predictedGrayScale: number;
                formula: string;
                confidence: number;
                fittingType: string;
              };
              const isBest = method === bestMethod;
              
              return (
                <div 
                  key={method} 
                  className={`p-2 rounded-lg border ${
                    isBest 
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-md' 
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs font-medium ${
                      isBest ? 'text-green-700' : 'text-gray-700'
                    }`}>
                      {isBest && '⭐ '}{getTypeLabel(method)}{isBest && ' (最优)'}
                    </span>
                    <span className={`text-sm font-bold ${
                      isBest ? 'text-green-600' : 'text-blue-600'
                    }`}>
                      {pred.predictedGrayScale.toFixed(6)}
                    </span>
                  </div>
                  <div className={`text-xs mb-1 ${
                    isBest ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    置信度(R²): <span className="font-medium">{(pred.confidence * 100).toFixed(2)}%</span>
                  </div>
                  <div className="text-xs text-gray-500 font-mono bg-white p-1 rounded border">
                    {pred.formula}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    );
  }, [doubleClickedCell, cachedPredictionResults, localGrayScaleData, localBrightnessBlocks, grayScaleData, brightnessBlocks, rawData, getTypeLabel]);

  // 生成预测结果
  const generatePredictions = useCallback(async () => {
    if (!rawData) {
      setError('请先上传原始数据');
      return;
    }

    // 使用本地数据（如果有）或传入的props数据
    const currentGrayScaleData = localGrayScaleData || grayScaleData;
    const currentBrightnessBlocks = localBrightnessBlocks || brightnessBlocks;

    if (!currentGrayScaleData.values.length || !currentBrightnessBlocks.length) {
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

      // 提取中心像素值和灰阶值作为训练数据
      const centerPixelValues = currentBrightnessBlocks.map(block => block.centerPixelValue);
      const grayScaleValues = currentGrayScaleData.values;

      if (centerPixelValues.length !== grayScaleValues.length) {
        setError('拟合数据长度不匹配');
        return;
      }

      // 步骤2: 为每个位置计算独立的拟合结果 (30% - 80%)
      setGenerationProgress(30);
      await new Promise(resolve => setTimeout(resolve, 200));

      const totalValues = rawData.values.length;
      const predictions: PredictionResult[] = [];
      const predictionCache: CachedPredictionResult[] = [];
      let globalBestFitting: FittingResult | null = null;
      let globalBestRSquared = -1;

      // 为每个位置计算独立的拟合公式和预测结果
      for (let index = 0; index < totalValues; index++) {
        const rawValue = rawData.values[index];
        const brightnessValue = rawValue; // 使用原始数据值作为亮度值
        const position = rawData.positions[index];

        // 解析位置信息（如A2, B3等）
        const colMatch = position.match(/^([A-Z]+)/);
        const rowMatch = position.match(/([0-9]+)$/);
        
        if (!colMatch || !rowMatch) {
          console.warn(`无法解析位置: ${position}`);
          continue;
        }

        // 将列字母转换为数字索引
        const colToNum = (col: string): number => {
          let result = 0;
          for (let i = 0; i < col.length; i++) {
            result = result * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
          }
          return result - 1; // 转换为0基索引
        };

        const colIndex = colToNum(colMatch[1]);
        const rowIndex = parseInt(rowMatch[1]) - 2; // 减2是因为数据从第2行开始，转换为0基索引

        // 为当前位置收集对应的训练数据
        const positionTrainingX: number[] = [];
        const positionTrainingY: number[] = [];

        // 从每个亮度块中提取当前位置的数据
        currentBrightnessBlocks.forEach((block, blockIndex) => {
          if (blockIndex < grayScaleValues.length && 
              rowIndex >= 0 && rowIndex < block.data.length &&
              colIndex >= 0 && colIndex < block.data[rowIndex].length) {
            const positionValue = block.data[rowIndex][colIndex];
            positionTrainingX.push(positionValue);
            positionTrainingY.push(grayScaleValues[blockIndex]);
          }
        });

        // 确保有足够的训练数据
        if (positionTrainingX.length < 3) {
          console.warn(`位置 ${position} 的训练数据不足: ${positionTrainingX.length} 个数据点`);
          // 使用全局训练数据作为后备
          positionTrainingX.push(...centerPixelValues);
          positionTrainingY.push(...grayScaleValues);
        }

        // 为当前位置执行独立的拟合计算
        const positionFittingResults = performAllFittings({
          x: positionTrainingX,
          y: positionTrainingY
        });

        // 找到当前位置的最佳拟合结果
        const positionBestFitting = positionFittingResults.reduce((best, current) => {
          if (isNaN(current.rSquared) || current.rSquared < 0) return best;
          if (!best || current.rSquared > best.rSquared) return current;
          return best;
        }, null as FittingResult | null);

        // 更新全局最佳拟合结果
        if (positionBestFitting && positionBestFitting.rSquared > globalBestRSquared) {
          globalBestFitting = positionBestFitting;
          globalBestRSquared = positionBestFitting.rSquared;
        }

        // 使用当前位置的拟合结果计算预测值
        const methodPredictions: { [key: string]: { predictedGrayScale: number; formula: string; confidence: number; fittingType: string } } = {};
        
        positionFittingResults.forEach(fitting => {
          if (isNaN(fitting.rSquared) || fitting.rSquared < 0) return;
          
          let predictedGrayScale = 0;
          
          // 根据拟合类型和该位置的拟合系数计算预测值
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

        // 缓存该位置的预测结果供双击功能使用
        predictionCache.push({
          rawValue,
          methodPredictions
        });

        // 更新进度 (30% - 80%)
        const progress = 30 + Math.floor((index / totalValues) * 50);
        setGenerationProgress(progress);
        
        // 每处理50个数据点暂停一下，让UI更新
        if (index % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // 步骤3: 设置全局最佳拟合结果 (90%)
      setGenerationProgress(90);
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!globalBestFitting) {
        setError('无法获取有效的拟合结果');
        return;
      }

      setBestFittingResult(globalBestFitting);

      // 缓存预测结果
      setCachedPredictionResults(predictionCache);

      // 步骤4: 完成 (100%)
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
  }, [rawData, grayScaleData, brightnessBlocks, localGrayScaleData, localBrightnessBlocks, getTypeLabel]);

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
      {rawData && ((localGrayScaleData && localBrightnessBlocks) || (grayScaleData.values.length > 0 && brightnessBlocks.length > 0)) && (
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
          <p className="text-sm text-gray-600 mb-2">
            双击任意像素位置查看该位置的拟合结果
          </p>
          
          {/* SVG热力图 */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 overflow-x-auto">
            <div className="inline-block">
              <svg
                 width={`${(rawData.matrix[0]?.length || 32) * 24 + 60}`}
                 height={`${rawData.matrix.length * 24 + 60}`}
                 className="bg-white"
               >
                {/* 列标识 (顶部) */}
                {rawData.matrix[0] && Array.from({ length: rawData.matrix[0].length }, (_, colIndex) => (
                  <text
                    key={`col-label-${colIndex}`}
                    x={30 + colIndex * 24 + 12}
                    y={15}
                    textAnchor="middle"
                    className="text-xs fill-gray-600 font-mono"
                  >
                    {numToCol(colIndex + 1)}
                  </text>
                ))}
                
                {/* 行标识 (左侧) */}
                {Array.from({ length: rawData.matrix.length }, (_, rowIndex) => (
                  <text
                    key={`row-label-${rowIndex}`}
                    x={15}
                    y={30 + rowIndex * 24 + 16}
                    textAnchor="middle"
                    className="text-xs fill-gray-600 font-mono"
                  >
                    {rowIndex + 2}
                  </text>
                ))}
                
                {/* 坐标轴标签 */}
                 <text
                   x={30 + (rawData.matrix[0]?.length || 32) * 24 / 2}
                   y={rawData.matrix.length * 24 + 50}
                   textAnchor="middle"
                   className="text-sm font-semibold fill-gray-700"
                 >
                   列索引
                 </text>
                 <text
                   x={-5}
                   y={30 + rawData.matrix.length * 24 / 2}
                   textAnchor="middle"
                   className="text-sm font-semibold fill-gray-700"
                   transform={`rotate(-90, -5, ${30 + rawData.matrix.length * 24 / 2})`}
                 >
                   行索引
                 </text>
                 
                 {/* 热力图数据 */}
                 {rawData.matrix.map((row, rowIndex) => {
                   return row.map((value, colIndex) => {
                    const backgroundColor = getColor(value);
                    
                    // 根据背景色调整文字颜色
                    const minValue = Math.min(...rawData.matrix.flat());
                    const maxValue = Math.max(...rawData.matrix.flat());
                    const normalizedValue = (value - minValue) / (maxValue - minValue);
                    const textColor = normalizedValue > 0.5 ? 'white' : 'black';
                    
                    return (
                      <g key={`${rowIndex}-${colIndex}`}>
                        <rect
                          x={30 + colIndex * 24}
                          y={30 + rowIndex * 24}
                          width="24"
                          height="24"
                          fill={backgroundColor}
                          stroke="#e5e7eb"
                          strokeWidth="0.5"
                          className="cursor-pointer hover:stroke-2 hover:stroke-blue-500"
                          onDoubleClick={() => handleDoubleClick(rowIndex, colIndex)}
                        />
                        <text
                          x={30 + colIndex * 24 + 12}
                          y={30 + rowIndex * 24 + 16}
                          textAnchor="middle"
                          className="text-xs font-medium pointer-events-none"
                          fill={textColor}
                        >
                          {value.toFixed(1)}
                        </text>
                        <title>{`位置: ${numToCol(colIndex + 1)}${rowIndex + 2}, 值: ${value.toFixed(2)}`}</title>
                      </g>
                    );
                  });
                })}
                

              </svg>
            </div>
          </div>
          
          {/* 颜色图例 */}
           <div className="mt-4 flex items-center gap-4">
             <span className="text-sm text-gray-600">数值范围:</span>
             <div className="flex items-center gap-2">
               <div className="w-4 h-4" style={{ backgroundColor: getColor(Math.min(...rawData.matrix.flat())) }}></div>
               <span className="text-xs">{Math.min(...rawData.matrix.flat()).toFixed(2)}</span>
               <div className="w-20 h-4 bg-gradient-to-r" 
                    style={{ 
                      backgroundImage: `linear-gradient(to right, ${getColor(Math.min(...rawData.matrix.flat()))}, ${getColor(Math.max(...rawData.matrix.flat()))})` 
                    }}>
               </div>
               <span className="text-xs">{Math.max(...rawData.matrix.flat()).toFixed(2)}</span>
               <div className="w-4 h-4" style={{ backgroundColor: getColor(Math.max(...rawData.matrix.flat())) }}></div>
             </div>
           </div>

          
          {/* 双击拟合结果卡片 */}
          {doubleClickedCell && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleCloseDoubleClickCard}>
              <div className="bg-white rounded-lg p-4 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-3">
                  <h5 className="text-base font-semibold">位置 {numToCol(doubleClickedCell.col + 1)}{doubleClickedCell.row + 2} 详细拟合结果</h5>
                  <button
                    onClick={handleCloseDoubleClickCard}
                    className="text-gray-500 hover:text-gray-700 text-xl font-bold leading-none"
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
                      {(() => {
                        // 找出当前位置的最佳拟合方法（confidence最高的）
                        const predictions = Object.entries(result.predictions);
                        let bestMethod: string | null = null;
                        let bestConfidence = -1;
                        
                        predictions.forEach(([method, prediction]) => {
                          if (prediction.confidence > bestConfidence) {
                            bestConfidence = prediction.confidence;
                            bestMethod = method;
                          }
                        });
                        
                        return predictions.map(([method, prediction]) => {
                          const isBest = bestMethod && method === bestMethod;
                          return (
                            <div key={method} className={`rounded p-2 border-2 transition-all ${
                              isBest 
                                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 shadow-md' 
                                : 'bg-white border-gray-200'
                            }`}>
                              <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-2">
                                  {isBest && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      ⭐ 最优
                                    </span>
                                  )}
                                  <span className={`text-xs font-medium ${
                                    isBest ? 'text-green-700' : 'text-gray-600'
                                  }`}>
                                    {getTypeLabel(method)}
                                  </span>
                                </div>
                                <span className={`text-xs font-medium ${
                                  isBest ? 'text-green-600' : 'text-blue-600'
                                }`}>
                                  {prediction.predictedGrayScale.toFixed(4)}
                                </span>
                              </div>
                              <div className={`text-xs mb-1 ${
                                isBest ? 'text-green-600' : 'text-gray-500'
                              }`}>
                                置信度: {(prediction.confidence * 100).toFixed(1)}%
                              </div>
                              <div className={`text-xs break-all font-mono ${
                                isBest ? 'text-green-500' : 'text-gray-400'
                              }`}>
                                {prediction.formula}
                              </div>
                            </div>
                          );
                        });
                      })()} 
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