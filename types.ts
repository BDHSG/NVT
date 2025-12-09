export interface ProcessedPage {
  pageNumber: number;
  imageUrl: string; // Base64 image of the page
  markdown: string; // The extracted text/latex
}

export interface AppState {
  isProcessing: boolean;
  files: File[];
  processedPages: ProcessedPage[];
  error: string | null;
}

export enum ViewMode {
  Split = 'SPLIT',
  Edit = 'EDIT',
  Preview = 'PREVIEW'
}