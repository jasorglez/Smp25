import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { GeneratorsService } from 'app/services/generators.service';
import { DailyReportService } from 'app/services/daily-report.service';
import { lastValueFrom } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import Swal from 'sweetalert2';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-generator-detail-renderer',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <div style="padding: 12px; background: #f0f4ff; border-left: 4px solid #3f51b5;
                height: 100%; box-sizing: border-box; overflow-y: auto;">

      <!-- ── Barra de botones CRUD ──────────────────────────────────────── -->
      <div class="d-flex align-items-center gap-2 mb-2 flex-wrap"
           (mousedown)="stopEvent($event)" (click)="stopEvent($event)">

        <button class="btn btn-sm btn-success" (click)="addRow($event)" title="Agregar ítem">
          <i class="bi bi-plus-lg"></i> Agregar
        </button>

        <button class="btn btn-sm btn-primary position-relative" (click)="saveChanges($event)" title="Guardar">
          <i class="bi bi-floppy"></i> Guardar
          <span *ngIf="hasChanges"
                class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle">
          </span>
        </button>

        <button class="btn btn-sm btn-warning" (click)="revertChanges($event)" title="Deshacer">
          <i class="bi bi-arrow-clockwise"></i> Deshacer
        </button>

        <button class="btn btn-sm btn-danger" (click)="deleteRow($event)"
                [disabled]="!selectedRow" title="Eliminar ítem seleccionado">
          <i class="bi bi-trash"></i> Eliminar
        </button>

        <span class="badge bg-primary ms-2">
          <i class="bi bi-folder2 me-1"></i>{{ generator?.numero }}
        </span>
        <span class="badge bg-light text-dark border">{{ rowData.length }} ítem(s)</span>
      </div>

      <!-- ── Grid de ítems ──────────────────────────────────────────────── -->
      <ag-grid-angular
        style="width: 100%; height: 280px;"
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [gridOptions]="gridOpts"
        rowSelection="single"
        [stopEditingWhenCellsLoseFocus]="true"
        (gridReady)="onGridReady($event)"
        (rowClicked)="onRowSelected($event)"
        (cellValueChanged)="onCellValueChanged($event)">
      </ag-grid-angular>
    </div>
  `,
})
export class GeneratorDetailRendererComponent implements ICellRendererAngularComp {
  private trackingService = inject(TrackingService);

  private generatorsSvc  = inject(GeneratorsService);
  private dailyReportSvc = inject(DailyReportService);

  gridApi!: GridApi;
  generator:         any    = null;
  activitiesOptions: any[]  = [];
  rowData:           any[]  = [];
  selectedRow:       any    = null;
  hasChanges:        boolean = false;
  private tempCtr = 0;

  // ── Enter-key navigation ────────────────────────────────────────────────
  private editableOrder = ['idResource', 'quantity', 'comment'];
  private enterPressed  = false;

  defaultColDef: ColDef = {
    sortable: true, resizable: true, minWidth: 80,
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
        return true;
      }
      return false;
    },
  };

  gridOpts: any = {
    headerHeight: 28,
    rowHeight: 26,
    animateRows: true,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
  };

  get colDefs(): ColDef[] {
    return [
      {
        field: 'idResource', headerName: 'Recurso', flex: 2, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.activitiesOptions.map(a => a.id) }),
        valueFormatter: (p) =>
          this.activitiesOptions.find(a => a.id === p.value)?.actandNom ?? (p.value ?? ''),
        tooltipValueGetter: (p) =>
          this.activitiesOptions.find(a => a.id === p.value)?.actandNom ?? '',
      },
      {
        field: 'quantity', headerName: 'Cantidad', width: 110, editable: true,
        type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(3) : '',
      },
      {
        field: 'accumulate', headerName: 'Acumulado', width: 120, editable: false,
        type: 'numericColumn',
        valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(3) : '',
        cellStyle: { color: '#555', backgroundColor: '#f5f5f5' },
      },
      { field: 'comment', headerName: 'Comentarios', flex: 1, editable: true },
    ];
  }

  // ── ICellRendererAngularComp ────────────────────────────────────────────

  agInit(params: ICellRendererParams): void {
    this.generator         = params.data;
    this.activitiesOptions = (params as any).context?.activitiesOptions ?? [];
    this.loadItems();
  }

  refresh(_params: ICellRendererParams): boolean { return false; }

  // ── Grid events ─────────────────────────────────────────────────────────

  onGridReady(params: GridReadyEvent) { this.gridApi = params.api; }

  onRowSelected(event: any) { this.selectedRow = event.data; }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasChanges = true;

    if (event.colDef.field === 'idResource') {
      this.calculateAccumulate(event);
    }

    // Enter-key navigation
    if (this.enterPressed) {
      this.enterPressed = false;
      const idx = this.editableOrder.indexOf(event.column.getColId());
      if (idx !== -1 && idx < this.editableOrder.length - 1) {
        setTimeout(() => {
          this.gridApi.startEditingCell({
            rowIndex: event.rowIndex,
            colKey: this.editableOrder[idx + 1],
          });
        }, 100);
      }
    }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────

  loadItems() {
    const id = this.generator?.id;
    if (!id || String(id).startsWith('temp_')) { this.rowData = []; return; }
    this.generatorsSvc.getItemsGeneradores(id).subscribe({
      next: (items) => { this.rowData = [...items]; },
      error: ()     => { this.rowData = []; },
    });
  }

  addRow(event?: Event) {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo generator detail renderer', 'Proyectos', this.trackingService.getEmail());
    event?.stopPropagation();
    const tempId = `temp_${this.tempCtr++}`;
    const newItem = {
      id: tempId, idType: this.generator?.id, idResource: null,
      quantity: 0, accumulate: 0, type: 'GENERADOR',
      comment: '', active: true, __isNew: true,
    };
    this.rowData = [...this.rowData, newItem];
    this.hasChanges = true;
    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.startEditingCell({
          rowIndex: this.rowData.length - 1,
          colKey: 'idResource',
        });
      }
    }, 60);
  }

  async deleteRow(event?: Event) {
    event?.stopPropagation();
    if (!this.selectedRow) return;

    const res = await Swal.fire({
      title: '¿Eliminar ítem?',
      text: this.activitiesOptions.find(a => a.id === this.selectedRow.idResource)?.actandNom ?? 'Ítem seleccionado',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!res.isConfirmed) return;

    const id = this.selectedRow.id;
    if (String(id).startsWith('temp_')) {
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
    } else {
      try {
        await lastValueFrom(this.generatorsSvc.deleteItemGenerador(id));
        this.rowData = this.rowData.filter(r => r !== this.selectedRow);
        alerts.basicAlert('Eliminado', 'Ítem eliminado correctamente.', 'success');
      } catch {
        alerts.basicAlert('Error', 'No se pudo eliminar el ítem.', 'error');
        return;
      }
    }
    this.selectedRow = null;
    this.hasChanges = this.rowData.some(r => r.__isNew || r.__modified);
    if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
  }

  async saveChanges(event?: Event) {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en generator detail renderer', 'Proyectos', this.trackingService.getEmail());
    event?.stopPropagation();
    if (!this.hasChanges) return;

    const newItems = this.rowData.filter(i => i.__isNew);
    const modItems = this.rowData.filter(i => i.__modified && !i.__isNew);

    try {
      for (const item of newItems) {
        const payload = this.cleanItem(item);
        const res: any = await lastValueFrom(this.generatorsSvc.addItemGenerador(payload));
        if (res?.id) { item.id = res.id; }
        item.__isNew = false;
      }
      for (const item of modItems) {
        await lastValueFrom(this.generatorsSvc.updateItemGenerador(item.id, this.cleanItem(item)));
        item.__modified = false;
      }
      this.hasChanges = false;
      alerts.basicAlert('Guardado', 'Ítems guardados correctamente.', 'success');
      this.loadItems();
    } catch {
      alerts.basicAlert('Error', 'Ocurrió un error al guardar los ítems.', 'error');
    }
  }

  revertChanges(event?: Event) {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Deshizo cambios en generator detail renderer', 'Proyectos', this.trackingService.getEmail());
    event?.stopPropagation();
    this.loadItems();
    this.hasChanges = false;
    this.selectedRow = null;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  stopEvent(e: Event) { e.stopPropagation(); }

  private cleanItem(item: any) {
    return {
      idType:      item.idType ?? this.generator?.id,
      idResource:  item.idResource,
      quantity:    Number(item.quantity)   || 0,
      accumulate:  Number(item.accumulate) || 0,
      type:        item.type ?? 'GENERADOR',
      comment:     item.comment ?? '',
      active:      item.active  ?? true,
    };
  }

  private calculateAccumulate(event: any) {
    const start = this.formatDate(this.generator?.dateStart);
    const end   = this.formatDate(this.generator?.dateEnd);
    if (!start || !end || !event.newValue) return;

    this.dailyReportSvc.SumaReporte(event.newValue, start, end).subscribe({
      next: (result: any) => {
        event.data.accumulate = result?.Total ?? 0;
        if (this.gridApi) {
          this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['accumulate'] });
        }
      },
      error: () => { event.data.accumulate = 0; },
    });
  }

  private formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    } catch { return ''; }
  }
}
