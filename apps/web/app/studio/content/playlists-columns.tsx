"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreVertical, ListVideo } from "lucide-react";
import { Button } from "@/components/ui/button";

// Define Playlist type
export type Playlist = {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  videoCount: number;
  updatedAt: string;
};

// Define Playlist Columns
export const columns: ColumnDef<Playlist>[] = [
  {
    accessorKey: "title",
    header: "Playlist",
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-4">
            <div className="h-16 w-28 bg-neutral-200 dark:bg-neutral-800 rounded flex items-center justify-center shrink-0">
                <ListVideo className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
                <p className="font-medium">{row.getValue("title")}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{row.original.description || "No description"}</p>
            </div>
        </div>
      );
    },
  },
  {
    accessorKey: "visibility",
    header: "Visibility",
    cell: ({ row }) => <span className="capitalize">{row.getValue("visibility") as string}</span>,
  },
  {
    accessorKey: "updatedAt",
    header: "Last Updated",
     cell: ({ row }) => {
        const date = new Date(row.getValue("updatedAt"));
        return date.toLocaleDateString();
    }
  },
   {
    accessorKey: "videoCount",
    header: "Video Count",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return (
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreVertical className="h-4 w-4" />
        </Button>
      )
    },
  },
];
