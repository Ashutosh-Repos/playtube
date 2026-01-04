import { z } from "zod";
export const uploadVideoSchema = z.object({
  fileName: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9._-]+$/, "Filename can only contain alphanumeric characters, dots, underscores, and dashes"),
  channelId: z.string().cuid({ message: "Invalid Channel ID" }),
});