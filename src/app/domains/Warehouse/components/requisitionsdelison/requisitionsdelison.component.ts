import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ButtonCellRendererComponent } from '../../../ModWareHousesTD/components/entry-st/button-cell-renderer.component';
import { DetailCellRendererRequisitionsItemsComponent } from './detail-cell-renderer-requisitions-items.component';
import { DetailCellRendererRequisitionsPurchasesComponent } from './detail-cell-renderer-requisitions-purchases.component';
import { SelectDepartmentEditorComponent } from './select-department-editor.component';
import { SelectPersonEditorComponent } from './select-person-editor.component';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-requisitionsdelison',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ButtonCellRendererComponent, DetailCellRendererRequisitionsItemsComponent, DetailCellRendererRequisitionsPurchasesComponent, SelectDepartmentEditorComponent, SelectPersonEditorComponent],
  templateUrl: './requisitionsdelison.component.html',
  styleUrl: './requisitionsdelison.component.scss'
})
export class RequisitionsDelisonComponent implements OnInit {

  private gridApi!: GridApi;

  rowData: any[] = [];
  fullRowData: any[] = []; // Store original unfiltered data
  gridHeight: string = '80vh';
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  expandedRowId: string | null = null;
  selectedBranchFilter: string = '';

  departments: any[] = [];
  persons: any[] = [];

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    this.loadDepartments();
    this.loadPersons();
    this.loadRequisitions();
  }

  loadDepartments() {
    // Mock data for departments
    this.departments = [
      { id: 1, name: 'Departamento 1' },
      { id: 2, name: 'Departamento 2' },
      { id: 3, name: 'Departamento 3' }
    ];
  }

  loadPersons() {
    // Mock data for persons
    this.persons = [
      { id: 1, name: 'Persona 1' },
      { id: 2, name: 'Persona 2' },
      { id: 3, name: 'Persona 3' }
    ];
  }

  loadRequisitions() {
    // Mock data for requisitions - 10 records
    this.fullRowData = [
      {
        id: 1,
        branch: 'BODEGAS',
        requisitionNumber: 'REQ001',
        requestDate: new Date().toISOString(),
        departmentId: 1,
        departmentName: 'Departamento 1',
        personId: 1,
        personName: 'Persona 1',
        articlesCount: 2,
        articleNumber: 'ART001',
        comments: 'Comentario 1',
        column8: 'Valor 8',
        purchasesCount: 2,
        detailType: null,
        detailData: [
          { id: 1, article: 'Artículo 1', quantity: 10, recurrent: 'Recurrente', comment: 'Comentario detalle 1' },
          { id: 2, article: 'Artículo 2', quantity: 5, recurrent: 'Nuevo', comment: 'Comentario detalle 2' }
        ],
        purchasesData: [
          { id: 1, supplier: 'PROVEEDOR A', amount: 15000 },
          { id: 2, supplier: 'PROVEEDOR B', amount: 25000 }
        ]
      },
      {
        id: 2,
        branch: 'DELI',
        requisitionNumber: 'REQ002',
        requestDate: new Date().toISOString(),
        departmentId: 2,
        departmentName: 'Departamento 2',
        personId: 2,
        personName: 'Persona 2',
        articlesCount: 1,
        articleNumber: 'ART002',
        comments: 'Comentario 2',
        column8: 'Valor 8b',
        detailType: null,
        detailData: [
          { id: 3, article: 'Artículo 3', quantity: 20, recurrent: 'Recurrente', comment: 'Comentario detalle 3' }
        ]
      },
      {
        id: 3,
        branch: 'TIENDA 1',
        requisitionNumber: 'REQ003',
        requestDate: new Date().toISOString(),
        departmentId: 1,
        departmentName: 'Departamento 1',
        personId: 3,
        personName: 'Persona 3',
        articlesCount: 3,
        articleNumber: 'ART003',
        comments: 'Comentario 3',
        column8: 'Valor 8c',
        detailType: null,
        detailData: [
          { id: 4, article: 'Artículo 4', quantity: 15, recurrent: 'Nuevo', comment: 'Comentario detalle 4' },
          { id: 5, article: 'Artículo 5', quantity: 8, recurrent: 'Recurrente', comment: 'Comentario detalle 5' },
          { id: 6, article: 'Artículo 6', quantity: 12, recurrent: 'Nuevo', comment: 'Comentario detalle 6' }
        ]
      },
      {
        id: 4,
        branch: 'TIENDA DELI',
        requisitionNumber: 'REQ004',
        requestDate: new Date().toISOString(),
        departmentId: 3,
        departmentName: 'Departamento 3',
        personId: 1,
        personName: 'Persona 1',
        articlesCount: 1,
        articleNumber: 'ART004',
        comments: 'Comentario 4',
        column8: 'Valor 8d',
        detailType: null,
        detailData: [
          { id: 7, article: 'Artículo 7', quantity: 25, recurrent: 'Recurrente', comment: 'Comentario detalle 7' }
        ]
      },
      {
        id: 5,
        branch: 'BODEGAS',
        requisitionNumber: 'REQ005',
        requestDate: new Date().toISOString(),
        departmentId: 2,
        departmentName: 'Departamento 2',
        personId: 2,
        personName: 'Persona 2',
        articlesCount: 2,
        articleNumber: 'ART005',
        comments: 'Comentario 5',
        column8: 'Valor 8e',
        detailType: null,
        detailData: [
          { id: 8, article: 'Artículo 8', quantity: 30, recurrent: 'Nuevo', comment: 'Comentario detalle 8' },
          { id: 9, article: 'Artículo 9', quantity: 18, recurrent: 'Recurrente', comment: 'Comentario detalle 9' }
        ]
      },
      {
        id: 6,
        branch: 'DELI',
        requisitionNumber: 'REQ006',
        requestDate: new Date().toISOString(),
        departmentId: 1,
        departmentName: 'Departamento 1',
        personId: 3,
        personName: 'Persona 3',
        articlesCount: 1,
        articleNumber: 'ART006',
        comments: 'Comentario 6',
        column8: 'Valor 8f',
        detailType: null,
        detailData: [
          { id: 10, article: 'Artículo 10', quantity: 7, recurrent: 'Recurrente', comment: 'Comentario detalle 10' }
        ]
      },
      {
        id: 7,
        branch: 'TIENDA 1',
        requisitionNumber: 'REQ007',
        requestDate: new Date().toISOString(),
        departmentId: 3,
        departmentName: 'Departamento 3',
        personId: 1,
        personName: 'Persona 1',
        articlesCount: 4,
        articleNumber: 'ART007',
        comments: 'Comentario 7',
        column8: 'Valor 8g',
        detailType: null,
        detailData: [
          { id: 11, article: 'Artículo 11', quantity: 22, recurrent: 'Nuevo', comment: 'Comentario detalle 11' },
          { id: 12, article: 'Artículo 12', quantity: 14, recurrent: 'Recurrente', comment: 'Comentario detalle 12' },
          { id: 13, article: 'Artículo 13', quantity: 9, recurrent: 'Nuevo', comment: 'Comentario detalle 13' },
          { id: 14, article: 'Artículo 14', quantity: 16, recurrent: 'Recurrente', comment: 'Comentario detalle 14' }
        ]
      },
      {
        id: 8,
        branch: 'TIENDA DELI',
        requisitionNumber: 'REQ008',
        requestDate: new Date().toISOString(),
        departmentId: 2,
        departmentName: 'Departamento 2',
        personId: 2,
        personName: 'Persona 2',
        articlesCount: 1,
        articleNumber: 'ART008',
        comments: 'Comentario 8',
        column8: 'Valor 8h',
        detailType: null,
        detailData: [
          { id: 15, article: 'Artículo 15', quantity: 11, recurrent: 'Nuevo', comment: 'Comentario detalle 15' }
        ]
      },
      {
        id: 9,
        branch: 'BODEGAS',
        requisitionNumber: 'REQ009',
        requestDate: new Date().toISOString(),
        departmentId: 1,
        departmentName: 'Departamento 1',
        personId: 3,
        personName: 'Persona 3',
        articlesCount: 2,
        articleNumber: 'ART009',
        comments: 'Comentario 9',
        column8: 'Valor 8i',
        detailType: null,
        detailData: [
          { id: 16, article: 'Artículo 16', quantity: 28, recurrent: 'Recurrente', comment: 'Comentario detalle 16' },
          { id: 17, article: 'Artículo 17', quantity: 6, recurrent: 'Nuevo', comment: 'Comentario detalle 17' }
        ]
      },
      {
        id: 10,
        branch: 'DELI',
        requisitionNumber: 'REQ010',
        requestDate: new Date().toISOString(),
        departmentId: 3,
        departmentName: 'Departamento 3',
        personId: 1,
        personName: 'Persona 1',
        articlesCount: 3,
        articleNumber: 'ART010',
        comments: 'Comentario 10',
        column8: 'Valor 8j',
        detailType: null,
        detailData: [
          { id: 18, article: 'Artículo 18', quantity: 19, recurrent: 'Recurrente', comment: 'Comentario detalle 18' },
          { id: 19, article: 'Artículo 19', quantity: 13, recurrent: 'Nuevo', comment: 'Comentario detalle 19' },
          { id: 20, article: 'Artículo 20', quantity: 24, recurrent: 'Recurrente', comment: 'Comentario detalle 20' }
        ]
      }
    ];
    this.applyBranchFilter();
  }

  applyBranchFilter() {
    if (this.selectedBranchFilter) {
      this.rowData = this.fullRowData.filter(item => item.branch === this.selectedBranchFilter);
    } else {
      this.rowData = [...this.fullRowData];
    }
  }

  onBranchFilterChange(branch: string) {
    this.selectedBranchFilter = branch;
    this.applyBranchFilter();
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 400,
    isRowMaster: (dataItem: any) => true,
    detailCellRenderer: DetailCellRendererRequisitionsItemsComponent,
    getRowClass: (params: any) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      if (params.data.__isNew) {
        return 'new-row-highlight';
      }
      if (params.data.__modified) {
        return 'modified-row';
      }
      return '';
    },
    onRowSelected: (event: any) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
    onCellValueChanged: (event: any) => {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
      setTimeout(() => {
        this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
      }, 0);
    }
  };

  get colMaster(): ColDef[] {
    return [
      {
        field: 'branch',
        headerName: 'Sucursal',
        width: 120,
        editable: (params: any) => params.data.__isNew === true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['BODEGAS', 'DELI', 'TIENDA 1', 'TIENDA DELI']
        },
        valueSetter: (params: any) => {
          params.data.branch = params.newValue;
          return true;
        }
      },
      {
        field: 'requisitionNumber',
        headerName: '# Requisicion',
        width: 120,
        filter: true,
        editable: true,
        valueSetter: (params: any) => {
          params.data.requisitionNumber = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'requestDate',
        headerName: 'Fecha solicitud',
        width: 120,
        editable: true,
        valueFormatter: (params: any) => {
          if (!params.value) return '';
          return new Date(params.value).toLocaleDateString();
        },
        valueSetter: (params: any) => {
          params.data.requestDate = params.newValue;
          return true;
        }
      },
      {
        field: 'departmentName',
        headerName: 'Departamento que solicita',
        width: 200,
        editable: true,
        cellEditor: 'selectDepartmentEditor',
        cellEditorParams: (params: any) => {
          return {
            options: this.departments
          };
        },
        valueFormatter: (params: any) => {
          return params.value || '';
        },
        valueSetter: (params: any) => {
          if (params.newValue && typeof params.newValue === 'object') {
            params.data.departmentId = params.newValue.id;
            params.data.departmentName = params.newValue.name;
          }
          return true;
        }
      },
      {
        field: 'personName',
        headerName: 'Persona que solicita',
        width: 200,
        editable: true,
        cellEditor: 'selectPersonEditor',
        cellEditorParams: (params: any) => {
          return {
            options: this.persons
          };
        },
        valueFormatter: (params: any) => {
          return params.value || '';
        },
        valueSetter: (params: any) => {
          if (params.newValue && typeof params.newValue === 'object') {
            params.data.personId = params.newValue.id;
            params.data.personName = params.newValue.name;
          }
          return true;
        }
      },
      {
        field: 'articlesCount',
        headerName: 'Articulos que solicita',
        width: 150,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleCascade(node),
        },
        valueGetter: params => params.data.articlesCount || 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'comments',
        headerName: 'Cumplimiento',
        width: 300,
        editable: true,
        valueSetter: (params: any) => {
          params.data.comments = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'column8',
        headerName: 'Column8',
        width: 120,
        editable: true,
        valueSetter: (params: any) => {
          params.data.column8 = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
    ];
  }

  onCellClicked(event: any): void {
    event.node.setSelected(true);

    const colId = event.column.getColId();
    const isDetailColumn = colId === 'articlesCount';

    if (isDetailColumn) {
      const node = event.node;
      const api = event.api;

      if (this.expandedRowId === node.id && event.data.detailType === 'items') {
        // Si ya está expandido, colapsarlo y mostrar todas las filas
        node.setExpanded(false);
        this.expandedRowId = null;
        event.data.detailType = null;

        api.forEachNode((otherNode: any) => {
          otherNode.setRowHeight(undefined);
        });
        api.onRowHeightChanged();
        api.redrawRows();
      } else {
        // Colapsar cualquier otra fila expandida
        if (this.expandedRowId) {
          api.forEachNode((otherNode: any) => {
            if (otherNode.id === this.expandedRowId) {
              otherNode.setExpanded(false);
            }
          });
        }

        // Ocultar todas las demás filas (altura 0)
        api.forEachNode((otherNode: any) => {
          if (otherNode.id !== node.id) {
            otherNode.setRowHeight(0);
          }
        });

        // Cambiar el tipo de detalle
        event.data.detailType = 'items';
        this.expandedRowId = node.id;

        // Aplicar los cambios de altura
        api.onRowHeightChanged();
        api.redrawRows();

        // Expandir con el detalle correspondiente
        setTimeout(() => {
          node.setExpanded(true);
        }, 0);
      }
    }
  }

  toggleCascade(node: any) {
    const event = {
      node: node,
      api: this.gridApi,
      data: node.data,
      column: { getColId: () => 'articlesCount' }
    };
    this.onCellClicked(event);
  }



  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;

    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params: any) => {
        params.successCallback(params.data.detailData);
      },
      context: {
        componentParent: this,
        gridApi: this.gridApi,
        ITEMS: {
          load: (requisitionId: number, callback: (data: any[]) => void) => {
            const row = this.rowData.find(r => r.id === requisitionId);
            callback(row ? row.detailData || [] : []);
          },
          save: (requisitionId: number, data: any[]) => {
            const row = this.rowData.find(r => r.id === requisitionId);
            if (row) {
              row.detailData = data;
              row.articlesCount = data.length;
              this.gridApi.refreshCells({ force: true });
              alerts.basicAlert('Guardado', 'Los detalles han sido guardados correctamente', 'success');
            }
          },
          delete: (params: any, callback: () => void) => {
            // Mock delete
            callback();
          },
          updateCount: (requisitionId: number, count: number) => {
            const row = this.rowData.find(r => r.id === requisitionId);
            if (row) {
              row.articlesCount = count;
              this.gridApi.refreshCells({ force: true });
            }
          }
        },
        PURCHASES: {
          load: (requisitionId: number, callback: (data: any[]) => void) => {
            const row = this.rowData.find(r => r.id === requisitionId);
            callback(row ? row.purchasesData || [] : []);
          },
          save: (requisitionId: number, data: any[]) => {
            const row = this.rowData.find(r => r.id === requisitionId);
            if (row) {
              row.purchasesData = data;
              this.gridApi.refreshCells({ force: true });
              alerts.basicAlert('Guardado', 'Las compras han sido guardadas correctamente', 'success');
            }
          },
          delete: (params: any, callback: () => void) => {
            // Mock delete
            callback();
          },
          updateCount: (requisitionId: number, count: number) => {
            // Update count if needed
          }
        }
      }
    });
  }

  onSelectionChanged(event: any): void {
    // Handle selection
  }

  onCellValueChanged(event: any): void {
    this.hasUnsavedChanges = true;
  }

  addRequisition(): void {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      branch: 'BODEGAS',
      requisitionNumber: '',
      requestDate: new Date().toISOString(),
      departmentId: null,
      departmentName: '',
      personId: null,
      personName: '',
      articlesCount: 0,
      articleNumber: '',
      comments: '',
      column8: '',
      detailType: null,
      detailData: [],
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      const firstRowIndex = 0;
      this.gridApi.ensureIndexVisible(firstRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'requisitionNumber'
      });
    }, 0);
  }

  editRequisition(): void {
    // Implement edit
  }

  deleteRequisition(): void {
    // Implement delete
  }

  saveChanges(): void {
    // Implement save
  }

  refreshData(): void {
    this.loadRequisitions();
    this.hasUnsavedChanges = false;
  }

  components = {
    selectDepartmentEditor: SelectDepartmentEditorComponent,
    selectPersonEditor: SelectPersonEditorComponent
  };
}