/** @type {import('tailwindcss').Config} */
// Identidad sobria: un solo color fuerte (verde institucional oscuro) sobre
// fondos claros y tarjetas blancas — el estilo de las apps del usuario.
// El dorado se usa solo como detalle fino (pase). Estados operativos:
// verde/ámbar/rojo semánticos de Tailwind.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          gold: '#c79c67',
          red: '#7d2b39',
          gray: '#4b4b4b',
          dark: '#0e322e',
          teal: '#26645b',
          green: '#409b84',
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
