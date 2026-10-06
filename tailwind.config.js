/** @type {import('tailwindcss').Config} */
// Tokens según MASTER.md sección 3 (tipografía) y sección 4 (color).
// No agregar tokens que no estén documentados en MASTER.md.
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'sans-serif'],
      },
      colors: {
        // Marca institucional — paleta Innova, idéntica a la app móvil de
        // guardias (appmunicipal/src/theme/colors.ts). Tokens semánticos:
        // los componentes usan `primary-*` / `accent-*`, nunca hex sueltos.
        // Ver MASTER.md sección 4 (roles y tabla de contraste).
        'primary-950': '#3A2C6B',
        'primary-900': '#4D3B86',
        'primary-800': '#5A4794',
        'primary-700': '#6B559F',
        'primary-500': '#8C78BF',
        'primary-300': '#B8A9DA',
        'primary-200': '#E1D9F2',
        'primary-100': '#EFEAF8',
        'primary-50': '#F5F2FA',
        'accent-700': '#9E2248',
        'accent-600': '#C2335D',
        'accent-500': '#E8567F',
        'accent-300': '#F28BA6',
        'accent-100': '#FCE8EE',

        // Semántica de riesgo / estado
        'risk-critical': '#DC2626',
        'risk-high': '#F97316',
        'risk-medium': '#EAB308',
        'risk-low': '#22C55E',

        // Territorial (EPI)
        'epi-norte': '#5DADE2',
        'epi-central': '#26A69A',
        'epi-sud': '#F5A623',
        'epi-cona': '#8E6FCE',
        'epi-centro': '#0B1B3D', // categórico territorial, no es color de marca

        // Neutrales — tintados en lila (mismos valores que la app móvil)
        'neutral-bg': '#F5F2FA',
        'neutral-border': '#DDD6EC',
        'neutral-text': '#1F1A2E',
        'neutral-text-muted': '#6B6880',
      },
      maxWidth: {
        stage: '1600px',
      },
      // Transiciones suaves reutilizables — modales/drawers (MASTER.md
      // sección 10), header pulsante de emergencia (sección 9), shimmer de
      // skeleton. Respetan prefers-reduced-motion vía el helper
      // `motion-safe:` de Tailwind en el punto de uso.
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'pulse-emergency': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(220,38,38,0.55)' },
          '50%': { boxShadow: '0 0 0 8px rgba(220,38,38,0)' },
        },
        // Dashboard: entrada en cascada de la cinta de KPIs (rise-up), barras
        // que crecen desde la izquierda (grow-bar) y línea de gráfico que se
        // dibuja a sí misma (draw-line, técnica pathLength). Portado desde
        // refactor/dashboard-design, adaptado a los tokens de la sección 4.
        'rise-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'grow-bar': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        'draw-line': {
          from: { strokeDashoffset: '1' },
          to: { strokeDashoffset: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'fade-in-up': 'fade-in-up 350ms ease-out both',
        'scale-in': 'scale-in 200ms ease-out',
        'slide-in-right': 'slide-in-right 250ms cubic-bezier(0.32,0.72,0,1)',
        'pulse-emergency': 'pulse-emergency 1.6s infinite',
        'rise-up': 'rise-up 600ms cubic-bezier(0.22,1,0.36,1) both',
        'grow-bar': 'grow-bar 800ms cubic-bezier(0.22,1,0.36,1) both',
        'draw-line': 'draw-line 1400ms ease-out both',
      },
    },
  },
  plugins: [],
};
