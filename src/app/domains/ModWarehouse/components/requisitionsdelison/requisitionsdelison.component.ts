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
import { PdfButtonCellRendererComponent } from '../../../ModAdmon/components/egresos-palacio/pdf-button-cell-renderer.component';
import { DepartmentsService } from 'app/services/departments.service';
import { SignalsService } from 'app/services/signals.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { BranchsService } from 'app/services/branchs.service';
import { TypexPrefixesService } from 'app/services/typexprefixes.service';
import { ReceiptsDelisonService } from 'app/services/receipts-delison.service';
import { alerts } from 'app/helpers/alerts';

interface Catalog {
  id: number;
  description: string;
}

@Component({
  selector: 'app-requisitionsdelison',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ButtonCellRendererComponent, DetailCellRendererRequisitionsItemsComponent, DetailCellRendererRequisitionsPurchasesComponent, SelectDepartmentEditorComponent, PdfButtonCellRendererComponent],
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
  private typexPrefixesService = inject(TypexPrefixesService);
  private receiptsDelisonService = inject(ReceiptsDelisonService);

  private gridApi!: GridApi;
  private isGeneratingReport: boolean = false;

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
  currentUserName: string = ''; // Nombre del usuario actual
  selectedRequisitionId: number | null = null; // ID de la requisición seleccionada para PDF

  // Datos del prefijo actual
  currentPrefixData: any = null;

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.currentUserName = this.signalsService.getDisplayName()() || 'Usuario';

    console.log('🏢 idRoot:', this.idRoot);
    console.log('👤 Usuario actual:', this.currentUserName);
    console.log('ℹ️ El idBranch se obtendrá desde el effect() cuando esté disponible');

    this.loadBranches();
    this.obtenerDepartamentos();
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
            solicitedBy: req.solicit || '', // Usuario que solicita
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
    onRowClicked: (event: any) => {
      // 🔵 Excluir la columna PDF para evitar conflictos con el botón
      const clickedColumn = event.column?.getColId();
      if (clickedColumn === 'pdfReport') {
        console.log('🔵 Clic en columna PDF detectado, evitando selección de fila');
        return; // No seleccionar la fila si se hace clic en PDF
      }
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
      console.log('📝 onCellValueChanged disparado:', {
        field: event.colDef.field,
        newValue: event.newValue,
        oldValue: event.oldValue,
        data: event.data
      });

      event.data.__modified = true;
      this.hasUnsavedChanges = true;
      console.log('✅ Fila marcada como modificada, hasUnsavedChanges:', this.hasUnsavedChanges);

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
        field: 'departmentId',
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
          return foundItem ? `${foundItem.description}` : (params.value || '');
        },
        valueSetter: (params: any) => {
          console.log('🔧 valueSetter departmentId - newValue:', params.newValue, 'oldValue:', params.oldValue);

          if (params.newValue && typeof params.newValue === 'object') {
            params.data.departmentId = params.newValue.id;
            params.data.departmentName = params.newValue.name || params.newValue.description;

            console.log('✅ Departamento asignado:', {
              departmentId: params.data.departmentId,
              departmentName: params.data.departmentName,
              isNew: params.data.__isNew
            });

            // Marcar explícitamente como modificado
            if (!params.data.__isNew) {
              params.data.__modified = true;
              console.log('🔴 Marcado como __modified');
            }
            this.hasUnsavedChanges = true;
            console.log('💾 hasUnsavedChanges = true');
            return true; // ✅ Retornar true para que AG Grid detecte el cambio
          }

          params.data.departmentId = params.newValue;
          if (!params.data.__isNew) {
            params.data.__modified = true;
          }
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'solicitedBy',
        headerName: 'Solicitado por',
        width: 150,
        editable: false, // No editable - se toma del usuario actual
        valueFormatter: (params) => params.value || this.currentUserName
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
        field: 'pdfReport',
        headerName: 'PDF',
        width: 80,
        cellRenderer: PdfButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => {
            // Validar que no sea una requisición temporal
            if (String(node.data.id).startsWith('temp_')) {
              alerts.basicAlert('Información', 'Debe guardar la requisición antes de generar el PDF', 'info');
              return;
            }
            console.log('🔵 PDF Click detectado desde PdfButtonCellRenderer:', node.data.id);
            this.togglePdfDetail(node);
          },
          icon: 'bi-file-earmark-pdf',
          iconColor: '#dc3545',
          title: 'Hacer clic para generar el reporte PDF'
        },
        editable: false,
        cellStyle: { backgroundColor: '#fff3e0', textAlign: 'center' }
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

  async togglePdfDetail(node: any) {
    // 🔒 Prevenir múltiples clics simultáneos
    if (this.isGeneratingReport) {
      console.log('⚠️ Ya se está generando un reporte, ignorando clic...');
      return;
    }

    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'pdf';

    if (isCurrentlyExpanded) {
      // Si ya está expandido con el PDF, colapsarlo
      node.setExpanded(false);

      // Restaurar alturas de todas las filas
      api.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      api.onRowHeightChanged();
    } else {
      // 🔒 Activar lock
      this.isGeneratingReport = true;
      console.log('🔒 Lock activado - isGeneratingReport = true');

      try {
        // 📊 Mostrar barra de progreso
        alerts.showLoadingWithProgress('Generando reporte', 'Por favor espere...', 0);
        console.log('📊 Progreso: 0%');

        // Simular progreso de generación (incrementos de 10%)
        for (let progress = 10; progress <= 90; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          alerts.updateLoadingProgress('Generando reporte', 'Por favor espere...', progress);
          console.log(`📊 Progreso: ${progress}%`);
        }

        // Colapsar cualquier otra fila expandida
        api.forEachNode((otherNode: any) => {
          if (otherNode.expanded && otherNode.id !== node.id) {
            otherNode.setExpanded(false);
          }
        });

        // Ocultar todas las demás filas
        api.forEachNode((otherNode: any) => {
          if (otherNode.id !== node.id) {
            otherNode.setRowHeight(0);
          }
        });

        // Si la fila está expandida con otro tipo de detalle, cerrarla
        if (node.expanded && node.data.detailType !== 'pdf') {
          node.setExpanded(false);
        }

        // Cambiar el tipo de detalle a 'pdf'
        node.data.detailType = 'pdf';

        // Aplicar cambios de altura
        api.onRowHeightChanged();

        // 📊 Progreso final
        alerts.updateLoadingProgress('Generando reporte', 'Completado', 100);
        console.log('📊 Progreso: 100%');

        // Expandir con el PDF
        setTimeout(() => {
          node.setExpanded(true);
        }, 0);

        // Cerrar alerta después de un delay
        setTimeout(() => {
          alerts.closeLoading();
          console.log('✅ Reporte generado exitosamente');
        }, 800);

      } catch (error) {
        console.error('❌ Error al generar el reporte:', error);
        alerts.basicAlert('Error', 'No se pudo generar el reporte', 'error');
      } finally {
        // 🔓 Liberar lock
        this.isGeneratingReport = false;
        console.log('🔓 Lock liberado - isGeneratingReport = false');
      }
    }
  }

  collapsePdfDetail(requisitionId: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === requisitionId) {
          node.setExpanded(false);
          node.data.detailType = null;
        }
      });

      // Restaurar alturas
      this.gridApi.forEachNode((node) => {
        node.setRowHeight(undefined);
      });
      this.gridApi.onRowHeightChanged();
    }
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
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRequisitionId = selectedNodes[0].data.id;
    } else {
      this.selectedRequisitionId = null;
    }
  }

  onCellValueChanged(event: any): void {
    this.hasUnsavedChanges = true;
  }

  addRequisition(): void {
    // Validar que hay una sucursal seleccionada
    if (!this.idBranch) {
      alerts.basicAlert('Error', 'Debe seleccionar una sucursal antes de agregar una requisición', 'error');
      return;
    }

    // Obtener el prefijo y consecutivo de la sucursal
    this.typexPrefixesService.getPrefix('branch', this.idBranch).subscribe({
      next: (prefixData: any) => {
        console.log('✅ Prefijo obtenido:', prefixData);
        this.currentPrefixData = prefixData;

        // Generar el número de requisición: prefix + (consecutive + 1)
        const nextConsecutive = (prefixData.consecutive || 0) + 1;
        const requisitionNumber = `${prefixData.prefix || ''}${nextConsecutive}`;

        // Buscar el nombre de la sucursal
        const branch = this.branches.find(b => b.id === this.idBranch);
        const branchName = branch?.name || branch?.description || '';

        const newId = `temp_${Date.now()}`; // ID temporal hasta que se guarde en DB
        const newItem = {
          id: newId,
          branch: branchName,
          requisitionNumber: requisitionNumber,
          requestDate: new Date().toISOString(),
          departmentId: null,
          departmentName: '',
          solicitedBy: this.currentUserName, // Usuario que creó la requisición
          articlesCount: 0,
          articleNumber: '',
          comments: '',
          column8: '',
          detailType: null,
          detailData: [],
          purchasesData: [],
          __isNew: true,
          __modified: false,
          idReference: this.idBranch, // Guardar el ID de la sucursal
          // Campos adicionales del servidor
          delivery: '',
          deliveryTime: '',
          typeOc: '',
          dateSupply: '',
          idPayment: null,
          idCurrency: null,
          conditions: '',
          close: false,
          active: true
        };

        this.rowData = [newItem, ...this.rowData];
        this.fullRowData = [...this.rowData];
        this.hasUnsavedChanges = true;
        this.gridApi.setGridOption('rowData', this.rowData);

        console.log('✅ Nueva requisición agregada:', requisitionNumber);

        setTimeout(() => {
          const firstRowIndex = 0;
          this.gridApi.ensureIndexVisible(firstRowIndex);
          this.gridApi.startEditingCell({
            rowIndex: firstRowIndex,
            colKey: 'departmentName'
          });
        }, 0);
      },
      error: (err) => {
        console.error('❌ Error al obtener prefijo:', err);
        alerts.basicAlert(
          'Error',
          'No se encontró configuración de prefijo para esta sucursal. Por favor, configúrelo primero en la sección de configuración.',
          'error'
        );
      }
    });
  }

  editRequisition(): void {
    // Implement edit
  }

  deleteRequisition(): void {
    // Implement delete
  }

  async saveChanges(): Promise<void> {
    // Filtrar las filas nuevas o modificadas
    const itemsToSave = this.rowData.filter(row => row.__isNew || row.__modified);

    if (itemsToSave.length === 0) {
      alerts.basicAlert('Información', 'No hay cambios que guardar', 'info');
      return;
    }

    console.log('💾 Guardando requisiciones:', itemsToSave.length);

    const newItems = itemsToSave.filter(row => row.__isNew);
    const modifiedItems = itemsToSave.filter(row => row.__modified && !row.__isNew);

    let hasErrors = false;

    try {
      // 1. Guardar nuevas requisiciones
      if (newItems.length > 0) {
        console.log('➕ Creando nuevas requisiciones:', newItems.length);

        for (const item of newItems) {
          const newReqData = {
            id: 0, // Siempre 0 para nuevos registros
            folio: item.requisitionNumber || '',
            typeReference: 'branch',
            idReq: 0,
            idReference: this.idBranch,
            dateCreate: item.requestDate,
            idProvider: 0,
            idDepartament: item.departmentId || 0,
            delivery: item.delivery || 'NO APLICA', // ✅ Valor por defecto del backend
            deliveryTime: item.deliveryTime || '1 DAY', // ✅ Valor por defecto del backend
            typeOc: item.typeOc || 'INSUMOS', // ✅ Valor por defecto del backend
            dateSupply: item.dateSupply || new Date().toISOString(),
            idPayment: item.idPayment || 0,
            idCurrency: item.idCurrency || 0,
            conditions: item.conditions || null, // ✅ null en lugar de string vacío
            idAuthorize: 0,
            priority: item.column8 || null, // ✅ null en lugar de string vacío
            solicit: item.solicitedBy || this.currentUserName,
            discount: 0,
            ivaRetention: 0,
            idSolicit: 0,
            address: item.address || null, // ✅ null en lugar de string vacío
            city: item.city || null, // ✅ null en lugar de string vacío
            phone: item.phone || null, // ✅ null en lugar de string vacío
            type: 'REQUIS',
            compliancePedimento: 0,
            complianceRequesicion: 0,
            comments: item.comments || null, // ✅ null en lugar de string vacío
            close: item.close || false,
            active: item.active !== false
          };

          console.log('📤 ========== NUEVA REQUISICIÓN - DATA A ENVIAR ==========');
          console.log(JSON.stringify(newReqData, null, 2));
          console.table(newReqData);
          console.log('========================================================');

          await new Promise<void>((resolve, reject) => {
            this.ocAndReqsService.addOcAndReq(newReqData).subscribe({
              next: (response) => {
                console.log('✅ Requisición creada:', response);
                resolve();
              },
              error: (err) => {
                console.error('❌ Error al crear requisición:', err);
                hasErrors = true;
                reject(err);
              }
            });
          });
        }

        // Actualizar el consecutivo del prefijo después de crear nuevas requisiciones
        if (this.currentPrefixData && this.idBranch) {
          const newConsecutive = (this.currentPrefixData.consecutive || 0) + newItems.length;

          const updatedPrefixData = {
            reqType: 'branch',
            idReqType: this.idBranch,
            prefix: this.currentPrefixData.prefix,
            consecutive: newConsecutive,
            active: true
          };

          console.log('🔄 Actualizando consecutivo del prefijo:', updatedPrefixData);

          await new Promise<void>((resolve, reject) => {
            this.typexPrefixesService.updatePrefix('branch', this.idBranch, updatedPrefixData).subscribe({
              next: () => {
                console.log('✅ Consecutivo actualizado correctamente');
                this.currentPrefixData.consecutive = newConsecutive;
                resolve();
              },
              error: (err) => {
                console.error('❌ Error al actualizar consecutivo:', err);
                hasErrors = true;
                reject(err);
              }
            });
          });
        }
      }

      // 2. Actualizar requisiciones modificadas
      if (modifiedItems.length > 0) {
        console.log('✏️ Actualizando requisiciones modificadas:', modifiedItems.length);

        for (const item of modifiedItems) {
          // Validar que tenga un ID válido (no temporal)
          if (!item.id || String(item.id).startsWith('temp_')) {
            console.warn('⚠️ Saltando item con ID temporal:', item.id);
            continue;
          }

          const updateReqData = {
            id: item.id,
            folio: item.requisitionNumber || '',
            typeReference: 'branch',
            idReq: 0,
            idReference: this.idBranch,
            dateCreate: item.requestDate,
            idProvider: 0,
            idDepartament: item.departmentId || 0,
            delivery: item.delivery || 'NO APLICA', // ✅ Valor por defecto del backend
            deliveryTime: item.deliveryTime || '1 DAY', // ✅ Valor por defecto del backend
            typeOc: item.typeOc || 'INSUMOS', // ✅ Valor por defecto del backend
            dateSupply: item.dateSupply || new Date().toISOString(),
            idPayment: item.idPayment || 0,
            idCurrency: item.idCurrency || 0,
            conditions: item.conditions || null, // ✅ null en lugar de string vacío
            idAuthorize: 0,
            priority: item.column8 || null, // ✅ null en lugar de string vacío
            solicit: item.solicitedBy || this.currentUserName,
            discount: 0,
            ivaRetention: 0,
            idSolicit: 0,
            address: item.address || null, // ✅ null en lugar de string vacío
            city: item.city || null, // ✅ null en lugar de string vacío
            phone: item.phone || null, // ✅ null en lugar de string vacío
            type: 'REQUIS',
            compliancePedimento: 0,
            complianceRequesicion: 0,
            comments: item.comments || null, // ✅ null en lugar de string vacío
            close: item.close || false,
            active: item.active !== false
          };

          console.log(`📤 ========== UPDATE REQUISICIÓN ${item.id} - DATA A ENVIAR ==========`);
          console.log(JSON.stringify(updateReqData, null, 2));
          console.table(updateReqData);
          console.log('========================================================');

          await new Promise<void>((resolve, reject) => {
            this.ocAndReqsService.updateOcAndReq(item.id, updateReqData).subscribe({
              next: (response) => {
                console.log(`✅ Requisición ${item.id} actualizada:`, response);
                resolve();
              },
              error: (err) => {
                console.error(`❌ Error al actualizar requisición ${item.id}:`, err);
                hasErrors = true;
                reject(err);
              }
            });
          });
        }
      }

      // 3. Si todo salió bien, recargar datos y limpiar estados
      if (!hasErrors) {
        this.hasUnsavedChanges = false;
        alerts.basicAlert('Guardado', `Se guardaron ${itemsToSave.length} requisiciones correctamente`, 'success');

        // Recargar las requisiciones desde el servidor
        this.loadRequisitions();
      } else {
        alerts.basicAlert('Advertencia', 'Algunos cambios no se pudieron guardar. Revise la consola.', 'warning');
      }

    } catch (error) {
      console.error('❌ Error general al guardar:', error);
      alerts.basicAlert('Error', 'Error al guardar los cambios. Revise la consola para más detalles.', 'error');
    }
  }

  refreshData(): void {
    this.loadRequisitions();
    this.hasUnsavedChanges = false;
  }

  generatePDF(): void {
    if (!this.selectedRequisitionId) {
      alerts.basicAlert('Error', 'Debe seleccionar una requisición primero', 'error');
      return;
    }

    // Validar que no sea una requisición temporal
    if (String(this.selectedRequisitionId).startsWith('temp_')) {
      alerts.basicAlert('Error', 'Debe guardar la requisición antes de generar el PDF', 'warning');
      return;
    }

    // Llamar al servicio para generar PDF
    this.receiptsDelisonService.generateOC(this.selectedRequisitionId, 'open');
  }

  components = {
    selectDepartmentEditor: SelectDepartmentEditorComponent
  };
}