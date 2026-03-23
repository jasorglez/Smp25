import { inject, Injectable } from '@angular/core';
import {
  Firestore, collection, addDoc, collectionData, query,
  where, doc, updateDoc, Timestamp, getDocs, getDoc,
  orderBy, increment,
} from '@angular/fire/firestore';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface Curso {
  id?: string;
  nombre: string;
  slug: string;
  descripcion: string;
  fechaInicio: Timestamp;
  fechaFin: Timestamp;
  horario: string;
  diasDuracion: number;
  esGratuito: boolean;
  precio: number;
  moneda: string;
  cupoMax: number;
  cupoUsado: number;
  activo: boolean;
  idCompany: number;
  instructor: string;
  telegramChatId: string;
  logoUrl: string;
  logo2Url: string;
  reunionUrl: string;
}

export interface RegistroCurso {
  id?: string;
  cursoId: string;
  nombre: string;
  correo: string;
  telefono: string;
  comoSeEnteroOpcion: string;
  comoSeEnteroTexto: string;
  experienciaOpcion: string;
  experienciaTexto: string;
  fechaRegistro: Timestamp;
  pagado: boolean;
  confirmacionEnviada: boolean;
  idCompany: number;
}

export const COMO_SE_ENTERO_OPCIONES = [
  'Facebook', 'Instagram', 'WhatsApp', 'Telegram', 'Recomendación', 'Otro',
];
export const EXPERIENCIA_OPCIONES = [
  'Ninguna', 'Básica', 'Intermedia', 'Avanzada', 'Otro',
];

@Injectable({ providedIn: 'root' })
export class CursosService {
  private firestore = inject(Firestore);
  private http      = inject(HttpClient);
  private readonly COL = 'cursos';

  // ── Cursos ────────────────────────────────────────────────────────────────

  getCursos(idCompany: number): Observable<Curso[]> {
    const ref = collection(this.firestore, this.COL);
    const q   = query(ref, where('idCompany', '==', idCompany));
    return collectionData(q, { idField: 'id' }) as Observable<Curso[]>;
  }

  async getCursoBySlug(slug: string): Promise<Curso | null> {
    const ref  = collection(this.firestore, this.COL);
    const q    = query(ref, where('slug', '==', slug), where('activo', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as Curso;
  }

  async crearCurso(c: Partial<Curso>): Promise<string> {
    const ref    = collection(this.firestore, this.COL);
    const docRef = await addDoc(ref, {
      nombre:        c.nombre        ?? '',
      slug:          c.slug          ?? '',
      descripcion:   c.descripcion   ?? '',
      fechaInicio:   c.fechaInicio   ?? Timestamp.now(),
      fechaFin:      c.fechaFin      ?? Timestamp.now(),
      horario:       c.horario       ?? '',
      diasDuracion:  c.diasDuracion  ?? 1,
      esGratuito:    c.esGratuito    ?? true,
      precio:        c.precio        ?? 0,
      moneda:        c.moneda        ?? 'MXN',
      cupoMax:       c.cupoMax       ?? 30,
      cupoUsado:     0,
      activo:        c.activo        ?? true,
      idCompany:     c.idCompany     ?? 0,
      instructor:    c.instructor    ?? '',
      telegramChatId: c.telegramChatId ?? '',
      logoUrl:       c.logoUrl       ?? '',
      logo2Url:      c.logo2Url      ?? '',
      reunionUrl:    c.reunionUrl    ?? '',
    });
    return docRef.id;
  }

  async actualizarCurso(id: string, campos: Partial<Curso>): Promise<void> {
    const { id: _, ...data } = campos as any;
    await updateDoc(doc(this.firestore, this.COL, id), data);
  }

  async expandirCupo(id: string, nuevoMax: number): Promise<void> {
    await updateDoc(doc(this.firestore, this.COL, id), { cupoMax: nuevoMax });
  }

  // ── Registros ─────────────────────────────────────────────────────────────

  getRegistros(cursoId: string): Observable<RegistroCurso[]> {
    const ref = collection(this.firestore, `${this.COL}/${cursoId}/registros`);
    const q   = query(ref, orderBy('fechaRegistro', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<RegistroCurso[]>;
  }

  async correoYaRegistrado(cursoId: string, correo: string): Promise<boolean> {
    const ref  = collection(this.firestore, `${this.COL}/${cursoId}/registros`);
    const q    = query(ref, where('correo', '==', correo.trim().toLowerCase()));
    const snap = await getDocs(q);
    return !snap.empty;
  }

  async crearRegistro(cursoId: string, registro: Partial<RegistroCurso>): Promise<string> {
    const ref    = collection(this.firestore, `${this.COL}/${cursoId}/registros`);
    const docRef = await addDoc(ref, {
      cursoId,
      nombre:               registro.nombre               ?? '',
      correo:               (registro.correo ?? '').trim().toLowerCase(),
      telefono:             registro.telefono             ?? '',
      comoSeEnteroOpcion:   registro.comoSeEnteroOpcion   ?? '',
      comoSeEnteroTexto:    registro.comoSeEnteroTexto    ?? '',
      experienciaOpcion:    registro.experienciaOpcion    ?? '',
      experienciaTexto:     registro.experienciaTexto     ?? '',
      fechaRegistro:        Timestamp.now(),
      pagado:               false,
      confirmacionEnviada:  false,
      idCompany:            registro.idCompany            ?? 0,
    });
    await updateDoc(doc(this.firestore, this.COL, cursoId), { cupoUsado: increment(1) });
    return docRef.id;
  }

  async marcarPagado(cursoId: string, registroId: string, pagado: boolean): Promise<void> {
    await updateDoc(
      doc(this.firestore, `${this.COL}/${cursoId}/registros`, registroId),
      { pagado }
    );
  }

  // ── Notificaciones ────────────────────────────────────────────────────────

  async enviarConfirmacionAlumno(curso: Curso, registro: Partial<RegistroCurso>): Promise<void> {
    const mailRef  = collection(this.firestore, 'mail');
    const fmtDate  = (ts: Timestamp) => {
      const d = ts?.toDate ? ts.toDate() : new Date();
      return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    };
    await addDoc(mailRef, {
      to: registro.correo,
      message: {
        subject: `Confirmación de registro — ${curso.nombre}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
            ${curso.logoUrl ? `<img src="${curso.logoUrl}" style="height:60px;margin-bottom:16px">` : ''}
            <h2 style="color:#003366">¡Registro exitoso!</h2>
            <p>Hola <strong>${registro.nombre}</strong>,</p>
            <p>Tu registro para el curso <strong>${curso.nombre}</strong> ha sido confirmado.</p>
            <table style="background:#f0f8ff;padding:16px;border-radius:8px;width:100%;border-collapse:collapse">
              <tr><td style="padding:4px 8px"><strong>Fecha inicio:</strong></td><td>${fmtDate(curso.fechaInicio)}</td></tr>
              <tr><td style="padding:4px 8px"><strong>Fecha fin:</strong></td><td>${fmtDate(curso.fechaFin)}</td></tr>
              <tr><td style="padding:4px 8px"><strong>Horario:</strong></td><td>${curso.horario}</td></tr>
              <tr><td style="padding:4px 8px"><strong>Duración:</strong></td><td>${curso.diasDuracion} día(s)</td></tr>
              <tr><td style="padding:4px 8px"><strong>Costo:</strong></td>
                  <td>${curso.esGratuito ? '<strong style="color:green">GRATUITO</strong>' : '$' + curso.precio + ' ' + curso.moneda}</td></tr>
              ${curso.reunionUrl ? `<tr><td style="padding:4px 8px"><strong>Liga de reunión:</strong></td><td><a href="${curso.reunionUrl}" style="color:#003366;word-break:break-all">${curso.reunionUrl}</a></td></tr>` : ''}
            </table>
            ${curso.reunionUrl ? `<div style="margin-top:20px;text-align:center"><a href="${curso.reunionUrl}" style="background:#003366;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">&#128279; Unirse a la reunión</a></div>` : ''}
            <p style="margin-top:16px">¡Te esperamos! Cualquier duda estamos a tus órdenes.</p>
          </div>
        `,
      },
    });
  }

  notificarAdminTelegram(chatId: string, curso: Curso, registro: Partial<RegistroCurso>): void {
    if (!chatId || !(environment as any).urlChatBot) return;
    const texto =
      `🎓 *Nuevo registro en curso*\n\n` +
      `📚 *Curso:* ${curso.nombre}\n` +
      `👤 *Nombre:* ${registro.nombre}\n` +
      `📧 *Correo:* ${registro.correo}\n` +
      `📱 *Teléfono:* ${registro.telefono}\n` +
      `❓ *¿Cómo se enteró?* ${registro.comoSeEnteroOpcion}` +
        (registro.comoSeEnteroTexto ? ` — ${registro.comoSeEnteroTexto}` : '') + `\n` +
      `🎯 *Experiencia:* ${registro.experienciaOpcion}` +
        (registro.experienciaTexto ? ` — ${registro.experienciaTexto}` : '');
    this.http
      .post(`${(environment as any).urlChatBot}/Telegram/send`, { chatId, text: texto })
      .subscribe({ error: () => {} });
  }
}
