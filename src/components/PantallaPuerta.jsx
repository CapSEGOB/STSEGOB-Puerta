import { useMemo, useRef, useState } from 'react'
import { normalizarTexto, normalizarFolio, esFolioValido } from '../lib/normalizar'
import { IconBuscar, IconFolio, IconQr, IconPalomita, IconAlerta } from './Iconos'
import Escaner from './Escaner'

const TABS = [
  { id: 'buscar', etiqueta: 'BUSCAR', Icono: IconBuscar },
  { id: 'folio', etiqueta: 'FOLIO', Icono: IconFolio },
  { id: 'escanear', etiqueta: 'ESCANEAR', Icono: IconQr },
]

function horaCorta(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function TarjetaAsistente({ asistente, onRegistrar }) {
  const ya = Boolean(asistente.checkin_at)
  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xl font-bold text-gray-900 leading-tight">{asistente.nombre}</p>
        <p className="text-gray-500 font-medium mt-0.5">
          Tel. •••• {asistente.tel_last4 || '— — — —'} · Folio {asistente.folio}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {ya ? (
            <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold">
              Registrado {horaCorta(asistente.checkin_at)}
              {asistente.checkin_puerta ? ` · Puerta ${asistente.checkin_puerta}` : ''}
            </span>
          ) : (
            <span className="inline-block px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-sm font-semibold">
              Sin registrar
            </span>
          )}
          {asistente.estatus && asistente.estatus !== 'activo' && (
            <span className="inline-block px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-sm font-bold uppercase">
              {asistente.estatus}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRegistrar}
        className={`shrink-0 px-5 py-5 rounded-xl text-lg font-black text-white shadow active:scale-95 transition ${
          ya ? 'bg-amber-500' : 'bg-brand-green'
        }`}
      >
        REGISTRAR
      </button>
    </div>
  )
}

export default function PantallaPuerta({ padron, onRegistrar }) {
  const [tab, setTab] = useState('buscar')
  const [consulta, setConsulta] = useState('')
  const [folio, setFolio] = useState('')
  const [confirmacion, setConfirmacion] = useState(null)
  const [duplicado, setDuplicado] = useState(null)
  const [alta, setAlta] = useState(null) // { nombre, telefono } | null
  const [guardando, setGuardando] = useState(false)
  const [errorScan, setErrorScan] = useState(null)
  const timerConfirmacion = useRef(null)
  const ultimoScan = useRef({ texto: '', t: 0 })

  // Búsqueda instantánea en memoria: 4 dígitos → tel_last4; si no, por nombre
  // (todos los tokens como substrings del nombre normalizado).
  const resultados = useMemo(() => {
    const q = consulta.trim()
    if (!q) return []
    if (/^\d{4}$/.test(q)) {
      return padron.filter((a) => a.tel_last4 === q).slice(0, 50)
    }
    const tokens = normalizarTexto(q).split(' ').filter(Boolean)
    if (tokens.length === 0) return []
    return padron.filter((a) => tokens.every((t) => a.nombre_norm.includes(t))).slice(0, 50)
  }, [consulta, padron])

  const folioOk = esFolioValido(folio)
  const encontradoPorFolio = useMemo(
    () => (folioOk ? padron.find((a) => a.folio === folio) || null : null),
    [folioOk, folio, padron],
  )

  async function confirmarRegistro(asistente, metodo, folioCapturado) {
    if (guardando) return
    setGuardando(true)
    try {
      const item = await onRegistrar(asistente, metodo, folioCapturado)
      setDuplicado(null)
      setConsulta('')
      setFolio('')
      setConfirmacion({ nombre: asistente.nombre, hora: horaCorta(item.timestamp_local) })
      clearTimeout(timerConfirmacion.current)
      timerConfirmacion.current = setTimeout(() => setConfirmacion(null), 2500)
    } finally {
      setGuardando(false)
    }
  }

  function intentarRegistro(asistente, metodo, folioCapturado = null) {
    if (asistente.checkin_at) {
      // Duplicado local: avisar, nunca bloquear.
      setDuplicado({ asistente, metodo, folioCapturado })
      return
    }
    void confirmarRegistro(asistente, metodo, folioCapturado)
  }

  // QR leído: contenido esperado "PUE1:<FOLIO>:<firma>"; se acepta también un
  // QR que traiga el folio a secas. La validación es contra el padrón local
  // (la firma no se verifica en puerta, según el contrato del evento).
  function manejarTextoQr(texto) {
    const ahora = Date.now()
    if (texto === ultimoScan.current.texto && ahora - ultimoScan.current.t < 3000) return
    ultimoScan.current = { texto, t: ahora }

    const partes = String(texto).trim().split(':')
    const crudo = partes[0] === 'PUE1' && partes.length >= 2 ? partes[1] : texto
    const f = normalizarFolio(crudo)
    if (!esFolioValido(f)) {
      navigator.vibrate?.([60, 60, 60])
      setErrorScan({ titulo: 'Ese código no es un pase del evento', detalle: String(texto).slice(0, 60) })
      return
    }
    const asistente = padron.find((a) => a.folio === f)
    if (!asistente) {
      navigator.vibrate?.([60, 60, 60])
      setErrorScan({ titulo: `El folio ${f} no está en el padrón`, detalle: 'Verifica el pase o busca a la persona por nombre.' })
      return
    }
    setErrorScan(null)
    navigator.vibrate?.(80)
    intentarRegistro(asistente, 'qr', f)
  }

  // Alta en sitio: persona que no aparece en el padrón. Se encola el check-in
  // con asistente_id null y {nombre, telefono}; el servidor crea al asistente
  // (origen 'alta_sitio') al sincronizar. Funciona sin red, como todo lo demás.
  async function confirmarAltaSitio() {
    if (guardando || !alta) return
    const nombre = alta.nombre.trim()
    if (!nombre) return
    setGuardando(true)
    try {
      const item = await onRegistrar(
        { id: null, nombre, telefono: alta.telefono.trim() || null },
        'alta_sitio',
      )
      setAlta(null)
      setConsulta('')
      setConfirmacion({ nombre, hora: horaCorta(item.timestamp_local) })
      clearTimeout(timerConfirmacion.current)
      timerConfirmacion.current = setTimeout(() => setConfirmacion(null), 2500)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto flex flex-col">
      {/* Tabs grandes: un toque para cambiar de modo */}
      <div className="grid grid-cols-3 gap-2 p-3">
        {TABS.map(({ id, etiqueta, Icono }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-col items-center gap-1 py-4 rounded-2xl font-black text-base sm:text-lg transition ${
              tab === id
                ? 'bg-brand-dark text-white shadow-lg'
                : 'bg-white text-brand-dark shadow border border-gray-200'
            }`}
          >
            <Icono className="w-7 h-7" />
            {etiqueta}
          </button>
        ))}
      </div>

      {/* ---------- BUSCAR ---------- */}
      {tab === 'buscar' && (
        <section className="px-3 pb-6 space-y-3">
          <input
            type="text"
            inputMode="search"
            autoFocus
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Nombre o últimos 4 del teléfono"
            className="w-full text-2xl p-4 rounded-2xl border-2 border-gray-300 focus:border-brand-green focus:outline-none shadow-sm bg-white"
          />
          {!consulta.trim() && (
            <p className="text-gray-500 text-lg px-1">
              Escribe el <span className="font-bold">nombre</span> de la persona, o los{' '}
              <span className="font-bold">4 últimos dígitos</span> de su teléfono.
            </p>
          )}
          {consulta.trim() && resultados.length === 0 && (
            <>
              <p className="text-gray-600 text-lg px-1 py-4 text-center bg-white rounded-2xl border border-gray-200">
                Sin resultados. Prueba con menos palabras o con los últimos 4 dígitos del teléfono.
              </p>
              <button
                type="button"
                onClick={() =>
                  setAlta({
                    nombre: /^\d+$/.test(consulta.trim()) ? '' : consulta.trim(),
                    telefono: '',
                  })
                }
                className="w-full py-4 rounded-2xl bg-brand-dark text-white text-xl font-black active:scale-95 transition shadow"
              >
                ALTA EN SITIO (no está en el padrón)
              </button>
            </>
          )}
          {resultados.map((a) => (
            <TarjetaAsistente key={a.id} asistente={a} onRegistrar={() => intentarRegistro(a, 'busqueda')} />
          ))}
          {resultados.length === 50 && (
            <p className="text-gray-500 text-center">Hay más resultados; escribe más letras para afinar.</p>
          )}
        </section>
      )}

      {/* ---------- FOLIO ---------- */}
      {tab === 'folio' && (
        <section className="px-3 pb-6 space-y-3">
          <input
            type="text"
            autoFocus
            value={folio}
            onChange={(e) => setFolio(normalizarFolio(e.target.value))}
            placeholder="FOLIO"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="w-full text-4xl tracking-[0.3em] text-center font-black p-4 rounded-2xl border-2 border-gray-300 focus:border-brand-green focus:outline-none shadow-sm bg-white uppercase"
          />
          {folio.length === 0 && (
            <p className="text-gray-500 text-lg px-1 text-center">
              Teclea el folio de 6 caracteres del pase. No importan mayúsculas, espacios ni guiones.
            </p>
          )}
          {folio.length > 0 && folio.length < 6 && (
            <p className="text-gray-500 text-lg text-center">{6 - folio.length} caracteres más…</p>
          )}
          {folio.length === 6 && !folioOk && (
            <p className="text-red-700 bg-red-50 border border-red-200 rounded-2xl text-lg font-bold text-center px-4 py-4">
              El folio tiene caracteres que no existen en los pases. Revísalo con calma.
            </p>
          )}
          {folio.length > 6 && (
            <p className="text-red-700 bg-red-50 border border-red-200 rounded-2xl text-lg font-bold text-center px-4 py-4">
              El folio debe tener 6 caracteres y este tiene {folio.length}. Bórralo y vuelve a teclearlo.
            </p>
          )}
          {folioOk && !encontradoPorFolio && (
            <p className="text-amber-800 bg-amber-50 border border-amber-300 rounded-2xl text-lg font-bold text-center px-4 py-4">
              El folio {folio} no está en el padrón. Verifica el pase o busca a la persona por nombre.
            </p>
          )}
          {folioOk && encontradoPorFolio && (
            <TarjetaAsistente
              asistente={encontradoPorFolio}
              onRegistrar={() => intentarRegistro(encontradoPorFolio, 'folio', folio)}
            />
          )}
        </section>
      )}

      {/* ---------- ESCANEAR ---------- */}
      {tab === 'escanear' && (
        <section className="px-3 pb-6 space-y-3">
          <Escaner
            pausado={Boolean(confirmacion || duplicado || alta)}
            onTexto={manejarTextoQr}
          />
          {errorScan && (
            <button
              type="button"
              onClick={() => setErrorScan(null)}
              className="w-full text-left text-amber-900 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-4"
            >
              <p className="text-xl font-black">{errorScan.titulo}</p>
              <p className="text-lg mt-1 break-all">{errorScan.detalle}</p>
              <p className="text-sm mt-2 text-amber-700">Toca para descartar este aviso.</p>
            </button>
          )}
        </section>
      )}

      {/* ---------- Confirmación grande e inmediata ---------- */}
      {confirmacion && (
        <button
          type="button"
          onClick={() => {
            clearTimeout(timerConfirmacion.current)
            setConfirmacion(null)
          }}
          className="fixed inset-0 z-50 bg-brand-green flex flex-col items-center justify-center p-8 text-white"
        >
          <span className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center">
            <IconPalomita className="w-20 h-20" />
          </span>
          <p className="text-4xl font-black text-center leading-tight mt-6">{confirmacion.nombre}</p>
          <p className="text-2xl font-bold mt-3 text-white/90">Registrado a las {confirmacion.hora}</p>
          <p className="mt-10 text-white/70 text-lg">Toca la pantalla para continuar</p>
        </button>
      )}

      {/* ---------- Alta en sitio (persona fuera del padrón) ---------- */}
      {alta && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-t-8 border-brand-green">
            <p className="text-2xl font-black text-gray-900">Alta en sitio</p>
            <p className="text-lg text-gray-700 mt-1">
              Registra la entrada de una persona que <span className="font-bold">no está en el padrón</span>.
              Se dará de alta al sincronizar.
            </p>
            <div className="mt-5 space-y-3">
              <input
                type="text"
                autoFocus
                value={alta.nombre}
                onChange={(e) => setAlta((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Nombre completo"
                autoCorrect="off"
                spellCheck={false}
                className="w-full text-xl p-4 rounded-xl border-2 border-gray-300 focus:border-brand-green focus:outline-none"
              />
              <input
                type="tel"
                inputMode="tel"
                value={alta.telefono}
                onChange={(e) => setAlta((prev) => ({ ...prev, telefono: e.target.value }))}
                placeholder="Teléfono a 10 dígitos (opcional)"
                className="w-full text-xl p-4 rounded-xl border-2 border-gray-300 focus:border-brand-green focus:outline-none"
              />
            </div>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => void confirmarAltaSitio()}
                disabled={guardando || !alta.nombre.trim()}
                className="w-full py-4 rounded-xl bg-brand-green text-white text-xl font-black active:scale-95 transition disabled:opacity-60"
              >
                Registrar entrada
              </button>
              <button
                type="button"
                onClick={() => setAlta(null)}
                className="w-full py-4 rounded-xl bg-gray-100 text-gray-700 text-xl font-bold active:scale-95 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Aviso de duplicado (ámbar, nunca bloquea) ---------- */}
      {duplicado && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-t-8 border-amber-500">
            <div className="flex items-start gap-3">
              <IconAlerta className="w-10 h-10 text-amber-500 shrink-0" />
              <div>
                <p className="text-2xl font-black text-gray-900">Ya registrado</p>
                <p className="text-lg text-gray-700 mt-1">
                  <span className="font-bold">{duplicado.asistente.nombre}</span> ya se registró a las{' '}
                  {horaCorta(duplicado.asistente.checkin_at)}
                  {duplicado.asistente.checkin_puerta
                    ? ` en la puerta ${duplicado.asistente.checkin_puerta}`
                    : ''}
                  .
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() =>
                  confirmarRegistro(duplicado.asistente, duplicado.metodo, duplicado.folioCapturado)
                }
                disabled={guardando}
                className="w-full py-4 rounded-xl bg-amber-500 text-white text-xl font-black active:scale-95 transition disabled:opacity-60"
              >
                Registrar de todos modos
              </button>
              <button
                type="button"
                onClick={() => setDuplicado(null)}
                className="w-full py-4 rounded-xl bg-gray-100 text-gray-700 text-xl font-bold active:scale-95 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
