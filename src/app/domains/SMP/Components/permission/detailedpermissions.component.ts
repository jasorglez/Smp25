import { Component, OnInit } from '@angular/core';
import { AgGridAngular, ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { Observable, of, lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { MenuService } from 'app/services/menu.service';
import { CommonModule } from '@angular/common';
import { SignalsService } from 'app/services/signals.service';
import { DetailedPermissionsService } from 'app/services/detailedPermissions.service';
import { SubDetailedPermissionsComponent } from './subdetailedpermissions.component';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-detailed-permission',
  standalone: true,
  imports: [
    CommonModule,
    AgGridAngular,
    SubDetailedPermissionsComponent,
  ],
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
  public rowData: any[] = [];
  public gridApi!: GridApi;
  gridHeight: string = '400px';
  public masterId!: number;
  public hasChanges = false;

  public colDefs: ColDef[] = [
    { field: 'id', editable: false,
        width: 70,
        filter: 'agNumberColumnFilter', // Filtro para números (si el ID es numérico)
        filterParams: {
          filterOptions: ['equals'], // Opciones de filtro
        }, },
    { field: 'permissionName', headerName: 'Nombre del Permiso',  flex: 2 , editable: true},
    { field: 'identifier', headerName: 'Identificador', flex: 2 , editable: true},
    { field: 'comment', headerName: 'Comentario', flex: 3, editable: true },
    { 
      field: 'detail', 
      headerName: 'Detalles', 
      flex: 3,
      cellRenderer: (params: ICellRendererParams) => {
        return '<span style="cursor: pointer; text-decoration: underline; color: #0d6efd;">Ver SubDetalles</span>';
      }
    },
    {
      field: 'active',
      headerName: 'Activo',
      flex: 1,
      cellRenderer: (params: ICellRendererParams) => params.value ? 'Sí' : 'No'
    },
  ];


  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true,
    suppressKeyboardEvent: (params) => params.event.key === 'Enter' && params.editing,
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
    onCellKeyDown: (event: any) => {
      if (event.event.key !== 'Enter') return;
      if (event.api.getEditingCells().length === 0) return;
      const editableCols = event.api.getColumns().filter((col: any) => col.getColDef().editable === true);
      const currentIndex = editableCols.findIndex((col: any) => col.getColId() === event.column.getColId());
      const nextCol = editableCols[currentIndex + 1];
      event.api.stopEditing(false);
      if (nextCol) {
        event.api.startEditingCell({ rowIndex: event.rowIndex, colKey: nextCol.getColId() });
      }
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
  }

  refresh(params: ICellRendererParams): boolean {
    return false;
  }

  loadData() {
    this.detailedPermissionsService.getDetailedPermissions(this.masterId).subscribe({
      next: (data) => {
        this.rowData = data || [];
        console.log(this.rowData);
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

  onAdd() {
    const newPermission = {
      id: `temp_${Date.now()}`,
      masterId: this.masterId,
      permissionName: '',
      identifier: '',
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
        const payload = { ...row };
        delete payload.id;
        delete payload.__isNew;
        console.log(payload);
        await lastValueFrom(this.detailedPermissionsService.addDetailedPermissions(payload));
      }

      for (const row of modifiedRows) {
        const payload = {
          id: row.id,
          masterId: row.masterId || this.masterId,
          permissionName: row.permissionName,
          comment: row.comment,
          identifier: row.identifier,
          active: row.active
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
  }

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
  }

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
