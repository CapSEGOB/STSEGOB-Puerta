# Puerta STSEGOB — Evento 6 de agosto

PWA offline-first para registrar asistentes en la puerta del evento. El padrón
se descarga una vez a IndexedDB; los check-ins se guardan localmente y se
sincronizan a Supabase cuando hay red (sobreviven cierre y reapertura de la app).

## Requisitos

- Node.js 20 o superior

## Instalar y correr

```bash
npm install
npm run dev        # desarrollo (http://localhost:5173)
```

## Construir

```bash
npm run build      # genera dist/ (PWA lista para producción)
npm run preview    # probar el build localmente
npm run iconos     # regenerar los íconos PNG de la PWA (opcional)
```

Las variables de `.env` (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`) se
incrustan en el build. Usa SOLO la clave publicable (anon); nunca la
service_role.

## Desplegar dist/ a Vercel o Netlify

Opción arrastrar y soltar:

1. Corre `npm run build` en tu máquina (con el `.env` correcto).
2. Vercel: <https://vercel.com/new> → pestaña de despliegue manual, o
   Netlify: <https://app.netlify.com/drop> → arrastra la carpeta `dist/`.

Opción CLI (Vercel):

```bash
npm i -g vercel
vercel --prod
```

El `vercel.json` ya indica `outputDirectory: dist`. Como el enrutado es por
hash (`#/`, `#/p/:folio`, `#/config`) no se necesitan rewrites.

## Rutas

- `#/` — pantalla de puerta (BUSCAR / FOLIO / ESCANEAR)
- `#/p/:folio` — pase público del invitado (QR + folio grande; requiere red)
- `#/config` — configuración del dispositivo y descarga del padrón

## Cambiar la clave del dispositivo

La clave compartida vive en la tabla `evento_config` de Supabase
(clave `clave_dispositivo`). Para cambiarla, en el SQL Editor:

```sql
update evento_config set valor = 'NUEVA-CLAVE' where clave = 'clave_dispositivo';
```

Después, en cada dispositivo: abrir ⚙ (Configuración), escribir la nueva
clave y tocar "Guardar configuración". Sin la clave correcta no se puede
descargar el padrón ni sincronizar check-ins.
