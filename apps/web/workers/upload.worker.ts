/* eslint-disable no-restricted-globals */

// Type definitions for worker messages
export type WorkerMessage = 
  | { type: 'START'; videoId: string; file: File; url: string }
  | { type: 'ABORT'; videoId: string };

export type WorkerResponse = 
  | { type: 'PROGRESS'; videoId: string; progress: number }
  | { type: 'COMPLETE'; videoId: string }
  | { type: 'ERROR'; videoId: string; error: string };

const uploads = new Map<string, XMLHttpRequest>();

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type } = e.data;

  if (type === 'START') {
    console.log(`[Pipeline] 🚀 Worker START command received for ${e.data.videoId}`);
    const { videoId, file, url } = e.data;
    startUpload(videoId, file, url);
  } else if (type === 'ABORT') {
    console.log(`[Pipeline] 🛑 Worker ABORT command received for ${e.data.videoId}`);
    const { videoId } = e.data;
    const xhr = uploads.get(videoId);
    if (xhr) {
      xhr.abort();
      uploads.delete(videoId);
    }
  }
};

function startUpload(videoId: string, file: File, url: string) {
  try {
    const xhr = new XMLHttpRequest();
    uploads.set(videoId, xhr);

    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    
    // Track Progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        // Log every 10% to avoid spam
        if (Math.round(percentComplete) % 10 === 0) {
             console.log(`[Pipeline] 📤 Upload Progress for ${videoId}: ${Math.round(percentComplete)}%`);
        }
        self.postMessage({ 
          type: 'PROGRESS', 
          videoId, 
          progress: percentComplete 
        } as WorkerResponse);
      }
    };

    // Completion
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log(`[Pipeline] ✅ Upload XHR Complete for ${videoId} (Status: ${xhr.status})`);
        self.postMessage({ type: 'COMPLETE', videoId } as WorkerResponse);
        uploads.delete(videoId);
      } else {
        self.postMessage({ 
          type: 'ERROR', 
          videoId, 
          error: `Upload failed with status ${xhr.status}` 
        } as WorkerResponse);
        console.error(`[Pipeline] ❌ Upload XHR Failed for ${videoId} (Status: ${xhr.status})`);
        uploads.delete(videoId);
      }
    };

    // Error
    xhr.onerror = () => {
      self.postMessage({ 
        type: 'ERROR', 
        videoId, 
        error: 'Network Error' 
      } as WorkerResponse);
      uploads.delete(videoId);
    };

    xhr.send(file);
  } catch (error) {
    self.postMessage({ 
      type: 'ERROR', 
      videoId, 
      error: error instanceof Error ? error.message : 'Unknown Worker Error' 
    } as WorkerResponse);
  }
}
