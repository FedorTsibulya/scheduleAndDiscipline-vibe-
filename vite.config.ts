import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base: './' — приложение работает из любой подпапки (например, GitHub Pages: /имя-репозитория/)
export default defineConfig({
  base: './',
  // время сборки показывается в настройках — по нему видно, какая версия открыта
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Focus Quest — задачи под настроение',
        short_name: 'Focus Quest',
        description: 'Задачи, шаги, настроение, таймер фокуса и награды',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#1b1b1a',
        theme_color: '#1b1b1a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
