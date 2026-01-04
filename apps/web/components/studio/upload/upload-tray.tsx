"use client";

import { useUploadStore } from "@/store/upload-store";
import { UploadItem } from "./upload-item";
import { motion, AnimatePresence } from "framer-motion"; // Ensure framer-motion is installed
import { ChevronDown, ChevronUp, X, Minimize2, Maximize2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils"; // ShadCN utils

import { useUploadSync } from "@/hooks/use-upload-sync";
import { useUploadCompletion } from "@/hooks/use-upload-completion"; // Handshake
import { useUploadActions } from "@/hooks/use-upload-actions"; // Retry/Cancel

export function UploadTray() {
  const { uploads, isMinimized, setMinimized, getActiveCount, cleanupStale } = useUploadStore();
  const { cancelUpload, retryUpload } = useUploadActions();
  
  const uploadList = Object.values(uploads).sort((a,b) => b.startedAt - a.startedAt); // Newest first
  
  // Hooks
  useUploadSync();       // Auto-heal ghosts
  useUploadCompletion(); // Trigger Server Refresh on success
  
  const activeCount = getActiveCount();
  const hasUploads = uploadList.length > 0;

  // Hydration fix (Persistent store needs to mount first)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
      setMounted(true);
      cleanupStale();
  }, [cleanupStale]);

  if (!mounted || !hasUploads) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end pointer-events-none">
       {/* Pointer events auto-enabled on children */}
       
       <AnimatePresence>
          {!isMinimized && (
              <motion.div
                 initial={{ opacity: 0, y: 20, scale: 0.95 }}
                 animate={{ opacity: 1, y: 0, scale: 1 }}
                 exit={{ opacity: 0, y: 20, scale: 0.95 }}
                 transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                 className="pointer-events-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl rounded-xl w-[380px] overflow-hidden mb-2"
              >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 backdrop-blur-sm">
                      <h3 className="font-semibold text-sm">
                          {activeCount > 0 ? `Uploading ${activeCount} videos` : "Uploads Completed"}
                      </h3>
                      <div className="flex items-center gap-1">
                          {/* Minimize */}
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMinimized(true)}>
                              <ChevronDown className="h-4 w-4" />
                          </Button>
                      </div>
                  </div>

                  {/* List */}
                  <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-200 dark:scrollbar-thumb-neutral-800">
                      {uploadList.map(item => (
                          <div key={item.id} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                             <UploadItem item={item} />
                          </div>
                      ))}
                  </div>
              </motion.div>
          )}
       </AnimatePresence>

       {/* Minimized / Toggle Button */}
       <div className="pointer-events-auto">
           {isMinimized ? (
               <motion.div 
                 layoutId="tray-trigger"
                 className="bg-neutral-900 dark:bg-white text-white dark:text-black shadow-lg rounded-full px-4 py-3 flex items-center gap-3 cursor-pointer hover:scale-105 transition-transform"
                 onClick={() => setMinimized(false)}
               >
                   {activeCount > 0 ? (
                       <div className="relative">
                          {/* Spinner or icon */}
                          <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse absolute -top-1 -right-1" />
                          <span className="font-bold text-sm">{activeCount}</span>
                       </div>
                   ) : (
                       <CheckCircleIcon />
                   )}
                   <span className="text-sm font-medium pr-1">
                      {activeCount > 0 ? "Uploading..." : "Uploads complete"}
                   </span>
                   <ChevronUp className="h-4 w-4 opacity-50" />
               </motion.div>
           ) : (
               /* Invisible placeholder to keep layout stable if needed, usually null is fine */
               null
           )}
       </div>
    </div>
  );
}

function CheckCircleIcon() {
    return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
    )
}
