import { useUploadStore } from "@/store/upload-store";

// Helper to get Worker instance (Lazy loaded logic can be added here if needed, 
// but for now we keep it simple as a singleton or per-usage)

class UploadManager {
  private worker: Worker | null = null;
  private activeConnections = new Map<string, WebSocket>();

  constructor() {
    // Initialize Worker only on client side
    if (typeof window !== 'undefined') {
      this.initWorker();
    }
  }

  private initWorker() {
    if (this.worker) return;
    
    this.worker = new Worker(new URL('../workers/upload.worker.ts', import.meta.url));
    
    this.worker.onmessage = (event) => {
      const { type, videoId } = event.data;
      const store = useUploadStore.getState();

      switch (type) {
        case 'PROGRESS':
          store.updateProgress(videoId, event.data.progress);
          break;
        case 'COMPLETE':
          store.updateStatus(videoId, 'processing');
          this.connectWebSocket(videoId); // Start listening for Trancoding events
          break;
        case 'ERROR':
          store.updateStatus(videoId, 'error', event.data.error);
          break;
      }
    };
  }

  public startUpload(videoId: string, file: File, uploadUrl: string, wsUrl: string) {
    console.log(`[UploadManager] startUpload called for ${videoId}`);
    if (!this.worker) this.initWorker();

    // 1. Add to Store
    useUploadStore.getState().addUpload(videoId, file, uploadUrl, wsUrl);

    // 2. Offload to Worker
    this.worker?.postMessage({ type: 'START', videoId, file, url: uploadUrl });
  }

  public abort(videoId: string) {
      // 1. Tell Worker to abort XHR
      this.worker?.postMessage({ type: 'ABORT', videoId });
      
      // 2. Close WebSocket if active
      if (this.activeConnections.has(videoId)) {
          this.activeConnections.get(videoId)?.close();
          this.activeConnections.delete(videoId);
      }

      // 3. Update Store
      useUploadStore.getState().abortUpload(videoId);
  }

  public retryUpload(videoId: string, file: File, uploadUrl: string, wsUrl: string) {
      // Just re-use start logic, store will update the existing entry or overwrite safely
      // Logic in store 'addUpload' resets progress to 0 which is correct for retry
      this.startUpload(videoId, file, uploadUrl, wsUrl);
  }

  private connectWebSocket(videoId: string) {
    const store = useUploadStore.getState();
    const item = store.uploads[videoId];
    if (!item?.wsUrl) return;

    if (this.activeConnections.has(videoId)) return;

    console.log(`🔌 Connecting WS for ${videoId}: ${item.wsUrl}`);
    const ws = new WebSocket(item.wsUrl);
    this.activeConnections.set(videoId, ws);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`[Pipeline] 📩 WS Message [${videoId}]:`, data);

        // Normalized Payload
        // Some events wrap data in 'data' field, others send it directly.
        // We prioritize 'data' if it exists.
        const payload = data.data || data;

        // Check for Status Updates (Video Updated)
        if (data.type === 'VIDEO_UPDATED' || data.event === 'VIDEO_UPDATED' || data.type === 'state') {
            
            // Handle different casing and field names
            const status = (payload.processingStatus || payload.status)?.toUpperCase();

            // Processing
            if (status === 'PROCESSING') {
                 // Forward progress if available
                 if (payload.progress) {
                     store.updateProcessingProgress(videoId, payload.progress);
                 }
            }

            // Completed / Ready
            if (status === 'COMPLETED' || status === 'READY') {
                console.log(`[Pipeline] ✅ Video ${videoId} is READY. Updating store.`);
                store.updateStatus(videoId, 'completed');
                store.updateProcessingProgress(videoId, 100); // Ensure 100%
                
                // Cleanup WS
                ws.close();
                this.activeConnections.delete(videoId);
            }

            // Failed
            if (status === 'FAILED') {
                console.error(`[Pipeline] ❌ Video ${videoId} FAILED.`);
                store.updateStatus(videoId, 'error', 'Processing Failed');
                ws.close();
                this.activeConnections.delete(videoId);
            }

            // Thumbnail Update
            if (payload.thumbnailUrl) {
                store.updateThumbnail(videoId, payload.thumbnailUrl);
            }
            if (payload.thumbnails && Array.isArray(payload.thumbnails) && payload.thumbnails.length > 0) {
                 store.updateThumbnail(videoId, payload.thumbnails[0]);
            }
        }
        
        // Handle specific Transcoder Progress Events if forwarded
        if (data.type === 'progress' || data.type === 'TRANSCODER_PROGRESS') {
             if (payload.progress) {
                 store.updateProcessingProgress(videoId, payload.progress);
             }
        }

      } catch (e) {
        console.warn("WS Parse Error", e);
      }
    };

    ws.onerror = (e) => {
      console.error(`WS Error [${videoId}]`, e);
      // Optional: Retry logic
    };

    ws.onclose = () => {
      this.activeConnections.delete(videoId);
    };
  }
}

export const uploadManager = new UploadManager();
