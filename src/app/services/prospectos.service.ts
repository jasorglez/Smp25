import { inject, Injectable, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  collectionData,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  increment,
  Timestamp,
  getDocs,
  getDoc,
  setDoc,
} from '@angular/fire/firestore';
import { Observable, from, of, switchMap } from 'rxjs';
import { SignalsService } from './signals.service';

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
  correo?: string;
  idCustomer: string | null;
  activo: boolean;
  countInteracciones?: number;
  // ── Campos CRM extendidos ───────────────────────────────────────────────
  giro?: string;
  fuente?: string;
  tags?: string[];             // Etiquetas libres: 'vip', 'retomar-q4', 'precio-sensible', etc.
  competidor?: string;
  cp?: string;
  estadoRepublica?: string;
  municipio?: string;
  fechaProximoSeguimiento?: Timestamp | null;
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
  { value: 'prospecto',          label: 'Prospecto',          icon: '👤', color: 'secondary', orden: 0 },
  { value: 'contactado',         label: 'Contactado',         icon: '📞', color: 'info',      orden: 1 },
  { value: 'demo_agendada',      label: 'Demo Agendada',      icon: '📅', color: 'primary',   orden: 2 },
  { value: 'demo_realizada',     label: 'Demo Realizada',     icon: '👀', color: 'purple',    orden: 3 },
  { value: 'cotizacion_enviada', label: 'Cotización Enviada', icon: '📄', color: 'warning',   orden: 4 },
  { value: 'negociacion',        label: 'Negociación',        icon: '🤝', color: 'orange',    orden: 5 },
  { value: 'ganado',             label: 'Ganado',             icon: '🏆', color: 'success',   orden: 6 },
  { value: 'perdido',            label: 'Perdido',            icon: '❌', color: 'danger',    orden: 7 },
];

export const GIROS_PROSPECTO = [
  'Restaurante', 'Clínica', 'Escuela', 'Construcción',
  'Comercio', 'Servicios', 'Manufactura', 'Gobierno', 'Otro',
];

export const FUENTES_PROSPECTO = [
  'Referido', 'WhatsApp', 'Web', 'Expo/Evento',
  'Llamada fría', 'Redes sociales', 'LinkedIn',
  'Email', 'Vendedor directo', 'Otro',
];

export interface Tarea {
  id?: string;
  idProspecto: string;
  nombreProspecto: string;
  empresaProspecto: string;
  tipo: string;
  descripcion: string;
  fechaVencimiento: Timestamp;
  completada: boolean;
  idVendedor: number;
  nombreVendedor: string;
  idCompany: number;
  fechaCreacion: Timestamp;
  fechaCompletada?: Timestamp | null;
}

export const TIPOS_TAREA = ['llamada', 'reunión', 'email', 'seguimiento', 'visita', 'demo', 'cotizar', 'otro'];

// Tipos de interacción por defecto — se siembran en Firestore por empresa la
// primera vez y luego el usuario puede agregar más desde el combo.
export const TIPOS_INTERACCION_DEFAULT = ['contacto', 'llamada', 'reunión', 'email', 'whatsapp', 'visita'];

// ── Score CRM ─────────────────────────────────────────────────────────────────
export function calcularScore(p: Prospecto): number {
  if (!p || p.activo === false) return 0;
  let score = 0;

  const scoreEstado: Record<string, number> = {
    prospecto: 5, contactado: 15, demo_agendada: 25,
    demo_realizada: 35, cotizacion_enviada: 45, negociacion: 55,
    ganado: 60, perdido: 0,
  };
  score += scoreEstado[p.estado] ?? 5;

  score += Math.min(20, (p.countInteracciones ?? 0) * 2);

  const toMs = (ts: any): number => {
    if (!ts) return 0;
    if (ts.toDate) return ts.toDate().getTime();
    if (ts.seconds) return ts.seconds * 1000;
    return new Date(ts).getTime();
  };
  const dias = p.fechaUltimaInteraccion
    ? Math.floor((Date.now() - toMs(p.fechaUltimaInteraccion)) / 86_400_000)
    : 999;
  if      (dias > 30) score -= 20;
  else if (dias > 14) score -= 10;
  else if (dias > 7)  score -= 5;

  if (p.fechaProximoSeguimiento)              score += 5;
  if (p.giro && p.giro !== '')               score += 5;
  if (p.competidor && p.competidor !== '')   score += 5;
  if (p.telefono && p.telefono !== 'SIN NUMERO') score += 5;

  return Math.max(0, Math.min(100, score));
}

export function nivelScore(score: number): { label: string; color: string; icon: string } {
  if (score >= 70) return { label: 'Hot',  color: 'danger',  icon: '🔥' };
  if (score >= 40) return { label: 'Warm', color: 'warning', icon: '👍' };
  return                   { label: 'Cold', color: 'info',    icon: '❄️' };
}

@Injectable({ providedIn: 'root' })
export class ProspectosService {
  private firestore  = inject(Firestore);
  private signalsSvc = inject(SignalsService);
  private injector   = inject(Injector);
  private readonly COL = 'prospectos';
  private readonly TAREAS_COL = 'tareas-crm';

  // Consulta simple: primero por vendedor; si no hay resultados, cae a la empresa
  getProspectos(idVendedor: number): Observable<Prospecto[]> {
    const ref = collection(this.firestore, this.COL);
    const currentRoot = this.signalsSvc.getRootSelectedBySidebar()();
    const byVendor$ = runInInjectionContext(this.injector, () =>
      collectionData(query(ref, where('idVendedorActual', '==', idVendedor)), { idField: 'id' }) as Observable<Prospecto[]>
    );

    const byCompany$ = currentRoot
      ? runInInjectionContext(this.injector, () =>
          collectionData(query(ref, where('idCompany', '==', currentRoot)), { idField: 'id' }) as Observable<Prospecto[]>
        )
      : of([]);

    return byVendor$.pipe(
      switchMap((prospectos) => prospectos.length > 0 ? of(prospectos) : byCompany$),
      switchMap((prospectos) => from(this.syncProspectosWithInteracciones(prospectos))),
    );
  }

  // Consulta por empresa para Kanban y Dashboard
  getProspectosByCompany(idCompany: number): Observable<Prospecto[]> {
    const ref = collection(this.firestore, this.COL);
    return runInInjectionContext(this.injector, () =>
      collectionData(query(ref, where('idCompany', '==', idCompany), where('activo', '==', true)), { idField: 'id' }) as Observable<Prospecto[]>
    );
  }

  async crearProspecto(p: Partial<Prospecto>): Promise<string> {
    const ref = collection(this.firestore, this.COL);
    const now = Timestamp.now();
    const docRef = await addDoc(ref, {
      nombre:                 p.nombre ?? '',
      telefono:               p.telefono ?? '',
      empresa:                p.empresa ?? '',
      domicilio:              p.domicilio ?? '',
      estado:                 'prospecto',
      activo:                 true,
      creadoPor:              'web',
      idVendedorActual:       p.idVendedorActual ?? 0,
      nombreVendedorActual:   p.nombreVendedorActual ?? '',
      chatIdVendedorActual:   '',
      idCompany:              p.idCompany ?? null,
      idVendedorCreador:      p.idVendedorActual ?? 0,
      notas:                  '',
      puesto:                 p.puesto ?? '',
      correo:                 p.correo ?? '',
      idCustomer:             null,
      countInteracciones:     0,
      giro:                   p.giro ?? '',
      fuente:                 p.fuente ?? '',
      tags:                   p.tags ?? [],
      competidor:             p.competidor ?? '',
      fechaProximoSeguimiento: p.fechaProximoSeguimiento ?? null,
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
    const snap = await runInInjectionContext(this.injector, () =>
      getDocs(collection(this.firestore, `${this.COL}/${prospectoId}/interacciones`))
    );
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }) as Interaccion)
      .sort((a, b) => {
        const aTime = ((a.fecha as any)?.seconds || (a.fecha as any)?.toDate?.().getTime?.() / 1000) ?? 0;
        const bTime = ((b.fecha as any)?.seconds || (b.fecha as any)?.toDate?.().getTime?.() / 1000) ?? 0;
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

  // ── Plantillas WhatsApp por empresa ──────────────────────────────────────

  async getPlantillas(idCompany: number): Promise<Record<string, string> | null> {
    const snap = await runInInjectionContext(this.injector, () =>
      getDoc(doc(this.firestore, 'whatsapp-plantillas', String(idCompany)))
    );
    return snap.exists() ? (snap.data() as Record<string, string>) : null;
  }

  async savePlantillas(idCompany: number, plantillas: Record<string, string>): Promise<void> {
    await setDoc(doc(this.firestore, 'whatsapp-plantillas', String(idCompany)), plantillas);
  }

  // ── Catálogo de tipos de interacción por empresa (editable) ──────────────
  // Doc: tipos-interaccion-crm/{idCompany} -> { tipos: string[] }
  // Si no existe, se siembra con TIPOS_INTERACCION_DEFAULT.

  async getTiposInteraccion(idCompany: number): Promise<string[]> {
    const snap = await runInInjectionContext(this.injector, () =>
      getDoc(doc(this.firestore, 'tipos-interaccion-crm', String(idCompany)))
    );
    const tipos = snap.exists() ? ((snap.data() as any)?.tipos as string[]) : null;
    return Array.isArray(tipos) && tipos.length ? tipos : [...TIPOS_INTERACCION_DEFAULT];
  }

  async saveTiposInteraccion(idCompany: number, tipos: string[]): Promise<void> {
    // Normaliza: recorta, quita vacíos y duplicados (case-insensitive), conserva orden.
    const seen = new Set<string>();
    const limpio = (tipos ?? [])
      .map(t => (t ?? '').trim())
      .filter(t => {
        if (!t) return false;
        const k = t.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    await setDoc(doc(this.firestore, 'tipos-interaccion-crm', String(idCompany)), { tipos: limpio });
  }

  async addTipoInteraccion(idCompany: number, tipo: string): Promise<string[]> {
    const actuales = await this.getTiposInteraccion(idCompany);
    const nuevo = (tipo ?? '').trim();
    if (nuevo && !actuales.some(t => t.toLowerCase() === nuevo.toLowerCase())) {
      actuales.push(nuevo);
      await this.saveTiposInteraccion(idCompany, actuales);
    }
    return actuales;
  }

  // ── Tareas CRM ────────────────────────────────────────────────────────────

  async crearTarea(data: Omit<Tarea, 'id' | 'fechaCreacion' | 'completada' | 'fechaCompletada'>): Promise<string> {
    const ref = await addDoc(collection(this.firestore, this.TAREAS_COL), {
      ...data,
      completada: false,
      fechaCreacion: Timestamp.now(),
      fechaCompletada: null,
    });
    return ref.id;
  }

  async getTareasByProspecto(idProspecto: string): Promise<Tarea[]> {
    const snap = await runInInjectionContext(this.injector, () =>
      getDocs(query(collection(this.firestore, this.TAREAS_COL), where('idProspecto', '==', idProspecto), where('completada', '==', false)))
    );
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }) as Tarea)
      .sort((a, b) => this.getTimestampMillis(a.fechaVencimiento) - this.getTimestampMillis(b.fechaVencimiento));
  }

  async getTareasCompletadasByProspecto(idProspecto: string): Promise<Tarea[]> {
    const snap = await runInInjectionContext(this.injector, () =>
      getDocs(query(collection(this.firestore, this.TAREAS_COL), where('idProspecto', '==', idProspecto), where('completada', '==', true)))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Tarea);
  }

  async getTareasByVendedor(idVendedor: number, idCompany: number): Promise<Tarea[]> {
    const snap = await runInInjectionContext(this.injector, () =>
      getDocs(query(collection(this.firestore, this.TAREAS_COL), where('idVendedor', '==', idVendedor), where('completada', '==', false)))
    );
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }) as Tarea)
      .filter(t => t.idCompany === idCompany)
      .sort((a, b) => this.getTimestampMillis(a.fechaVencimiento) - this.getTimestampMillis(b.fechaVencimiento));
  }

  async completarTarea(tareaId: string): Promise<void> {
    await updateDoc(doc(this.firestore, this.TAREAS_COL, tareaId), {
      completada: true,
      fechaCompletada: Timestamp.now(),
    });
  }

  async eliminarTarea(tareaId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, this.TAREAS_COL, tareaId));
  }

  // ── Tags ─────────────────────────────────────────────────────────────────

  async addTag(prospectoId: string, tag: string): Promise<void> {
    await updateDoc(doc(this.firestore, this.COL, prospectoId), { tags: arrayUnion(tag) });
  }

  async removeTag(prospectoId: string, tag: string): Promise<void> {
    await updateDoc(doc(this.firestore, this.COL, prospectoId), { tags: arrayRemove(tag) });
  }

  // ── Cuotas de Ventas ──────────────────────────────────────────────────────

  async getCuotasMes(idCompany: number, mes: string): Promise<Record<string, number>> {
    const snap = await runInInjectionContext(this.injector, () =>
      getDoc(doc(this.firestore, 'cuotas-crm', `${idCompany}_${mes}`))
    );
    return snap.exists() ? (snap.data() as Record<string, number>) : {};
  }

  async saveCuotasMes(idCompany: number, mes: string, cuotas: Record<string, number>): Promise<void> {
    await setDoc(doc(this.firestore, 'cuotas-crm', `${idCompany}_${mes}`), cuotas);
  }
}
