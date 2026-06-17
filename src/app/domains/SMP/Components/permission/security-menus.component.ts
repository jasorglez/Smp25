import { inject, Component, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { MaterialIconPickerCellEditorComponent } from './material-icon-picker-cell-editor.component';
import type { SecurityMenuRow } from './security.component';
import { SecuritySubmenusComponent } from './security-submenus.component';

@Component({
  selector: 'app-security-menus',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular],
  template: `
    <div class="sec-menus">
      <div class="sec-menus__header">
        <div class="sec-menus__title">Menus</div>
        <div class="sec-menus__actions" (click)="$event.stopPropagation()">
          <button type="button" class="sec-menus__iconbtn" title="Crear" (click)="crearMenu()">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button type="button" class="sec-menus__iconbtn sec-menus__iconbtn--save" title="Guardar"
                  [disabled]="!hasChanges" (click)="guardarMenus()">
            <i class="bi bi-floppy"></i>
          </button>
          <button type="button" class="sec-menus__iconbtn sec-menus__iconbtn--danger" title="Eliminar"
                  [disabled]="!selectedMenu" (click)="eliminarMenu()">
            <i class="bi bi-trash"></i>
          </button>
          <button type="button" class="sec-menus__iconbtn" title="Deshacer cambios"
                  [disabled]="!hasChanges" (click)="deshacerMenus()">
            <i class="bi bi-arrow-counterclockwise"></i>
          </button>
        </div>
        <div class="sec-menus__meta">
          <span class="sec-menus__pill" *ngIf="parentRow?.nombreSeccion">{{ parentRow.nombreSeccion }}</span>
          <span class="sec-menus__muted">2º nivel • Solo frontend</span>
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
        (selectionChanged)="onSelectionChanged()"
        [stopEditingWhenCellsLoseFocus]="true"
      ></ag-grid-angular>
    </div>
  `,
  styles: [`
    .sec-menus{
      height: 100%;
      padding: 10px;
      border-radius: 12px;
      border: 1px solid #e8ecf1;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
      animation: secMenusIn .18s ease-out;
    }
    @keyframes secMenusIn{
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .sec-menus__header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      margin-bottom: 8px;
      gap: 12px;
    }
    .sec-menus__title{
      font-weight: 600;
      color: #0f172a;
      letter-spacing: .2px;
    }
    .sec-menus__actions{
      display:flex;
      align-items:center;
      gap: 6px;
      margin-left: auto;
    }
    .sec-menus__iconbtn{
      width: 34px;
      height: 34px;
      border-radius: 10px;
      border: 1px solid #e5e7eb;
      background: #ffffff;
      color: #334155;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      transition: background .15s ease, border-color .15s ease, transform .12s ease, box-shadow .15s ease;
    }
    .sec-menus__iconbtn:hover:not(:disabled){
      background:#f8fafc;
      border-color:#d1d5db;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
      transform: translateY(-1px);
    }
    .sec-menus__iconbtn:disabled{
      opacity: .45;
      cursor: not-allowed;
    }
    .sec-menus__iconbtn--save{
      border-color:#bbf7d0;
      color:#15803d;
    }
    .sec-menus__iconbtn--danger{
      border-color:#fecaca;
      color:#b91c1c;
    }
    .sec-menus__meta{
      display:flex;
      align-items:center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .sec-menus__pill{
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #334155;
      max-width: 260px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sec-menus__muted{
      font-size: 12px;
      color: #64748b;
    }
    ::ng-deep .sec-menus .ag-root-wrapper{
      border-radius: 10px;
      /* No recortar editores popup dentro de master-detail */
      overflow: visible;
    }
    ::ng-deep .sec-menus .ag-header{
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      border-bottom: 1px solid #e2e8f0;
    }
  `],
})
export class SecurityMenusComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  localeEs = AG_GRID_LOCALE_ES;
  parentRow: any;
  rowData: SecurityMenuRow[] = [];
  private gridApi!: GridApi;
  private parent: any;
  selectedMenu: SecurityMenuRow | null = null;
  hasChanges = false;
  private tempId = 0;
  /** Snapshot por sección (solo memoria). */
  private savedSnapshot: SecurityMenuRow[] = [];

  defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
    floatingFilter: false,
  };

  colDefs: ColDef[] = [
    { field: 'id', headerName: 'Id', width: 70, editable: false },
    { field: 'nombreMenu', headerName: 'Nombre del menu', flex: 2, minWidth: 220, editable: true },
    { field: 'ruta', headerName: 'Ruta', flex: 2, minWidth: 260, editable: true },
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
      field: 'subdetalle',
      headerName: 'Submenus',
      width: 110,
      editable: false,
      cellRenderer: () => `<span style="color:#2563eb;font-weight:500;user-select:none;">Ver submenus</span>`,
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
    rowSelection: 'single',
    /** Importante: evitar que el popup del editor sea recortado por el grid/master-detail */
    popupParent: typeof document !== 'undefined' ? document.body : undefined,
    masterDetail: true,
    detailRowHeight: 260,
    detailCellRenderer: SecuritySubmenusComponent,
    detailCellRendererParams: {
      context: { componentParent: this },
    },
    isRowMaster: (_dataItem: any) => true,
    onCellClicked: (event: any) => {
      if (event?.column?.getColId?.() !== 'subdetalle') return;
      event.node.setExpanded(!event.node.expanded);
    },
    onFirstDataRendered: (params: any) => {
      params.api?.sizeColumnsToFit();
    },
  };

  agInit(params: ICellRendererParams): void {
    this.parentRow = params.data;
    this.rowData = (params.data?.menus ?? []) as SecurityMenuRow[];
    this.savedSnapshot = JSON.parse(JSON.stringify(this.rowData)) as SecurityMenuRow[];
    this.parent = (params as any)?.context?.componentParent;
  
    this.cdr.detectChanges();}

  refresh(): boolean {
    return false;
  }

  onGridReady(e: GridReadyEvent): void {
    this.gridApi = e.api;
    this.gridApi.sizeColumnsToFit();
  }

  onCellValueChanged(): void {
    // El rowData del detalle es el mismo array que vive en el padre (solo memoria).
    this.hasChanges = true;
    if (this.parent?.markChangesFromDetail) {
      this.parent.markChangesFromDetail();
    }
  }

  onSelectionChanged(): void {
    const nodes = this.gridApi?.getSelectedNodes?.() ?? [];
    this.selectedMenu = nodes.length ? (nodes[0].data as SecurityMenuRow) : null;
  }

  crearMenu(): void {
    const id = `temp_${++this.tempId}`;
    const row: SecurityMenuRow = {
      id,
      nombreMenu: '',
      ruta: '',
      icono: 'dashboard',
      orden: (this.rowData?.length ?? 0) + 1,
      subdetalle: 0,
      submenus: [],
      activo: true,
    };
    this.rowData = [row, ...this.rowData];
    if (this.parentRow) this.parentRow.menus = this.rowData;
    this.gridApi?.setGridOption('rowData', this.rowData);
    this.hasChanges = true;
    this.parent?.markChangesFromDetail?.();
    setTimeout(() => {
      this.gridApi?.ensureIndexVisible(0);
      this.gridApi?.getRowNode(String(id))?.setSelected(true, true);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: 'nombreMenu' });
    }, 0);
  }

  guardarMenus(): void {
    this.savedSnapshot = JSON.parse(JSON.stringify(this.rowData)) as SecurityMenuRow[];
    this.hasChanges = false;
    this.parent?.markChangesFromDetail?.();
  }

  eliminarMenu(): void {
    if (!this.selectedMenu) return;
    const id = this.selectedMenu.id;
    this.rowData = this.rowData.filter((r) => r.id !== id);
    if (this.parentRow) this.parentRow.menus = this.rowData;
    this.selectedMenu = null;
    this.gridApi?.setGridOption('rowData', this.rowData);
    this.hasChanges = true;
    this.parent?.markChangesFromDetail?.();
  }

  deshacerMenus(): void {
    this.rowData = JSON.parse(JSON.stringify(this.savedSnapshot)) as SecurityMenuRow[];
    if (this.parentRow) this.parentRow.menus = this.rowData;
    this.selectedMenu = null;
    this.hasChanges = false;
    this.gridApi?.setGridOption('rowData', this.rowData);
    this.gridApi?.deselectAll();
    this.parent?.markChangesFromDetail?.();
  }
}

