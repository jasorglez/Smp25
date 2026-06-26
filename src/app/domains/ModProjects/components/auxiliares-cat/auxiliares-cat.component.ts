import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { SignalsService } from 'app/services/signals.service';
import { AuxiliarService } from 'app/services/auxiliar.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-auxiliares-cat',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './auxiliares-cat.component.html',
})
export class AuxiliaresCatComponent {
  private signalsService  = inject(SignalsService);
  private auxiliarService = inject(AuxiliarService);

  rowData: any[]      = [];
  originalData: any[] = [];
  selectedRow: any    = null;
  hasChanges          = false;
  gridApi!: GridApi;
  private idCompany   = 0;
  private tempCounter = 0;

  readonly rowClassRules = { 'new-row-highlight': (p: any) => !!p.data?.__isNew };
  readonly defaultColDef: ColDef = { resizable: true, sortable: true, minWidth: 80 };

  private readonly editableOrder = ['description', 'unit', 'costMN'];
  private enterPressed = false;

  readonly colDefs: ColDef[] = [
    {
      headerName: '#', width: 50, editable: false,
      valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { textAlign: 'center', color: '#888' },
    },
    {
      field: 'description', headerName: 'Descripción del Auxiliar', flex: 3, editable: true,
      cellStyle: (p) => p.data?.__isNew ? { background: '#fffde7' } : {},
    },
    {
      field: 'unit', headerName: 'Unidad', width: 110, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({ values: ['M2', 'M3', 'ML', 'PZA', 'KG', 'TON', 'HR', 'DIA', 'JORNADA', 'JGO', 'GLB', 'M3'] }),
    },
    {
      field: 'costMN', headerName: 'Costo Directo (MN)', width: 170, editable: true, type: 'numericColumn',
      cellStyle: { fontWeight: '600', color: '#0e4491' },
      valueFormatter: (p) => p.value != null
        ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value)
        : '$0.00',
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
    this.auxiliarService.getByCompany(this.idCompany).subscribe({
      next: (data) => {
        this.rowData      = data;
        this.originalData = JSON.parse(JSON.stringify(data));
        this.hasChanges   = false;
      },
      error: (e) => console.error('Error cargando catálogo de auxiliares', e),
    });
  }

  onGridReady(e: GridReadyEvent) { this.gridApi = e.api; }

  onSelectionChanged() {
    const rows = this.gridApi.getSelectedRows();
    this.selectedRow = rows.length ? rows[0] : null;
  }

  onCellValueChanged(event: any) {
    if (!event.data.__isNew) event.data.__modified = true;
    this.hasChanges = true;
  }

  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableOrder.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableOrder[idx + 1] });
      }, 100);
    }
  }

  gridOptions = {
    defaultColDef: {
      resizable: true, sortable: true, minWidth: 80,
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed = true;
          setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
          return true;
        }
        return false;
      },
    },
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
  };

  addRow() {
    const newRow = {
      id: `temp_${++this.tempCounter}`,
      idCompany: this.idCompany,
      idContract: null,
      description: '', unit: 'M2', costMN: 0,
      hasPersonal: false, hasMaterial: false, hasHerramienta: false, hasEquipo: false,
      active: true, __isNew: true,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasChanges = true;
    setTimeout(() => this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'description' }), 100);
  }

  async saveChanges() {
    const toSave = this.rowData.filter((r) => r.__isNew || r.__modified);
    if (!toSave.length) return;
    try {
      for (const row of toSave) {
        const payload = this.cleanRow(row);
        if (row.__isNew) {
          const saved = await this.auxiliarService.add(payload).toPromise();
          row.id = saved.id; row.__isNew = false;
        } else {
          await this.auxiliarService.update(row.id, payload).toPromise();
          row.__modified = false;
        }
      }
      this.hasChanges   = false;
      this.originalData = JSON.parse(JSON.stringify(this.rowData));
      this.gridApi?.refreshCells({ force: true });
      alerts.basicAlert('Guardado', `${toSave.length} auxiliar(es) guardados`, 'success');
    } catch {
      alerts.basicAlert('Error', 'No se pudieron guardar los cambios', 'error');
    }
  }

  revertChanges() {
    this.rowData    = JSON.parse(JSON.stringify(this.originalData));
    this.hasChanges = false;
    this.selectedRow = null;
  }

  async deleteRow() {
    if (!this.selectedRow) return;
    const r = await alerts.confirmAlert(
      '¿Eliminar?', `¿Eliminar "${this.selectedRow.description}"?`, 'warning', 'Sí, eliminar'
    );
    if (!r.isConfirmed) return;
    if (typeof this.selectedRow.id === 'string') {
      this.rowData     = this.rowData.filter((x) => x !== this.selectedRow);
      this.selectedRow = null; return;
    }
    try {
      await this.auxiliarService.delete(this.selectedRow.id).toPromise();
      this.rowData     = this.rowData.filter((x) => x !== this.selectedRow);
      this.selectedRow = null;
    } catch {
      alerts.basicAlert('Error', 'No se pudo eliminar', 'error');
    }
  }

  private cleanRow(row: any) {
    const clean = { ...row };
    delete clean.__isNew; delete clean.__modified;
    if (typeof clean.id === 'string' && clean.id.startsWith('temp_')) delete clean.id;
    return clean;
  }
}
