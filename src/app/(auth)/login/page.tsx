import { Logo } from '@/components/ui/Logo';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { Lock, RadioTower, ShieldCheck } from 'lucide-react';

// RF-02, RF-03 (MASTER.md sección 7.3). Split screen: panel institucional
// (paleta 2026 — brand-ink/brand-gold, ver sección 4) + tarjeta de acceso.
// Identidad visual (2026-09-06): en vez de textura genérica (grid + blobs),
// se retoman dos motivos reales del escudo (design/mockups/Logo_Escudo.png)
// — el marco dorado inscrito a un margen fijo del borde, y el divisor con
// rombo central (motivo heráldico) — para que el panel se sienta propio del
// GAMC y no un patrón de stock reutilizable en cualquier producto.
//
// 2026-09-07 (ajustes a pedido del usuario):
// 1. Proporción 65/35 (panel institucional / formulario) en desktop — fija;
//    el orden invertido en móvil (punto 3) no la afecta (grid-cols vs. order
//    son ejes independientes).
// 2. El panel del formulario "flota" sobre el panel institucional en el
//    borde donde ambos chocan — esquinas redondeadas + solape con margen
//    negativo + halo dorado en la costura (skill ui-ux-pro-max, estilo
//    "Dimensional Layering": profundidad vía esquinas + superposición,
//    no solo un box-shadow plano que no se nota entre dos superficies
//    oscuras). En desktop la costura es el lado izquierdo del formulario
//    (rounded-l + sombra proyectada hacia la izquierda); en móvil es el
//    borde inferior (rounded-b + sombra proyectada HACIA ABAJO, sobre el
//    panel institucional que queda debajo) — la sombra y el halo deben
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
// dorado envolviendo el viewport y se descartó — no volver a agregarlo.

const TRUST_POINTS = [
  { icon: ShieldCheck, label: 'Acceso exclusivo para personal autorizado' },
  { icon: Lock, label: 'Sesión cifrada de extremo a extremo' },
  { icon: RadioTower, label: 'Actividad monitoreada y auditada' },
];

export default function LoginPage() {
  return (
    <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,13fr)_minmax(380px,7fr)]">
      <div className="relative z-10 order-2 flex flex-col justify-center overflow-hidden bg-brand-ink-900 px-8 py-16 text-white sm:px-16 lg:order-1">
        {/* Marca de agua: nuestro logo real (no un ícono genérico), muy
            difuminado — mask-image en radial-gradient lo desvanece hacia
            los bordes para que lea como textura de fondo, no como un logo
            sobrepuesto. */}
        <img
          src="/logo-gamc.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 bottom-[-140px] h-[560px] w-[560px] object-contain opacity-[0.14] blur-[1px] [mask-image:radial-gradient(circle_at_center,black_35%,transparent_75%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 h-[380px] w-[380px] rounded-full bg-brand-gold-500/[0.08] blur-3xl"
        />

        <div className="relative">
          <div className="relative mb-8 flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-brand-gold-500/40 bg-white/[0.04] p-3">
            <div className="pointer-events-none absolute inset-[3px] rounded-[13px] border border-brand-gold-500/25" aria-hidden="true" />
            <Logo size={52} />
          </div>

          <p className="mb-2 text-[13px] font-semibold tracking-[0.14em] text-brand-gold-500">
            GOBIERNO AUTÓNOMO MUNICIPAL DE COCHABAMBA
          </p>
          <h1 className="mb-4 max-w-md text-[34px] font-bold leading-[1.15] tracking-tight">
            Plataforma de Seguridad Ciudadana
          </h1>

          <div className="max-w-md">
            {/* Divisor heráldico: filete—rombo—filete, en vez de una simple línea (ux: color-not-only n/a — decorativo) */}
            <div aria-hidden="true" className="mb-7 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="h-1.5 w-1.5 rotate-45 bg-brand-gold-500/70" />
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="space-y-4">
              {TRUST_POINTS.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-gold-500/35 text-brand-gold-500">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="text-[13px] text-white/70">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Panel del formulario — "flota" sobre el panel institucional en la costura:
          esquinas redondeadas + solape con margen negativo + halo dorado. En móvil
          la costura es el borde inferior (rounded-b, sombra/halo hacia abajo); en
          desktop es el borde izquierdo (rounded-l, sombra/halo hacia la izquierda). */}
      <div className="relative z-20 order-1 -mb-7 flex items-center justify-center rounded-b-[32px] bg-neutral-bg px-6 py-14 shadow-[0_18px_40px_-15px_rgba(0,0,0,0.35)] lg:order-2 lg:mb-0 lg:-ml-12 lg:rounded-b-none lg:rounded-l-[40px] lg:py-16 lg:shadow-[-24px_0_50px_-20px_rgba(0,0,0,0.4)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 translate-y-1/2 rounded-full bg-brand-gold-500/[0.12] blur-3xl lg:inset-x-auto lg:bottom-auto lg:left-0 lg:top-1/2 lg:h-40 lg:w-20 lg:-translate-x-1/2 lg:translate-y-[-50%]"
        />
        <LoginForm />
      </div>
    </div>
  );
}
