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
        <div className="w-full overflow-hidden relative h-full rounded-2xl p-6 text-xl md:text-4xl font-bold text-white bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800">
          <p className="text-2xl font-bold mb-4 text-black dark:text-white">Channel Videos</p>
          <Suspense fallback={<VideosTableSkeleton />}>
            <VideosTab channelId={activeChannel.id} searchParams={resolvedSearchParams} />
          </Suspense>
        </div>
      ),
    },
    {
      title: "Playlists",
      value: "playlists",
      content: (
        <div className="w-full overflow-hidden relative h-full rounded-2xl p-6 text-xl md:text-4xl font-bold text-white bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800">
           <p className="text-2xl font-bold mb-4 text-black dark:text-white">Channel Playlists</p>
           <Suspense fallback={<PlaylistsTableSkeleton />}>
              <PlaylistsTab channelId={activeChannel.id} searchParams={resolvedSearchParams} />
           </Suspense>
        </div>
      ),
    },
  ];

  const activeTab = typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : "videos";

  return (
    <div className="h-80 md:h-160 perspective-[1000px] relative b flex flex-col max-w-5xl mx-auto w-full items-start justify-start my-10 px-4">
      <h1 className="text-3xl font-bold mb-8 text-black dark:text-white">Channel Content</h1>
      <Tabs tabs={tabs} activeTab={activeTab} />
    </div>
  );
}