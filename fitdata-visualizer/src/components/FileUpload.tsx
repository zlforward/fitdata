import React, { useState, useCallback, useRef } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isLoading }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') || 
          file.name.endsWith('.xls')) {
        setSelectedFile(file);
        onFileSelect(file);
      } else {
        alert('请选择Excel文件（.xlsx或.xls格式）');
      }
    }
  }, [onFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-2xl p-10 border border-blue-200">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-full">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-3">
            上传Excel文件
          </h2>
          <p className="text-lg text-gray-600">
            支持 <span className="font-semibold text-blue-600">.xlsx</span> 和 <span className="font-semibold text-blue-600">.xls</span> 格式的Excel文件
          </p>
        </div>

        <div
          className={`
            relative border-3 border-dashed rounded-2xl p-12 text-center transition-all duration-300 transform
            ${isDragOver 
              ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-100 scale-105 shadow-lg' 
              : 'border-gray-300 hover:border-blue-400 hover:bg-gradient-to-br hover:from-gray-50 hover:to-blue-50 hover:scale-102'
            }
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-xl'}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isLoading}
          />
          
          {isLoading ? (
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200"></div>
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
              </div>
              <div className="mt-6">
                <p className="text-xl font-bold text-gray-900 mb-2">正在解析文件...</p>
                <p className="text-sm text-gray-600">请稍候，这可能需要几秒钟</p>
                <div className="flex justify-center mt-4">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="relative mb-6">
                <div className="bg-gradient-to-br from-blue-100 to-indigo-200 p-6 rounded-full">
                  <svg 
                    className="w-20 h-20 text-blue-600" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                    />
                  </svg>
                </div>
                <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </div>
              
              {selectedFile ? (
                <div className="text-center">
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200 mb-4">
                    <div className="flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xl font-bold text-green-800">
                        文件已选择
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-gray-900 mb-2">
                      📄 {selectedFile.name}
                    </p>
                    <p className="text-sm text-gray-600 mb-3">
                      📊 文件大小: <span className="font-semibold">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                    </p>
                  </div>
                  <p className="text-sm text-blue-600 font-medium">
                    💡 点击重新选择文件或拖拽新文件到此区域
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 mb-3">
                    📂 拖拽Excel文件到此处
                  </p>
                  <p className="text-lg text-gray-600 mb-6">
                    或者点击下方按钮选择文件
                  </p>
                  <div className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    选择文件
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedFile && !isLoading && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">文件信息</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">文件名:</span>
                <span className="ml-2 text-gray-900">{selectedFile.name}</span>
              </div>
              <div>
                <span className="text-gray-500">文件大小:</span>
                <span className="ml-2 text-gray-900">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <div>
                <span className="text-gray-500">文件类型:</span>
                <span className="ml-2 text-gray-900">{selectedFile.type || '未知'}</span>
              </div>
              <div>
                <span className="text-gray-500">最后修改:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(selectedFile.lastModified).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;