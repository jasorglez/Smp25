import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, SelectionChangedEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { MaterialIconPickerCellEditorComponent } from './material-icon-picker-cell-editor.component';
import { SecurityMenusComponent } from './security-menus.component';

/** Material Icons disponibles en el select de la columna «Icono». */
const ICONOS_MATERIAL_OPCIONES: string[] = [
  'shield',
  'lock',
  'verified_user',
  'security',
  'vpn_key',
  'key',
  'admin_panel_settings',
  'settings',
  'tune',
  'dashboard',
  'home',
  'person',
  'groups',
  'inventory_2',
  'shopping_cart',
  'local_shipping',
  'account_balance',
  'description',
  'folder',
  'notifications',
  'search',
  'visibility',
  'visibility_off',
  'edit',
  'delete',
  'add_circle_outline',
  'bar_chart',
  'mail',
  'calendar_today',
  'star',
];

/** Vista Security: tabla y acciones solo en memoria (sin llamadas a API). */
@Component({
  selector: 'app-security',
  standalone: true,
  imports: [CommonModule, AgGridAngular, MaterialIconPickerCellEditorComponent, SecurityMenusComponent],
  templateUrl: './security.component.html',
  styleUrl: './security.component.scss',
})
export class SecurityComponent implements OnInit {
  gridHeight = '68vh';
  localeEs = AG_GRID_LOCALE_ES;
  rowData: SecurityRow[] = [];
  /** Copia profunda del último “Guardar” (o estado inicial). */
  private ultimoGuardado: SecurityRow[] = [];
  tieneCambiosPendientes = false;
  filaSeleccionada: SecurityRow | null = null;
  private gridApi!: GridApi;
  private tempId = 0;

  /** Orden al pulsar Enter: de nombre de la sección hasta activo (menus es solo enlace). */
  private readonly enterNavEditableColumns = ['nombreSeccion', 'ruta', 'icono', 'activo'];
  private enterKeyAdvanceNextColumn = false;

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    /** Una sola fila de encabezado: sin cajas de filtro debajo; el filtro va en el propio header. */
    floatingFilter: false,
    suppressHeaderFilterButton: false,
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterKeyAdvanceNextColumn = true;
        setTimeout(() => this.gridApi?.stopEditing(), 0);
        return true;
      }
      return false;
    },
  };

  colDefs: ColDef[] = [
    {
      field: 'id',
      headerName: 'Id',
      width: 90,
      filter: 'agTextColumnFilter',
      filterParams: { filterOptions: ['equals'], defaultOption: 'equals', trimInput: true },
      filterValueGetter: (p) => String(p.data?.id ?? ''),
      editable: (p) => String(p.data?.id ?? '').startsWith('temp_'),
      valueFormatter: (p) => (p.value != null ? String(p.value) : ''),
    },
    {
      field: 'nombreSeccion',
      headerName: 'Nombre de la sección',
      flex: 1.4,
      minWidth: 160,
      editable: true,
      cellEditor: 'agTextCellEditor',
    },
    {
      field: 'ruta',
      headerName: 'Ruta',
      flex: 1.2,
      minWidth: 120,
      editable: true,
      cellEditor: 'agTextCellEditor',
    },
    {
      field: 'icono',
      headerName: 'Icono',
      flex: 1,
      minWidth: 140,
      editable: true,
      cellEditor: MaterialIconPickerCellEditorComponent,
      cellEditorPopup: true,
      cellEditorParams: {
        icons: ICONOS_MATERIAL_OPCIONES,
        /** Cuadrícula de glifos; el nombre del icono solo al pasar el mouse (tooltip). */
        iconsOnly: true,
      },
      cellRenderer: (params: ICellRendererParams) => {
        const v = params.value as string;
        if (!v) return '';
        const safe = String(v).replace(/"/g, '&quot;');
        return `<span class="material-icons security-icon-cell" title="${safe}">${v}</span>`;
      },
    },
    {
      field: 'menus',
      headerName: 'Menus',
      flex: 1.2,
      minWidth: 140,
      editable: false,
      sortable: false,
      filter: false,
      cellRenderer: () =>
        `<span class="security-ver-menus-link">Ver menus</span>`,
    },
    {
      field: 'activo',
      headerName: 'Activo',
      width: 100,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: [true, false] },
      cellRenderer: (params: ICellRendererParams) => (params.value ? 'Sí' : 'No'),
    },
  ];

  gridOptions = {
    headerHeight: 36,
    rowHeight: 36,
    animateRows: true,
    suppressCellFocus: false,
    rowSelection: 'single' as const,
    popupParent: typeof document !== 'undefined' ? document.body : undefined,
    masterDetail: true,
    // Debe ser suficientemente alto para contener el 2º y 3er nivel sin “aplastarse”.
    detailRowHeight: 520,
    detailCellRenderer: SecurityMenusComponent,
    detailCellRendererParams: {
      context: { componentParent: this },
    },
    isRowMaster: (_dataItem: any) => true,
    getRowId: (params: { data: SecurityRow }) => String(params.data.id),
  };

  ngOnInit(): void {
    this.rowData = this.datosIniciales();
    this.ultimoGuardado = this.clonar(this.rowData);
  }

  onGridReady(e: GridReadyEvent): void {
    this.gridApi = e.api;
  }

  onSelectionChanged(ev: SelectionChangedEvent): void {
    const nodes = ev.api.getSelectedNodes();
    this.filaSeleccionada = nodes.length ? (nodes[0].data as SecurityRow) : null;
  }

  onCellValueChanged(): void {
    this.tieneCambiosPendientes = true;
  }

  onCellEditingStopped(event: any): void {
    if (!this.enterKeyAdvanceNextColumn) return;
    this.enterKeyAdvanceNextColumn = false;
    const colId = event.column?.getColId?.();
    if (!colId) return;
    const idx = this.enterNavEditableColumns.indexOf(colId);
    if (idx !== -1 && idx < this.enterNavEditableColumns.length - 1) {
      setTimeout(() => {
        this.gridApi?.startEditingCell({
          rowIndex: event.rowIndex,
          colKey: this.enterNavEditableColumns[idx + 1],
        });
      }, 0);
    }
  }

  onCellClicked(event: any): void {
    if (event?.column?.getColId?.() !== 'menus') return;
    const isExpanding = !event.node.expanded;
    event.node.setExpanded(isExpanding);

    // Igual que en Permisos: al expandir, mostrar solo esa fila; al cerrar, mostrar todo.
    if (this.gridApi) {
      if (isExpanding) {
        const selectedId = String(event.data?.id ?? '');
        this.gridApi.setFilterModel({
          id: { type: 'equals', filter: selectedId },
        });
      } else {
        this.gridApi.setFilterModel(null);
      }
      this.gridApi.onFilterChanged();
    }
  }

  /** Llamado desde el 2º nivel para marcar cambios (solo memoria). */
  markChangesFromDetail(): void {
    this.tieneCambiosPendientes = true;
    // refrescar la celda “Menus” si hiciera falta (texto fijo, pero mantiene patrón)
    this.gridApi?.refreshCells({ force: true });
  }

  crear(): void {
    const id = `temp_${++this.tempId}`;
    const nueva: SecurityRow = {
      id,
      nombreSeccion: '',
      ruta: '',
      icono: 'shield',
      menus: [],
      activo: true,
    };
    this.rowData = [nueva, ...this.rowData];
    this.tieneCambiosPendientes = true;
    this.gridApi?.setGridOption('rowData', this.rowData);
    setTimeout(() => {
      this.gridApi?.ensureIndexVisible(0);
      this.gridApi?.getRowNode(id)?.setSelected(true, true);
      this.gridApi?.startEditingCell({
        rowIndex: 0,
        colKey: 'nombreSeccion',
      });
    }, 0);
  }

  guardar(): void {
    this.ultimoGuardado = this.clonar(this.rowData);
    this.tieneCambiosPendientes = false;
    alerts.basicAlert('Guardado local', 'Los cambios quedaron guardados solo en esta sesión (sin servidor).', 'success');
  }

  async eliminar(): Promise<void> {
    if (!this.filaSeleccionada) {
      alerts.basicAlert('Selección', 'Selecciona una fila para eliminar.', 'info');
      return;
    }
    const ok = await alerts.confirmAlert(
      'Eliminar fila',
      '¿Quitar esta sección de la tabla? (solo en memoria)',
      'warning',
      'Sí, eliminar'
    );
    if (!ok.isConfirmed) return;
    const id = this.filaSeleccionada.id;
    this.rowData = this.rowData.filter((r) => r.id !== id);
    this.filaSeleccionada = null;
    this.tieneCambiosPendientes = true;
    this.gridApi?.setGridOption('rowData', this.rowData);
  }

  deshacer(): void {
    this.rowData = this.clonar(this.ultimoGuardado);
    this.tieneCambiosPendientes = false;
    this.filaSeleccionada = null;
    this.gridApi?.setGridOption('rowData', this.rowData);
    this.gridApi?.deselectAll();
  }

  private clonar(rows: SecurityRow[]): SecurityRow[] {
    return JSON.parse(JSON.stringify(rows)) as SecurityRow[];
  }

  private datosIniciales(): SecurityRow[] {
    return [
      {
        id: 1,
        nombreSeccion: 'Acceso general',
        ruta: '/security/general',
        icono: 'verified_user',
        menus: [
          {
            id: 1,
            nombreMenu: 'Dashboard',
            ruta: '/security/general/dashboard',
            icono: 'dashboard',
            orden: 1,
            subdetalle: 0,
            submenus: [
              { id: 1, nombreSubmenu: 'Resumen', ruta: '/security/general/dashboard/summary', icono: 'bar_chart', orden: 1, detalles: '', activo: true },
            ],
            activo: true,
          },
          {
            id: 2,
            nombreMenu: 'Usuarios',
            ruta: '/security/general/users',
            icono: 'groups',
            orden: 2,
            subdetalle: 0,
            submenus: [
              { id: 1, nombreSubmenu: 'Listado', ruta: '/security/general/users/list', icono: 'groups', orden: 1, detalles: '', activo: true },
              { id: 2, nombreSubmenu: 'Roles', ruta: '/security/general/users/roles', icono: 'admin_panel_settings', orden: 2, detalles: '', activo: true },
            ],
            activo: true,
          },
        ],
        activo: true,
      },
      {
        id: 2,
        nombreSeccion: 'Sesiones',
        ruta: '/security/sessions',
        icono: 'lock',
        menus: [
          {
            id: 1,
            nombreMenu: 'Sesiones activas',
            ruta: '/security/sessions/active',
            icono: 'visibility',
            orden: 1,
            subdetalle: 0,
            submenus: [
              { id: 1, nombreSubmenu: 'Detalle', ruta: '/security/sessions/active/detail', icono: 'visibility', orden: 1, detalles: '', activo: true },
            ],
            activo: true,
          },
        ],
        activo: true,
      },
    ];
  }
}

interface SecurityRow {
  id: number | string;
  nombreSeccion: string;
  ruta: string;
  icono: string;
  menus: SecurityMenuRow[];
  activo: boolean;
}

export interface SecurityMenuRow {
  id: number | string;
  nombreMenu: string;
  ruta: string;
  icono: string;
  orden: number;
  subdetalle: number;
  submenus: SecuritySubmenuRow[];
  activo: boolean;
}

export interface SecuritySubmenuRow {
  id: number | string;
  nombreSubmenu: string;
  ruta: string;
  icono: string;
  orden: number;
  detalles: string;
  activo: boolean;
}
