import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'

// Página pública del pase (#/p/:folio) para los links del SMS.
// Esta ruta sí requiere red: es para invitados, no para operadores.
export default function PantallaPase({ folio }) {
  const [estado, setEstado] = useState('cargando') // cargando | ok | invalido | error
  const [datos, setDatos] = useState(null)
  const [qr, setQr] = useState(null)
  const [reintento, setReintento] = useState(0)

  useEffect(() => {
    let activo = true
    setEstado('cargando')
    setDatos(null)
    supabase
      .rpc('evento_pase', { p_folio: folio })
      .then(({ data, error }) => {
        if (!activo) return
        if (error) {
          setEstado('error')
          return
        }
        if (!data?.ok) {
          setEstado('invalido')
          return
        }
        setDatos(data)
        setEstado('ok')
      })
      .catch(() => {
        if (activo) setEstado('error')
      })
    return () => {
      activo = false
    }
  }, [folio, reintento])

  useEffect(() => {
    if (!datos) {
      setQr(null)
      return
    }
    QRCode.toDataURL(`PUE1:${datos.folio}:${datos.firma}`, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#5a1429', light: '#ffffff' },
    })
      .then(setQr)
      .catch(() => setQr(null))
  }, [datos])

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      {estado === 'cargando' && (
        <p className="text-white/80 text-2xl font-bold animate-pulse">Cargando tu pase…</p>
      )}

      {estado === 'error' && (
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center">
          <p className="text-2xl font-black text-gray-900">No hay conexión</p>
          <p className="text-gray-600 text-lg mt-2">
            No se pudo cargar el pase. Revisa tu internet e intenta de nuevo.
          </p>
          <button
            type="button"
            onClick={() => setReintento((n) => n + 1)}
            className="mt-6 w-full py-4 rounded-xl bg-brand-green text-white text-xl font-black"
          >
            Reintentar
          </button>
        </div>
      )}

      {estado === 'invalido' && (
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center">
          <p className="text-2xl font-black text-gray-900">Pase no encontrado</p>
          <p className="text-gray-600 text-lg mt-2">
            Verifica que el enlace esté completo, o pregunta en la mesa de registro del evento.
          </p>
        </div>
      )}

      {estado === 'ok' && datos && (
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden my-6">
          {/* Portada: mismo lenguaje que la Carpeta de Gira */}
          <div className="bg-brand-dark text-white px-6 pt-6 pb-5 text-left">
            <p className="kicker text-sm text-brand-gold">Pase de acceso</p>
            <h1 className="text-2xl font-black mt-1.5 leading-tight">{datos.evento_nombre}</h1>
            <p className="text-white/70 font-semibold mt-1">{datos.fecha_hora} · {datos.sede}</p>
          </div>

          <div className="p-6 text-center">
            <p className="text-2xl font-extrabold text-gray-900 leading-tight">{datos.nombre}</p>

            <div className="mx-auto mt-4 w-64 max-w-full rounded-2xl border border-gray-200 p-2 bg-white shadow-sm">
              {qr ? (
                <img
                  src={qr}
                  alt={`Código QR del folio ${datos.folio}`}
                  className="w-full rounded-xl"
                />
              ) : (
                <div className="w-full aspect-square bg-gray-100 rounded-xl" />
              )}
            </div>

            <p className="kicker text-xs text-gray-400 mt-4">Folio</p>
            <p className="text-5xl font-black tracking-[0.2em] text-brand-dark mt-1 select-all break-all">
              {datos.folio}
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Si el código no se puede leer, di este folio en la puerta.
            </p>

            {datos.estatus && datos.estatus !== 'activo' && (
              <p className="mt-4 text-red-600 font-black uppercase">Estatus: {datos.estatus}</p>
            )}

            <div className="mt-6 flex items-center justify-center gap-2.5">
              <span className="w-10 h-px bg-brand-gold/60" />
              <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-widest">
                Secretaría de Gobernación
              </p>
              <span className="w-10 h-px bg-brand-gold/60" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
