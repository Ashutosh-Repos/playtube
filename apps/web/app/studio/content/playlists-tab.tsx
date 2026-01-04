import { PlaylistsTable } from "./playlists-table";
import { getChannelPlaylistsAction } from "./actions";
import { columns, Playlist } from "./playlists-columns";

export async function PlaylistsTab({ 
    channelId, 
    searchParams 
}: { 
    channelId: string;
    searchParams?: { [key: string]: string | string[] | undefined };
}) {
    // ... logic remains same ...
    const result = await getChannelPlaylistsAction(channelId);
    const data = result.success ? (result.data as any) as Playlist[] : [];

    const pageString = searchParams?.page;
    const limitString = searchParams?.limit;
    
    const parsedPage = typeof pageString === "string" ? parseInt(pageString) : 1;
    const page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

    const parsedLimit = typeof limitString === "string" ? parseInt(limitString) : 10;
    const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 10 : parsedLimit;

  return (
    <div className="py-4">
      <PlaylistsTable 
        columns={columns} 
        data={data} 
        initialPage={page}
        pageSize={limit}
      />
    </div>
  );
}
