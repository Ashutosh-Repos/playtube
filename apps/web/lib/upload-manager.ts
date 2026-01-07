import { useUploadStore } from "@/store/upload-store";
import { 
  getMultipartPartUrlAction, 
  completeMultipartUploadAction, 
  getMultipartStatusAction,
  abortMultipartUploadAction
} from "@/app/actions/video";

type WorkerMessage = 
  | { type: 'PROGRESS'; videoId: string; progress: number }
  | { type: 'REQUEST_URL'; videoId: string; partNumber: number }
  | { type: 'ALL_COMPLETE'; videoId: string; parts: Array<{ ETag: string; PartNumber: number }> }
  | { type: 'ERROR'; videoId: string; error: string };

class UploadManager {
  private worker: Worker | null = null;
  private activeUploads = new Map<string, string>(); // videoId -> status
  private activeConnections = new Map<string, WebSocket>();
  private resumedPartsMap = new Map<string, Array<{ ETag: string; PartNumber: number }>>(); // Store initial parts

  constructor() {
    if (typeof window !== "undefined") {
      this.worker = new Worker(new URL("../workers/upload.worker.ts", import.meta.url));
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
    }
  }

  // Handle messages from the Worker
  private async handleWorkerMessage(event: MessageEvent<WorkerMessage>) {
    const { type, videoId } = event.data;
    const store = useUploadStore.getState();

    switch (type) {
      case "PROGRESS":
        store.updateProgress(videoId, event.data.progress);
        store.updateStatus(videoId, "uploading"); // Ensure status is uploading
        break;

      case "REQUEST_URL": {
        // Worker asks for a presigned URL for a specific part
        const { partNumber } = event.data;
        const uploadId = localStorage.getItem(`upload_session_${videoId}`);
        
        if (uploadId) {
             const res = await getMultipartPartUrlAction(videoId, uploadId, partNumber);
             if (res.success && 'data' in res && res.data?.url) {
                 this.worker?.postMessage({ 
                     type: 'UPLOAD_CHUNK', 
                     videoId, 
                     partNumber, 
                     url: res.data.url 
                 });
             } else {
                 console.error("Failed to get part URL", res.success ? "No Data" : (res as any).error);
                 this.worker?.postMessage({
                     type: 'UPLOAD_CHUNK_FAILED',
                     videoId,
                     partNumber
                 });
             }
        } else {
            console.error("Missing uploadId for active upload", videoId);
        }
        break;
      }

      case "ALL_COMPLETE": {
        const { parts: newParts } = event.data;
        const uploadId = localStorage.getItem(`upload_session_${videoId}`);
        const existingParts = this.resumedPartsMap.get(videoId) || [];
        
        // Merge previously uploaded parts with new parts
        const allParts = [...existingParts, ...newParts];

        // Deduplicate just in case (shouldn't happen if logic is correct, but safe S3 hygiene)
        const uniquePartsMap = new Map();
        allParts.forEach(p => uniquePartsMap.set(p.PartNumber, p));
        const finalParts = Array.from(uniquePartsMap.values());
        
        if (uploadId) {
            console.log(`[UploadManager] Completing multipart upload for ${videoId}. Parts: ${finalParts.length}`);
            const res = await completeMultipartUploadAction(videoId, uploadId, finalParts);
            if (res.success) {
                store.updateStatus(videoId, "processing");
                localStorage.removeItem(`upload_session_${videoId}`); // Cleanup
                this.resumedPartsMap.delete(videoId);
                this.connectWebSocket(videoId); // Start listening for Processing
            } else {
                store.updateStatus(videoId, "error", (res as any).error || "Failed to complete upload");
            }
        }
        break;
      }

      case "ERROR":
        console.error(`Upload error for ${videoId}:`, event.data.error);
        store.updateStatus(videoId, "error", event.data.error);
        break;
    }
  }

  // Public method to start/resume upload
  public async startUpload(videoId: string, file: File, uploadId: string, wsUrl: string) {
    if (!this.worker) return;

    // 1. Add to Store (if not exists or update)
    const store = useUploadStore.getState();
    if (!store.uploads[videoId]) {
        store.addUpload(videoId, file, "multipart-mode", wsUrl);
    }

    // Persist session ID
    localStorage.setItem(`upload_session_${videoId}`, uploadId);

    // Get resume status (list of already uploaded parts)
    let uploadedPartNumbers: number[] = [];
    try {
        const statusRes = await getMultipartStatusAction(videoId);
        if (statusRes.success && 'data' in statusRes && statusRes.data?.parts) {
            const parts = statusRes.data.parts as Array<{ ETag: string; PartNumber: number }>;
            // Store full objects for later merge
            this.resumedPartsMap.set(videoId, parts);
            // Pass numbers to worker to skip
            uploadedPartNumbers = parts.map(p => p.PartNumber);
        }
    } catch (e) {
        console.warn("Failed to check resume status", e);
    }
    
    console.log(`[UploadManager] Starting ${videoId}. Already uploaded parts: ${uploadedPartNumbers.length}`);

    this.worker.postMessage({
      type: "START",
      videoId,
      file,
      uploadId,
      uploadedParts: uploadedPartNumbers
    });

    // Start listening for WS updates early
    this.connectWebSocket(videoId);
  }

  public pauseUpload(videoId: string) {
      if (!this.worker) return;
      console.log(`[UploadManager] Pausing ${videoId}`);
      
      // 1. Stop Worker (Abort current network requests)
      // We use ABORT message which clears worker state. 
      // This is fine because resume() calls startUpload() which re-initializes worker state.
      this.worker.postMessage({ type: "ABORT", videoId });

      // 2. Update Local Status
      useUploadStore.getState().updateStatus(videoId, 'paused');

      // 3. Close WS (Cleanly)
      this.closeConnection(videoId);
  }

  public async cancelUpload(videoId: string) {
    if (!this.worker) return;
    console.log(`[UploadManager] Cancelling ${videoId}`);
    
    // 1. Stop Worker
    this.worker.postMessage({ type: "ABORT", videoId });
    
    // 2. Call Backend to clean S3 (Async, don't await blocking UI)
    const uploadId = localStorage.getItem(`upload_session_${videoId}`);
    if (uploadId) {
        abortMultipartUploadAction(videoId).catch(err => 
            console.error("Failed to abort S3 upload", err)
        );
    }
    
    // 3. Clean Local State
    this.activeUploads.delete(videoId);
    this.resumedPartsMap.delete(videoId);
    useUploadStore.getState().removeUpload(videoId);
    localStorage.removeItem(`upload_session_${videoId}`);
    
    // 4. Close WS (Cleanly)
    this.closeConnection(videoId);
  }

  public retryUpload(videoId: string, file: File, uploadId: string, wsUrl: string) {
      this.startUpload(videoId, file, uploadId, wsUrl);
  }

  // --- WebSocket Logic ---
  // --- WebSocket Logic ---
  private reconnectAttempts = new Map<string, number>();

  public connectWebSocket(videoId: string) {
    const store = useUploadStore.getState();
    const item = store.uploads[videoId];
    if (!item?.wsUrl) {
         // Maybe try to find it from localStorage or args?
         // For now assume it's in store.
         return;
    }

    if (this.activeConnections.has(videoId)) return;

    // Reset attempt count if successfully connecting (or first time)
    if (!this.reconnectAttempts.has(videoId)) {
        this.reconnectAttempts.set(videoId, 0);
    }

    console.log(`🔌 Connecting WS for ${videoId} (Attempt ${this.reconnectAttempts.get(videoId)})`);
    const ws = new WebSocket(item.wsUrl);
    this.activeConnections.set(videoId, ws);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const payload = data.data || data;

        // Reset attempts on successful message means connection is healthy
        this.reconnectAttempts.set(videoId, 0);

        // Simplify Video Service messages
        const status = (payload.processingStatus || payload.status)?.toUpperCase();

        if (status === 'PROCESSING') {
             if (payload.progress) store.updateProcessingProgress(videoId, payload.progress);
        } else if (status === 'COMPLETED' || status === 'READY') {
             store.updateStatus(videoId, 'completed');
             store.updateProcessingProgress(videoId, 100);
             // Normal close
             this.closeConnection(videoId); 
        } else if (status === 'FAILED') {
             store.updateStatus(videoId, 'error', 'Processing Failed');
             // Normal close
             this.closeConnection(videoId);
        }
        
        if (payload.thumbnailUrl) {
            store.updateThumbnail(videoId, payload.thumbnailUrl);
        }
      } catch (e) {
          console.warn("WS Parse Error", e);
      }
    };

    ws.onerror = (e) => {
      console.error(`WS Error [${videoId}]`, e);
      // Let onclose handle reconnection
    };

    ws.onclose = (e) => {
        console.warn(`WS Closed [${videoId}] Code: ${e.code} wasClean: ${e.wasClean}`);
        this.activeConnections.delete(videoId);

        // Check if we should reconnect
        // Only reconnect if we are still processing/uploading and strictly NOT completed/error/cancelled
        // And if the close wasn't "clean" (clean=1000 usually means intentional close)
        // OR if we are just ensuring we get the final status.
        
        const currentItem = useUploadStore.getState().uploads[videoId];
        
        if (currentItem && (currentItem.status === 'processing' || currentItem.status === 'uploading')) {
             const attempts = this.reconnectAttempts.get(videoId) || 0;
             if (attempts < 10) { // Max retry limit
                 const delay = Math.min(1000 * Math.pow(2, attempts), 30000); // Exponential backoff max 30s
                 console.log(`🔄 Reconnecting WS for ${videoId} in ${delay}ms...`);
                 
                 this.reconnectAttempts.set(videoId, attempts + 1);
                 
                 setTimeout(() => {
                     // Check again before connecting in case it completed/cancelled in between
                     const freshItem = useUploadStore.getState().uploads[videoId];
                     if(freshItem && (freshItem.status === 'processing' || freshItem.status === 'uploading')) {
                         this.connectWebSocket(videoId);
                     }
                 }, delay);
             } else {
                 console.error(`❌ WS Reconnection failed after ${attempts} attempts`);
                 // Maybe fallback to polling? Or just let the Sync hook handle it eventually?
             }
        } else {
            this.reconnectAttempts.delete(videoId);
        }
    };
  }

  private closeConnection(videoId: string) {
      const ws = this.activeConnections.get(videoId);
      if (ws) {
          // Unbind handlers to prevent reconnection logic
          ws.onclose = null;
          ws.onerror = null;
          ws.close();
          this.activeConnections.delete(videoId);
      }
      this.reconnectAttempts.delete(videoId);
  }
}

export const uploadManager = new UploadManager();
