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

export interface Note {
  id: string;
  memorybookId: string;
  title: string;
  content: string;
  type: 'user_note' | 'ai_summary' | 'study_guide';
  createdAt: string;
  updatedAt: string;
}

export interface SourceDocument {
  id: string;
  memorybookId: string;
  title: string;
  fileType: 'pdf' | 'web' | 'youtube' | 'text';
  fileUrl?: string;
  status: 'processing' | 'ready' | 'error' | 'duplicate';
  /** Set only when status is 'error' or 'duplicate'. */
  errorMessage?: string | null;
  /** Coarse pipeline progress while status is 'processing', e.g. 'queued' | 'extracting' | 'chunking'. */
  stage?: string | null;
  createdAt: string;
}

export interface Memorybook {
  id: string;
  userId: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  sources?: SourceDocument[];
  notes?: Note[];
}

export type StudioArtifactKind = 'flashcards' | 'quiz' | 'data_table' | 'report' | 'mind_map' | 'slide_deck';

export interface FlashcardsPayload {
  cards: { front: string; back: string }[];
}

export interface QuizPayload {
  questions: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
}

export interface DataTablePayload {
  columns: string[];
  rows: string[][];
}

export interface ReportPayload {
  title: string;
  summary: string;
  sections: { heading: string; content: string }[];
}

export interface MindMapPayload {
  nodes: { id: string; label: string }[];
  edges: { source: string; target: string; label?: string | null }[];
  rootId: string;
}

export interface SlideDeckPayload {
  deckTitle: string;
  slides: { title: string; bullets: string[]; speakerNotes?: string | null }[];
}

export interface StudioArtifact {
  id: string;
  memorybookId: string;
  kind: StudioArtifactKind;
  title: string;
  status: 'generating' | 'ready' | 'error';
  errorMessage?: string | null;
  /** Kind-specific structured content. Null until status is 'ready'. */
  payload: FlashcardsPayload | QuizPayload | DataTablePayload | ReportPayload | MindMapPayload | SlideDeckPayload | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  sourceId: string;
  memorybookId: string;
  content: string;
  chunkIndex: number;
  bm25_score?: number;
}
