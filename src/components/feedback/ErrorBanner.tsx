import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Estado "error" obligatorio (MASTER.md sección 8): banner rojo suave +
// botón "Reintentar" — no bloquea toda la pantalla si el error es parcial.
// Se reutiliza en todos los módulos — no reimplementar por feature.

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}

export function ErrorBanner({ message, onRetry, isRetrying = false, className = '' }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={[
        'flex items-center gap-3 rounded-lg border border-risk-critical/20 bg-risk-critical/10 px-4 py-3',
        className,
      ].join(' ')}
    >
      <AlertCircle className="h-5 w-5 shrink-0 text-risk-critical" aria-hidden="true" />
      <p className="flex-1 text-sm text-risk-critical">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} isLoading={isRetrying} className="shrink-0">
          Reintentar
        </Button>
      )}
    </div>
  );
}
