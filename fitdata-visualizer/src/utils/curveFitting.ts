// 曲线拟合工具类

export interface FittingResult {
  type: 'logarithmic' | 'exponential' | 'polynomial' | 'power' | 'bivariate';
  formula: string;
  coefficients: number[];
  rSquared: number;
  predictedValues: number[];
  rmse: number; // 均方根误差
  mae: number;  // 平均绝对误差
  maxError: number; // 最大误差
}

export interface FittingData {
  x: number[]; // 中心像素值
  y: number[]; // 灰阶值
}

// 计算R²决定系数
const calculateRSquared = (actual: number[], predicted: number[]): number => {
  const actualMean = actual.reduce((sum, val) => sum + val, 0) / actual.length;
  const totalSumSquares = actual.reduce((sum, val) => sum + Math.pow(val - actualMean, 2), 0);
  const residualSumSquares = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
  
  return 1 - (residualSumSquares / totalSumSquares);
};

// 计算均方根误差 (RMSE)
const calculateRMSE = (actual: number[], predicted: number[]): number => {
  const sumSquaredErrors = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
  return Math.sqrt(sumSquaredErrors / actual.length);
};

// 计算平均绝对误差 (MAE)
const calculateMAE = (actual: number[], predicted: number[]): number => {
  const sumAbsoluteErrors = actual.reduce((sum, val, i) => sum + Math.abs(val - predicted[i]), 0);
  return sumAbsoluteErrors / actual.length;
};

// 计算最大误差
const calculateMaxError = (actual: number[], predicted: number[]): number => {
  return Math.max(...actual.map((val, i) => Math.abs(val - predicted[i])));
};

// 对数拟合: y = a * ln(x) + b
export const logarithmicFitting = (data: FittingData): FittingResult => {
  const { x, y } = data;
  const n = x.length;
  
  // 过滤掉x <= 0的点
  const validIndices = x.map((val, i) => val > 0 ? i : -1).filter(i => i !== -1);
  const validX = validIndices.map(i => x[i]);
  const validY = validIndices.map(i => y[i]);
  const validN = validX.length;
  
  if (validN < 2) {
    return {
      type: 'logarithmic',
      formula: '无法拟合（数据点不足）',
      coefficients: [0, 0],
      rSquared: 0,
      predictedValues: new Array(n).fill(0),
      rmse: 0,
      mae: 0,
      maxError: 0
    };
  }
  
  const sumLnX = validX.reduce((sum, val) => sum + Math.log(val), 0);
  const sumY = validY.reduce((sum, val) => sum + val, 0);
  const sumLnXY = validX.reduce((sum, val, i) => sum + Math.log(val) * validY[i], 0);
  const sumLnX2 = validX.reduce((sum, val) => sum + Math.pow(Math.log(val), 2), 0);
  
  const a = (validN * sumLnXY - sumLnX * sumY) / (validN * sumLnX2 - Math.pow(sumLnX, 2));
  const b = (sumY - a * sumLnX) / validN;
  
  const predictedValues = x.map(val => val > 0 ? a * Math.log(val) + b : 0);
  const rSquared = calculateRSquared(y, predictedValues);
  const rmse = calculateRMSE(y, predictedValues);
  const mae = calculateMAE(y, predictedValues);
  const maxError = calculateMaxError(y, predictedValues);
  
  return {
    type: 'logarithmic',
    formula: `y = ${a.toFixed(6)} * ln(x) + ${b.toFixed(6)}`,
    coefficients: [a, b],
    rSquared,
    predictedValues,
    rmse,
    mae,
    maxError
  };
};

// 指数拟合: y = a * e^(b*x)
export const exponentialFitting = (data: FittingData): FittingResult => {
  const { x, y } = data;
  const n = x.length;
  
  // 过滤掉y <= 0的点
  const validIndices = y.map((val, i) => val > 0 ? i : -1).filter(i => i !== -1);
  const validX = validIndices.map(i => x[i]);
  const validY = validIndices.map(i => y[i]);
  const validN = validX.length;
  
  if (validN < 2) {
    return {
      type: 'exponential',
      formula: '无法拟合（数据点不足）',
      coefficients: [0, 0],
      rSquared: 0,
      predictedValues: new Array(n).fill(0),
      rmse: 0,
      mae: 0,
      maxError: 0
    };
  }
  
  const sumX = validX.reduce((sum, val) => sum + val, 0);
  const sumLnY = validY.reduce((sum, val) => sum + Math.log(val), 0);
  const sumXLnY = validX.reduce((sum, val, i) => sum + val * Math.log(validY[i]), 0);
  const sumX2 = validX.reduce((sum, val) => sum + Math.pow(val, 2), 0);
  
  const b = (validN * sumXLnY - sumX * sumLnY) / (validN * sumX2 - Math.pow(sumX, 2));
  const lnA = (sumLnY - b * sumX) / validN;
  const a = Math.exp(lnA);
  
  const predictedValues = x.map(val => a * Math.exp(b * val));
  const rSquared = calculateRSquared(y, predictedValues);
  const rmse = calculateRMSE(y, predictedValues);
  const mae = calculateMAE(y, predictedValues);
  const maxError = calculateMaxError(y, predictedValues);
  
  return {
    type: 'exponential',
    formula: `y = ${a.toFixed(6)} * e^(${b.toFixed(6)} * x)`,
    coefficients: [a, b],
    rSquared,
    predictedValues,
    rmse,
    mae,
    maxError
  };
};

// 三次多项式拟合: y = ax³ + bx² + cx + d
export const polynomialFitting = (data: FittingData): FittingResult => {
  const { x, y } = data;
  const n = x.length;
  
  if (n < 4) {
    return {
      type: 'polynomial',
      formula: '无法拟合（数据点不足）',
      coefficients: [0, 0, 0, 0],
      rSquared: 0,
      predictedValues: new Array(n).fill(0),
      rmse: 0,
      mae: 0,
      maxError: 0
    };
  }
  
  // 构建矩阵方程 A * coeffs = B
  const A: number[][] = [];
  const B: number[] = [];
  
  // 计算各项和
  const sums = {
    x0: n,
    x1: x.reduce((sum, val) => sum + val, 0),
    x2: x.reduce((sum, val) => sum + Math.pow(val, 2), 0),
    x3: x.reduce((sum, val) => sum + Math.pow(val, 3), 0),
    x4: x.reduce((sum, val) => sum + Math.pow(val, 4), 0),
    x5: x.reduce((sum, val) => sum + Math.pow(val, 5), 0),
    x6: x.reduce((sum, val) => sum + Math.pow(val, 6), 0),
    y: y.reduce((sum, val) => sum + val, 0),
    xy: x.reduce((sum, val, i) => sum + val * y[i], 0),
    x2y: x.reduce((sum, val, i) => sum + Math.pow(val, 2) * y[i], 0),
    x3y: x.reduce((sum, val, i) => sum + Math.pow(val, 3) * y[i], 0)
  };
  
  // 构建系数矩阵
  A.push([sums.x6, sums.x5, sums.x4, sums.x3]);
  A.push([sums.x5, sums.x4, sums.x3, sums.x2]);
  A.push([sums.x4, sums.x3, sums.x2, sums.x1]);
  A.push([sums.x3, sums.x2, sums.x1, sums.x0]);
  
  B.push(sums.x3y);
  B.push(sums.x2y);
  B.push(sums.xy);
  B.push(sums.y);
  
  // 高斯消元法求解
  const coeffs = gaussianElimination(A, B);
  
  if (!coeffs) {
    return {
      type: 'polynomial',
      formula: '无法拟合（矩阵奇异）',
      coefficients: [0, 0, 0, 0],
      rSquared: 0,
      predictedValues: new Array(n).fill(0),
      rmse: 0,
      mae: 0,
      maxError: 0
    };
  }
  
  const [a, b, c, d] = coeffs;
  const predictedValues = x.map(val => a * Math.pow(val, 3) + b * Math.pow(val, 2) + c * val + d);
  const rSquared = calculateRSquared(y, predictedValues);
  const rmse = calculateRMSE(y, predictedValues);
  const mae = calculateMAE(y, predictedValues);
  const maxError = calculateMaxError(y, predictedValues);
  
  return {
    type: 'polynomial',
    formula: `y = ${a.toFixed(6)}x³ + ${b.toFixed(6)}x² + ${c.toFixed(6)}x + ${d.toFixed(6)}`,
    coefficients: [a, b, c, d],
    rSquared,
    predictedValues,
    rmse,
    mae,
    maxError
  };
};

// 幂函数拟合: y = a * x^b
export const powerFitting = (data: FittingData): FittingResult => {
  const { x, y } = data;
  const n = x.length;
  
  // 过滤掉x <= 0或y <= 0的点
  const validIndices = x.map((val, i) => val > 0 && y[i] > 0 ? i : -1).filter(i => i !== -1);
  const validX = validIndices.map(i => x[i]);
  const validY = validIndices.map(i => y[i]);
  const validN = validX.length;
  
  if (validN < 2) {
    return {
      type: 'power',
      formula: '无法拟合（数据点不足）',
      coefficients: [0, 0],
      rSquared: 0,
      predictedValues: new Array(n).fill(0),
      rmse: 0,
      mae: 0,
      maxError: 0
    };
  }
  
  const sumLnX = validX.reduce((sum, val) => sum + Math.log(val), 0);
  const sumLnY = validY.reduce((sum, val) => sum + Math.log(val), 0);
  const sumLnXLnY = validX.reduce((sum, val, i) => sum + Math.log(val) * Math.log(validY[i]), 0);
  const sumLnX2 = validX.reduce((sum, val) => sum + Math.pow(Math.log(val), 2), 0);
  
  const b = (validN * sumLnXLnY - sumLnX * sumLnY) / (validN * sumLnX2 - Math.pow(sumLnX, 2));
  const lnA = (sumLnY - b * sumLnX) / validN;
  const a = Math.exp(lnA);
  
  const predictedValues = x.map(val => val > 0 ? a * Math.pow(val, b) : 0);
  const rSquared = calculateRSquared(y, predictedValues);
  const rmse = calculateRMSE(y, predictedValues);
  const mae = calculateMAE(y, predictedValues);
  const maxError = calculateMaxError(y, predictedValues);
  
  return {
    type: 'power',
    formula: `y = ${a.toFixed(6)} * x^${b.toFixed(6)}`,
    coefficients: [a, b],
    rSquared,
    predictedValues,
    rmse,
    mae,
    maxError
  };
};

// 二元多项式拟合: y = a*x² + b*x + c
export const bivariateFitting = (data: FittingData): FittingResult => {
  const { x, y } = data;
  const n = x.length;
  
  if (n < 3) {
    return {
      type: 'bivariate',
      formula: '无法拟合（数据点不足）',
      coefficients: [0, 0, 0],
      rSquared: 0,
      predictedValues: new Array(n).fill(0),
      rmse: 0,
      mae: 0,
      maxError: 0
    };
  }
  
  // 构建矩阵方程 A * coeffs = B
  const A: number[][] = [];
  const B: number[] = [];
  
  // 计算各项和
  const sums = {
    x0: n,
    x1: x.reduce((sum, val) => sum + val, 0),
    x2: x.reduce((sum, val) => sum + Math.pow(val, 2), 0),
    x3: x.reduce((sum, val) => sum + Math.pow(val, 3), 0),
    x4: x.reduce((sum, val) => sum + Math.pow(val, 4), 0),
    y: y.reduce((sum, val) => sum + val, 0),
    xy: x.reduce((sum, val, i) => sum + val * y[i], 0),
    x2y: x.reduce((sum, val, i) => sum + Math.pow(val, 2) * y[i], 0)
  };
  
  // 构建系数矩阵 (二次多项式)
  A.push([sums.x4, sums.x3, sums.x2]);
  A.push([sums.x3, sums.x2, sums.x1]);
  A.push([sums.x2, sums.x1, sums.x0]);
  
  B.push(sums.x2y);
  B.push(sums.xy);
  B.push(sums.y);
  
  // 高斯消元法求解
  const coeffs = gaussianElimination(A, B);
  
  if (!coeffs) {
    return {
      type: 'bivariate',
      formula: '无法拟合（矩阵奇异）',
      coefficients: [0, 0, 0],
      rSquared: 0,
      predictedValues: new Array(n).fill(0),
      rmse: 0,
      mae: 0,
      maxError: 0
    };
  }
  
  const [a, b, c] = coeffs;
  const predictedValues = x.map(val => a * Math.pow(val, 2) + b * val + c);
  const rSquared = calculateRSquared(y, predictedValues);
  const rmse = calculateRMSE(y, predictedValues);
  const mae = calculateMAE(y, predictedValues);
  const maxError = calculateMaxError(y, predictedValues);
  
  return {
    type: 'bivariate',
    formula: `y = ${a.toFixed(6)}x² + ${b.toFixed(6)}x + ${c.toFixed(6)}`,
    coefficients: [a, b, c],
    rSquared,
    predictedValues,
    rmse,
    mae,
    maxError
  };
};

// 高斯消元法求解线性方程组
const gaussianElimination = (A: number[][], B: number[]): number[] | null => {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, B[i]]);
  
  // 前向消元
  for (let i = 0; i < n; i++) {
    // 寻找主元
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    
    // 交换行
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
    
    // 检查是否为奇异矩阵
    if (Math.abs(augmented[i][i]) < 1e-10) {
      return null;
    }
    
    // 消元
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }
  
  // 回代
  const solution = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    solution[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      solution[i] -= augmented[i][j] * solution[j];
    }
    solution[i] /= augmented[i][i];
  }
  
  return solution;
};

// 执行所有拟合算法
export const performAllFittings = (data: FittingData): FittingResult[] => {
  return [
    logarithmicFitting(data),
    exponentialFitting(data),
    polynomialFitting(data),
    powerFitting(data),
    bivariateFitting(data)
  ];
};