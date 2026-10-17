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
        // Marca institucional — paleta del logo 2026 (escudo negro + dorado
        // bronce), recuperada 2026-10-17 tras el paréntesis Innova. Tokens
        // semánticos: los componentes usan `primary-*` (tinta: superficies y
        // texto de marca) y `accent-*` (dorado: foco, activos y acentos),
        // nunca hex sueltos. Contraste (MASTER.md sección 4): el dorado 500/600
        // NO pasa 4.5:1 sobre blanco — en texto sobre fondo claro va accent-700
        // (5.1:1); 500/300 solo sobre tinta (6.9:1 / 9.9:1) o como borde/anillo.
        'primary-950': '#0D0D0E',
        'primary-900': '#1A1A1A',
        'primary-800': '#262624',
        'primary-700': '#3D3A35',
        'primary-500': '#6E6B63',
        'primary-300': '#B3ADA2',
        'primary-200': '#E3DED4',
        'primary-100': '#F1EDE5',
        'primary-50': '#F8F6F2',
        'accent-700': '#8C6740',
        'accent-600': '#A97F52',
        'accent-500': '#C59B6D',
        'accent-300': '#DDBE97',
        'accent-100': '#F3E7D8',

        // Semántica de riesgo / estado
        'risk-critical': '#DC2626',
        // Texto rojo sobre fondos claros/tintados (6.5:1 sobre blanco) —
        // risk-critical solo llega a 4.8:1 sobre blanco y baja de 4.5 tintado.
        'risk-critical-700': '#B91C1C',
        'risk-high': '#F97316',
        'risk-medium': '#EAB308',
        'risk-low': '#22C55E',

        // Territorial (EPI)
        'epi-norte': '#5DADE2',
        'epi-central': '#26A69A',
        'epi-sud': '#F5A623',
        'epi-cona': '#8E6FCE',
        'epi-centro': '#0B1B3D', // categórico territorial, no es color de marca

        // Neutrales — cálidos, para acompañar al dorado (muted 5.2:1 sobre bg)
        'neutral-bg': '#F6F5F1',
        'neutral-border': '#E4E0D6',
        'neutral-text': '#1F1E1B',
        'neutral-text-muted': '#6B675F',
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
          to: { opacity: '1', transform: 'none' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'none' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'none' },
        },
        // Dashboard: entrada en cascada de la cinta de KPIs (rise-up), barras
        // que crecen desde la izquierda (grow-bar) y línea de gráfico que se
        // dibuja a sí misma (draw-line, técnica pathLength). Portado desde
        // refactor/dashboard-design, adaptado a los tokens de la sección 4.
        'rise-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'grow-bar': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        'draw-line': {
          from: { strokeDashoffset: '1' },
          to: { strokeDashoffset: '0' },
        },
        // Todas las entradas terminan en `transform: none` (no translate(0)):
        // con fill-mode both un transform residual convierte al elemento en
        // bloque contenedor de sus hijos `position: fixed` (modales, drawers).
        // F7 (2026-10-17): entrada de página y de menús desplegables, y el
        // "sonar" de SOS — un anillo que se expande y se desvanece desde el
        // avatar/pin en vez de hacer parpadear toda la ficha (menos fatiga,
        // la urgencia la sigue marcando el color + la etiqueta).
        // page-in solo con opacidad: <main> envuelve páginas que abren
        // modales al montar (deep links del mapa) y un transform, aunque sea
        // durante la animación, los encerraría en <main>.
        'page-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'dropdown-in': {
          from: { opacity: '0', transform: 'translateY(-4px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        'sos-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '70%, 100%': { transform: 'scale(2.1)', opacity: '0' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          to: { opacity: '1', transform: 'none' },
        },
        // Marca de agua del login: aparece con algo de color y se asienta en
        // su opacidad final (0.14) sin salto — fade-in iba a 1 y al terminar
        // caía de golpe a la opacidad de la clase.
        'watermark-in': {
          '0%': { opacity: '0' },
          '30%': { opacity: '0.45' },
          '100%': { opacity: '0.14' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'fade-in-up': 'fade-in-up 350ms ease-out both',
        'scale-in': 'scale-in 200ms ease-out',
        'slide-in-right': 'slide-in-right 250ms cubic-bezier(0.32,0.72,0,1)',
        'rise-up': 'rise-up 600ms cubic-bezier(0.22,1,0.36,1) both',
        'grow-bar': 'grow-bar 800ms cubic-bezier(0.22,1,0.36,1) both',
        'draw-line': 'draw-line 1400ms ease-out both',
        'page-in': 'page-in 280ms ease-out backwards',
        'dropdown-in': 'dropdown-in 160ms cubic-bezier(0.22,1,0.36,1) both',
        'sos-ring': 'sos-ring 2.2s cubic-bezier(0,0,0.2,1) infinite',
        'slide-in-left': 'slide-in-left 260ms cubic-bezier(0.22,1,0.36,1) both',
        'watermark-in': 'watermark-in 2400ms ease-in-out both',
      },
    },
  },
  plugins: [],
};
