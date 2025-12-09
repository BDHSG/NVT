import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Download, RefreshCw, AlertCircle, Edit, Eye, Trash2 } from 'lucide-react';
import { AppState, ProcessedPage, ViewMode } from './types';
import { convertPdfToImages, blobToBase64 } from './services/fileProcessing';
import { transcribeImage } from './services/geminiService';
import { generateDocx } from './utils/docxExport';
import ProcessedOutput from './components/ProcessedOutput';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isProcessing: false,
    files: [],
    processedPages: [],
    error: null,
  });
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Split);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setState(prev => ({ ...prev, files: acceptedFiles, error: null, processedPages: [] }));
  }, []);

  // Handle global paste (Ctrl+V)
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      // Allow normal paste in text inputs if content is not a file
      if (event.target instanceof HTMLElement && (event.target.tagName === 'TEXTAREA' || event.target.tagName === 'INPUT')) {
         if (event.clipboardData && event.clipboardData.files.length === 0) {
            return;
         }
      }

      if (event.clipboardData && event.clipboardData.files.length > 0) {
        const files = Array.from(event.clipboardData.files);
        const validFiles = files.filter(f => 
          f.type === 'application/pdf' || f.type.startsWith('image/')
        );

        if (validFiles.length > 0) {
          event.preventDefault();
          onDrop(validFiles);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    },
    multiple: false 
  });

  const handleProcess = async () => {
    if (state.files.length === 0) return;

    setState(prev => ({ ...prev, isProcessing: true, error: null, processedPages: [] }));

    try {
      const file = state.files[0];
      let images: string[] = [];

      if (file.type === 'application/pdf') {
        images = await convertPdfToImages(file);
      } else {
        const base64 = await blobToBase64(file);
        images = [base64];
      }

      const results: ProcessedPage[] = [];

      // Process sequentially to maintain order and avoiding rate limits if necessary
      for (let i = 0; i < images.length; i++) {
        const markdown = await transcribeImage(images[i], 'image/jpeg');
        results.push({
          pageNumber: i + 1,
          imageUrl: images[i],
          markdown: markdown
        });
        
        // Update state progressively
        setState(prev => ({
          ...prev,
          processedPages: [...results]
        }));
      }

      setState(prev => ({ ...prev, isProcessing: false }));

    } catch (error: any) {
      setState(prev => ({ ...prev, isProcessing: false, error: error.message }));
    }
  };

  const handleExportDocx = async () => {
    if (state.processedPages.length === 0) return;
    try {
      const blob = await generateDocx(state.processedPages);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = "converted_latex.docx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Error generating DOCX");
    }
  };

  const handleUpdateMarkdown = (index: number, newMarkdown: string) => {
    setState(prev => {
      const newPages = [...prev.processedPages];
      newPages[index] = { ...newPages[index], markdown: newMarkdown };
      return { ...prev, processedPages: newPages };
    });
  };

  const clearAll = () => {
    setState({
      isProcessing: false,
      files: [],
      processedPages: [],
      error: null
    });
  };

  return (
    <div className="min-h-screen flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 h-16">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
             <FileText className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Chuyển PDF to Word+TrungHieu</h1>
        </div>
        
        <div className="flex items-center gap-3">
          {state.processedPages.length > 0 && (
            <>
              <div className="flex bg-gray-100 rounded-lg p-1 mr-4">
                <button 
                  onClick={() => setViewMode(ViewMode.Edit)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === ViewMode.Edit ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Edit className="w-4 h-4 inline mr-1" /> Edit
                </button>
                <button 
                  onClick={() => setViewMode(ViewMode.Split)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === ViewMode.Split ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                   Split
                </button>
                <button 
                  onClick={() => setViewMode(ViewMode.Preview)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === ViewMode.Preview ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Eye className="w-4 h-4 inline mr-1" /> Preview
                </button>
              </div>

              <button
                onClick={handleExportDocx}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export .docx
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel: Input */}
        {(viewMode === ViewMode.Split || state.processedPages.length === 0) && (
           <div className={`${viewMode === ViewMode.Split ? 'w-1/2' : 'w-full'} bg-gray-50 p-6 border-r border-gray-200 flex flex-col overflow-y-auto`}>
             <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">1. Upload Source</h2>
                <div {...getRootProps()} className={`
                  border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                  ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-white'}
                `}>
                  <input {...getInputProps()} />
                  <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                  {state.files.length > 0 ? (
                    <div>
                      <p className="font-medium text-blue-600">{state.files[0].name}</p>
                      <p className="text-sm text-gray-500">{(state.files[0].size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-gray-600 font-medium">Click to upload, drag & drop, or Ctrl+V</p>
                      <p className="text-sm text-gray-400 mt-1">PDF, PNG, JPG supported</p>
                    </>
                  )}
                </div>
             </div>

             {state.error && (
               <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3 border border-red-100">
                 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                 <div>
                   <p className="font-medium">Error Processing File</p>
                   <p className="text-sm mt-1">{state.error}</p>
                 </div>
               </div>
             )}

             <div className="flex gap-3">
               <button
                 onClick={handleProcess}
                 disabled={state.files.length === 0 || state.isProcessing}
                 className={`
                   flex-1 py-3 px-4 rounded-lg font-semibold text-white shadow-sm flex items-center justify-center gap-2
                   ${state.files.length === 0 || state.isProcessing ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
                 `}
               >
                 {state.isProcessing ? (
                   <>
                     <RefreshCw className="w-5 h-5 animate-spin" /> Processing...
                   </>
                 ) : (
                   <>
                     Process with Gemini
                   </>
                 )}
               </button>
               {state.files.length > 0 && (
                 <button onClick={clearAll} className="p-3 text-red-500 hover:bg-red-50 rounded-lg">
                   <Trash2 className="w-5 h-5" />
                 </button>
               )}
             </div>

             <div className="mt-8 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h3 className="font-semibold text-blue-800 text-sm mb-2">How to use in Word:</h3>
                <ul className="list-disc pl-5 text-sm text-blue-700 space-y-1">
                  <li>Click <strong>Export .docx</strong> to download the file.</li>
                  <li>Open the file in Microsoft Word.</li>
                  <li>Select the LaTeX formulas (e.g., <code>$ E=mc^2 $</code>).</li>
                  <li>Use <strong>MathType &rarr; Toggle TeX</strong> to convert.</li>
                </ul>
             </div>
           </div>
        )}

        {/* Right Panel: Output */}
        <div className={`flex-1 bg-gray-100 p-6 overflow-hidden flex flex-col ${state.processedPages.length === 0 ? 'hidden' : ''}`}>
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-lg font-semibold">2. Preview & Edit</h2>
             <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                LaTeX Mode: Raw
             </span>
          </div>
          <ProcessedOutput 
            pages={state.processedPages} 
            onUpdate={handleUpdateMarkdown}
            editMode={viewMode === ViewMode.Edit}
          />
        </div>
      </main>
    </div>
  );
};

export default App;