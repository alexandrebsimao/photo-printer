/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#202124',
        paper: '#f5f4f1',
        panel: '#fbfaf8',
        accent: '#d85f3f'
      },
      boxShadow: {
        paper: '0 18px 45px rgba(42, 37, 31, 0.14)'
      }
    }
  },
  plugins: []
}
