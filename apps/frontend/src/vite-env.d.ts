/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

// Set at build time in vite.config.ts.
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string | null;
