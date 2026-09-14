// Layout de la ruta (auth) — sin Sidebar/Topbar (MASTER.md sección 6).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-neutral-bg">{children}</div>;
}
