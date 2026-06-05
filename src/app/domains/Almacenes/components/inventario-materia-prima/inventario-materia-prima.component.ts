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
  `,
})
export class InventarioMateriaPrimaComponent {
  private signalsService = inject(SignalsService);
  private inventarioService = inject(InventarioMpService);

  locale = AG_GRID_LOCALE_ES;
  private gridApi?: GridApi;

  cargando = signal<boolean>(false);
  ocultarCeros = signal<boolean>(false);

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

    for (const c of this.vista().columnas) {
      cols.push({
        headerName: c.nombre,
        field: 'c' + c.id,
        type: 'numericColumn',
        minWidth: 130,
        flex: 1,
        valueFormatter: p => this.fmt(p.value),
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
      const row: any = { articulo: f.articulo, total: f.total ?? 0 };
      for (const c of vista.columnas) {
        row['c' + c.id] = (f.valores && f.valores[c.id] != null) ? f.valores[c.id] : 0;
      }
      return row;
    });
  }

  private fmt(v: any): string {
    const n = Number(v ?? 0);
    if (!isFinite(n)) return '0';
    return n.toLocaleString('es-MX', {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    });
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
