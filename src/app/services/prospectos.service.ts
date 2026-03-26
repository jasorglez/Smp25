import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  collectionData,
  query,
  where,
  doc,
  updateDoc,
  increment,
  Timestamp,
  getDocs,
} from '@angular/fire/firestore';
import { Observable, from, switchMap } from 'rxjs';

export interface Prospecto {
  id?: string;
  nombre: string;
  telefono: string;
  empresa: string;
  domicilio: string;
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
  countInteracciones?: number;
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

export interface NuevaInteraccionPayload extends Omit<Interaccion, 'id' | 'fecha' | 'creadoPor'> {
  fecha?: Date | string | null;
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
    return (collectionData(q, { idField: 'id' }) as Observable<Prospecto[]>).pipe(
      switchMap((prospectos) => from(this.syncProspectosWithInteracciones(prospectos))),
    );
  }

  async crearProspecto(p: Partial<Prospecto>): Promise<string> {
    const ref = collection(this.firestore, this.COL);
    const now = Timestamp.now();
    const docRef = await addDoc(ref, {
      nombre:               p.nombre ?? '',
      telefono:             p.telefono ?? '',
      empresa:              p.empresa ?? '',
      domicilio:            p.domicilio ?? '',
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

  async registrarInteraccion(prospectoId: string, i: NuevaInteraccionPayload): Promise<{ saved: boolean; synced: boolean }> {
    const fechaInteraccion = i.fecha ? Timestamp.fromDate(new Date(i.fecha)) : Timestamp.now();
    const { fecha, ...data } = i;

    await addDoc(collection(this.firestore, `${this.COL}/${prospectoId}/interacciones`), {
      ...data, fecha: fechaInteraccion, creadoPor: 'web',
    });

    try {
      await updateDoc(doc(this.firestore, this.COL, prospectoId), {
        fechaUltimaInteraccion: fechaInteraccion,
        countInteracciones: increment(1),
      });
      return { saved: true, synced: true };
    } catch (error) {
      console.warn('Interaccion guardada, pero no se pudo sincronizar el prospecto padre.', error);
      return { saved: true, synced: false };
    }
  }

  async actualizarInteraccion(prospectoId: string, interaccionId: string, campos: Partial<Interaccion> & { fecha?: Date | string | null }): Promise<void> {
    const docRef = doc(this.firestore, `${this.COL}/${prospectoId}/interacciones`, interaccionId);
    const data: any = { ...campos };

    if (data.fecha) {
      data.fecha = Timestamp.fromDate(new Date(data.fecha));
    }

    await updateDoc(docRef, data);
  }

  async getInteracciones(prospectoId: string): Promise<Interaccion[]> {
    const snap = await getDocs(collection(this.firestore, `${this.COL}/${prospectoId}/interacciones`));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }) as Interaccion)
      .sort((a, b) => {
        const aTime = (a.fecha as any)?.seconds ?? (a.fecha as any)?.toDate?.().getTime() / 1000 ?? 0;
        const bTime = (b.fecha as any)?.seconds ?? (b.fecha as any)?.toDate?.().getTime() / 1000 ?? 0;
        return bTime - aTime;
      });
  }

  private async syncProspectosWithInteracciones(prospectos: Prospecto[]): Promise<Prospecto[]> {
    return Promise.all(
      prospectos.map(async (prospecto) => {
        if (!prospecto.id) {
          return {
            ...prospecto,
            countInteracciones: (prospecto as any).countInteracciones ?? 0,
          } as Prospecto;
        }

        const interacciones = await this.getInteracciones(prospecto.id);
        const countInteracciones = interacciones.length;
        const fechaUltimaInteraccion = interacciones[0]?.fecha ?? prospecto.fechaUltimaInteraccion;

        await this.syncProspectoStatsIfNeeded(prospecto.id, prospecto, countInteracciones, fechaUltimaInteraccion);

        return {
          ...prospecto,
          countInteracciones,
          fechaUltimaInteraccion,
        } as Prospecto;
      }),
    );
  }

  private async syncProspectoStatsIfNeeded(
    prospectoId: string,
    prospecto: Prospecto,
    countInteracciones: number,
    fechaUltimaInteraccion: Timestamp,
  ): Promise<void> {
    const currentCount = prospecto.countInteracciones ?? 0;
    const currentFecha = this.getTimestampMillis(prospecto.fechaUltimaInteraccion);
    const realFecha = this.getTimestampMillis(fechaUltimaInteraccion);

    if (currentCount === countInteracciones && currentFecha === realFecha) {
      return;
    }

    await updateDoc(doc(this.firestore, this.COL, prospectoId), {
      countInteracciones,
      fechaUltimaInteraccion,
    });
  }

  private getTimestampMillis(value: any): number {
    if (!value) return 0;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    return new Date(value).getTime();
  }
}
