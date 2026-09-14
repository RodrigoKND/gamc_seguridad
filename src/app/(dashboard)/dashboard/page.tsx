import { DashboardClient } from '@/features/dashboard/components/DashboardClient';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  return <DashboardClient denied={denied} />;
}
