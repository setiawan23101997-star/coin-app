/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: '#c8922a',
        'gold-light': '#e6b048',
        'gold-bright': '#f2cc60',
        blood: '#6b1414',
        void: '#0a0706',
        dark: '#161110',
        card: '#221a16',
        text: '#e0cdb0',
        'text-dim': '#6e5840',
      },
      fontFamily: {
        spectral: ['Spectral', 'serif'],
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}