import { fetchVideoById } from "@/app/actions/video";
import { notFound } from "next/navigation";
import { VideoDetailsForm } from "./video-details-form";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function VideoDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await fetchVideoById(id);

  if (!result.success || !result.data) {
    notFound();
  }

  const video = result.data;

  return (
    <div className="flex flex-col h-full bg-neutral-50/50 dark:bg-black/50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white dark:bg-neutral-900 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/studio/content">
            <Button variant="ghost" size="icon" className="group">
              <ChevronLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold truncate max-w-[400px]" title={video.title}>
              Video details
            </h1>
            <p className="text-xs text-muted-foreground truncate max-w-[400px]">
              {video.title}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
            {/* Save button will be in the form, but sometimes it's nice in header */}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-8">
        <VideoDetailsForm video={video} />
      </div>
    </div>
  );
}
