import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { MaterialIconPickerCellEditorComponent } from './material-icon-picker-cell-editor.component';
import type { SecuritySubmenuRow } from './security.component';

@Component({
  selector: 'app-security-submenus',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, MaterialIconPickerCellEditorComponent],
  template: `
    <div class="sec-submenus">
      <div class="sec-submenus__header">
        <div class="sec-submenus__title">Submenus</div>
        <div class="sec-submenus__meta">
          <span class="sec-submenus__muted">3er nivel • Solo frontend</span>
        </div>
      </div>

      <ag-grid-angular
        class="ag-theme-quartz small-text-ag-grid"
        style="width: 100%; height: calc(100% - 38px);"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [gridOptions]="gridOptions"
        [localeText]="localeEs"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged()"
        [stopEditingWhenCellsLoseFocus]="true"
      ></ag-grid-angular>
    </div>
  `,
  styles: [`
    .sec-submenus{
      height: 100%;
      padding: 10px;
      border-radius: 12px;
      border: 1px solid #e8ecf1;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
      animation: secSubIn .18s ease-out;
    }
    @keyframes secSubIn{
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .sec-submenus__header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      margin-bottom: 8px;
      gap: 12px;
    }
    .sec-submenus__title{
      font-weight: 600;
      color: #0f172a;
      letter-spacing: .2px;
    }
    .sec-submenus__muted{
      font-size: 12px;
      color: #64748b;
    }
    ::ng-deep .sec-submenus .ag-root-wrapper{
      border-radius: 10px;
      overflow: visible;
    }
    ::ng-deep .sec-submenus .ag-header{
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      border-bottom: 1px solid #e2e8f0;
    }
  `],
})
export class SecuritySubmenusComponent implements ICellRendererAngularComp {
  localeEs = AG_GRID_LOCALE_ES;
  rowData: SecuritySubmenuRow[] = [];
  private gridApi!: GridApi;
  private parent: any;

  defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
    floatingFilter: false,
  };

  colDefs: ColDef[] = [
    { field: 'id', headerName: 'Id', width: 70, editable: false },
    { field: 'nombreSubmenu', headerName: 'Nombre del submenu', flex: 1.6, minWidth: 220, editable: true },
    { field: 'ruta', headerName: 'Ruta', flex: 1.8, minWidth: 260, editable: true },
    {
      field: 'icono',
      headerName: 'Icono',
      width: 90,
      editable: true,
      cellEditor: MaterialIconPickerCellEditorComponent,
      cellEditorPopup: true,
      cellEditorParams: { iconsOnly: true },
      cellRenderer: (p: ICellRendererParams) => {
        const v = p.value as string;
        if (!v) return '';
        const safe = String(v).replace(/"/g, '&quot;');
        return `<span class="material-icons" title="${safe}" style="font-size:20px;vertical-align:middle;color:#334155;">${v}</span>`;
      },
    },
    { field: 'orden', headerName: 'Orden', width: 90, editable: true, type: 'numericColumn', cellEditor: 'agNumberCellEditor' },
    {
      field: 'detalles',
      headerName: 'Detalles',
      flex: 1.1,
      minWidth: 160,
      editable: false,
      sortable: false,
      filter: false,
      cellRenderer: () =>
        `<span style="color:#2563eb;font-weight:500;user-select:none;">Ver detalles</span>`,
    },
    {
      field: 'activo',
      headerName: 'Activo',
      width: 90,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: [true, false] },
      cellRenderer: (p: ICellRendererParams) => (p.value ? 'Sí' : 'No'),
    },
  ];

  gridOptions: any = {
    headerHeight: 34,
    rowHeight: 34,
    animateRows: true,
    popupParent: typeof document !== 'undefined' ? document.body : undefined,
    onFirstDataRendered: (params: any) => params.api?.sizeColumnsToFit(),
  };

  agInit(params: ICellRendererParams): void {
    // `params.data` en master/detail sigue siendo la data del menú padre; los submenus viven en `data.submenus`.
    const menuRow: any = params.data;
    this.rowData = (menuRow?.submenus ?? []) as SecuritySubmenuRow[];
    this.parent = (params as any)?.context?.componentParent;
  }

  refresh(): boolean {
    return false;
  }

  onGridReady(e: GridReadyEvent): void {
    this.gridApi = e.api;
    this.gridApi.sizeColumnsToFit();
  }

  onCellValueChanged(): void {
    this.parent?.markChangesFromDetail?.();
  }
}

