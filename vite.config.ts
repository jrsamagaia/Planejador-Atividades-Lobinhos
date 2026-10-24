import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// O front-end (React) é compilado para dist/client e servido pelo Worker como arquivos estáticos.
// `npm run dev:ui` sobe só a interface e encaminha /api para o `wrangler dev` (porta 8787).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/app',
  publicDir: '../../public',
  build: { outDir: '../../dist/client', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:8787' } },
});
