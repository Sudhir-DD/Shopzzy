// Bundles the animated background (client/shader-background.jsx, React +
// three.js) into one static file the server can serve as-is:
//   npm run build:bg  ->  public/js/shader-background.js
// The output is kept in the repo, so running or deploying the app needs no build.
import { build } from 'esbuild';

await build({
    entryPoints: ['client/shader-background.jsx'],
    outfile: 'public/js/shader-background.js',
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2019',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'info'
});
