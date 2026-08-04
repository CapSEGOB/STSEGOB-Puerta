import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { escribirMeta, leerMeta, guardarPadron, contarPendientes, restablecerDispositivo } from '../lib/db'
import { IconDescarga, IconAlerta } from './Iconos'

const PUERTAS = ['1', '2', '3', '4', '5', '6', '7', '8']

function fechaCorta(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ''
  }
}

export default function PantallaConfig({ config, padronInfo, alGuardar, primeraVez }) {
  const [puerta, setPuerta] = useState(config?.puerta || '')
  const [operador, setOperador] = useState(config?.operador || '')
  const [clave, setClave] = useState(config?.clave || '')
  const [mensaje, setMensaje] = useState(null)
  const [descargando, setDescargando] = useState(false)
  const [reset, setReset] = useState(null) // { pendientes } | null
  const [borrando, setBorrando] = useState(false)
  const dispositivoId = useRef(config?.dispositivo_id || crypto.randomUUID())

  async function pedirReset() {
    setReset({ pendientes: await contarPendientes() })
  }

  async function ejecutarReset() {
    setBorrando(true)
    try {
      await restablecerDispositivo()
      window.location.hash = '#/config'
      window.location.reload()
    } catch {
      setBorrando(false)
      setReset(null)
      setMensaje({ tipo: 'error', texto: 'No se pudo borrar. Cierra la app y vuelve a intentar.' })
    }
  }

  const listaParaOperar = puerta && operador.trim() && clave.trim() && padronInfo.count > 0

  async function guardarConfiguracion(silencioso = false) {
    if (!puerta) {
      setMensaje({ tipo: 'error', texto: 'Elige el número de puerta.' })
      return false
    }
    if (!operador.trim()) {
      setMensaje({ tipo: 'error', texto: 'Escribe el nombre de quien atiende este dispositivo.' })
      return false
    }
    if (!clave.trim()) {
      setMensaje({ tipo: 'error', texto: 'Escribe la clave del dispositivo (pídela al coordinador).' })
      return false
    }
    await escribirMeta('config', {
      puerta: String(puerta),
      operador: operador.trim(),
      clave: clave.trim(),
      dispositivo_id: dispositivoId.current,
    })
    await alGuardar()
    if (!silencioso) setMensaje({ tipo: 'ok', texto: 'Configuración guardada.' })
    return true
  }

  async function descargarPadron() {
    setMensaje(null)
    const ok = await guardarConfiguracion(true)
    if (!ok) return
    if (!navigator.onLine) {
      setMensaje({ tipo: 'error', texto: 'Sin conexión a internet. Conéctate para descargar el padrón.' })
      return
    }
    setDescargando(true)
    try {
      const { data, error } = await supabase.rpc('evento_padron', { p_clave: clave.trim() })
      if (error) throw new Error('No se pudo conectar con el servidor. Intenta de nuevo.')
      if (!data?.ok) {
        throw new Error(
          data?.error === 'clave_invalida'
            ? 'La clave del dispositivo no es válida. Verifícala con el coordinador.'
            : 'El servidor respondió algo inesperado. Intenta de nuevo.',
        )
      }
      const versionLocal = await leerMeta('padron_version')
      if (versionLocal && versionLocal === data.version) {
        // Re-descarga solo si la versión cambia.
        setMensaje({ tipo: 'ok', texto: `El padrón ya está al día: ${padronInfo.count} personas.` })
      } else {
        const asistentes = data.asistentes || []
        await guardarPadron(asistentes, data.version)
        setMensaje({ tipo: 'ok', texto: `Padrón descargado: ${asistentes.length} personas.` })
      }
      await alGuardar()
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setDescargando(false)
    }
  }

  return (
    <main className="flex-1 w-full max-w-lg mx-auto p-4 pb-10 space-y-4">
      <div className="bg-brand-dark text-white rounded-2xl p-5 shadow-lg">
        <h1 className="text-2xl font-black">Configuración del dispositivo</h1>
        <p className="text-white/75 mt-1">
          {primeraVez
            ? 'Primera vez: llena estos datos y descarga el padrón para empezar.'
            : 'Cambia los datos solo si te lo pide el coordinador.'}
        </p>
      </div>

      {mensaje && (
        <div
          className={`rounded-xl px-4 py-3 font-bold text-lg ${
            mensaje.tipo === 'ok' ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-800'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <section className="bg-white rounded-2xl shadow border border-gray-100 p-5 space-y-5">
        <div>
          <label className="block text-base font-bold text-gray-800 mb-2">¿En qué puerta estás?</label>
          <div className="grid grid-cols-4 gap-2">
            {PUERTAS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPuerta(n)}
                className={`py-4 rounded-xl text-2xl font-black border-2 transition ${
                  puerta === n
                    ? 'bg-brand-dark text-white border-brand-dark shadow'
                    : 'bg-white text-brand-dark border-gray-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="operador" className="block text-base font-bold text-gray-800 mb-2">
            Tu nombre (operador)
          </label>
          <input
            id="operador"
            type="text"
            value={operador}
            onChange={(e) => setOperador(e.target.value)}
            placeholder="Ej. Laura Méndez"
            className="w-full text-xl p-4 rounded-xl border-2 border-gray-300 focus:border-brand-green focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="clave" className="block text-base font-bold text-gray-800 mb-2">
            Clave del dispositivo
          </label>
          <input
            id="clave"
            type="text"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="La clave compartida del evento"
            className="w-full text-xl p-4 rounded-xl border-2 border-gray-300 focus:border-brand-green focus:outline-none"
          />
          <p className="text-sm text-gray-500 mt-1.5">Pídela al coordinador del evento.</p>
        </div>

        <button
          type="button"
          onClick={() => guardarConfiguracion(false)}
          className="w-full py-4 rounded-xl bg-brand-teal text-white text-xl font-black shadow active:scale-[0.98] transition"
        >
          Guardar configuración
        </button>
      </section>

      <section className="bg-white rounded-2xl shadow border border-gray-100 p-5 space-y-4">
        <h2 className="text-xl font-black text-gray-900">Padrón de invitados</h2>
        {padronInfo.count > 0 ? (
          <div className="bg-slate-50 rounded-xl p-4 text-gray-700">
            <p className="text-lg">
              <span className="font-black text-2xl text-brand-dark">{padronInfo.count}</span> personas en este
              dispositivo
            </p>
            <p className="text-sm mt-1">
              Versión: <span className="font-mono">{String(padronInfo.version || '').slice(0, 8)}</span>
              {padronInfo.actualizado ? ` · Descargado: ${fechaCorta(padronInfo.actualizado)}` : ''}
            </p>
          </div>
        ) : (
          <p className="text-gray-600 text-lg">Aún no hay padrón en este dispositivo.</p>
        )}
        <button
          type="button"
          onClick={descargarPadron}
          disabled={descargando}
          className="w-full py-4 rounded-xl bg-brand-green text-white text-xl font-black shadow flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-60"
        >
          <IconDescarga className="w-6 h-6" />
          {descargando ? 'Descargando…' : padronInfo.count > 0 ? 'Actualizar padrón' : 'Descargar padrón'}
        </button>
        <p className="text-sm text-gray-500">
          Solo se vuelve a descargar si hay una versión nueva. Se necesita internet.
        </p>
      </section>

      {listaParaOperar && (
        <a
          href="#/"
          className="block w-full text-center py-5 rounded-2xl bg-brand-dark text-white text-2xl font-black shadow-lg active:scale-[0.98] transition"
        >
          Ir a la puerta →
        </a>
      )}

      <section className="bg-white rounded-2xl shadow border border-red-200 p-5 space-y-3">
        <h2 className="text-xl font-black text-red-800">Zona de borrado</h2>
        <p className="text-gray-600">
          Borra el padrón, los registros y la configuración de <span className="font-bold">este dispositivo</span>.
          Úsalo solo para reiniciar una demostración o al cierre del evento.
        </p>
        <button
          type="button"
          onClick={() => void pedirReset()}
          className="w-full py-4 rounded-xl bg-white border-2 border-red-300 text-red-700 text-xl font-black active:scale-[0.98] transition"
        >
          Restablecer este dispositivo
        </button>
      </section>

      {reset && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-t-8 border-red-500">
            <div className="flex items-start gap-3">
              <IconAlerta className="w-10 h-10 text-red-500 shrink-0" />
              <div>
                <p className="text-2xl font-black text-gray-900">¿Borrar todo?</p>
                <p className="text-lg text-gray-700 mt-1">
                  Se borrarán el padrón, la configuración y los registros guardados en este dispositivo.
                </p>
                {reset.pendientes > 0 && (
                  <p className="text-lg font-black text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mt-3">
                    ¡Hay {reset.pendientes} registro(s) SIN SINCRONIZAR que se perderán! Sincroniza primero.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => void ejecutarReset()}
                disabled={borrando}
                className="w-full py-4 rounded-xl bg-red-600 text-white text-xl font-black active:scale-95 transition disabled:opacity-60"
              >
                {borrando ? 'Borrando…' : 'Sí, borrar todo'}
              </button>
              <button
                type="button"
                onClick={() => setReset(null)}
                disabled={borrando}
                className="w-full py-4 rounded-xl bg-gray-100 text-gray-700 text-xl font-bold active:scale-95 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 pt-2">
        ID del dispositivo: <span className="font-mono">{dispositivoId.current.slice(0, 8)}</span>
      </p>
    </main>
  )
}
