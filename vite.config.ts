import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'icons/*'],
            manifest: {
                name: 'GalaDelivery',
                short_name: 'GalaDelivery',
                description: 'PWA додаток для обліку закупівель, розвантаження та доставки товарів',
                theme_color: '#4f46e5',
                icons: [
                    {
                        src: 'icons/icon-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'icons/icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            }
        })
    ],
    server: {
        port: 3000
    },
    build: {
        outDir: 'dist',
        sourcemap: true
    }
});
