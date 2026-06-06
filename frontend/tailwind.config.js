/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#00D4FF',
        panel: '#0D1624',
        panelSoft: '#122033',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(0, 212, 255, 0.15), 0 18px 60px rgba(0, 212, 255, 0.08)',
      },
      backgroundImage: {
        'radial-grid':
          'radial-gradient(circle at top left, rgba(0, 212, 255, 0.22), transparent 32%), radial-gradient(circle at bottom right, rgba(0, 212, 255, 0.12), transparent 28%), linear-gradient(180deg, #050b14 0%, #08111d 60%, #050b14 100%)',
      },
    },
  },
  plugins: [],
};
