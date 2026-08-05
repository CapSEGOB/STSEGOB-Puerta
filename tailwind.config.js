/** @type {import('tailwindcss').Config} */
// Identidad institucional SEGOB — tomada de las Carpetas de Gira (pap-test):
// guinda #6e1b33 / oscuro #5a1429 / tablas #822844, oro #bd9647 / claro #c8a24c,
// tipografía Gilroy. Los estados operativos (éxito de conexión, duplicado,
// error) conservan verde/ámbar/rojo semánticos de Tailwind.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        vino: {
          DEFAULT: '#6e1b33',
          oscuro: '#5a1429',
          claro: '#822844',
          tinte: '#f9e9ee',
          borde: '#f1c9d5',
        },
        oro: {
          DEFAULT: '#bd9647',
          claro: '#c8a24c',
          texto: '#8f6c30',
        },
        papel: '#f7f4f2',
        // Alias del esquema anterior → nueva identidad (evita migrar cada clase)
        brand: {
          gold: '#bd9647',
          red: '#9d2449',
          gray: '#4b4b4b',
          dark: '#5a1429',
          teal: '#822844',
          green: '#6e1b33',
        },
      },
      fontFamily: {
        sans: ['Gilroy', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      letterSpacing: {
        kicker: '0.18em',
      },
    },
  },
  plugins: [],
}
