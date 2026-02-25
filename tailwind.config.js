/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/pages/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#EEFCFE',
          100: '#D5F7FD',
          200: '#B0EFFC',
          300: '#7AE4F9',
          400: '#3CD4F5',
          500: '#13DEFC',
          600: '#06B3D4',
          700: '#078EA9',
          800: '#0B7189',
          900: '#0F5D71',
          DEFAULT: '#13DEFC',
        },
        secondary: '#ffffff',
        dark: '#171717',
        light: '#ffffff',
        accent: '#09B00F',
        success: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#47c799',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          DEFAULT: '#47c799',
        },
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#fbbc05',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          DEFAULT: '#fbbc05',
        },
        error: {
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#f28b82',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          DEFAULT: '#f28b82',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'btn-sm': ['0.75rem', { lineHeight: '1rem' }],
        'btn-base': ['0.875rem', { lineHeight: '1.25rem' }],
        'btn-lg': ['1rem', { lineHeight: '1.5rem' }],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    function ({ addVariant }) {
      addVariant('portrait', '@media (orientation: portrait)')
      addVariant('landscape', '@media (orientation: landscape)')
    },
  ],
}
