import { create } from 'zustand';
import { apiClient, uploadClient } from '@/lib/api-client';
import { Memorybook, SourceDocument, Note, StudioArtifact, StudioArtifactKind } from '@/types/api';

interface MemorybookState {
  memorybooks: Memorybook[];
  activeMemorybook: Memorybook | null;
  activeNotes: Note[];
  studioArtifacts: StudioArtifact[];
  uiActiveStudioTab: 'audio' | 'studio' | 'notes';
  isLoading: boolean;
  error: string | null;
  isCreateModalOpen: boolean;
  isAddSourceModalOpen: boolean;

  // Actions
  setCreateModalOpen: (open: boolean) => void;
  setAddSourceModalOpen: (open: boolean) => void;
  setActiveStudioTab: (tab: 'audio' | 'studio' | 'notes') => void;
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

  // Studio Artifact Actions
  fetchStudioArtifacts: () => Promise<void>;
  generateStudioArtifact: (kind: StudioArtifactKind, options?: { focus?: string }) => Promise<StudioArtifact>;
  deleteStudioArtifact: (artifactId: string) => Promise<void>;
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

// ---------------------------------------------------------------------------
// Studio artifact generation polling
//
// Same shape as ensureSourcePolling above: generation runs asynchronously
// on the server (Inngest pipeline) — a successful "generate" call returns
// immediately with status: 'generating'. This polls GET
// /memorybooks/:id/studio every 3s and refreshes studioArtifacts until
// nothing is still 'generating'. A single shared timer, bounded attempts,
// same rationale as source polling.
// ---------------------------------------------------------------------------
let studioPollTimer: ReturnType<typeof setInterval> | null = null;
let studioPollAttempts = 0;

function ensureStudioPolling(
  get: () => MemorybookState,
  set: (partial: Partial<MemorybookState>) => void
) {
  if (studioPollTimer) return; // already polling

  studioPollAttempts = 0;
  studioPollTimer = setInterval(async () => {
    const active = get().activeMemorybook;
    studioPollAttempts += 1;

    const stillGenerating = get().studioArtifacts.some((a) => a.status === 'generating');
    if (!active || !stillGenerating || studioPollAttempts >= MAX_POLL_ATTEMPTS) {
      if (studioPollTimer) clearInterval(studioPollTimer);
      studioPollTimer = null;
      return;
    }

    try {
      const fresh = await apiClient.get<any, StudioArtifact[]>(`/memorybooks/${active.id}/studio`);
      const current = get().activeMemorybook;
      if (current && current.id === active.id) {
        set({ studioArtifacts: fresh });
      }
    } catch {
      // Transient poll failure — try again next tick.
    }
  }, POLL_INTERVAL_MS);
}

export const useMemorybookStore = create<MemorybookState>((set, get) => ({
  memorybooks: [],
  activeMemorybook: null,
  activeNotes: [],
  studioArtifacts: [],
  uiActiveStudioTab: 'audio',
  isLoading: false,
  error: null,
  isCreateModalOpen: false,
  isAddSourceModalOpen: false,

  setCreateModalOpen: (open: boolean) => set({ isCreateModalOpen: open }),
  setAddSourceModalOpen: (open: boolean) => set({ isAddSourceModalOpen: open }),
  setActiveStudioTab: (tab) => set({ uiActiveStudioTab: tab }),

  setActiveMemorybook: async (memorybook: Memorybook | null) => {
    if (!memorybook) {
      set({ activeMemorybook: null, activeNotes: [], studioArtifacts: [] });
      return;
    }
    set({ activeMemorybook: memorybook });

    // Fetch full detailed memorybook sources, notes, and studio artifacts
    // when active memorybook changes
    try {
      const [detailedMemorybook, notesList, artifactsList] = await Promise.all([
        apiClient.get<any, Memorybook>(`/memorybooks/${memorybook.id}`),
        apiClient.get<any, Note[]>(`/memorybooks/${memorybook.id}/notes`),
        apiClient.get<any, StudioArtifact[]>(`/memorybooks/${memorybook.id}/studio`),
      ]);
      set({ activeMemorybook: detailedMemorybook, activeNotes: notesList, studioArtifacts: artifactsList });
      // Resume polling if this memorybook has ingestion/generation still in
      // flight from a previous session (e.g. page reload mid-process).
      ensureSourcePolling(get, set);
      ensureStudioPolling(get, set);
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
          const [detailed, notesList, artifactsList] = await Promise.all([
            apiClient.get<any, Memorybook>(`/memorybooks/${nextActive.id}`),
            apiClient.get<any, Note[]>(`/memorybooks/${nextActive.id}/notes`),
            apiClient.get<any, StudioArtifact[]>(`/memorybooks/${nextActive.id}/studio`),
          ]);
          nextActive = detailed;
          set({ activeNotes: notesList, studioArtifacts: artifactsList });
        } catch (e) {
          // ignore
        }
      }

      set({ memorybooks: data, activeMemorybook: nextActive, isLoading: false });
      // Resume polling if the memorybook loaded on app start has
      // ingestion/generation still in flight from a previous session.
      ensureSourcePolling(get, set);
      ensureStudioPolling(get, set);
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

      const source = await uploadClient.post<any, SourceDocument>(
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
      set({ error: err.message || 'Failed to import website URL', isLoading: false });
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

  // Studio Artifacts Implementation
  fetchStudioArtifacts: async () => {
    const active = get().activeMemorybook;
    if (!active) return;
    try {
      const artifacts = await apiClient.get<any, StudioArtifact[]>(`/memorybooks/${active.id}/studio`);
      set({ studioArtifacts: artifacts });
    } catch (err: any) {
      // ignore
    }
  },

  generateStudioArtifact: async (kind: StudioArtifactKind, options?: { focus?: string }) => {
    const active = get().activeMemorybook;
    if (!active) throw new Error('No active memorybook selected');
    try {
      const artifact = await apiClient.post<any, StudioArtifact>(`/memorybooks/${active.id}/studio/${kind}`, options);
      set({ studioArtifacts: [artifact, ...get().studioArtifacts] });
      ensureStudioPolling(get, set);
      return artifact;
    } catch (err: any) {
      set({ error: err.message || 'Failed to start generation' });
      throw err;
    }
  },

  deleteStudioArtifact: async (artifactId: string) => {
    const active = get().activeMemorybook;
    if (!active) throw new Error('No active memorybook selected');
    try {
      await apiClient.delete(`/memorybooks/${active.id}/studio/${artifactId}`);
      set({ studioArtifacts: get().studioArtifacts.filter((a) => a.id !== artifactId) });
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete studio artifact' });
      throw err;
    }
  },
}));
