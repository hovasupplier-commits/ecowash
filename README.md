# ECO WASH

Sitio web con dos partes:

1. **Portada:** el filtro para aguas grises ECO WASH en 3D, interactivo (arrastrar, girar, acercar).
2. **Maqueta interactiva:** una casa sobre una isla flotante, con la lavadora, el filtro fijo en la pared y el tubo que sube al tanque de la azotea. El botón "Ver funcionamiento" acerca la cámara y muestra el recorrido del agua.

Hecho con [three.js](https://threejs.org). Los modelos se crearon en Blender y se exportaron a `.glb`.

## Requisitos

- Node.js 18 o superior

## Usar en local

```bash
npm install
npm run dev        # http://localhost:5173  (carga los módulos directo, sin empaquetar)
```

## Build de producción

```bash
npm run build      # genera dist/ (JS empaquetado y minificado + assets)
npm run preview    # construye y sirve dist/ en http://localhost:4173
```

La maqueta (`scene2.js`) se descarga solo cuando la sección está cerca de verse, para que la portada abra rápido.

## Despliegue en Vercel

El archivo `vercel.json` ya indica el comando de build (`npm run build`) y la carpeta de salida (`dist`).
Al importar el repositorio en Vercel no hace falta cambiar nada: el preset es "Other".

## Estructura

| Ruta | Contenido |
| --- | --- |
| `index.html`, `style.css` | Página y estilos |
| `main.js` | Portada: escena del filtro |
| `scene2.js` | Maqueta de la isla y la casa (carga diferida) |
| `filterLib.js` | Carga del filtro, textura de acero cepillado y logo |
| `bin.js` | Carga de `.glb` y `.hdr` |
| `models/` | `ecowash.glb` (filtro) y `casa.glb` (isla, casa, lavadora, tanque y tuberías) |
| `assets/` | Logo, fondo de nubes y texturas |
| `scripts/build.mjs` | Build de producción |

## Créditos y licencias

- Texturas y cielo de [Poly Haven](https://polyhaven.com), licencia CC0: `cliff_side`, `grass_path_2`, `beige_wall_001`, `brown_planks_03`, `brushed_concrete_03`, `brick_pavement_02` y el HDRI `kloofendal_48d_partly_cloudy_puresky`.
- Tipografías de Google Fonts (licencia OFL): Bricolage Grotesque e Inter.
- `assets/logo.jpg` es el logo de ECO WASH. `assets/nubes.jpg` es una foto de nubes: confirma que tienes derecho a usarla antes de publicar el sitio.
- Los modelos de la lavadora y el tanque son versiones genéricas hechas a partir de fotos de referencia; no llevan marcas.

