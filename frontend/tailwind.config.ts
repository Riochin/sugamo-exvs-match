import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'base-900': '#090014',
        'base-800': '#12002b',
        'base-600': '#2b008e',
        accent: '#c20e00',
        brand: '#0d36ac',
      },
    },
  },
  plugins: [],
} satisfies Config
