import { getChannelVideosAction } from "./actions";
import { columns } from "./columns";
import { DataTable } from "./data-table";

export async function VideosTab({ channelId, searchParams }: { channelId: string, searchParams: { [key: string]: string | string[] | undefined } }) {
  const parsedPage = typeof searchParams.page === "string" ? parseInt(searchParams.page) : 1;
  const page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
  
  const parsedLimit = typeof searchParams.limit === "string" ? parseInt(searchParams.limit) : 10;
  const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 10 : parsedLimit;
  
  const result = await getChannelVideosAction(channelId, page, limit);
  // Default structure if API fails
  const data = result.success ? result.data : [];
  const meta = result.success && result.meta ? result.meta : { total: 0, page: 1, limit: 10, pages: 0 };

  return (
    <div className="py-4">
      <DataTable 
        columns={columns} 
        data={data} 
        pageCount={meta.pages}
        initialPage={page}
        pageSize={limit}
      />
    </div>
  );
}
