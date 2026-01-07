"use client";

import { useUploadSync } from "@/hooks/use-upload-sync";

export function GlobalListeners() {
  useUploadSync();
  return null;
}
