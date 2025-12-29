import { z } from "zod";
import * as Schemas from "../schemas";

export type UserEmailVerificationTokenCreatedEvent = z.infer<typeof Schemas.userEmailVerificationTokenCreatedSchema>;
export type UserPasswordResetTokenCreatedEvent = z.infer<typeof Schemas.userPasswordResetTokenCreatedSchema>;


import { EVENTS } from "../constants";

export type EventPayloads = {
  [EVENTS.USER_EMAIL_VERIFICATION_TOKEN_CREATED]: UserEmailVerificationTokenCreatedEvent;
  [EVENTS.USER_PASSWORD_RESET_TOKEN_CREATED]: UserPasswordResetTokenCreatedEvent;
  // Fallback for others to any or defined type
  // For strictness, all events should be mapped.
};
