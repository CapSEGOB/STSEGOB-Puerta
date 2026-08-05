import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { IconSync, IconAlerta } from './Iconos'

// Tablero de control para proyector / pantalla del coordinador.
// Consulta evento_stats(p_clave) al montar y cada 30 segundos. Requiere red.
// La clave viene de la config local del dispositivo; si no hay, se pide una
// clave que vive SOLO en memoria (no se persiste).

const ETIQUETAS_METODO = {
  busqueda: 'Búsqueda',
  folio: 'Folio',
  qr: 'QR',
  alta_sitio: 'Alta en sitio',
}

const FILAS_VISIBLES = 12

function horaSello(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return ''
  }
}

function TarjetaCifra({ etiqueta, valor }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5 sm:p-6 text-center">
      <p className="text-5xl sm:text-6xl font-black tabular-nums text-brand-dark">{valor}</p>
      <p className="mt-2 text-sm sm:text-base font-bold uppercase tracking-wide text-gray-500">
        {etiqueta}
      </p>
    </div>
  )
}

export default function Tablero({ claveConfig = '' }) {
  const [clave, setClave] = useState(claveConfig)
  const [claveInput, setClaveInput] = useState('')
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null) // 'clave_invalida' | 'red' | null
  const [cargando, setCargando] = useState(false)
  const [verTodas, setVerTodas] = useState(false)
  const consultandoRef = useRef(false)

  const consultar = useCallback(async (k) => {
    if (!k || consultandoRef.current) return
    consultandoRef.current = true
    setCargando(true)
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setError('red')
        return
      }
      const { data, error: err } = await supabase.rpc('evento_stats', { p_clave: k })
      if (err) {
        setError('red')
        return
      }
      if (!data?.ok) {
        if (data?.error === 'clave_invalida') {
          setStats(null)
          setError('clave_invalida')
          setClave('') // volver a pedir la clave
        } else {
          setError('red')
        }
        return
      }
      setStats(data)
      setError(null)
    } catch {
      setError('red')
    } finally {
      consultandoRef.current = false
      setCargando(false)
    }
  }, [])

  // Al conectar y cada 30 segundos.
  useEffect(() => {
    if (!clave) return
    void consultar(clave)
    const temporizador = setInterval(() => void consultar(clave), 30000)
    return () => clearInterval(temporizador)
  }, [clave, consultar])

  // ---------- Sin clave: pedirla (solo en memoria, no se persiste) ----------
  if (!clave) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h1 className="text-3xl font-black text-brand-dark text-center">Tablero del evento</h1>
          <p className="text-gray-500 text-lg text-center mt-2">
            Escribe la clave del evento para conectar.
          </p>
          {error === 'clave_invalida' && (
            <p className="mt-4 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold text-center px-4 py-3">
              La clave no es válida. Verifícala con el coordinador.
            </p>
          )}
          {error === 'red' && (
            <p className="mt-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold text-center px-4 py-3">
              Sin conexión con el servidor. Revisa el internet e intenta de nuevo.
            </p>
          )}
          <input
            type="text"
            autoFocus
            value={claveInput}
            onChange={(e) => setClaveInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && claveInput.trim()) {
                setError(null)
                setClave(claveInput.trim())
              }
            }}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Clave del evento"
            className="mt-6 w-full text-2xl p-4 rounded-2xl border-2 border-gray-300 focus:border-brand-green focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setError(null)
              setClave(claveInput.trim())
            }}
            disabled={!claveInput.trim()}
            className="mt-4 w-full py-4 rounded-2xl bg-brand-dark text-white text-2xl font-black shadow active:scale-[0.98] transition disabled:opacity-50"
          >
            Conectar
          </button>
          <a
            href="#/"
            className="block text-center text-gray-400 text-lg mt-6 underline underline-offset-2"
          >
            Volver a la puerta
          </a>
        </div>
      </div>
    )
  }

  const porProcedencia = [...(stats?.por_procedencia || [])].sort(
    (a, b) => b.llegaron - a.llegaron || b.total - a.total,
  )
  const filas = verTodas ? porProcedencia : porProcedencia.slice(0, FILAS_VISIBLES)
  const ocultas = porProcedencia.length - filas.length

  return (
    <div className="min-h-screen bg-slate-100 text-gray-900">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Encabezado */}
        <header className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-black text-brand-dark flex-1">
            Tablero del evento
          </h1>
          {stats?.actualizado && (
            <span className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-500 font-bold text-sm tabular-nums">
              {horaSello(stats.actualizado)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void consultar(clave)}
            disabled={cargando}
            className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            title="Actualizar ahora"
            aria-label="Actualizar ahora"
          >
            <IconSync className={`w-5 h-5 ${cargando ? 'animate-spin' : ''}`} />
          </button>
          <a
            href="#/"
            className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold"
          >
            Puerta
          </a>
        </header>

        {/* Aviso de conexión: se conservan las últimas cifras conocidas */}
        {error === 'red' && (
          <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold px-4 py-3">
            <IconAlerta className="w-6 h-6 shrink-0" />
            <span>
              Sin conexión con el servidor.
              {stats?.actualizado ? ` Mostrando cifras de las ${horaSello(stats.actualizado)}.` : ''}{' '}
              Se reintenta cada 30 segundos.
            </span>
          </div>
        )}

        {!stats && !error && (
          <p className="text-gray-400 text-2xl font-bold text-center py-16 animate-pulse">
            Cargando cifras del evento…
          </p>
        )}

        {stats && (
          <>
            {/* Cifra principal */}
            <div className="rounded-3xl bg-brand-dark text-white p-6 sm:p-8 text-center shadow-sm">
              <p className="text-7xl sm:text-8xl font-black tabular-nums leading-none">
                {stats.llegaron}
                <span className="text-3xl sm:text-5xl text-white/60 font-black">
                  {' '}
                  de {stats.total_padron}
                </span>
              </p>
              <p className="mt-3 text-lg sm:text-xl font-bold uppercase tracking-wide text-white/80">
                Llegaron
              </p>
            </div>

            {/* Tarjetas secundarias */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <TarjetaCifra etiqueta="Faltan" valor={stats.faltan} />
              <TarjetaCifra etiqueta="Representantes" valor={stats.representantes} />
              <TarjetaCifra etiqueta="Acompañantes" valor={stats.acompanantes} />
              <TarjetaCifra etiqueta="Alta en sitio" valor={stats.alta_sitio} />
            </div>

            {/* Avance por procedencia: lista vertical, sin scroll horizontal */}
            {porProcedencia.length > 0 && (
              <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-5">
                <h2 className="text-lg font-black text-brand-dark mb-3">Avance por procedencia</h2>
                <div className="space-y-2.5">
                  {filas.map((p) => {
                    const pct = p.total > 0 ? Math.round((p.llegaron / p.total) * 100) : 0
                    return (
                      <div key={p.procedencia || '(sin dato)'}>
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="font-bold text-gray-800 truncate">
                            {p.procedencia || 'Sin procedencia'}
                          </p>
                          <p className="shrink-0 tabular-nums font-black text-brand-dark">
                            {p.llegaron}
                            <span className="text-gray-400 font-bold">/{p.total}</span>
                          </p>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-brand-green transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {(ocultas > 0 || verTodas) && (
                  <button
                    type="button"
                    onClick={() => setVerTodas((v) => !v)}
                    className="mt-4 w-full py-2.5 rounded-xl bg-slate-100 text-gray-600 font-bold hover:bg-slate-200 transition"
                  >
                    {verTodas ? 'Ver menos' : `Ver todas (${porProcedencia.length})`}
                  </button>
                )}
              </section>
            )}

            {/* Por puerta y por método */}
            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              {(stats.por_puerta || []).length > 0 && (
                <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-5">
                  <h2 className="text-lg font-black text-brand-dark mb-3">Por puerta</h2>
                  <div className="flex flex-wrap gap-2">
                    {stats.por_puerta.map((p) => (
                      <span
                        key={p.puerta || '(sin dato)'}
                        className="px-3.5 py-2 rounded-full bg-slate-100 text-gray-700 font-bold tabular-nums"
                      >
                        Puerta {p.puerta || '?'} ·{' '}
                        <span className="text-brand-dark font-black">{p.n}</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}
              {(stats.por_metodo || []).length > 0 && (
                <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-5">
                  <h2 className="text-lg font-black text-brand-dark mb-3">Por método</h2>
                  <div className="flex flex-wrap gap-2">
                    {stats.por_metodo.map((m) => (
                      <span
                        key={m.metodo || '(sin dato)'}
                        className="px-3.5 py-2 rounded-full bg-slate-100 text-gray-700 font-bold tabular-nums"
                      >
                        {ETIQUETAS_METODO[m.metodo] || m.metodo || 'Otro'} ·{' '}
                        <span className="text-brand-dark font-black">{m.n}</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
