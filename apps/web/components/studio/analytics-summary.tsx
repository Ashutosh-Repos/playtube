"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, Play, ThumbsUp, MessageSquare, Clock } from "lucide-react";

export function AnalyticsSummary() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Latest Video Performance */}
      <Card className="col-span-1 border-none bg-neutral-100/50 dark:bg-neutral-900/50">
        <CardHeader>
          <CardTitle className="text-lg">Latest Video Performance</CardTitle>
          <CardDescription>First 24 hours comparison</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="relative aspect-video rounded-md overflow-hidden bg-neutral-200 dark:bg-neutral-800 mb-4 group cursor-pointer">
                {/* Placeholder Thumbnail */}
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <Play className="h-8 w-8 opacity-50" />
                </div>
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1 rounded">10:24</div>
            </div>
            
            <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Views</span>
                    <div className="flex items-center gap-2">
                        <span className="font-medium">1.5K</span>
                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                    </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Click-through rate</span>
                    <div className="flex items-center gap-2">
                        <span className="font-medium">12.4%</span>
                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                    </div>
                </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Avg. view duration</span>
                    <div className="flex items-center gap-2">
                        <span className="font-medium">4:30</span>
                        <span className="text-xs text-muted-foreground">(-10%)</span>
                    </div>
                </div>
            </div>
             <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <a href="#" className="text-blue-500 text-sm font-medium hover:underline">Go to Video Analytics</a>
            </div>
        </CardContent>
      </Card>

      {/* Main Channel Analytics */}
      <Card className="col-span-1 md:col-span-1 lg:col-span-1 border-none bg-neutral-100/50 dark:bg-neutral-900/50">
        <CardHeader>
          <CardTitle className="text-lg">Channel Analytics</CardTitle>
          <CardDescription>Current subscribers</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="mb-6">
                <div className="text-4xl font-bold">1,234</div>
                <div className="text-sm text-green-500 flex items-center mt-1">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    +48 in last 28 days
                </div>
           </div>
           
           <div className="space-y-4">
               <div>
                   <h4 className="text-sm font-medium mb-3">Summary (Last 28 days)</h4>
                   <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Views</span>
                            <span className="font-medium">15.2K</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Watch time (hours)</span>
                            <span className="font-medium">480.5</span>
                        </div>
                   </div>
               </div>
           </div>
           
           <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <a href="#" className="text-blue-500 text-sm font-medium hover:underline">Go to Channel Analytics</a>
            </div>
        </CardContent>
      </Card>

      {/* Ideas/News (or Recent Subscribers) */}
      <Card className="col-span-1 border-none bg-neutral-100/50 dark:bg-neutral-900/50">
        <CardHeader>
          <CardTitle className="text-lg">Recent Content</CardTitle>
           <CardDescription>Performance of your last 3 videos</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 items-start p-2 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 rounded-lg transition-colors cursor-pointer">
                      <div className="h-12 w-20 bg-neutral-200 dark:bg-neutral-800 rounded shrink-0" />
                      <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">My Awesome Video Tile {i}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> 120</span>
                              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> 45</span>
                          </div>
                      </div>
                  </div>
              ))}
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
