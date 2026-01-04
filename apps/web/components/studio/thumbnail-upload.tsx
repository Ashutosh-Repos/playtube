"use client";

import React, { useState, useRef } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

interface ThumbnailUploadProps {
  onUpload: (file: File | null) => void;
  currentUrl?: string | null;
}

export function ThumbnailUpload({ onUpload, currentUrl }: ThumbnailUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.includes("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2MB");
      return;
    }

    setIsUploading(true);
    
    // Create local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

      try {
        // Just preview locally
        const objectUrl = URL.createObjectURL(file);
        setPreview(objectUrl);
        // Pass the file back to parent for actual upload later
        onUpload(file);
        
      } catch (e) {
         setPreview(null);
         toast.error("Failed to select image");
      } finally {
        setIsUploading(false);
      }
  };

  const removeThumbnail = () => {
    setPreview(null);
    onUpload(null); // Clear
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="w-full">
      <div 
        className={`relative aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden group ${
            preview ? "border-transparent" : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        }`}
        onClick={() => !preview && inputRef.current?.click()}
      >
        {preview ? (
            <>
                <Image 
                    src={preview} 
                    alt="Thumbnail preview" 
                    fill 
                    className="object-cover" 
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            removeThumbnail();
                        }}
                        className="p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </>
        ) : (
            <>
                {isUploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                ) : (
                    <>
                        <ImagePlus className="h-8 w-8 text-neutral-400 mb-2" />
                        <p className="text-sm text-neutral-500 font-medium">Upload Thumbnail</p>
                        <p className="text-xs text-neutral-400">max 2MB</p>
                    </>
                )}
            </>
        )}
        <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            disabled={isUploading}
        />
      </div>
    </div>
  );
}
