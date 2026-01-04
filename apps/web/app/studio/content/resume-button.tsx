"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { retryUploadAction } from "@/app/studio/upload-actions";
import { uploadManager } from "@/lib/upload-manager";
import { toast } from "sonner";

interface Props {
  videoId: string;
  fileName: string; // The original filename to hint the user
}

export function ResumeButton({ videoId, fileName }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optional: Warn if filename doesn't match? 
    // For now, trust the user knows what they are doing or just let them upload a new version.
    
    setIsInitializing(true);
    const toastId = toast.loading("Resuming upload...");

    try {
      // 1. Refresh Upload Token (Server Action)
      const result = await retryUploadAction(videoId) as any;

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || "Failed to resume upload");
      }

      const { uploadUrl, wsUrl } = result.data;

      // 2. Restart Upload (Client Manager)
      uploadManager.retryUpload(videoId, file, uploadUrl, wsUrl);

      toast.success("Upload resumed", { id: toastId });
      
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
      
    } catch (error) {
      console.error("Resume error:", error);
      toast.error(error instanceof Error ? error.message : "Resume failed", { id: toastId });
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept="video/*"
      />
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1 border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-500"
        onClick={() => fileInputRef.current?.click()}
        disabled={isInitializing}
      >
        {isInitializing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
        Resume
      </Button>
    </>
  );
}
