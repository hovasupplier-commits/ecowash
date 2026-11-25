import * as THREE from 'three';
import { buildStudio, loadFilter } from './filterLib.js';

// la maqueta (≈17 MB entre modelos y texturas) se descarga solo cuando la sección está cerca de verse: la portada abre mucho más rápido
{
  const sec = document.getElementById('parte2');
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); import('./scene2.js'); } }, { rootMargin: '40% 0px' });
  io.observe(sec);
}

/* ---------- escena ---------- */
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const PR_MAX = Math.min(devicePixelRatio, 1.5), PR_MIN = 0.7;
let pr = PR_MAX, lastT = 0, ftSum = 0, ftN = 0;
renderer.setPixelRatio(pr);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(buildStudio(), 0.02).texture;

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
camera.position.set(0, 0, 30);

const key = new THREE.DirectionalLight(0xbfdcff, 0.5); key.position.set(-6, 8, 10); scene.add(key);
const rim = new THREE.DirectionalLight(0x4aa0ff, 1);   rim.position.set(8, -2, -6);  scene.add(rim);

const pivot = new THREE.Group();   // inclinación + flotación
const spinner = new THREE.Group(); // giro sobre su propio eje
pivot.add(spinner); scene.add(pivot);

const BASE_TILT = -0.42; // inclinación como la lata de la referencia
let fitScale = 1;
let baseScale = 1;

loadFilter(renderer).then(({ group, height }) => {
  spinner.add(group);
  fitScale = 1 / height;
  resize();
  document.body.classList.add('ready');
});

/* ---------- tamaño ---------- */
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const target = (w < 760 ? 0.7 : 0.96) * visH; // el filtro ocupa casi todo el alto
  baseScale = target * fitScale;
  pivot.position.x = 0;
}
addEventListener('resize', resize);

/* ---------- interacción ---------- */
const st = { yaw: 0.6, vyaw: 0.004, pitch: 0, tx: 0, ty: 0, mx: 0, my: 0, zoom: 1, tz: 1, drag: false, lx: 0, ly: 0 };
const hint = document.getElementById('hint');
const used = () => hint.classList.add('gone');

canvas.addEventListener('pointerdown', e => {
  st.drag = true; st.lx = e.clientX; st.ly = e.clientY; canvas.setPointerCapture(e.pointerId); used();
});
canvas.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  st.mx = (e.clientX - r.left) / r.width * 2 - 1;
  st.my = (e.clientY - r.top) / r.height * 2 - 1;
  if (!st.drag) return;
  const dx = e.clientX - st.lx, dy = e.clientY - st.ly;
  st.lx = e.clientX; st.ly = e.clientY;
  st.yaw += dx * 0.01; st.vyaw = dx * 0.01;       // seguimiento 1:1 con el dedo
  st.ty = THREE.MathUtils.clamp(st.ty + dy * 0.006, -0.6, 0.6);
});
const up = () => { st.drag = false; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', e => {
  e.preventDefault(); used();
  st.tz = THREE.MathUtils.clamp(st.tz * (1 - e.deltaY * 0.0012), 0.8, 1.6);
}, { passive: false });
canvas.addEventListener('dblclick', () => { st.tz = st.tz > 1.2 ? 1 : 1.55; });

document.getElementById('spin').addEventListener('click', () => { st.vyaw = 0.35; used(); });

/* ---------- loop (solo cuando la portada es visible) ---------- */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clock = new THREE.Clock();
let appear = 0, visible = true;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.05 })
  .observe(document.getElementById('hero'));

function tick() {
  requestAnimationFrame(tick);
  if (!visible) return;
  const t = clock.getElapsedTime();
  // resolución dinámica: si el promedio de 45 cuadros pasa de ~24 ms baja la resolución; si sobra tiempo, la recupera
  const dtf = Math.min(0.05, t - lastT); lastT = t; ftSum += dtf;
  if (++ftN >= 45) {
    const avg = ftSum / ftN; ftSum = ftN = 0;
    if (avg > 0.024 && pr > PR_MIN) { pr = Math.max(PR_MIN, pr - 0.2); renderer.setPixelRatio(pr); resize(); }
    else if (avg < 0.0185 && pr < PR_MAX) { pr = Math.min(PR_MAX, pr + 0.1); renderer.setPixelRatio(pr); resize(); }
  }
  if (!st.drag) {
    const idle = reduce ? 0 : 0.004;
    st.vyaw += (idle - st.vyaw) * 0.04;
    st.yaw += st.vyaw;
    st.ty += (0 - st.ty) * 0.03;
  }
  spinner.rotation.y = st.yaw;

  st.tx += (st.mx - st.tx) * 0.06;
  pivot.rotation.z = BASE_TILT + st.tx * -0.06;
  pivot.rotation.x = st.ty + st.my * 0.05;
  pivot.position.y = reduce ? 0 : Math.sin(t * 1.1) * 0.25;

  st.zoom += (st.tz - st.zoom) * 0.1;
  appear += (1 - appear) * 0.05;
  const e = 1 - Math.pow(1 - appear, 3);
  pivot.scale.setScalar(baseScale * st.zoom * (0.6 + 0.4 * e));
  spinner.rotation.y += (1 - e) * 2.2;
  canvas.style.opacity = Math.min(1, appear * 3);

  renderer.render(scene, camera);
}
resize(); tick();
