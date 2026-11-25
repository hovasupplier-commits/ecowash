import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadGLB, loadHDR } from './bin.js';
import { loadFilter } from './filterLib.js';

/* Coordenadas: el modelo se hizo en Blender (Z arriba, frente = -Y).
   En three.js (Y arriba, frente = +Z):  B(x,y,z) -> (x, z, -y) */
const B = (x, y, z) => new THREE.Vector3(x, z, -y);

const sec = document.getElementById('parte2');
const canvas = document.getElementById('island');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
const PR_MAX = Math.min(devicePixelRatio, 1.5), PR_MIN = 0.7;     // resolución dinámica: baja sola si el equipo no da la talla
let pr = PR_MAX;
renderer.setPixelRatio(pr);
renderer.toneMapping = THREE.NeutralToneMapping;             // conserva los colores y suaviza solo las luces altas (menos duro que ACES)
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xbdd3ea, 0.007);                // bruma de altura: da profundidad y suaviza el contraste
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);

/* ---------- luz: cielo de día + sol ---------- */
function buildSky() {
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 p; void main(){ p=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 p; void main(){
      vec3 top=vec3(.25,.55,1.), hor=vec3(1.,1.,1.), bot=vec3(.45,.55,.45);
      vec3 c = p.y>0. ? mix(hor,top,pow(p.y,.6)) : mix(hor,bot,pow(-p.y,.5));
      gl_FragColor=vec4(c*1.1,1.); }`
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), mat));
  const sun = new THREE.Mesh(new THREE.CircleGeometry(4, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .95, .8).multiplyScalar(14) }));
  sun.position.set(14, 22, 12); sun.lookAt(0, 0, 0); s.add(sun);
  return s;
}
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(buildSky(), 0.03).texture;
scene.add(new THREE.HemisphereLight(0xbcd4f5, 0x5b6a4c, 0.22));
scene.environmentIntensity = 0.7;
// cielo real (Poly Haven "Kloofendal 48d Partly Cloudy", CC0): reemplaza al cielo degradado en cuanto carga
const hdrDone = loadHDR('assets/polyhaven/sky_1k.hdr').then(t => {
  t.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pmrem.fromEquirectangular(t).texture; scene.environmentIntensity = 0.62; t.dispose();            // menos luz de relleno: más contraste entre sol y sombra
}).catch(() => {});
const sunL = new THREE.DirectionalLight(0xffe9cf, 4.4);          // sol directo y cálido; las sombras caen azuladas por el cielo
sunL.position.set(16, 13, 17);                                    // baja, por el frente y la derecha: pega de lleno en la fachada y alarga las sombras
sunL.castShadow = true;
sunL.shadow.mapSize.set(3072, 3072);                              // alta resolución: se dibuja UNA sola vez (isla estática)
Object.assign(sunL.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 70 });
sunL.shadow.bias = -0.0003; sunL.shadow.normalBias = 0.035;
sunL.target.position.set(0.3, 1.5, -0.5);
renderer.shadowMap.autoUpdate = false;                            // rendimiento: sin recalcular sombras cada cuadro
/* ---------- cámara y controles ---------- */
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.minDistance = 2.5; controls.maxDistance = 60;
controls.autoRotateSpeed = 0.5;

const VIEWS = {
  general: { pos: new THREE.Vector3(17, 4.5, 33), tgt: new THREE.Vector3(-3.4, -1.7, 0) },
  front:   { pos: new THREE.Vector3(0.4, 4, 22),  tgt: new THREE.Vector3(0.3, 2.5, -0.5) },
  back:    { pos: new THREE.Vector3(3, 5, -24),   tgt: new THREE.Vector3(0.3, 2.8, -1) },
  flow:    { pos: new THREE.Vector3(9.5, 4.6, -21),   tgt: new THREE.Vector3(3.6, 3.7, -1.8) },
  machine: { pos: new THREE.Vector3(5.6, 1.7, -6.2),  tgt: new THREE.Vector3(4.1, 0.8, -2.0) },
  filter:  { pos: new THREE.Vector3(4.9, 1.9, -4.6),  tgt: new THREE.Vector3(3.2, 1.5, -1.8) },
  pipe:    { pos: new THREE.Vector3(6.5, 4.4, -5.2),  tgt: new THREE.Vector3(3.2, 4.2, -1.8) },
  tank:    { pos: new THREE.Vector3(6.8, 8.6, -4.8),  tgt: new THREE.Vector3(3.5, 7.3, -0.8) },
};
camera.position.copy(VIEWS.general.pos); controls.target.copy(VIEWS.general.tgt);

let tween = null;
function goTo(name, dur = 1.8) {
  const v = VIEWS[name]; if (!v) return;
  const s0 = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  const s1 = new THREE.Spherical().setFromVector3(v.pos.clone().sub(v.tgt));
  let dth = s1.theta - s0.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth)); // giro por el lado corto
  tween = { t: 0, dur, s0, s1, dth, t0: controls.target.clone(), t1: v.tgt.clone() };
  controls.autoRotate = false;
}
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = k => 1 - Math.pow(1 - k, 4);

/* ---------- isla ---------- */
const island = new THREE.Group(); scene.add(island);
island.add(sunL, sunL.target);
let flowMode = false;
const tankWater = { mesh: null, plane: new THREE.Plane(new THREE.Vector3(0, -1, 0), 0) };
const translucent = [];       // materiales que se vuelven translúcidos en "ver funcionamiento"
const shakeMeshes = [];       // lavadora
const TANK_C = B(3.6, 0.7, 7.22);

loadGLB('models/casa.glb', (g) => {
  const m = g.scene;
  m.traverse(o => {
    if (!o.isMesh) return;
    const mt = o.material, n = mt.name;
    const glass = mt.transparent;
    o.castShadow = !glass; o.receiveShadow = true;
    if (n === 'Glass' || n === 'GlassDark') { mt.depthWrite = false; mt.metalness = 0.1; mt.roughness = 0.05; }
    if (n === 'TankCream' || n === 'PipeBlue' || n === 'Hose') translucent.push(mt);
    if (/^M(White|Gray|Dark|Knob)$/.test(n) && !o.name.startsWith('D_')) shakeMeshes.push(o);
    if (mt.userData.done) return; mt.userData.done = true;      // cada material se configura una sola vez
    if (n === 'Plant') { mt.side = THREE.DoubleSide; mt.roughness = 1; mt.envMapIntensity = 0.45; mt.color.setRGB(0.72, 0.85, 0.6); leafShader(mt); }
    if (n === 'Stucco' || n === 'Slab' || n === 'WallWhite') mt.color.setRGB(1.0, 0.86, 0.62);   // crema cálido: se multiplica por el color base de Blender
    if (HOUSE[n]) { const [k, s, st, rm, nm, sw, nk, ao] = HOUSE[n]; houseTex[k].then(T => houseShader(mt, T, s, st, rm, nm, sw, nk, ao)).catch(() => {}); }
    if (n === 'RockVC') { mt.color.setScalar(1.0); mt.roughness = 0.95; rockTex.then(T => rockShader(mt, T)).catch(() => {}); }
    if (n === 'GrassVC') { mt.color.setRGB(0.75, 1.25, 0.45); groundTex.then(T => groundShader(mt, T)).catch(() => {}); }
  });
  island.add(m);
  m.traverse(o => { if (o.isMesh && o.name === 'island_grass') addGrass(o); });
  addWater();
  Promise.allSettled([rockTex, groundTex, hdrDone, ...Object.values(houseTex)]).then(() => { ready(); renderer.shadowMap.needsUpdate = true; });   // espera texturas y cielo antes de mostrar
});

/* ---------- texturas reales (Poly Haven, CC0) proyectadas en triplanar: roca "Cliff Side" y suelo "Grass Path 2" ---------- */
const loadTri = id => Promise.all(['diff', 'nor_gl', 'rough'].map(k =>
  new THREE.TextureLoader().loadAsync(`assets/polyhaven/${id}_${k}_1k.jpg`))).then(([d, n, r]) => {
  [d, n, r].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; });
  d.colorSpace = THREE.SRGBColorSpace;
  return { d, n, r };
});
const rockTex = loadTri('cliff_side');
const groundTex = loadTri('grass_path_2');

const NOISE_GLSL = `
  float h31(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p){ return .5 * vn(p) + .25 * vn(p * 2.03) + .125 * vn(p * 4.1); }`;
function triShader(mt, T, o) {
  mt.onBeforeCompile = s => {
    s.uniforms.tD = { value: T.d }; s.uniforms.tN = { value: T.n }; s.uniforms.tR = { value: T.r };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvON = objectNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vOP; varying vec3 vON;
        ${NOISE_GLSL}
        uniform sampler2D tD; uniform sampler2D tN; uniform sampler2D tR;
        vec3 triW(){ vec3 w = pow(abs(normalize(vON)), vec3(5.0)); return w / (w.x + w.y + w.z); }
        vec4 triTex(sampler2D t, float S){
          vec3 w = triW(); vec3 p = vOP * S;
          return ${o.swap ? 'texture2D(t, p.yz) * w.x + texture2D(t, p.zx) * w.y + texture2D(t, p.yx) * w.z' : 'texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z'}; }
        vec4 triMix(sampler2D t){ return mix(triTex(t, ${o.s1}), triTex(t, ${o.s2}), 0.4); }   // dos escalas: evita repetición
        vec3 triNormal(float S){
          vec3 w = triW(), n = normalize(vON), p = vOP * S;
          vec3 nx = texture2D(tN, p.zy).xyz * 2.0 - 1.0, ny = texture2D(tN, p.xz).xyz * 2.0 - 1.0, nz = texture2D(tN, p.xy).xyz * 2.0 - 1.0;
          nx = vec3(nx.xy * ${(o.nk ?? 1).toFixed(2)} + n.zy, abs(nx.z) * n.x); ny = vec3(ny.xy * ${(o.nk ?? 1).toFixed(2)} + n.xz, abs(ny.z) * n.y); nz = vec3(nz.xy * ${(o.nk ?? 1).toFixed(2)} + n.xy, abs(nz.z) * n.z);
          return normalize(nx.zyx * w.x + ny.xzy * w.y + nz.xyz * w.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 tex = triMix(tD).rgb;
          float lum = dot(tex, vec3(0.299, 0.587, 0.114));
          ${o.color}
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(triTex(tR, ${o.s1}).g * 1.05, ${o.rmin}, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 on = triNormal(${o.s1});                                // una sola escala: 3 lecturas en vez de 6
          normal = normalize(mix(normal, normalize((viewMatrix * vec4(on, 0.0)).xyz), ${o.nmix}));
        }`);
  };
  mt.needsUpdate = true;
}
// roca: el color del vértice (musgo, grietas, tono por bloque) manda; la textura aporta el detalle de piedra
const rockShader = (mt, T) => triShader(mt, T, { s1: '0.30', s2: '0.071', rmin: '0.45', nmix: '0.9',
  color: `tex = mix(vec3(lum), tex, 0.3) * 2.4;
          diffuseColor.rgb = mix(diffuseColor.rgb * (lum / 0.2), tex, 0.45);` });
// suelo: césped real debajo de las briznas, conservando los tonos y la sombra del borde que vienen del vértice
const groundShader = (mt, T) => triShader(mt, T, { s1: '0.45', s2: '0.10', rmin: '0.6', nmix: '0.8',
  color: `diffuseColor.rgb = mix(diffuseColor.rgb, tex * 0.55 * (0.8 + 0.5 * lum), 0.5);
          // sombra de contacto: el pasto se oscurece cerca de los muros (huella de la casa en el plano XZ del modelo)
          vec2 q = abs(vOP.xz - vec2(0.5, -0.5)) - vec2(4.7, 3.9);
          float dd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
          diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 1.6, dd)) * (0.9 + 0.2 * fbm(vOP * 1.3));` });

// casa: la textura aporta el detalle (relieve, grano, vetas) y el color base de cada material se conserva
const houseShader = (mt, T, s, strength, rmin, nmix, swap = false, nk = 1, ao = false) => triShader(mt, T, { s1: String(s), s2: (s * 0.23).toFixed(3), rmin, nmix, swap, nk,
  color: `vec3 avg = textureLod(tD, vec2(0.5), 10.0).rgb;
          vec3 det = clamp(tex / max(avg, vec3(0.03)), 0.35, 2.2);
          diffuseColor.rgb *= mix(vec3(1.0), det, ${strength});
          diffuseColor.rgb *= 0.9 + 0.2 * fbm(vOP * 0.7);                              // manchas suaves de intemperie
          ${ao ? 'diffuseColor.rgb *= mix(0.6, 1.0, smoothstep(0.0, 1.0, vOP.y));' : ''}   // base más oscura (oclusión ambiental falsa)` });
const houseTex = {
  plaster: loadTri('beige_wall_001'), wood: loadTri('brown_planks_03'),
  concrete: loadTri('brushed_concrete_03'), pavers: loadTri('brick_pavement_02'),
};
const HOUSE = {                       // material GLB -> [textura, escala (1/m), fuerza del color, rugosidad mín, normal, grano vertical]
  Stucco: ['plaster', 0.7, 1.0, 0.75, 1.0, false, 2.4, true], Slab: ['plaster', 0.7, 0.9, 0.75, 1.0, false, 2.0], WallWhite: ['plaster', 0.7, 0.9, 0.75, 1.0, false, 2.0, true],
  Wood: ['wood', 0.5, 0.9, 0.45, 0.7], WoodSlat: ['wood', 0.9, 0.9, 0.45, 0.0, true, 1, true],
  Concrete: ['concrete', 0.45, 0.8, 0.6, 0.8], Paver: ['pavers', 0.5, 0.9, 0.6, 0.8],
};
function leafShader(mt) {
  mt.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;\n' + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= (0.7 + 0.6 * fbm(vOP * 9.0)) * mix(0.62, 1.0, smoothstep(0.0, 0.9, vOP.y));`);
  };
}
/* ---------- pasto estilo caricatura (toon): mechones de briznas anchas, degradado base→punta y luz en escalones ---------- */
const grassU = { uTime: { value: 0 } };
const BH = 0.5;                                                       // alto de una brizna (unidades del modelo)
function bladeGeometry() {
  const segs = 3, w = 0.125, pos = [], col = [], nor = [], idx = [];
  const base = new THREE.Color().setHSL(0.33, 0.9, 0.27);            // verde intenso en la raíz
  const mid  = new THREE.Color().setHSL(0.26, 0.95, 0.5);            // verde vivo
  const tip  = new THREE.Color().setHSL(0.17, 1.0, 0.66);            // lima amarillento en la punta
  const c = new THREE.Color();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, y = t * BH, z = t * t * BH * 0.55;
    const half = w * 0.5 * Math.pow(1 - t, 0.75);                      // se afila hasta la punta
    pos.push(-half, y, z, half, y, z);
    c.copy(t < 0.5 ? base.clone().lerp(mid, t * 2) : mid.clone().lerp(tip, (t - 0.5) * 2));
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    nor.push(0, 1, 0.25, 0, 1, 0.25);                                   // normales hacia arriba: luz suave y pareja, sin lados oscuros
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
function grassMaterial() {
  // sombreado "toon" de 3 escalones: luz, medio tono y sombra, como en el video
  const gm = new THREE.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, THREE.RedFormat);
  gm.minFilter = gm.magFilter = THREE.NearestFilter; gm.needsUpdate = true;
  const m = new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide, gradientMap: gm, emissive: 0x2c6a0a, emissiveIntensity: 0.55 });   // brillo propio: verde vivo de dibujo animado
  m.onBeforeCompile = s => {
    s.uniforms.uTime = grassU.uTime;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float sw = pow(position.y / ${BH.toFixed(2)}, 2.0);
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        transformed.x += sin(uTime * 1.8 + ip.x * 0.7 + ip.y * 0.5) * 0.075 * sw;     // oleaje suave de todo el pasto
        transformed.z += cos(uTime * 1.4 + ip.y * 0.8 + ip.x * 0.3) * 0.06 * sw;`);
  };
  return m;
}

function addGrass(grass) {
  // radio del borde por ángulo, leído de la propia malla del pasto
  const pos = grass.geometry.attributes.position, BINS = 90, rim = new Float32Array(BINS);
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < -2.2) continue;
    const dx = pos.getX(i) - 0.3, dz = pos.getZ(i) + 0.4;
    const b = Math.min(BINS - 1, Math.floor((Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI) * BINS));
    rim[b] = Math.max(rim[b], Math.hypot(dx, dz));
  }
  const rimAt = a => rim[Math.min(BINS - 1, Math.floor(a / (2 * Math.PI) * BINS))];
  const geo = bladeGeometry(), mat = grassMaterial();
  const d = new THREE.Object3D(), c = new THREE.Color();
  d.rotation.order = 'YXZ';
  const TOP = 0.86;                                                  // el césped plano llega a ~86% del radio del borde
  const tint = (inst, i) => inst.setColorAt(i, c.setRGB(0.9 + Math.random() * 0.25, 0.92 + Math.random() * 0.2, 0.75 + Math.random() * 0.35));

  // 1) césped en mechones: cada mechón son ~9 briznas que se abren hacia afuera (altas en el centro, bajas en la orilla)
  const NC = 1800, PER = 8, lawn = new THREE.InstancedMesh(geo, mat, NC * PER);
  let n = 0, clumps = 0, guard = 0;
  while (clumps < NC && guard++ < 200000) {
    const a = Math.random() * 6.2832, k = TOP * Math.sqrt(Math.random()), ang = a - Math.PI, r = rimAt(a) * k;
    const cx = 0.3 + r * Math.cos(ang), cz = -0.4 + r * Math.sin(ang), yBl = -cz;            // yBl = y de Blender
    const inHouse = cx > -5.4 && cx < 5.4 && yBl > -3.6 && yBl < 4.5;
    const inWalk = cx > 0.3 && cx < 2.2 && yBl < -3.3 && yBl > -6.9;
    const inDrive = cx > -4.1 && cx < 0.3 && yBl < -3.3 && yBl > -7.3;
    if (inHouse || inWalk || inDrive) continue;
    clumps++;
    const edgeK = Math.max(0, (k / TOP - 0.7) / 0.3);
    const size = (0.8 + Math.random() * 0.7) * (1 + edgeK * 0.9);
    for (let j = 0; j < PER; j++) {
      const t = j / (PER - 1), a2 = Math.random() * 6.2832, dist = 0.02 + Math.pow(Math.random(), 0.8) * 0.2;
      d.position.set(cx + Math.cos(a2) * dist, -0.1, cz + Math.sin(a2) * dist);
      d.rotation.set(0.12 + (dist / 0.22) * 0.55 + Math.random() * 0.25 + edgeK * 0.25, Math.atan2(Math.cos(a2), Math.sin(a2)) + (Math.random() - .5) * 0.5, 0);
      const h = size * (1.05 - 0.5 * dist / 0.22) * (0.75 + Math.random() * 0.5);
      d.scale.set(0.9 + Math.random() * 0.5, h, 1);
      d.updateMatrix(); lawn.setMatrixAt(n, d.matrix); tint(lawn, n); n++;
    }
  }
  lawn.count = n; lawn.receiveShadow = true; island.add(lawn);

  // 2) cortina de pasto que cuelga sobre la roca (mechones largos hacia abajo)
  const NH = 4500, hang = new THREE.InstancedMesh(geo, mat, NH);
  for (let i = 0; i < NH; i++) {
    const a = Math.random() * 6.2832, k = 0.84 + Math.random() * 0.16, ang = a - Math.PI, r = rimAt(a) * k;
    d.position.set(0.3 + r * Math.cos(ang), -0.05 - Math.random() * 0.5, -0.4 + r * Math.sin(ang));
    d.rotation.set(Math.PI - 0.2 + (Math.random() - .5) * 0.4, Math.atan2(Math.cos(ang), Math.sin(ang)) + Math.PI + (Math.random() - .5) * 0.8, 0);
    d.scale.set(1.0 + Math.random() * 0.8, 1.2 + Math.random() * 1.9, 1);
    d.updateMatrix(); hang.setMatrixAt(i, d.matrix); tint(hang, i);
  }
  hang.receiveShadow = true; island.add(hang);

  // 3) arbustitos redondeados estilo caricatura
  const lump = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshToonMaterial({ gradientMap: mat.gradientMap }), 120);
  for (let i = 0; i < lump.count; i++) {
    const a = Math.random() * 6.2832, k = 0.5 + Math.random() * 0.34, ang = a - Math.PI, r = rimAt(a) * k;
    d.position.set(0.3 + r * Math.cos(ang), 0.05, -0.4 + r * Math.sin(ang)); d.rotation.set(0, Math.random() * 6.28, 0);
    d.scale.set(0.16 + Math.random() * 0.18, 0.1 + Math.random() * 0.12, 0.16 + Math.random() * 0.18);
    d.updateMatrix(); lump.setMatrixAt(i, d.matrix);
    lump.setColorAt(i, c.setHSL(0.26 + Math.random() * 0.05, 0.75, 0.3 + Math.random() * 0.12));
  }
  island.add(lump);
}


/* ---------- agua dentro del tanque ---------- */
function addWater() {
  const geo = new THREE.CylinderGeometry(0.56, 0.56, 1.46, 40, 1); geo.rotateZ(Math.PI / 2);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x3fb4ff, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.85,
    clippingPlanes: [tankWater.plane], clipShadows: true });
  const w = new THREE.Mesh(geo, mat); w.position.copy(TANK_C); w.visible = false;
  island.add(w); tankWater.mesh = w;
}

/* ---------- filtro ECO WASH instalado en la pared ---------- */
const filterAnchor = B(3.2, 1.8, 1.0 + 0.493);
loadFilter(renderer).then(({ group, height }) => {
  group.scale.setScalar(0.986 / height);
  group.position.copy(filterAnchor);
  group.rotation.y = Math.PI; // el logo mira hacia el patio, no hacia la pared
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  island.add(group);
});

/* ---------- recorrido del agua: lavadora -> filtro -> tubo -> tanque ---------- */
const hose = new THREE.CatmullRomCurve3([B(3.83, 2.05, 0.35), B(3.62, 2.05, 0.35), B(3.36, 1.96, 0.46), B(3.2, 1.8, 0.72), B(3.2, 1.8, 1.0)], false, 'centripetal').getPoints(40);
const path = hose.concat([B(3.2, 1.8, 1.5), B(3.2, 1.8, 1.99), B(3.2, 1.8, 7.22), B(3.2, 1.3, 7.22)]);
const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + path[i].distanceTo(path[i - 1]));
const TOTAL = cum[cum.length - 1];
const S_IN = cum[hose.length - 1], S_OUT = cum[hose.length + 1];     // entrada y salida del filtro
function pathAt(s, out) {
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
  const k = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
  return out.lerpVectors(path[lo], path[hi], k);
}
const NP = 120;
const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.024, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), NP);
drops.visible = false; drops.frustumCulled = false; island.add(drops);
const DIRTY = new THREE.Color(0xdfe4e8), CLEAN = new THREE.Color(0x35b6ff);
const tmpV = new THREE.Vector3(), tmpC = new THREE.Color(), tmpO = new THREE.Object3D();

/* ---------- etiquetas ---------- */
const TAGS = [
  { id: 'machine', text: 'Lavadora', sub: 'Descarga agua con jabón', at: B(4.3, 2.05, 1.1) },
  { id: 'filter',  text: 'Filtro ECO WASH', sub: 'Fijo en la pared, retiene residuos', at: B(3.2, 1.8, 1.55) },
  { id: 'pipe',    text: 'Tubo de subida', sub: 'Lleva el agua tratada hacia arriba', at: B(3.2, 1.8, 4.2) },
  { id: 'tank',    text: 'Tanque de la azotea', sub: 'Almacena el agua para reutilizarla', at: B(3.6, 0.7, 7.95) },
];
const labels = document.getElementById('labels');
TAGS.forEach(t => {
  const b = document.createElement('button'); b.className = 'tag'; b.dataset.view = t.id;
  b.innerHTML = `<i></i><span><b>${t.text}</b><small>${t.sub}</small></span>`;
  b.addEventListener('click', () => goTo(t.id)); labels.appendChild(b); t.el = b;
});

/* ---------- modos / UI ---------- */
function setFlow(on) {
  flowMode = on; sec.classList.toggle('flow', on);
  drops.visible = on; if (tankWater.mesh) tankWater.mesh.visible = on;
  translucent.forEach(m => { m.transparent = on || m.name === 'Glass'; m.opacity = on ? (m.name === 'TankCream' ? 0.28 : 0.35) : 1; m.depthWrite = !on; m.needsUpdate = true; });
  if (on) startT = clock.getElapsedTime();
}
let startT = 0;
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.go;
  setFlow(v === 'flow' || ['machine', 'filter', 'pipe', 'tank'].includes(v) ? true : false);
  goTo(v);
  document.querySelectorAll('[data-go]').forEach(x => x.classList.toggle('on', x === b));
}));
canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; tween = null; document.getElementById('p2hint')?.classList.add('gone'); });

/* ---------- loop (solo cuando la sección está a la vista) ---------- */
let visible = false, loaded = false;
const ready = () => { loaded = true; sec.classList.add('ready'); controls.autoRotate = !reduce; };
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.05 }).observe(sec);

let rw = 0, rh = 0;
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h || (w === rw && h === rh)) return;   // solo si cambió el tamaño
  rw = w; rh = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

const clock = new THREE.Clock(); let last = 0, ftSum = 0, ftN = 0, labelsOn = false;
const proj = new THREE.Vector3();
function tick() {
  requestAnimationFrame(tick);
  if (!visible || !loaded) return;
  const t = clock.getElapsedTime(), dt = Math.min(0.05, t - last); last = t;
  // resolución dinámica: si el promedio de 45 cuadros pasa de ~24 ms baja la resolución; si sobra tiempo, la recupera
  ftSum += dt; if (++ftN >= 45) {
    const avg = ftSum / ftN; ftSum = ftN = 0;
    if (avg > 0.024 && pr > PR_MIN) { pr = Math.max(PR_MIN, pr - 0.2); renderer.setPixelRatio(pr); rw = 0; }
    else if (avg < 0.0185 && pr < PR_MAX) { pr = Math.min(PR_MAX, pr + 0.1); renderer.setPixelRatio(pr); rw = 0; }
  }
  resize();
  grassU.uTime.value = t;

  island.position.y = reduce ? 0 : Math.sin(t * 0.8) * 0.18;     // la isla flota

  if (tween) {                                                     // vuelo de cámara (por el arco, sin atravesar la casa)
    tween.t += dt; const k = ease(Math.min(1, tween.t / tween.dur));
    controls.target.lerpVectors(tween.t0, tween.t1, k);
    const s = new THREE.Spherical(
      THREE.MathUtils.lerp(tween.s0.radius, tween.s1.radius, k),
      THREE.MathUtils.lerp(tween.s0.phi, tween.s1.phi, k),
      tween.s0.theta + tween.dth * k);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));
    if (k >= 1) tween = null;
  }
  controls.update();

  if (flowMode) {
    const el = t - startT, speed = 0.75;
    for (let i = 0; i < NP; i++) {
      const s = ((i / NP) * TOTAL + el * speed) % TOTAL;
      pathAt(s, tmpV); tmpO.position.copy(tmpV); tmpO.scale.setScalar(1); tmpO.updateMatrix(); drops.setMatrixAt(i, tmpO.matrix);
      const k = THREE.MathUtils.smoothstep(s, S_IN, S_OUT);        // gris -> azul al pasar por el filtro
      drops.setColorAt(i, tmpC.copy(DIRTY).lerp(CLEAN, k));
    }
    drops.instanceMatrix.needsUpdate = true; if (drops.instanceColor) drops.instanceColor.needsUpdate = true;
    // nivel del tanque
    const level = 0.18 + 0.7 * (((el * 0.03) % 1));
    tankWater.plane.constant = island.position.y + TANK_C.y - 0.56 + level * 1.12;
    // vibración de la lavadora
    const sh = Math.sin(t * 38) * 0.0018;
    shakeMeshes.forEach(m => { m.position.x = sh; m.position.z = -sh; });
  } else shakeMeshes.forEach(m => m.position.set(0, 0, 0));

  // etiquetas ancladas en 3D (solo se recalculan en "Ver funcionamiento"; fuera de ese modo no se toca el DOM)
  if (flowMode || labelsOn) {
    labelsOn = flowMode;
    TAGS.forEach(tag => {
      proj.copy(tag.at); proj.y += island.position.y; proj.project(camera);
      const show = flowMode && proj.z < 1;
      tag.el.style.opacity = show ? 1 : 0; tag.el.style.pointerEvents = show ? 'auto' : 'none';
      tag.el.style.transform = `translate(${(proj.x * 0.5 + 0.5) * rw}px, ${(-proj.y * 0.5 + 0.5) * rh}px)`;
    });
  }

  renderer.render(scene, camera);
}
resize(); tick();










