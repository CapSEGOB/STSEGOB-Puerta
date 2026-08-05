// Genera los íconos PNG de la PWA (placeholder monocromo: puerta dorada
// sobre fondo verde oscuro institucional). Sin dependencias: PNG crudo + zlib.
// Uso: node scripts/gen-iconos.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(RAIZ, 'public')
mkdirSync(PUBLIC, { recursive: true })

const FONDO = [0x5a, 0x14, 0x29] // #5a1429 guinda oscuro institucional
const ORO = [0xbd, 0x96, 0x47]   // #bd9647 oro de las Carpetas de Gira

const TABLA_CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const t = Buffer.from(tipo, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, datos])))
  return Buffer.concat([largo, t, datos, crc])
}

// Dibujo: puerta dorada centrada con manija y umbral, fondo verde oscuro.
// escala < 1 encoge el dibujo hacia el centro (padding de fondo alrededor),
// para la variante maskable: todo debe caber en el círculo seguro de radio 0.4.
function pixel(x, y, S, escala = 1) {
  const u = 0.5 + (x / S - 0.5) / escala
  const v = 0.5 + (y / S - 0.5) / escala
  // hoja de la puerta
  if (u >= 0.32 && u <= 0.68 && v >= 0.18 && v <= 0.78) {
    // manija (hueco en color de fondo)
    if (u >= 0.575 && u <= 0.635 && v >= 0.455 && v <= 0.515) return FONDO
    return ORO
  }
  // umbral / base
  if (u >= 0.22 && u <= 0.78 && v >= 0.80 && v <= 0.845) return ORO
  return FONDO
}

function generarPng(S, escala = 1) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(S, 0)
  ihdr.writeUInt32BE(S, 4)
  ihdr[8] = 8 // profundidad de bits
  ihdr[9] = 6 // tipo de color: RGBA
  const crudo = Buffer.alloc(S * (1 + S * 4))
  let o = 0
  for (let y = 0; y < S; y++) {
    crudo[o++] = 0 // filtro: ninguno
    for (let x = 0; x < S; x++) {
      const [r, g, b] = pixel(x, y, S, escala)
      crudo[o++] = r
      crudo[o++] = g
      crudo[o++] = b
      crudo[o++] = 255
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(crudo, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const SALIDAS = [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  // Maskable: dibujo al 72% central; el punto más lejano queda a ~0.32 del
  // centro, dentro de la zona segura (círculo de radio 0.4).
  ['pwa-512-maskable.png', 512, 0.72],
  ['apple-touch-icon.png', 180],
]

for (const [nombre, tam, escala] of SALIDAS) {
  const ruta = join(PUBLIC, nombre)
  writeFileSync(ruta, generarPng(tam, escala ?? 1))
  console.log(`OK  ${nombre} (${tam}x${tam})`)
}
