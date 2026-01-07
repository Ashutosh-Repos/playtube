import { getStudioBootstrap } from "../data";
import { Tabs } from "@/components/ui/tabs";
import { VideosTab } from "./videos-tab";
import { PlaylistsTab } from "./playlists-tab";
import { Suspense } from "react";
import { VideosTableSkeleton, PlaylistsTableSkeleton } from "@/components/studio/skeletons";

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { activeChannel } = await getStudioBootstrap();
  const resolvedSearchParams = await searchParams;

  if (!activeChannel) {
    return <div>No active channel found.</div>;
  }

  const tabs = [
    {
      title: "Videos",
      value: "videos",
      content: (
          <Suspense fallback={<VideosTableSkeleton />}>
            <VideosTab channelId={activeChannel.id} searchParams={resolvedSearchParams} />
          </Suspense>
      ),
    },
    {
      title: "Playlists",
      value: "playlists",
      content: (
          <Suspense fallback={<PlaylistsTableSkeleton />}>
            <PlaylistsTab channelId={activeChannel.id} searchParams={resolvedSearchParams} />
          </Suspense>
      ),
    },
  ];

  const activeTab = typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : "videos";

  return (
    <div className="perspective-[1000px] w-full h-full overflow-hidden">
      <Tabs tabs={tabs} activeTab={activeTab} />
    </div>
  );
}