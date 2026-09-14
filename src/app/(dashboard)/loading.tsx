import { Skeleton } from '@/components/feedback/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="p-6 animate-pulse">
      <div className="mb-6 h-8 w-48 rounded bg-neutral-border/50" />
      <div className="grid grid-cols-12 gap-4">
        <Skeleton className="col-span-12 h-28 lg:col-span-3" />
        <Skeleton className="col-span-12 h-28 lg:col-span-3" />
        <Skeleton className="col-span-12 h-28 lg:col-span-3" />
        <Skeleton className="col-span-12 h-28 lg:col-span-3" />
        <Skeleton className="col-span-12 h-64" />
      </div>
    </div>
  );
}
