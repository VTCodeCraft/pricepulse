import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Module ids are normalised to forward slashes on every OS.
const inPackages = (...names: string[]) => new RegExp(`/node_modules/(${names.join('|')})/`);

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // The libraries every page needs get their own long-cached chunks. Everything else (the data grid, charts)
        // stays with the pages that use it, so it only loads when one of them does.
        codeSplitting: {
          groups: [
            { name: 'react', test: inPackages('react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler') },
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
