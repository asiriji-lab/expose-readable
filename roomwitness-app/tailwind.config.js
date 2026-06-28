/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#0062FF',
        'primary-soft': '#E6F0FF',
        'primary-dark': '#0047B3',
        lawful: '#16A34A',
        'lawful-soft': '#DCFCE7',
        disputed: '#D97706',
        'disputed-soft': '#FEF3C7',
        unlawful: '#DC2626',
        'unlawful-soft': '#FEE2E2',
        'surface-navy': '#0B1F3A',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
      },
      fontFamily: {
        display: ['BaiJamjuree_600SemiBold'],
        thai: ['NotoSansThai_400Regular'],
        mono: ['IBMPlexMono_500Medium'],
        body: ['Inter_400Regular'],
      },
    },
  },
  plugins: [],
};
