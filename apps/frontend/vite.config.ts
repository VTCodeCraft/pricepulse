import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Module ids are normalised to forward slashes on every OS.
const inPackages = (...names: string[]) => new RegExp(`/node_modules/(${names.join('|')})/`);

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Libraries change far less often than the app, so they get their own long-cached chunks.
        codeSplitting: {
          groups: [
            { name: 'react', test: inPackages('react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler') },
            { name: 'mui', test: inPackages('@mui', '@emotion') },
            { name: 'vendor', test: /\/node_modules\// },
          ],
        },
      },
    },
  },
});
