import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Module ids are normalised to forward slashes on every OS.
const inPackages = (...names: string[]) => new RegExp(`/node_modules/(${names.join('|')})/`);

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react()],
  // Shown under Settings → System. Vercel sets VERCEL_GIT_COMMIT_SHA during its builds; local builds have none.
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null),
  },
  build: {
    rolldownOptions: {
      output: {
        // The libraries every page needs get their own long-cached chunks. Everything else (the data grid, charts)
        // stays with the pages that use it, so it only loads when one of them does.
        codeSplitting: {
          groups: [
            { name: 'react', test: inPackages('react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler') },
            { name: 'query', test: inPackages('@tanstack/react-query', '@tanstack/query-core') },
            {
              name: 'mui',
              test: inPackages('@mui/material', '@mui/system', '@mui/styled-engine', '@mui/utils', '@mui/private-theming', '@mui/icons-material', '@emotion'),
            },
            // Only the pages with tables import it, so this chunk is still loaded on demand.
            { name: 'data-grid', test: inPackages('@mui/x-data-grid', '@mui/x-internals', '@mui/x-virtualizer') },
          ],
        },
      },
    },
  },
});
