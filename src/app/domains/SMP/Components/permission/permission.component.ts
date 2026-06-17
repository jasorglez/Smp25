import { Component, OnInit, inject, ChangeDetectorRef} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { Observable, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { MenuService } from 'app/services/menu.service';
import { CommonModule } from '@angular/common';
import { SignalsService } from 'app/services/signals.service';
import { DetailedPermissionsComponent } from './detailedpermissions.component';
import { MasterPermissionsService } from 'app/services/masterPermissions.service';
import { alerts } from 'app/helpers/alerts';
import { effect } from '@angular/core';
import { MaterialIconPickerCellEditorComponent } from './material-icon-picker-cell-editor.component';

@Component({
  selector: 'app-permission',
  standalone: true,
  imports: [
    CommonModule,
    AgGridAngular,
    DetailedPermissionsComponent,
    MaterialIconPickerCellEditorComponent,
  ],
  templateUrl: './permission.component.html',
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

export class PermissionComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);

  public rowData$!: Observable<any[]>;
  public gridApi!: GridApi;
  gridHeight: string = '70vh';
  masterNotSavedChanges: boolean = false;
  selectedPermission: any = null;

  /** Columnas editables en orden: Enter pasa a la siguiente. */
  private readonly enterNavEditableColumns = ['permissionName', 'identifier', 'route', 'comment'];
  private enterKeyAdvanceNextColumn = false;

  public colDefs: ColDef[] = [
    {
        field: 'id',
        headerName: 'Id',
        editable: false,
        width: 50,
        filter: 'agNumberColumnFilter', // Filtro para números (si el ID es numérico)
        filterParams: {
          filterOptions: ['equals'], // Opciones de filtro
        },
      },
    { field: 'permissionName', headerName: 'Nombre', flex: 2, editable: true },
    { field: 'identifier',     headerName: 'Identificador', flex: 2, editable: true },
    { field: 'route',          headerName: 'Ruta', flex: 2, editable: true },
    {
      field: 'icon', headerName: 'Icono', flex: 2, editable: true,
      cellEditor: MaterialIconPickerCellEditorComponent,
      cellEditorPopup: true,
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) return '';
        return `<span class="material-icons" style="font-size:16px;vertical-align:middle;margin-right:4px;">${params.value}</span><small>${params.value}</small>`;
      },
    },
    {
      field: 'showInSidebar', headerName: 'Sidebar', width: 75, editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: [true, false] },
      cellRenderer: (params: ICellRendererParams) => params.value ? '✅' : '—',
    },
    { field: 'comment', headerName: 'Comentario', flex: 3, editable: true },
    {
      field: 'detail', headerName: 'Detalles', width: 80,
      cellRenderer: (params: ICellRendererParams) =>
        '<span style="cursor:pointer;text-decoration:underline;color:#0d6efd;">Ver Detalles</span>',
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
    detailCellRenderer: DetailedPermissionsComponent,
    detailRowHeight: 400,
    detailCellRendererParams: {
      getDetailRowData: (params) => {
        params.successCallback(params.data.detailData);
      },
    },
    isRowMaster: (dataItem) => {
      return true;
    },
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
      this.masterNotSavedChanges = true;
    },
  };


  idCompany: number = 0;

  constructor(private menuService: MenuService, private signalsService: SignalsService, private masterPermissionsService: MasterPermissionsService) {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
    });
  }

  ngOnInit(): void {
    this.refreshData();
  }

  refreshData() {
    this.rowData$ = this.masterPermissionsService.getMasterPermissions().pipe(
      map((data: any[]) => {
        return data.map((item) => ({
          id: item.id,
          permissionName: item.permissionName,
          identifier: item.identifier,
          active: item.active,
          comment: item.comment,
          route: item.route ?? null,
          icon: item.icon ?? null,
          showInSidebar: item.showInSidebar ?? false,
          detailData: item.detailedPermissions || [],
        }));
      })
    );
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

  onSelectionChanged(event: any): void {
    const selectedNodes = this.gridApi.getSelectedNodes();
    this.selectedPermission = selectedNodes.length > 0 ? selectedNodes[0].data : null;
  }

  onAdd() {
    const newPermission = {
      permissionName: '',
      identifier: '',
      active: true,
      comment: '',
      detailData: [],
      __isNew: true
    };
    this.gridApi.applyTransaction({ add: [newPermission], addIndex: 0 });
    this.masterNotSavedChanges = true;
    setTimeout(() => {
      this.gridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'permissionName'
      });
    }, 100);
  }

  onEdit() {
    if (!this.selectedPermission) {
      alerts.basicAlert('Aviso', 'Selecciona un permiso de la lista para editar', 'info');
      return;
    }
    // Buscar el nodo actual en el grid
    let targetNode: any = null;
    this.gridApi.forEachNode((node) => {
      if (node.data === this.selectedPermission || node.data.id === this.selectedPermission.id) {
        targetNode = node;
      }
    });
    if (targetNode) {
      targetNode.setSelected(true);
      this.gridApi.startEditingCell({
        rowIndex: targetNode.rowIndex!,
        colKey: 'permissionName'
      });
    }
  }

  async onDelete() { 
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) return;

    const selectedData = selectedNodes[0].data;
    
    const subCount = (selectedData.detailData || []).length;
    const subMsg = subCount > 0
      ? `\n⚠️ Este permiso tiene ${subCount} sub-permiso(s) asociado(s). También serán desactivados.`
      : '';

    const confirm = await alerts.confirmAlert(
      'Eliminar',
      `¿Está seguro de eliminar el permiso ${selectedData.permissionName || 'seleccionado'}?${subMsg}`,
      'warning',
      'Sí, eliminar'
    );

    if (confirm.isConfirmed) {
      if (selectedData.__isNew) {
        this.gridApi.applyTransaction({ remove: [selectedData] });
        return;
      }

      try {
        await firstValueFrom(this.masterPermissionsService.deleteMasterPermissions(selectedData.id));
        alerts.basicAlert('Éxito', 'Permiso eliminado', 'success');
        this.refreshData();
      } catch (error) {
        console.error(error);
        alerts.basicAlert('Error', 'No se pudo eliminar', 'error');
      }
    }
  
    this.cdr.detectChanges();}

  async saveMaster() {
    const newRows: any[] = [];
    const modifiedRows: any[] = [];

    this.gridApi.forEachNode((node) => {
      if (node.data.__isNew) {
        newRows.push(node.data);
      } else if (node.data.__modified) {
        modifiedRows.push(node.data);
      }
    });

    if (newRows.length === 0 && modifiedRows.length === 0) {
      return;
    }

    try {
      const promises = [];
      
      // Create
      for (const row of newRows) {
        const payload = {
          permissionName: row.permissionName,
          comment: row.comment,
          identifier: row.identifier,
          active: row.active,
          route: row.route ?? null,
          icon: row.icon ?? null,
          showInSidebar: row.showInSidebar ?? false,
          detailedPermissions: row.detailData || []
        };
        promises.push(firstValueFrom(this.masterPermissionsService.addMasterPermissions(payload, this.idCompany)));
      }

      // Update
      for (const row of modifiedRows) {
        const payload = {
          id: row.id,
          permissionName: row.permissionName,
          comment: row.comment,
          identifier: row.identifier,
          active: row.active,
          route: row.route ?? null,
          icon: row.icon ?? null,
          showInSidebar: row.showInSidebar ?? false,
          detailedPermissions: row.detailData || []
        };
        promises.push(firstValueFrom(this.masterPermissionsService.updateMasterPermissions(row.id, payload)));
      }

      await Promise.all(promises);
      
      alerts.basicAlert('Éxito', 'Cambios guardados correctamente', 'success');
      this.masterNotSavedChanges = false;
      this.refreshData();
    } catch (error) {
      console.error(error);
      alerts.basicAlert('Error', 'Error al guardar cambios', 'error');
    }
  
    this.cdr.detectChanges();}

}
