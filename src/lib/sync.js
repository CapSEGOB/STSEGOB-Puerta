// Sincronización de la cola local hacia Supabase (RPC evento_sync_checkins).
// Lotes de hasta 200, idempotente por id_local, con backoff simple.
import { supabase } from './supabase'
import { leerMeta, obtenerPendientes, marcarSincronizados } from './db'

const TAM_LOTE = 200

let sincronizando = false
let fallos = 0
let proximoIntento = 0

// Cada item enviado lleva SOLO los campos del contrato (sin banderas locales).
// Los de alta en sitio llevan además {nombre, telefono}: el servidor crea al
// asistente (origen 'alta_sitio', folio generado server-side) y liga el check-in.
function aItemRpc(c) {
  return {
    id_local: c.id_local,
    asistente_id: c.asistente_id ?? null,
    folio_capturado: c.folio_capturado ?? null,
    metodo: c.metodo,
    puerta: c.puerta ?? null,
    dispositivo_id: c.dispositivo_id ?? null,
    operador: c.operador ?? null,
    timestamp_local: c.timestamp_local,
    ...(c.metodo === 'alta_sitio' ? { nombre: c.nombre ?? null, telefono: c.telefono ?? null } : {}),
  }
}

export function estaSincronizando() {
  return sincronizando
}

export async function sincronizar({ manual = false } = {}) {
  if (sincronizando) return { ok: false, motivo: 'en_curso' }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, motivo: 'sin_conexion' }
  }
  // Backoff simple: los intentos automáticos respetan la espera; el botón
  // manual siempre lo intenta.
  if (!manual && Date.now() < proximoIntento) return { ok: false, motivo: 'backoff' }

  const config = await leerMeta('config')
  if (!config?.clave) return { ok: false, motivo: 'sin_clave' }

  sincronizando = true
  try {
    let enviados = 0
    const avisos = []
    for (;;) {
      const pendientes = await obtenerPendientes()
      if (pendientes.length === 0) break
      const lote = pendientes.slice(0, TAM_LOTE)
      const { data, error } = await supabase.rpc('evento_sync_checkins', {
        p_clave: config.clave,
        p_items: lote.map(aItemRpc),
      })
      if (error) throw new Error(error.message || 'error_de_red')
      if (!data?.ok) throw new Error(data?.error || 'respuesta_invalida')
      // Insertados o ya existentes: en ambos casos el servidor ya los tiene.
      await marcarSincronizados(lote.map((i) => i.id_local))
      enviados += lote.length
      if (Array.isArray(data.avisos)) avisos.push(...data.avisos)
      if (pendientes.length <= TAM_LOTE) break
    }
    fallos = 0
    proximoIntento = 0
    return { ok: true, enviados, avisos }
  } catch (e) {
    fallos += 1
    proximoIntento = Date.now() + Math.min(15000 * 2 ** (fallos - 1), 300000)
    return { ok: false, motivo: 'error', detalle: e?.message || String(e) }
  } finally {
    sincronizando = false
  }
}
