/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          bg: '#F5F5F7',
          card: '#FFFFFF',
          sidebar: '#FBFBFD',
          text: '#1D1D1F',
          secondary: '#86868B',
          border: '#E5E5EA',
          blue: '#0071E3',
          green: '#34C759',
          orange: '#FF9500',
          red: '#FF3B30',
          cyan: '#5AC8FA',
          purple: '#AF52DE',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
