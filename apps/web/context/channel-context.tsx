"use client";

import React, { createContext, useContext, useState, useTransition } from "react";
import { switchChannelSession } from "@/app/studio/actions";
import { useRouter } from "next/navigation";

interface Channel {
  id: string;
  name: string;
  handle: string;
  image: string | null;
  subscriberCount: number;
}

interface ChannelContextType {
  channels: Channel[];
  currentChannel: Channel | null;
  isLoading: boolean;
  switchChannel: (channelId: string) => Promise<void>;
}

const ChannelContext = createContext<ChannelContextType | undefined>(undefined);

interface ChannelProviderProps {
  children: React.ReactNode;
  initialChannels: Channel[];
  initialChannel: Channel | null;
}

export function ChannelProvider({ 
  children,
  initialChannels,
  initialChannel, 
}: ChannelProviderProps) {
  const [channels] = useState<Channel[]>(initialChannels);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(initialChannel);
  // isLoading is effectively always false now because data is pre-loaded on server
  const [isLoading] = useState(false); 
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const switchChannel = async (channelId: string) => {
    const target = channels.find((c) => c.id === channelId);
    if (!target) return;

    // Optimistic update
    setCurrentChannel(target);

    startTransition(async () => {
        const result = await switchChannelSession(channelId);
        if (!result.success) {
            console.error(result.error || "Failed to switch channel");
            // Optional: Revert state if needed, though rarely happens if logic is sound
        } else {
             // Success - Sync server state so subsequent server requests use the new cookie
             router.refresh(); 
        }
    });
  };

  return (
    <ChannelContext.Provider value={{ channels, currentChannel, isLoading, switchChannel }}>
      {children}
    </ChannelContext.Provider>
  );
}

export function useChannel() {
  const context = useContext(ChannelContext);
  if (context === undefined) {
    throw new Error("useChannel must be used within a ChannelProvider");
  }
  return context;
}
