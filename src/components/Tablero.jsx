import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { descargarExcel, descargarPdf } from '../lib/reporte'
import { IconSync, IconAlerta, IconDescarga } from './Iconos'

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
const PERSONAS_VISIBLES = 10

// Colores de la gráfica "cómo llegaron" (identidad nunca depende solo del
// color: cada segmento lleva etiqueta y la leyenda repite la cifra).
const COLOR_DIRECTOS = '#26645b' // brand-teal
const COLOR_REPRESENTANTES = '#b8853f' // dorado institucional, un paso más oscuro para contraste
const COLOR_PENDIENTES = '#e2e8f0' // pista vacía (slate-200)

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

function horaCorta(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function TarjetaCifra({ etiqueta, valor, detalle, color }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-5 text-center">
      <p className="text-4xl sm:text-5xl font-black tabular-nums text-brand-dark">{valor}</p>
      <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold uppercase tracking-wide text-gray-500">
        {color && <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />}
        {etiqueta}
      </p>
      {detalle && <p className="mt-1 text-sm text-gray-400 font-medium">{detalle}</p>}
    </div>
  )
}

// Barra apilada: directos | representantes | pendientes. Separación de 2px
// entre segmentos y etiqueta directa dentro del segmento cuando cabe.
function BarraLlegadas({ directos, representantes, pendientes }) {
  const total = directos + representantes + pendientes
  const partes = [
    { clave: 'directos', n: directos, color: COLOR_DIRECTOS, etiqueta: 'Directos', texto: 'text-white' },
    { clave: 'representantes', n: representantes, color: COLOR_REPRESENTANTES, etiqueta: 'Representantes', texto: 'text-white' },
    { clave: 'pendientes', n: pendientes, color: COLOR_PENDIENTES, etiqueta: 'Pendientes', texto: 'text-gray-600' },
  ]
  return (
    <div>
      <div className="flex h-9 rounded-lg overflow-hidden bg-white gap-0.5" role="img" aria-label={`Directos ${directos}, representantes ${representantes}, pendientes ${pendientes}`}>
        {partes
          .filter((p) => p.n > 0)
          .map((p) => {
            const pct = total ? (p.n / total) * 100 : 0
            return (
              <div
                key={p.clave}
                className={`flex items-center justify-center font-black tabular-nums ${p.texto} transition-all`}
                style={{ width: `${pct}%`, background: p.color, minWidth: pct > 0 ? 6 : 0 }}
                title={`${p.etiqueta}: ${p.n}`}
              >
                {pct >= 9 ? p.n : ''}
              </div>
            )
          })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm font-bold text-gray-600">
        {partes.map((p) => (
          <span key={p.clave} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm border border-black/10" style={{ background: p.color }} />
            {p.etiqueta}
            <span className="text-brand-dark font-black tabular-nums">{p.n}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function EtiquetaRepresentante({ nombre }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
      <span className="inline-block w-2 h-2 rounded-sm" style={{ background: COLOR_REPRESENTANTES }} />
      Representante{nombre ? `: ${nombre}` : ''}
    </span>
  )
}

function EtiquetaAcompanantes({ n, nombres }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-gray-700 text-xs font-bold"
      title={nombres || undefined}
    >
      +{n} acompañante{n === 1 ? '' : 's'}
    </span>
  )
}

// Lista de personas (pendientes o registradas) con "ver todos".
function ListaPersonas({ titulo, personas, vacio, registrados = false }) {
  const [todos, setTodos] = useState(false)
  const visibles = todos ? personas : personas.slice(0, PERSONAS_VISIBLES)
  const ocultas = personas.length - visibles.length
  return (
    <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-5">
      <h2 className="text-lg font-black text-brand-dark mb-3">
        {titulo} <span className="text-gray-400 font-bold tabular-nums">({personas.length})</span>
      </h2>
      {personas.length === 0 ? (
        <p className="text-gray-400 font-medium py-2">{vacio}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visibles.map((p) => (
            <li key={p.id} className="py-2.5 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 leading-tight">{p.nombre}</p>
                {p.procedencia && (
                  <p className="text-sm text-brand-teal font-semibold leading-snug mt-0.5">{p.procedencia}</p>
                )}
                {registrados && (p.representante || p.acompanantes > 0 || p.origen === 'alta_sitio') && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {p.representante && <EtiquetaRepresentante nombre={p.representante_nombre} />}
                    {p.acompanantes > 0 && (
                      <EtiquetaAcompanantes n={p.acompanantes} nombres={p.acompanantes_nombres} />
                    )}
                    {p.origen === 'alta_sitio' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                        Alta en sitio
                      </span>
                    )}
                  </div>
                )}
              </div>
              {registrados ? (
                <div className="shrink-0 text-right">
                  <p className="font-black tabular-nums text-brand-dark">{horaCorta(p.hora)}</p>
                  {p.puerta && <p className="text-xs text-gray-400 font-bold">Puerta {p.puerta}</p>}
                </div>
              ) : (
                p.grupo && (
                  <p className="shrink-0 max-w-[40%] text-right text-xs text-gray-400 font-bold leading-tight">
                    {p.grupo}
                  </p>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      {(ocultas > 0 || todos) && (
        <button
          type="button"
          onClick={() => setTodos((v) => !v)}
          className="mt-3 w-full py-2.5 rounded-xl bg-slate-100 text-gray-600 font-bold hover:bg-slate-200 transition"
        >
          {todos ? 'Ver menos' : `Ver todos (${personas.length})`}
        </button>
      )}
    </section>
  )
}

export default function Tablero({ claveConfig = '' }) {
  const [clave, setClave] = useState(claveConfig)
  const [claveInput, setClaveInput] = useState('')
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null) // 'clave_invalida' | 'red' | null
  const [cargando, setCargando] = useState(false)
  const [verTodas, setVerTodas] = useState(false)
  const [exportando, setExportando] = useState(null) // 'excel' | 'pdf' | null
  const [errorExporte, setErrorExporte] = useState(null)
  const consultandoRef = useRef(false)

  async function exportar(tipo) {
    if (exportando) return
    setExportando(tipo)
    setErrorExporte(null)
    try {
      const { data, error: err } = await supabase.rpc('evento_reporte', { p_clave: clave })
      if (err) {
        throw new Error(
          err.code === 'PGRST202'
            ? 'El servidor aún no tiene la función del reporte: falta aplicar la migración 008 en Supabase.'
            : 'No se pudo obtener el reporte. Revisa el internet e intenta de nuevo.',
        )
      }
      if (!data?.ok) {
        throw new Error(
          data?.error === 'clave_invalida'
            ? 'La clave del evento no es válida.'
            : 'El servidor no pudo generar el reporte.',
        )
      }
      if (tipo === 'excel') await descargarExcel(data)
      else await descargarPdf(data)
    } catch (e) {
      setErrorExporte(e.message || 'No se pudo generar el archivo.')
    } finally {
      setExportando(null)
    }
  }

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

  // Desglose por grupo (responsable) si el padrón lo trae; si no, por procedencia.
  const porGrupo = [...(stats?.por_grupo || [])].filter((g) => g.grupo && g.grupo !== 'Sin grupo')
  const usarGrupos = porGrupo.length > 1
  const porProcedencia = [...(stats?.por_procedencia || [])].sort(
    (a, b) => b.llegaron - a.llegaron || b.total - a.total,
  )
  const filas = verTodas ? porProcedencia : porProcedencia.slice(0, FILAS_VISIBLES)
  const ocultas = porProcedencia.length - filas.length

  // Campos nuevos (migración 010); si el servidor aún no los tiene, se
  // derivan lo que se pueda y las listas quedan vacías.
  const directos = stats?.directos ?? Math.max(0, (stats?.llegaron ?? 0) + (stats?.alta_sitio ?? 0) - (stats?.representantes ?? 0))
  const pctLlegaron = stats?.total_padron ? Math.round((stats.llegaron / stats.total_padron) * 100) : 0

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
            {/* Cifra principal + avance */}
            <div className="rounded-3xl bg-brand-dark text-white p-6 sm:p-8 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-7xl sm:text-8xl font-black tabular-nums leading-none">
                    {stats.llegaron}
                    <span className="text-3xl sm:text-5xl text-white/60 font-black"> de {stats.total_padron}</span>
                  </p>
                  <p className="mt-3 text-lg sm:text-xl font-bold uppercase tracking-wide text-white/80">
                    Registrados del padrón · {pctLlegaron}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-5xl sm:text-6xl font-black tabular-nums leading-none text-white/90">{stats.faltan}</p>
                  <p className="mt-2 text-base sm:text-lg font-bold uppercase tracking-wide text-white/70">Pendientes</p>
                </div>
              </div>
              <div className="mt-5 h-2.5 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full rounded-full bg-brand-green transition-all" style={{ width: `${pctLlegaron}%` }} />
              </div>
            </div>

            {/* Cómo llegaron: gráfica apilada + tarjetas */}
            <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-5">
              <h2 className="text-lg font-black text-brand-dark mb-3">Cómo llegaron</h2>
              <BarraLlegadas
                directos={directos}
                representantes={stats.representantes ?? 0}
                pendientes={stats.faltan ?? 0}
              />
            </section>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <TarjetaCifra
                etiqueta="Directos"
                valor={directos}
                detalle="titular en persona"
                color={COLOR_DIRECTOS}
              />
              <TarjetaCifra
                etiqueta="Representantes"
                valor={stats.representantes ?? 0}
                detalle="llegó alguien en su lugar"
                color={COLOR_REPRESENTANTES}
              />
              <TarjetaCifra
                etiqueta="Con acompañantes"
                valor={stats.con_acompanantes ?? '—'}
                detalle={`${stats.acompanantes ?? 0} acompañante${stats.acompanantes === 1 ? '' : 's'} en total`}
              />
              <TarjetaCifra etiqueta="Alta en sitio" valor={stats.alta_sitio ?? 0} detalle="fuera del padrón" />
            </div>

            {/* Listas: pendientes y registrados */}
            <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
              <ListaPersonas
                titulo="Pendientes"
                personas={stats.pendientes || []}
                vacio={stats.pendientes ? '¡Ya llegaron todos!' : 'El servidor aún no envía la lista (migración 010).'}
              />
              <ListaPersonas
                titulo="Registrados"
                personas={stats.registrados || []}
                vacio={stats.registrados ? 'Todavía no hay registros.' : 'El servidor aún no envía la lista (migración 010).'}
                registrados
              />
            </div>

            {/* Descarga del reporte de asistentes */}
            <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-5">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-black text-brand-dark flex-1">Reporte de asistentes</h2>
                <button
                  type="button"
                  onClick={() => void exportar('excel')}
                  disabled={Boolean(exportando)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-dark text-white font-bold active:scale-[0.98] transition disabled:opacity-50"
                >
                  <IconDescarga className="w-5 h-5" />
                  {exportando === 'excel' ? 'Generando…' : 'Excel'}
                </button>
                <button
                  type="button"
                  onClick={() => void exportar('pdf')}
                  disabled={Boolean(exportando)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border-2 border-brand-dark text-brand-dark font-bold active:scale-[0.98] transition disabled:opacity-50"
                >
                  <IconDescarga className="w-5 h-5" />
                  {exportando === 'pdf' ? 'Generando…' : 'PDF con gráficas'}
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Detalle por asistente (invitado o representante, acompañantes, hora y puerta) y totales.
              </p>
              {errorExporte && (
                <p className="mt-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold px-4 py-3">
                  {errorExporte}
                </p>
              )}
            </section>

            {/* Avance por grupo (Dependencias / OPD / Educativos…) */}
            {usarGrupos && (
              <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-5">
                <h2 className="text-lg font-black text-brand-dark mb-3">Avance por grupo</h2>
                <div className="space-y-4">
                  {porGrupo.map((g) => (
                    <div key={g.grupo}>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-bold text-gray-800 truncate">{g.grupo}</p>
                        <p className="shrink-0 tabular-nums font-black text-brand-dark">
                          {g.llegaron}
                          <span className="text-gray-400 font-bold">/{g.total}</span>
                        </p>
                      </div>
                      <div className="mt-1.5 flex h-2.5 rounded-full overflow-hidden bg-slate-200 gap-0.5">
                        <div style={{ width: `${g.total ? (g.directos / g.total) * 100 : 0}%`, background: COLOR_DIRECTOS }} />
                        <div style={{ width: `${g.total ? (g.representantes / g.total) * 100 : 0}%`, background: COLOR_REPRESENTANTES }} />
                      </div>
                      <p className="mt-1 text-xs font-bold text-gray-500 tabular-nums">
                        {g.directos} directos · {g.representantes} representantes · {g.faltan} pendientes
                        {g.acompanantes > 0 ? ` · ${g.acompanantes} acompañantes` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Avance por procedencia: solo cuando no hay grupos (evita 80 renglones de 1/1) */}
            {!usarGrupos && porProcedencia.length > 0 && (
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
