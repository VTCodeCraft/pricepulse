import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

// Module ids are normalised to forward slashes on every OS.
const inPackages = (...names: string[]) => new RegExp(`/node_modules/(${names.join('|')})/`);

export default defineConfig({
  plugins: [react()],
  // Shown under Settings → System. The config uses no Node APIs, so it type-checks without @types/node.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
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
