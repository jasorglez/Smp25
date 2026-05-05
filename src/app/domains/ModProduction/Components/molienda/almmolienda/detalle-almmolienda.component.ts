import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { lastValueFrom } from 'rxjs';
import { MoliendaService } from '../../../../../services/molienda.service';
import { OcAndReqsService } from '../../../../../services/ocandreqs.service';
import { CustomersService } from '../../../../../services/customers.service';
import { SignalsService } from '../../../../../services/signals.service';
import { TrackingService } from '../../../../../services/tracking.service';
import { EntradaMoliendaService, EntradaMolienda } from '../../../../../services/entrada-molienda.service';
import { CaracteristicasEntradaService } from '../../../../../services/caracteristicas-entrada.service';
import { alerts } from 'app/helpers/alerts';
import { FechaEditorComponent } from '../../../../../shared/fecha-editor.component';

interface ReqOption {
  id: number;
  folio: string;
  cantidadReq: number;
  numCantidadOc: number;
}

@Component({
  selector: 'app-detalle-almmolienda',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  template: `
    <div style="padding: 6px; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;"
         [style.backgroundColor]="detailType === 'entradas' ? '#e8f5e9' : '#fce4ec'">

      <!-- Título -->
      <div style="margin-bottom: 4px; flex-shrink: 0;">
        <strong style="font-size: 0.85rem;">{{ detailType === 'entradas' ? 'Entradas' : 'Salidas' }}</strong>
      </div>

      <!-- Grid nivel 2 (requisiciones) -->
      <div [style.flex]="selectedReqRow ? '0 0 58px' : '1 1 auto'"
           style="min-height: 58px; position: relative; overflow: hidden;">
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          (gridReady)="onGridReady($event)"
          (cellClicked)="onCellClicked($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>

      <!-- Cascade 3–4: OCs + entradas por OC -->
      <div *ngIf="selectedReqRow"
           style="flex: 1 1 auto; min-height: 0; border-top: 2px solid #1565c0; background: #e3f2fd;
                  padding: 4px; display: flex; flex-direction: column; overflow: hidden;">
        <div style="font-size: 0.78rem; font-weight: bold; color: #1565c0; margin-bottom: 3px; flex-shrink: 0;">
          OC de {{ selectedReqRow.folio }}
        </div>

        <div [style.flex]="selectedOcRow ? '0 0 58px' : '1 1 auto'"
             style="min-height: 58px; position: relative; overflow: hidden;">
          <ag-grid-angular
            class="ag-theme-quartz small-text-ag-grid"
            [rowData]="cascadeOcData"
            [columnDefs]="cascadeOcColDefs"
            [gridOptions]="cascadeOcGridOptions"
            (gridReady)="onCascadeOcGridReady($event)"
            (cellClicked)="onCascadeOcCellClicked($event)"
            style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
          </ag-grid-angular>
        </div>

        <div *ngIf="selectedOcRow"
             style="flex: 1 1 auto; min-height: 0; border-top: 2px solid #0d47a1; background: #eceff1;
                    padding: 4px; display: flex; flex-direction: column; overflow: hidden;">
          <!-- Título + Botones CRUD Entradas -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px; flex-shrink: 0;">
            <div style="font-size: 0.76rem; font-weight: bold; color: #0d47a1;">
              Entradas — {{ selectedOcRow.folio }}
            </div>
            <div style="display: flex; gap: 4px; flex-shrink: 0;">
              <button class="btn btn-sm btn-success" (click)="addEntrada()" [disabled]="!nivel4GridApi" title="Agregar entrada" style="padding: 2px 8px; font-size: 0.7rem;">
                <i class="bi bi-plus-lg" style="margin-right: 2px; font-size: 0.7rem;"></i>Agregar
              </button>
              <button class="btn btn-sm btn-primary position-relative" (click)="saveEntradas()" [disabled]="!hasUnsavedChangesEntradas" title="Guardar cambios" style="padding: 2px 8px; font-size: 0.7rem;">
                <i class="bi bi-floppy" style="margin-right: 2px; font-size: 0.7rem;"></i>Guardar
                <span *ngIf="hasUnsavedChangesEntradas"
                      class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
                      style="width: 10px; height: 10px; padding: 0 !important;">
                </span>
              </button>
              <button class="btn btn-sm btn-warning" (click)="revertEntradas()" title="Deshacer cambios" style="padding: 2px 8px; font-size: 0.7rem;">
                <i class="bi bi-arrow-clockwise" style="margin-right: 2px; font-size: 0.7rem;"></i>Deshacer
              </button>
              <button class="btn btn-sm btn-danger" (click)="deleteEntrada()" [disabled]="!selectedEntradaRow" title="Eliminar entrada" style="padding: 2px 8px; font-size: 0.7rem;">
                <i class="bi bi-trash" style="margin-right: 2px; font-size: 0.7rem;"></i>Eliminar
              </button>
            </div>
          </div>
          <div [style.flex]="selectedEntradaCaratRow ? '0 0 58px' : '1 1 auto'"
               style="min-height: 58px; position: relative; overflow: hidden;">
            <ag-grid-angular
              class="ag-theme-quartz small-text-ag-grid"
              [rowData]="cascadeEntradaData"
              [columnDefs]="nivel4ColDefs"
              [gridOptions]="nivel4GridOptions"
              (gridReady)="onNivel4GridReady($event)"
              style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
            </ag-grid-angular>
          </div>

          <!-- Level 5: Características (cascada) -->
          <div *ngIf="selectedEntradaCaratRow"
               style="flex: 1 1 auto; min-height: 0; border-top: 2px solid #558b2f; background: #f1f8e9;
                      padding: 4px; display: flex; flex-direction: column; overflow: hidden;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px; flex-shrink: 0;">
              <div style="font-size: 0.76rem; font-weight: bold; color: #558b2f;">
                Características — Entrada {{ selectedEntradaCaratRow.idEntrada }}
              </div>
              <div style="display: flex; gap: 4px; flex-shrink: 0;">
                <button class="btn btn-sm btn-primary position-relative" (click)="saveCaracteristicas()" [disabled]="!hasUnsavedChangesCaracteristicas" title="Guardar cambios" style="padding: 2px 8px; font-size: 0.7rem;">
                  <i class="bi bi-floppy" style="margin-right: 2px; font-size: 0.7rem;"></i>Guardar
                  <span *ngIf="hasUnsavedChangesCaracteristicas"
                        class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
                        style="width: 10px; height: 10px; padding: 0 !important;">
                  </span>
                </button>
              </div>
            </div>
            <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
              <ag-grid-angular
                class="ag-theme-quartz small-text-ag-grid"
                [rowData]="cascadeCaratData"
                [columnDefs]="nivel5ColDefs"
                [gridOptions]="nivel5GridOptions"
                (gridReady)="onNivel5GridReady($event)"
                style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
              </ag-grid-angular>
            </div>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: hidden; }
    :host ::ng-deep .selected-oc-highlight { background-color: #bbdefb !important; }
  `]
})
export class DetalleMoliendaComponent {
  private moliendaService = inject(MoliendaService);
  private ocAndReqsService = inject(OcAndReqsService);
  private customersService = inject(CustomersService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);
  private entradaService = inject(EntradaMoliendaService);
  private caracteristicasService = inject(CaracteristicasEntradaService);

  private internalParams: any;
  private gridApi!: GridApi;
  private cascadeOcGridApi!: GridApi;
  nivel4GridApi!: GridApi;
  private nivel5GridApi!: GridApi;
  private deptsCsv: string = '';
  private initCompleted = false;
  private providersMap: Map<number, string> | null = null;

  detailType: 'entradas' | 'salidas' = 'entradas';
  rowData: any[] = [];
  reqOptions: ReqOption[] = [];

  selectedReqRow: any = null;
  cascadeOcData: any[] = [];
  selectedOcRow: any = null;
  cascadeEntradaData: any[] = [];
  private originalCascadeEntradaData: any[] = [];
  hasUnsavedChangesEntradas = false;
  selectedEntradaRow: any = null;
  selectedEntradaCaratRow: any = null;
  cascadeCaratData: any[] = [];
  hasUnsavedChangesCaracteristicas = false;
  private originalCaracteristicasData: any[] = [];
  private existingCaratIds = new Map<number, number>(); // categoryId → recordId en BD
  private editableEntradaColumnOrder = ['fechaRecepcion', 'cantidadEntrada', 'bultos', 'revisionConfigu', 'liberacion'];
  private enterPressed = false;
  bultosCantidad: number | null = null;
  bultosCantidadARevisar: number | null = null;
  proporcionRevision: number | null = null;
  caracteristicasCategories: any[] = [];
  caracteristicasFamilies: any[] = [];

  // ── Nivel 2: Requisiciones ────────────────────────────────────────
  colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 45,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { fontWeight: 'bold' },
    },
    {
      field: 'folio',
      headerName: 'Folio / Req',
      width: 160,
      editable: false,
      cellRenderer: (params: any) => {
        const val = params.value ?? '';
        const div = document.createElement('div');
        div.style.cssText = val
          ? 'cursor:pointer;color:#2e7d32;text-decoration:underline;'
          : 'color:#999;';
        div.textContent = val || '—';
        return div;
      },
      cellStyle: { backgroundColor: '#e8f5e9' },
      tooltipValueGetter: (p) => {
        const req = this.reqOptions.find(r => r.id === p.data?.idRequisition);
        if (!req) return null;
        return `Requisición: ${req.folio}\nCant. Req: ${req.cantidadReq}\n# OC: ${req.numCantidadOc}`;
      },
    },
    {
      field: 'cantidadReq',
      headerName: 'Cant Req',
      width: 120,
      editable: false,
      type: 'numericColumn',
      tooltipValueGetter: (p) => `Cantidad requisitada: ${p.value ?? 0}`,
    },
    {
      field: 'numCantidadOc',
      headerName: '# OC',
      width: 80,
      editable: false,
      type: 'numericColumn',
      tooltipValueGetter: (p) => `Órdenes de compra: ${p.value ?? 0}`,
    },
    {
      headerName: 'Resta',
      width: 110,
      editable: false,
      type: 'numericColumn',
      valueGetter: (p) => (p.data?.cantidadReq ?? 0) - (p.data?.cantidad ?? 0),
    },
  ];

  gridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
      'selected-row-highlight': (p: any) => p.data === this.selectedReqRow,
    },
    tooltipShowDelay: 300,
    defaultColDef: { resizable: true, sortable: true, textAlign: 'center' },
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
  };

  // ── Nivel 3: OCs ──────────────────────────────────────────────────
  cascadeOcColDefs: ColDef[] = [
    {
      field: 'folio',
      headerName: 'OC',
      width: 110,
      editable: false,
      cellStyle: { color: '#2e7d32', backgroundColor: '#e8f5e9' },
      cellRenderer: (params: any) => {
        const val = params.value ?? '';
        const div = document.createElement('div');
        div.style.cssText = val
          ? 'cursor:pointer;color:#2e7d32;text-decoration:underline;'
          : 'color:#999;';
        div.textContent = val || '—';
        return div;
      },
    },
    { field: 'proveedor', headerName: 'Proveedor', flex: 2, minWidth: 140 },
    { field: 'cantidad', headerName: 'Cantidad', width: 110, type: 'numericColumn' },
    { field: 'precioXKilo', headerName: 'Precio x Kilo', width: 120, type: 'numericColumn' },
    { field: 'condEspecial', headerName: 'Cond. Especial', flex: 2, minWidth: 130 },
    {
      field: 'resta', headerName: 'Resta', width: 90, type: 'numericColumn',
      cellStyle: { backgroundColor: '#fff9c4' }
    },
  ];

  cascadeOcGridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    rowClassRules: {
      'selected-oc-highlight': (p: any) => p.data === this.selectedOcRow,
    },
    defaultColDef: { resizable: true, sortable: true, textAlign: 'center' },
    tooltipShowDelay: 300,
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
  };

  // ── Nivel 4: Entradas por OC (demo local; sustituir por API cuando exista) ──
  nivel4ColDefs: ColDef[] = [
    { field: 'idEntrada', headerName: 'ID Entrada', width: 95, type: 'numericColumn' },
    {
      field: 'fechaRecepcion',
      headerName: 'Fecha recepción',
      width: 120,
      editable: true,
      cellEditor: 'fechaEditor',
      valueFormatter: (p) => this.fmtFecha(p.value),
      valueSetter: (params) => {
        if (params.newValue instanceof Date || typeof params.newValue === 'string') {
          const date = params.newValue instanceof Date ? params.newValue : new Date(params.newValue);
          if (!isNaN(date.getTime())) {
            params.data.fechaRecepcion = date;
            this.onEntradaCellValueChanged(params);
            return true;
          }
        }
        return false;
      },
    },
    {
      field: 'cantidadEntrada',
      headerName: 'Cantidad Entrada',
      width: 130,
      type: 'numericColumn',
      editable: true,
      valueFormatter: (p) => this.fmtEntero(p.value),
      onCellValueChanged: (event: any) => this.onEntradaCellValueChanged(event),
    },
    {
      field: 'bultos',
      headerName: 'Bultos',
      width: 85,
      type: 'numericColumn',
      editable: true,
      valueSetter: (params) => {
        const newVal = params.newValue;
        if (newVal === null || newVal === undefined || newVal === '') {
          params.data.bultos = 0;
        } else {
          const numVal = parseInt(String(newVal), 10);
          params.data.bultos = isNaN(numVal) ? (params.oldValue ?? 0) : numVal;
        }
        // Recalcular revisionConfigu: ceil(bultos × proporcionRevision)
        if (this.proporcionRevision !== null && this.proporcionRevision > 0) {
          params.data.revisionConfigu = Math.ceil(params.data.bultos * this.proporcionRevision);
        }
        this.onEntradaCellValueChanged(params);
        return true;
      },
      onCellValueChanged: (event: any) => this.onEntradaCellValueChanged(event),
    },
    {
      field: 'revisionConfigu',
      headerName: 'Revisión Configu.',
      width: 125,
      editable: false,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: {
        min: 0,
        max: 999999,
      },
      valueFormatter: (p) => {
        const val = p.value ?? 0;
        return String(Math.ceil(val));
      },
      valueSetter: (params) => {
        let newVal = params.newValue;
        if (newVal === null || newVal === undefined || newVal === '') {
          newVal = 0;
        } else {
          newVal = parseInt(String(newVal), 10);
          if (isNaN(newVal)) newVal = params.oldValue ?? 0;
        }
        params.data.revisionConfigu = newVal;
        this.onEntradaCellValueChanged(params);
        return true;
      },
      cellStyle: { backgroundColor: '#fff9c4' },
    },
    {
      field: 'carat',
      headerName: 'Características',
      width: 100,
      sortable: false,
      cellStyle: { backgroundColor: '#c8e6c9', textAlign: 'center' },
      cellRenderer: (params: any) => {
        const carat = params.data?.carat;
        const hasData = carat && typeof carat === 'string' && carat.trim().length > 0;

        const container = document.createElement('div');
        container.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;cursor:pointer;';

        if (hasData) {
          container.style.cssText += 'font-size:0.68rem;font-weight:600;color:#1b5e20;flex-wrap:wrap;gap:2px;';
          container.textContent = carat;
        } else {
          container.style.cssText += 'color:#2e7d32;font-weight:500;font-size:1.2rem;';
          container.textContent = '↓';
        }

        container.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          if (this.selectedEntradaCaratRow === params.data) {
            this.selectedEntradaCaratRow = null;
            this.cascadeCaratData = [];
            this.existingCaratIds.clear();
            this.hasUnsavedChangesCaracteristicas = false;
          } else {
            this.selectedEntradaCaratRow = params.data;
            this.hasUnsavedChangesCaracteristicas = false;
            this.existingCaratIds.clear();

            const idEntrada = params.data.idEntrada;
            let row: any = { idEntrada };
            const savedCategoryIds = new Set<number>();

            try {
              const existing = await lastValueFrom(this.caracteristicasService.getByEntrada(idEntrada));
              if (existing && existing.length > 0) {
                existing.forEach((item: any) => {
                  row[`cat_${item.idCategory}`] = item.familySelected;
                  this.existingCaratIds.set(item.idCategory, item.id);
                  savedCategoryIds.add(item.idCategory);
                });
              } else {
                row.__isNew = true;
              }
            } catch {
              row.__isNew = true;
            }

            // Reconstruir columnas incluyendo categorías inactivas con datos guardados
            this.buildNivel5ColumnDefs(savedCategoryIds);
            if (this.nivel5GridApi && !this.nivel5GridApi.isDestroyed()) {
              this.nivel5GridApi.setGridOption('columnDefs', this.nivel5ColDefs);
            }

            this.cascadeCaratData = [row];
            this.originalCaracteristicasData = JSON.parse(JSON.stringify(this.cascadeCaratData));
            if (this.nivel5GridApi && !this.nivel5GridApi.isDestroyed()) {
              this.nivel5GridApi.setGridOption('rowData', this.cascadeCaratData);
            }
          }
        });
        return container;
      },
    },
    {
      field: 'pago',
      headerName: 'Pago',
      width: 110,
      type: 'numericColumn',
      valueFormatter: (p) => this.fmtMoneda(p.value),
    },
    {
      field: 'pdfCount',
      headerName: '📤 PDF',
      width: 85,
      type: 'numericColumn',
      valueFormatter: (p) => `(${p.value ?? 0})`,
    },
    { field: 'usuario', headerName: 'Usuario', width: 100 },
    {
      field: 'liberacion',
      headerName: 'Liberación',
      width: 100,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
    },
  ];

  nivel4GridOptions: any = {
    components: {
      fechaEditor: FechaEditorComponent,
    },
    headerHeight: 25,
    rowHeight: 25,
    rowSelection: 'single',
    onSelectionChanged: (event: any) => {
      const selectedRows = event.api.getSelectedRows();
      this.selectedEntradaRow = selectedRows.length > 0 ? selectedRows[0] : null;
    },
    onCellValueChanged: () => {
      this.hasUnsavedChangesEntradas = true;
    },
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
    },
    defaultColDef: {
      resizable: true,
      sortable: true,
      textAlign: 'center',
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed = true;
          setTimeout(() => {
            if (this.nivel4GridApi) this.nivel4GridApi.stopEditing();
          }, 0);
          return true;
        }
        return false;
      },
    },
    onCellEditingStopped: (event: any) => this.onEntradaCellEditingStopped(event),
    tooltipShowDelay: 300,
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
  };

  // ── Nivel 5: Características ───────────────────────────────────────
  nivel5ColDefs: ColDef[] = [];

  nivel5GridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
    },
    onCellValueChanged: () => {
      this.hasUnsavedChangesCaracteristicas = true;
    },
    singleClickEdit: false,
    suppressClickEdit: false,
    defaultColDef: {
      resizable: true,
      sortable: true,
      textAlign: 'center',
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          setTimeout(() => {
            if (this.nivel5GridApi) this.nivel5GridApi.stopEditing();
          }, 0);
          return true;
        }
        return false;
      },
    },
    tooltipShowDelay: 300,
    onFirstDataRendered: (params: any) => params.api.autoSizeAllColumns(),
  };

  // ── Lifecycle ─────────────────────────────────────────────────────
  async agInit(params: any) { await this.init(params); }
  refresh(params: any): boolean { this.internalParams = params; return true; }

  private async init(params: any) {
    this.initCompleted = false;
    this.internalParams = params;
    this.detailType = params?.data?.detailType ?? 'entradas';
    this.bultosCantidad = params?.bultosCantidad ?? null;
    this.bultosCantidadARevisar = params?.bultosCantidadARevisar ?? null;
    this.proporcionRevision = params?.proporcionRevision ?? null;
    this.caracteristicasCategories = params?.caracteristicasCategories ?? [];
    this.caracteristicasFamilies = params?.caracteristicasFamilies ?? [];
    this.buildNivel5ColumnDefs();

    const departmentOptions = params?.departmentOptions ?? [];
    this.deptsCsv = departmentOptions
      .map((d: any) => d.id)
      .filter((id: any) => id)
      .join(',');

    // Si el padre ya sincronizó y pasó los datos, úsalos directamente sin HTTP
    const preloadedReqs = params?.preloadedReqs as any[] | undefined;
    const preloadedDetails = params?.preloadedDetails as any[] | undefined;

    if (preloadedReqs?.length && preloadedDetails !== undefined) {
      this.reqOptions = preloadedReqs;
      this.rowData = preloadedDetails.map((d: any) => {
        const req = this.reqOptions.find((r: any) => r.id === d.idRequisition);
        return {
          id: d.id,
          idRequisition: d.idRequisition ?? null,
          folio: req?.folio ?? '',
          cantidadReq: d.cantidadReq ?? 0,
          numCantidadOc: d.numCantidadOc ?? 0,
          cantidad: d.cantidad ?? 0,
          idCatalog: d.idCatalog ?? null,
        };
      });
      this.initCompleted = true;
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.updateParentCount();
      }
      return;
    }

    // Flujo normal (salidas o sin precarga)
    await this.loadReqOptions();
    this.initCompleted = true;
    if (this.gridApi && !this.gridApi.isDestroyed()) this.loadData();
  }

  private async loadReqOptions() {
    const idBranch = this.internalParams?.data?.sucursal;
    const idMaterial = this.internalParams?.data?.idMaterial;
    if (!idBranch || !idMaterial) { this.reqOptions = []; return; }
    try {
      this.reqOptions = await lastValueFrom(
        this.ocAndReqsService.getReqsByBranchMaterial(idBranch, idMaterial, this.deptsCsv)
      );
    } catch (err) {
      console.error('Error cargando requisiciones:', err);
      this.reqOptions = [];
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    if (this.initCompleted) {
      if (this.rowData.length) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.updateParentCount();
      } else {
        this.loadData();
      }
    }
  }

  onCascadeOcGridReady(params: GridReadyEvent) {
    this.cascadeOcGridApi = params.api;
    if (this.cascadeOcData.length)
      this.cascadeOcGridApi.setGridOption('rowData', this.cascadeOcData);
  }

  onNivel4GridReady(params: GridReadyEvent) {
    this.nivel4GridApi = params.api;
    if (this.cascadeEntradaData.length)
      this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);
  }

  onNivel5GridReady(params: GridReadyEvent) {
    this.nivel5GridApi = params.api;
    if (this.nivel5ColDefs.length > 0) {
      this.nivel5GridApi.setGridOption('columnDefs', this.nivel5ColDefs);
    }
    if (this.cascadeCaratData.length)
      this.nivel5GridApi.setGridOption('rowData', this.cascadeCaratData);
  }

  private buildNivel5ColumnDefs(savedCategoryIds: Set<number> = new Set()): void {
    const colDefs: ColDef[] = [
      {
        headerName: '#',
        width: 45,
        valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
        cellStyle: { fontWeight: 'bold' },
      },
    ];

    // Incluir categorías activas + categorías inactivas que ya tienen registro guardado
    if (Array.isArray(this.caracteristicasCategories) && this.caracteristicasCategories.length > 0) {
      this.caracteristicasCategories
        .filter((category: any) => {
          const id = category.id || category.originalId;
          const isActive = category.active && category.vigente !== false;
          return isActive || savedCategoryIds.has(id);
        })
        .forEach((category: any) => {
          const categoryId = category.id || category.originalId;
          const categoryName = category.description || `Categoría ${categoryId}`;

          // Familias activas (active=1 y vigente≠false) para este categoría
          const activeFamilies = this.caracteristicasFamilies
            .filter((family: any) => family.parentId === categoryId && family.active && family.vigente !== false)
            .map((family: any) => family.description);

          const fieldName = `cat_${categoryId}`;

          colDefs.push({
            field: fieldName,
            headerName: categoryName,
            flex: 1,
            minWidth: 150,
            editable: true,
            cellEditor: 'agRichSelectCellEditor',
            cellEditorParams: (params: any) => {
              const savedValue = params.data?.[fieldName];
              // Si hay un valor guardado que ya no está entre los activos, incluirlo igual
              const values = savedValue && !activeFamilies.includes(savedValue)
                ? [savedValue, ...activeFamilies]
                : activeFamilies;
              return { values, allowTyping: false };
            },
            cellEditorPopup: false,
            cellStyle: { backgroundColor: '#fff9c4' },
          });
        });
    }

    this.nivel5ColDefs = colDefs;
  }

  /** Click en columna OC: comprime otras filas y muestra nivel 4 (entradas). */
  async onCascadeOcCellClicked(event: any): Promise<void> {
    if (event.column?.getColId() !== 'folio') return;

    const row = event.data;
    if (!row?.folio) {
      this.clearOcSelection();
      return;
    }

    if (this.selectedOcRow === row) {
      this.clearOcSelection();
      return;
    }

    this.selectedOcRow = row;
    this.cascadeEntradaData = [];
    this.originalCascadeEntradaData = [];
    this.hasUnsavedChangesEntradas = false;
    this.selectedEntradaRow = null;

    if (this.cascadeOcGridApi && !this.cascadeOcGridApi.isDestroyed()) {
      this.cascadeOcGridApi.forEachNode((node: any) => {
        if (node.data === row) node.setRowHeight(undefined);
        else node.setRowHeight(0);
      });
      this.cascadeOcGridApi.onRowHeightChanged();
      this.cascadeOcGridApi.refreshCells({ force: true });
    }

    if (this.nivel4GridApi && !this.nivel4GridApi.isDestroyed())
      this.nivel4GridApi.setGridOption('rowData', []);

    try {
      const idMaterial = this.internalParams?.data?.idMaterial;
      const entradas = idMaterial
        ? await lastValueFrom(this.entradaService.getByOcAndMaterial(row.id, idMaterial))
        : await lastValueFrom(this.entradaService.getByOc(row.id));
      this.cascadeEntradaData = (Array.isArray(entradas) ? entradas : []).map((e: EntradaMolienda) => ({
        id: e.id,
        idEntrada: e.id,
        fechaRecepcion: e.fechaRecepcion ? new Date(e.fechaRecepcion) : null,
        cantidadEntrada: e.cantidadEntrada ?? 0,
        bultos: e.bultos ?? 0,
        revisionConfigu: e.revisionConfigu ?? 0,
        pago: e.pago ?? 0,
        pdfCount: 0,
        usuario: e.usuario ?? '',
        liberacion: e.liberacion ?? false,
        carat: '',
      }));

      // Cargar abreviaciones de características para cada entrada en paralelo
      const familyAbrevMap = new Map<string, string>();
      this.caracteristicasFamilies.forEach((f: any) =>
        familyAbrevMap.set(f.description, f.valueAddition2 ?? f.description)
      );

      await Promise.all(this.cascadeEntradaData.map(async (entradaRow: any) => {
        try {
          const carats = await lastValueFrom(this.caracteristicasService.getByEntrada(entradaRow.idEntrada));
          if (carats && carats.length > 0) {
            const parts = carats.map((c: any) => {
              const cat = this.caracteristicasCategories.find((x: any) => (x.id || x.originalId) === c.idCategory);
              const catAbrev = cat?.valueAddition2 || c.categoryName || '';
              const famAbrev = familyAbrevMap.get(c.familySelected) ?? c.familySelected ?? '';
              return `${catAbrev}-${famAbrev}`;
            });
            entradaRow.carat = parts.join(' / ');
          }
        } catch { /* sin características, carat queda vacío */ }
      }));

      this.originalCascadeEntradaData = JSON.parse(JSON.stringify(this.cascadeEntradaData));
      if (this.nivel4GridApi && !this.nivel4GridApi.isDestroyed())
        this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);
    } catch (err) {
      console.error('Error cargando entradas:', err);
    }
  }

  private clearOcSelection(): void {
    this.selectedOcRow = null;
    this.cascadeEntradaData = [];
    if (this.cascadeOcGridApi && !this.cascadeOcGridApi.isDestroyed()) {
      this.cascadeOcGridApi.forEachNode((node: any) => node.setRowHeight(undefined));
      this.cascadeOcGridApi.onRowHeightChanged();
      this.cascadeOcGridApi.refreshCells({ force: true });
    }
  }

  /** Datos demo nivel 4 — reemplazar por GET entradas por OC cuando exista backend. */
  private buildMockEntradasForOc(oc: any): any[] {
    const seed = String(oc?.folio ?? oc?.id ?? 'x');
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;

    const usuarios = ['Pedro', 'Juan', 'María'];
    const base = [
      { dias: 0, cant: 10000, bultos: 120, rev: 12, pago: 15000, u: 0, lib: true },
      { dias: 2, cant: 5000, bultos: 60, rev: 6, pago: 7500, u: 1, lib: true },
      { dias: 3, cant: 1000, bultos: 12, rev: 2, pago: 1500, u: 0, lib: false },
    ];

    const y = 2026;
    const m = 4;
    return base.map((b, idx) => {
      const day = 1 + ((h + idx * 7) % 28);
      const idEntrada = ((h >>> 0) % 9000) + idx + 1;
      return {
        idEntrada,
        fechaRecepcion: new Date(y, m, Math.min(day, 28)),
        cantidadEntrada: b.cant,
        bultos: b.bultos,
        revisionConfigu: b.rev,
        carat: true,
        pago: b.pago,
        pdfCount: 1,
        usuario: usuarios[b.u % usuarios.length],
        liberacion: b.lib,
      };
    });
  }

  private fmtFecha(v: any): string {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: '2-digit', year: '2-digit' });
  }

  private fmtEntero(v: any): string {
    if (v == null || v === '') return '';
    return Number(v).toLocaleString('es-MX');
  }

  private fmtMoneda(v: any): string {
    if (v == null || v === '') return '';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(v));
  }

  async loadData() {
    const idMolienda = this.internalParams?.data?.id;
    if (!idMolienda || typeof idMolienda === 'string') {
      this.rowData = [];
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', []);
      return;
    }

    try {
      const type = this.detailType === 'entradas' ? 'ENTRADA' : 'SALIDA';
      const items = await lastValueFrom(this.moliendaService.getDetails(idMolienda, type));
      this.rowData = (Array.isArray(items) ? items : []).map((d: any) => {
        const req = this.reqOptions.find(r => r.id === d.idRequisition);
        return {
          id: d.id,
          idRequisition: d.idRequisition ?? null,
          folio: req?.folio ?? '',
          cantidadReq: d.cantidadReq ?? 0,
          numCantidadOc: req?.numCantidadOc ?? 0,
          cantidad: d.cantidad ?? 0,
          idCatalog: d.idCatalog ?? null,
        };
      });
      if (this.gridApi && !this.gridApi.isDestroyed())
        this.gridApi.setGridOption('rowData', this.rowData);
      this.updateParentCount();
    } catch (error) {
      console.error('Error loading details molienda:', error);
    }
  }

  async onCellClicked(event: any) {
    if (event.column?.getColId() !== 'folio') return;

    const row = event.data;
    if (!row?.idRequisition) {
      this.selectedReqRow = null;
      this.cascadeOcData = [];
      this.clearOcSelection();
      if (this.gridApi) {
        this.gridApi.forEachNode((node: any) => node.setRowHeight(undefined));
        this.gridApi.onRowHeightChanged();
      }
      return;
    }

    if (this.selectedReqRow === row) {
      this.selectedReqRow = null;
      this.cascadeOcData = [];
      this.clearOcSelection();
      if (this.gridApi) {
        this.gridApi.forEachNode((node: any) => node.setRowHeight(undefined));
        this.gridApi.onRowHeightChanged();
        this.gridApi.refreshCells({ force: true });
      }
      return;
    }

    this.clearOcSelection();
    this.selectedReqRow = row;

    if (this.gridApi) {
      this.gridApi.forEachNode((node: any) => {
        if (node.data === row) {
          node.setRowHeight(undefined);
        } else {
          node.setRowHeight(0);
        }
      });
      this.gridApi.onRowHeightChanged();
    }

    try {
      const { lastValueFrom } = await import('rxjs');

      // Obtenemos todas las OCs de la requisición seleccionada con detalles y nombres de proveedores
      const matchedOcs: any = await lastValueFrom(
        this.ocAndReqsService.getOcsDetailsForRequisition(row.idRequisition)
      ).catch(() => []);

      this.cascadeOcData = Array.isArray(matchedOcs) ? matchedOcs : [];
    } catch (err) {
      console.error('Error cargando OCs:', err);
      this.cascadeOcData = [];
    }

    if (this.cascadeOcGridApi && !this.cascadeOcGridApi.isDestroyed())
      this.cascadeOcGridApi.setGridOption('rowData', this.cascadeOcData);
    if (this.gridApi) this.gridApi.refreshCells({ force: true });
  }

  private updateParentCount() {
    if (!this.internalParams?.node) return;
    const data = this.internalParams.node.data;
    const countField = this.detailType === 'entradas' ? 'entradas' : 'salidas';
    data[countField] = this.rowData.length;

    if (this.internalParams.api) {
      this.internalParams.api.refreshCells({
        rowNodes: [this.internalParams.node],
        columns: [countField],
        force: true,
      });
    }
  }

  // ── CRUD Methods para tabla Entradas (Nivel 4) ──

  addEntrada() {
    if (!this.nivel4GridApi) return;

    const usuarioLogueado = this.signalsService.getDisplayName()() || 'Usuario';

    const newRow = {
      idEntrada: null,
      fechaRecepcion: new Date(),
      cantidadEntrada: 0,
      bultos: 0,
      revisionConfigu: 0,
      carat: false,
      pago: 0,
      pdfCount: 0,
      usuario: usuarioLogueado,
      liberacion: false,
      __isNew: true,
    };

    this.cascadeEntradaData = [newRow, ...this.cascadeEntradaData];
    this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);
    this.hasUnsavedChangesEntradas = true;

    setTimeout(() => {
      this.nivel4GridApi.startEditingCell({ rowIndex: 0, colKey: 'fechaRecepcion' });
    }, 0);
  }

  async saveEntradas() {
    if (!this.hasUnsavedChangesEntradas || !this.selectedOcRow) return;

    const toSave = this.cascadeEntradaData.filter(r => r.__isNew || r.__modified);
    if (!toSave.length) { this.hasUnsavedChangesEntradas = false; return; }

    try {
      const idMaterial = this.internalParams?.data?.idMaterial;
      for (const row of toSave) {
        const payload: EntradaMolienda = {
          idOc: this.selectedOcRow.id,
          idMaterial: idMaterial ?? null,
          fechaRecepcion: row.fechaRecepcion instanceof Date
            ? row.fechaRecepcion.toISOString().split('T')[0]
            : (row.fechaRecepcion ?? null),
          cantidadEntrada: row.cantidadEntrada ?? 0,
          bultos: row.bultos ?? 0,
          revisionConfigu: row.revisionConfigu ?? 0,
          pago: row.pago ?? 0,
          usuario: row.usuario ?? '',
          liberacion: row.liberacion ?? false,
        };

        if (row.__isNew) {
          const created = await lastValueFrom(this.entradaService.create(payload));
          row.id = created.id;
          row.idEntrada = created.id;
          row.__isNew = false;
        } else {
          await lastValueFrom(this.entradaService.update(row.id, payload));
          row.__modified = false;
        }
      }

      this.hasUnsavedChangesEntradas = false;
      this.originalCascadeEntradaData = JSON.parse(JSON.stringify(this.cascadeEntradaData));
      if (this.nivel4GridApi) this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);
      await alerts.basicAlert('Éxito', 'Cambios guardados.', 'success');
    } catch (err) {
      console.error('Error guardando entradas:', err);
      await alerts.basicAlert('Error', 'No se pudieron guardar los cambios.', 'error');
    }
  }

  revertEntradas() {
    this.cascadeEntradaData = JSON.parse(JSON.stringify(this.originalCascadeEntradaData));
    this.hasUnsavedChangesEntradas = false;
    this.selectedEntradaRow = null;
    if (this.nivel4GridApi) {
      this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);
    }
  }

  async deleteEntrada() {
    if (!this.selectedEntradaRow) {
      await alerts.basicAlert('Eliminar', 'Seleccione una fila.', 'warning');
      return;
    }

    const r = await alerts.confirmAlert(
      'Confirmar eliminación',
      `¿Eliminar esta entrada?`,
      'warning',
      'Sí, eliminar'
    );
    if (!r.isConfirmed) return;

    try {
      if (this.selectedEntradaRow.__isNew) {
        this.cascadeEntradaData = this.cascadeEntradaData.filter(row => row !== this.selectedEntradaRow);
      } else {
        await lastValueFrom(this.entradaService.delete(this.selectedEntradaRow.id));
        this.cascadeEntradaData = this.cascadeEntradaData.filter(row => row !== this.selectedEntradaRow);
        this.originalCascadeEntradaData = JSON.parse(JSON.stringify(this.cascadeEntradaData));
      }

      this.selectedEntradaRow = null;
      if (this.nivel4GridApi) this.nivel4GridApi.setGridOption('rowData', this.cascadeEntradaData);
      await alerts.basicAlert('Éxito', 'Entrada eliminada.', 'success');
    } catch (err) {
      console.error('Error eliminando entrada:', err);
      await alerts.basicAlert('Error', 'No se pudo eliminar la entrada.', 'error');
    }
  }

  private onEntradaCellValueChanged(event: any) {
    const row = event.data;
    if (!row.__isNew) {
      row.__modified = true;
    }
    this.hasUnsavedChangesEntradas = true;
  }

  private onEntradaCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;

    const currentColKey = event.colDef.field;
    const currentRowIndex = event.rowIndex;
    const currentColIndex = this.editableEntradaColumnOrder.indexOf(currentColKey);

    if (currentColIndex === -1) return;

    let nextRowIndex = currentRowIndex;
    let nextColIndex = currentColIndex + 1;

    if (nextColIndex >= this.editableEntradaColumnOrder.length) {
      nextRowIndex++;
      nextColIndex = 0;
    }

    if (nextRowIndex >= this.cascadeEntradaData.length) {
      return;
    }

    const nextColKey = this.editableEntradaColumnOrder[nextColIndex];

    setTimeout(() => {
      if (this.nivel4GridApi) {
        this.nivel4GridApi.startEditingCell({
          rowIndex: nextRowIndex,
          colKey: nextColKey,
        });
      }
    }, 0);
  }

  async saveCaracteristicas() {
    if (!this.hasUnsavedChangesCaracteristicas || this.cascadeCaratData.length === 0) {
      return;
    }

    try {
      const row = this.cascadeCaratData[0];
      const savePromises: any[] = [];
      const abrevParts: string[] = [];

      // Mapa de nombre de familia → abreviatura para búsqueda rápida
      const familyAbrevMap = new Map<string, string>();
      this.caracteristicasFamilies.forEach((f: any) => {
        familyAbrevMap.set(f.description, f.valueAddition2 ?? f.description);
      });

      // Guardar una característica por cada categoría y construir el string de abreviaturas
      this.caracteristicasCategories.forEach((category: any) => {
        const categoryId = category.id || category.originalId;
        const categoryName = category.description || '';
        const categoryAbrev = category.valueAddition2 || categoryName;
        const fieldName = `cat_${categoryId}`;
        const familySelected = row[fieldName] ?? null;

        if (familySelected) {
          const familyAbrev = familyAbrevMap.get(familySelected) ?? familySelected;
          abrevParts.push(`${categoryAbrev}-${familyAbrev}`);

          const payload = {
            idEntrada: row.idEntrada,
            idCategory: categoryId,
            categoryName: categoryName,
            familySelected: familySelected,
            active: true,
          };

          const existingId = this.existingCaratIds.get(categoryId);
          if (existingId) {
            savePromises.push(lastValueFrom(this.caracteristicasService.update(existingId, payload)));
          } else if (this.existingCaratIds.size === 0) {
            // Solo crear si no hay ningún registro previo para esta entrada
            savePromises.push(
              lastValueFrom(this.caracteristicasService.create(payload)).then((created: any) => {
                if (created?.id) this.existingCaratIds.set(categoryId, created.id);
              })
            );
          }
        }
      });

      if (savePromises.length > 0) {
        await Promise.all(savePromises);
      }

      // Actualizar el campo carat de la fila en Level 4 con las abreviaturas
      const caratString = abrevParts.join(' / ');
      if (this.selectedEntradaCaratRow && caratString) {
        this.selectedEntradaCaratRow.carat = caratString;
        if (this.nivel4GridApi && !this.nivel4GridApi.isDestroyed()) {
          this.nivel4GridApi.refreshCells({ columns: ['carat'], force: true });
        }
      }

      this.hasUnsavedChangesCaracteristicas = false;
      this.originalCaracteristicasData = JSON.parse(JSON.stringify(this.cascadeCaratData));
      await alerts.basicAlert('Éxito', 'Características guardadas.', 'success');
    } catch (err) {
      console.error('Error guardando características:', err);
      await alerts.basicAlert('Error', 'No se pudieron guardar las características.', 'error');
    }
  }
}
