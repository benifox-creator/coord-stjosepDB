/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#861414',
        accent: '#ff9c02',
        secondary: '#0c71c3',
        surface: '#f5f5f5',
        'text-main': '#1a1a1a',
      },
    },
  },
  plugins: [],
}
