import { Component, OnInit, inject, effect } from '@angular/core';
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
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { BranchsService } from 'app/services/branchs.service';
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
  private ocAndReqsService = inject(OcAndReqsService);
  private branchsService = inject(BranchsService);

  private gridApi!: GridApi;

  constructor() {
    // ✅ Usar effect para reaccionar a cambios en el signal de sucursal
    effect(() => {
      const newIdBranch = this.signalsService.getBranchSelectedBySidebar()();

      console.log('🔄 Cambio detectado en idBranch:', newIdBranch);

      // Si cambió el idBranch y es válido, recargar requisiciones
      if (newIdBranch && newIdBranch !== this.idBranch) {
        this.idBranch = newIdBranch;
        console.log('✅ Nueva sucursal seleccionada:', this.idBranch);

        // ✅ Esperar a que se carguen las sucursales antes de cargar requisiciones
        if (this.branchesLoaded) {
          console.log('✅ Sucursales ya cargadas, cargando requisiciones inmediatamente');
          this.loadRequisitions();
        } else {
          console.log('⏳ Esperando a que se carguen las sucursales...');
          // Guardar el idBranch para cargarlo después
        }
      } else if (!newIdBranch) {
        // Si no hay sucursal seleccionada, limpiar datos y mostrar alerta
        this.idBranch = null;
        this.fullRowData = [];
        this.rowData = [];

        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', []);
        }

        console.warn('⚠️ No hay sucursal seleccionada');
        alerts.basicAlert(
          'Sucursal requerida',
          'Por favor, seleccione una sucursal en el sidebar para ver las requisiciones',
          'warning'
        );
      }
    });
  }

  rowData: any[] = [];
  fullRowData: any[] = []; // Store original unfiltered data
  gridHeight: string = '80vh';
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  expandedRowId: string | null = null;

  idRoot: number = null;
  idBranch: number = null;
  departamentos: any[] = [];
  branches: any[] = []; // Catálogo de sucursales
  branchesLoaded: boolean = false; // Flag para saber si ya se cargaron las sucursales
  persons: any[] = [];

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();

    console.log('🏢 idRoot:', this.idRoot);
    console.log('ℹ️ El idBranch se obtendrá desde el effect() cuando esté disponible');

    this.loadBranches();
    this.obtenerDepartamentos();
    this.loadPersons();
    // ✅ NO llamar loadRequisitions() aquí - el effect() lo hará automáticamente
  }

  loadBranches() {
    this.branchsService.getBranches(this.idRoot).subscribe({
      next: (data: any[]) => {
        this.branches = data;
        this.branchesLoaded = true;
        console.log('🏪 Sucursales cargadas:', this.branches.length);

        // ✅ Si ya hay un idBranch seleccionado, cargar las requisiciones ahora
        if (this.idBranch) {
          console.log('✅ idBranch ya estaba seleccionado, cargando requisiciones ahora');
          this.loadRequisitions();
        }
      },
      error: (error) => {
        console.error('❌ Error al cargar sucursales:', error);
        this.branches = [];
        this.branchesLoaded = true; // Marcar como cargado aunque haya error
      }
    });
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
    // ✅ Validar que idBranch sea válido antes de hacer la petición
    if (!this.idBranch) {
      console.warn('⚠️ No se puede cargar requisiciones: idBranch no está definido');
      this.fullRowData = [];
      this.rowData = [];
      return;
    }

    console.log('📋 Cargando requisiciones desde el servidor...');
    console.log('   typeReference: branch');
    console.log('   idReference:', this.idBranch);
    console.log('   type: REQUIS');

    // ✅ Llamar al endpoint real
    this.ocAndReqsService.getOcAndReqs('branch', this.idBranch, 'REQUIS').subscribe({
      next: (data: any) => {
        console.log('✅ Datos recibidos del servidor:', data);

        // Mapear los datos del servidor al formato esperado por el grid
        this.fullRowData = Array.isArray(data) ? data.map((req: any) => {
          // ✅ Buscar el nombre de la sucursal usando idReference
          const branch = this.branches.find(b => b.id === req.idReference);
          const branchName = branch?.name || branch?.description || req.idReference?.toString() || '';

          console.log(`📋 Requisición ${req.id}: idReference=${req.idReference} → Sucursal: ${branchName}, countrow: ${req.countrow}`);

          return {
            id: req.id,
            branch: branchName, // Nombre de la sucursal desde el catálogo
            requisitionNumber: req.folio || '', // Número de requisición
            requestDate: req.dateCreate || new Date().toISOString(), // Fecha de creación
            departmentId: req.idDepartament || null,
            departmentName: '', // Se debe buscar en catálogo de departamentos
            personId: null,
            personName: req.solicit || '', // Persona que solicita
            articlesCount: req.countrow || 0, // Cantidad de artículos del servidor
            articleNumber: '',
            comments: req.comments || '',
            column8: req.priority || '', // Prioridad
            purchasesCount: 0,
            detailType: null,
            detailData: [], // Se cargará después con getReqItems()
            purchasesData: [],
            // Campos adicionales del servidor
            delivery: req.delivery || '',
            deliveryTime: req.deliveryTime || '',
            typeOc: req.typeOc || '',
            dateSupply: req.dateSupply || '',
            idPayment: req.idPayment || null,
            idCurrency: req.idCurrency || null,
            conditions: req.conditions || '',
            close: req.close || false,
            active: req.active || true,
            // Guardar el idReference original para referencia
            idReference: req.idReference
          };
        }) : [];

        this.rowData = [...this.fullRowData];

        console.log('✅ Requisiciones cargadas:', this.fullRowData.length);

        // Refrescar el grid si ya existe
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
          // Forzar actualización de las columnas para que muestren los nombres correctos
          this.gridApi.refreshCells({ force: true });
        }
      },
      error: (error) => {
        console.error('❌ Error al cargar requisiciones:', error);
        alerts.basicAlert('Error', 'No se pudieron cargar las requisiciones', 'error');

        // En caso de error, inicializar con array vacío
        this.fullRowData = [];
        this.rowData = [];
      }
    });
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
        editable: false, // No editable - viene del servidor
        valueFormatter: (params: any) => {
          // Asegurar que siempre se muestre el nombre, no el ID
          if (typeof params.value === 'number') {
            const branch = this.branches.find(b => b.id === params.value);
            return branch?.name || branch?.description || params.value?.toString() || '';
          }
          return params.value || '';
        }
      },
      {
        field: 'requisitionNumber',
        headerName: '# Requisicion',
        width: 120,
        filter: true,
        editable: () => !!this.idBranch, // Solo editable si hay branch seleccionado
        valueSetter: (params: any) => {
          params.data.requisitionNumber = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'requestDate',
        headerName: 'Fecha solicitud',
        width: 120,
        editable: () => !!this.idBranch, // Solo editable si hay branch seleccionado
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
        editable: () => !!this.idBranch, // Solo editable si hay branch seleccionado
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
        editable: () => !!this.idBranch, // Solo editable si hay branch seleccionado
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