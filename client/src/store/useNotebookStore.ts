import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';
import { Notebook } from '@/types/api';

interface NotebookState {
  notebooks: Notebook[];
  activeNotebook: Notebook | null;
  isLoading: boolean;
  error: string | null;
  isCreateModalOpen: boolean;

  // Actions
  setCreateModalOpen: (open: boolean) => void;
  setActiveNotebook: (notebook: Notebook | null) => void;
  fetchNotebooks: () => Promise<void>;
  createNotebook: (title: string, description?: string) => Promise<Notebook>;
  deleteNotebook: (id: string) => Promise<void>;
  updateNotebook: (id: string, title?: string, description?: string) => Promise<void>;
}

export const useNotebookStore = create<NotebookState>((set, get) => ({
  notebooks: [],
  activeNotebook: null,
  isLoading: false,
  error: null,
  isCreateModalOpen: false,

  setCreateModalOpen: (open: boolean) => set({ isCreateModalOpen: open }),

  setActiveNotebook: (notebook: Notebook | null) => set({ activeNotebook: notebook }),

  fetchNotebooks: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.get<any, Notebook[]>('/notebooks');
      const active = get().activeNotebook;
      
      // Keep existing active notebook if valid, otherwise select first available
      let nextActive = active ? data.find((n) => n.id === active.id) || data[0] || null : data[0] || null;

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
        activeNotebook: newNotebook,
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
        activeNotebook: get().activeNotebook?.id === id ? updated : get().activeNotebook,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to update notebook', isLoading: false });
      throw err;
    }
  },
}));
