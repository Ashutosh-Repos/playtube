import { validateSession as validateSessionOriginal } from "@/lib/auth/session";
import { cache } from "react";

/**
 * Server Component safe session validation.
 * Cached per request lifetime to allow calling in Layout + Page without double DB hit.
 */
export const validateSession = cache(async () => {
  return await validateSessionOriginal();
});
