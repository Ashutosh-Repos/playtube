
import { useEffect, useRef } from 'react';
import { useUploadStore } from '@/store/upload-store';
import { checkVideoStatusAction } from '@/app/studio/upload-actions';
import { toast } from 'sonner';

export function useUploadSync() {
  const { uploads, removeUpload, updateStatus } = useUploadStore();
  const syncingRef = useRef(false);

  useEffect(() => {
    const syncUploads = async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;

      const activeUploads = Object.values(uploads).filter(
        (u) => u.status !== 'completed' && u.status !== 'error'
      );

      if (activeUploads.length === 0) {
          syncingRef.current = false;
          return;
      }

      console.log(`[Sync] Verifying ${activeUploads.length} active uploads...`);

      for (const upload of activeUploads) {
        try {
          // Check backend status
          const result = await checkVideoStatusAction(upload.id);

          if (!result.success) {
            const msg = result.error?.message?.toLowerCase() || "";
            if (msg.includes("not found") || msg.includes("404")) {
                 console.warn(`[Sync] Video ${upload.id} not found on server. Removing from local store.`);
                 removeUpload(upload.id);
                 toast.error(`Removed stale upload: ${upload.file.name}`);
            } else {
                console.warn(`[Sync] Status check failed for ${upload.id}: ${msg}`);
            }
          } else {
             const video = result.data;
             // Sync Status
             if (video) {
                 if (video.processingStatus === 'READY' && upload.status !== 'completed') {
                     console.log(`[Sync] Video ${upload.id} is READY. Updating local status.`);
                     updateStatus(upload.id, 'completed');
                     // Note: We don't remove it, we mark it completed so the tray can show "Done"
                 }
                 else if (video.processingStatus === 'FAILED' && upload.status !== 'error') {
                     updateStatus(upload.id, 'error', video.processingError || "Server processing failed");
                 }
                 // Resume WS if persistent processing
                 else if (video.processingStatus === 'PROCESSING') {
                     const { uploadManager } = await import('@/lib/upload-manager');
                     uploadManager.connectWebSocket(upload.id);
                 }
             }
          }
        } catch (e) {
            console.error(`[Sync] Unexpected error checking ${upload.id}`, e);
        }
      }
      syncingRef.current = false;
    };

    // Run on mount
    syncUploads();

    // Run on visibility change (Tab focus)
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            syncUploads();
        }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [uploads, removeUpload, updateStatus]);
}
