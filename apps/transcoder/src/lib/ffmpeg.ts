import ffmpeg from "fluent-ffmpeg";
import * as path from "path";
import * as fs from "fs";

export interface VideoMetadata {
  duration: number; // Seconds
  width: number;
  height: number;
  format: string;
  fps: number;
  hasAudio: boolean;
  audioChannels?: number;
}

// ...

/**
 * Probe video metadata
 */
export function probeVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);

      const format = metadata.format;
      const videoStream = metadata.streams.find((s) => s.codec_type === "video");
      const audioStream = metadata.streams.find((s) => s.codec_type === "audio");

      if (!videoStream) return reject(new Error("No video stream found"));

      // Parse FPS (e.g. "30/1" or "30")
      let fps = 30;
      if (videoStream.r_frame_rate) {
          const parts = videoStream.r_frame_rate.split("/");
          if (parts.length === 2) {
              const num = parseInt(parts[0] as string, 10);
              const den = parseInt(parts[1] as string, 10);
              if (!isNaN(num) && !isNaN(den) && den !== 0) {
                  fps = num / den;
              }
          } else {
              const val = parseInt(videoStream.r_frame_rate, 10);
              if (!isNaN(val)) {
                  fps = val;
              }
          }
      }

      resolve({
        duration: format.duration || 0,
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        format: format.format_name || "unknown",
        fps: Math.round(fps),
        hasAudio: !!audioStream,
        audioChannels: audioStream ? audioStream.channels : undefined
      });
    });
  });
}

/**
 * Generate Thumbnails
 * Generates 10 thumbnails evenly spaced
 */
export function generateThumbnails(inputPath: string, outputDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const fileNames: string[] = [];
    
    ffmpeg(inputPath)
      .screenshots({
        count: 5,
        folder: outputDir,
        filename: "thumb-%i.jpg",
        size: "1280x720",
      })
      .on("filenames", (filenames) => {
        fileNames.push(...filenames);
      })
      .on("end", () => {
        resolve(fileNames);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

/**
 * Transcode a Single Resolution to HLS
 * Used by Parallel Workers
 */
export function transcodeResolution(
  inputPath: string,
  outputDir: string,
  resolution: { width: number; height: number; name: string },
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cleanName = resolution.name.replace("p", ""); // 1080
    
    // Determine Profile & Audio Bitrate based on Resolution
    let profile = "main";
    let audioBitrate = "128k";
    
    if (resolution.height >= 1080) {
        profile = "high";
        audioBitrate = "192k";
    }

    ffmpeg(inputPath)
      .outputOptions([
        `-profile:v ${profile}`, // high for HD, main for SD
        "-c:v libx264",
        "-crf 23", // Constant Rate Factor (Quality)
        "-preset veryfast", // Balance speed/quality (was fast)
        "-sc_threshold 0", // Better Keyframes
        "-g 48", // Keyframe interval (GOP) ~ 2 secs at 24fps
        "-keyint_min 48",
        "-hls_time 4", // 4 second segments (Industry standard is usually 4-6)
        "-hls_playlist_type vod",
        `-hls_segment_filename ${path.join(outputDir, `seg_${cleanName}_%03d.ts`)}`,
      ])
      .videoFilters([
         `scale=w=${resolution.width}:h=${resolution.height}:force_original_aspect_ratio=decrease`,
         "pad=ceil(iw/2)*2:ceil(ih/2)*2" // Ensure even dimensions
      ])
      // --- Audio Settings ---
      .audioCodec("aac")
      .audioBitrate(audioBitrate)
      .audioChannels(2) // Stereo
      // ----------------------
      .output(`${path.join(outputDir, `playlist.m3u8`)}`)
      .on("start", (commandLine) => {
        console.log(`[Pipeline] 🎥 FFmpeg Start (${resolution.name}): ${commandLine}`);
      })
      .on("progress", (progress) => {
         if (progress.percent && onProgress) {
             onProgress(Math.round(progress.percent));
         }
      })
      .on("end", () => resolve("playlist.m3u8"))
      .on("error", (err) => reject(err))
      .run();
  });
}

/**
 * Generate Preview Sprite (VTT + Image)
 * Creates a grid of thumbnails for scrubbing.
 * Uses "Adaptive Interval" to fit the video into a 10x10 grid (100 thumbnails max).
 */
export function generatePreviewSprite(
    inputPath: string, 
    outputDir: string,
    duration: number,
    width = 160,
    height = 90
): Promise<string> {
    return new Promise((resolve, reject) => {
        const outputImage = path.join(outputDir, "sprite.jpg");
        
        // Safety Guard
        if (!duration || isNaN(duration) || duration <= 0) {
            console.warn(`⚠️ Invalid duration for sprite generation: ${duration}. Defaulting to 1s.`);
            duration = 1; 
        }

        // Calculate interval to fit 100 images (10x10)
        // If Duration is 100s, interval = 1s
        // If Duration is 1000s, interval = 10s
        // Minimum interval 1s
        const maxImages = 100;
        let interval = Math.ceil(duration / maxImages);
        if (interval < 1) interval = 1;
        
        console.log(`🎨 Sprite Strategy: 10x10 grid, interval ${interval}s for duration ${duration}s`);
        
        ffmpeg(inputPath)
            .inputOptions(["-y"]) // Overwrite
            .complexFilter([
                `select='not(mod(t,${interval}))'`,
                `scale=${width}:${height}`,
                "tile=10x10" 
            ].join(",")) // Join with commas for linear chain
            .frames(1)
            .output(outputImage)
            .on("start", (cmd) => console.log(`[Pipeline] 📷 Sprite Gen Start: ${cmd}`))
            .on("end", () => resolve("sprite.jpg"))
            .on("error", (err) => reject(err))
            .run();
    });
}

/**
 * Create Master Playlist
 * Combines variant playlists into a master.m3u8
 */
export function createMasterPlaylist(
  outputDir: string,
  variants: Array<{ bandwidth: number; width: number; height: number; name: string }>
): Promise<string> {
  return new Promise((resolve, reject) => {
    let content = "#EXTM3U\n#EXT-X-VERSION:3\n";

    variants.forEach((v) => {
       content += `#EXT-X-STREAM-INF:BANDWIDTH=${v.bandwidth},RESOLUTION=${v.width}x${v.height}\n`;
       content += `${v.name}/playlist.m3u8\n`;
    });

    const masterPath = path.join(outputDir, "master.m3u8");
    fs.writeFile(masterPath, content, (err) => {
      if (err) reject(err);
      else resolve("master.m3u8");
    });
  });
}
