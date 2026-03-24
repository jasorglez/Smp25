import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  collectionData,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  increment,
  Timestamp,
  getDocs,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Prospecto {
  id?: string;
  nombre: string;
  telefono: string;
  empresa: string;
  estado: string;
  idVendedorActual: number;
  nombreVendedorActual: string;
  chatIdVendedorActual: string;
  idCompany: number | null;
  creadoPor: string;
  idVendedorCreador: number;
  fechaCreacion: Timestamp;
  fechaUltimaInteraccion: Timestamp;
  notas: string;
  puesto: string;
  idCustomer: string | null;
  activo: boolean;
  __isNew?: boolean;
  __modified?: boolean;
}

export interface Interaccion {
  id?: string;
  tipo: string;
  descripcion: string;
  fecha: Timestamp;
  idVendedor: number;
  nombreVendedor: string;
  resultado: string;
  creadoPor: string;
}

export const ESTADOS_PROSPECTO = [
  { value: 'nuevo',             label: 'Nuevo',             icon: '🆕', color: 'secondary' },
  { value: 'contactado',        label: 'Contactado',        icon: '📞', color: 'info'      },
  { value: 'interesado',        label: 'Interesado',        icon: '⭐', color: 'primary'   },
  { value: 'propuesta_enviada', label: 'Propuesta Enviada', icon: '📄', color: 'warning'   },
  { value: 'ganado',            label: 'Ganado',            icon: '🏆', color: 'success'   },
  { value: 'perdido',           label: 'Perdido',           icon: '❌', color: 'danger'    },
];

@Injectable({ providedIn: 'root' })
export class ProspectosService {
  private firestore = inject(Firestore);
  private readonly COL = 'prospectos';

  // Consulta simple: solo por vendedor, sin índice compuesto
  getProspectos(idVendedor: number): Observable<Prospecto[]> {
    const ref = collection(this.firestore, this.COL);
    const q = query(ref, where('idVendedorActual', '==', idVendedor));
    return collectionData(q, { idField: 'id' }) as Observable<Prospecto[]>;
  }

  async crearProspecto(p: Partial<Prospecto>): Promise<string> {
    const ref = collection(this.firestore, this.COL);
    const now = Timestamp.now();
    const docRef = await addDoc(ref, {
      nombre:               p.nombre ?? '',
      telefono:             p.telefono ?? '',
      empresa:              p.empresa ?? '',
      estado:               'nuevo',
      activo:               true,
      creadoPor:            'web',
      idVendedorActual:     p.idVendedorActual ?? 0,
      nombreVendedorActual: p.nombreVendedorActual ?? '',
      chatIdVendedorActual: '',
      idCompany:            p.idCompany ?? null,
      idVendedorCreador:    p.idVendedorActual ?? 0,
      notas:                  '',
      puesto:                 p.puesto ?? '',
      idCustomer:             null,
      countInteracciones:     0,
      fechaCreacion:          now,
      fechaUltimaInteraccion: now,
    });
    return docRef.id;
  }

  async actualizarProspecto(id: string, campos: Partial<Prospecto>): Promise<void> {
    const { __isNew, __modified, ...data } = campos as any;
    const docRef = doc(this.firestore, this.COL, id);
    await updateDoc(docRef, { ...data, fechaUltimaInteraccion: Timestamp.now() });
  }

  async cambiarEstado(id: string, nuevoEstado: string, idVendedor: number, nombreVendedor: string): Promise<void> {
    const docRef = doc(this.firestore, this.COL, id);
    const now = Timestamp.now();
    await updateDoc(docRef, {
      estado: nuevoEstado,
      fechaUltimaInteraccion: now,
      countInteracciones: increment(1),
    });
    await addDoc(collection(this.firestore, `${this.COL}/${id}/interacciones`), {
      tipo: 'cambio_estado', descripcion: `Estado cambiado a: ${nuevoEstado}`,
      fecha: now, idVendedor, nombreVendedor, resultado: 'neutral', creadoPor: 'web',
    });
  }

  async registrarInteraccion(prospectoId: string, i: Omit<Interaccion, 'id' | 'fecha' | 'creadoPor'>): Promise<void> {
    const now = Timestamp.now();
    await addDoc(collection(this.firestore, `${this.COL}/${prospectoId}/interacciones`), {
      ...i, fecha: now, creadoPor: 'web',
    });
    await updateDoc(doc(this.firestore, this.COL, prospectoId), {
      fechaUltimaInteraccion: now,
      countInteracciones: increment(1),
    });
  }

  async getInteracciones(prospectoId: string): Promise<Interaccion[]> {
    const q = query(
      collection(this.firestore, `${this.COL}/${prospectoId}/interacciones`),
      orderBy('fecha', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Interaccion);
  }
}
