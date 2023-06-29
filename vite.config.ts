import { defineConfig } from 'vite'
import copy from 'rollup-plugin-copy'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    copy({
      targets: [
        {
          src: 'node_modules/lz4-asm/dist/_lz4.wasm',
          dest: 'public',
          rename: 'lz4.wasm',
        },
      ],
      hook: 'buildStart',
    }),
    vue(),
  ]
})
