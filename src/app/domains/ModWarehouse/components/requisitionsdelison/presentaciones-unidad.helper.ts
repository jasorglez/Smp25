/**
 * Determinación de la UNIDAD BASE de un artículo a partir de sus presentaciones (Nivel 3
 * de Materia Prima) y validación de consistencia.
 *
 * Regla (definida por negocio):
 *  - Si "Piezas x empaque" > 1  → la unidad base es PIEZA (el contenedor rinde N piezas).
 *  - Si "Piezas x empaque" = 1  → la unidad base es el peso/volumen (kg o L).
 *
 * El valor que se guarda y opera (cantidad x proveedor, requerida, restante) SIEMPRE es la
 * unidad base (kg / L / pz). El conteo de contenedores es solo la herramienta de captura.
 */
import { PresentacionItem, ProveedorPresentaciones } from 'app/services/empaque-descripcion.service';

export function unidadDeTipo(tipo: string | null | undefined): string {
  return tipo === 'PESO' ? 'kg' : tipo === 'VOLUMEN' ? 'L' : '';
}

/** Base efectiva (en unidad base) de una presentación, aplicando la regla de piezas. */
export function baseEfectiva(item: PresentacionItem): { base: number; unidad: string; esPieza: boolean } {
  const pzs = Number(item?.piezaXPaquete ?? 1) || 1;
  if (pzs > 1) return { base: pzs, unidad: 'pz', esPieza: true };
  return { base: Number(item?.medidaBase ?? 0) || 0, unidad: unidadDeTipo(item?.tipo), esPieza: false };
}

export interface UnidadArticulo {
  unidad: string;        // 'kg' | 'L' | 'pz' | ''
  esPieza: boolean;
  /** true = todas las presentaciones (de todos los proveedores) usan la MISMA unidad base. */
  consistente: boolean;
  /** true = al menos un proveedor tiene presentaciones válidas. */
  tienePresentaciones: boolean;
}

/**
 * Resuelve la unidad base del artículo y valida que TODAS sus presentaciones (de todos los
 * proveedores) sean consistentes. Si hay mezcla (unas en pz y otras en kg/L) → consistente=false:
 * el llamador NO debe abrir el modal y debe caer a captura numérica libre.
 */
export function resolverUnidadArticulo(provs: ProveedorPresentaciones[] | null | undefined): UnidadArticulo {
  const unidades = new Set<string>();
  for (const p of (provs ?? [])) {
    for (const it of (p?.presentaciones ?? [])) {
      const e = baseEfectiva(it);
      if (e.base > 0 && e.unidad) unidades.add(e.unidad);
    }
  }
  if (unidades.size === 0) return { unidad: '', esPieza: false, consistente: true, tienePresentaciones: false };
  if (unidades.size > 1) return { unidad: '', esPieza: false, consistente: false, tienePresentaciones: true };
  const u = [...unidades][0];
  return { unidad: u, esPieza: u === 'pz', consistente: true, tienePresentaciones: true };
}

/** Denoms efectivos (para el composer) de un proveedor, ya en unidad base. */
export function denomsDeProveedor(p: ProveedorPresentaciones): { base: number; descripcion: string; unidad: string }[] {
  return (p?.presentaciones ?? [])
    .map(it => {
      const e = baseEfectiva(it);
      return { base: e.base, descripcion: it.descripcionEmpaque ?? '', unidad: e.unidad };
    })
    .filter(d => d.base > 0);
}
