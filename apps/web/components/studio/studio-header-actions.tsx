"use client";

import { ChannelSwitcher } from "@/app/studio/channel-switcher";
import { FileSelect } from "./upload/file-select";

export function StudioHeaderActions() {
  return (
    <div className="flex items-center gap-2">
      {/* Upload Video Button */}
      <FileSelect variant="secondary" className="rounded-full">
         <span className="hidden sm:inline font-medium">Create</span>
      </FileSelect>

      {/* Channel Switcher */}
      <ChannelSwitcher />
    </div>
  );
}
