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
      color: { dark: '#0e322e', light: '#ffffff' },
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
          <div className="bg-brand-dark text-white text-center px-6 py-5">
            <p className="text-brand-gold text-sm font-bold uppercase tracking-widest">Pase de acceso</p>
            <h1 className="text-xl font-black mt-1">{datos.evento_nombre}</h1>
          </div>
          <div className="p-6 text-center">
            <p className="text-2xl font-black text-gray-900 leading-tight">{datos.nombre}</p>

            {qr ? (
              <img
                src={qr}
                alt={`Código QR del folio ${datos.folio}`}
                className="mx-auto mt-4 w-60 h-60 max-w-full rounded-lg"
              />
            ) : (
              <div className="mx-auto mt-4 w-60 h-60 bg-gray-100 rounded-lg" />
            )}

            <p className="text-gray-500 font-semibold mt-4 uppercase text-sm tracking-widest">Folio</p>
            <p className="text-5xl font-black tracking-[0.2em] text-brand-dark mt-1 select-all break-all">
              {datos.folio}
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Si el código no se puede leer, di este folio en la puerta.
            </p>

            <div className="mt-5 bg-slate-50 rounded-xl p-4 text-left text-gray-800">
              <p>
                <span className="font-bold">Sede:</span> {datos.sede}
              </p>
              <p className="mt-1">
                <span className="font-bold">Fecha y hora:</span> {datos.fecha_hora}
              </p>
            </div>

            {datos.estatus && datos.estatus !== 'activo' && (
              <p className="mt-4 text-red-600 font-black uppercase">Estatus: {datos.estatus}</p>
            )}

            <div className="mt-5 flex items-center justify-center gap-2">
              <span className="w-10 h-0.5 rounded-full bg-brand-gold" />
              <p className="text-xs text-gray-400 font-semibold">STSEGOB</p>
              <span className="w-10 h-0.5 rounded-full bg-brand-gold" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
