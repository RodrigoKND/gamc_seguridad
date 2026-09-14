import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Estado "empty" obligatorio (MASTER.md sección 8): texto municipal + acción
// sugerida. Se reutiliza en todos los módulos — no reimplementar por feature.

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-border p-8 text-center',
        className,
      ].join(' ')}
    >
      <Icon className="h-8 w-8 text-neutral-text-muted" aria-hidden="true" />
      <p className="text-sm font-medium text-neutral-text">{title}</p>
      {description && <p className="max-w-sm text-sm text-neutral-text-muted">{description}</p>}
      {action && (
        <Button variant="secondary" onClick={action.onClick} className="mt-1">
          {action.label}
        </Button>
      )}
    </div>
  );
}
