import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import Swal from 'sweetalert2';
import { SignalsService } from 'app/services/signals.service';
import { InventarioWarehouseService } from 'app/services/inventario-warehouse.service';
import { PermitionsService } from 'app/services/permitions.service';
import { TrackingService } from 'app/services/tracking.service';
import { alerts } from 'app/helpers/alerts';
import { MaterialsService } from 'app/services/materials.service';
import { catchError, map, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <!-- Barra superior -->
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2 px-1">

      <!-- Selector de almacén -->
      <div class="d-flex align-items-center gap-1">
        <small class="text-muted fw-semibold">Almacén:</small>
        <select class="form-select form-select-sm" style="min-width:180px; max-width:240px"
                [(ngModel)]="selectedWarehouse">
          <option [value]="0">— Todos —</option>
          <option *ngFor="let w of warehouses" [value]="w.idAlmacen">{{ w.nombreAlmacen || w.name }}</option>
        </select>
      </div>

      <!-- Botón refrescar -->
      <button class="btn btn-sm btn-outline-secondary" (click)="loadData()" title="Refrescar">
        <i class="bi bi-arrow-clockwise"></i>
      </button>

      <!-- Separador -->
      <div class="vr mx-1"></div>

      <!-- Chips resumen -->
      <span class="badge bg-secondary fs-xs">
        <i class="bi bi-box-seam me-1"></i>{{ totalMateriales }} materiales
      </span>
      <span class="badge bg-danger fs-xs" *ngIf="criticos > 0" title="Stock crítico">
        <i class="bi bi-exclamation-triangle-fill me-1"></i>{{ criticos }} críticos
      </span>
      <span class="badge bg-warning text-dark fs-xs" *ngIf="bajos > 0" title="Stock bajo">
        <i class="bi bi-arrow-down-circle me-1"></i>{{ bajos }} bajos
      </span>
      <span class="badge bg-success fs-xs" *ngIf="optimos > 0" title="Stock óptimo">
        <i class="bi bi-check-circle me-1"></i>{{ optimos }} óptimos
      </span>
      <span class="badge bg-primary fs-xs" *ngIf="altos > 0" title="Stock alto">
        <i class="bi bi-arrow-up-circle me-1"></i>{{ altos }} altos
      </span>

      <!-- Valor total (derecha) -->
      <span class="ms-auto badge bg-dark fs-xs">
        Valor total: {{ valorTotal | currency:'MXN':'symbol':'1.0-0' }}
      </span>
    </div>

    <!-- Spinner -->
    <div *ngIf="loading" class="text-center py-4">
      <div class="spinner-border text-primary" style="width:2rem;height:2rem;"></div>
      <p class="text-muted mt-2 small">Cargando inventario...</p>
    </div>

    <!-- Grid -->
    <ag-grid-angular *ngIf="!loading"
      style="width:100%; height:calc(100vh - 220px);"
      class="ag-theme-quartz small-text-ag-grid"
      [rowData]="rowData"
      [columnDefs]="colDefs"
      [defaultColDef]="defaultColDef"
      [gridOptions]="gridOptions"
      [rowClassRules]="rowClassRules"
      [animateRows]="true"
      (gridReady)="onGridReady($event)"
    ></ag-grid-angular>
  `,
})
export class InventarioComponent {
  private signalsService     = inject(SignalsService);
  private inventarioService  = inject(InventarioWarehouseService);
  private permitionsService  = inject(PermitionsService);
  private trackingService    = inject(TrackingService);
  private materialsService   = inject(MaterialsService);

  rowData:           any[]   = [];
  warehouses:        any[]   = [];
  selectedWarehouse: number  = 0;
  loading:           boolean = false;
  idCompany:         number  = 0;
  private gridApi!: GridApi;

  // ── Chips ──────────────────────────────────────────────────────
  get totalMateriales() { return this.rowData.length; }
  get criticos()        { return this.rowData.filter(r => r.estadoStock === 'CRÍTICO').length; }
  get bajos()           { return this.rowData.filter(r => r.estadoStock === 'BAJO').length; }
  get optimos()         { return this.rowData.filter(r => r.estadoStock === 'ÓPTIMO').length; }
  get altos()           { return this.rowData.filter(r => r.estadoStock === 'ALTO').length; }
  get valorTotal()      { return this.rowData.reduce((s, r) => s + (r.total || 0), 0); }

  // ── Grid colors ────────────────────────────────────────────────
  rowClassRules = {
    'inv-critico': (p: any) => p.data?.estadoStock === 'CRÍTICO',
    'inv-bajo':    (p: any) => p.data?.estadoStock === 'BAJO',
    'inv-optimo':  (p: any) => p.data?.estadoStock === 'ÓPTIMO',
    'inv-alto':    (p: any) => p.data?.estadoStock === 'ALTO',
  };

  defaultColDef: ColDef = { sortable: true, resizable: true, suppressMovable: true };

  gridOptions: any = { headerHeight: 28, rowHeight: 26, suppressDragLeaveHidesColumns: true };

  colDefs: ColDef[] = [
    {
      headerName: '#', width: 48, editable: false,
      valueGetter: p => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { textAlign: 'center', color: '#999' },
    },
    { field: 'insumo',      headerName: 'Código',       width: 100, filter: 'agTextColumnFilter' },
    { field: 'description', headerName: 'Descripción',  flex: 2, minWidth: 160, filter: 'agTextColumnFilter' },
    {
      field: 'entrada', headerName: 'Entradas', width: 90, type: 'numericColumn',
      cellStyle: { color: '#198754', fontWeight: '600' },
    },
    {
      field: 'salida', headerName: 'Salidas', width: 90, type: 'numericColumn',
      cellStyle: { color: '#dc3545', fontWeight: '600' },
    },
    {
      field: 'existencia', headerName: 'Existencia', width: 100, type: 'numericColumn',
      cellRenderer: (p: any) => {
        const c: any = { 'CRÍTICO': '#dc3545', 'BAJO': '#fd7e14', 'ÓPTIMO': '#198754', 'ALTO': '#0d6efd' };
        const color  = c[p.data?.estadoStock] || '#333';
        return `<strong style="color:${color}; font-size:1rem">${p.value ?? 0}</strong>`;
      },
    },
    {
      field: 'stockMin', headerName: 'Mín', width: 68, type: 'numericColumn',
      cellStyle: { color: '#aaa', fontSize: '0.8rem' },
    },
    {
      field: 'stockMax', headerName: 'Máx', width: 68, type: 'numericColumn',
      cellStyle: { color: '#aaa', fontSize: '0.8rem' },
    },
    {
      field: 'ventaMN', headerName: 'P. Venta', width: 110, type: 'numericColumn',
      valueFormatter: p => p.value != null
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value) : '',
    },
    {
      field: 'total', headerName: 'Valor Total', flex: 1, minWidth: 120, type: 'numericColumn',
      cellStyle: { fontWeight: '600', color: '#0e4491' },
      valueFormatter: p => p.value != null
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value) : '',
    },
    {
      field: 'estadoStock', headerName: 'Estado', width: 90,
      cellRenderer: (p: any) => {
        const m: any = { 'CRÍTICO': 'bg-danger', 'BAJO': 'bg-warning text-dark', 'ÓPTIMO': 'bg-success', 'ALTO': 'bg-primary' };
        return `<span class="badge ${m[p.value] ?? 'bg-secondary'}" style="font-size:0.68rem">${p.value ?? ''}</span>`;
      },
    },
    {
      headerName: '', width: 72, editable: false, sortable: false, resizable: false,
      cellStyle: { textAlign: 'center', paddingTop: '3px' },
      cellRenderer: () =>
        `<button class="btn btn-sm btn-outline-warning py-0 px-1" style="font-size:0.7rem" title="Ajuste físico">
           <i class="bi bi-pencil-square"></i> Ajustar
         </button>`,
      onCellClicked: p => this.openAjuste(p.data),
    },
  ];

  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.loadWarehouses();
      this.loadData();
    });
  }

  onGridReady(e: GridReadyEvent) { this.gridApi = e.api; }

  loadWarehouses() {
    const email = this.trackingService.getEmail();
    if (!email) return;
    this.permitionsService.getPermisionswarehousexEmail(email).subscribe({
      next: (data: any[]) => {
        this.warehouses = Array.isArray(data) ? data : [];
        if (this.warehouses.length && !this.selectedWarehouse)
          this.selectedWarehouse = this.warehouses[0].idAlmacen;
      },
      error: () => {},
    });
  }

  loadData() {
    if (!this.idCompany) return;
    this.loading = true;
    this.inventarioService.getInventario(this.idCompany).pipe(
      catchError(() => of([])),
      switchMap((data: any[]) => this.materialsService.getMaterials2Fields(this.idCompany).pipe(catchError(() => of([])), map((materials: any[]) => ({ data: Array.isArray(data) ? data : [], materials: Array.isArray(materials) ? materials : [] }))))
    ).subscribe({
      next: result => {
        const existing = new Map(result.data.map((r: any) => [+r.id, r]));
        this.rowData = result.materials.map((m: any) => existing.get(+m.id) || { id: m.id, insumo: m.insumo || m.barcode || '', description: m.description || m.materialName || '', entrada: 0, salida: 0, existencia: 0, stockMin: m.stockmin || 0, stockMax: m.stockmax || 0, ventaMN: m.ventaMN || 0, total: 0, estadoStock: 'CRÍTICO' });
        result.data.filter((r: any) => !existing.has(+r.id)).forEach((r: any) => this.rowData.push(r));
        this.loading = false;
      },
      error: ()   => { this.loading = false; },
    });
  }

  async openAjuste(row: any): Promise<void> {
    if (!this.selectedWarehouse) {
      alerts.basicAlert('Almacén requerido', 'Selecciona un almacén para realizar el ajuste.', 'warning');
      return;
    }

    const result = await Swal.fire({
      title:  'Ajuste Físico de Inventario',
      width:  460,
      html: `
        <div class="text-start px-1">
          <div class="mb-1 fw-semibold" style="font-size:0.95rem">${row.description}</div>
          <div class="mb-3 text-muted" style="font-size:0.8rem">
            Código: <code>${row.insumo}</code>
            &nbsp;|&nbsp; Existencia actual: <strong>${row.existencia}</strong>
            &nbsp;|&nbsp; Estado: <strong>${row.estadoStock ?? '—'}</strong>
          </div>

          <label class="form-label fw-semibold mb-1" style="font-size:0.85rem">Cantidad física real:</label>
          <input id="aju-qty" type="number" min="0" step="1" value="${row.existencia}"
                 class="swal2-input" style="margin:0 0 6px 0; width:100%">

          <div id="aju-delta" class="text-center fw-bold mb-2" style="font-size:1.05rem; min-height:1.6rem"></div>

          <label class="form-label fw-semibold mb-1" style="font-size:0.85rem">Comentario (opcional):</label>
          <textarea id="aju-comment" class="swal2-textarea"
                    style="margin:0; width:100%; height:58px; font-size:0.85rem"
                    placeholder="Motivo del ajuste..."></textarea>
        </div>
      `,
      showCancelButton:  true,
      confirmButtonText: '<i class="bi bi-floppy me-1"></i>Guardar ajuste',
      cancelButtonText:  'Cancelar',
      confirmButtonColor: '#0d6efd',
      focusConfirm: false,
      didOpen: () => {
        const qEl = document.getElementById('aju-qty')   as HTMLInputElement;
        const dEl = document.getElementById('aju-delta') as HTMLElement;
        const update = () => {
          const delta = (parseFloat(qEl.value) || 0) - Number(row.existencia);
          dEl.innerHTML = delta === 0
            ? `<span class="text-muted small">Sin cambios</span>`
            : delta > 0
              ? `<span class="text-success">▲ +${delta.toFixed(0)} — se generará <em>entrada</em></span>`
              : `<span class="text-danger">▼ ${delta.toFixed(0)} — se generará <em>salida</em></span>`;
        };
        qEl.addEventListener('input', update);
        update();
      },
      preConfirm: (): { qty: number; comment: string } | null => {
        const qty = parseFloat((document.getElementById('aju-qty') as HTMLInputElement).value);
        if (isNaN(qty) || qty < 0) {
          Swal.showValidationMessage('Ingresa una cantidad válida (≥ 0)');
          return null;
        }
        const comment = (document.getElementById('aju-comment') as HTMLTextAreaElement).value;
        return { qty, comment };
      },
    });

    if (!result.isConfirmed || !result.value) return;

    try {
      await this.inventarioService.ajustar({
        idMaterial:     row.id,
        idWarehouse:    this.selectedWarehouse,
        cantidadFisica: result.value.qty,
        comentario:     result.value.comment,
        idCompany:      this.idCompany,
      }).toPromise();
      alerts.basicAlert('¡Ajuste guardado!', 'El inventario fue actualizado correctamente.', 'success');
      this.loadData();
    } catch {
      alerts.basicAlert('Error', 'No se pudo guardar el ajuste. Verifica que el almacén seleccionado sea correcto.', 'error');
    }
  }
}
