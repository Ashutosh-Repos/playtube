import { fetchVideoById } from "@/app/actions/video";
import { toast } from "sonner";
import VideoEditForm from "./video-edit-form";
export default async function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
    const { id } = await params;
    const result = await fetchVideoById(id);
  
    const video = result.success ? result.data : null;
    if (!video) {
        toast.error("Video not found");
        return <div>Video not found</div>;
    }
    return <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex gap-4 items-start">
      <img
        src={video.thumbnailUrl || undefined}
        className="w-48 aspect-video rounded-lg object-cover"
      />

      <div className="flex-1">
        <h1 className="text-xl font-semibold line-clamp-2">
          {video.title}
        </h1>

        <p className="text-sm text-muted-foreground mt-1">
          {video.channelName} • {video.visibility}
        </p>
      </div>
    </div>
      <EditVideoForm video={video} />
    </div>;
}

// function VideoPreviewHeader({ video }) {
//   return (
    
//   );
// }

function EditVideoForm({ video }: { video: any }) {
  return (
    <div className="rounded-lg border p-6 space-y-6">
      <VideoEditForm video={video} />
    </div>
  );
}



// function VideoStats({ video }: { video: any }) {
//   return (
//     <div className="rounded-lg border p-4 space-y-4 text-sm">
//       <div>
//         <p className="text-muted-foreground">Status</p>
//         <p className="font-medium">{video.processingStatus}</p>
//       </div>

//       <div>
//         <p className="text-muted-foreground">Visibility</p>
//         <p className="font-medium">{video.visibility}</p>
//       </div>

//       <div>
//         <p className="text-muted-foreground">Duration</p>
//         <p className="font-medium">{video.duration}s</p>
//       </div>

//       <div>
//         <p className="text-muted-foreground">Resolution</p>
//         <p className="font-medium">
//           {video.width} × {video.height}
//         </p>
//       </div>

//       <div>
//         <p className="text-muted-foreground">FPS</p>
//         <p className="font-medium">{video.fps}</p>
//       </div>

//       <div>
//         <p className="text-muted-foreground">Views</p>
//         <p className="font-medium">{video.viewCount}</p>
//       </div>
//     </div>
//   );
// }

// function ThumbnailPicker({ video }: { video: any }) {
//   return (
//     <div className="rounded-lg border p-6">
//       <h2 className="font-medium mb-4">Thumbnails</h2>

//       <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
//         {video.thumbnailOptions.map((url: string) => (
//           <button
//             key={url}
//             className="group rounded-md overflow-hidden border hover:ring-2 ring-primary transition"
//           >
//             <img
//               src={url}
//               className="aspect-video object-cover"
//             />
//           </button>
//         ))}
//       </div>
//     </div>
//   );
// }
