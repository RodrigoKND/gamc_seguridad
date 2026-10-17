'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useDialog } from '@/components/ui/AlertDialog';
import { PATRULLA_MODALIDAD_CAPACIDAD, PATRULLA_MODALIDAD_LABELS, PATRULLA_MODALIDADES, type PatrullaModalidad, type RutaPlantillaRow } from '@/types/patrulla';
import type { Jurisdiccion } from '../../lib/jurisdiccion';
import { useTrazadoRuta } from '../../hooks/useTrazadoRuta';
import { createDefaultRouteAction } from '../../actions/rutasBiblioteca';
import { TrazadoEditor } from './TrazadoEditor';

// Menú "Rutas" → "Crear Ruta" (antes "Rutas Predeterminadas"): crea rutas
// oficiales (estáticas) SIN asignarlas a nadie. Luego aparecen primero en
// "Rutas Guardadas", en "Asignar Ruta → Usar Ruta Guardada" y en
// "Programar Rutas". Las pueden crear los 3 roles (en BD: 'establecida').
// Sin duración ni cantidad de guardias (F5): el horario y el cupo se fijan
// al programarla; el máximo de guardias es el de su modalidad.

export interface RutasPredeterminadasModalProps {
  isOpen: boolean;
  onClose: () => void;
  jurisdiccion: Jurisdiccion | null;
  /** Se llama tras guardar (recargar la biblioteca). */
  onCreada: () => void;
  /** Si viene, al guardar se ofrece "Asignar ahora". */
  onAsignarAhora?: (ruta: RutaPlantillaRow) => void;
}

export function RutasPredeterminadasModal({ isOpen, onClose, jurisdiccion, onCreada, onAsignarAhora }: RutasPredeterminadasModalProps) {
  const dialogo = useDialog();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [modalidad, setModalidad] = useState<PatrullaModalidad>('a_pie');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const trazado = useTrazadoRuta(modalidad, jurisdiccion, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    setNombre('');
    setDescripcion('');
    setModalidad('a_pie');
    setError(null);
    trazado.reiniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir.
  }, [isOpen]);

  const puedeGuardar = Boolean(nombre.trim()) && trazado.listo;

  async function guardar() {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    const r = await createDefaultRouteAction({
      nombre,
      descripcion,
      modalidad,
      puntos: trazado.path,
    });
    setGuardando(false);
    if (!r.success || !r.ruta) {
      await dialogo.avisar({ tono: 'peligro', titulo: 'No se pudo guardar la ruta', mensaje: r.error ?? 'Intenta nuevamente.' });
      return;
    }
    onCreada();
    const ruta = r.ruta;
    if (onAsignarAhora) {
      const asignar = await dialogo.confirmar({
        tono: 'exito',
        titulo: 'Ruta guardada',
        mensaje: `«${ruta.nombre}» ya está en «Rutas Guardadas» y se puede programar. ¿Quieres asignarla ahora?`,
        textoConfirmar: 'Asignar ahora',
        textoCancelar: 'Más tarde',
      });
      onClose();
      if (asignar) onAsignarAhora(ruta);
    } else {
      await dialogo.avisar({ tono: 'exito', titulo: 'Ruta guardada', mensaje: `«${ruta.nombre}» ya está en «Rutas Guardadas» y se puede programar.` });
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Ruta" widthClassName="max-w-[760px]" accent="gold">
      <div className="p-5">
        <p className="mb-3 text-[12px] text-neutral-text-muted">
          Ruta oficial y reutilizable. Los horarios y cuántos guardias van se definen en «Programar Rutas»; asignada al momento, dura hasta que la
          canceles o sus guardias cierren turno.
        </p>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Circuito Plaza Principal" required disabled={guardando} accent="gold" />
          <Input label="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} disabled={guardando} accent="gold" />
        </div>
        <div className="mb-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
          <Select label="Modalidad" value={modalidad} onChange={(e) => setModalidad(e.target.value as PatrullaModalidad)} disabled={guardando} accent="gold">
            {PATRULLA_MODALIDADES.map((m) => (
              <option key={m} value={m}>
                {PATRULLA_MODALIDAD_LABELS[m]}
              </option>
            ))}
          </Select>
          <p className="pb-2 text-[12px] text-neutral-text-muted">Hasta {PATRULLA_MODALIDAD_CAPACIDAD[modalidad]} guardia(s) por asignación.</p>
        </div>

        <TrazadoEditor trazado={trazado} jurisdiccion={jurisdiccion} onError={setError} altoClassName="h-[300px]" />
        {error && (
          <p role="alert" className="mt-2 text-[11.5px] text-risk-critical">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={guardando} className="flex-1">
            Cancelar
          </Button>
          <Button type="button" variant="brand" onClick={guardar} isLoading={guardando} disabled={!puedeGuardar} className="flex-1">
            Guardar ruta
          </Button>
        </div>
      </div>
    </Modal>
  );
}
