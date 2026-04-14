import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  updateDoc,
  Timestamp,
  query,
  orderBy,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Demo {
  id?: string;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  rol: string;
  estado: string;
  fechaCreacion: Timestamp;
  fechaUltimaActualizacion?: Timestamp;
}

export const ESTADOS_DEMO: { value: string; label: string; icon: string; color: string }[] = [
  { value: 'pendiente',  label: 'Pendiente',  icon: '🆕', color: 'secondary' },
  { value: 'contactado', label: 'Contactado', icon: '📞', color: 'info'      },
  { value: 'agendado',   label: 'Agendado',   icon: '📅', color: 'primary'   },
  { value: 'aprobado',   label: 'Aprobado',   icon: '✅', color: 'success'   },
];

@Injectable({ providedIn: 'root' })
export class DemosService {
  private firestore = inject(Firestore);

  getAll(): Observable<Demo[]> {
    const col = collection(this.firestore, 'demos');
    const q   = query(col, orderBy('fechaCreacion', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Demo[]>;
  }

  async cambiarEstado(demoId: string, nuevoEstado: string): Promise<void> {
    const ref = doc(this.firestore, 'demos', demoId);
    await updateDoc(ref, {
      estado: nuevoEstado,
      fechaUltimaActualizacion: Timestamp.now(),
    });
  }
}
