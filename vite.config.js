import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Note: editing this file makes the dev server restart itself — useful when
// the file watcher dies on external drives and HMR stops picking up changes.

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'react-vendor';
          if (id.includes('@supabase')) return 'supabase-vendor';
          if (id.includes('lucide-react')) return 'icons-vendor';
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify')) return undefined;
          return undefined;
        },
      },
    },
  },
});
