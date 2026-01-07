"use client";

import { useChannel } from "@/context/channel-context";
import { Button } from "@/components/ui/button";
import { Upload, Radio } from "lucide-react";

export function DashboardHeader() {
  const { currentChannel } = useChannel();

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
      {/* <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
          Channel Dashboard
        </h1>
        {currentChannel && (
            <p className="text-muted-foreground mt-1">
                Welcome back, {currentChannel.name}
            </p>
        )}
      </div> */}
      
      <div className="flex items-center gap-2">
        {/* We can reuse the upload modal logic here if needed, or just link to it */}
        <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Video
        </Button>
        <Button variant="outline" className="gap-2">
            <Radio className="h-4 w-4 text-red-500" />
            Go Live
        </Button>
      </div>
    </div>
  );
}
