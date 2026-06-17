import { Component, effect, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { SignalsService } from 'app/services/signals.service';
import { HerramientaService } from 'app/services/herramienta.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-herramientas',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './herramientas.component.html',
})
export class HerramientasComponent {
  private signalsService     = inject(SignalsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private herramientaService = inject(HerramientaService);

  rowData: any[]      = [];
  originalData: any[] = [];
  selectedRow: any    = null;
  hasChanges: boolean = false;
  private gridApi!: GridApi;
  private idCompany: number = 0;
  private tempCounter       = 0;

  private editableColumnOrder = ['description', 'unit', 'costMN'];

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
        return true;
      }
      return false;
    },
  };

  private enterPressed = false;

  public rowClassRules = {
    'new-row-highlight': (params: any) => !!params.data?.__isNew,
  };

  public colDefs: ColDef[] = [
    {
      headerName: '#',
      width: 55,
      editable: false,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { textAlign: 'center', color: '#888' },
    },
    {
      field: 'description',
      headerName: 'Descripción',
      editable: true,
      flex: 2,
    },
    {
      field: 'unit',
      headerName: 'Unidad',
      editable: true,
      width: 100,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['HR', 'DIA', 'SEM', 'MES', 'PZA', 'JGO', 'KIT'] },
    },
    {
      field: 'costMN',
      headerName: 'Costo MN',
      editable: true,
      width: 130,
      type: 'numericColumn',
      valueFormatter: (p) =>
        p.value != null
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value)
          : '',
    },
  ];

  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.loadData();
    });
  }

  loadData() {
    if (!this.idCompany) return;
    this.herramientaService.getByCompany(this.idCompany).subscribe({
      next: (data) => {
        this.rowData      = data;
        this.originalData = JSON.parse(JSON.stringify(data));
        this.hasChanges   = false;
        this.selectedRow  = null;
      },
      error: (e) => console.error('Error cargando herramientas', e),
    });
  }

  onGridReady(event: GridReadyEvent) {
    this.gridApi = event.api;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasChanges = true;
  }

  onSelectionChanged() {
    const rows = this.gridApi.getSelectedRows();
    this.selectedRow = rows.length ? rows[0] : null;
  }

  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableColumnOrder.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({
          rowIndex: event.rowIndex,
          colKey: this.editableColumnOrder[idx + 1],
        });
      }, 100);
    }
  }

  addRow() {
    const newRow = {
      id: `temp_${++this.tempCounter}`,
      idCompany: this.idCompany,
      description: '',
      unit: 'HR',
      costMN: 0,
      __isNew: true,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasChanges = true;
    setTimeout(() => {
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'description' });
    }, 100);
  }

  async saveChanges() {
    const toSave = this.rowData.filter((r) => r.__isNew || r.__modified);
    if (!toSave.length) return;

    try {
      for (const row of toSave) {
        const payload = this.cleanRow(row);
        if (row.__isNew) {
          await this.herramientaService.add(payload).toPromise();
        } else {
          await this.herramientaService.update(row.id, payload).toPromise();
        }
      }
      alerts.basicAlert('OK', 'Herramientas guardadas', 'success');
      this.loadData();
    } catch (e) {
      alerts.basicAlert('Error', 'No se pudieron guardar los cambios', 'error');
    }
  
    this.cdr.detectChanges();}

  revertChanges() {
    this.rowData    = JSON.parse(JSON.stringify(this.originalData));
    this.hasChanges = false;
    this.selectedRow = null;
  }

  async deleteSelected() {
    if (!this.selectedRow) return;
    const result = await alerts.confirmAlert(
      '¿Eliminar?',
      `¿Eliminar "${this.selectedRow.description}"?`,
      'warning',
      'Sí, eliminar'
    );
    if (!result.isConfirmed) return;

    if (typeof this.selectedRow.id === 'string' && this.selectedRow.id.startsWith('temp_')) {
      this.rowData    = this.rowData.filter((r) => r !== this.selectedRow);
      this.selectedRow = null;
      return;
    }

    try {
      await this.herramientaService.delete(this.selectedRow.id).toPromise();
      alerts.basicAlert('OK', 'Herramienta eliminada', 'success');
      this.loadData();
    } catch (e) {
      alerts.basicAlert('Error', 'No se pudo eliminar', 'error');
    }
  
    this.cdr.detectChanges();}

  private cleanRow(row: any) {
    const clean = { ...row };
    delete clean.__isNew;
    delete clean.__modified;
    if (typeof clean.id === 'string' && clean.id.startsWith('temp_')) delete clean.id;
    return clean;
  }
}
