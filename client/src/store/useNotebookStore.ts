import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';
import { Notebook, SourceDocument } from '@/types/api';

interface NotebookState {
  notebooks: Notebook[];
  activeNotebook: Notebook | null;
  isLoading: boolean;
  error: string | null;
  isCreateModalOpen: boolean;
  isAddSourceModalOpen: boolean;

  // Actions
  setCreateModalOpen: (open: boolean) => void;
  setAddSourceModalOpen: (open: boolean) => void;
  setActiveNotebook: (notebook: Notebook | null) => void;
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
}

export const useNotebookStore = create<NotebookState>((set, get) => ({
  notebooks: [],
  activeNotebook: null,
  isLoading: false,
  error: null,
  isCreateModalOpen: false,
  isAddSourceModalOpen: false,

  setCreateModalOpen: (open: boolean) => set({ isCreateModalOpen: open }),
  setAddSourceModalOpen: (open: boolean) => set({ isAddSourceModalOpen: open }),

  setActiveNotebook: (notebook: Notebook | null) => set({ activeNotebook: notebook }),

  fetchNotebooks: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.get<any, Notebook[]>('/notebooks');
      const active = get().activeNotebook;
      
      let nextActive = active ? data.find((n) => n.id === active.id) || data[0] || null : data[0] || null;

      // If active notebook exists, fetch its detailed sources
      if (nextActive) {
        try {
          const detailed = await apiClient.get<any, Notebook>(`/notebooks/${nextActive.id}`);
          nextActive = detailed;
        } catch (e) {
          // ignore error fallback
        }
      }

      set({ notebooks: data, activeNotebook: nextActive, isLoading: false });
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
        isLoading: false,
      });
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
}));
