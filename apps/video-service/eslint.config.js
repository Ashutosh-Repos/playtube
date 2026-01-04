import { nodeServiceConfig } from "@repo/eslint-config/node-service";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nodeServiceConfig,
  {
      rules: {
          // Rule overrides for video-service specifically
          "no-console": "off", // We use console logs for now
      }
  }
];
