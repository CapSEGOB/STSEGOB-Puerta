// IndexedDB local (lib idb). Todo lo importante sobrevive cierre y
// reapertura de la app: padrón, cola de check-ins y configuración.
import { openDB } from 'idb'

const NOMBRE_DB = 'stsegob-puerta'
const VERSION_DB = 1

let promesaDb = null

export function abrirDb() {
  if (!promesaDb) {
    promesaDb = openDB(NOMBRE_DB, VERSION_DB, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('padron')) {
          const padron = db.createObjectStore('padron', { keyPath: 'id' })
          padron.createIndex('folio', 'folio', { unique: true })
        }
        if (!db.objectStoreNames.contains('cola')) {
          db.createObjectStore('cola', { keyPath: 'id_local' })
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta')
        }
      },
    })
  }
  return promesaDb
}

// ---------- meta (config del dispositivo, versión del padrón) ----------

export async function leerMeta(clave) {
  return (await abrirDb()).get('meta', clave)
}

export async function escribirMeta(clave, valor) {
  return (await abrirDb()).put('meta', valor, clave)
}

// ---------- padrón ----------

export async function cargarPadron() {
  return (await abrirDb()).getAll('padron')
}

// Reemplaza el padrón conservando las marcas locales de check-in
// (checkin_at / checkin_puerta) de los registros ya existentes.
export async function guardarPadron(asistentes, version) {
  const db = await abrirDb()
  const tx = db.transaction(['padron', 'meta'], 'readwrite')
  const padron = tx.objectStore('padron')
  const previos = await padron.getAll()
  const marcas = new Map()
  for (const p of previos) {
    if (p.checkin_at) marcas.set(p.id, { checkin_at: p.checkin_at, checkin_puerta: p.checkin_puerta })
  }
  await padron.clear()
  for (const a of asistentes) {
    padron.put({ ...a, ...(marcas.get(a.id) || {}) })
  }
  const meta = tx.objectStore('meta')
  meta.put(version, 'padron_version')
  meta.put(asistentes.length, 'padron_count')
  meta.put(new Date().toISOString(), 'padron_actualizado')
  await tx.done
}

// Marca local de "ya registrado". Conserva la PRIMERA hora registrada
// (si se vuelve a registrar "de todos modos", el aviso sigue mostrando
// la hora original).
export async function marcarCheckinLocal(idAsistente, checkinAt, puerta) {
  const db = await abrirDb()
  const tx = db.transaction('padron', 'readwrite')
  const registro = await tx.store.get(idAsistente)
  if (registro && !registro.checkin_at) {
    registro.checkin_at = checkinAt
    registro.checkin_puerta = puerta
    tx.store.put(registro)
  }
  await tx.done
}

// ---------- cola de check-ins ----------

export async function agregarACola(item) {
  return (await abrirDb()).put('cola', { ...item, sincronizado: false, sincronizado_at: null })
}

// Los confirmados NO se borran: se marcan sincronizados (auditoría local).
export async function obtenerPendientes() {
  const todos = await (await abrirDb()).getAll('cola')
  return todos
    .filter((c) => !c.sincronizado)
    .sort((a, b) => (a.timestamp_local < b.timestamp_local ? -1 : 1))
}

export async function contarPendientes() {
  return (await obtenerPendientes()).length
}

// Borra TODO lo local: padrón, cola y configuración. Se usa para
// reiniciar un dispositivo de demostración y para el borrado obligatorio
// de datos personales al cierre del evento.
export async function restablecerDispositivo() {
  const db = await abrirDb()
  const tx = db.transaction(['padron', 'cola', 'meta'], 'readwrite')
  tx.objectStore('padron').clear()
  tx.objectStore('cola').clear()
  tx.objectStore('meta').clear()
  await tx.done
}

export async function marcarSincronizados(idsLocales) {
  const db = await abrirDb()
  const tx = db.transaction('cola', 'readwrite')
  const ahora = new Date().toISOString()
  for (const id of idsLocales) {
    const registro = await tx.store.get(id)
    if (registro) {
      registro.sincronizado = true
      registro.sincronizado_at = ahora
      tx.store.put(registro)
    }
  }
  await tx.done
}
