import { IconWifi, IconSinWifi, IconSync, IconEngrane, IconGrafica } from './Iconos'

// Indicador permanente: en línea / sin conexión, pendientes de sincronizar,
// puerta y operador activos, botón de sincronización manual y acceso a config.
// Dos filas fijas: controles arriba, identidad abajo — nada se empalma en móvil.
export default function BarraEstado({ enLinea, pendientes, config, sincronizando, onSincronizar }) {
  return (
    <header className="bg-brand-dark text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-3xl mx-auto px-3 py-2 space-y-1">
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-bold ${
              enLinea ? 'bg-brand-green/30 text-emerald-200' : 'bg-red-500/30 text-red-200'
            }`}
          >
            {enLinea ? <IconWifi className="w-4 h-4" /> : <IconSinWifi className="w-4 h-4" />}
            <span>{enLinea ? 'En línea' : 'Sin conexión'}</span>
          </div>

          <div
            className={`px-2.5 py-1.5 rounded-lg text-sm font-bold ${
              pendientes > 0 ? 'bg-amber-400 text-brand-dark' : 'bg-white/10 text-white/70'
            }`}
          >
            {pendientes > 0 ? `${pendientes} por enviar` : 'Al día'}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onSincronizar}
              disabled={sincronizando}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 disabled:opacity-50"
              title="Sincronizar ahora"
              aria-label="Sincronizar ahora"
            >
              <IconSync className={`w-5 h-5 ${sincronizando ? 'animate-spin' : ''}`} />
            </button>
            <a
              href="#/tablero"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30"
              title="Tablero"
              aria-label="Tablero"
            >
              <IconGrafica className="w-5 h-5" />
            </a>
            <a
              href="#/config"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30"
              title="Configuración"
              aria-label="Configuración"
            >
              <IconEngrane className="w-5 h-5" />
            </a>
          </div>
        </div>

        <p className="text-sm font-semibold text-white/85 truncate">
          {config?.puerta
            ? `Puerta ${config.puerta} · ${config.operador || ''}`
            : 'Dispositivo sin configurar'}
        </p>
      </div>
    </header>
  )
}
