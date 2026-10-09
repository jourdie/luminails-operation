import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#302b2d',
        linen: '#f7f4f0',
        shell: '#fffdfb',
        blush: '#e8b9b0',
        blushDeep: '#a85e5f',
        sage: '#dce5dd',
        amber: '#f5e2ba'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'ui-sans-serif', 'sans-serif']
      },
      boxShadow: {
        panel: '0 12px 40px rgba(48, 43, 45, 0.06)'
      }
    }
  },
  plugins: [forms]
} satisfies Config
