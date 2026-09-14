import { Badge } from '@/components/ui/Badge';
import {
  ACCOUNT_STATUS_BADGE_CLASS,
  ACCOUNT_STATUS_LABELS,
  OPERATIONAL_STATUS_BADGE_CLASS,
  OPERATIONAL_STATUS_LABELS,
  type AccountStatus,
  type OperationalStatus,
} from '../types';

// MASTER.md sección 13.1: los dos badges SIEMPRE se muestran por separado
// (cuenta vs. operativo) — se reutiliza en GuardTable, GuardCatalogModal y
// el drawer de telemetría del Módulo de Mapas (MASTER.md sección 6: 2+
// módulos -> promovido, no duplicado por feature esta vez a nivel de
// components/ui sería excesivo porque el shape depende del tipo Guard de
// este feature; se exporta desde aquí para que mapas lo importe).

export interface GuardStatusBadgesProps {
  accountStatus: AccountStatus;
  operationalStatus: OperationalStatus;
  className?: string;
}

export function GuardStatusBadges({ accountStatus, operationalStatus, className = '' }: GuardStatusBadgesProps) {
  // 'activo' no aporta información que el badge operativo (en
  // servicio/fuera de servicio/emergencia) ya no muestre — se omite para no
  // duplicar la señal. 'pendiente_activacion' e 'inactivo' sí son estados
  // exclusivos de la cuenta (no tienen equivalente operativo), así que esos
  // dos siempre se muestran.
  return (
    <div className={['flex flex-wrap items-center gap-1.5', className].join(' ')}>
      {accountStatus !== 'activo' && (
        <Badge className={ACCOUNT_STATUS_BADGE_CLASS[accountStatus]}>{ACCOUNT_STATUS_LABELS[accountStatus]}</Badge>
      )}
      <Badge className={OPERATIONAL_STATUS_BADGE_CLASS[operationalStatus]}>
        {OPERATIONAL_STATUS_LABELS[operationalStatus]}
      </Badge>
    </div>
  );
}
