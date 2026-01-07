/* eslint-disable no-restricted-globals */

// Type definitions for worker messages
export type WorkerMessage = 
  | { type: 'START'; videoId: string; file: File; uploadId: string; uploadedParts: number[] }
  | { type: 'ABORT'; videoId: string }
  | { type: 'UPLOAD_CHUNK'; videoId: string; partNumber: number; url: string }
  | { type: 'UPLOAD_CHUNK_FAILED'; videoId: string; partNumber: number }; // New

export type WorkerResponse = 
  | { type: 'PROGRESS'; videoId: string; progress: number }
  | { type: 'REQUEST_URL'; videoId: string; partNumber: number } // Ask main thread for URL
  | { type: 'PART_COMPLETE'; videoId: string; partNumber: number; etag: string }
  | { type: 'ALL_COMPLETE'; videoId: string; parts: Array<{ ETag: string; PartNumber: number }> }
  | { type: 'ERROR'; videoId: string; error: string };

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_CONCURRENT = 3;

interface UploadState {
  file: File;
  videoId: string;
  uploadId: string;
  totalParts: number;
  pendingParts: number[]; // Parts waiting to be uploaded
  activeParts: Set<number>; // Parts currently uploading
  completedParts: Array<{ ETag: string; PartNumber: number }>;
  uploadedBytes: number; // Bytes of *completed* parts
}

// Map videoId -> State
const uploads = new Map<string, UploadState>();
const xhrMap = new Map<string, XMLHttpRequest>(); // videoId_partNumber -> XHR

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type } = e.data;

  if (type === 'START') {
    const { videoId, file, uploadId, uploadedParts } = e.data;
    console.log(`[Worker] 🚀 Starting Multipart Upload for ${videoId} (Resumed Parts: ${uploadedParts.length})`);
    startUpload(videoId, file, uploadId, uploadedParts);
  } else if (type === 'UPLOAD_CHUNK') {
    const { videoId, partNumber, url } = e.data;
    processChunkUpload(videoId, partNumber, url);
  } else if (type === 'UPLOAD_CHUNK_FAILED') {
    // Main thread failed to get URL -> Retry later
    const { videoId, partNumber } = e.data;
    handleError(videoId, partNumber, "Failed to get Presigned URL");
  } else if (type === 'ABORT') {
    const { videoId } = e.data;
    abortUpload(videoId);
  }
};

function startUpload(videoId: string, file: File, uploadId: string, preUploadedParts: number[]) {
  const totalParts = Math.ceil(file.size / CHUNK_SIZE);
  const pendingParts: number[] = [];
  const completedParts: Array<{ ETag: string; PartNumber: number }> = [];

  // Initialize Queue
  for (let i = 1; i <= totalParts; i++) {
    if (preUploadedParts.includes(i)) {
      // Skip parts that are already uploaded (Resume feature)
      // The UploadManager will merge these with the new parts we upload.
    } else {
      pendingParts.push(i);
    }
  }

  // Calculate generic initial progress (based on pre-uploaded)
  const uploadedBytes = (preUploadedParts.length * CHUNK_SIZE);

  uploads.set(videoId, {
    file,
    videoId,
    uploadId,
    totalParts,
    pendingParts,
    activeParts: new Set(),
    completedParts: [], // Only new parts
    uploadedBytes,
  });

  processQueue(videoId);
}

function processQueue(videoId: string) {
  const state = uploads.get(videoId);
  if (!state) return;

  // Check if done
  if (state.pendingParts.length === 0 && state.activeParts.size === 0) {
    console.log(`[Worker] ✅ All parts uploaded for ${videoId}`);
    self.postMessage({ 
      type: 'ALL_COMPLETE', 
      videoId, 
      parts: state.completedParts 
    } as WorkerResponse);
    uploads.delete(videoId);
    return;
  }

  // Fill concurrency slots
  while (state.activeParts.size < MAX_CONCURRENT && state.pendingParts.length > 0) {
    const partNumber = state.pendingParts.shift();
    if (partNumber) {
      state.activeParts.add(partNumber);
      // Ask Main Thread for URL
      self.postMessage({ 
        type: 'REQUEST_URL', 
        videoId, 
        partNumber 
      } as WorkerResponse);
    }
  }
}

function processChunkUpload(videoId: string, partNumber: number, url: string) {
  const state = uploads.get(videoId);
  if (!state) return;

  const start = (partNumber - 1) * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, state.file.size);
  const chunk = state.file.slice(start, end);

  const xhr = new XMLHttpRequest();
  xhrMap.set(`${videoId}_${partNumber}`, xhr);

  xhr.open('PUT', url, true);
  
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      const etag = xhr.getResponseHeader('ETag')?.replace(/"/g, ''); // Strip quotes
      if (etag) {
        state.completedParts.push({ ETag: etag, PartNumber: partNumber });
        state.activeParts.delete(partNumber);
        state.uploadedBytes += chunk.size;
        
        // Report Progress
        const percent = (state.uploadedBytes / state.file.size) * 100;
        self.postMessage({ type: 'PROGRESS', videoId, progress: percent } as WorkerResponse);
        
        xhrMap.delete(`${videoId}_${partNumber}`);
        processQueue(videoId); // Next
      } else {
         handleError(videoId, partNumber, "No ETag in response");
      }
    } else {
      handleError(videoId, partNumber, `Upload failed status ${xhr.status}`);
    }
  };

  xhr.onerror = () => handleError(videoId, partNumber, "Network Error");
  
  xhr.send(chunk);
}

function handleError(videoId: string, partNumber: number, error: string) {
    console.error(`[Worker] Error part ${partNumber}: ${error}`);
    const state = uploads.get(videoId);
    if (!state) return;

    // Remove from active
    state.activeParts.delete(partNumber);
    xhrMap.delete(`${videoId}_${partNumber}`);

    // Retry? Put back in pending?
    // For now simple: Put back in pending (at end)
    state.pendingParts.push(partNumber);
    
    // Optional: Backoff or error if too many failures?
    // For resilience, we just retry forever or let logic handle it.
    // If we want to hard fail, we post ERROR.
    // Let's retry 3 times? (Not implemented for simplicity, just re-queue)
    
    // Trigger queue again
    setTimeout(() => processQueue(videoId), 1000); 
}

function abortUpload(videoId: string) {
    const state = uploads.get(videoId);
    if (!state) return;

    // Abort all active XHRs
    state.activeParts.forEach(part => {
        const xhr = xhrMap.get(`${videoId}_${part}`);
        xhr?.abort();
        xhrMap.delete(`${videoId}_${part}`);
    });

    uploads.delete(videoId);
}
