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
          if (/src\/pages\/Admin(Dashboard|Support|Operations|Finance|Analytics)\.jsx$/.test(id)) return 'admin-routes';
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@zoom/videosdk')) return 'zoom-sdk';
          if (id.includes('jspdf') || id.includes('jspdf-autotable') || id.includes('html2canvas') || id.includes('dompurify')) return 'pdf-vendor';
          if (id.includes('@supabase')) return 'supabase-vendor';
          if (id.includes('lucide-react')) return 'icons-vendor';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router/')) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
});
