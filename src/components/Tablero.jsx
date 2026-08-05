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

function TarjetaCifra({ etiqueta, valor, acento = false }) {
  return (
    <div
      className={`rounded-2xl p-5 sm:p-6 text-center shadow-lg ${
        acento ? 'bg-brand-green text-white' : 'bg-white/10 text-white'
      }`}
    >
      <p className={`text-6xl sm:text-7xl font-black tabular-nums ${acento ? '' : 'text-brand-gold'}`}>
        {valor}
      </p>
      <p className={`mt-2 text-lg sm:text-xl font-bold uppercase tracking-wide ${acento ? 'text-white/90' : 'text-white/70'}`}>
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
      <div className="min-h-screen bg-brand-dark flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="text-4xl font-black text-white text-center">Tablero del evento</h1>
          <p className="text-white/70 text-lg text-center mt-2">
            Escribe la clave del evento para conectar.
          </p>
          {error === 'clave_invalida' && (
            <p className="mt-4 rounded-xl bg-red-500/20 text-red-200 font-bold text-center px-4 py-3">
              La clave no es válida. Verifícala con el coordinador.
            </p>
          )}
          {error === 'red' && (
            <p className="mt-4 rounded-xl bg-amber-500/20 text-amber-200 font-bold text-center px-4 py-3">
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
            className="mt-6 w-full text-2xl p-4 rounded-2xl bg-white/10 border-2 border-white/20 text-white placeholder-white/40 focus:border-brand-green focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setError(null)
              setClave(claveInput.trim())
            }}
            disabled={!claveInput.trim()}
            className="mt-4 w-full py-4 rounded-2xl bg-brand-green text-white text-2xl font-black shadow-lg active:scale-[0.98] transition disabled:opacity-50"
          >
            Conectar
          </button>
          <a href="#/" className="block text-center text-white/50 text-lg mt-6 underline underline-offset-2">
            Volver a la puerta
          </a>
        </div>
      </div>
    )
  }

  const porProcedencia = [...(stats?.por_procedencia || [])].sort((a, b) => b.llegaron - a.llegaron)

  return (
    <div className="min-h-screen bg-vino-oscuro text-white">
      <div className="cenefa" />
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Encabezado */}
        <header className="flex items-center gap-3 flex-wrap">
          <div className="flex-1">
            <p className="kicker text-xs sm:text-sm">Secretaría de Gobernación</p>
            <h1 className="text-3xl sm:text-4xl font-black mt-0.5">Tablero del evento</h1>
          </div>
          {stats?.actualizado && (
            <span className="px-3 py-2 rounded-lg bg-white/10 text-white/80 font-bold text-lg tabular-nums">
              Actualizado {horaSello(stats.actualizado)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void consultar(clave)}
            disabled={cargando}
            className="p-3 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 disabled:opacity-50"
            title="Actualizar ahora"
            aria-label="Actualizar ahora"
          >
            <IconSync className={`w-6 h-6 ${cargando ? 'animate-spin' : ''}`} />
          </button>
          <a
            href="#/"
            className="px-3 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 font-bold text-lg"
          >
            Puerta
          </a>
        </header>

        {/* Aviso de conexión: se conservan las últimas cifras conocidas */}
        {error === 'red' && (
          <div className="flex items-center gap-3 rounded-xl bg-amber-500/20 text-amber-200 font-bold text-lg px-4 py-3">
            <IconAlerta className="w-7 h-7 shrink-0" />
            <span>
              Sin conexión con el servidor.
              {stats?.actualizado
                ? ` Mostrando cifras de las ${horaSello(stats.actualizado)}.`
                : ''}{' '}
              Se reintenta cada 30 segundos.
            </span>
          </div>
        )}

        {!stats && !error && (
          <p className="text-white/70 text-2xl font-bold text-center py-16 animate-pulse">
            Cargando cifras del evento…
          </p>
        )}

        {stats && (
          <>
            {/* Cifra principal */}
            <div className="rounded-3xl bg-gradient-to-br from-vino to-vino-claro border border-oro/40 text-white p-6 sm:p-8 text-center shadow-xl">
              <p className="text-7xl sm:text-9xl font-black tabular-nums leading-none">
                {stats.llegaron}
                <span className="text-4xl sm:text-6xl text-oro-claro font-black"> de {stats.total_padron}</span>
              </p>
              <p className="kicker mt-4 text-xl sm:text-2xl">Llegaron</p>
            </div>

            {/* Tarjetas secundarias */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <TarjetaCifra etiqueta="Faltan" valor={stats.faltan} />
              <TarjetaCifra etiqueta="Representantes" valor={stats.representantes} />
              <TarjetaCifra etiqueta="Acompañantes" valor={stats.acompanantes} />
              <TarjetaCifra etiqueta="Alta en sitio" valor={stats.alta_sitio} />
            </div>

            {/* Por procedencia */}
            {porProcedencia.length > 0 && (
              <section className="rounded-2xl bg-white/10 p-4 sm:p-5 overflow-x-auto">
                <h2 className="kicker text-base sm:text-lg mb-3">Por procedencia</h2>
                <table className="w-full text-left text-lg sm:text-xl">
                  <thead>
                    <tr className="text-white/60 uppercase text-sm sm:text-base tracking-wide">
                      <th className="py-2 pr-3 font-black">Procedencia</th>
                      <th className="py-2 px-3 font-black text-right">Esperados</th>
                      <th className="py-2 px-3 font-black text-right">Llegaron</th>
                      <th className="py-2 px-3 font-black text-right">Repr.</th>
                      <th className="py-2 pl-3 font-black text-right">Acomp.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porProcedencia.map((p) => (
                      <tr key={p.procedencia || '(sin dato)'} className="border-t border-white/10">
                        <td className="py-2.5 pr-3 font-bold">{p.procedencia || 'Sin procedencia'}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-white/80">{p.total}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-black text-brand-gold">
                          {p.llegaron}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-white/80">{p.representantes}</td>
                        <td className="py-2.5 pl-3 text-right tabular-nums text-white/80">{p.acompanantes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* Chips por puerta y por método */}
            <div className="grid sm:grid-cols-2 gap-4">
              {(stats.por_puerta || []).length > 0 && (
                <section className="rounded-2xl bg-white/10 p-4 sm:p-5">
                  <h2 className="kicker text-base mb-3">Por puerta</h2>
                  <div className="flex flex-wrap gap-2">
                    {stats.por_puerta.map((p) => (
                      <span
                        key={p.puerta || '(sin dato)'}
                        className="px-4 py-2 rounded-full bg-white/10 text-lg font-bold tabular-nums"
                      >
                        Puerta {p.puerta || '?'} · <span className="text-brand-gold font-black">{p.n}</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}
              {(stats.por_metodo || []).length > 0 && (
                <section className="rounded-2xl bg-white/10 p-4 sm:p-5">
                  <h2 className="kicker text-base mb-3">Por método</h2>
                  <div className="flex flex-wrap gap-2">
                    {stats.por_metodo.map((m) => (
                      <span
                        key={m.metodo || '(sin dato)'}
                        className="px-4 py-2 rounded-full bg-white/10 text-lg font-bold tabular-nums"
                      >
                        {ETIQUETAS_METODO[m.metodo] || m.metodo || 'Otro'} ·{' '}
                        <span className="text-brand-gold font-black">{m.n}</span>
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
