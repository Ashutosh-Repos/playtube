import { createEnv } from "./validator";
import { serverSchema } from "./schema";

export const env = createEnv(serverSchema);

export * from "./validator";
export * from "./schema";
