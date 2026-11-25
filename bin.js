import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

/* Carga de archivos binarios (.glb, .hdr).
   En local se piden directo. En la página publicada (window.__BIN_URL) vienen dentro de un JSON en base64,
   porque ese alojamiento no sirve .glb ni .hdr. */
export async function getBuf(url) {
  if (window.__BIN_URL) {
    window.__binP ??= fetch(window.__BIN_URL).then(r => r.json());
    const s = atob((await window.__binP)[url]);
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u.buffer;
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.arrayBuffer();
}

export function loadGLB(url, onLoad, onError) {
  getBuf(url).then(buf => new GLTFLoader().parse(buf, '', onLoad, onError)).catch(onError || console.error);
}

export async function loadHDR(url) {
  const d = new RGBELoader().parse(await getBuf(url));
  const t = new THREE.DataTexture(d.data, d.width, d.height);
  t.type = d.type; t.colorSpace = THREE.LinearSRGBColorSpace;
  t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.flipY = true; t.needsUpdate = true;
  return t;
}
