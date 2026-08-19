import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';
import { Memorybook, SourceDocument, Note } from '@/types/api';

interface MemorybookState {
  memorybooks: Memorybook[];
  activeMemorybook: Memorybook | null;
  activeNotes: Note[];
  isLoading: boolean;
  error: string | null;
  isCreateModalOpen: boolean;
  isAddSourceModalOpen: boolean;

  // Actions
  setCreateModalOpen: (open: boolean) => void;
  setAddSourceModalOpen: (open: boolean) => void;
  setActiveMemorybook: (memorybook: Memorybook | null) => Promise<void>;
  fetchMemorybooks: () => Promise<void>;
  createMemorybook: (title: string, description?: string) => Promise<Memorybook>;
  deleteMemorybook: (id: string) => Promise<void>;
  updateMemorybook: (id: string, title?: string, description?: string) => Promise<void>;

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
// 'processing', not a finished source. This polls GET /memorybooks/:id/sources
// every 3s and refreshes activeMemorybook.sources until nothing is still
// 'processing', so the UI eventually reflects 'ready' | 'error' | 'duplicate'
// without the caller having to think about it.
//
// A single shared timer per memorybook (not one per upload) so uploading
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
  get: () => MemorybookState,
  set: (partial: Partial<MemorybookState>) => void
) {
  if (pollTimer) return; // already polling

  pollAttempts = 0;
  pollTimer = setInterval(async () => {
    const active = get().activeMemorybook;
    pollAttempts += 1;

    const stillProcessing = (active?.sources || []).some((s) => s.status === 'processing');
    if (!active || !stillProcessing || pollAttempts >= MAX_POLL_ATTEMPTS) {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      return;
    }

    try {
      const freshSources = await apiClient.get<any, SourceDocument[]>(`/memorybooks/${active.id}/sources`);
      const current = get().activeMemorybook;
      // Guard against the active memorybook having changed while this request was in flight.
      if (current && current.id === active.id) {
        set({ activeMemorybook: { ...current, sources: freshSources } });
      }
    } catch {
      // Transient poll failure — try again next tick rather than surfacing
      // an error for what is, from the user's perspective, background work.
    }
  }, POLL_INTERVAL_MS);
}

export const useMemorybookStore = create<MemorybookState>((set, get) => ({
  memorybooks: [],
  activeMemorybook: null,
  activeNotes: [],
  isLoading: false,
  error: null,
  isCreateModalOpen: false,
  isAddSourceModalOpen: false,

  setCreateModalOpen: (open: boolean) => set({ isCreateModalOpen: open }),
  setAddSourceModalOpen: (open: boolean) => set({ isAddSourceModalOpen: open }),

  setActiveMemorybook: async (memorybook: Memorybook | null) => {
    if (!memorybook) {
      set({ activeMemorybook: null, activeNotes: [] });
      return;
    }
    set({ activeMemorybook: memorybook });
    
    // Fetch full detailed memorybook sources and notes when active memorybook changes
    try {
      const [detailedMemorybook, notesList] = await Promise.all([
        apiClient.get<any, Memorybook>(`/memorybooks/${memorybook.id}`),
        apiClient.get<any, Note[]>(`/memorybooks/${memorybook.id}/notes`),
      ]);
      set({ activeMemorybook: detailedMemorybook, activeNotes: notesList });
      // Resume polling if this memorybook has ingestion still in flight from a
      // previous session (e.g. page reload mid-ingestion).
      ensureSourcePolling(get, set);
    } catch (e) {
      // ignore
    }
  },

  fetchMemorybooks: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.get<any, Memorybook[]>('/memorybooks');
      const active = get().activeMemorybook;
      
      let nextActive = active ? data.find((n) => n.id === active.id) || data[0] || null : data[0] || null;

      if (nextActive) {
        try {
          const [detailed, notesList] = await Promise.all([
            apiClient.get<any, Memorybook>(`/memorybooks/${nextActive.id}`),
            apiClient.get<any, Note[]>(`/memorybooks/${nextActive.id}/notes`),
          ]);
          nextActive = detailed;
          set({ activeNotes: notesList });
        } catch (e) {
          // ignore
        }
      }

      set({ memorybooks: data, activeMemorybook: nextActive, isLoading: false });
      // Resume polling if the memorybook loaded on app start has ingestion
      // still in flight from a previous session.
      ensureSourcePolling(get, set);
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch memorybooks', isLoading: false });
    }
  },

  createMemorybook: async (title: string, description?: string) => {
    set({ isLoading: true, error: null });
    try {
      const newMemorybook = await apiClient.post<any, Memorybook>('/memorybooks', { title, description });
      const currentList = get().memorybooks;
      
      set({
        memorybooks: [newMemorybook, ...currentList],
        activeMemorybook: { ...newMemorybook, sources: [] },
        activeNotes: [],
        isLoading: false,
        isCreateModalOpen: false,
      });

      return newMemorybook;
    } catch (err: any) {
      set({ error: err.message || 'Failed to create memorybook', isLoading: false });
      throw err;
    }
  },

  deleteMemorybook: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await apiClient.delete(`/memorybooks/${id}`);
      const updatedList = get().memorybooks.filter((n) => n.id !== id);
      const currentActive = get().activeMemorybook;
      const nextActive = currentActive?.id === id ? updatedList[0] || null : currentActive;

      set({
        memorybooks: updatedList,
        activeMemorybook: nextActive,
        activeNotes: [],
        isLoading: false,
      });
      if (nextActive) {
        get().setActiveMemorybook(nextActive);
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete memorybook', isLoading: false });
      throw err;
    }
  },

  updateMemorybook: async (id: string, title?: string, description?: string) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await apiClient.patch<any, Memorybook>(`/memorybooks/${id}`, { title, description });
      const updatedList = get().memorybooks.map((n) => (n.id === id ? updated : n));
      
      set({
        memorybooks: updatedList,
        activeMemorybook: get().activeMemorybook?.id === id ? { ...get().activeMemorybook!, ...updated } : get().activeMemorybook,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to update memorybook', isLoading: false });
      throw err;
    }
  },

  // Source Actions Implementation
  uploadFileSource: async (file: File) => {
    const active = get().activeMemorybook;
    if (!active) throw new Error('No active memorybook selected');

    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('file', file);

      const source = await apiClient.post<any, SourceDocument>(
        `/memorybooks/${active.id}/sources/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const currentSources = active.sources || [];
      const updatedActive = { ...active, sources: [source, ...currentSources] };

      set({
        activeMemorybook: updatedActive,
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
    const active = get().activeMemorybook;
    if (!active) throw new Error('No active memorybook selected');

    set({ isLoading: true, error: null });
    try {
      const source = await apiClient.post<any, SourceDocument>(
        `/memorybooks/${active.id}/sources/website`,
        { url }
      );

      const currentSources = active.sources || [];
      const updatedActive = { ...active, sources: [source, ...currentSources] };

      set({
        activeMemorybook: updatedActive,
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
    const active = get().activeMemorybook;
    if (!active) throw new Error('No active memorybook selected');

    set({ isLoading: true, error: null });
    try {
      const source = await apiClient.post<any, SourceDocument>(
        `/memorybooks/${active.id}/sources/youtube`,
        { url }
      );

      const currentSources = active.sources || [];
      const updatedActive = { ...active, sources: [source, ...currentSources] };

      set({
        activeMemorybook: updatedActive,
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
    const active = get().activeMemorybook;
    if (!active) throw new Error('No active memorybook selected');

    set({ isLoading: true, error: null });
    try {
      const source = await apiClient.post<any, SourceDocument>(
        `/memorybooks/${active.id}/sources/text`,
        { title, content }
      );

      const currentSources = active.sources || [];
      const updatedActive = { ...active, sources: [source, ...currentSources] };

      set({
        activeMemorybook: updatedActive,
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
    const active = get().activeMemorybook;
    if (!active) throw new Error('No active memorybook selected');

    set({ isLoading: true, error: null });
    try {
      await apiClient.delete(`/memorybooks/${active.id}/sources/${sourceId}`);
      const updatedSources = (active.sources || []).filter((s) => s.id !== sourceId);
      const updatedActive = { ...active, sources: updatedSources };

      set({
        activeMemorybook: updatedActive,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete source document', isLoading: false });
      throw err;
    }
  },

  // Notes Implementation
  fetchNotes: async () => {
    const active = get().activeMemorybook;
    if (!active) return;
    try {
      const notesList = await apiClient.get<any, Note[]>(`/memorybooks/${active.id}/notes`);
      set({ activeNotes: notesList });
    } catch (err: any) {
      // ignore
    }
  },

  createNote: async (title: string, content: string, type = 'user_note') => {
    const active = get().activeMemorybook;
    if (!active) throw new Error('No active memorybook selected');
    try {
      const newNote = await apiClient.post<any, Note>(`/memorybooks/${active.id}/notes`, { title, content, type });
      set({ activeNotes: [newNote, ...get().activeNotes] });
      return newNote;
    } catch (err: any) {
      set({ error: err.message || 'Failed to create note' });
      throw err;
    }
  },

  deleteNote: async (noteId: string) => {
    const active = get().activeMemorybook;
    if (!active) throw new Error('No active memorybook selected');
    try {
      await apiClient.delete(`/memorybooks/${active.id}/notes/${noteId}`);
      set({ activeNotes: get().activeNotes.filter((n) => n.id !== noteId) });
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete note' });
      throw err;
    }
  },
}));
