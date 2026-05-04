/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF5A36',
        secondary: '#FF8A6B',
        sovereignty: '#E64980',
        evolution: '#7950F2',
        capability: '#20C997',
        execution: '#339AF0',
      },
    },
  },
  plugins: [],
}
