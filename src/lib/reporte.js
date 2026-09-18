// Exportación del reporte de asistentes (Excel y PDF con gráficas).
// Las librerías se cargan con import() dinámico: solo pesan cuando se
// descarga un reporte, no en la operación normal de la puerta.

const VERDE_OSCURO = [14, 50, 46] // #0e322e
const VERDE = [64, 155, 132] // #409b84
const DORADO = [199, 156, 103] // #c79c67
const GRIS = [148, 163, 184]
const GRIS_CLARO = [241, 245, 249]

function ahoraStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function horaCorta(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const ETIQUETAS_METODO = {
  busqueda: 'Búsqueda',
  folio: 'Folio',
  qr: 'QR',
  alta_sitio: 'Alta en sitio',
}

// Agregados calculados del detalle (mismos criterios que evento_stats)
export function resumenDe(reporte) {
  const asistentes = reporte.asistentes || []
  const padron = asistentes.filter((a) => a.origen === 'padron')
  const llegadosPadron = padron.filter((a) => a.llego)
  const llegadosTodos = asistentes.filter((a) => a.llego)
  const representantes = llegadosTodos.filter((a) => a.representante)
  const porMetodo = {}
  const porPuerta = {}
  for (const a of llegadosTodos) {
    if (a.metodo) porMetodo[a.metodo] = (porMetodo[a.metodo] || 0) + 1
    if (a.puerta) porPuerta[a.puerta] = (porPuerta[a.puerta] || 0) + 1
  }
  return {
    total_padron: padron.length,
    llegaron: llegadosPadron.length,
    faltan: padron.length - llegadosPadron.length,
    representantes: representantes.length,
    invitados: llegadosTodos.length - representantes.length,
    acompanantes: llegadosTodos.reduce((s, a) => s + (a.acompanantes || 0), 0),
    alta_sitio: asistentes.filter((a) => a.origen === 'alta_sitio' && a.llego).length,
    porMetodo,
    porPuerta,
  }
}

function filasDetalle(reporte) {
  return (reporte.asistentes || []).map((a, i) => ({
    no: i + 1,
    nombre: a.nombre,
    procedencia: a.procedencia || '',
    responsable: a.responsable || '',
    estado: a.llego ? 'Llegó' : 'Pendiente',
    quien: a.llego ? (a.representante ? 'Representante' : 'Invitado') : '',
    representante_nombre: a.representante_nombre || '',
    acompanantes: a.acompanantes || 0,
    acompanantes_nombres: a.acompanantes_nombres || '',
    hora: horaCorta(a.timestamp_local),
    puerta: a.puerta || '',
    operador: a.operador || '',
    metodo: a.llego ? ETIQUETAS_METODO[a.metodo] || a.metodo || '' : '',
    origen: a.origen === 'alta_sitio' ? 'Alta en sitio' : 'Padrón',
  }))
}

// ---------------------------------------------------------------- Excel
export async function descargarExcel(reporte) {
  const XLSX = await import('xlsx')
  const r = resumenDe(reporte)
  const wb = XLSX.utils.book_new()

  const resumen = [
    ['Evento', reporte.evento_nombre],
    ['Generado', new Date(reporte.generado).toLocaleString('es-MX')],
    [],
    ['Invitados en padrón', r.total_padron],
    ['Llegaron', r.llegaron],
    ['Pendientes', r.faltan],
    ['— Llegó el invitado', r.invitados],
    ['— Llegó representante', r.representantes],
    ['Acompañantes', r.acompanantes],
    ['Altas en sitio', r.alta_sitio],
    [],
    ['Por puerta', ''],
    ...Object.entries(r.porPuerta).map(([k, v]) => [`Puerta ${k}`, v]),
    [],
    ['Por método', ''],
    ...Object.entries(r.porMetodo).map(([k, v]) => [ETIQUETAS_METODO[k] || k, v]),
  ]
  const hojaResumen = XLSX.utils.aoa_to_sheet(resumen)
  hojaResumen['!cols'] = [{ wch: 24 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, hojaResumen, 'Resumen')

  const filas = filasDetalle(reporte).map((f) => ({
    'No.': f.no,
    Nombre: f.nombre,
    Procedencia: f.procedencia,
    Responsable: f.responsable,
    Estado: f.estado,
    'Quién llegó': f.quien,
    'Nombre del representante': f.representante_nombre,
    'Acompañantes': f.acompanantes,
    'Nombres de acompañantes': f.acompanantes_nombres,
    Hora: f.hora,
    Puerta: f.puerta,
    'Registró': f.operador,
    'Método': f.metodo,
    Origen: f.origen,
  }))
  const hojaDetalle = XLSX.utils.json_to_sheet(filas)
  hojaDetalle['!cols'] = [
    { wch: 5 }, { wch: 34 }, { wch: 20 }, { wch: 18 }, { wch: 10 },
    { wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 30 }, { wch: 8 },
    { wch: 7 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, hojaDetalle, 'Asistentes')

  XLSX.writeFile(wb, `reporte-asistentes-${ahoraStamp()}.xlsx`)
}

// ---------------------------------------------------------------- PDF
// Diseño: portada ejecutiva (cifra principal, gráfica apilada, avance por
// grupo y ritmo de llegadas) + detalle en dos secciones (Asistieron /
// Pendientes) agrupadas por grupo. Tipografía Gilroy incrustada; si las
// fuentes no cargan, cae a Helvetica sin romperse.

const TINTA = [24, 33, 32]
const TINTA_2 = [88, 99, 98]
const TINTA_3 = [140, 150, 149]
const LINEA = [222, 228, 227]
const PISTA = [226, 232, 240]
const TEAL = [38, 100, 91] // directos
const ORO = [184, 133, 63] // representantes
const TINTE_VERDE = [236, 244, 241]

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function hora24(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return ''
  }
}

// "2026-09-18" o "2026-09-18 09:00" → "18 de septiembre de 2026 · 09:00 h"
function fechaLarga(txt) {
  const m = String(txt || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/)
  if (!m) return txt ? String(txt) : ''
  const base = `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`
  return m[4] ? `${base} · ${m[4]}:${m[5]} h` : base
}

// Orden jerárquico de los grupos: gabinete legal, organismos, educativos, resto.
function ordenGrupo(nombre) {
  const n = String(nombre || '').toLowerCase()
  if (n.includes('dependencia') || n.includes('gabinete')) return 0
  if (n.includes('educativ')) return 2
  if (n.includes('organismo') || n.includes('opd')) return 1
  return n === 'sin grupo' ? 9 : 5
}

function datosPdf(reporte) {
  const todos = reporte.asistentes || []
  const padron = todos.filter((a) => a.origen === 'padron')
  const altas = todos.filter((a) => a.origen === 'alta_sitio' && a.llego)
  const llegados = todos.filter((a) => a.llego)
  const llegadosPadron = padron.filter((a) => a.llego)
  const acompanantes = llegados.reduce((s, a) => s + (a.acompanantes || 0), 0)
  const mapa = new Map()
  for (const a of padron) {
    const g = a.responsable || 'Sin grupo'
    if (!mapa.has(g)) mapa.set(g, [])
    mapa.get(g).push(a)
  }
  const grupos = [...mapa.entries()]
    .map(([nombre, lista]) => {
      const ll = lista.filter((a) => a.llego)
      return {
        nombre,
        lista: [...lista].sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')),
        total: lista.length,
        llegaron: ll.length,
        directos: ll.filter((a) => !a.representante).length,
        representantes: ll.filter((a) => a.representante).length,
      }
    })
    .sort((x, y) => ordenGrupo(x.nombre) - ordenGrupo(y.nombre) || y.total - x.total)
  const porPuerta = {}
  for (const a of llegados) if (a.puerta) porPuerta[a.puerta] = (porPuerta[a.puerta] || 0) + 1
  return {
    total: padron.length,
    llegaron: llegadosPadron.length,
    faltan: padron.length - llegadosPadron.length,
    directos: llegadosPadron.filter((a) => !a.representante).length,
    representantes: llegadosPadron.filter((a) => a.representante).length,
    conAcompanantes: llegados.filter((a) => (a.acompanantes || 0) > 0).length,
    acompanantes,
    altas,
    enSala: llegados.length + acompanantes,
    grupos,
    porPuerta,
    horas: llegados
      .map((a) => a.timestamp_local)
      .filter(Boolean)
      .map((t) => new Date(t).getTime())
      .sort((x, y) => x - y),
  }
}

export async function construirPdf(reporte, fuentes = null) {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const d = datosPdf(reporte)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 16
  const ANCHO = W - M * 2

  // ---- tipografía
  let FAM = 'helvetica'
  let FAM_SB = 'helvetica'
  if (fuentes?.regular && fuentes?.bold) {
    doc.addFileToVFS('Gilroy-Regular.ttf', fuentes.regular)
    doc.addFont('Gilroy-Regular.ttf', 'Gilroy', 'normal')
    doc.addFileToVFS('Gilroy-ExtraBold.ttf', fuentes.bold)
    doc.addFont('Gilroy-ExtraBold.ttf', 'Gilroy', 'bold')
    FAM = 'Gilroy'
    FAM_SB = 'Gilroy'
    if (fuentes.semibold) {
      doc.addFileToVFS('Gilroy-SemiBold.ttf', fuentes.semibold)
      doc.addFont('Gilroy-SemiBold.ttf', 'GilroySB', 'normal')
      doc.addFont('Gilroy-SemiBold.ttf', 'GilroySB', 'bold')
      FAM_SB = 'GilroySB'
    }
  }
  const ESTILO_SB = FAM_SB === 'GilroySB' ? 'normal' : 'bold'
  const T = (peso, tam, color = TINTA) => {
    if (peso === 'sb') doc.setFont(FAM_SB, ESTILO_SB)
    else doc.setFont(FAM, peso === 'b' ? 'bold' : 'normal')
    doc.setFontSize(tam)
    doc.setTextColor(...color)
  }
  const linea = (y, x1 = M, x2 = W - M, color = LINEA, grosor = 0.2) => {
    doc.setDrawColor(...color)
    doc.setLineWidth(grosor)
    doc.line(x1, y, x2, y)
  }
  // Barra apilada sobre pista gris, con separación blanca entre segmentos
  const apilada = (x, y, ancho, alto, partes, total) => {
    const r = alto / 2
    doc.setFillColor(...PISTA)
    doc.roundedRect(x, y, ancho, alto, r, r, 'F')
    let cx = x
    const vivos = partes.filter((p) => p.n > 0)
    vivos.forEach((p, i) => {
      const w = Math.max(total ? (p.n / total) * ancho : 0, alto)
      doc.setFillColor(...p.color)
      if (i === 0) {
        doc.roundedRect(cx, y, w, alto, r, r, 'F')
        if (cx + w < x + ancho - 0.2) doc.rect(cx + w - r, y, r, alto, 'F')
      } else if (cx + w >= x + ancho - 0.2) {
        doc.roundedRect(cx, y, w, alto, r, r, 'F')
        doc.rect(cx, y, r, alto, 'F')
      } else {
        doc.rect(cx, y, w, alto, 'F')
      }
      cx += w
      if (cx < x + ancho - 0.2) {
        doc.setFillColor(255, 255, 255)
        doc.rect(cx - 0.3, y - 0.1, 0.6, alto + 0.2, 'F')
      }
    })
  }
  const titulo = (txt, y) => {
    T('b', 8, ORO)
    doc.text(txt.toUpperCase(), M, y, { charSpace: 0.7 })
    linea(y + 2.4)
    return y + 10
  }

  // ======================= PORTADA =======================
  doc.setFillColor(...VERDE_OSCURO)
  doc.rect(0, 0, W, 3, 'F')

  T('b', 8, ORO)
  doc.text('REPORTE DE ASISTENCIA', M, 17, { charSpace: 0.9 })
  T('b', 24, VERDE_OSCURO)
  doc.text(String(reporte.evento_nombre || 'Evento'), M, 28)
  const sub = [reporte.sede, fechaLarga(reporte.fecha_hora)].filter(Boolean).join('  ·  ')
  T('n', 10.5, TINTA_2)
  if (sub) doc.text(sub, M, 35)
  T('sb', 8.5, TINTA_2)
  doc.text('Secretaría de Gobernación', W - M, 17, { align: 'right' })
  T('n', 8, TINTA_3)
  const generado = new Date(reporte.generado).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short', hour12: false })
  doc.text(`Generado el ${generado}`, W - M, 22, { align: 'right' })
  linea(41, M, W - M, ORO, 0.5)

  // ---- cifra principal + gráfica apilada
  let y = 62
  const pct = d.total ? Math.round((d.llegaron / d.total) * 100) : 0
  T('b', 46, VERDE_OSCURO)
  const cifra = String(d.llegaron)
  doc.text(cifra, M, y)
  const wc = doc.getTextWidth(cifra)
  T('sb', 15, TINTA_3)
  doc.text(`de ${d.total}`, M + wc + 3, y)
  T('n', 9.5, TINTA_2)
  doc.text('titulares del padrón con asistencia registrada', M, y + 7)

  const bx = M + 84
  const bw = ANCHO - 84
  T('b', 20, VERDE_OSCURO)
  const txtPct = `${pct}%`
  doc.text(txtPct, bx, y - 9)
  const wp = doc.getTextWidth(txtPct)
  T('n', 9.5, TINTA_2)
  doc.text('de asistencia', bx + wp + 2.5, y - 9)
  apilada(bx, y - 5, bw, 5, [
    { n: d.directos, color: TEAL },
    { n: d.representantes, color: ORO },
  ], d.total)
  let lx = bx
  for (const [et, n, col] of [
    ['Directos', d.directos, TEAL],
    ['Representantes', d.representantes, ORO],
    ['Pendientes', d.faltan, PISTA],
  ]) {
    doc.setFillColor(...col)
    doc.roundedRect(lx, y + 3.2, 2.6, 2.6, 0.6, 0.6, 'F')
    T('n', 8.5, TINTA_2)
    doc.text(et, lx + 4, y + 5.5)
    const w1 = doc.getTextWidth(et)
    T('b', 8.5, TINTA)
    doc.text(String(n), lx + 4 + w1 + 1.5, y + 5.5)
    lx += 4 + w1 + 1.5 + doc.getTextWidth(String(n)) + 6
  }

  // ---- fila de indicadores separados por líneas finas
  y = 82
  linea(y)
  const ind = [
    [d.directos, 'Directos', 'titular en persona'],
    [d.representantes, 'Representantes', 'asistió alguien en su lugar'],
    [d.conAcompanantes, 'Con acompañantes', `${d.acompanantes} acompañante${d.acompanantes === 1 ? '' : 's'} en total`],
    [d.altas.length, 'Altas en sitio', 'fuera del padrón'],
    [d.enSala, 'Personas en sala', 'asistentes y acompañantes'],
  ]
  const cw = ANCHO / ind.length
  ind.forEach(([v, et, nota], i) => {
    const x = M + i * cw
    if (i > 0) {
      doc.setDrawColor(...LINEA)
      doc.setLineWidth(0.2)
      doc.line(x, y + 5, x, y + 25)
    }
    const px = x + (i === 0 ? 0 : 5)
    T('b', 19, VERDE_OSCURO)
    doc.text(String(v), px, y + 13)
    T('sb', 8.5, TINTA)
    doc.text(et, px, y + 19)
    T('n', 7, TINTA_3)
    doc.text(doc.splitTextToSize(nota, cw - 7), px, y + 23)
  })
  linea(y + 30)

  // ---- avance por grupo
  y = titulo('Avance por grupo', y + 43)
  const gruposVis = d.grupos.filter((g) => g.nombre !== 'Sin grupo' || d.grupos.length === 1)
  for (const g of gruposVis) {
    const p = g.total ? Math.round((g.llegaron / g.total) * 100) : 0
    T('sb', 10, TINTA)
    doc.text(g.nombre, M, y)
    T('n', 9, TINTA_3)
    doc.text(`${p}%`, W - M, y, { align: 'right' })
    T('b', 10, VERDE_OSCURO)
    doc.text(`${g.llegaron} de ${g.total}`, W - M - 12, y, { align: 'right' })
    apilada(M, y + 2.4, ANCHO, 3, [
      { n: g.directos, color: TEAL },
      { n: g.representantes, color: ORO },
    ], g.total)
    T('n', 7.8, TINTA_2)
    doc.text(`${g.directos} directos  ·  ${g.representantes} representantes  ·  ${g.total - g.llegaron} pendientes`, M, y + 9.6)
    y += 18
  }

  // ---- ritmo de llegadas (histograma cada 10 min)
  if (d.horas.length >= 3) {
    y = titulo('Ritmo de llegadas', y + 7)
    const PASO = 10 * 60000
    const t0 = Math.floor(d.horas[0] / PASO) * PASO
    const t1 = Math.floor(d.horas[d.horas.length - 1] / PASO) * PASO
    const n = Math.min(Math.round((t1 - t0) / PASO) + 1, 60)
    const cubetas = new Array(n).fill(0)
    for (const t of d.horas) cubetas[Math.min(Math.floor((t - t0) / PASO), n - 1)] += 1
    const maxC = Math.max(...cubetas)
    const altoG = 28
    const base = y + altoG
    const anchoG = Math.min(ANCHO * 0.62, n * 10)
    const bwid = anchoG / n
    const pico = cubetas.indexOf(maxC)
    cubetas.forEach((c, i) => {
      const x = M + i * bwid
      if (c > 0) {
        const h = Math.max((c / maxC) * (altoG - 6), 1.2)
        doc.setFillColor(...(i === pico ? VERDE_OSCURO : TEAL))
        doc.roundedRect(x + 0.7, base - h, bwid - 1.4, h, 0.8, 0.8, 'F')
        doc.rect(x + 0.7, base - Math.min(h, 1), bwid - 1.4, Math.min(h, 1), 'F')
        if (i === pico) {
          T('b', 7.5, VERDE_OSCURO)
          doc.text(String(c), x + bwid / 2, base - h - 1.5, { align: 'center' })
        }
      }
      const cada = n > 12 ? 3 : 2
      if (i % cada === 0) {
        T('n', 7, TINTA_3)
        doc.text(hora24(new Date(t0 + i * PASO).toISOString()), x + bwid / 2, base + 4.2, { align: 'center' })
      }
    })
    linea(base, M, M + anchoG, TINTA_3, 0.2)
    const notaX = M + anchoG + 12
    T('sb', 8.5, TINTA)
    doc.text('Mayor afluencia', notaX, y + 4)
    T('b', 16, VERDE_OSCURO)
    doc.text(hora24(new Date(t0 + pico * PASO).toISOString()), notaX, y + 11.5)
    T('n', 8, TINTA_2)
    doc.text(`${maxC} registros en 10 minutos`, notaX, y + 16.5)
    const puertas = Object.entries(d.porPuerta).sort((a, b) => b[1] - a[1])
    if (puertas.length) {
      T('sb', 8.5, TINTA)
      doc.text('Por puerta', notaX, y + 24.5)
      T('n', 8, TINTA_2)
      doc.text(puertas.map(([k, v]) => `Puerta ${k}: ${v}`).join('   ·   '), notaX, y + 29.5)
    }
  }

  // ======================= DETALLE =======================
  // Una tabla por grupo: la banda del grupo va como primera fila del
  // encabezado, así se repite si el grupo continúa en otra página y nunca
  // queda huérfana al pie (se salta de página si no caben al menos 3 filas).
  const relleno = { top: 1.7, bottom: 1.7, left: 1.5, right: 1.5 }
  const bandaGrupo = (txt, cols) => ({
    content: txt,
    colSpan: cols,
    styles: { font: FAM_SB, fontStyle: ESTILO_SB, fontSize: 8.8, textColor: VERDE_OSCURO, fillColor: TINTE_VERDE, halign: 'left', lineWidth: 0, cellPadding: { top: 2.3, bottom: 2.3, left: 2, right: 2 } },
  })
  const horaPuerta = (a) => `${hora24(a.timestamp_local)}${a.puerta ? `  ·  P${a.puerta}` : ''}`
  const asistencia = (a) => (a.representante ? `Representante${a.representante_nombre ? `: ${a.representante_nombre}` : ''}` : 'Titular')

  let cursor = 0
  const tituloSeccion = (txt, nota) => {
    T('b', 15, VERDE_OSCURO)
    doc.text(txt, M, cursor)
    const w = doc.getTextWidth(txt)
    T('n', 10, TINTA_3)
    doc.text(nota, M + w + 4, cursor)
    cursor += 6
  }
  const tablaGrupo = (banda, columnas, filas, columnStyles, alineaciones = {}) => {
    if (cursor > H - 52) {
      doc.addPage()
      cursor = 24
    }
    autoTable(doc, {
      theme: 'plain',
      margin: { left: M, right: M, top: 21, bottom: 16 },
      startY: cursor,
      head: [[bandaGrupo(banda, columnas.length)], columnas],
      body: filas,
      styles: { font: FAM, fontSize: 8.4, cellPadding: relleno, textColor: TINTA, lineColor: LINEA, lineWidth: { bottom: 0.15 }, valign: 'middle', overflow: 'linebreak' },
      headStyles: { font: FAM, fontStyle: 'bold', fontSize: 6.8, textColor: TINTA_3, lineWidth: { bottom: 0.25 }, lineColor: LINEA },
      columnStyles,
      rowPageBreak: 'avoid',
      didParseCell: (c) => {
        if (c.section === 'head' && c.row.index === 1 && alineaciones[c.column.index]) c.cell.styles.halign = alineaciones[c.column.index]
        if (c.section === 'body' && columnas.length === 6 && c.column.index === 3 && typeof c.cell.raw === 'string') {
          c.cell.styles.textColor = c.cell.raw.startsWith('Representante') ? [140, 96, 36] : TEAL
          c.cell.styles.fontSize = 7.9
        }
      },
    })
    cursor = doc.lastAutoTable.finalY + 7
  }

  // ---- Asistieron
  doc.addPage()
  cursor = 28
  tituloSeccion('Asistieron', `${d.llegaron + d.altas.length} personas`)
  const colsA = ['No.', 'Nombre', 'Institución', 'Asistencia', 'Acomp.', 'Hora · Puerta']
  const estilosA = {
    0: { cellWidth: 9, textColor: TINTA_3, fontSize: 7.4 },
    1: { cellWidth: 46, font: FAM_SB, fontStyle: ESTILO_SB },
    2: { cellWidth: 'auto', textColor: TINTA_2 },
    3: { cellWidth: 36 },
    4: { cellWidth: 11, halign: 'center' },
    5: { cellWidth: 22, halign: 'right' },
  }
  const filaA = (a, i) => [i, a.nombre, a.procedencia || '', asistencia(a), a.acompanantes ? `+${a.acompanantes}` : '', horaPuerta(a)]
  let no = 0
  let huboA = false
  for (const g of d.grupos) {
    const ll = g.lista.filter((a) => a.llego)
    if (!ll.length) continue
    huboA = true
    tablaGrupo(`${g.nombre}  ·  ${g.llegaron} de ${g.total}`, colsA, ll.map((a) => filaA(a, (no += 1))), estilosA, { 4: 'center', 5: 'right' })
  }
  if (d.altas.length) {
    huboA = true
    const altasOrd = [...d.altas].sort((x, z) => x.nombre.localeCompare(z.nombre, 'es'))
    tablaGrupo(`Altas en sitio  ·  ${d.altas.length}`, colsA, altasOrd.map((a) => filaA(a, (no += 1))), estilosA, { 4: 'center', 5: 'right' })
  }
  if (!huboA) {
    T('n', 10, TINTA_3)
    doc.text('Sin registros todavía.', M, cursor + 4)
    cursor += 12
  }

  // ---- Pendientes
  cursor += 8
  if (cursor > H - 70) {
    doc.addPage()
    cursor = 28
  }
  tituloSeccion('Pendientes', `${d.faltan} personas`)
  const colsP = ['No.', 'Nombre', 'Institución']
  const estilosP = {
    0: { cellWidth: 9, textColor: TINTA_3, fontSize: 7.4 },
    1: { cellWidth: 62, font: FAM_SB, fontStyle: ESTILO_SB },
    2: { cellWidth: 'auto', textColor: TINTA_2 },
  }
  no = 0
  let huboP = false
  for (const g of d.grupos) {
    const pe = g.lista.filter((a) => !a.llego)
    if (!pe.length) continue
    huboP = true
    tablaGrupo(`${g.nombre}  ·  ${pe.length} pendientes de ${g.total}`, colsP, pe.map((a) => [(no += 1), a.nombre, a.procedencia || '']), estilosP)
  }
  if (!huboP) {
    T('n', 10, TINTA_3)
    doc.text('No hay pendientes: asistió todo el padrón.', M, cursor + 4)
  }

  // ---- encabezado corrido y pie en todas las páginas
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    if (i > 1) {
      doc.setFillColor(...VERDE_OSCURO)
      doc.rect(0, 0, W, 3, 'F')
      T('sb', 8, TINTA_2)
      doc.text(String(reporte.evento_nombre || 'Evento'), M, 12)
      T('n', 8, TINTA_3)
      doc.text('Reporte de asistencia', W - M, 12, { align: 'right' })
      linea(14.5)
    }
    linea(H - 11)
    T('n', 7.5, TINTA_3)
    doc.text('Secretaría de Gobernación', M, H - 6.5)
    doc.text(`Página ${i} de ${paginas}`, W - M, H - 6.5, { align: 'right' })
  }
  return doc
}

// Carga una fuente de /fonts como base64 (solo al exportar).
async function fuenteB64(archivo) {
  const res = await fetch(`${import.meta.env.BASE_URL}fonts/${archivo}`)
  if (!res.ok) throw new Error(`fuente ${archivo}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export async function descargarPdf(reporte) {
  let fuentes = null
  try {
    const [regular, semibold, bold] = await Promise.all([
      fuenteB64('Gilroy-Regular.ttf'),
      fuenteB64('Gilroy-SemiBold.ttf'),
      fuenteB64('Gilroy-ExtraBold.ttf'),
    ])
    fuentes = { regular, semibold, bold }
  } catch {
    fuentes = null // sin red o sin archivo: Helvetica
  }
  const doc = await construirPdf(reporte, fuentes)
  doc.save(`reporte-asistencia-${ahoraStamp()}.pdf`)
}
