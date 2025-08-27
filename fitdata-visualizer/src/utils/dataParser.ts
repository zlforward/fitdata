import * as XLSX from 'xlsx';

export interface GrayScaleData {
  values: number[];
  positions: string[];
}

export interface BrightnessBlock {
  data: number[][];
  normalizedData?: number[][];
  startRow: number;
  endRow: number;
  label: string;
  centerPixelValue: number;
}

export interface ParsedData {
  grayScale: GrayScaleData;
  brightnessBlocks: BrightnessBlock[];
}

// 将列索引转换为Excel列名 (0->A, 1->B, etc.)
const getColumnName = (index: number): string => {
  let result = '';
  while (index >= 0) {
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26) - 1;
  }
  return result;
};

// 解析灰阶数据：从B1开始，每隔22个单元格获取下一个值
export const parseGrayScaleData = (worksheet: XLSX.WorkSheet): GrayScaleData => {
  const values: number[] = [];
  const positions: string[] = [];
  
  let currentRow = 1; // 从第1行开始
  const column = 'B'; // B列
  
  while (true) {
    const cellAddress = `${column}${currentRow}`;
    const cell = worksheet[cellAddress];
    
    // 如果单元格为空或不存在，停止解析
    if (!cell || cell.v === undefined || cell.v === null || cell.v === '') {
      break;
    }
    
    const value = typeof cell.v === 'number' ? cell.v : parseFloat(cell.v.toString());
    if (!isNaN(value)) {
      values.push(value);
      positions.push(cellAddress);
    }
    
    currentRow += 22; // 每隔22个单元格
  }
  
  return { values, positions };
};

// 解析亮度数据块：按照规律生成所有数据块，每隔22行一个32x20的矩阵
export const parseBrightnessBlocks = (worksheet: XLSX.WorkSheet): BrightnessBlock[] => {
  const blocks: BrightnessBlock[] = [];
  
  let blockIndex = 1;
  let currentStartRow = 2; // 从第2行开始
  
  // 持续解析直到找不到有效数据
  while (true) {
    const currentEndRow = currentStartRow + 19; // 每个块20行数据
    const data: number[][] = [];
    let hasValidData = false;
    
    // 解析32列 (A到AF) x 20行的数据
    for (let row = currentStartRow; row <= currentEndRow; row++) {
      const rowData: number[] = [];
      
      // 从A列(0)到AF列(31)，共32列
      for (let col = 0; col < 32; col++) {
        const columnName = getColumnName(col);
        const cellAddress = `${columnName}${row}`;
        const cell = worksheet[cellAddress];
        
        let value = 0;
        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
          const parsedValue = typeof cell.v === 'number' ? cell.v : parseFloat(cell.v.toString());
          if (!isNaN(parsedValue)) {
            value = parsedValue;
            hasValidData = true;
          }
        }
        
        rowData.push(value);
      }
      
      data.push(rowData);
    }
    
    // 如果这个块没有任何有效数据，停止解析
    if (!hasValidData) {
      break;
    }
    
    // 计算中心像素值 (32x20矩阵的中心位置为第16列，第10行)
    const centerRow = 9; // 第10行 (0-based index)
    const centerCol = 15; // 第16列 (0-based index)
    const centerPixelValue = data[centerRow] && data[centerRow][centerCol] ? data[centerRow][centerCol] : 0;
    
    // 计算归一化数据（以中心像素为基准）
    const normalizedData: number[][] = data.map(row => 
      row.map(value => centerPixelValue !== 0 ? value / centerPixelValue : 0)
    );
    
    blocks.push({
      data,
      normalizedData,
      startRow: currentStartRow,
      endRow: currentEndRow,
      label: `数据块 ${blockIndex} (A${currentStartRow}-AF${currentEndRow})`,
      centerPixelValue
    });
    
    blockIndex++;
    currentStartRow += 22; // 每隔22行开始下一个数据块
  }
  
  return blocks;
};

// 主解析函数
export const parseExcelData = (file: File): Promise<ParsedData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // 获取第一个工作表
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 解析数据
        const grayScale = parseGrayScaleData(worksheet);
        const brightnessBlocks = parseBrightnessBlocks(worksheet);
        
        resolve({
          grayScale,
          brightnessBlocks
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};