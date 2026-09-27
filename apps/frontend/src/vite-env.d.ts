/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  // Exposed by Vercel to Vite builds (system environment variables); absent elsewhere.
  readonly VITE_VERCEL_GIT_COMMIT_SHA?: string;
}

// Set at build time in vite.config.ts.
declare const __APP_VERSION__: string;
