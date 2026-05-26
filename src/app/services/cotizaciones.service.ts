import { inject, Injectable } from '@angular/core';
import {
  Firestore, collection, addDoc, collectionData, query,
  where, doc, updateDoc, Timestamp, getDocs, deleteDoc,
  getDoc, setDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Cotizacion {
  id?: string;
  numCotizacion: string;
  idProspecto: string;
  nombreProspecto: string;
  empresaProspecto: string;
  lugar: string;
  /** Familia de materiales que se muestran en el detalle (vacío = todas) */
  familia?: string;
  idVendedor: number;
  nombreVendedor: string;
  idCompany: number;
  fecha: Timestamp;
  estado: string;
  notas: string;
  total: number;
  countItems: number;
  activo: boolean;
  __isNew?: boolean;
  __modified?: boolean;
}

export interface CotizacionItem {
  id?: string;
  idMaterial: number;
  nombreMaterial: string;
  unidad: string;
  cantidad: number;
  precio: number;
  subtotal: number;
  __isNew?: boolean;
}

export interface CotizacionConfig {
  idCompany?: number;
  prefijo: string;
  consecutivo: number;
  lugarDefault: string;
  textoPrincipal: string;
  textoCompromiso: string;
  clausula1: string;
  clausula2: string;
  clausula3: string;
  textoAclaracion: string;
  textoDespedida: string;
  textoIva: string;
  /** Familias permitidas en el detalle. Vacío = todas las familias */
  familias?: string[];
}

export const CONFIG_DEFAULT: CotizacionConfig = {
  prefijo:          'VENTAS-',
  consecutivo:      0,
  lugarDefault:     '',
  textoPrincipal:   'POR MEDIO DEL PRESENTE PONGO A SU AMABLE CONSIDERACIÓN LA SIGUIENTE COTIZACIÓN PARA EL SUMINISTRO DE LOS PRODUCTOS Y/O SERVICIOS QUE A CONTINUACIÓN SE DESCRIBEN, ESPERANDO QUE NUESTRA PROPUESTA SEA DE SU APROBACIÓN Y AGRADECIENDO DE ANTEMANO LA ATENCIÓN A LA PRESENTE.',
  textoCompromiso:  'NUESTRO COMPROMISO ES DARLE A NUESTROS CLIENTES LA CONFIANZA Y LA VISIÓN DE OPTIMIZAR RECURSOS Y UNA MEJOR UTILIDAD EN SUS CONTRATOS.',
  clausula1:        'INTEL-CODE NO SE HACE RESPONSABLE DE LOS DAÑOS OCASIONADOS A LA INFORMACIÓN QUE GENERE NUESTRO SISTEMA, PRODUCTO DEL MAL MANEJO DE EQUIPOS, USO INCORRECTO DE NUESTRO SISTEMA, O QUE EL USUARIO CORROMPA LOS DATOS MEDIANTE EL ACCESO DIRECTO O INDIRECTO A LA BASE DE DATOS (ACCESO MEDIANTE OTRAS APLICACIONES).',
  clausula2:        'EL CLIENTE SE COMPROMETE A PROPORCIONAR TODOS LOS MEDIOS Y RECURSOS NECESARIOS PARA LA PUESTA EN MARCHA DEL SISTEMA, ASÍ MISMO ASIGNARÁ A UNA PERSONA QUE SERÁ EL ENLACE ENTRE EL CLIENTE E INTEL-CODE, QUIEN PROPORCIONARÁ EL RECURSO HUMANO PARA LA CONFIGURACIÓN Y PUESTA EN MARCHA DEL SISTEMA.',
  clausula3:        'INTEL-CODE Y LA CIA FIRMARÁ CONTRATO DE SERVICIOS QUE SERÁ ENTREGADO DÍAS DESPUÉS DE ACEPTAR LA COTIZACIÓN.',
  textoAclaracion:  'PARA CUALQUIER ACLARACIÓN O DUDA CON LOS PUNTOS AQUÍ MENCIONADOS ESTOY A SUS ÓRDENES PARA ACLARARLOS Y/O REALIZAR LOS CAMBIOS QUE SEAN PERTINENTES EN BENEFICIO DE AMBAS PARTES.',
  textoDespedida:   'SIN MÁS POR EL MOMENTO ME DESPIDO DE UD. AGRADECIENDO DE ANTEMANO LA ATENCIÓN PRESTADA AL PRESENTE, ESPERANDO VERNOS FAVORECIDOS PARA LA EJECUCIÓN DE LOS TRABAJOS.',
  textoIva:         '*LA PRESENTE COTIZACIÓN NO INCLUYE EL IVA',
  familias:         [],
};

export const ESTADOS_COTIZACION = [
  { value: 'borrador',  label: 'Borrador',  color: 'secondary' },
  { value: 'enviada',   label: 'Enviada',   color: 'info'      },
  { value: 'aceptada',  label: 'Aceptada',  color: 'success'   },
  { value: 'rechazada', label: 'Rechazada', color: 'danger'    },
];

@Injectable({ providedIn: 'root' })
export class CotizacionesService {
  private firestore = inject(Firestore);
  private readonly COL        = 'cotizaciones';
  private readonly CONFIG_COL = 'cotizacionesConfig';

  getCotizaciones(idVendedor: number): Observable<Cotizacion[]> {
    const ref = collection(this.firestore, this.COL);
    const q = query(ref, where('idVendedor', '==', idVendedor));
    return collectionData(q, { idField: 'id' }) as Observable<Cotizacion[]>;
  }

  async crearCotizacion(c: Partial<Cotizacion>): Promise<string> {
    const ref = collection(this.firestore, this.COL);
    const docRef = await addDoc(ref, {
      numCotizacion:   c.numCotizacion   ?? '',
      idProspecto:     c.idProspecto     ?? '',
      nombreProspecto: c.nombreProspecto ?? '',
      empresaProspecto: c.empresaProspecto ?? '',
      lugar:           c.lugar           ?? '',
      familia:         c.familia         ?? '',
      idVendedor:      c.idVendedor      ?? 0,
      nombreVendedor:  c.nombreVendedor  ?? '',
      idCompany:       c.idCompany       ?? null,
      fecha:           Timestamp.now(),
      estado:          'borrador',
      notas:           c.notas           ?? '',
      total:           0,
      countItems:      0,
      activo:          true,
    });
    return docRef.id;
  }

  async actualizarCotizacion(id: string, campos: Partial<Cotizacion>): Promise<void> {
    const { __isNew, __modified, ...data } = campos as any;
    await updateDoc(doc(this.firestore, this.COL, id), data);
  }

  // ── Config ────────────────────────────────────────────────────────────────

  async getConfig(idCompany: number): Promise<CotizacionConfig> {
    const ref  = doc(this.firestore, this.CONFIG_COL, String(idCompany));
    const snap = await getDoc(ref);
    return snap.exists()
      ? { ...CONFIG_DEFAULT, ...snap.data(), idCompany } as CotizacionConfig
      : { ...CONFIG_DEFAULT, idCompany };
  }

  async saveConfig(idCompany: number, config: CotizacionConfig): Promise<void> {
    const ref  = doc(this.firestore, this.CONFIG_COL, String(idCompany));
    const snap = await getDoc(ref);
    const { idCompany: _, ...data } = config as any;
    if (snap.exists()) {
      await updateDoc(ref, data);
    } else {
      await setDoc(ref, { ...data, idCompany });
    }
  }

  async getNextNumero(idCompany: number): Promise<string> {
    const ref  = doc(this.firestore, this.CONFIG_COL, String(idCompany));
    const snap = await getDoc(ref);
    const data = snap.exists()
      ? { ...CONFIG_DEFAULT, ...snap.data() } as CotizacionConfig
      : { ...CONFIG_DEFAULT };
    const next    = (data.consecutivo ?? 0) + 1;
    const prefijo = data.prefijo ?? 'VENTAS-';
    if (snap.exists()) {
      await updateDoc(ref, { consecutivo: next });
    } else {
      await setDoc(ref, { ...CONFIG_DEFAULT, idCompany, consecutivo: next });
    }
    return `${prefijo}${String(next).padStart(4, '0')}`;
  }

  // ── Items ─────────────────────────────────────────────────────────────────

  async getItems(cotizacionId: string): Promise<CotizacionItem[]> {
    const q = query(collection(this.firestore, `${this.COL}/${cotizacionId}/items`));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as CotizacionItem);
  }

  async enviarPorCorreo(destinatario: string, cotizacion: Cotizacion, pdfBase64: string, vendedorEmail?: string, cc?: string): Promise<void> {
    const mailRef = collection(this.firestore, 'mail');
    await addDoc(mailRef, {
      to: destinatario,
      ...(cc          ? { cc }               : {}),
      ...(vendedorEmail ? { replyTo: vendedorEmail } : {}),
      message: {
        subject: `Cotización ${cotizacion.numCotizacion} — ${cotizacion.empresaProspecto || cotizacion.nombreProspecto}`,
        html: `
          <p>Estimado: <strong>${cotizacion.empresaProspecto || cotizacion.nombreProspecto}</strong>,</p>
          <p>Adjuntamos la cotización <strong>${cotizacion.numCotizacion}</strong> solicitada.</p>
          <p>Cualquier duda estamos a sus órdenes.</p>
          <br>
          <p>Atentamente,<br><strong>${cotizacion.nombreVendedor}</strong></p>
        `,
        attachments: [{
          filename: `${cotizacion.numCotizacion}.pdf`,
          content:  pdfBase64,
          encoding: 'base64',
        }],
      },
    });
  }

  // ── Historial de correos ──────────────────────────────────────────────────

  async getEmailHistorial(idCompany: number): Promise<string[]> {
    const ref  = doc(this.firestore, 'cotizacionesMailHistory', String(idCompany));
    const snap = await getDoc(ref);
    return snap.exists() ? ((snap.data()['emails'] ?? []) as string[]) : [];
  }

  async guardarEmailHistorial(idCompany: number, emails: string[]): Promise<void> {
    const ref      = doc(this.firestore, 'cotizacionesMailHistory', String(idCompany));
    const snap     = await getDoc(ref);
    const existing = snap.exists() ? ((snap.data()['emails'] ?? []) as string[]) : [];
    const merged   = Array.from(new Set([...existing, ...emails.map(e => e.trim().toLowerCase()).filter(Boolean)])).sort();
    if (snap.exists()) {
      await updateDoc(ref, { emails: merged });
    } else {
      await setDoc(ref, { emails: merged, idCompany });
    }
  }

  async guardarItems(cotizacionId: string, items: CotizacionItem[]): Promise<void> {
    const colRef = collection(this.firestore, `${this.COL}/${cotizacionId}/items`);
    const docRef = doc(this.firestore, this.COL, cotizacionId);

    // Borrar existentes
    const snap = await getDocs(colRef);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));

    // Insertar nuevos — sanitizar para evitar undefined/NaN que Firestore rechaza
    const sanitize = (item: any) => ({
      idMaterial:     Number(item.idMaterial)     || 0,
      nombreMaterial: item.nombreMaterial         ?? '',
      unidad:         item.unidad                 ?? '',
      cantidad:       Number(item.cantidad)        || 0,
      precio:         Number(item.precio)          || 0,
      subtotal:       Number(item.subtotal)        || 0,
    });
    const total = items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
    await Promise.all(items.map(({ __isNew, id, ...item }) =>
      addDoc(colRef, sanitize(item))
    ));

    await updateDoc(docRef, { total, countItems: items.length });
  }
}
