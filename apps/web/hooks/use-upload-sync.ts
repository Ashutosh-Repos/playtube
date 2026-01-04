
import { useEffect, useRef } from 'react';
import { useUploadStore } from '@/store/upload-store';
import { checkVideoStatusAction } from '@/app/studio/upload-actions';
import { toast } from 'sonner';

export function useUploadSync() {
  const { uploads, removeUpload, updateStatus } = useUploadStore();
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    // Only sync once per full page load/mount to avoid spamming
    // or we could use a comprehensive strategy (e.g. SWR) but simplified for now.
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    const syncUploads = async () => {
      const activeUploads = Object.values(uploads).filter(
        (u) => u.status !== 'completed' && u.status !== 'error'
      );

      if (activeUploads.length === 0) return;

      console.log(`[Sync] Verifying ${activeUploads.length} active uploads...`);

      for (const upload of activeUploads) {
        try {
          // Check backend status
          const result = await checkVideoStatusAction(upload.id);

          if (!result.success) {
            // Check for 404/Not Found in error message
            // Currently server action returns { success: false, error: { message } }
            // API throws ServiceError(code, status).
            // We need to verify if the server action passes status or detailed code.
            // Looking at upload-actions.ts, it captures error.message.
            // If backend returns 404, error message usually contains "Not Found" or "Video not found"
            
            const msg = result.error?.message?.toLowerCase() || "";
            if (msg.includes("not found") || msg.includes("404")) {
                 console.warn(`[Sync] Video ${upload.id} not found on server. Removing from local store.`);
                 removeUpload(upload.id);
                 toast.error(`Removed stale upload: ${upload.file.name}`);
            } else {
                // Other error (500, network), keep it but maybe mark as error?
                // Don't remove if it's just a network blip.
                console.warn(`[Sync] Status check failed for ${upload.id}: ${msg}`);
            }
          } else {
             // Success - Video exists.
             // If local status is 'processing' but backend is 'READY', update it.
             const video = result.data;
             if (video && video.processingStatus === 'READY' && upload.status !== 'completed') {
                 updateStatus(upload.id, 'completed');
             }
             if (video && video.processingStatus === 'FAILED' && upload.status !== 'error') {
                 updateStatus(upload.id, 'error', video.processingError || "Server processing failed");
             }

             // Reconnect WS if processing
             if (video && video.processingStatus === 'PROCESSING') {
                 // Lazy import to avoid circular dependency issues if any, or just direct
                 const { uploadManager } = await import('@/lib/upload-manager');
                 uploadManager.connectWebSocket(upload.id);
             }

             // Detect Interrupted Uploads
             // If backend is still waiting for file, but local store thinks we are 'uploading'
             // And we haven't seen an update in > 1 minute (covers slow connections vs dead zombies)
             // This also protects multi-tab usage: if another tab is uploading, lastUpdated will be fresh.
             const isStale = (Date.now() - (upload.lastUpdated || upload.startedAt)) > 60 * 1000;
             if (video && video.processingStatus === 'WAITING_FOR_UPLOAD' && upload.status === 'uploading' && isStale) {
                 updateStatus(upload.id, 'error', "Upload interrupted. Please retry.");
             }
          }
        } catch (e) {
            console.error(`[Sync] Unexpected error checking ${upload.id}`, e);
        }
      }
    };

    syncUploads();
  }, [uploads, removeUpload, updateStatus]);
}
