/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{vue,js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        primary: '#000666',
        'primary-light': '#1a237e',
        'primary-hover': '#0a0f7a',
        surface: '#f7f9fc',
        'surface-container': '#eceef1',
        'surface-container-low': '#f2f4f7',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
        success: '#1b6b3a',
        'success-container': '#d4f5e2'
      },
      fontFamily: {
        headline: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif']
      }
    }
  },
  plugins: []
}
