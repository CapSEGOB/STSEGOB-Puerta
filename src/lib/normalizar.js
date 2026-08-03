// Reglas del CONTRATO del evento 6-AGO. Deben coincidir EXACTAMENTE
// con el ETL y las funciones SQL.

// Alfabeto base32 Crockford (sin I, L, O, U)
export const ALFABETO_FOLIO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

// Normalización de folio capturado: trim, mayúsculas, quitar espacios y
// guiones, mapear I→1, L→1, O→0.
export function normalizarFolio(entrada) {
  if (entrada == null) return ''
  return String(entrada)
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/I/g, '1')
    .replace(/L/g, '1')
    .replace(/O/g, '0')
}

// Válido solo si tras normalizar son exactamente 6 caracteres del alfabeto.
export function esFolioValido(folio) {
  if (typeof folio !== 'string' || folio.length !== 6) return false
  for (const c of folio) {
    if (!ALFABETO_FOLIO.includes(c)) return false
  }
  return true
}

// Normalización de texto para búsqueda: NFD, quitar diacríticos,
// minúsculas, colapsar espacios múltiples.
export function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
