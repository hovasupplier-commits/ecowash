import * as THREE from 'three';
import { loadGLB } from './bin.js';

/* ---------- estudio de luz: cajas de luz para reflejos largos en el acero ---------- */
export function buildStudio() {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0x7388aa, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, k, tint = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(3, 16, -9, 2, 6, 5);
  panel(2, 16, 10, 0, 3, 3.2);
  panel(14, 3, 0, 11, 2, 3.5);
  panel(10, 2, 0, -9, 5, 1.2, 0x6aa8ff);
  panel(1.2, 16, 2, 0, -12, 2.5);
  return s;
}

/* ---------- textura procedural de metal cepillado (torneado) ---------- */
let _brushed;
export function brushedTexture(renderer) {
  if (_brushed) return _brushed;
  const W = 512, H = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgb(105,105,105)'; c.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    const g = 85 + Math.random() * 70;
    c.fillStyle = `rgba(${g},${g},${g},${0.55 + Math.random() * 0.4})`;
    c.fillRect(0, y, W, 1 + (Math.random() < 0.25 ? 1 : 0));
  }
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * H, x = Math.random() * W, w = 40 + Math.random() * 220, g = 70 + Math.random() * 110;
    c.fillStyle = `rgba(${g},${g},${g},${0.15 + Math.random() * 0.25})`;
    c.fillRect(x, y, w, 1); c.fillRect(x - W, y, w, 1);
  }
  c.filter = 'blur(14px)';
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = 18 + Math.random() * 48, g = Math.random() < .5 ? 190 : 40;
    c.fillStyle = `rgba(${g},${g},${g},${0.10 + Math.random() * 0.14})`;
    for (const dx of [-W, 0, W]) { c.beginPath(); c.arc(x + dx, y, r, 0, 7); c.fill(); }
  }
  c.filter = 'none';
  const d = c.getImageData(0, 0, W, H), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const n = (Math.random() - .5) * 14; p[i] += n; p[i + 1] += n; p[i + 2] += n; }
  c.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 9);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return (_brushed = t);
}

/* ---------- logo real como calcomanía curvada sobre el cuerpo ---------- */
function loadLogoDecal(parent, renderer) {
  const img = new Image();
  img.onload = () => {
    const sx = 240, sy = 120, sw = 1060, sh = 690;
    const cv = document.createElement('canvas'); cv.width = sw; cv.height = sh;
    const cx = cv.getContext('2d'); cx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const d = cx.getImageData(0, 0, sw, sh), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const mn = Math.min(p[i], p[i + 1], p[i + 2]);
      p[i + 3] = Math.max(0, Math.min(1, (245 - mn) / 30)) * 255;
    }
    cx.putImageData(d, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const R = 1.0, h = 1.5, w = h * sw / sh, arc = w / R;
    const geo = new THREE.CylinderGeometry(R + 0.006, R + 0.006, h, 96, 1, true, -arc / 2, arc);
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.35, metalness: 0,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const decal = new THREE.Mesh(geo, mat);
    decal.position.y = 4.63; // centro del cuerpo (unidades del modelo)
    parent.add(decal);
  };
  img.src = 'assets/logo.jpg';
}

/* Devuelve el filtro centrado en el origen, eje vertical, boquilla arriba.
   Unidades del modelo: largo = height (≈9.86). */
export function loadFilter(renderer) {
  return new Promise((resolve, reject) => {
    loadGLB('models/ecowash.glb', (g) => {
      const m = g.scene;
      m.traverse(o => { if (/^(logo_|txt)/.test(o.name)) o.visible = false; });
      loadLogoDecal(m, renderer);
      const box = new THREE.Box3().setFromObject(m);
      m.position.sub(box.getCenter(new THREE.Vector3()));
      m.traverse(o => {
        if (o.isMesh && o.material.name === 'Steel') {
          Object.assign(o.material, { metalness: 1, roughness: 0.8, envMapIntensity: 1, bumpScale: 0.9 });
          if ('anisotropy' in o.material) o.material.anisotropy = 0;
          const t = brushedTexture(renderer);
          o.material.roughnessMap = t; o.material.bumpMap = t;
          o.material.color.set(0xf2f4f7);
          o.material.needsUpdate = true;
        }
      });
      const wrap = new THREE.Group(); wrap.add(m);
      resolve({ group: wrap, height: box.max.y - box.min.y });
    }, reject);
  });
}

