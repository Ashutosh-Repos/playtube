"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Eye, EyeOff, ThumbsUp, MessageSquare, MoreVertical, Pen } from "lucide-react";
import Image from "next/image";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResumeButton } from "./resume-button";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Start by defining the shape of our data.
export type Video = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  visibility: string;
  processingStatus: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  publishedAt: string | null;
};

export const columns: ColumnDef<Video>[] = [
  {
    accessorKey: "title",
    header: "Video",
    cell: ({ row }) => {
      const video = row.original;
      return (
        <div className="flex items-start gap-4 min-w-[300px]">
          <div className="h-16 w-28 bg-neutral-200 dark:bg-neutral-800 rounded shrink-0 relative overflow-hidden group">
            {video.thumbnailUrl ? (
              <Image
                src={video.thumbnailUrl}
                alt={video.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                unoptimized
              />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-xs text-muted-foreground">
                    No Thumb
                </div>
            )}
            {/* Hover Actions Overlay */}
             <Link href={`/studio/content/video/${video.id}`} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                 {/* <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:text-white hover:bg-white/20 border border-red-400"> */}
                    <Pen className="h-3 w-3" />
                 {/* </Button> */}
             </Link>
          </div>
          <div className="flex flex-col gap-1 max-w-[200px]">
            <p className="font-medium truncate" title={video.title}>
              {video.title}
            </p>
             <p className="text-xs text-muted-foreground line-clamp-1 flex items-center gap-2">
                {video.processingStatus !== "COMPLETED" ? (
                    <>
                        <span className={cn(
                            "capitalize",
                            video.processingStatus === "FAILED" ? "text-red-500" : "text-yellow-500"
                        )}>
                            {video.processingStatus.toLowerCase()}
                        </span>
                        {/* Resume Action for Interrupted/Failed Uploads */}
                        {(video.processingStatus === "UPLOADING" || video.processingStatus === "FAILED") && (
                            <div onClick={(e) => e.stopPropagation()}>
                                <ResumeButton videoId={video.id} fileName={video.title} />
                            </div>
                        )}
                    </>
                ) : (
                    "Description..." // We don't have description in list view yet
                )}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "visibility",
    header: "Visibility",
    cell: ({ row }) => {
      const visibility = row.getValue("visibility") as string;
      return (
        <div className="flex items-center gap-2">
            {visibility === "PUBLIC" ? (
                 <Eye className="h-4 w-4 text-green-500" />
            ) : (
                 <EyeOff className="h-4 w-4 text-neutral-400" />
            )}
             <span className="capitalize text-sm">{visibility.toLowerCase()}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "publishedAt",
    header: "Date",
    cell: ({ row }) => {
        const dateStr = row.original.publishedAt || row.original.createdAt;
        return (
            <div className="text-sm">
                <div>{dateStr ? format(new Date(dateStr), "MMM d, yyyy") : "Draft"}</div>
                <div className="text-xs text-muted-foreground">{row.original.publishedAt ? "Published" : "Uploaded"}</div>
            </div>
        )
    }
  },
  {
    accessorKey: "viewCount",
    header: "Views",
    cell: ({ row }) => {
        return <div className="text-sm">{row.getValue("viewCount")}</div>
    }
  },
  {
    accessorKey: "commentCount",
    header: "Comments",
    cell: ({ row }) => {
        return (
             <div className="flex items-center gap-1 text-sm">
                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                {row.getValue("commentCount")}
            </div>
        )
    }
  },
   {
    accessorKey: "likeCount",
    header: "Likes",
    cell: ({ row }) => {
        return (
            <div className="flex items-center gap-1 text-sm">
                <ThumbsUp className="h-3 w-3 text-muted-foreground" />
                {row.getValue("likeCount")}
            </div>
        )
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const video = row.original;
 
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(video.id)}
            >
              Copy Video ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Edit details</DropdownMenuItem>
            <DropdownMenuItem>Get shareable link</DropdownMenuItem>
            <DropdownMenuItem className="text-red-500">Delete forever</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
];
