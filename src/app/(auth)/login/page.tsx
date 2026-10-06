import { Logo } from '@/components/ui/Logo';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { Lock, RadioTower, ShieldCheck } from 'lucide-react';

// RF-02, RF-03 (MASTER.md sección 7.3). Split screen: panel institucional
// (paleta Innova — primary/accent, ver sección 4) + tarjeta de acceso.
// Rediseño 2026-10-05 (skill ui-ux-pro-max): panel PLANO primary-700, el lila
// de Innova y de la app móvil — sin degradados, halos ni marca de agua (el
// escudo negro difuminado sobre lila se leía como una mancha, y los halos
// púrpura/rosa son el anti-patrón "AI purple/pink gradients"). Se conserva
// el logo, sin modificaciones, en un marco translúcido. El divisor con rombo
// central se eliminó a pedido del usuario (2026-10-06).
//
// 2026-09-07 (ajustes a pedido del usuario):
// 1. Proporción 65/35 (panel institucional / formulario) en desktop — fija;
//    el orden invertido en móvil (punto 3) no la afecta (grid-cols vs. order
//    son ejes independientes).
// 2. El panel del formulario "flota" sobre el panel institucional en el
//    borde donde ambos chocan — esquinas redondeadas + solape con margen
//    negativo + sombra tintada en la costura (skill ui-ux-pro-max, estilo
//    "Dimensional Layering": profundidad vía esquinas + superposición,
//    no solo un box-shadow plano que no se nota entre dos superficies
//    oscuras). En desktop la costura es el lado izquierdo del formulario
//    (rounded-l + sombra proyectada hacia la izquierda); en móvil es el
//    borde inferior (rounded-b + sombra proyectada HACIA ABAJO, sobre el
//    panel institucional que queda debajo) — la sombra debe
//    apuntar hacia donde de verdad está la costura en cada layout, si no,
//    quedan fuera de pantalla o del lado equivocado y el efecto desaparece.
// 3. Orden invertido SOLO en pantallas pequeñas (`order-*` sin prefijo):
//    en móvil el formulario aparece primero; en desktop (`lg:`) el panel
//    institucional vuelve a ir primero (izquierda).
//
// Fix (verificado con getComputedStyle/elementFromPoint, no a simple vista):
// con el mismo z-index en ambos paneles, en grid/flex el que tiene `order`
// más alto se pinta ENCIMA (paint sigue "order-modified document order",
// no el orden real del DOM) — el panel institucional (order-2 en móvil)
// tapaba por completo la esquina redondeada/sombra del formulario (order-1).
// El panel del formulario ahora usa z-20 (> z-10 del institucional) para
// ganar siempre, sin importar el `order` de cada breakpoint.
//
// Sin marco inscrito (decisión del usuario, 2026-09-07): se probó un borde
// de acento envolviendo el viewport y se descartó — no volver a agregarlo.

const TRUST_POINTS = [
  { icon: ShieldCheck, label: 'Acceso exclusivo para personal autorizado' },
  { icon: Lock, label: 'Sesión cifrada de extremo a extremo' },
  { icon: RadioTower, label: 'Actividad monitoreada y auditada' },
];

export default function LoginPage() {
  return (
    <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,13fr)_minmax(380px,7fr)]">
      <div className="relative z-10 order-2 flex flex-col justify-center overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 px-8 py-16 text-white sm:px-16 lg:order-1">
        {/* Trama diagonal fina (repeating-linear-gradient puro CSS): da textura
            de superficie sin el degradado radial tipo "AI gradient". */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(135deg,#fff_0,#fff_1px,transparent_1px,transparent_16px)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-accent-600"
        />
        <div className="relative">
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl border border-white/25 bg-white/15 p-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-white/30 backdrop-blur-xl">
            <Logo size={72} />
          </div>

          <p className="mb-2 text-[13px] font-semibold tracking-[0.14em] text-accent-300">
            GOBIERNO AUTÓNOMO MUNICIPAL DE COCHABAMBA
          </p>
          <h1 className="mb-4 max-w-md text-[34px] font-bold leading-[1.15] tracking-tight">
            Plataforma de Seguridad Ciudadana
          </h1>

          <div className="max-w-md">
            <ul className="space-y-2.5 rounded-2xl border border-white/15 bg-white/[0.08] p-4">
              {TRUST_POINTS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-accent-300 ring-1 ring-inset ring-white/25">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="text-sm text-primary-100">{label}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Panel del formulario — "flota" sobre el panel institucional en la costura:
          esquinas redondeadas + solape con margen negativo + sombra tintada en púrpura.
          En móvil la costura es el borde inferior (rounded-b, sombra hacia abajo); en
          desktop es el borde izquierdo (rounded-l, sombra hacia la izquierda). */}
      <div className="relative z-20 order-1 -mb-7 flex items-center justify-center rounded-b-[32px] bg-neutral-bg px-6 py-14 shadow-[0_18px_40px_-15px_rgba(58,44,107,0.45)] lg:order-2 lg:mb-0 lg:-ml-12 lg:rounded-b-none lg:rounded-l-[40px] lg:py-16 lg:shadow-[-24px_0_50px_-20px_rgba(58,44,107,0.5)]">
        <LoginForm />
      </div>
    </div>
  );
}
