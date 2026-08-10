export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  statusCode: number;
  data: T;
  meta?: Record<string, any>;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  requestId?: string;
  timestamp: string;
}

export interface Notebook {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  sources?: SourceDocument[];
}

export interface SourceDocument {
  id: string;
  notebookId: string;
  title: string;
  fileType: 'pdf' | 'web' | 'text';
  fileUrl?: string;
  status: 'processing' | 'ready' | 'error';
  createdAt: string;
}

export interface DocumentChunk {
  id: string;
  sourceId: string;
  notebookId: string;
  content: string;
  chunkIndex: number;
  bm25_score?: number;
}
