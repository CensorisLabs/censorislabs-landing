/** Tailwind config for NativeWind. Mirrors src/ui/theme.ts — keep in sync. */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        marble: '#EEF1F3',
        basalt: '#1E2227',
        tyrian: '#5B1F4E',
        bronze: '#8E5B22',
        verdigris: '#2F6B62',
        'dark-bg': '#16181C',
        'dark-surface': '#1F2227',
        'dark-text': '#E8EAED',
        'dark-primary': '#8A3A78',
        'dark-accent': '#D9A25F',
        'dark-positive': '#6FB8AC',
      },
      borderRadius: {
        DEFAULT: '3px',
        md: '5px',
        lg: '8px',
      },
    },
  },
  plugins: [],
};
