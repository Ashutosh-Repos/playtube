import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UploadStatus = 'uploading' | 'processing' | 'completed' | 'error' | 'interrupted';

export interface UploadItem {
  id: string; // Video ID
  file: {
    name: string;
    size: number;
    type: string;
  };
  progress: number; // 0-100 (Upload Phase)
  processingProgress: number; // 0-100 (Transcoding Phase)
  status: UploadStatus;
  uploadUrl?: string; // S3 Presigned URL
  wsUrl?: string; // WebSocket URL
  error?: string;
  thumbnailUrl?: string;
  startedAt: number;
}

interface UploadState {
  uploads: Record<string, UploadItem>;
  isMinimized: boolean;
  
  // Actions
  addUpload: (id: string, file: File, uploadUrl: string, wsUrl: string) => void;
  updateProgress: (id: string, progress: number) => void;
  updateProcessingProgress: (id: string, progress: number) => void;
  updateThumbnail: (id: string, url: string) => void;
  updateStatus: (id: string, status: UploadStatus, error?: string) => void;
  abortUpload: (id: string) => void;
  removeUpload: (id: string) => void;
  cleanupStale: () => void;
  clearAll: () => void;
  setMinimized: (minimized: boolean) => void;
  
  // Computed
  getActiveCount: () => number;
}

export const useUploadStore = create<UploadState>()(
  persist(
    (set, get) => ({
      uploads: {},
      isMinimized: false,

      addUpload: (id, file, uploadUrl, wsUrl) => 
        set((state) => ({
          uploads: {
            ...state.uploads,
            [id]: {
              id,
              file: {
                name: file.name,
                size: file.size,
                type: file.type,
              },
              progress: 0,
              processingProgress: 0,
              status: 'uploading',
              uploadUrl,
              wsUrl,
              startedAt: Date.now(),
            },
          },
          isMinimized: false, // Auto-expand on new upload
        })),

      updateProgress: (id, progress) =>
        set((state) => {
          const item = state.uploads[id];
          if (!item) return state;
          return {
            uploads: {
              ...state.uploads,
              [id]: { ...item, progress },
            },
          };
        }),

      updateProcessingProgress: (id, progress) =>
        set((state) => {
          const item = state.uploads[id];
          if (!item) return state;
          return {
            uploads: {
              ...state.uploads,
              [id]: { ...item, processingProgress: progress },
            },
          };
        }),

      updateThumbnail: (id, url) =>
        set((state) => {
             const item = state.uploads[id];
             if (!item) return state;
             return {
                 uploads: {
                     ...state.uploads,
                     [id]: { ...item, thumbnailUrl: url }
                 }
             }
        }),

      updateStatus: (id, status, error) =>
        set((state) => {
          const item = state.uploads[id];
          if (!item) return state;
          return {
            uploads: {
              ...state.uploads,
              [id]: { 
                ...item, 
                status, 
                error: error || undefined 
              },
            },
          };
        }),

      removeUpload: (id) =>
        set((state) => {
          const newUploads = { ...state.uploads };
          delete newUploads[id];
          return { uploads: newUploads };
        }),

      abortUpload: (id) => 
        set((state) => {
            const newUploads = { ...state.uploads };
            delete newUploads[id];
            return { uploads: newUploads };
        }),

      cleanupStale: () => 
        set((state) => {
            const now = Date.now();
            const newUploads = { ...state.uploads };
            let changed = false;

            Object.values(newUploads).forEach((item) => {
                // Remove 'completed' items older than 1 minute (stuck from auto-dismiss failure)
                if (item.status === 'completed' && now - item.startedAt > 60000) {
                     delete newUploads[item.id];
                     changed = true;
                }
                // Remove 'uploading' zombies (> 24h)
                if (item.status === 'uploading' && now - item.startedAt > 86400000) {
                    delete newUploads[item.id];
                    changed = true;
                }
            });

            return changed ? { uploads: newUploads } : state;
        }),

      clearAll: () => set({ uploads: {} }),

      setMinimized: (minimized) => set({ isMinimized: minimized }),

      getActiveCount: () => {
        const uploads = get().uploads;
        return Object.values(uploads).filter(
          (u) => u.status === 'uploading' || u.status === 'processing'
        ).length;
      },
    }),
    {
      name: 'playtube-uploads', // unique name
      storage: createJSONStorage(() => localStorage), // persist to localStorage
      partialize: (state) => ({ 
        uploads: state.uploads, // Persist uploads
        isMinimized: state.isMinimized 
      }),
    }
  )
);
