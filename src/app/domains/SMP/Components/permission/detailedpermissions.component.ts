import { inject, Component, OnInit, ChangeDetectorRef} from '@angular/core';
import { AgGridAngular, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { Observable, of, lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { MenuService } from 'app/services/menu.service';
import { CommonModule } from '@angular/common';
import { SignalsService } from 'app/services/signals.service';
import { DetailedPermissionsService } from 'app/services/detailedPermissions.service';
import { SubDetailedPermissionsComponent } from './subdetailedpermissions.component';
import { IconPickerCellEditorComponent } from './icon-picker-cell-editor.component';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-detailed-permission',
  standalone: true,
  imports: [
    CommonModule,
    AgGridAngular],
  templateUrl: './detailedpermissions.component.html',
  styles: `
    ::ng-deep .small-text-ag-grid {
      font-size: 12px;
    }
    ::ng-deep .small-text-ag-grid .ag-header-cell-text {
      font-size: 11px;
    }
    ::ng-deep .small-text-ag-grid .ag-cell-value {
      font-size: 11px;
    }
  `
})

export class DetailedPermissionsComponent implements OnInit, ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  public rowData: any[] = [];
  public gridApi!: GridApi;
  gridHeight: string = '400px';
  public masterId!: number;
  public hasChanges = false;

  private readonly enterNavEditableColumns = ['permissionName', 'identifier', 'route', 'tab_order', 'comment'];
  private enterKeyAdvanceNextColumn = false;

  public readonly bootstrapIcons = [
    'bi bi-houses', 'bi bi-boxes', 'bi bi-box-seam', 'bi bi-journal-text',
    'bi bi-gear-fill', 'bi bi-gear', 'bi bi-people-fill', 'bi bi-person-bounding-box',
    'bi bi-cash-coin', 'bi bi-stopwatch', 'bi bi-list-task', 'bi bi-cart-fill',
    'bi bi-file-earmark-person-fill', 'bi bi-archive-fill', 'bi bi-shop',
    'bi bi-wallet2', 'bi bi-graph-up', 'bi bi-pc-display-horizontal',
    'bi bi-arrow-bar-down', 'bi bi-arrow-bar-up', 'bi bi-building-fill-gear',
    'bi bi-globe2', 'bi bi-box-arrow-in-right', 'bi bi-person-fill',
    'bi bi-shield-fill', 'bi bi-bar-chart-fill', 'bi bi-clipboard-data',
    'bi bi-truck', 'bi bi-tools', 'bi bi-wrench-adjustable',
    'bi bi-calculator', 'bi bi-currency-dollar', 'bi bi-file-earmark-text',
    'bi bi-calendar3', 'bi bi-clock', 'bi bi-bell-fill',
  ];

  public colDefs: ColDef[] = [
    {
      field: 'id', editable: false, width: 60,
      filter: 'agNumberColumnFilter',
      filterParams: { filterOptions: ['equals'] },
    },
    { field: 'permissionName', headerName: 'Nombre', flex: 2, editable: true },
    { field: 'identifier',     headerName: 'Identificador', flex: 2, editable: true },
    {
      field: 'route', headerName: 'Ruta', flex: 2, editable: true,
    },
    {
      field: 'icon', headerName: 'Icono', flex: 2, editable: true,
      cellEditor: IconPickerCellEditorComponent,
      cellEditorPopup: true,
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) return '';
        return `<i class="${params.value}" style="font-size:14px;margin-right:4px;"></i><small>${params.value}</small>`;
      },
    },
    {
      field: 'showAsTab', headerName: 'Tab', width: 60, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: [true, false] },
      cellRenderer: (params: ICellRendererParams) => params.value ? '✅' : '—',
    },
    {
      field: 'tab_order', headerName: 'Orden', width: 70, editable: true,
      cellEditor: 'agNumberCellEditor',
    },
    { field: 'comment', headerName: 'Comentario', flex: 3, editable: true },
    {
      field: 'detail', headerName: 'SubDetalles', width: 90,
      cellRenderer: (params: ICellRendererParams) =>
        '<span style="cursor:pointer;text-decoration:underline;color:#0d6efd;">Ver</span>',
    },
    {
      field: 'active', headerName: 'Activo', width: 70,
      cellRenderer: (params: ICellRendererParams) => params.value ? 'Sí' : 'No',
    },
  ];


  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true,
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterKeyAdvanceNextColumn = true;
        setTimeout(() => this.gridApi?.stopEditing(), 0);
        return true;
      }
      return false;
    },
  };

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    masterDetail: true,
    detailCellRenderer: SubDetailedPermissionsComponent,
    detailRowHeight: 300,
    isRowMaster: (dataItem) => true,
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowSelected: (event) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
    onCellClicked: (event: any) => {
      if (event.column.getColId() === 'detail') {
        const isExpanding = !event.node.expanded;
        event.node.setExpanded(isExpanding);

        if (this.gridApi) {
          if (isExpanding) {
            const selectedId = event.data.id;
            const filterModel = {
              id: {
                type: 'equals',
                filter: selectedId,
              },
            };
            this.gridApi.setFilterModel(filterModel);
          } else {
            this.gridApi.setFilterModel(null);
          }
          this.gridApi.onFilterChanged();
        } else {
          alert('gridApi no disponible');
        }
      }
    },
    onFirstDataRendered: (params) => {
      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });
      params.api.autoSizeColumns(allColumnIds, false);
    },
    onCellValueChanged: (event: any) => {
      event.data.__modified = true;
      this.hasChanges = true;
    },
  };


  constructor(private menuService: MenuService, private signalsService: SignalsService, private detailedPermissionsService: DetailedPermissionsService) {}

  agInit(params: ICellRendererParams): void {
    if (params.data) {
      this.masterId = params.data.id;
      if (this.masterId) {
        this.loadData();
      } else {
        this.rowData = params.data.detailData || [];
      }
    }
  
    this.cdr.detectChanges();}

  refresh(params: ICellRendererParams): boolean {
    return false;
  }

  loadData() {
    this.detailedPermissionsService.getDetailedPermissions(this.masterId).subscribe({
      next: (data) => {
        this.rowData = data || [];
        this.hasChanges = false;
      },
      error: (err) => console.error(err)
    });
  }

  ngOnInit(): void {
    if (this.masterId) return;
    this.menuService.getDetails(0).pipe(
      map((data: any[]) => {
        const masters: { [key: number]: any } = {};
        data.forEach(item => {
          if (item.masterPermission) {
            const masterId = item.masterPermission.id;
            if (!masters[masterId]) {
              masters[masterId] = {
                id: item.masterPermission.id,
                permissionName: item.masterPermission.permissionName,
                identifier: item.masterPermission.identifier,
                active: item.masterPermission.active,
                comment: item.masterPermission.comment,
                detailData: []
              };
            }
            // Only add if item is valid
            if (item.id) {
              masters[masterId].detailData.push({
                id: item.id,
                permissionName: item.permissionName,
                identifier: item.identifier,
                active: item.active,
                comment: item.comment
              });
            }
          }
        });
        return Object.values(masters);
      })
    ).subscribe(data => {
      this.rowData = data;
    });
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
  }

  onCellEditingStopped(event: any): void {
    if (!this.enterKeyAdvanceNextColumn) return;
    this.enterKeyAdvanceNextColumn = false;
    const idx = this.enterNavEditableColumns.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.enterNavEditableColumns.length - 1) {
      setTimeout(() => {
        this.gridApi?.startEditingCell({
          rowIndex: event.rowIndex,
          colKey: this.enterNavEditableColumns[idx + 1],
        });
      }, 0);
    }
  }

  onAdd() {
    const newPermission = {
      id: `temp_${Date.now()}`,
      masterId: this.masterId,
      permissionName: '',
      identifier: '',
      route: null,
      icon: null,
      showAsTab: false,
      tab_order: null,
      active: true,
      comment: '',
      __isNew: true
    };
    this.gridApi.applyTransaction({ add: [newPermission], addIndex: 0 });
    this.hasChanges = true;
    setTimeout(() => {
      this.gridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'permissionName'
      });
    }, 100);
  }

  async onSave() {
    const newRows: any[] = [];
    const modifiedRows: any[] = [];

    this.gridApi.forEachNode((node) => {
      if (node.data.__isNew) {
        newRows.push(node.data);
      } else if (node.data.__modified) {
        modifiedRows.push(node.data);
      }
    });

    if (newRows.length === 0 && modifiedRows.length === 0) return;

    try {
      for (const row of newRows) {
        const payload = {
          masterId: row.masterId || this.masterId,
          permissionName: row.permissionName,
          comment: row.comment,
          identifier: row.identifier,
          active: row.active,
          route: row.route ?? null,
          icon: row.icon ?? null,
          showAsTab: row.showAsTab ?? false,
          tab_order: row.tab_order ?? null,
          principalSubIdentifier: row.principalSubIdentifier ?? null,
        };
        await lastValueFrom(this.detailedPermissionsService.addDetailedPermissions(payload));
      }

      for (const row of modifiedRows) {
        const payload = {
          id: row.id,
          masterId: row.masterId || this.masterId,
          permissionName: row.permissionName,
          comment: row.comment,
          identifier: row.identifier,
          active: row.active,
          route: row.route ?? null,
          icon: row.icon ?? null,
          showAsTab: row.showAsTab ?? false,
          tab_order: row.tab_order ?? null,
          principalSubIdentifier: row.principalSubIdentifier ?? null,
        };
        await lastValueFrom(this.detailedPermissionsService.updateDetailedPermissions(row.id, payload));
      }

      alerts.basicAlert('Éxito', 'Cambios guardados correctamente', 'success');
      this.hasChanges = false;
      this.loadData();
    } catch (error) {
      console.error(error);
      alerts.basicAlert('Error', 'Error al guardar cambios', 'error');
    }
  
    this.cdr.detectChanges();}

  onRefresh() {
    this.loadData();
  }

  async onDelete() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Atención', 'Seleccione un registro', 'warning');
      return;
    }
    const selectedData = selectedNodes[0].data;

    if (selectedData.__isNew) {
      this.gridApi.applyTransaction({ remove: [selectedData] });
      return;
    }

    const confirm = await alerts.confirmAlert('Eliminar', '¿Está seguro?', 'warning', 'Sí, eliminar');
    if (confirm.isConfirmed) {
      try {
        await lastValueFrom(this.detailedPermissionsService.deleteDetailedPermissions(selectedData.id));
        alerts.basicAlert('Éxito', 'Registro eliminado', 'success');
        this.loadData();
      } catch (error) {
        console.error(error);
        alerts.basicAlert('Error', 'Error al eliminar', 'error');
      }
    }
  
    this.cdr.detectChanges();}

  filterById(selectedId: any) {
    if (this.gridApi) {
      const filterModel = {
        id: {
          type: 'equals',
          filter: selectedId,
        },
      };
      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();
    } else {
      alert('gridApi no disponible');
    }
  }
}
