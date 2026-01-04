import { getCurrentUserAction } from "@/app/actions/auth";
import { prisma } from "@repo/database";
import { cookies } from "next/headers";
import { cache } from "react";

// Cached data fetching for Studio Layout & Pages
// Deduplicates requests when called in both Layout and Page
export const getStudioBootstrap = cache(async () => {
  const user = await getCurrentUserAction();
  
  if (!user?.id) {
    return { authorized: false, channels: [], activeChannel: null };
  }

  const channels = await prisma.channel.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      handle: true,
      image: true,
      subscriberCount: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const cookieStore = await cookies();
  const activeId = cookieStore.get("active_channel_id")?.value;

  const activeChannel =
    channels.find((c) => c.id === activeId) ?? channels[0] ?? null;

  return {
    authorized: true,
    channels,
    activeChannel,
  };
});

export const getActiveChannelId = cache(async () => {
    const cookieStore = await cookies();
    return cookieStore.get("active_channel_id")?.value;
});
