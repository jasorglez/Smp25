import { Component, OnInit, OnChanges, SimpleChanges, Input, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { ProductionService } from 'app/services/production.service';
import { PartesLimpiezaComponent } from './partes-limpieza.component';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-limpieza-jarabe',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, PartesLimpiezaComponent],
  template: `
    <div style="padding: 5px; background-color: #e3f2fd; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
      <div style="margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
        <strong style="color: #1565c0;">🧹 Limpieza</strong>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-success" (click)="addItem()" title="Agregar">
            <i class="bi bi-plus-lg"></i> Agregar
          </button>
          <button class="btn btn-sm btn-warning" (click)="discardChanges()" title="Deshacer">
            <i class="bi bi-arrow-counterclockwise"></i> Deshacer
          </button>
          <button class="btn btn-sm btn-danger" (click)="deleteSelectedItem()" [disabled]="!hasRowSelected" title="Eliminar">
            <i class="bi bi-trash"></i> Eliminar
          </button>
          <button class="btn btn-sm btn-primary position-relative" (click)="saveAll()" [disabled]="!hasUnsavedChanges" title="Guardar">
            <i class="bi bi-floppy"></i> Guardar
            <span class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle"
              *ngIf="hasUnsavedChanges">
            </span>
          </button>
        </div>
      </div>

      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
          #agGrid
          class="ag-theme-quartz small-text-ag-grid"
          [rowData]="rowData"
          [columnDefs]="colDefs"
          [gridOptions]="gridOptions"
          [localeText]="AG_GRID_LOCALE_ES"
          (gridReady)="onGridReady($event)"
          (cellValueChanged)="onCellValueChanged($event)"
          (cellClicked)="onCellClicked($event)"
          (selectionChanged)="onSelectionChanged($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>

      <!-- Modal Observaciones de Limpieza -->
      <div *ngIf="showObsModal" class="modal-backdrop-obs" (click)="closeObsModal()">
        <div class="modal-obs" (click)="$event.stopPropagation()">
          <div class="modal-obs-header">
            <h6 class="mb-0">📝 Observaciones de Limpieza</h6>
            <button class="btn-close btn-close-white" (click)="closeObsModal()"></button>
          </div>
          <div class="modal-obs-body">
            <textarea
              class="form-control"
              rows="10"
              [(ngModel)]="obsModalValue"
              placeholder="Escriba las observaciones de limpieza aquí...">
            </textarea>
          </div>
          <div class="modal-obs-footer">
            <button class="btn btn-secondary btn-sm" (click)="closeObsModal()">Cancelar</button>
            <button class="btn btn-primary btn-sm" (click)="saveObsModal()">
              <i class="bi bi-floppy"></i> Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; margin: 0; padding: 0; overflow: hidden; position: relative; }
    .modal-backdrop-obs {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); z-index: 9999;
      display: flex; align-items: center; justify-content: center;
    }
    .modal-obs {
      background: #fff; border-radius: 8px; width: 600px; max-width: 90vw;
      display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    .modal-obs-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; background: #1565c0; color: white; border-radius: 8px 8px 0 0;
    }
    .modal-obs-body { padding: 16px; }
    .modal-obs-body textarea { resize: vertical; min-height: 200px; font-size: 0.875rem; }
    .modal-obs-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 12px 16px; border-top: 1px solid #dee2e6;
    }
  `]
})
export class LimpiezaJarabeComponent implements OnInit, OnChanges {
  private productionService = inject(ProductionService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() params: any;
  private internalParams: any;
  private gridApi!: GridApi;
  private dataLoaded = false;

  rowData: any[] = [];
  originalRowData: any[] = [];
  hasUnsavedChanges = false;
  hasRowSelected = false;
  tempIdCounter = 0;
  personalPrep1: string[] = [];

  // Modal
  showObsModal = false;
  obsModalValue = '';
  private obsModalRow: any = null;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    setTimeout(() => {
      if (!this.dataLoaded && this.internalParams && this.gridApi) this.loadData();
    }, 200);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['params'] && this.params) {
      this.internalParams = this.params;
      this.personalPrep1 = this.params?.context?.componentParent?.personalPrep1 ?? [];
      if (this.gridApi) { this.dataLoaded = false; this.loadData(); }
    }
  }

  agInit(params: any): void {
    this.params = params;
    this.internalParams = params;
    this.personalPrep1 = params?.context?.componentParent?.personalPrep1 ?? [];
    if (this.gridApi) this.loadData();
  
    this.cdr.detectChanges();}

  expandedPartesRowId: string | null = null;

  public gridOptions: any = {
    rowSelection: 'single',
    headerHeight: 32,
    rowHeight: 32,
    animateRows: true,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    masterDetail: true,
    detailRowHeight: 180,
    isRowMaster: () => true,
    detailCellRenderer: PartesLimpiezaComponent,
  };

  colDefs: ColDef[] = [
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 130,
      editable: true,
      cellDataType: 'date',
      cellEditor: 'agDateCellEditor',
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        const d = p.value instanceof Date ? p.value : new Date(p.value);
        if (isNaN(d.getTime())) return '';
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      },
      valueSetter: (p: any) => {
        p.data.fecha = p.newValue instanceof Date ? p.newValue : (p.newValue ? new Date(p.newValue) : null);
        p.data.__modified = true; this.hasUnsavedChanges = true; return true;
      }
    },
    {
      field: 'partesCount',
      headerName: 'Actividades',
      width: 120,
      editable: false,
      cellRenderer: (p: any) => {
        const count = p.value || 0;
        const isNew = !!p.data?.__isNew;
        const container = document.createElement('div');
        container.style.cssText = isNew
          ? 'display:flex;align-items:center;gap:6px;cursor:not-allowed;color:#aaa;'
          : 'display:flex;align-items:center;gap:6px;cursor:pointer;color:#c62828;text-decoration:underline;';
        container.innerHTML = `<i class="bi bi-puzzle"></i><span>${count} parte(s)</span>`;
        if (!isNew) container.addEventListener('click', () => this.togglePartesCascade(p.node));
        return container;
      },
      cellStyle: { backgroundColor: '#fce4ec', cursor: 'pointer' }
    },
    {
      field: 'realizo',
      headerName: 'Realizó',
      flex: 1,
      minWidth: 160,
      editable: true,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorPopup: true,
      cellEditorParams: () => ({ values: this.personalPrep1, valueListGap: 0, valueListMaxHeight: 200 }),
      valueSetter: (p: any) => {
        p.data.realizo = p.newValue ?? ''; p.data.__modified = true; this.hasUnsavedChanges = true; return true;
      }
    },
    {
      field: 'verifico',
      headerName: 'Verificó',
      flex: 1,
      minWidth: 160,
      editable: true,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorPopup: true,
      cellEditorParams: () => ({ values: this.personalPrep1, valueListGap: 0, valueListMaxHeight: 200 }),
      valueSetter: (p: any) => {
        p.data.verifico = p.newValue ?? ''; p.data.__modified = true; this.hasUnsavedChanges = true; return true;
      }
    },
    {
      field: 'observaciones',
      headerName: 'Observaciones',
      flex: 2,
      minWidth: 180,
      editable: false,
      cellRenderer: (p: any) => {
        const val = p.value ?? '';
        const truncated = val.length > 40 ? val.substring(0, 40) + '...' : val;
        const span = document.createElement('span');
        span.style.cssText = 'cursor: pointer; color: #1565c0; text-decoration: underline;';
        span.textContent = truncated || '(click para agregar)';
        span.title = 'Clic para abrir modal de observaciones';
        span.addEventListener('click', () => this.openObsModal(p.data));
        return span;
      },
      cellStyle: { cursor: 'pointer' }
    }
  ];

  onGridReady(event: GridReadyEvent) {
    this.gridApi = event.api;
    if (this.internalParams) this.loadData();
  }

  async loadData() {
    const idPreparacion = this.internalParams?.data?.id;
    if (!idPreparacion) return;
    this.dataLoaded = true;
    this.rowData = [
      { id: 1, idPreparacion, fecha: new Date('2026-05-10'), partesCount: 3, realizo: 'JUAN PÉREZ',   verifico: 'MARÍA LÓPEZ',  observaciones: 'Limpieza completa del área de jarabe', __isNew: false, __modified: false },
      { id: 2, idPreparacion, fecha: new Date('2026-05-17'), partesCount: 2, realizo: 'CARLOS RUIZ',  verifico: 'ANA MARTÍNEZ', observaciones: 'Limpieza rutinaria semanal',           __isNew: false, __modified: false },
      { id: 3, idPreparacion, fecha: new Date('2026-05-24'), partesCount: 4, realizo: 'PEDRO GÓMEZ',  verifico: 'JUAN PÉREZ',   observaciones: '',                                     __isNew: false, __modified: false },
    ];
    this.originalRowData = this.rowData.map(r => ({ ...r }));
    this.gridApi?.setGridOption('rowData', this.rowData);
  }

  private mapItem(d: any): any {
    return {
      id: d.id, idPreparacion: d.idPreparacion,
      fecha: d.fecha ? new Date(d.fecha) : null,
      partesCount: d.partesCount ?? 0,
      realizo: d.realizo ?? '', verifico: d.verifico ?? '',
      observaciones: d.observaciones ?? '',
      __isNew: false, __modified: false
    };
  }

  togglePartesCascade(node: any) {
    if (this.expandedPartesRowId === node.id) {
      node.setExpanded(false);
      this.expandedPartesRowId = null;
    } else {
      if (this.expandedPartesRowId) {
        this.gridApi.forEachNode((n: any) => {
          if (n.id === this.expandedPartesRowId) n.setExpanded(false);
        });
      }
      this.expandedPartesRowId = node.id;
      setTimeout(() => node.setExpanded(true), 0);
    }
  }

  addItem() {
    const idPreparacion = this.internalParams?.data?.id;
    if (!idPreparacion) { alerts.basicAlert('Aviso', 'Guarda el registro principal antes de agregar limpieza.', 'warning'); return; }
    const newItem = {
      id: `temp_${++this.tempIdCounter}`, idPreparacion,
      fecha: new Date(), partesCount: 0, realizo: '', verifico: '', observaciones: '',
      __isNew: true, __modified: false
    };
    this.rowData = [newItem, ...this.rowData];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);
  }

  async saveAll() {
    const newItems = this.rowData.filter(r => r.__isNew);
    const modified = this.rowData.filter(r => r.__modified && !r.__isNew);
    const toIso = (d: Date | null) => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : null;
    try {
      for (const item of newItems) {
        const created = await lastValueFrom(this.productionService.createLimpieza({
          idPreparacion: item.idPreparacion, fecha: toIso(item.fecha),
          realizo: item.realizo, verifico: item.verifico, observaciones: item.observaciones, active: true
        }));
        item.id = created.id; item.__isNew = false; item.__modified = false;
      }
      for (const item of modified) {
        await lastValueFrom(this.productionService.updateLimpieza(item.id, {
          idPreparacion: item.idPreparacion, fecha: toIso(item.fecha),
          realizo: item.realizo, verifico: item.verifico, observaciones: item.observaciones, active: true
        }));
        item.__modified = false;
      }
      this.hasUnsavedChanges = false;
      this.gridApi.redrawRows();
    } catch { alerts.basicAlert('Error', 'Error al guardar limpieza.', 'error'); }
  
    this.cdr.detectChanges();}

  async deleteSelectedItem() {
    const selected = this.gridApi.getSelectedNodes();
    if (!selected.length) return;
    const item = selected[0].data;
    if (item.__isNew) {
      this.rowData = this.rowData.filter(r => r.id !== item.id);
      this.gridApi.setGridOption('rowData', this.rowData);
      return;
    }
    const confirm = await alerts.confirmAlert('¿Eliminar?', '¿Eliminar este registro de limpieza?', 'warning', 'Sí, eliminar');
    if (!confirm.isConfirmed) return;
    try {
      await lastValueFrom(this.productionService.deleteLimpieza(item.id));
      this.rowData = this.rowData.filter(r => r.id !== item.id);
      this.gridApi.setGridOption('rowData', this.rowData);
    } catch { alerts.basicAlert('Error', 'Error al eliminar.', 'error'); }
  
    this.cdr.detectChanges();}

  openObsModal(row: any) {
    this.obsModalRow = row;
    this.obsModalValue = row.observaciones ?? '';
    this.showObsModal = true;
  }

  saveObsModal() {
    if (this.obsModalRow) {
      this.obsModalRow.observaciones = this.obsModalValue;
      this.obsModalRow.__modified = true;
      this.hasUnsavedChanges = true;
      this.gridApi.refreshCells({ rowNodes: [this.gridApi.getRowNode(this.obsModalRow.id)!], columns: ['observaciones'], force: true });
    }
    this.showObsModal = false;
    this.obsModalRow = null;
  }

  closeObsModal() { this.showObsModal = false; this.obsModalRow = null; }

  discardChanges() { this.loadData(); this.hasUnsavedChanges = false; }
  onCellValueChanged(e: any) { e.data.__modified = true; this.hasUnsavedChanges = true; }
  onCellClicked(e: any) { e.node.setSelected(true); }
  onSelectionChanged(e: any) { this.hasRowSelected = e.api.getSelectedNodes().length > 0; }
}
