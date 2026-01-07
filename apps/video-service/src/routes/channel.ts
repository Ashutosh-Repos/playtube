import { Router, Request, Response } from "express";
import { prisma, channelSelect, ChannelPayload } from "@repo/database";
import { requireAuth, AuthUser, ChannelDetails } from "@repo/shared";
import { publishMessage, EXCHANGES, EVENTS } from "@repo/events";
import { z } from "zod";

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

const router = Router();

// -----------------------------------------------------------------------------
// Validation Schemas
// -----------------------------------------------------------------------------

// Handle regex: Alphanumeric, underscores, periods. No spaces.
const handleRegex = /^[a-zA-Z0-9_.]+$/;

const createChannelSchema = z.object({
  name: z.string().min(1).max(50),
  handle: z.string().min(3).max(30).regex(handleRegex, "Handle can only contain letters, numbers, underscores, and periods."),
  description: z.string().max(5000).optional(),
  image: z.string().url().optional().or(z.literal("")),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  links: z.array(z.object({
    title: z.string().max(100),
    url: z.string().url().max(2000),
  })).max(20).optional(),
});

const updateChannelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(5000).optional(),
  image: z.string().url().optional().or(z.literal("")),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  links: z.array(z.object({
    title: z.string().max(100),
    url: z.string().url().max(2000),
  })).max(20).optional(),
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const transformChannel = (channel: ChannelPayload): ChannelDetails => ({
    ...channel,
    createdAt: channel.createdAt.toISOString(),
});

/**
 * GET /check-handle/:handle
 * Check if a handle is available.
 */
router.get("/check-handle/:handle", async (req: Request, res: Response) => {
  try {
    const { handle } = req.params as { handle: string };
    
    if (!handleRegex.test(handle)) {
        return res.status(400).json({ success: false, error: { code: "INVALID_FORMAT", message: "Invalid handle format" } });
    }

    const existing = await prisma.channel.findUnique({
      where: { handle },
    });

    res.json({ success: true, available: !existing });
  } catch (error) {
    console.error("Check handle error:", error);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to check handle" } });
  }
});

/**
 * POST /
 * Create a new channel.
 */
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const result = createChannelSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: result.error.errors[0]?.message },
      });
    }

    const { name, handle, description, image, contactEmail, bannerUrl, links } = result.data;

    // Check handle uniqueness
    const existing = await prisma.channel.findUnique({ where: { handle } });
    if (existing) {
      return res.status(409).json({ success: false, error: { code: "HANDLE_TAKEN", message: "Handle is already taken" } });
    }

    const channel = await prisma.channel.create({
      data: {
        userId,
        name,
        handle,
        description,
        image: image || null,
        bannerUrl: bannerUrl || null,
        contactEmail: contactEmail || null,
        links: links ?? undefined,
      },
      select: channelSelect,
    }) as ChannelPayload;

    await publishMessage(EXCHANGES.CHANNEL, EVENTS.CHANNEL_CREATED, {
      channelId: channel.id,
      userId,
      name: channel.name,
      handle: channel.handle,
      image: channel.image || undefined, // undefined for serialization if needed, or null is fine for JSON? specific schema says optional/nullable
    });

    res.status(201).json({ success: true, data: transformChannel(channel) });
  } catch (error) {
    console.error("Create channel error:", error);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create channel" } });
  }
});

/**
 * GET /:id
 * Get channel details (public view).
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const channel = await prisma.channel.findUnique({
      where: { id },
      select: channelSelect,
    }) as ChannelPayload;

    if (!channel || channel.deletedAt) {
      return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Channel not found" } });
    }

    res.json({ success: true, data: transformChannel(channel) });
  } catch (error) {
    console.error("Get channel error:", error);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch channel" } });
  }
});

/**
 * PATCH /:id
 * Update channel details.
 */
router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.id;
    const { id } = req.params as { id: string };

    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel || channel.deletedAt) {
        return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Channel not found" } });
    }

    if (channel.userId !== userId) {
      return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not authorized" } });
    }

    const result = updateChannelSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: result.error.errors[0]?.message },
      });
    }

    // Explicitly exclude restricted fields (status, isVerified, valid flags)
    // Only include fields that were explicitly provided in the request
    const { name, description, image, bannerUrl, contactEmail, links } = result.data;

    // Build update data only with provided fields
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image || null;
    if (bannerUrl !== undefined) updateData.bannerUrl = bannerUrl || null;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail || null;
    if (links !== undefined) updateData.links = links;

    const updated = await prisma.channel.update({
      where: { id },
      data: updateData,
      select: channelSelect,
    }) as ChannelPayload;

    // Identify what changed for the event (naive approach: just send what we got)
    // The schema expects "updates" array
    const updates: string[] = [];
    if (name) updates.push("name");
    if (description) updates.push("description");
    if (image !== undefined) updates.push("image");
    if (bannerUrl !== undefined) updates.push("bannerUrl");
    if (contactEmail !== undefined) updates.push("contactEmail");
    if (links !== undefined) updates.push("links");

    await publishMessage(EXCHANGES.CHANNEL, EVENTS.CHANNEL_UPDATED, {
      channelId: updated.id,
      userId,
      updates,
      name: updated.name,
      handle: updated.handle,
      image: updated.image || undefined,
    });

    res.json({ success: true, data: transformChannel(updated) });
  } catch (error) {
    console.error("Update channel error:", error);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update channel" } });
  }
});

/**
 * DELETE /:id
 * Soft delete channel.
 */
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthenticatedRequest).user!.id;
      const { id } = req.params as { id: string };
  
      const channel = await prisma.channel.findUnique({ where: { id } });
      if (!channel || channel.deletedAt) {
          return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Channel not found" } });
      }
  
      if (channel.userId !== userId) {
        return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Not authorized" } });
      }
  
      // Soft delete Channel AND Videos
      // Note: We do not hard delete Playlists as they don't have deletedAt, but they will be effectively hidden if we check channel.deletedAt in queries.
      // Ideally we would add deletedAt to Playlist or hard delete them, but preserving data is key for Soft Delete.
      
      await prisma.$transaction([
        prisma.channel.update({
            where: { id },
            data: { deletedAt: new Date() }
        }),
        prisma.video.updateMany({
            where: { channelId: id },
            data: { deletedAt: new Date() }
        })
      ]);

      await publishMessage(EXCHANGES.CHANNEL, EVENTS.CHANNEL_DELETED, {
          channelId: id,
          userId,
      });
  
      res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      console.error("Delete channel error:", error);
      res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete channel" } });
    }
  });

export default router;
