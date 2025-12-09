import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { ProcessedPage } from '../types';

interface Props {
  pages: ProcessedPage[];
  onUpdate: (index: number, newMarkdown: string) => void;
  editMode: boolean;
}

const ProcessedOutput: React.FC<Props> = ({ pages, onUpdate, editMode }) => {
  return (
    <div className="h-full overflow-y-auto p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      {pages.length === 0 && (
        <div className="text-center text-gray-400 mt-20">
          No output generated yet. Upload a file to begin.
        </div>
      )}

      {pages.map((page, index) => (
        <div key={index} className="mb-8 border-b border-gray-100 pb-8 last:border-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase">Page {page.pageNumber}</span>
          </div>

          {editMode ? (
            <textarea
              className="w-full h-[500px] p-4 font-mono text-sm bg-gray-50 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              value={page.markdown}
              onChange={(e) => onUpdate(index, e.target.value)}
            />
          ) : (
            <div className="prose prose-blue max-w-none preview-content">
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  img: ({node, ...props}) => (
                    <div className="my-4 flex justify-center">
                       <img {...props} style={{maxHeight: '400px', maxWidth: '100%', border: '1px solid #eee'}} alt="Extracted Figure" />
                    </div>
                  )
                }}
              >
                {page.markdown}
              </ReactMarkdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ProcessedOutput;