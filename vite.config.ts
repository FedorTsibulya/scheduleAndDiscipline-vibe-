import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base: './' — приложение работает из любой подпапки (например, GitHub Pages: /имя-репозитория/)
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Focus Quest — задачи под настроение',
        short_name: 'Focus Quest',
        description: 'Задачи, шаги, настроение, таймер фокуса и награды',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#F6F4FF',
        theme_color: '#7F77DD',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
