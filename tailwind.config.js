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
        // Marca institucional — legado (en migración, ver MASTER.md sección 4:
        // pantallas aún no migradas a la paleta 2026 siguen usando estos tokens)
        'brand-navy-950': '#0B1B3D',
        'brand-navy-800': '#16264D',
        'brand-blue-600': '#1D4ED8',

        // Marca institucional — paleta vigente, extraída del logo 2026
        // (escudo negro + dorado bronce). brand-gold-500 reemplaza el valor
        // anterior (#C9A227) por el tono real del nuevo logo; el resto de la
        // escala es nueva.
        'brand-ink-950': '#0D0D0E',
        'brand-ink-900': '#1A1A1A',
        'brand-ink-800': '#262624',
        'brand-ink-700': '#3D3A35',
        'brand-gold-500': '#C59B6D',
        'brand-gold-600': '#A97F52',
        'brand-gold-700': '#8C6740',
        'brand-gold-300': '#DDBE97',
        'brand-gold-100': '#F3E7D8',

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
        'epi-centro': '#0B1B3D',

        // Neutrales
        'neutral-bg': '#F5F7FA',
        'neutral-border': '#E5E7EB',
        'neutral-text': '#1F2937',
        'neutral-text-muted': '#6B7280',
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
