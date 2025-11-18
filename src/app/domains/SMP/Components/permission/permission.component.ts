import { Component, OnInit } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ClientSideRowModelModule, MasterDetailModule } from 'ag-grid-enterprise';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MenuService } from 'app/services/menu.service';
import { CommonModule } from '@angular/common';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-permission',
  standalone: true,
  imports: [
    CommonModule,
    AgGridAngular,
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
  // Registra el módulo necesario para el renderizado de Maestro/Detalle
  public modules = [ClientSideRowModelModule, MasterDetailModule];
  public rowData$!: Observable<any[]>;
  public gridApi!: GridApi;
  gridHeight: string = '70vh';

  public colDefs: ColDef[] = [
    { field: 'permissionName', headerName: 'Nombre del Permiso', cellRenderer: 'agGroupCellRenderer', flex: 2 },
    { field: 'identifier', headerName: 'Identificador', flex: 2 },
    { field: 'comment', headerName: 'Comentario', flex: 3 },
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
  };

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    masterDetail: true,
    isRowMaster: (dataItem) => {
      return dataItem.detailData && dataItem.detailData.length > 0;
    },
    detailCellRendererParams: {
      detailGridOptions: {
        columnDefs: [
          { field: 'permissionName', headerName: 'Nombre del Permiso', flex: 1 },
          { field: 'identifier', headerName: 'Identificador', flex: 1 }
        ],
        rowHeight: 18,
        headerHeight: 20,
        cssClass: 'small-text-ag-grid'
      },
      getDetailRowData: (params) => {
        params.successCallback(params.data.detailData);
      }
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
    onFirstDataRendered: (params) => {
      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });
      params.api.autoSizeColumns(allColumnIds, false);
    },
  };


  constructor(private menuService: MenuService, private signalsService: SignalsService) {}

  ngOnInit(): void {
    this.rowData$ = this.menuService.getDetails(0).pipe(
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
    );
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
  }

  onAdd() {
    const newPermission = {
      id: `temp_${Date.now()}`,
      permissionName: '',
      identifier: '',
      active: true,
      comment: '',
      detailData: []
    };
    // Since rowData$ is Observable, we need to handle it differently
    // For demo, assume we can modify the data
    // But since it's processed, perhaps reload
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
        // Add new master
        masters[newPermission.id] = newPermission;
        return Object.values(masters);
      })
    ).subscribe(newData => {
      // Update the grid
      this.gridApi.setGridOption('rowData', newData);
    });
  }

  onEdit() { console.log('Edit selected permission'); }
  onDelete() { console.log('Delete selected permission'); }

}
