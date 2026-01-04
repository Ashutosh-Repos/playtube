"use client";

import { Eye, MessageSquare, ThumbsUp, MoreVertical, Pen } from "lucide-react";
import { Button } from "@/components/ui/button";

const recentVideos = [
  {
    id: 1,
    title: "Understanding Server Actions in Next.js 14",
    thumbnail: "", 
    visibility: "Public",
    date: "Oct 24, 2024",
    views: "1.2K",
    comments: 45,
    likes: "98%",
  },
  {
    id: 2,
    title: "Building a YouTube Clone from Scratch",
    thumbnail: "",
    visibility: "Public",
    date: "Oct 20, 2024",
    views: "8.5K",
    comments: 120,
    likes: "95%",
  },
  {
    id: 3,
    title: "MinIO vs S3: Which one to choose?",
    thumbnail: "",
    visibility: "Unlisted",
    date: "Oct 15, 2024",
    views: "300",
    comments: 12,
    likes: "100%",
  },
   {
    id: 4,
    title: "My Setup Tour 2024",
    thumbnail: "",
    visibility: "Public",
    date: "Oct 01, 2024",
    views: "25K",
    comments: 800,
    likes: "99%",
  },
];

export function RecentContent() {
  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold mb-4">Recent Uploads</h3>
      <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                <th className="px-6 py-3 font-medium">Video</th>
                <th className="px-6 py-3 font-medium">Visibility</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Views</th>
                <th className="px-6 py-3 font-medium">Comments</th>
                <th className="px-6 py-3 font-medium">Likes (vs Dislikes)</th>
              </tr>
            </thead>
            <tbody>
              {recentVideos.map((video) => (
                <tr key={video.id} className="border-b border-neutral-200 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-4">
                        <div className="h-16 w-28 bg-neutral-200 dark:bg-neutral-800 rounded shrink-0 relative group">
                            {/* Hover Actions Overlay */}
                             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:text-white hover:bg-white/20">
                                    <Pen className="h-3 w-3" />
                                </Button>
                             </div>
                        </div>
                        <div className="max-w-xs">
                            <p className="font-medium truncate" title={video.title}>{video.title}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">No description available.</p>
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                          {video.visibility === "Public" ? (
                              <Eye className="h-4 w-4 text-green-500" />
                          ) : (
                              <Eye className="h-4 w-4 text-neutral-400" />
                          )}
                          <span>{video.visibility}</span>
                      </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {video.date}
                    <div className="text-xs">Published</div>
                  </td>
                  <td className="px-6 py-4">{video.views}</td>
                  <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3 text-muted-foreground" />
                          {video.comments}
                      </div>
                  </td>
                  <td className="px-6 py-4">
                       <div className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3 text-muted-foreground" />
                          {video.likes}
                      </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer text-center text-sm font-medium">
            Go to Channel Content
        </div>
      </div>
    </div>
  );
}
