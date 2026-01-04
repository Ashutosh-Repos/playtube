import { z } from "zod";
import * as Schemas from "../schemas";

export type UserEmailVerificationTokenCreatedEvent = z.infer<typeof Schemas.userEmailVerificationTokenCreatedSchema>;
export type UserPasswordResetTokenCreatedEvent = z.infer<typeof Schemas.userPasswordResetTokenCreatedSchema>;


import { EVENTS } from "../constants";

export type EventPayloads = {
  [EVENTS.USER_EMAIL_VERIFICATION_TOKEN_CREATED]: UserEmailVerificationTokenCreatedEvent;
  [EVENTS.USER_PASSWORD_RESET_TOKEN_CREATED]: UserPasswordResetTokenCreatedEvent;
  [EVENTS.PLAYLIST_CREATED]: z.infer<typeof Schemas.playlistCreatedSchema>;
  [EVENTS.PLAYLIST_UPDATED]: z.infer<typeof Schemas.playlistUpdatedSchema>;
  [EVENTS.PLAYLIST_DELETED]: z.infer<typeof Schemas.playlistDeletedSchema>;
  [EVENTS.PLAYLIST_VIDEO_ADDED]: z.infer<typeof Schemas.playlistVideoAddedSchema>;
  [EVENTS.PLAYLIST_VIDEO_REMOVED]: z.infer<typeof Schemas.playlistVideoRemovedSchema>;
  [EVENTS.CHANNEL_CREATED]: z.infer<typeof Schemas.channelCreatedSchema>;
  [EVENTS.CHANNEL_UPDATED]: z.infer<typeof Schemas.channelUpdatedSchema>;
  [EVENTS.CHANNEL_DELETED]: z.infer<typeof Schemas.channelDeletedSchema>;
  // Fallback for others to any or defined type
  // For strictness, all events should be mapped.
};
