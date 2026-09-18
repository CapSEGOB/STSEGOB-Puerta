# Puerta STSEGOB

PWA offline-first para registrar asistentes en la puerta de un evento. El padrón
se descarga una vez a IndexedDB; los check-ins se guardan localmente y se
sincronizan a Supabase cuando hay red (sobreviven cierre y reapertura de la app).

La app no está amarrada a un evento: nombre, sede, fecha, clave de dispositivo
y padrón viven en la base (tabla `evento_config` y tablas `evento_*`). El
backend (migraciones SQL, ETL del padrón, respaldos y archivo de eventos) está
en el repo hermano `STSEGOB-Asistencias`; ahí vive el runbook
`RUNBOOK-NUEVO-EVENTO.md` con el procedimiento completo para cerrar un evento
y abrir el siguiente.

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
hash (`#/`, `#/p/:folio`, `#/config`, `#/tablero`) no se necesitan rewrites.

## Rutas

- `#/` — pantalla de puerta (BUSCAR / FOLIO / ESCANEAR)
- `#/p/:folio` — pase público del invitado (QR + folio grande; requiere red)
- `#/config` — configuración del dispositivo y descarga del padrón
- `#/tablero` — tablero de control con totales y reporte Excel/PDF (requiere red)

## Preparar un evento nuevo

Resumen; el detalle y los comandos están en `RUNBOOK-NUEVO-EVENTO.md` del
repo `STSEGOB-Asistencias`:

1. Verificar que todos los dispositivos muestren **0 pendientes** de sincronizar.
2. Respaldar y archivar el evento anterior en la base, y vaciar las tablas vivas
   (`scripts/archivar_evento.js`).
3. Configurar nombre, sede, fecha, URL y una clave nueva
   (`scripts/configurar_evento.js`).
4. Cargar el padrón nuevo con el ETL (`scripts/import_evento.js`).
5. En **cada** dispositivo: ⚙ Configuración → **Restablecer este dispositivo**
   (borra padrón, cola y configuración del evento anterior) → capturar puerta,
   operador y clave nueva → **Descargar padrón**.

La app en producción no requiere cambios de código entre eventos.

## Cambiar la clave del dispositivo

La clave compartida vive en la tabla `evento_config` de Supabase
(clave `clave_dispositivo`). Para cambiarla, en el SQL Editor:

```sql
update evento_config set valor = 'NUEVA-CLAVE' where clave = 'clave_dispositivo';
```

(o `node scripts/configurar_evento.js --clave-nueva` desde el repo backend).

Después, en cada dispositivo: abrir ⚙ (Configuración), escribir la nueva
clave y tocar "Guardar configuración". Sin la clave correcta no se puede
descargar el padrón ni sincronizar check-ins.
