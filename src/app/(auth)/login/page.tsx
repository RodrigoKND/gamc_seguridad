import { LoginForm } from '@/features/auth/components/LoginForm';
import { Lock, RadioTower, ShieldCheck } from 'lucide-react';

// RF-02, RF-03 (MASTER.md sección 7.3). Split screen: panel institucional
// (paleta del logo — tinta primary-900 + dorado accent, ver sección 4) +
// tarjeta de acceso.
// F7 (2026-10-17, pedido del usuario): vuelve la paleta negro/dorado y la
// marca de agua semitransparente del logo; se quitó el logo enmarcado que
// iba encima del título, y el bloque de texto sube a la altura donde estaba
// ese logo (lg:pb-32 compensa el centrado vertical). El divisor con rombo
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
      <div className="relative z-10 order-2 flex flex-col justify-center overflow-hidden bg-primary-900 px-8 py-16 text-white sm:px-16 lg:order-1">
        {/* Marca de agua: nuestro logo real, muy difuminado — mask-image en
            radial-gradient lo desvanece hacia los bordes para que lea como
            textura de fondo, no como un logo sobrepuesto. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- decorativo, tamaño fijo */}
        <img
          src="/logo-gamc.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 bottom-[-140px] h-[560px] w-[560px] animate-watermark-in object-contain opacity-[0.14] blur-[1px] motion-reduce:animate-none [mask-image:radial-gradient(circle_at_center,black_35%,transparent_75%)]"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-accent-600" />

        <div className="stagger-children relative lg:pb-32">
          <p className="mb-2 text-[13px] font-semibold tracking-[0.14em] text-accent-500">
            GOBIERNO AUTÓNOMO MUNICIPAL DE COCHABAMBA
          </p>
          <h1 className="mb-6 max-w-md text-[34px] font-bold leading-[1.15] tracking-tight">
            Plataforma de Seguridad Ciudadana
          </h1>

          <ul className="max-w-md space-y-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            {TRUST_POINTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-accent-500 ring-[1.5px] ring-inset ring-primary-300">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="text-sm text-primary-200">{label}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Panel del formulario — "flota" sobre el panel institucional en la costura:
          esquinas redondeadas + solape con margen negativo + sombra de tinta.
          En móvil la costura es el borde inferior (rounded-b, sombra hacia abajo); en
          desktop es el borde izquierdo (rounded-l, sombra hacia la izquierda). */}
      <div className="relative z-20 order-1 -mb-7 flex items-center justify-center rounded-b-[32px] bg-neutral-bg px-6 py-14 shadow-[0_18px_40px_-15px_rgba(13,13,14,0.45)] lg:order-2 lg:mb-0 lg:-ml-12 lg:rounded-b-none lg:rounded-l-[40px] lg:py-16 lg:shadow-[-24px_0_50px_-20px_rgba(13,13,14,0.5)]">
        <LoginForm />
      </div>
    </div>
  );
}
