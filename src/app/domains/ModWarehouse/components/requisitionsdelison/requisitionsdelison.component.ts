import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ButtonCellRendererComponent } from '../../../ModWareHousesTD/components/inandout-st/button-cell-renderer.component';
import { DetailCellRendererRequisitionsItemsComponent } from './detail-cell-renderer-requisitions-items.component';
import { DetailCellRendererRequisitionsPurchasesComponent } from './detail-cell-renderer-requisitions-purchases.component';
import { SelectDepartmentEditorComponent } from './select-department-editor.component';
import { SelectPersonEditorComponent } from './select-person-editor.component';
import { DepartmentsService } from 'app/services/departments.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';

interface Catalog {
  id: number;
  description: string;
}

@Component({
  selector: 'app-requisitionsdelison',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ButtonCellRendererComponent, DetailCellRendererRequisitionsItemsComponent, DetailCellRendererRequisitionsPurchasesComponent, SelectDepartmentEditorComponent, SelectPersonEditorComponent],
  templateUrl: './requisitionsdelison.component.html',
  styleUrl: './requisitionsdelison.component.scss',
  styles: [`
    /* Se añade el estilo aquí para que el componente hijo (detail grid) pueda usarlo */
    :host ::ng-deep .detail-purchase-row {
      background-color: #fce4ec !important; /* Color rosa claro */
      color: black !important;
    }
  `]
})
export class RequisitionsDelisonComponent implements OnInit {

  // Inject services
  private departmentsService = inject(DepartmentsService);
  private signalsService = inject(SignalsService);

  private gridApi!: GridApi;

  rowData: any[] = [];
  fullRowData: any[] = []; // Store original unfiltered data
  gridHeight: string = '80vh';
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  expandedRowId: string | null = null;

  idRoot: number = null;
  departamentos: any[] = [];
  persons: any[] = [];

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.obtenerDepartamentos();
    this.loadPersons();
    this.loadRequisitions();
  }

  obtenerDepartamentos() {
    this.departmentsService.getDepartments(this.idRoot).subscribe(
      (data: Catalog[]) => {
        this.departamentos = data;
        console.log(this.departamentos);
      },
      (error) => console.error('Error fetching departments:', error)
    );
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
          { id: 1, article: 'Artículo 1', quantity: 10, recurrent: 'Recurrente', comment: 'Comentario detalle 1', pedimiento: false, requisicion: false, saved: false },
          { id: 2, article: 'Artículo 2', quantity: 5, recurrent: 'Nuevo', comment: 'Comentario detalle 2', pedimiento: false, requisicion: false, saved: false }
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
          { id: 3, article: 'Artículo 3', quantity: 20, recurrent: 'Recurrente', comment: 'Comentario detalle 3', pedimiento: false, requisicion: false, saved: false }
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
          { id: 4, article: 'Artículo 4', quantity: 15, recurrent: 'Nuevo', comment: 'Comentario detalle 4', pedimiento: false, requisicion: false, saved: false },
          { id: 5, article: 'Artículo 5', quantity: 8, recurrent: 'Recurrente', comment: 'Comentario detalle 5', pedimiento: false, requisicion: false, saved: false },
          { id: 6, article: 'Artículo 6', quantity: 12, recurrent: 'Nuevo', comment: 'Comentario detalle 6', pedimiento: false, requisicion: false, saved: false }
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
          { id: 7, article: 'Artículo 7', quantity: 25, recurrent: 'Recurrente', comment: 'Comentario detalle 7', pedimiento: false, requisicion: false, saved: false }
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
          { id: 8, article: 'Artículo 8', quantity: 30, recurrent: 'Nuevo', comment: 'Comentario detalle 8', pedimiento: false, requisicion: false, saved: false },
          { id: 9, article: 'Artículo 9', quantity: 18, recurrent: 'Recurrente', comment: 'Comentario detalle 9', pedimiento: false, requisicion: false, saved: false }
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
          { id: 10, article: 'Artículo 10', quantity: 7, recurrent: 'Recurrente', comment: 'Comentario detalle 10', pedimiento: false, requisicion: false, saved: false }
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
          { id: 11, article: 'Artículo 11', quantity: 22, recurrent: 'Nuevo', comment: 'Comentario detalle 11', pedimiento: false, requisicion: false, saved: false },
          { id: 12, article: 'Artículo 12', quantity: 14, recurrent: 'Recurrente', comment: 'Comentario detalle 12', pedimiento: false, requisicion: false, saved: false },
          { id: 13, article: 'Artículo 13', quantity: 9, recurrent: 'Nuevo', comment: 'Comentario detalle 13', pedimiento: false, requisicion: false, saved: false },
          { id: 14, article: 'Artículo 14', quantity: 16, recurrent: 'Recurrente', comment: 'Comentario detalle 14', pedimiento: false, requisicion: false, saved: false }
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
          { id: 15, article: 'Artículo 15', quantity: 11, recurrent: 'Nuevo', comment: 'Comentario detalle 15', pedimiento: false, requisicion: false, saved: false }
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
          { id: 16, article: 'Artículo 16', quantity: 28, recurrent: 'Recurrente', comment: 'Comentario detalle 16', pedimiento: false, requisicion: false, saved: false },
          { id: 17, article: 'Artículo 17', quantity: 6, recurrent: 'Nuevo', comment: 'Comentario detalle 17', pedimiento: false, requisicion: false, saved: false }
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
        pedimentos: [],
        detailData: [
          { id: 18, article: 'Artículo 18', quantity: 19, recurrent: 'Recurrente', comment: 'Comentario detalle 18', pedimiento: false, requisicion: false, saved: false },
          { id: 19, article: 'Artículo 19', quantity: 13, recurrent: 'Nuevo', comment: 'Comentario detalle 19', pedimiento: false, requisicion: false, saved: false },
          { id: 20, article: 'Artículo 20', quantity: 24, recurrent: 'Recurrente', comment: 'Comentario detalle 20', pedimiento: false, requisicion: false, saved: false }
        ]
      }
    ];
    this.rowData = [...this.fullRowData];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 700,
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
      if (params.data.isExpanded) {
        return 'expanded-pink';
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
            options: this.departamentos
          };
        },
        valueFormatter: (params) => {
          const foundItem = this.departamentos
            ? this.departamentos.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
        valueSetter: (params: any) => {
          if (params.newValue && typeof params.newValue === 'object') {
            params.data.departmentId = params.newValue.id;
            params.data.departmentName = params.newValue.name;
            return params.newValue.id;
          }
          return params.newValue;
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
        valueFormatter: (params) => {
          const foundItem = this.persons
            ? this.persons.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.name}` : params.value;
        },
        valueSetter: (params: any) => {
          if (params.newValue && typeof params.newValue === 'object') {
            params.data.personId = params.newValue.id;
            params.data.personName = params.newValue.name;
            return params.newValue.id;
          }
          return params.newValue;
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
        headerName: 'Cumplimiento Pedimento',
        width: 200,
        cellRenderer: (params: any) => {
          const totalItems = params.data.detailData ? params.data.detailData.length : 0;
          const assignedItems = params.data.detailData ? params.data.detailData.filter((item: any) => item.pedimentoNumber).length : 0;
          const percentage = totalItems > 0 ? (assignedItems / totalItems) * 100 : 0;

          let progressBarClass = 'bg-danger'; // Rojo por defecto (0-39%)
          if (percentage === 100) {
            progressBarClass = 'bg-success'; // Verde (100%)
          } else if (percentage >= 80) {
            progressBarClass = 'bg-info'; // Azul (80-99%)
          } else if (percentage >= 40) {
            progressBarClass = 'bg-warning'; // Amarillo (40-79%)
          }

          return `
            <div class="progress" style="height: 20px;">
              <div class="progress-bar ${progressBarClass}" role="progressbar" style="width: ${percentage}%;" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
                ${percentage.toFixed(0)}%
              </div>
            </div>
          `;
        },
        editable: false
      },
      {
        field: 'column8',
        headerName: 'Cumplimiento Requisicion',
        width: 180,
        cellRenderer: (params: any) => {
          const totalItems = params.data.detailData ? params.data.detailData.length : 0;
          const savedItems = params.data.detailData ? params.data.detailData.filter((item: any) => item.saved === true).length : 0;
          const percentage = totalItems > 0 ? (savedItems / totalItems) * 100 : 0;

          return `
            <div class="progress" style="height: 20px;">
              <div class="progress-bar" role="progressbar" style="width: ${percentage}%; background-color: lightgreen;" aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
                ${percentage.toFixed(0)}%
              </div>
            </div>
          `;
        },
        editable: false
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
        event.data.isExpanded = false;

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
              otherNode.data.isExpanded = false;
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
        event.data.isExpanded = true;

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
          save: (requisitionId: number, data: any[], showAlert: boolean = true) => {
            const row = this.rowData.find(r => r.id === requisitionId);
            if (row) {
              row.detailData = data;
              row.articlesCount = data.length;
              this.gridApi.refreshCells({ force: true });
              if (showAlert) {
                alerts.basicAlert('Guardado', 'Los detalles han sido guardados correctamente', 'success');
              }
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
          },
          // Nueva función para forzar la actualización de la fila maestra
          refreshMasterRow: (requisitionId: number) => {
            const rowNode = this.gridApi.getRowNode(String(requisitionId));
            if (rowNode) {
              this.gridApi.refreshCells({ rowNodes: [rowNode], force: true });
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
    const newId = Math.max(...this.rowData.map(r => parseInt(r.id) || 0), 0) + 1;
    const newItem = {
      id: newId,
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
      __isNew: false,
    };

    this.rowData = [newItem, ...this.rowData];
    this.hasUnsavedChanges = false; // Simulate saved
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
    // Simulate save
    this.rowData.forEach(row => {
      if (row.__modified) {
        row.__modified = false;
        row.__isNew = false;
      }
    });
    this.hasUnsavedChanges = false;
    alerts.basicAlert('Guardado', 'Los cambios han sido guardados correctamente', 'success');
    this.gridApi.refreshCells({ force: true });
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