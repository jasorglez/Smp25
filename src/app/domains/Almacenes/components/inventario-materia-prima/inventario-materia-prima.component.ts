import { Component, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import {
  InventarioMpService,
  InventarioMpVista,
  InventarioMpColumna,
  InventarioMpDetalle,
} from 'app/services/inventario-mp.service';

/**
 * Inventario de Materia Prima (almacén global, SOLO LECTURA).
 * Dos vistas según el sidebar:
 *  - Todas las sucursales (id <= 0 / null) → GERENCIAL: título "Delicia", columnas = sucursales.
 *  - Una sucursal específica          → POR SUCURSAL: título = sucursal, columnas = departamentos.
 * Filas = TODAS las materias primas (aunque estén en 0). Toggle para ocultar filas en 0 + Imprimir/PDF.
 */
@Component({
  selector: 'app-inventario-materia-prima',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div class="card border-0 mt-2">
      <div class="card-body p-2">
        <!-- Encabezado -->
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
          <h5 class="m-0 fw-bold text-success">
            <i class="bi bi-clipboard-data me-1"></i>
            Inventario Materia Prima — {{ titulo() }}
          </h5>

          <div class="d-flex align-items-center gap-3">
            <div class="form-check form-switch m-0">
              <input class="form-check-input" type="checkbox" id="ocultarCeros"
                     [checked]="ocultarCeros()"
                     (change)="ocultarCeros.set($any($event.target).checked)">
              <label class="form-check-label small" for="ocultarCeros">Ocultar filas en 0</label>
            </div>
            <button class="btn btn-sm btn-outline-success" (click)="imprimir()" [disabled]="cargando()">
              <i class="bi bi-printer me-1"></i> Imprimir / PDF
            </button>
          </div>
        </div>

        <div *ngIf="cargando()" class="text-center text-muted py-4">
          <span class="spinner-border spinner-border-sm me-2"></span> Cargando inventario…
        </div>

        <ag-grid-angular
          *ngIf="!cargando()"
          class="ag-theme-quartz"
          style="width: 100%; height: 70vh;"
          [rowData]="rowsVisibles()"
          [columnDefs]="columnDefs()"
          [defaultColDef]="defaultColDef"
          [localeText]="locale"
          [suppressCellFocus]="true"
          (gridReady)="onGridReady($event)">
        </ag-grid-angular>
      </div>
    </div>

    <!-- ── Modal detalle de lotes (solo lectura) ── -->
    <div *ngIf="detalleAbierto()" class="imp-overlay" (click)="cerrarDetalle()">
      <div class="imp-modal" (click)="$event.stopPropagation()">
        <div class="imp-modal-head">
          <div>
            <h6 class="m-0 fw-bold text-success">{{ detalleTitulo() }}</h6>
            <div class="small text-muted">Total: <b>{{ fmt(detalle()?.total ?? 0) }}</b></div>
          </div>
          <button class="btn-close" (click)="cerrarDetalle()"></button>
        </div>

        <div class="imp-modal-body">
          <div *ngIf="detalleCargando()" class="text-center text-muted py-3">
            <span class="spinner-border spinner-border-sm me-2"></span> Cargando…
          </div>

          <div *ngIf="!detalleCargando() && (detalle()?.lotes?.length ?? 0) === 0" class="text-center text-muted py-3">
            Sin lotes con inventario para esta celda.
          </div>

          <!-- Nivel 1: lotes (una fila por entrada). Acordeón con focus. -->
          <table *ngIf="!detalleCargando() && (detalle()?.lotes?.length ?? 0) > 0" class="imp-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Folio entrada</th>
                <th class="num">Cantidad inventario</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngFor="let l of detalle()?.lotes">
                <tr *ngIf="loteExpandido() === null || loteExpandido() === l.idDatoExterno"
                    class="imp-row-lote" [class.imp-row-open]="loteExpandido() === l.idDatoExterno"
                    (click)="toggleLote(l.idDatoExterno)">
                  <td>{{ l.lote }}</td>
                  <td>{{ l.folioEntrada }}</td>
                  <td class="num">
                    <span class="imp-chevron">{{ loteExpandido() === l.idDatoExterno ? '▼' : '▶' }}</span>
                    {{ fmt(l.cantidadInventario) }}
                  </td>
                </tr>
                <!-- Nivel 2: movimientos del lote-entrada -->
                <tr *ngIf="loteExpandido() === l.idDatoExterno">
                  <td colspan="3" class="imp-sub-cell">
                    <table class="imp-subtable">
                      <thead>
                        <tr>
                          <th>Fecha Entrada / Salida</th>
                          <th class="num">Cantidad Entrada</th>
                          <th class="num">Cantidad Salida</th>
                          <th>Quien agregó / utilizó</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let m of l.movimientos">
                          <td>{{ fmtFecha(m.fecha) }}</td>
                          <td class="num">{{ m.cantidadEntrada != null ? fmt(m.cantidadEntrada) : '—' }}</td>
                          <td class="num">{{ m.cantidadSalida != null ? fmt(m.cantidadSalida) : '—' }}</td>
                          <td>{{ m.quien }}</td>
                        </tr>
                        <tr *ngIf="!l.movimientos?.length">
                          <td colspan="4" class="text-muted text-center">Sin movimientos.</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .imp-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center; z-index: 1060;
    }
    .imp-modal {
      background: #fff; border-radius: 12px; width: min(760px, 94vw);
      max-height: 88vh; display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 18px 50px rgba(0,0,0,0.25);
    }
    .imp-modal-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px; border-bottom: 1px solid #e8eef5; background: #f7fbf8;
    }
    .imp-modal-body { padding: 14px 18px; overflow: auto; }
    .imp-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .imp-table th, .imp-table td { border: 1px solid #e0e6ee; padding: 6px 10px; text-align: left; }
    .imp-table thead th { background: #e8f5e9; font-weight: 600; }
    .imp-table .num { text-align: right; }
    .imp-row-lote { cursor: pointer; }
    .imp-row-lote:hover { background: #f1f8e9; }
    .imp-row-open { background: #e8f5e9; font-weight: 600; }
    .imp-chevron { color: #2e7d32; margin-right: 4px; }
    .imp-sub-cell { background: #fafdf9; padding: 8px 10px; }
    .imp-subtable { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .imp-subtable th, .imp-subtable td { border: 1px solid #d7e3d2; padding: 5px 8px; }
    .imp-subtable thead th { background: #d7ecd9; font-weight: 600; }
    .imp-subtable .num { text-align: right; }
  `],
})
export class InventarioMateriaPrimaComponent {
  private signalsService = inject(SignalsService);
  private inventarioService = inject(InventarioMpService);

  locale = AG_GRID_LOCALE_ES;
  private gridApi?: GridApi;

  cargando = signal<boolean>(false);
  ocultarCeros = signal<boolean>(false);

  // ── Modal detalle de lotes (solo vista por sucursal) ──
  detalleAbierto = signal<boolean>(false);
  detalleCargando = signal<boolean>(false);
  detalleTitulo = signal<string>('');
  detalle = signal<InventarioMpDetalle | null>(null);
  loteExpandido = signal<number | null>(null);   // idDatoExterno expandido (acordeón con focus)

  // Estado de la vista actual
  private vista = signal<InventarioMpVista>({ columnas: [], filas: [] });
  private esGerencial = signal<boolean>(true);
  private nombreSucursal = signal<string>('');

  titulo = computed(() => (this.esGerencial() ? 'Delicia' : (this.nombreSucursal() || 'Sucursal')));

  defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    suppressMovable: false,
  };

  // Todas las filas mapeadas a objeto plano { articulo, total, c{colId}: cantidad }
  private todasLasFilas = signal<any[]>([]);

  rowsVisibles = computed(() => {
    const rows = this.todasLasFilas();
    return this.ocultarCeros() ? rows.filter(r => (r.total ?? 0) !== 0) : rows;
  });

  columnDefs = computed<ColDef[]>(() => {
    const cols: ColDef[] = [
      {
        headerName: 'Materia prima',
        field: 'articulo',
        pinned: 'left',
        minWidth: 240,
        flex: 2,
        cellStyle: { fontWeight: '500' },
      },
    ];

    const porSucursal = !this.esGerencial();
    for (const c of this.vista().columnas) {
      cols.push({
        headerName: c.nombre,
        field: 'c' + c.id,
        type: 'numericColumn',
        minWidth: 130,
        flex: 1,
        valueFormatter: p => this.fmt(p.value),
        // Solo en la vista por sucursal la celda de departamento abre el detalle de lotes.
        cellStyle: porSucursal
          ? { cursor: 'pointer', color: '#0d47a1', textDecoration: 'underline' }
          : undefined,
        onCellClicked: porSucursal ? (p: any) => this.onCeldaDeptoClick(c.id, p.data) : undefined,
      });
    }

    cols.push({
      headerName: 'Total',
      field: 'total',
      type: 'numericColumn',
      pinned: 'right',
      minWidth: 130,
      valueFormatter: p => this.fmt(p.value),
      cellStyle: { fontWeight: '700', background: '#f1f8e9' },
      headerClass: 'fw-bold',
    });

    return cols;
  });

  constructor() {
    // Reacciona a la empresa y la sucursal seleccionadas en el sidebar.
    // allowSignalWrites: cargar() escribe signals (cargando/esGerencial/…) — sin esto Angular
    // lanza NG0600 y aborta la carga (la tabla quedaba vacía).
    effect(() => {
      const idCompany = this.signalsService.getRootSelectedBySidebar()();
      const idBranch = this.signalsService.getBranchSelectedBySidebar()();
      const branchName = this.signalsService.getBranchNameSelectedBySidebar()();
      if (!idCompany) return;   // espera empresa válida (no null, no 0)
      this.cargar(idCompany, idBranch, branchName ?? '');
    }, { allowSignalWrites: true });
  }

  onGridReady(e: GridReadyEvent) {
    this.gridApi = e.api;
  }

  private cargar(idCompany: number, idBranch: number | null, branchName: string) {
    // "Todas las sucursales" → id nulo o no positivo → vista gerencial.
    const gerencial = idBranch == null || idBranch <= 0;
    this.esGerencial.set(gerencial);
    this.nombreSucursal.set(branchName);
    this.cargando.set(true);

    const req = gerencial
      ? this.inventarioService.getGerencial(idCompany)
      : this.inventarioService.getPorSucursal(idCompany, idBranch as number);

    req.subscribe({
      next: (v) => {
        const vista = v ?? { columnas: [], filas: [] };
        this.vista.set(vista);
        this.todasLasFilas.set(this.mapearFilas(vista));
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error cargando inventario MP:', err);
        this.vista.set({ columnas: [], filas: [] });
        this.todasLasFilas.set([]);
        this.cargando.set(false);
      },
    });
  }

  private mapearFilas(vista: InventarioMpVista): any[] {
    return (vista.filas ?? []).map(f => {
      const row: any = { idMaterial: f.idMaterial, articulo: f.articulo, total: f.total ?? 0 };
      for (const c of vista.columnas) {
        row['c' + c.id] = (f.valores && f.valores[c.id] != null) ? f.valores[c.id] : 0;
      }
      return row;
    });
  }

  fmt(v: any): string {
    const n = Number(v ?? 0);
    if (!isFinite(n)) return '0';
    return n.toLocaleString('es-MX', {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }

  fmtFecha(v: any): string {
    if (!v) return '—';
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}/${d.getFullYear()}`;
    } catch { return String(v); }
  }

  // ── Modal detalle de lotes ──
  private onCeldaDeptoClick(idDepartamento: number, row: any): void {
    if (this.esGerencial()) return;
    const idMaterial = Number(row?.idMaterial ?? 0);
    const idSucursal = Number(this.signalsService.getBranchSelectedBySidebar()() ?? 0);
    if (!idMaterial || !idDepartamento || !idSucursal) return;

    const deptoNombre = this.vista().columnas.find(c => c.id === idDepartamento)?.nombre ?? '';
    this.detalleTitulo.set(`${row.articulo} - ${deptoNombre}`);
    this.detalleAbierto.set(true);
    this.detalleCargando.set(true);
    this.detalle.set(null);
    this.loteExpandido.set(null);

    this.inventarioService.getDetalle(idMaterial, idDepartamento, idSucursal).subscribe({
      next: (d) => { this.detalle.set(d ?? { total: 0, lotes: [] }); this.detalleCargando.set(false); },
      error: () => { this.detalle.set({ total: 0, lotes: [] }); this.detalleCargando.set(false); },
    });
  }

  cerrarDetalle(): void {
    this.detalleAbierto.set(false);
    this.detalle.set(null);
    this.loteExpandido.set(null);
  }

  /** Acordeón con focus: al expandir un lote, las demás filas se ocultan. */
  toggleLote(idDatoExterno: number): void {
    this.loteExpandido.set(this.loteExpandido() === idDatoExterno ? null : idDatoExterno);
  }

  // Imprime/exporta a PDF generando una tabla HTML limpia en una ventana nueva.
  imprimir() {
    const cols = this.vista().columnas;
    const rows = this.rowsVisibles();
    const fecha = new Date().toLocaleString('es-MX');

    const ths = cols.map(c => `<th class="num">${this.esc(c.nombre)}</th>`).join('');
    const trs = rows.map(r => {
      const tds = cols.map(c => `<td class="num">${this.fmt(r['c' + c.id])}</td>`).join('');
      return `<tr><td>${this.esc(r.articulo)}</td>${tds}<td class="num tot">${this.fmt(r.total)}</td></tr>`;
    }).join('');

    const html = `
      <html><head><meta charset="utf-8"><title>Inventario Materia Prima — ${this.esc(this.titulo())}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#222}
        h2{margin:0 0 4px;color:#2e7d32}
        .sub{color:#666;font-size:12px;margin-bottom:14px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #cfcfcf;padding:6px 8px;text-align:left}
        th{background:#e8f5e9}
        .num{text-align:right}
        .tot{font-weight:700;background:#f1f8e9}
        tr:nth-child(even){background:#fafafa}
        @media print{button{display:none}}
      </style></head>
      <body>
        <h2>Inventario Materia Prima — ${this.esc(this.titulo())}</h2>
        <div class="sub">Generado: ${this.esc(fecha)}</div>
        <table>
          <thead><tr><th>Materia prima</th>${ths}<th class="num">Total</th></tr></thead>
          <tbody>${trs || `<tr><td colspan="${cols.length + 2}">Sin datos</td></tr>`}</tbody>
        </table>
        <script>window.onload=function(){window.print();}<\/script>
      </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  private esc(s: any): string {
    return String(s ?? '').replace(/[&<>"]/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
  }
}
