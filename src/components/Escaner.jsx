import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

// Lector de QR con la cámara trasera. La cámara exige contexto seguro
// (HTTPS o localhost). Mientras un modal está abierto se pausa el escaneo
// (prop `pausado`) para no leer el mismo pase repetido y ahorrar batería.
export default function Escaner({ pausado, onTexto }) {
  const lectorRef = useRef(null)
  const corriendoRef = useRef(false)
  const onTextoRef = useRef(onTexto)
  onTextoRef.current = onTexto
  const [estado, setEstado] = useState('iniciando') // iniciando | listo | error
  const [detalleError, setDetalleError] = useState('')

  useEffect(() => {
    let cancelado = false
    const lector = new Html5Qrcode('lector-qr', { verbose: false })
    lectorRef.current = lector

    lector
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (w, h) => {
            const lado = Math.round(Math.min(w, h) * 0.7)
            return { width: lado, height: lado }
          },
        },
        (texto) => onTextoRef.current?.(texto),
        () => {}, // frames sin QR: silencio
      )
      .then(() => {
        corriendoRef.current = true
        if (!cancelado) setEstado('listo')
      })
      .catch((e) => {
        if (!cancelado) {
          setEstado('error')
          setDetalleError(String(e?.message || e))
        }
      })

    return () => {
      cancelado = true
      if (corriendoRef.current) {
        lector.stop().catch(() => {}).finally(() => {
          try { lector.clear() } catch { /* sin remedio */ }
        })
      }
    }
  }, [])

  useEffect(() => {
    const lector = lectorRef.current
    if (!lector || estado !== 'listo') return
    try {
      if (pausado) lector.pause(true)
      else lector.resume()
    } catch { /* cambiar de pestaña a medio arranque: ignorar */ }
  }, [pausado, estado])

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden bg-black shadow" style={{ minHeight: 260 }}>
        <div id="lector-qr" className="w-full" />
        {estado === 'iniciando' && (
          <p className="absolute inset-0 flex items-center justify-center text-white/90 text-xl font-bold">
            Abriendo cámara…
          </p>
        )}
      </div>
      {estado === 'listo' && !pausado && (
        <p className="text-gray-600 text-lg text-center">
          Apunta al <span className="font-bold">QR del pase</span> para abrir el registro.
        </p>
      )}
      {estado === 'error' && (
        <div className="text-red-800 bg-red-50 border border-red-200 rounded-2xl text-lg px-4 py-4">
          <p className="font-black">No se pudo abrir la cámara.</p>
          <p className="mt-1">
            Revisa el permiso de cámara del navegador para este sitio. Mientras tanto usa{' '}
            <span className="font-bold">FOLIO</span> o <span className="font-bold">BUSCAR</span>.
          </p>
          <p className="mt-2 text-sm text-red-600 break-all">{detalleError}</p>
        </div>
      )}
    </div>
  )
}
