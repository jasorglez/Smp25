import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { SignalsService } from 'app/services/signals.service';
import { ManoObraService } from 'app/services/mano-obra.service';
import { PosicionesService } from 'app/services/posiciones.service';
import { alerts } from 'app/helpers/alerts';
import { ManoObraDetailRendererComponent } from './mano-obra-detail-renderer.component';
import { PdfManoObraComponent } from './pdf-mano-obra.component';

@Component({
  selector: 'app-mano-obra',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ManoObraDetailRendererComponent, PdfManoObraComponent],
  templateUrl: './mano-obra.component.html',
})
export class ManoObraComponent {
  private signalsService    = inject(SignalsService);
  private manoObraService   = inject(ManoObraService);
  private posicionesService = inject(PosicionesService);

  rowData: any[]       = [];
  originalData: any[]  = [];
  selectedRow: any     = null;
  hasChanges: boolean  = false;
  posiciones: string[] = [];
  showPdfReport      = false;
  showPdfMoneyReport = false;
  private savedRowData: any[] | null = null;
  private gridApi!: GridApi;
  idCompany: number = 0;
  private tempCounter       = 0;

  private editableColumnOrder = ['description', 'unit', 'unitPrice', 'costo', 'quantity'];
  private enterPressed = false;

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

  public rowClassRules = {
    'new-row-highlight': (params: any) => !!params.data?.__isNew,
  };

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressDragLeaveHidesColumns: true,
    isFullWidthRow: (params: any) => !!params.rowNode.data?.__isDistDetail,
    fullWidthCellRenderer: ManoObraDetailRendererComponent,
    getRowHeight: (params: any) => params.node.data?.__isDistDetail ? 420 : 20,
    context: { componentParent: this },
    onRowClicked: (event: any) => { event.node.setSelected(true); },
    onRowSelected: (event: any) => {
      if (event.node.isSelected()) {
        this.gridApi?.forEachNode(node => {
          if (node.id !== event.node.id) node.setSelected(false);
        });
      }
    },
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
      headerName: 'Categoría / Rol',
      editable: true,
      flex: 3,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({ values: this.posiciones }),
    },
    {
      field: 'unit',
      headerName: 'Unidad',
      editable: true,
      width: 130,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['JORNADA', 'HR', 'DIA', 'SEM', 'MES'] },
    },
    {
      field: 'unitPrice',
      headerName: 'Precio Unitario',
      editable: true,
      flex: 1,
      type: 'numericColumn',
      valueFormatter: (p) =>
        p.value != null
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value)
          : '',
    },
    {
      field: 'costo',
      headerName: 'Costo',
      editable: true,
      flex: 1,
      type: 'numericColumn',
      valueFormatter: (p) =>
        p.value != null
          ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value)
          : '',
    },
    {
      field: 'quantity',
      headerName: 'Cantidad',
      editable: true,
      width: 120,
      type: 'numericColumn',
      valueFormatter: (p) => p.value != null ? Number(p.value).toFixed(4) : '0.0000',
    },
    {
      headerName: 'Total',
      editable: false,
      flex: 1,
      type: 'numericColumn',
      cellStyle: { fontWeight: '600', color: '#0e4491' },
      valueGetter: (p) => Number(p.data?.unitPrice ?? 0) * Number(p.data?.quantity ?? 0),
      valueFormatter: (p) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p.value ?? 0),
    },
    {
      headerName: 'Dist.',
      width: 60,
      editable: false,
      cellStyle: { textAlign: 'center', cursor: 'pointer' },
      cellRenderer: (params: any) => {
        const isNew = typeof params.data?.id === 'string';
        return isNew
          ? `<span style="color:#ccc;font-size:1rem;"><i class="bi bi-calendar3"></i></span>`
          : `<span title="Distribución" style="color:#0d6efd;font-size:1rem;"><i class="bi bi-calendar3"></i></span>`;
      },
      onCellClicked: (params: any) => {
        if (typeof params.data?.id === 'string') return;
        this.toggleDetail(params.node);
      },
    },
  ];

  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.loadData();
      this.loadPosiciones();
    });
  }

  loadPosiciones() {
    if (!this.idCompany) return;
    this.posicionesService.getPositionsByCompany(this.idCompany).subscribe({
      next: (data: any[]) => {
        this.posiciones = data
          .filter((d) => d.active !== false)
          .map((d) => d.description as string);
      },
      error: (e) => console.error('Error cargando posiciones', e),
    });
  }

  loadData() {
    if (!this.idCompany) return;
    this.manoObraService.getByCompany(this.idCompany).subscribe({
      next: (data) => {
        this.savedRowData = null;
        this.rowData      = data;
        this.originalData = JSON.parse(JSON.stringify(data));
        this.hasChanges   = false;
        this.selectedRow  = null;
      },
      error: (e) => console.error('Error cargando mano de obra', e),
    });
  }

  onGridReady(event: GridReadyEvent) { this.gridApi = event.api; }

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
    if (this.savedRowData) {
      this.rowData     = [...this.savedRowData];
      this.savedRowData = null;
      this.gridApi?.setGridOption('rowData', this.rowData);
    }
    const newRow = {
      id: `temp_${++this.tempCounter}`,
      idCompany: this.idCompany,
      description: '',
      unit: 'JORNADA',
      unitPrice: 0,
      costo: 0,
      quantity: 1,
      active: true,
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
          await this.manoObraService.add(payload).toPromise();
        } else {
          await this.manoObraService.update(row.id, payload).toPromise();
        }
      }
      alerts.basicAlert('OK', 'Mano de obra guardada', 'success');
      this.loadData();
    } catch (e) {
      alerts.basicAlert('Error', 'No se pudieron guardar los cambios', 'error');
    }
  }

  revertChanges() {
    this.rowData     = JSON.parse(JSON.stringify(this.originalData));
    this.hasChanges  = false;
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
      this.rowData     = this.rowData.filter((r) => r !== this.selectedRow);
      this.selectedRow = null;
      return;
    }

    try {
      await this.manoObraService.delete(this.selectedRow.id).toPromise();
      alerts.basicAlert('OK', 'Registro eliminado', 'success');
      this.loadData();
    } catch (e) {
      alerts.basicAlert('Error', 'No se pudo eliminar', 'error');
    }
  }

  // ── Distribución full-width ─────────────────────────────────────────────

  toggleDetail(node: any) {
    if (!this.gridApi) return;

    const existing = this.rowData.find(r => r.__isDistDetail);
    if (existing && existing.__manoObraId === node.data.id) {
      this.collapseDetail();
      return;
    }

    if (this.savedRowData) {
      this.rowData     = [...this.savedRowData];
      this.savedRowData = null;
    }

    this.savedRowData = [...this.rowData];

    const distRow = {
      __isDistDetail: true,
      __manoObraId:   node.data.id,
      idCompany:      node.data.idCompany ?? this.idCompany,
      description:    node.data.description,
      quantity:       node.data.quantity,
      id:             `__dist_${node.data.id}`,
    };

    const idx = this.rowData.findIndex(r => r.id === node.data.id);
    this.rowData = [this.rowData[idx], distRow];
    this.gridApi.setGridOption('rowData', this.rowData);
  }

  collapseDetail() {
    if (!this.savedRowData || !this.gridApi) return;
    this.rowData      = this.savedRowData;
    this.savedRowData = null;
    this.gridApi.setGridOption('rowData', this.rowData);
  }

  private cleanRow(row: any) {
    const clean = { ...row };
    delete clean.__isNew;
    delete clean.__modified;
    if (typeof clean.id === 'string' && clean.id.startsWith('temp_')) delete clean.id;
    return clean;
  }
}
