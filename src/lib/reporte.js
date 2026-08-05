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
    'Método': f.metodo,
    Origen: f.origen,
  }))
  const hojaDetalle = XLSX.utils.json_to_sheet(filas)
  hojaDetalle['!cols'] = [
    { wch: 5 }, { wch: 34 }, { wch: 20 }, { wch: 18 }, { wch: 10 },
    { wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 30 }, { wch: 8 },
    { wch: 7 }, { wch: 12 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, hojaDetalle, 'Asistentes')

  XLSX.writeFile(wb, `reporte-asistentes-${ahoraStamp()}.xlsx`)
}

// ---------------------------------------------------------------- PDF
function barraH(doc, { x, y, ancho, alto, frac, color, etiqueta, valor }) {
  doc.setFillColor(...GRIS_CLARO)
  doc.roundedRect(x, y, ancho, alto, 1.5, 1.5, 'F')
  if (frac > 0) {
    doc.setFillColor(...color)
    doc.roundedRect(x, y, Math.max(ancho * Math.min(frac, 1), 2.5), alto, 1.5, 1.5, 'F')
  }
  doc.setFontSize(9)
  doc.setTextColor(60)
  doc.setFont('helvetica', 'normal')
  doc.text(etiqueta, x, y - 1.5)
  doc.setFont('helvetica', 'bold')
  doc.text(String(valor), x + ancho, y - 1.5, { align: 'right' })
}

export async function descargarPdf(reporte) {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const r = resumenDe(reporte)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 14 // margen

  // Cabecera
  doc.setFillColor(...VERDE_OSCURO)
  doc.rect(0, 0, W, 30, 'F')
  doc.setTextColor(...DORADO)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('REPORTE DE ASISTENTES', M, 11, { charSpace: 1 })
  doc.setTextColor(255)
  doc.setFontSize(16)
  doc.text(String(reporte.evento_nombre || 'Evento'), M, 19)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(220)
  doc.text(`Generado: ${new Date(reporte.generado).toLocaleString('es-MX')}`, M, 25.5)

  // KPIs
  const kpis = [
    ['Padrón', r.total_padron],
    ['Llegaron', r.llegaron],
    ['Pendientes', r.faltan],
    ['Representantes', r.representantes],
    ['Acompañantes', r.acompanantes],
    ['Alta en sitio', r.alta_sitio],
  ]
  const kw = (W - M * 2 - 5 * 4) / 6
  let y = 38
  kpis.forEach(([et, v], i) => {
    const x = M + i * (kw + 4)
    doc.setFillColor(...GRIS_CLARO)
    doc.roundedRect(x, y, kw, 20, 2, 2, 'F')
    doc.setTextColor(...VERDE_OSCURO)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text(String(v), x + kw / 2, y + 10, { align: 'center' })
    doc.setTextColor(110)
    doc.setFontSize(6.8)
    doc.text(et.toUpperCase(), x + kw / 2, y + 16, { align: 'center' })
  })

  // Gráficas de barras
  y = 70
  const anchoBarra = W - M * 2
  doc.setTextColor(...VERDE_OSCURO)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Avance del evento', M, y)
  y += 7
  barraH(doc, { x: M, y, ancho: anchoBarra, alto: 6, frac: r.total_padron ? r.llegaron / r.total_padron : 0, color: VERDE, etiqueta: `Llegaron ${r.total_padron ? Math.round((r.llegaron / r.total_padron) * 100) : 0}%`, valor: `${r.llegaron} de ${r.total_padron}` })
  y += 14

  const llegadosTotales = r.invitados + r.representantes
  doc.setFontSize(11)
  doc.setTextColor(...VERDE_OSCURO)
  doc.text('¿Quién llegó?', M, y)
  y += 7
  barraH(doc, { x: M, y, ancho: anchoBarra, alto: 5, frac: llegadosTotales ? r.invitados / llegadosTotales : 0, color: VERDE, etiqueta: 'Invitados', valor: r.invitados })
  y += 11
  barraH(doc, { x: M, y, ancho: anchoBarra, alto: 5, frac: llegadosTotales ? r.representantes / llegadosTotales : 0, color: DORADO, etiqueta: 'Representantes', valor: r.representantes })
  y += 14

  const metodos = Object.entries(r.porMetodo).sort((a, b) => b[1] - a[1])
  if (metodos.length) {
    doc.setFontSize(11)
    doc.setTextColor(...VERDE_OSCURO)
    doc.text('Por método de registro', M, y)
    y += 7
    const maxM = Math.max(...metodos.map(([, v]) => v))
    for (const [met, v] of metodos) {
      barraH(doc, { x: M, y, ancho: anchoBarra, alto: 5, frac: maxM ? v / maxM : 0, color: VERDE, etiqueta: ETIQUETAS_METODO[met] || met, valor: v })
      y += 11
    }
    y += 3
  }

  const puertas = Object.entries(r.porPuerta).sort((a, b) => b[1] - a[1])
  if (puertas.length) {
    doc.setFontSize(11)
    doc.setTextColor(...VERDE_OSCURO)
    doc.text('Por puerta', M, y)
    y += 7
    const maxP = Math.max(...puertas.map(([, v]) => v))
    for (const [pu, v] of puertas) {
      barraH(doc, { x: M, y, ancho: anchoBarra, alto: 5, frac: maxP ? v / maxP : 0, color: GRIS, etiqueta: `Puerta ${pu}`, valor: v })
      y += 11
    }
  }

  // Detalle en tabla (páginas siguientes)
  const filas = filasDetalle(reporte)
  autoTable(doc, {
    startY: null,
    pageBreak: 'always',
    margin: { left: M, right: M, top: 16 },
    head: [['No.', 'Nombre', 'Procedencia', 'Estado', 'Quién llegó', 'Representante', 'Acomp.', 'Hora', 'Puerta']],
    body: filas.map((f) => [f.no, f.nombre, f.procedencia, f.estado, f.quien, f.representante_nombre, f.acompanantes || '', f.hora, f.puerta]),
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.6, textColor: 50 },
    headStyles: { fillColor: VERDE_OSCURO, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: GRIS_CLARO },
    columnStyles: {
      0: { cellWidth: 8 },
      3: { cellWidth: 16 },
      4: { cellWidth: 20 },
      6: { cellWidth: 13 },
      7: { cellWidth: 12 },
      8: { cellWidth: 12 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        data.cell.styles.textColor = data.cell.raw === 'Llegó' ? [22, 101, 52] : [148, 163, 184]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // Pie de página
  const paginas = doc.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setTextColor(150)
    doc.text('Secretaría de Gobernación', M, doc.internal.pageSize.getHeight() - 7)
    doc.text(`Página ${i} de ${paginas}`, W - M, doc.internal.pageSize.getHeight() - 7, { align: 'right' })
  }

  doc.save(`reporte-asistentes-${ahoraStamp()}.pdf`)
}
