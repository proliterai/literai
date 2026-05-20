import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      // Для SPA (где есть динамические роуты типа /chat/[id]) 
      // обязательно нужен fallback
      fallback: 'index.html', 
      pages: 'build',
      assets: 'build',
      precompress: false,
      strict: true
    })
  }
};

export default config;