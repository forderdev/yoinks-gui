import {defineConfig} from 'tsup'

export default defineConfig({
  entry: ['src/main.ts', 'src/preload.ts'],
  format: 'cjs',
  target: 'node18',
  platform: 'node',
  outDir: 'dist',
  outExtension: () => ({js: '.cjs'}),
  clean: true,
  splitting: false,
  external: ['electron', 'ffmpeg-static'],
})
