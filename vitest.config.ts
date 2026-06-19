import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@notify-time": path.resolve(
        __dirname,
        "./supabase/functions/shared/notifyRequestTime.ts"
      ),
      "@inbound-verification": path.resolve(
        __dirname,
        "./supabase/functions/shared/inboundEmailVerification.ts"
      ),
    },
  },
});
