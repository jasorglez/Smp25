import { Component, OnInit, OnChanges, SimpleChanges, Input, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { ProductionService } from 'app/services/production.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-liberacion-jarabe',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div style="padding: 5px; background-color: #e8f5e9; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
      <div style="margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
        <strong style="color: #2e7d32;">🔓 Liberación de Jarabe</strong>
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
          (selectionChanged)="onSelectionChanged($event)"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; margin: 0; padding: 0; overflow: hidden; }
  `]
})
export class LiberacionJarabeComponent implements OnInit, OnChanges {
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
  /** Personal de Calidad cargado desde fuera (pasado por params) */
  personalCalidad: string[] = [];

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    setTimeout(() => {
      if (!this.dataLoaded && this.internalParams && this.gridApi) {
        this.loadData();
      }
    }, 200);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['params'] && this.params) {
      this.internalParams = this.params;
      this.personalCalidad = this.params?.context?.componentParent?.personalCalidad ?? [];
      if (this.gridApi) {
        this.dataLoaded = false;
        this.loadData();
      }
    }
  }

  agInit(params: any): void {
    this.params = params;
    this.internalParams = params;
    this.personalCalidad = params?.context?.componentParent?.personalCalidad ?? [];
    if (this.gridApi) this.loadData();
  
    this.cdr.detectChanges();}

  public gridOptions: any = {
    rowSelection: 'single',
    headerHeight: 32,
    rowHeight: 32,
    animateRows: true,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew }
  };

  colDefs: ColDef[] = [
    {
      field: 'liberado',
      headerName: 'Liberado',
      width: 100,
      editable: false,
      cellRenderer: (params: any) => {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = params.value === true;
        input.style.cursor = 'pointer';
        input.addEventListener('change', () => {
          params.data.liberado = input.checked;
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          this.autoSave(params.data);
        });
        return input;
      },
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' }
    },
    {
      field: 'nombreLibera',
      headerName: 'Nombre quien libera',
      flex: 1,
      minWidth: 180,
      editable: true,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorPopup: true,
      cellEditorParams: () => ({
        values: this.personalCalidad,
        valueListGap: 0,
        valueListMaxHeight: 200,
      }),
      valueSetter: (p: any) => {
        p.data.nombreLibera = p.newValue ?? '';
        p.data.__modified = true;
        this.hasUnsavedChanges = true;
        return true;
      }
    },
    {
      field: 'comentarios',
      headerName: 'Comentarios',
      flex: 2,
      minWidth: 200,
      editable: true,
      cellEditor: 'agLargeTextCellEditor',
      cellEditorPopup: true,
      valueSetter: (p: any) => {
        p.data.comentarios = p.newValue ?? '';
        p.data.__modified = true;
        this.hasUnsavedChanges = true;
        // Sincronización bidireccional con N1 comentarios
        const master = this.internalParams?.context?.componentParent;
        if (master) master.syncComentarios(p.data.comentarios, 'liberacion');
        return true;
      }
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
    try {
      const data = await lastValueFrom(this.productionService.getLiberacion(idPreparacion));
      this.rowData = (Array.isArray(data) ? data : []).map((d: any) => this.mapItem(d));
      this.originalRowData = this.rowData.map(r => ({ ...r }));
      this.gridApi?.setGridOption('rowData', this.rowData);
    } catch {
      this.rowData = [];
    }
  
    this.cdr.detectChanges();}

  private mapItem(d: any): any {
    return {
      id: d.id,
      idPreparacion: d.idPreparacion,
      liberado: d.liberado ?? false,
      nombreLibera: d.nombreLibera ?? '',
      comentarios: d.comentarios ?? '',
      __isNew: false,
      __modified: false
    };
  }

  addItem() {
    const idPreparacion = this.internalParams?.data?.id;
    if (!idPreparacion) { alerts.basicAlert('Aviso', 'Guarda el registro principal antes de agregar liberaciones.', 'warning'); return; }
    const newItem = {
      id: `temp_${++this.tempIdCounter}`,
      idPreparacion,
      liberado: false,
      nombreLibera: '',
      comentarios: '',
      __isNew: true,
      __modified: false
    };
    this.rowData = [newItem, ...this.rowData];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);
  }

  async autoSave(item: any) {
    if (item.__isNew) return;
    try {
      await lastValueFrom(this.productionService.updateLiberacion(item.id, {
        idPreparacion: item.idPreparacion,
        liberado: item.liberado,
        nombreLibera: item.nombreLibera,
        comentarios: item.comentarios,
        active: true
      }));
    } catch { /* silently fail, user can retry */ }
  
    this.cdr.detectChanges();}

  async saveAll() {
    const newItems = this.rowData.filter(r => r.__isNew);
    const modified = this.rowData.filter(r => r.__modified && !r.__isNew);
    try {
      for (const item of newItems) {
        const created = await lastValueFrom(this.productionService.createLiberacion({
          idPreparacion: item.idPreparacion, liberado: item.liberado,
          nombreLibera: item.nombreLibera, comentarios: item.comentarios, active: true
        }));
        item.id = created.id;
        item.__isNew = false;
        item.__modified = false;
      }
      for (const item of modified) {
        await lastValueFrom(this.productionService.updateLiberacion(item.id, {
          idPreparacion: item.idPreparacion, liberado: item.liberado,
          nombreLibera: item.nombreLibera, comentarios: item.comentarios, active: true
        }));
        item.__modified = false;
      }
      this.hasUnsavedChanges = false;
      this.gridApi.redrawRows();
    } catch { alerts.basicAlert('Error', 'Error al guardar liberación.', 'error'); }
  
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
    const confirm = await alerts.confirmAlert('¿Eliminar?', '¿Eliminar este registro de liberación?', 'warning', 'Sí, eliminar');
    if (!confirm.isConfirmed) return;
    try {
      await lastValueFrom(this.productionService.deleteLiberacion(item.id));
      this.rowData = this.rowData.filter(r => r.id !== item.id);
      this.gridApi.setGridOption('rowData', this.rowData);
    } catch { alerts.basicAlert('Error', 'Error al eliminar.', 'error'); }
  
    this.cdr.detectChanges();}

  discardChanges() { this.loadData(); this.hasUnsavedChanges = false; }
  onCellValueChanged(e: any) { e.data.__modified = true; this.hasUnsavedChanges = true; }
  onSelectionChanged(e: any) { this.hasRowSelected = e.api.getSelectedNodes().length > 0; }
}
