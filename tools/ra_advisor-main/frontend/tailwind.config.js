/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0B0D12',
          card: '#12162A',
          hover: '#1B2038',
          border: '#233044',
          muted: '#64748B',
          text: '#F1F5F9',
        },
        brand: {
          blue: '#0284C7',
          cyan: '#06B6D4',
          accent: '#38BDF8'
        },
        status: {
          pass: '#10B981',
          warning: '#F59E0B',
          fail: '#EF4444',
          info: '#3B82F6'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
