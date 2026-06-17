import { Component, inject, OnInit, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { DescripcionEmpaqueService, DescripcionEmpaque } from 'app/services/descripcion-empaque.service';
import { SignalsService } from 'app/services/signals.service';
import { lastValueFrom } from 'rxjs';

interface EmpaqueRow extends DescripcionEmpaque {
  __isNew?: boolean;
  __modified?: boolean;
}

@Component({
  selector: 'app-descripcion-empaque',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="padding: 12px; display: flex; flex-direction: column; gap: 10px; height: 420px;">

      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div><strong>Descripción Empaque</strong></div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-sm btn-success" (click)="add()" [disabled]="!gridApi">
            <i class="bi bi-plus-lg"></i> Agregar
          </button>
          <button class="btn btn-sm btn-primary position-relative" (click)="save()" [disabled]="!hasChanges || saving">
            <i class="bi bi-floppy"></i> Guardar
            <span *ngIf="hasChanges"
                  class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle">
            </span>
          </button>
          <button class="btn btn-sm btn-warning" (click)="revert()" [disabled]="!hasChanges || saving">
            <i class="bi bi-arrow-clockwise"></i> Deshacer
          </button>
          <button class="btn btn-sm btn-danger" (click)="deleteSelected()" [disabled]="!selectedRow || saving">
            <i class="bi bi-trash"></i> Borrar
          </button>
        </div>
      </div>

      <ag-grid-angular
        class="ag-theme-quartz"
        style="flex: 1; width: 100%;"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [localeText]="AG_GRID_LOCALE_ES"
        [gridOptions]="gridOptions"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        (selectionChanged)="onSelectionChanged($event)">
      </ag-grid-angular>

    </div>
  `
})
export class DescripcionEmpaqueComponent implements OnInit {
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  public gridApi!: GridApi;

  private svc     = inject(DescripcionEmpaqueService);
  private readonly cdr = inject(ChangeDetectorRef);
  private signals = inject(SignalsService);

  rowData: EmpaqueRow[] = [];
  private originalRowData: EmpaqueRow[] = [];
  hasChanges = false;
  saving     = false;
  selectedRow: EmpaqueRow | null = null;

  private get idCompany(): number {
    return this.signals.idCompany() ?? 9;
  }

  public defaultColDef: ColDef = {
    sortable: false,
    resizable: true,
    filter: false,
    editable: true,
  };

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true,
    rowSelection: 'single',
    rowClassRules: {
      'modified-row':      (p: any) => !!p.data?.__modified,
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
    },
    getRowStyle: (p: any) => {
      if (p.data?.active === false || p.data?.active === 0) {
        return { backgroundColor: '#f5f5f5', color: '#9e9e9e', fontStyle: 'italic' };
      }
      return undefined;
    },
  };

  public colDefs: ColDef[] = [
    {
      field: 'active',
      headerName: 'Activo',
      width: 100,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor',
    },
    {
      field: 'descripcion',
      headerName: 'Descripcion Empaque',
      flex: 1,
      minWidth: 200,
      cellEditor: 'agTextCellEditor',
    },
  ];

  ngOnInit() {
    this.loadData();
  }

  onGridReady(event: GridReadyEvent) {
    this.gridApi = event.api;
  }

  onSelectionChanged(_: any) {
    const rows = this.gridApi.getSelectedRows();
    this.selectedRow = rows.length > 0 ? rows[0] : null;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasChanges = true;
    this.gridApi.redrawRows({ rowNodes: [event.node] });
  }

  private loadData() {
    this.svc.getByCompany(this.idCompany).subscribe({
      next: (data) => {
        this.rowData = data as EmpaqueRow[];
        this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
        this.hasChanges = false;
        if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
      },
      error: () => alerts.basicAlert('Error', 'No se pudo cargar descripción empaque.', 'error'),
    });
  }

  add() {
    const newRow: EmpaqueRow = {
      descripcion: '',
      active: true,
      idCompany: this.idCompany,
      __isNew: true,
      __modified: true,
    };
    this.rowData = [newRow, ...this.rowData];
    this.gridApi.setGridOption('rowData', this.rowData);
    this.hasChanges = true;
    setTimeout(() => {
      this.gridApi.ensureIndexVisible(0);
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'descripcion' });
    }, 0);
  }

  async save() {
    if (this.saving) return;
    this.saving = true;
    try {
      const toProcess = this.rowData.filter(r => r.__modified || r.__isNew);
      for (const row of toProcess) {
        const payload: DescripcionEmpaque = {
          id:          row.id,
          descripcion: row.descripcion,
          active:      row.active,
          idCompany:   this.idCompany,
        };
        if (row.__isNew) {
          await lastValueFrom(this.svc.create(payload));
        } else if (row.id) {
          await lastValueFrom(this.svc.update(row.id, payload));
        }
      }
      alerts.reqSuccessToast('Guardado', 'Cambios guardados correctamente.');
      this.loadData();
    } catch {
      alerts.basicAlert('Error', 'No se pudo guardar los cambios.', 'error');
    } finally {
      this.saving = false;
    }
  
    this.cdr.detectChanges();}

  revert() {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.gridApi.setGridOption('rowData', this.rowData);
    this.hasChanges = false;
    this.selectedRow = null;
  }

  async deleteSelected() {
    if (!this.selectedRow) return;
    const confirm = await alerts.confirmAlert('Eliminar', '¿Eliminar este registro?', 'warning', 'Sí, eliminar');
    if (!confirm.isConfirmed) return;
    if (this.selectedRow.__isNew) {
      this.rowData = this.rowData.filter(r => r !== this.selectedRow);
      this.gridApi.setGridOption('rowData', this.rowData);
      this.selectedRow = null;
      if (!this.rowData.some(r => r.__modified || r.__isNew)) this.hasChanges = false;
      return;
    }
    try {
      await lastValueFrom(this.svc.delete(this.selectedRow.id!));
      alerts.reqSuccessToast('Eliminado', 'Registro eliminado.');
      this.loadData();
      this.selectedRow = null;
    } catch {
      alerts.basicAlert('Error', 'No se pudo eliminar el registro.', 'error');
    }
  
    this.cdr.detectChanges();}
}
