// Build de producción: empaqueta el JS (three.js incluido), separa la maqueta en un archivo que se carga bajo demanda
// y deja todo listo en dist/ para servirlo como sitio estático (Vercel, GitHub Pages, cualquier hosting).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [path.join(root, 'main.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  splitting: true,            // scene2.js (la maqueta) queda en su propio archivo y se importa solo al acercarse
  target: 'es2020',
  outdir: path.join(dist, 'js'),
  legalComments: 'none',
  logLevel: 'info',
});

// index.html: quita el importmap de desarrollo y apunta al JS empaquetado
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '')
  .replace('<script type="module" src="main.js"></script>', '<script type="module" src="js/main.js"></script>');
fs.writeFileSync(path.join(dist, 'index.html'), html);

fs.copyFileSync(path.join(root, 'style.css'), path.join(dist, 'style.css'));
for (const dir of ['assets', 'models']) fs.cpSync(path.join(root, dir), path.join(dist, dir), { recursive: true });

const size = dir => fs.readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter(f => f.isFile()).reduce((n, f) => n + fs.statSync(path.join(f.parentPath, f.name)).size, 0);
console.log(`\ndist listo: ${(size(dist) / 1048576).toFixed(1)} MB (JS ${(size(path.join(dist, 'js')) / 1024).toFixed(0)} KB)`);
