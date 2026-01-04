import { UploadItem as IUploadItem, useUploadStore } from "@/store/upload-store";
import { Loader2, AlertCircle, CheckCircle, X, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useUploadActions } from "@/hooks/use-upload-actions";

interface Props {
    item: IUploadItem;
}

export function UploadItem({ item }: Props) {
    const { cancelUpload, retryUpload } = useUploadActions();

    const isUploading = item.status === 'uploading';
    const isProcessing = item.status === 'processing';
    const isCompleted = item.status === 'completed';
    const isError = item.status === 'error';

    const percentage = isUploading ? item.progress : item.processingProgress;
    let statusText = "";
    
    if (isError) statusText = item.error || "Upload failed";
    else if (isCompleted) statusText = "Completed";
    else if (isProcessing) statusText = "Processing...";
    else statusText = `Uploading ${Math.round(percentage)}%`;

    return (
        <div className="flex gap-3 items-center p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group">
            {/* Thumbnail / Icon */}
            <div className="relative h-12 w-20 bg-neutral-200 dark:bg-neutral-800 rounded overflow-hidden shrink-0 flex items-center justify-center">
                {item.thumbnailUrl ? (
                   // Use standard img tag if URL is messy to avoid Next.js Image strictness
                   // or if it's a blob/localhost that might not match remotePatterns perfectly yet.
                   // The replace fixes the double-protocol bug from legacy data.
                   <Image 
                     src={item.thumbnailUrl}
                     alt={item.file.name} 
                     fill
                     className="object-cover"
                     sizes="100px"
                     unoptimized
                   />
                ) : (
                   <FileVideo className="h-6 w-6 text-neutral-400" />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-medium truncate pr-2 max-w-[200px]" title={item.file.name}>
                        {item.file.name}
                    </p>
                    
                     {/* Actions */}
                     <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                         {(isUploading || isCompleted) && (
                             <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-neutral-400 hover:text-red-500" 
                                onClick={() => isUploading ? cancelUpload(item.id) : useUploadStore.getState().removeUpload(item.id)}
                             >
                                 <X className="h-3 w-3" />
                             </Button>
                         )}
                         {/* Retry Logic for Error */}
                         {isError && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 text-xs px-2 text-blue-500"
                                onClick={() => retryUpload(item.id)}
                              >
                                  Retry
                              </Button>
                         )}
                         {/* Edit Button - Only show if we have an ID to edit (which we always do) */}
                         <Link href={`/studio/video/${item.id}/edit`} >
                            <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                                Edit
                            </Button>
                         </Link>
                    </div>
                </div>

                {/* Progress Text & Icon */}
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-neutral-500">
                        <span>{statusText}</span>
                        {isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
                        {isError && <AlertCircle className="h-3 w-3 text-red-500" />}
                        {isCompleted && <CheckCircle className="h-3 w-3 text-green-500" />}
                    </div>
                </div>
                 
                {/* Progress Bar */}
                {(isUploading || isProcessing) && (
                     <div className="h-1 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full mt-1 overflow-hidden">
                        <div 
                           className="h-full bg-blue-600 transition-all duration-200 ease-out"
                           style={{ width: `${percentage}%` }}
                        />
                     </div>
                )}
            </div>
        </div>
    );
}
