
import { useEffect, useRef } from 'react';
import { useUploadStore } from '@/store/upload-store';
import { revalidateVideoList } from '@/app/studio/content/actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function useUploadCompletion() {
  const { uploads } = useUploadStore();
  const router = useRouter(); // Use client router
  
  // We need to track previous states to detect transitions
  const prevUploadsRef = useRef<{ [key: string]: string }>({});

  useEffect(() => {
    const currentUploads = uploads;
    const prevUploads = prevUploadsRef.current;

    Object.values(currentUploads).forEach((item) => {
        const prevStatus = prevUploads[item.id];
        const currentStatus = item.status;

        // Detect Transition: Uploading -> Processing (Upload Complete)
        // OR Transition: Processing -> Completed (Transcode Complete)
        
        // Scenario 1: Upload just finished (File sent to S3)
        // We want the server table to show the new video immediately
        if (prevStatus === 'uploading' && currentStatus === 'processing') {
            console.log(`[Handshake] Upload complete for ${item.id}. Refreshing table.`);
            revalidateVideoList();
            router.refresh(); // Force client-side router to re-fetch Server Components
            toast.success("Upload complete! Processing started.");
        }

        // Scenario 2: Transcoding finished
        // We want the server table to show "Ready"
        if (prevStatus === 'processing' && currentStatus === 'completed') {
             console.log(`[Handshake] Processing complete for ${item.id}. Refreshing table.`);
             revalidateVideoList();
             router.refresh(); // Force update
             toast.success(`${item.file.name} is ready!`);
             
             // Auto-dismiss from tray after 5 seconds
             setTimeout(() => {
                 useUploadStore.getState().removeUpload(item.id);
             }, 5000);
        }
    });

    // Update ref
    const newSnapshot: { [key: string]: string } = {};
    Object.values(currentUploads).forEach(u => newSnapshot[u.id] = u.status);
    prevUploadsRef.current = newSnapshot;

  }, [uploads, router]);
}
