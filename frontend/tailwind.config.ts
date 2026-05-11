import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#b38ec7',
        'bg-sub': '#9681a2',
        main: '#2b008e',
        dark: '#12002b',
        // サブカラー（現在未使用）
        accent: '#c20e00',
        brand: '#0d36ac',
      },
    },
  },
  plugins: [],
} satisfies Config
