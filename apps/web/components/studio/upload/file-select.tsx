"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { useChannel } from "@/context/channel-context";
import { initiateUploadAction } from "@/app/studio/upload-actions";
import { uploadManager } from "@/lib/upload-manager";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  children?: React.ReactNode;
}

export function FileSelect({ variant = "default", className, children }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentChannel } = useChannel();
  const [isInitializing, setIsInitializing] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!currentChannel) {
      toast.error("No active channel selected");
      return;
    }

    setIsInitializing(true);
    const toastId = toast.loading("Preparing upload...");

    try {
      // 1. Create Video Draft (Server Action)
      const result = await initiateUploadAction({
        fileName: file.name,
        channelId: currentChannel.id,
      }) as any; // Cast to any to avoid strict type checks on union

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || "Failed to initiate upload");
      }

      const { videoId, uploadUrl, wsUrl } = result.data;
      console.log(`[Client] 🟢 Server Action Success! Video ID: ${videoId}`);
      console.log(`[Client] 🚀 Calling uploadManager.startUpload...`);

      // 2. Start Upload (Client Manager)
      uploadManager.startUpload(videoId, file, uploadUrl, wsUrl);

      toast.success("Upload started", { id: toastId });
      
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
      
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Upload failed", { id: toastId });
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
        variant={variant}
        className={cn("gap-2", className)}
        onClick={() => fileInputRef.current?.click()}
        disabled={isInitializing}
      >
        {isInitializing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {children || "Upload Video"}
      </Button>
    </>
  );
}
