import { Component, inject, OnInit, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { CondicionesPagoService, CondicionPagoDto } from 'app/services/condiciones-pago.service';
import { SignalsService } from 'app/services/signals.service';
import { lastValueFrom } from 'rxjs';

interface CondicionPagoRow extends CondicionPagoDto {
  calculoAnticipo?: boolean;
  __modified?: boolean;
  __isNew?: boolean;
}

@Component({
  selector: 'app-condiciones-pago',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
    <div style="padding: 12px; display: flex; flex-direction: column; gap: 10px; height: 420px;">

      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div><strong>Condiciones de pago</strong></div>
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
          <button class="btn btn-sm btn-warning" (click)="revertChanges()" [disabled]="!hasChanges || saving">
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
export class CondicionesPagoComponent implements OnInit {
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  public gridApi!: GridApi;

  private svc     = inject(CondicionesPagoService);
  private readonly cdr = inject(ChangeDetectorRef);
  private signals = inject(SignalsService);

  rowData: CondicionPagoRow[] = [];
  private originalRowData: CondicionPagoRow[] = [];
  hasChanges = false;
  saving     = false;
  selectedRow: CondicionPagoRow | null = null;

  private get idCompany(): number {
    return this.signals.idCompany() ?? 9;
  }

  public defaultColDef: ColDef = {
    sortable: false,
    resizable: true,
    filter: false,
    editable: true
  };

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true,
    rowSelection: 'single',
    rowClassRules: {
      'modified-row': (p: any) => !!p.data?.__modified,
      'new-row-highlight': (p: any) => !!p.data?.__isNew
    },
    getRowStyle: (p: any) => {
      if (p.data?.active === false || p.data?.active === 0) {
        return { backgroundColor: '#f5f5f5', color: '#757575', fontStyle: 'italic', borderLeft: '4px solid #bdbdbd' };
      }
      return undefined;
    }
  };

  public colDefs: ColDef[] = [
    {
      field: 'active',
      headerName: 'Activo',
      width: 100,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor'
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      flex: 1,
      minWidth: 200,
      cellEditor: 'agTextCellEditor'
    },
    {
      field: 'calculoAnticipo',
      headerName: 'Calculo Anticipo',
      width: 160,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor'
    },
    {
      field: 'cantidad',
      headerName: 'Cantidad (días)',
      width: 160,
      type: 'numericColumn',
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { min: 0, precision: 0 }
    }
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
        this.rowData = data as CondicionPagoRow[];
        this.originalRowData = JSON.parse(JSON.stringify(this.rowData));
        this.hasChanges = false;
        if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
      },
      error: () => alerts.basicAlert('Error', 'No se pudo cargar condiciones de pago.', 'error')
    });
  }

  add() {
    const newRow: CondicionPagoRow = {
      descripcion: '',
      cantidad: 0,
      active: true,
      calculoAnticipo: false,
      idCompany: this.idCompany,
      __isNew: true,
      __modified: true
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
        const payload: CondicionPagoDto = {
          id:              row.id,
          descripcion:     row.descripcion,
          cantidad:        row.cantidad,
          active:          row.active,
          calculoAnticipo: row.calculoAnticipo ?? false,
          idCompany:       this.idCompany
        };
        if (row.__isNew || !row.id) {
          await lastValueFrom(this.svc.create(payload));
        } else {
          await lastValueFrom(this.svc.update(row.id!, payload));
        }
      }
      alerts.basicAlert('Guardado', 'Condiciones de pago guardadas correctamente.', 'success');
      this.loadData();
    } catch {
      alerts.basicAlert('Error', 'Ocurrió un error al guardar.', 'error');
    } finally {
      this.saving = false;
    }
  
    this.cdr.detectChanges();}

  async deleteSelected() {
    if (!this.selectedRow || this.saving) return;
    const row = this.selectedRow;

    if (row.__isNew || !row.id) {
      this.rowData = this.rowData.filter(r => r !== row);
      this.gridApi.setGridOption('rowData', this.rowData);
      this.selectedRow = null;
      this.hasChanges = this.rowData.some(r => r.__modified || r.__isNew);
      return;
    }

    const confirm = await alerts.confirmAlert('¿Borrar?', `Se eliminará "${row.descripcion}" permanentemente.`, 'warning', 'Sí, borrar');
    if (!confirm.isConfirmed) return;

    this.saving = true;
    try {
      await lastValueFrom(this.svc.delete(row.id!));
      this.loadData();
    } catch {
      alerts.basicAlert('Error', 'No se pudo eliminar el registro.', 'error');
    } finally {
      this.saving = false;
    }
  
    this.cdr.detectChanges();}

  revertChanges() {
    this.rowData = JSON.parse(JSON.stringify(this.originalRowData));
    this.gridApi.setGridOption('rowData', this.rowData);
    this.hasChanges = false;
    this.selectedRow = null;
  }
}
