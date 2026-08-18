import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';
import { Notebook, SourceDocument, Note } from '@/types/api';

interface NotebookState {
  notebooks: Notebook[];
  activeNotebook: Notebook | null;
  activeNotes: Note[];
  isLoading: boolean;
  error: string | null;
  isCreateModalOpen: boolean;
  isAddSourceModalOpen: boolean;

  // Actions
  setCreateModalOpen: (open: boolean) => void;
  setAddSourceModalOpen: (open: boolean) => void;
  setActiveNotebook: (notebook: Notebook | null) => Promise<void>;
  fetchNotebooks: () => Promise<void>;
  createNotebook: (title: string, description?: string) => Promise<Notebook>;
  deleteNotebook: (id: string) => Promise<void>;
  updateNotebook: (id: string, title?: string, description?: string) => Promise<void>;

  // Source Actions
  uploadFileSource: (file: File) => Promise<SourceDocument>;
  ingestWebsiteSource: (url: string) => Promise<SourceDocument>;
  ingestYoutubeSource: (url: string) => Promise<SourceDocument>;
  createTextSource: (title: string, content: string) => Promise<SourceDocument>;
  deleteSource: (sourceId: string) => Promise<void>;

  // Notes Actions
  fetchNotes: () => Promise<void>;
  createNote: (title: string, content: string, type?: string) => Promise<Note>;
  deleteNote: (noteId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Source ingestion polling
//
// Ingestion now runs asynchronously on the server (Inngest pipeline) — a
// successful upload/ingest call returns immediately with status:
// 'processing', not a finished source. This polls GET /notebooks/:id/sources
// every 3s and refreshes activeNotebook.sources until nothing is still
// 'processing', so the UI eventually reflects 'ready' | 'error' | 'duplicate'
// without the caller having to think about it.
//
// A single shared timer per notebook (not one per upload) so uploading
// several sources in quick succession doesn't spawn overlapping polling
// loops — each call just ensures a loop is running rather than starting a
// new one. Bounded at 40 attempts (~2 minutes) so a stuck pipeline doesn't
// poll forever.
// ---------------------------------------------------------------------------
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollAttempts = 0;
const MAX_POLL_ATTEMPTS = 40;
const POLL_INTERVAL_MS = 3000;

function ensureSourcePolling(
  get: () => NotebookState,
  set: (partial: Partial<NotebookState>) => void
) {
  if (pollTimer) return; // already polling

  pollAttempts = 0;
  pollTimer = setInterval(async () => {
    const active = get().activeNotebook;
    pollAttempts += 1;

    const stillProcessing = (active?.sources || []).some((s) => s.status === 'processing');
    if (!active || !stillProcessing || pollAttempts >= MAX_POLL_ATTEMPTS) {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      return;
    }

    try {
      const freshSources = await apiClient.get<any, SourceDocument[]>(`/notebooks/${active.id}/sources`);
      const current = get().activeNotebook;
      // Guard against the active notebook having changed while this request was in flight.
      if (current && current.id === active.id) {
        set({ activeNotebook: { ...current, sources: freshSources } });
      }
    } catch {
      // Transient poll failure — try again next tick rather than surfacing
      // an error for what is, from the user's perspective, background work.
    }
  }, POLL_INTERVAL_MS);
}

export const useNotebookStore = create<NotebookState>((set, get) => ({
  notebooks: [],
  activeNotebook: null,
  activeNotes: [],
  isLoading: false,
  error: null,
  isCreateModalOpen: false,
  isAddSourceModalOpen: false,

  setCreateModalOpen: (open: boolean) => set({ isCreateModalOpen: open }),
  setAddSourceModalOpen: (open: boolean) => set({ isAddSourceModalOpen: open }),

  setActiveNotebook: async (notebook: Notebook | null) => {
    if (!notebook) {
      set({ activeNotebook: null, activeNotes: [] });
      return;
    }
    set({ activeNotebook: notebook });
    
    // Fetch full detailed notebook sources and notes when active notebook changes
    try {
      const [detailedNotebook, notesList] = await Promise.all([
        apiClient.get<any, Notebook>(`/notebooks/${notebook.id}`),
        apiClient.get<any, Note[]>(`/notebooks/${notebook.id}/notes`),
      ]);
      set({ activeNotebook: detailedNotebook, activeNotes: notesList });
      // Resume polling if this notebook has ingestion still in flight from a
      // previous session (e.g. page reload mid-ingestion).
      ensureSourcePolling(get, set);
    } catch (e) {
      // ignore
    }
  },

  fetchNotebooks: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.get<any, Notebook[]>('/notebooks');
      const active = get().activeNotebook;
      
      let nextActive = active ? data.find((n) => n.id === active.id) || data[0] || null : data[0] || null;

      if (nextActive) {
        try {
          const [detailed, notesList] = await Promise.all([
            apiClient.get<any, Notebook>(`/notebooks/${nextActive.id}`),
            apiClient.get<any, Note[]>(`/notebooks/${nextActive.id}/notes`),
          ]);
          nextActive = detailed;
          set({ activeNotes: notesList });
        } catch (e) {
          // ignore
        }
      }

      set({ notebooks: data, activeNotebook: nextActive, isLoading: false });
      // Resume polling if the notebook loaded on app start has ingestion
      // still in flight from a previous session.
      ensureSourcePolling(get, set);
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch notebooks', isLoading: false });
    }
  },

  createNotebook: async (title: string, description?: string) => {
    set({ isLoading: true, error: null });
    try {
      const newNotebook = await apiClient.post<any, Notebook>('/notebooks', { title, description });
      const currentList = get().notebooks;
      
      set({
        notebooks: [newNotebook, ...currentList],
        activeNotebook: { ...newNotebook, sources: [] },
        activeNotes: [],
        isLoading: false,
        isCreateModalOpen: false,
      });

      return newNotebook;
    } catch (err: any) {
      set({ error: err.message || 'Failed to create notebook', isLoading: false });
      throw err;
    }
  },

  deleteNotebook: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.delete(`/notebooks/${id}`);
      const updatedList = get().notebooks.filter((n) => n.id !== id);
      const currentActive = get().activeNotebook;
      const nextActive = currentActive?.id === id ? updatedList[0] || null : currentActive;

      set({
        notebooks: updatedList,
        activeNotebook: nextActive,
        activeNotes: [],
        isLoading: false,
      });
      if (nextActive) {
        get().setActiveNotebook(nextActive);
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete notebook', isLoading: false });
      throw err;
    }
  },

  updateNotebook: async (id: string, title?: string, description?: string) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await apiClient.patch<any, Notebook>(`/notebooks/${id}`, { title, description });
      const updatedList = get().notebooks.map((n) => (n.id === id ? updated : n));
      
      set({
        notebooks: updatedList,
        activeNotebook: get().activeNotebook?.id === id ? { ...get().activeNotebook!, ...updated } : get().activeNotebook,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to update notebook', isLoading: false });
      throw err;
    }
  },

  // Source Actions Implementation
  uploadFileSource: async (file: File) => {
    const active = get().activeNotebook;
    if (!active) throw new Error('No active notebook selected');

    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('file', file);

      const source = await apiClient.post<any, SourceDocument>(
        `/notebooks/${active.id}/sources/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const currentSources = active.sources || [];
      const updatedActive = { ...active, sources: [source, ...currentSources] };

      set({
        activeNotebook: updatedActive,
        isLoading: false,
        isAddSourceModalOpen: false,
      });
      ensureSourcePolling(get, set);

      return source;
    } catch (err: any) {
      set({ error: err.message || 'Failed to upload file', isLoading: false });
      throw err;
    }
  },

  ingestWebsiteSource: async (url: string) => {
    const active = get().activeNotebook;
    if (!active) throw new Error('No active notebook selected');

    set({ isLoading: true, error: null });
    try {
      const source = await apiClient.post<any, SourceDocument>(
        `/notebooks/${active.id}/sources/website`,
        { url }
      );

      const currentSources = active.sources || [];
      const updatedActive = { ...active, sources: [source, ...currentSources] };

      set({
        activeNotebook: updatedActive,
        isLoading: false,
        isAddSourceModalOpen: false,
      });
      ensureSourcePolling(get, set);

      return source;
    } catch (err: any) {
      set({ error: err.message || 'Failed to ingest website URL via Firecrawl', isLoading: false });
      throw err;
    }
  },

  ingestYoutubeSource: async (url: string) => {
    const active = get().activeNotebook;
    if (!active) throw new Error('No active notebook selected');

    set({ isLoading: true, error: null });
    try {
      const source = await apiClient.post<any, SourceDocument>(
        `/notebooks/${active.id}/sources/youtube`,
        { url }
      );

      const currentSources = active.sources || [];
      const updatedActive = { ...active, sources: [source, ...currentSources] };

      set({
        activeNotebook: updatedActive,
        isLoading: false,
        isAddSourceModalOpen: false,
      });
      ensureSourcePolling(get, set);

      return source;
    } catch (err: any) {
      set({ error: err.message || 'Failed to ingest YouTube video transcript', isLoading: false });
      throw err;
    }
  },

  createTextSource: async (title: string, content: string) => {
    const active = get().activeNotebook;
    if (!active) throw new Error('No active notebook selected');

    set({ isLoading: true, error: null });
    try {
      const source = await apiClient.post<any, SourceDocument>(
        `/notebooks/${active.id}/sources/text`,
        { title, content }
      );

      const currentSources = active.sources || [];
      const updatedActive = { ...active, sources: [source, ...currentSources] };

      set({
        activeNotebook: updatedActive,
        isLoading: false,
        isAddSourceModalOpen: false,
      });
      ensureSourcePolling(get, set);

      return source;
    } catch (err: any) {
      set({ error: err.message || 'Failed to create text source', isLoading: false });
      throw err;
    }
  },

  deleteSource: async (sourceId: string) => {
    const active = get().activeNotebook;
    if (!active) throw new Error('No active notebook selected');

    set({ isLoading: true, error: null });
    try {
      await apiClient.delete(`/notebooks/${active.id}/sources/${sourceId}`);
      const updatedSources = (active.sources || []).filter((s) => s.id !== sourceId);
      const updatedActive = { ...active, sources: updatedSources };

      set({
        activeNotebook: updatedActive,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete source document', isLoading: false });
      throw err;
    }
  },

  // Notes Implementation
  fetchNotes: async () => {
    const active = get().activeNotebook;
    if (!active) return;
    try {
      const notesList = await apiClient.get<any, Note[]>(`/notebooks/${active.id}/notes`);
      set({ activeNotes: notesList });
    } catch (err: any) {
      // ignore
    }
  },

  createNote: async (title: string, content: string, type = 'user_note') => {
    const active = get().activeNotebook;
    if (!active) throw new Error('No active notebook selected');
    try {
      const newNote = await apiClient.post<any, Note>(`/notebooks/${active.id}/notes`, { title, content, type });
      set({ activeNotes: [newNote, ...get().activeNotes] });
      return newNote;
    } catch (err: any) {
      set({ error: err.message || 'Failed to create note' });
      throw err;
    }
  },

  deleteNote: async (noteId: string) => {
    const active = get().activeNotebook;
    if (!active) throw new Error('No active notebook selected');
    try {
      await apiClient.delete(`/notebooks/${active.id}/notes/${noteId}`);
      set({ activeNotes: get().activeNotes.filter((n) => n.id !== noteId) });
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete note' });
      throw err;
    }
  },
}));
