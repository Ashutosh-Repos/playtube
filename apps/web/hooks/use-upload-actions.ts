
import { useCallback } from 'react';
import { useUploadStore } from '@/store/upload-store';
import { uploadManager } from '@/lib/upload-manager';
import { deleteVideoAction, retryUploadAction } from '@/app/studio/upload-actions';
import { toast } from 'sonner';

export function useUploadActions() {
    const { removeUpload } = useUploadStore();

    const retryUpload = useCallback((id: string) => {
        const state = useUploadStore.getState();
        const item = state.uploads[id];
        
        if (!item) {
            toast.error("Upload not found locally");
            return;
        }

        console.log(`[Actions] Retrying upload for ${id}`);
        // Reset status to uploading
        state.updateStatus(id, 'uploading');
        
        // Re-trigger manager
        // We assume we still have the file object in memory if the tab wasn't closed?
        // Actually, 'File' objects are not serializable in localStorage.
        // If strict persistence was used, 'file' might be lost on refresh.
        // We need to check if we have the file blob.
        // Limitation: If page refreshed, we cannot retry *Upload* unless we ask user to re-select file.
        // BUT, if it's just a network glitch and page is open, 'file' object is in store (Zustand memory).
        
        if (item.file instanceof File) {
             uploadManager.retryUpload(id, item.file, item.uploadUrl!, item.wsUrl!);
             toast.info("Retrying upload...");
        } else {
             toast.error("Cannot retry: File reference lost. Please restart upload.");
             // TODO: Might need a UI to re-attach file if we want robust recovery across reloads.
        }
    }, []);

    const cancelUpload = useCallback((id: string) => {
        console.log(`[Actions] Canceling upload ${id}`);
        // 1. Abort Manager
        uploadManager.abort(id);
        // 2. Remove locally
        removeUpload(id);
        // 3. Optional: Call API to delete partial DB record?
        // We should probably leave it to the cleanup script or explicit delete.
        // 3. Delete Server (via Server Action)
        deleteVideoAction(id).then(res => {
            if (!res.success) console.warn("Failed to cleanup video record on server", res.error);
        });
        toast("Upload canceled");
    }, [removeUpload]);

    const retryProcessing = useCallback(async (id: string) => {
        console.log(`[Actions] Retrying processing for ${id}`);
        try {
             const state = useUploadStore.getState();
             state.updateStatus(id, 'processing'); // Optimistic
             
             const res = await retryUploadAction(id);
             if (!res.success) throw new Error(res.error);
             
             toast.info("Retrying processing...");
        } catch (e) {
             toast.error("Failed to retry processing");
             console.error(e);
             useUploadStore.getState().updateStatus(id, 'error', 'Retry failed');
        }
    }, []);
    
    // Deletes both local and server
    const deleteUpload = useCallback(async (id: string) => {
         // 1. Abort/Remove Local
         uploadManager.abort(id);
         removeUpload(id);
         
         // 2. Delete Server
         const res = await deleteVideoAction(id);
         if (res.success) {
             toast.success("Video deleted");
         } else {
             toast.error("Failed to delete video from server");
         }
    }, [removeUpload]);

    return {
        retryUpload,
        cancelUpload,
        retryProcessing,
        deleteUpload
    };
}
