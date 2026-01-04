"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 p-8 text-center bg-background text-foreground">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex max-w-md flex-col items-center gap-4"
      >
        <div className="rounded-full bg-neutral-100 p-4 dark:bg-neutral-800">
          <AlertTriangle className="h-10 w-10 text-orange-500" />
        </div>
        
        <h2 className="text-2xl font-bold tracking-tight">
          System Error
        </h2>
        
        <p className="text-muted-foreground">
          We encountered an unexpected issue. Our team has been notified.
        </p>

        {error.digest && (
          <div className="rounded-md bg-neutral-100 px-2 py-1 dark:bg-neutral-900">
            <code className="text-xs font-mono text-neutral-500">
              {error.digest}
            </code>
          </div>
        )}

        <Button onClick={() => reset()} className="gap-2 mt-4">
          <RotateCcw className="h-4 w-4" />
          Reload Application
        </Button>
      </motion.div>
    </div>
  );
}
