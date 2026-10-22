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
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

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
                [(ngModel)]="selectedWarehouse" (ngModelChange)="loadData()">
          <option [ngValue]="0" disabled>— Seleccione —</option>
          <option *ngFor="let w of warehouses" [ngValue]="warehouseId(w)">{{ warehouseName(w) }}</option>
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
  projectId:         number  = 0;
  private loadedCompany: number = 0;
  private gridApi!: GridApi;

  // ── Chips ──────────────────────────────────────────────────────
  get totalMateriales() { return this.rowData.length; }
  get criticos()        { return this.rowData.filter(r => r.estadoStock === 'CRÍTICO').length; }
  get bajos()           { return this.rowData.filter(r => r.estadoStock === 'BAJO').length; }
  get optimos()         { return this.rowData.filter(r => r.estadoStock === 'ÓPTIMO').length; }
  get altos()           { return this.rowData.filter(r => r.estadoStock === 'ALTO').length; }
  get valorTotal()      { return this.rowData.reduce((s, r) => s + this.toNumber(r.total), 0); }

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
    { field: 'measure',     headerName: 'Unidad',       width: 90, filter: 'agTextColumnFilter' },
    {
      field: 'entrada', headerName: 'Entradas', width: 90, type: 'numericColumn',
      cellStyle: { color: '#198754', fontWeight: '600' },
      valueFormatter: p => this.formatQuantity(p.value),
    },
    {
      field: 'salida', headerName: 'Salidas', width: 90, type: 'numericColumn',
      cellStyle: { color: '#dc3545', fontWeight: '600' },
      valueFormatter: p => this.formatQuantity(p.value),
    },
    {
      field: 'existencia', headerName: 'Existencia', width: 100, type: 'numericColumn',
      cellRenderer: (p: any) => {
        const c: any = { 'CRÍTICO': '#dc3545', 'BAJO': '#fd7e14', 'ÓPTIMO': '#198754', 'ALTO': '#0d6efd' };
        const color  = c[p.data?.estadoStock] || '#333';
        return `<strong style="color:${color}; font-size:1rem">${this.formatQuantity(p.value)}</strong>`;
      },
    },
    {
      field: 'brandStockSummary', headerName: 'Existencia por marca', width: 250,
      valueFormatter: p => p.value || '—',
      cellStyle: { fontSize: '0.78rem', color: '#495057' },
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
      field: 'costoMN', headerName: 'Costo Unit.', width: 115, type: 'numericColumn',
      valueFormatter: p => this.formatCurrency(p.value),
    },
    {
      field: 'total', headerName: 'Valor Inventario', flex: 1, minWidth: 135, type: 'numericColumn',
      cellStyle: { fontWeight: '600', color: '#0e4491' },
      valueFormatter: p => this.formatCurrency(p.value),
    },
    {
      field: 'ventaMN', headerName: 'P. Venta', width: 110, type: 'numericColumn',
      valueFormatter: p => this.formatCurrency(p.value),
    },
    {
      field: 'ventaTotal', headerName: 'Valor Venta', flex: 1, minWidth: 120, type: 'numericColumn',
      valueFormatter: p => this.formatCurrency(p.value),
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
      const company = Number(this.signalsService.getRootSelectedBySidebar()() || 0);
      this.projectId = Number(this.signalsService.getProjectSelectedBySidebar()() || 0);
      const companyChanged = company !== this.loadedCompany;
      this.idCompany = company;

      if (companyChanged) {
        this.loadedCompany = company;
        this.selectedWarehouse = 0;
        this.loadWarehouses();
      } else if (this.selectedWarehouse) {
        this.loadData();
      }
    });
  }

  onGridReady(e: GridReadyEvent) { this.gridApi = e.api; }

  loadWarehouses() {
    const email = this.trackingService.getEmail();
    if (!email) return;
    this.permitionsService.getPermisionswarehousexEmail(email).subscribe({
      next: (data: any[]) => {
        this.warehouses = Array.isArray(data) ? data : [];
        const stillAvailable = this.warehouses.some(w => this.warehouseId(w) === Number(this.selectedWarehouse));
        if (!stillAvailable) this.selectedWarehouse = this.warehouses.length ? this.warehouseId(this.warehouses[0]) : 0;
        this.loadData();
      },
      error: () => {
        this.warehouses = [];
        this.selectedWarehouse = 0;
        this.rowData = [];
      },
    });
  }

  loadData() {
    if (!this.idCompany || !this.selectedWarehouse) {
      this.rowData = [];
      return;
    }

    this.loading = true;
    const movementRequests = (['IN', 'OUT'] as const).map(type =>
      this.inventarioService.getWarehouseMovements(this.selectedWarehouse, type).pipe(
        catchError(() => of([])),
        switchMap((warehouseRows: any[]) => {
          // Compatibilidad mientras se actualiza el contenedor: las versiones
          // anteriores exigían idProject, aunque Inventario es por almacén.
          if (this.asArray(warehouseRows).length || !this.projectId) return of(warehouseRows);
          return this.inventarioService.getMovements(this.projectId, this.selectedWarehouse, type).pipe(catchError(() => of([])));
        }),
        switchMap((masters: any[]) => {
          const movementMasters = this.asArray(masters);
          if (!movementMasters.length) return of({ type, details: [] as any[] });

          return forkJoin(
            movementMasters.map(master =>
              this.inventarioService.getMovementItems(Number(master.id ?? master.Id)).pipe(
                catchError(() => of([])),
                map(details => this.asArray(details))
              )
            )
          ).pipe(map(detailGroups => ({ type, details: detailGroups.flat() })));
        })
      )
    );

    forkJoin({
      materials: this.materialsService.getMaterialsForPosCache(this.idCompany).pipe(catchError(() => of([]))),
      brands: this.materialsService.getMaterialBrands(this.idCompany).pipe(catchError(() => of([]))),
      movements: forkJoin(movementRequests),
    }).subscribe({
      next: result => {
        this.rowData = this.buildInventoryRows(result.materials as any[], result.movements, result.brands as any[]);
        this.loading = false;
      },
      error: error => {
        console.error('Error loading inventory:', error);
        this.rowData = [];
        this.loading = false;
      },
    });
  }

  private buildInventoryRows(materials: any[], movements: Array<{ type: 'IN' | 'OUT'; details: any[] }>, brands: any[] = []): any[] {
    const materialMap = new Map<number, any>();
    this.asArray(materials).forEach(material => materialMap.set(Number(material.id ?? material.Id), material));
    const rows = new Map<number, any>();

    movements.forEach(group => {
      group.details.forEach(detail => {
        const idMaterial = Number(detail.idProduct ?? detail.IdProduct);
        if (!idMaterial) return;
        const material = materialMap.get(idMaterial);
        // Los detalles históricos conservan el código y descripción del material,
        // pero Inventarios solo debe mostrar productos que sigan activos en el catálogo.
        if (!material) return;
        const quantity = this.toNumber(detail.quantity ?? detail.Quantity ?? detail.total ?? detail.Total);
        const current = rows.get(idMaterial) || {
          id: idMaterial,
          insumo: detail.code ?? detail.Code ?? material.insumo ?? material.barCode ?? '',
          description: detail.description ?? detail.Description ?? material.description ?? `Material #${idMaterial}`,
          measure: detail.measure ?? detail.Measure ?? material.measure ?? '',
          entrada: 0,
          salida: 0,
          stockMin: this.toNumber(material.stockMin ?? material.stockmin),
          stockMax: this.toNumber(material.stockMax ?? material.stockmax),
          costoMN: this.toNumber(material.costoMN ?? material.CostoMN),
          ventaMN: this.toNumber(material.ventaMN ?? material.VentaMN ?? material.sellingprice),
          brandStocks: new Map<number | string, { name: string; quantity: number }>(),
        };

        if (group.type === 'IN') current.entrada += quantity;
        else current.salida += quantity;
        const brandId = detail.idBrand ?? detail.IdBrand;
        const brandName = detail.brand ?? detail.Brand ?? detail.brandName ?? detail.BrandName;
        const brandKey: number | string = brandId == null ? 'unbranded' : Number(brandId);
        const configured = brands.find(item => Number(item.idMaterial ?? item.IdMaterial) === idMaterial && Number(item.id) === Number(brandId));
        const stockName = brandId == null ? 'Sin marca' : (brandName || configured?.brand || configured?.Brand || `Marca ${brandId}`);
        const brandStock = current.brandStocks.get(brandKey) || { name: stockName, quantity: 0 };
        brandStock.quantity += group.type === 'IN' ? quantity : -quantity;
        current.brandStocks.set(brandKey, brandStock);
        rows.set(idMaterial, current);
      });
    });

    return [...rows.values()].map(row => {
      const existencia = row.entrada - row.salida;
      const materialBrands = brands.filter(item => Number(item.idMaterial ?? item.IdMaterial) === row.id);
      materialBrands.forEach(brand => {
        const brandId = Number(brand.id ?? brand.Id);
        if (!row.brandStocks.has(brandId)) row.brandStocks.set(brandId, { name: brand.brand ?? brand.Brand, quantity: 0 });
      });
      const unbranded = row.brandStocks.get('unbranded');
      if (unbranded && materialBrands.length === 1) {
        const onlyBrandId = Number(materialBrands[0].id ?? materialBrands[0].Id);
        const onlyBrand = row.brandStocks.get(onlyBrandId)!;
        onlyBrand.quantity += unbranded.quantity;
        row.brandStocks.delete('unbranded');
      } else if (unbranded && materialBrands.length > 1) {
        row.brandStocks.set(0, { name: 'Sin marca', quantity: unbranded.quantity });
        row.brandStocks.delete('unbranded');
      }
      if (materialBrands.length > 1 && !row.brandStocks.has(0)) {
        row.brandStocks.set(0, { name: 'Sin marca', quantity: 0 });
      }
      const brandStocks = [...row.brandStocks.entries()].map(([key, value]) => ({ idBrand: key === 'unbranded' ? 0 : Number(key), ...value }));
      return {
        ...row,
        brands: materialBrands.map(brand => ({ id: Number(brand.id ?? brand.Id), brand: brand.brand ?? brand.Brand })),
        brandStocks,
        brandStockSummary: materialBrands.length
          ? brandStocks.map(stock => `${stock.name}: ${this.formatQuantity(stock.quantity)}`).join(' | ')
          : '',
        existencia,
        total: existencia * row.costoMN,
        ventaTotal: existencia * row.ventaMN,
        estadoStock: this.stockStatus(existencia, row.stockMin, row.stockMax),
      };
    }).sort((a, b) => String(a.description).localeCompare(String(b.description), 'es'));
  }

  private stockStatus(existence: number, minimum: number, maximum: number): string {
    if (existence <= 0) return 'CRÍTICO';
    if (minimum > 0 && existence <= minimum) return 'BAJO';
    if (maximum > 0 && existence > maximum) return 'ALTO';
    return 'ÓPTIMO';
  }

  private asArray(value: any): any[] {
    return Array.isArray(value) ? value : (value?.data || value?.result || value?.items || []);
  }

  warehouseId(warehouse: any): number {
    return Number(warehouse?.idAlmacen ?? warehouse?.idWarehouse ?? warehouse?.id ?? 0);
  }

  warehouseName(warehouse: any): string {
    return warehouse?.nombreAlmacen ?? warehouse?.nameWarehouse ?? warehouse?.name ?? warehouse?.description ?? `Almacén #${this.warehouseId(warehouse)}`;
  }

  private toNumber(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private formatQuantity(value: unknown): string {
    return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 }).format(this.toNumber(value));
  }

  private formatCurrency(value: unknown): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(this.toNumber(value));
  }

  async openAjuste(row: any): Promise<void> {
    if (!this.selectedWarehouse) {
      alerts.basicAlert('Almacén requerido', 'Selecciona un almacén para realizar el ajuste.', 'warning');
      return;
    }

    const brandOptions = row.brands?.length > 1
      ? `<label class="form-label fw-semibold mb-1" style="font-size:0.85rem">Marca:</label>
         <select id="aju-brand" class="swal2-select" style="display:block;width:100%;margin:0 0 10px 0">
           ${row.brandStocks.map((stock: any) => `<option value="${stock.idBrand}">${stock.name} (${this.formatQuantity(stock.quantity)})</option>`).join('')}
         </select>`
      : '';
    const chosenBrand = row.brands?.length === 1 ? row.brands[0] : null;
    const initialStock = chosenBrand
      ? Number(row.brandStocks.find((stock: any) => Number(stock.idBrand) === Number(chosenBrand.id))?.quantity || 0)
      : row.existencia;
    const result = await Swal.fire({
      title:  'Ajuste Físico de Inventario',
      width:  460,
      html: `
        <div class="text-start px-1">
          <div class="mb-1 fw-semibold" style="font-size:0.95rem">${row.description}</div>
          <div class="mb-3 text-muted" style="font-size:0.8rem">
            Código: <code>${row.insumo}</code>
            &nbsp;|&nbsp; Existencia actual: <strong id="aju-current">${this.formatQuantity(initialStock)}</strong>
            &nbsp;|&nbsp; Estado: <strong>${row.estadoStock ?? '—'}</strong>
          </div>

          ${brandOptions}

          <label class="form-label fw-semibold mb-1" style="font-size:0.85rem">Cantidad física real:</label>
          <input id="aju-qty" type="number" min="0" step="0.01" value="${initialStock}"
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
        const brandEl = document.getElementById('aju-brand') as HTMLSelectElement | null;
        const currentEl = document.getElementById('aju-current') as HTMLElement;
        const getCurrent = () => brandEl
          ? Number(row.brandStocks.find((stock: any) => String(stock.idBrand) === brandEl.value)?.quantity || 0)
          : initialStock;
        const update = () => {
          const delta = (parseFloat(qEl.value) || 0) - getCurrent();
          dEl.innerHTML = delta === 0
            ? `<span class="text-muted small">Sin cambios</span>`
            : delta > 0
              ? `<span class="text-success">▲ +${delta.toFixed(0)} — se generará <em>entrada</em></span>`
              : `<span class="text-danger">▼ ${delta.toFixed(0)} — se generará <em>salida</em></span>`;
        };
        qEl.addEventListener('input', update);
        brandEl?.addEventListener('change', () => {
          const current = getCurrent();
          currentEl.textContent = this.formatQuantity(current);
          qEl.value = String(current);
          update();
        });
        update();
      },
      preConfirm: (): { qty: number; comment: string; idBrand: number | null } | null => {
        const qty = parseFloat((document.getElementById('aju-qty') as HTMLInputElement).value);
        if (isNaN(qty) || qty < 0) {
          Swal.showValidationMessage('Ingresa una cantidad válida (≥ 0)');
          return null;
        }
        const comment = (document.getElementById('aju-comment') as HTMLTextAreaElement).value;
        const selected = row.brands?.length > 1
          ? Number((document.getElementById('aju-brand') as HTMLSelectElement).value)
          : (chosenBrand ? Number(chosenBrand.id) : null);
        return { qty, comment, idBrand: selected };
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
        idBrand:        result.value.idBrand,
      }).toPromise();
      alerts.basicAlert('¡Ajuste guardado!', 'El inventario fue actualizado correctamente.', 'success');
      this.loadData();
    } catch {
      alerts.basicAlert('Error', 'No se pudo guardar el ajuste. Verifica que el almacén seleccionado sea correcto.', 'error');
    }
  }
}
