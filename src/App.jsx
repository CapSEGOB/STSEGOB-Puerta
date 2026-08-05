import { useCallback, useEffect, useRef, useState } from 'react'
import BarraEstado from './components/BarraEstado'
import PantallaPuerta from './components/PantallaPuerta'
import PantallaConfig from './components/PantallaConfig'
import PantallaPase from './components/PantallaPase'
import Tablero from './components/Tablero'
import { leerMeta, cargarPadron, contarPendientes, agregarACola, marcarCheckinLocal } from './lib/db'
import { sincronizar } from './lib/sync'
import { normalizarTexto } from './lib/normalizar'

// Enrutado por hash, sin router externo:
//   #/           pantalla de puerta
//   #/p/:folio   pase público (invitados; requiere red)
//   #/config     configuración del dispositivo
//   #/tablero    tablero de control (proyector / coordinador; requiere red)
function rutaActual() {
  const h = window.location.hash || '#/'
  if (h.startsWith('#/p/')) return { nombre: 'pase', folio: decodeURIComponent(h.slice(4)) }
  if (h.startsWith('#/tablero')) return { nombre: 'tablero' }
  if (h.startsWith('#/config')) return { nombre: 'config' }
  return { nombre: 'puerta' }
}

export default function App() {
  const [ruta, setRuta] = useState(rutaActual)
  const [config, setConfig] = useState(null)
  const [padron, setPadron] = useState([])
  const [padronInfo, setPadronInfo] = useState({ version: null, count: 0, actualizado: null })
  const [pendientes, setPendientes] = useState(0)
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [cargado, setCargado] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const timerAviso = useRef(null)

  const mostrarAviso = useCallback((texto, tipo = 'info') => {
    setAviso({ texto, tipo })
    clearTimeout(timerAviso.current)
    timerAviso.current = setTimeout(() => setAviso(null), 6000)
  }, [])

  // Carga config, padrón (a memoria, para búsquedas instantáneas) y pendientes.
  const recargarTodo = useCallback(async () => {
    const cfg = await leerMeta('config')
    setConfig(cfg || null)
    const [version, count, actualizado, lista, numPendientes] = await Promise.all([
      leerMeta('padron_version'),
      leerMeta('padron_count'),
      leerMeta('padron_actualizado'),
      cargarPadron(),
      contarPendientes(),
    ])
    setPadronInfo({ version: version || null, count: count || 0, actualizado: actualizado || null })
    setPadron(lista.map((a) => ({ ...a, nombre_norm: normalizarTexto(a.nombre) })))
    setPendientes(numPendientes)
    setCargado(true)
  }, [])

  const ejecutarSync = useCallback(
    async (manual = false) => {
      setSincronizando(true)
      const r = await sincronizar({ manual })
      setSincronizando(false)
      setPendientes(await contarPendientes())
      if (r.ok) {
        // Un solo aviso combinado: la confirmación de envío no se pierde y el
        // texto de duplicados es neutro (los "avisos" incluyen también los
        // registros hechos a propósito con "Registrar de todos modos").
        const partes = []
        if (r.enviados > 0) {
          partes.push(`Sincronizado: ${r.enviados} registro(s) enviados.`)
        } else if (manual) {
          partes.push('Todo estaba al día.')
        }
        if (r.avisos?.length) {
          partes.push(
            `Atención: ${r.avisos.length} persona(s) ya tenían un registro previo (posible duplicado entre puertas).`,
          )
        }
        if (partes.length > 0) {
          mostrarAviso(partes.join(' '), r.avisos?.length ? 'warn' : 'ok')
        }
      } else if (manual) {
        if (r.motivo === 'sin_conexion') {
          mostrarAviso('Sin conexión. Se enviará solo cuando regrese el internet.', 'warn')
        } else if (r.motivo === 'error') {
          mostrarAviso('No se pudo sincronizar. Se reintentará automáticamente.', 'warn')
        }
      }
    },
    [mostrarAviso],
  )

  // Registro de check-in: escribe en la cola local, marca al asistente y
  // dispara sincronización si hay red. Nunca depende del servidor.
  // Alta en sitio: asistente.id es null (no está en el padrón); el item lleva
  // {nombre, telefono} y el servidor crea al asistente al sincronizar.
  const registrarCheckin = useCallback(
    async (asistente, metodo, folioCapturado = null, extras = null) => {
      const item = {
        id_local: crypto.randomUUID(),
        asistente_id: asistente.id ?? null,
        folio_capturado: folioCapturado,
        metodo,
        puerta: String(config?.puerta || ''),
        dispositivo_id: config?.dispositivo_id || null,
        operador: config?.operador || null,
        timestamp_local: new Date().toISOString(),
        // Detalles del registro (opcionales; defaults seguros)
        representante: extras?.representante === true,
        representante_nombre: extras?.representante_nombre ?? null,
        acompanantes:
          Number.isInteger(extras?.acompanantes) && extras.acompanantes > 0 ? extras.acompanantes : 0,
        acompanantes_nombres: extras?.acompanantes_nombres ?? null,
        ...(metodo === 'alta_sitio'
          ? { nombre: asistente.nombre, telefono: asistente.telefono ?? null }
          : {}),
      }
      await agregarACola(item)
      if (asistente.id != null) {
        await marcarCheckinLocal(asistente.id, item.timestamp_local, item.puerta)
        setPadron((prev) =>
          prev.map((a) =>
            a.id === asistente.id && !a.checkin_at
              ? { ...a, checkin_at: item.timestamp_local, checkin_puerta: item.puerta }
              : a,
          ),
        )
      }
      setPendientes(await contarPendientes())
      if (navigator.onLine) void ejecutarSync(false)
      return item
    },
    [config, ejecutarSync],
  )

  // Arranque + rutas
  useEffect(() => {
    void recargarTodo()
    const alCambiarHash = () => setRuta(rutaActual())
    window.addEventListener('hashchange', alCambiarHash)
    return () => window.removeEventListener('hashchange', alCambiarHash)
  }, [recargarTodo])

  // Conectividad + sincronización automática: al abrir, al volver la red
  // y cada 60 segundos.
  useEffect(() => {
    const alConectar = () => {
      setEnLinea(true)
      void ejecutarSync(false)
    }
    const alDesconectar = () => setEnLinea(false)
    window.addEventListener('online', alConectar)
    window.addEventListener('offline', alDesconectar)
    const temporizador = setInterval(() => void ejecutarSync(false), 60000)
    void ejecutarSync(false)
    return () => {
      window.removeEventListener('online', alConectar)
      window.removeEventListener('offline', alDesconectar)
      clearInterval(temporizador)
    }
  }, [ejecutarSync])

  // Pase público: pantalla completa, sin barra de operador.
  if (ruta.nombre === 'pase') {
    return <PantallaPase folio={ruta.folio} />
  }

  if (!cargado) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center">
        <p className="text-white/80 text-2xl font-bold animate-pulse">Puerta STSEGOB…</p>
      </div>
    )
  }

  // Tablero de control: pantalla completa para proyector, sin barra de operador.
  if (ruta.nombre === 'tablero') {
    return <Tablero claveConfig={config?.clave || ''} />
  }

  const configurada = Boolean(config?.puerta && config?.operador && config?.clave && padronInfo.count > 0)
  const mostrarConfig = ruta.nombre === 'config' || !configurada

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <BarraEstado
        enLinea={enLinea}
        pendientes={pendientes}
        config={config}
        sincronizando={sincronizando}
        onSincronizar={() => void ejecutarSync(true)}
      />
      {aviso && (
        <div
          className={`px-4 py-3 text-center font-bold text-lg ${
            aviso.tipo === 'ok'
              ? 'bg-emerald-100 text-emerald-900'
              : aviso.tipo === 'warn'
                ? 'bg-amber-100 text-amber-900'
                : 'bg-slate-200 text-slate-800'
          }`}
        >
          {aviso.texto}
        </div>
      )}
      {mostrarConfig ? (
        <PantallaConfig
          key={configurada ? 'edicion' : 'primera'}
          config={config}
          padronInfo={padronInfo}
          alGuardar={recargarTodo}
          primeraVez={!configurada}
        />
      ) : (
        <PantallaPuerta padron={padron} onRegistrar={registrarCheckin} />
      )}
    </div>
  )
}
