/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          gold:    '#c79c67',
          red:     '#7d2b39',
          gray:    '#4b4b4b',
          dark:    '#0e322e',
          teal:    '#26645b',
          green:   '#409b84',
        },
      },
    },
  },
  plugins: [],
}
