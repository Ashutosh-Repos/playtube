
import { useCallback } from 'react';
import { useUploadStore } from '@/store/upload-store';
import { uploadManager } from '@/lib/upload-manager';
import { deleteVideoAction } from '@/app/actions/video'; // Fixed import location
import { retryVideoUpload } from '@/app/actions/video'; // Import correct action
import { toast } from 'sonner';

export function useUploadActions() {
    const { removeUpload } = useUploadStore();

    const retryUpload = useCallback(async (id: string, newFile?: File) => {
        const state = useUploadStore.getState();
        const item = state.uploads[id];
        
        if (!item) {
            toast.error("Upload not found locally");
            return;
        }

        console.log(`[Actions] Retry/Resuming upload for ${id}`);

        // Prefer newFile if provided, otherwise check stored file
        const fileToUse = newFile || (item.file instanceof File ? item.file : null);

        if (fileToUse) {
             // Reset status to uploading
             state.updateStatus(id, 'uploading');
             const toastId = toast.loading("Resuming session...");
             try {
                // 1. Try to RESUME existing session (Smart Resume)
                const existingUploadId = localStorage.getItem(`upload_session_${id}`);
                const existingWsUrl = item.wsUrl;

                if (existingUploadId && existingWsUrl) {
                     console.log("[Actions] Found existing session, resuming...", existingUploadId);
                     uploadManager.retryUpload(id, fileToUse, existingUploadId, existingWsUrl);
                     toast.success("Resumed", { id: toastId });
                     return; 
                }

                // 2. If no session, Create NEW (Hard Retry)
                console.log("[Actions] No local session found, creating new one...");
                const res = await retryVideoUpload(id) as any;
                if (!res.success) throw new Error(res.error || "Retry failed");

                const { uploadId, wsUrl } = res.data; 
                
                // Pass new uploadId
                uploadManager.retryUpload(id, fileToUse, uploadId, wsUrl);
                toast.success("Restarted", { id: toastId });

             } catch (e) {
                 console.error(e);
                 toast.error("Failed to resume session", { id: toastId });
                 state.updateStatus(id, 'error', 'Retry failed');
             }
        } else {
             toast.error("File reference lost. Please select the file again.");
        }
    }, []);

    const cancelUpload = useCallback((id: string) => {
        console.log(`[Actions] Canceling upload ${id}`);
        // 1. Abort Manager
        uploadManager.cancelUpload(id); // Fixed method name
        // 2. Remove locally
        removeUpload(id);
        // 3. Delete Server
        deleteVideoAction(id).then(res => {
            if (!res.success) console.warn("Failed to cleanup video record on server", res.error);
        });
        toast("Upload canceled");
    }, [removeUpload]);

    const pauseUpload = useCallback((id: string) => {
        console.log(`[Actions] Pausing upload ${id}`);
        uploadManager.pauseUpload(id);
    }, []);

    const retryProcessing = useCallback(async (id: string) => {
        console.log(`[Actions] Retrying processing for ${id}`);
        try {
             const state = useUploadStore.getState();
             const item = state.uploads[id];
             if (!item) throw new Error("Upload not found");
             
             if (!(item.file instanceof File)) {
                 toast.error("Cannot retry: File source is missing. Please re-upload.");
                 return;
             }

             state.updateStatus(id, 'processing'); // Optimistic
             
             const res = await retryVideoUpload(id);
             if (!res.success) throw new Error((res as any).error || "Retry failed");
             
             const { uploadId, wsUrl } = (res as any).data;
             
             // Pass new uploadId
             uploadManager.retryUpload(id, item.file, uploadId, wsUrl);
        } catch (e) {
             toast.error("Failed to retry processing");
             console.error(e);
             useUploadStore.getState().updateStatus(id, 'error', 'Retry failed');
        }
    }, []);
    
    // Deletes both local and server
    const deleteUpload = useCallback(async (id: string) => {
         // 1. Abort/Remove Local
         uploadManager.cancelUpload(id); // Fixed method name
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
        pauseUpload,
        retryProcessing,
        deleteUpload
    };
}
