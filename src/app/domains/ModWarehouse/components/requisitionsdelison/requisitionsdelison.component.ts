import { Component, OnInit, inject, effect, Renderer2, RendererFactory2, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ButtonCellRendererComponent } from '../../../ModWareHousesTD/components/inandout-st/button-cell-renderer.component';
import { DetallesRequisicionDelisonComponent } from './detalles-requisicion-delison.component';
import { DetailCellRendererRequisitionsPurchasesComponent } from './detail-cell-renderer-requisitions-purchases.component';
import { SelectDepartmentEditorComponent } from './select-department-editor.component';
import { PdfButtonCellRendererComponent } from '../../../ModAdmon/components/egresos-palacio/pdf-button-cell-renderer.component';
import { DepartmentsService } from 'app/services/departments.service';
import { SignalsService } from 'app/services/signals.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { BranchsService } from 'app/services/branchs.service';
import { PrefixSetupService } from 'app/services/prefix-setup.service';
import { ReceiptsDelisonService } from 'app/services/receipts-delison.service';
import { RolesService } from 'app/services/roles.service';
import { alerts } from 'app/helpers/alerts';
import { catchError, EMPTY, firstValueFrom } from 'rxjs';
import { AuthService } from 'app/services/auth.service';

interface Catalog {
  id: number;
  description: string;
}

@Component({
  selector: 'app-requisitionsdelison',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ButtonCellRendererComponent, DetallesRequisicionDelisonComponent, DetailCellRendererRequisitionsPurchasesComponent, SelectDepartmentEditorComponent, PdfButtonCellRendererComponent],
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
  private prefixSetupService = inject(PrefixSetupService);
  private receiptsDelisonService = inject(ReceiptsDelisonService);
  private rolesService = inject(RolesService);
  public   authService = inject(AuthService);

  private gridApi!: GridApi;
  private isGeneratingReport: boolean = false;
  private isInitialized: boolean = false; // Flag para saber si ya se inicializó el componente
  private renderer: Renderer2;
  private departmentTooltipElement: HTMLElement | null = null;
  private solicitedByTooltipElement: HTMLElement | null = null;
  private hostEl = inject(ElementRef<HTMLElement>);

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    // ✅ Usar effect para reaccionar a cambios en el signal de sucursal
    effect(() => {
      const newIdBranch = this.signalsService.getBranchSelectedBySidebar()();



      // Si cambió el idBranch y es válido, recargar requisiciones
      if (newIdBranch !== undefined && newIdBranch !== null && newIdBranch !== this.idBranch) {
        this.idBranch = newIdBranch;

        // Precargar departamentos del backend para esta sucursal de inmediato
        if (newIdBranch > 0 && this.idUser) {
          this.preloadRolesForBranch(newIdBranch);
        }

        // ✅ Esperar a que se carguen las sucursales antes de cargar requisiciones
        if (this.branchesLoaded) {

          this.loadRequisitions();
        } else {

          // Guardar el idBranch para cargarlo después
        }
      } else if (!newIdBranch && newIdBranch !== 0 && this.isInitialized) {
        // ⚠️ Solo mostrar alerta si ya se inicializó el componente (evita alerta en refresh)
        this.idBranch = null;
        this.fullRowData = [];
        this.rowData = [];

        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', []);
        }


        alerts.reqWarningToast(
          'Sucursal requerida',
          'Seleccione una sucursal en el sidebar'
        );
      }
    });

    // Escucha typeOC de ítems para colorear celda # Requisicion
    effect(() => {
      this.signalsService.getReqTypeOcMap()(); // reactive
      if (this.gridApi) {
        this.gridApi.refreshCells({ columns: ['requisitionNumber'], force: true });
      }
    });
  }

  rowData: any[] = [];
  fullRowData: any[] = []; // Store original unfiltered data
  gridHeight: string = '80vh';
  hasUnsavedChanges: boolean = false;
  private pendingNewIds = new Set<number>(); // IDs de registros recién creados para mostrar al frente
  tempIdCounter: number = 0;
  expandedRowId: string | null = null;

  idRoot: number = null;
  idBranch: number = null;
  idUser: number = null; // ID del usuario actual para obtener roles
  departamentos: any[] = [];
  branches: any[] = []; // Catálogo de sucursales
  branchesLoaded: boolean = false; // Flag para saber si ya se cargaron las sucursales
  currentUserName: string = ''; // Nombre del usuario actual
  selectedRequisitionId: number | null = null; // ID de la requisición seleccionada para PDF

  // ✅ Cache de roles por sucursal: Map<idBranch, roles[]>
  private rolesByBranchCache: Map<number, any[]> = new Map();

  // Datos del prefijo actual
  currentPrefixData: any = null;

  // ✅ Contador local de consecutivos por sucursal (para evitar duplicados al agregar múltiples filas)
  private localConsecutivesByBranch: Map<number, number> = new Map();

  private _colMaster: ColDef[] = [];
  private editableColumnOrder = ['idReference', 'requestDate', 'departmentId'];
  private enterPressed: boolean = false;

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    wrapHeaderText: true,
    autoHeaderHeight: true,
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
        return true;
      }
      return false;
    }
  };

  ngOnInit() {
    // ✅ Esperar a que los signals se establezcan antes de inicializar
    setTimeout(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.currentUserName = this.signalsService.getDisplayName()() || 'Usuario';
      this.idUser = this.signalsService.getIdUSer()(); // ✅ Obtener ID del usuario



      // ✅ Solo cargar si idRoot es válido
      if (this.idRoot) {
        this.loadBranches();
        this.obtenerDepartamentos();
      } else {

        // Reintentar después de un delay adicional
        setTimeout(() => {
          this.idRoot = this.signalsService.getRootSelectedBySidebar()();
          if (this.idRoot) {

            this.loadBranches();
            this.obtenerDepartamentos();
          }
        }, 300);
      }

      // ✅ Marcar como inicializado
      this.isInitialized = true;

    }, 200);
  }

  loadBranches() {
    this.branchsService.getBranchesByUserAndCompany(this.idUser, this.idRoot).subscribe({
      next: (data: any) => {
        this.branches = (data.project || []).map((row: any) => ({
          id: row.idPermission || row.idBranch || row.id,
          name: row.name || row.description || ''
        }));
        this.branchesLoaded = true;

        // Precargar departamentos de TODAS las sucursales disponibles de una vez
        this.branches.forEach(branch => this.preloadRolesForBranch(branch.id));


        // ✅ Obtener el idBranch actual del signal (puede ser negativo para "Todas las sucursales")
        const currentIdBranch = this.signalsService.getBranchSelectedBySidebar()();

        // ✅ Si hay un idBranch seleccionado (incluso si es negativo), cargar las requisiciones ahora
        if (currentIdBranch !== null && currentIdBranch !== undefined) {
          this.idBranch = currentIdBranch;

          if (currentIdBranch > 0 && this.idUser) {
            this.preloadRolesForBranch(currentIdBranch);
          }

          this.loadRequisitions();
        } else {

        }
      },
      error: (error) => {

        this.branches = [];
        this.branchesLoaded = true; // Marcar como cargado aunque haya error
      }
    });
  }

  obtenerDepartamentos() {
    this.departmentsService.getDepartments(this.idRoot).subscribe(
      (data: Catalog[]) => {
        this.departamentos = data;

      },
      (error) => console.error('Error fetching departments:', error)
    );
  }


  loadRequisitions() {
    // ✅ Guardar qué fila estaba expandida antes de recargar
    let expandedRequisitionId: number | null = null;
    if (this.gridApi) {
      this.gridApi.forEachNode((node: any) => {
        if (node.expanded) {
          expandedRequisitionId = node.data?.id || null;
        }
      });
    }

    // ✅ Validar que idBranch sea válido antes de hacer la petición
    if (this.idBranch === null || this.idBranch === undefined) {

      this.fullRowData = [];
      this.rowData = [];
      return;
    }

    // 🔍 Detectar si se seleccionó "Todas las sucursales" (ID negativo)
    const isAllBranches = this.idBranch < 0;

    if (isAllBranches) {

      this.loadRequisitionsFromAllBranches(expandedRequisitionId);
    } else {

      this.loadRequisitionsFromSingleBranch(this.idBranch, expandedRequisitionId);
    }
  }

  private loadRequisitionsFromAllBranches(expandedRequisitionId: number | null = null) {
    // 🔍 Usar el catálogo de branches que ya está cargado en this.branches
    if (!this.branches || this.branches.length === 0) {

      this.fullRowData = [];
      this.rowData = [];
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', []);
      }
      return;
    }



    // 🔄 Hacer múltiples llamadas al endpoint, una por cada branch
    const requisitionPromises = this.branches.map(branch => {
      return new Promise<any[]>((resolve) => {
        this.ocAndReqsService.getOcAndReqs('branch', branch.id, 'REQUIS').subscribe({
          next: (data: any) => {

            resolve(Array.isArray(data) ? data : []);
          },
          error: (error) => {

            resolve([]); // Retornar array vacío en caso de error
          }
        });
      });
    });

    // 🔀 Esperar a que todas las promesas se resuelvan
    Promise.all(requisitionPromises).then((allRequisitions: any[][]) => {
      // Combinar todos los resultados en un solo array
      const combinedData = allRequisitions.flat();


      // Mapear los datos al formato esperado por el grid
      this.fullRowData = combinedData.map((req: any) => {
        const branch = this.branches.find(b => b.id === req.idReference);
        const branchName = branch?.name || branch?.description || req.idReference?.toString() || '';

        // ✅ El nombre del departamento se obtendrá dinámicamente desde getRolesByBranchDelison
        // cuando se visualice o edite la celda
        const departmentName = '';

        return {
          id: req.id,
          branch: branchName,
          requisitionNumber: req.folio || '',
          requestDate: req.dateCreate || this.localISOString(),
          dateModified: req.dateModified,
          departmentId: req.idDepartament || null,
          departmentName: departmentName, // ✅ Nombre del departamento desde el catálogo
          solicitedBy: req.solicit || '',
          articlesCount: req.countrow || 0,
          articleNumber: '',
          comments: req.comments || '',
          column8: req.priority || '',
          purchasesCount: 0,
          detailType: null,
          detailData: [],
          purchasesData: [],
          delivery: req.delivery || '',
          deliveryTime: req.deliveryTime || '',
          typeOc: req.typeOc || '',
          dateSupply: req.dateSupply || '',
          idPayment: req.idPayment || null,
          idCurrency: req.idCurrency || null,
          conditions: req.conditions || '',
          close: req.close || false,
          active: req.active || true,
          idReference: req.idReference,
          locked: req.locked || false
        };
      });

      // ✅ Ordenar por dateModified descendente (más recientemente modificado primero) - viene del backend
      this.fullRowData.sort((a, b) => new Date(b.dateModified || b.requestDate).getTime() - new Date(a.dateModified || a.requestDate).getTime());

      // ✅ Si hay registros recién creados, moverlos al frente
      if (this.pendingNewIds.size > 0) {
        const newRows = this.fullRowData.filter(r => this.pendingNewIds.has(r.id));
        const otherRows = this.fullRowData.filter(r => !this.pendingNewIds.has(r.id));
        this.fullRowData = [...newRows, ...otherRows];
        this.pendingNewIds.clear();
      }

      this.rowData = [...this.fullRowData];


      // ✅ Pre-cargar roles para todas las sucursales únicas en los datos
      this.preloadRolesForRequisitions();

      // Refrescar el grid
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.refreshCells({ force: true });

        // ✅ Reabrir la fila que estaba expandida y aplicar restricciones de altura
        if (expandedRequisitionId) {
          setTimeout(() => {
            const nodeToExpand = this.gridApi.getRowNode(String(expandedRequisitionId));
            if (nodeToExpand) {
              // Replicar el mismo flujo que onRowClicked()
              // 1. Ocultar todas las demás filas (altura 0)
              this.gridApi.forEachNode((otherNode: any) => {
                if (otherNode.id !== String(expandedRequisitionId)) {
                  otherNode.setRowHeight(0);
                }
              });

              // 2. Aplicar cambios de altura
              this.gridApi.onRowHeightChanged();

              // 3. Expandir la fila
              nodeToExpand.setExpanded(true);
              nodeToExpand.data.detailType = 'items';
              nodeToExpand.data.isExpanded = true;
              this.expandedRowId = nodeToExpand.id;

              // 4. Redraw
              this.gridApi.redrawRows();
            }
          }, 50);
        } else {
          this.gridApi.ensureIndexVisible(0);
        }
      }

      // Cargar flags de typeOC desde COTIZs vinculadas
      this.loadTypeOcFlags();
    });
  }

  private loadRequisitionsFromSingleBranch(branchId: number, expandedRequisitionId: number | null = null) {


    // ✅ Llamar al endpoint real
    this.ocAndReqsService.getOcAndReqs('branch', branchId, 'REQUIS').subscribe({
      next: (data: any) => {


        // Mapear los datos del servidor al formato esperado por el grid
        this.fullRowData = Array.isArray(data) ? data.map((req: any) => {
          // ✅ Buscar el nombre de la sucursal usando idReference
          const branch = this.branches.find(b => b.id === req.idReference);
          const branchName = branch?.name || branch?.description || req.idReference?.toString() || '';

          // ✅ El nombre del departamento se obtendrá dinámicamente desde getRolesByBranchDelison
          // cuando se visualice o edite la celda (no se puede obtener aquí de forma sincrónica)
          const departmentName = '';



          return {
            id: req.id,
            branch: branchName, // Nombre de la sucursal desde el catálogo
            requisitionNumber: req.folio || '', // Número de requisición
            requestDate: req.dateCreate || this.localISOString(), // Fecha de creación
            dateModified: req.dateModified,
            departmentId: req.idDepartament || null,
            departmentName: departmentName, // ✅ Nombre del departamento desde el catálogo
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

        // ✅ Ordenar por dateModified descendente (más recientemente modificado primero)
        this.fullRowData.sort((a, b) => new Date(b.dateModified || b.requestDate).getTime() - new Date(a.dateModified || a.requestDate).getTime());

        // ✅ Si hay registros recién creados, moverlos al frente
        if (this.pendingNewIds.size > 0) {
          const newRows = this.fullRowData.filter(r => this.pendingNewIds.has(r.id));
          const otherRows = this.fullRowData.filter(r => !this.pendingNewIds.has(r.id));
          this.fullRowData = [...newRows, ...otherRows];
          this.pendingNewIds.clear();
        }

        this.rowData = [...this.fullRowData];



        // ✅ Pre-cargar roles para todas las sucursales únicas en los datos
        this.preloadRolesForRequisitions();

        // Refrescar el grid si ya existe
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
          this.gridApi.refreshCells({ force: true });

          // ✅ Reabrir la fila que estaba expandida y aplicar restricciones de altura
          if (expandedRequisitionId) {
            setTimeout(() => {
              const nodeToExpand = this.gridApi.getRowNode(String(expandedRequisitionId));
              if (nodeToExpand) {
                // Replicar el mismo flujo que onRowClicked()
                // 1. Ocultar todas las demás filas (altura 0)
                this.gridApi.forEachNode((otherNode: any) => {
                  if (otherNode.id !== String(expandedRequisitionId)) {
                    otherNode.setRowHeight(0);
                  }
                });

                // 2. Aplicar cambios de altura
                this.gridApi.onRowHeightChanged();

                // 3. Expandir la fila
                nodeToExpand.setExpanded(true);
                nodeToExpand.data.detailType = 'items';
                nodeToExpand.data.isExpanded = true;
                this.expandedRowId = nodeToExpand.id;

                // 4. Redraw
                this.gridApi.redrawRows();
              }
            }, 50);
          } else {
            this.gridApi.ensureIndexVisible(0);
          }
        }

        // Cargar flags de typeOC desde COTIZs vinculadas
        this.loadTypeOcFlags();
      },
      error: (error) => {

        alerts.reqErrorToast('Error', 'No se pudieron cargar las requisiciones');

        // En caso de error, inicializar con array vacío
        this.fullRowData = [];
        this.rowData = [];
      }
    });
  }

  private loadTypeOcFlags() {
    if (!this.rowData.length) return;
    const reqIds = this.rowData.map(r => r.id);
    this.ocAndReqsService.getTypeOcFlags(reqIds).subscribe({
      next: (flags) => {
        this.signalsService.setReqTypeOcBulk(flags);
      },
      error: () => { /* silencioso */ }
    });
  }

  public gridOptions: any = {
    headerHeight: 56,
    rowHeight: 35,
    animateRows: true,
    // Mantiene un layout “bonito” (sin columnas mini) llenando el ancho disponible.
    // En AG Grid nuevas versiones esto evita tener que autoSizeAllColumns.
    autoSizeStrategy: {
      type: 'fitCellContents',
    },
    masterDetail: true,
    // Se recalcula en caliente en updateDetailRowHeight() para ocupar el alto disponible.
    detailRowHeight: 700,
    isRowMaster: (dataItem: any) => true,
    getRowId: (params: any) => String(params.data.id),
    detailCellRenderer: DetallesRequisicionDelisonComponent,
    onFirstDataRendered: () => {
      this.autoAdjustColumns();
      this.updateDetailRowHeight();
    },
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


      event.data.__modified = true;
      event.data.dateModified = this.localISOString();
      this.hasUnsavedChanges = true;
      this.moveRowToTop(event.data.id);


      setTimeout(() => {
        this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
      }, 0);
    },
    onRowGroupOpened: (event: any) => {
      // ✅ Si se cerró la fila (expanded === false), ejecutar el reordenamiento
      if (!event.node.expanded) {
        // Solo reordenar si hay datos
        if (this.rowData.length > 0) {
          // Reordenar por marca de tiempo (lo más reciente arriba)
          this.rowData.sort((a, b) => {
            const timeA = new Date(a.dateModified || a.requestDate).getTime();
            const timeB = new Date(b.dateModified || b.requestDate).getTime();
            return timeB - timeA;
          });
          
          // Aplicar el nuevo orden al grid
          if (this.gridApi) {
            this.gridApi.setGridOption('rowData', [...this.rowData]);
          }
        }
      }
    }
  };

  @HostListener('window:resize')
  onWindowResize() {
    this.autoAdjustColumns();
    this.updateDetailRowHeight();
  }

  private autoAdjustColumns(): void {
    if (!this.gridApi) return;
    this.gridApi.autoSizeAllColumns();
  }

  /**
   * Ajusta el alto del detalle (nivel 2) para que use el espacio visible del grid,
   * evitando un bloque “pequeño” con demasiado scroll interno.
   */
  private updateDetailRowHeight(): void {
    if (!this.gridApi) return;

    // Medir el alto real del contenedor del grid
    const host = this.hostEl?.nativeElement;
    const gridEl = host?.querySelector('ag-grid-angular') as HTMLElement | null;
    const rect = gridEl?.getBoundingClientRect?.();
    const gridHeightPx = rect?.height ? Math.round(rect.height) : 0;
    if (!gridHeightPx) return;

    const headerPx = Number(this.gridOptions?.headerHeight ?? 0);
    const rowPx = Number(this.gridOptions?.rowHeight ?? 0);
    const paddingPx = 18;

    // Cuando expandes, el detalle debería ocupar casi todo el alto del grid
    const desired = Math.max(320, gridHeightPx - headerPx - rowPx - paddingPx);
    this.gridOptions.detailRowHeight = desired;

    const apiAny = this.gridApi as any;
    if (typeof apiAny.setGridOption === 'function') {
      apiAny.setGridOption('detailRowHeight', desired);
    }
  }

  get colMaster(): ColDef[] {
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    this._colMaster = [
      {
        field: 'idReference',
        headerName: 'Sucursal',
        width: 250,
        // ✅ Solo editable si está en modo "Todas las sucursales" (idBranch negativo o no definido)
        editable: () => !this.idBranch || this.idBranch < 0,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => {
          return {
            values: this.branches.map(b => b.id),
            valueListGap: 0,
            valueListMaxHeight: 220,
            cellWidth: 260,
            // Formatear cómo se muestra cada opción en el dropdown
            formatValue: (value: any) => {
              const branch = this.branches.find(b => b.id === value);
              return branch?.name || branch?.description || value?.toString() || '';
            }
          };
        },
        valueGetter: (params: any) => {
          // Retornar el ID de la sucursal
          return params.data.idReference;
        },
        valueFormatter: (params: any) => {
          // Mostrar el nombre de la sucursal basado en el ID
          const branchId = params.value;
          const branch = this.branches.find(b => b.id === branchId);
          return branch?.name || branch?.description || '';
        },
        // ✅ Estilo visual para indicar si es editable o no
        cellStyle: () => {
          // Si hay una sucursal específica seleccionada (no es "Todas"), hacer fondo gris
          if (this.idBranch && this.idBranch > 0) {
            return { backgroundColor: '#f0f0f0' }; // Gris = no editable
          }
          return {}; // Sin estilo = editable
        },
        valueSetter: (params: any) => {


          // AG Grid agSelectCellEditor retorna el ID directamente como string
          const branchId = Number(params.newValue);

          // ✅ Validar que el ID no sea negativo (evitar -9 de "Todas las sucursales")
          if (branchId <= 0 || isNaN(branchId)) {

            return false;
          }

          const branch = this.branches.find(b => b.id === branchId);

          if (branch) {
            params.data.idReference = branchId;
            params.data.branch = branch.name || branch.description;

            // Precargar departamentos del backend para la sucursal recién seleccionada
            this.preloadRolesForBranch(branchId);



            // 🔄 Obtener el próximo número de requisición para la nueva sucursal
            this.prefixSetupService.getNextFolio('branch', branchId, 'req').then((folio: string | null) => {
              if (folio) {
                params.data.requisitionNumber = folio;
                if (this.gridApi) {
                  this.gridApi.refreshCells({ rowNodes: [params.node], force: true });
                }
              } else {
                alerts.reqWarningToast(
                  'Error',
                  'No se pudo generar el número de requisición'
                );
              }
            }).catch(() => {
              alerts.reqWarningToast(
                'Error',
                'No se pudo generar el número de requisición'
              );
            });

            // Marcar como modificado si no es nuevo
            if (!params.data.__isNew) {
              params.data.__modified = true;

            }
            this.hasUnsavedChanges = true;

            return true;
          }


          return false;
        },
        cellEditorPopup: true
      },
      {
        field: 'requisitionNumber',
        headerName: '# Requisicion',
        width: 200,
        minWidth: 180,
        filter: true,
        editable: false,
        cellStyle: (params: any) => {
          const flags = this.signalsService.getReqTypeOcMap()().get(params.data?.id);
          if (!flags) return { backgroundColor: '#f0f0f0' };
          if (flags.noAuth && flags.changeSpec)
            return { background: 'linear-gradient(to right, #FFCC80 50%, #FFF59D 50%)', fontWeight: '600' };
          if (flags.noAuth)
            return { backgroundColor: '#FFCC80', fontWeight: '600' };
          if (flags.changeSpec)
            return { backgroundColor: '#FFF59D', fontWeight: '600' };
          return { backgroundColor: '#f0f0f0' };
        },
        cellRenderer: (params: any) => {
          const folio = params.value || '';
          if (!params.data?.locked) return folio;
          const wrap = document.createElement('span');
          wrap.style.display = 'flex';
          wrap.style.alignItems = 'center';
          wrap.style.gap = '5px';
          wrap.innerHTML = `${folio} <i class="bi bi-lock-fill" style="color:#b71c1c; font-size:0.85rem; flex-shrink:0;" title="Requisición procesada — OC generada"></i>`;
          return wrap;
        }
      },
      {
        field: 'requestDate',
        headerName: 'Fecha solicitud',
        width: 155,
        editable: (params: any) => !params.data?.__isNew && !!this.idBranch,
        cellEditor: 'agDateCellEditor',
        valueGetter: (params: any) =>
          params.data?.requestDate ? String(params.data.requestDate).substring(0, 10) : '',
        valueSetter: (params: any) => {
          if (!params.newValue) return false;
          if (params.newValue instanceof Date) {
            const d = params.newValue;
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            params.data.requestDate = `${y}-${m}-${day}`;
          } else {
            params.data.requestDate = String(params.newValue).substring(0, 10);
          }
          return true;
        },
        valueFormatter: (params: any) => {
          if (!params.value) return '';
          const [y, m, d] = String(params.value).split('-');
          return d && m && y ? `${d}/${m}/${y}` : params.value;
        }
      },
      {
        field: 'departmentId',
        headerName: 'Departamento que solicita',
        width: 200,
        valueFormatter: (params: any) => {
          if (!params.value) return '';

          const branchId = params.data?.idReference;
          const cachedRoles = this.rolesByBranchCache.get(branchId);

          if (cachedRoles) {
            const role = cachedRoles.find(r => r.id === params.value);
            if (role) return role.description;
          }

          return params.value?.toString() || '';
        },
        editable: (params: any) => {
          return params.data && params.data.idReference > 0;
        },
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params: any) => {
          const branchId = params.data?.idReference;

          if (!branchId || !this.idUser) {
            return { values: [] };
          }

          if (!this.rolesByBranchCache.has(branchId)) {
            // Cargar roles si no están en cache
            this.rolesService.getRolesByBranchDelison(this.idUser, branchId).subscribe({
              next: (roles: any[]) => {
                this.rolesByBranchCache.set(branchId, roles.map(r => ({
                  id: r.id,
                  description: r.description,
                  name: r.description
                })));
                if (this.gridApi) {
                  this.gridApi.refreshCells({ force: true });
                }
              },
              error: () => {}
            });
            return { values: [] };
          }

          const roles = this.rolesByBranchCache.get(branchId) || [];
          const descriptionToId: any = {};
          const idToDescription: any = {};

          roles.forEach(r => {
            descriptionToId[r.description] = r.id;
            idToDescription[r.id] = r.description;
          });

          (params.data as any).__roleMapDescToId = descriptionToId;
          (params.data as any).__roleMapIdToDesc = idToDescription;

          return {
            values: roles.map(r => r.description),
            valueListGap: 0,
            valueListMaxHeight: 220
          };
        },
        valueGetter: (params: any) => {
          const departmentId = params.data?.departmentId;
          if (!departmentId) return null;

          const branchId = params.data?.idReference;
          const cachedRoles = this.rolesByBranchCache.get(branchId);

          if (cachedRoles) {
            const role = cachedRoles.find(r => r.id === departmentId);
            if (role) {
              return role.description;
            }
          }

          return null;
        },
        valueSetter: (params: any) => {
          if (!params.newValue) {
            params.data.departmentId = null;
            params.data.departmentName = '';
            return true;
          }

          const descToIdMap = (params.data as any).__roleMapDescToId;

          if (descToIdMap && descToIdMap[params.newValue]) {
            const departmentId = descToIdMap[params.newValue];
            const departmentName = params.newValue;

            params.data.departmentId = departmentId;
            params.data.departmentName = departmentName;
          } else {
            const branchId = params.data.idReference;
            const cachedRoles = this.rolesByBranchCache.get(branchId);

            if (cachedRoles) {
              const role = cachedRoles.find(r => r.description === params.newValue);
              if (role) {
                params.data.departmentId = role.id;
                params.data.departmentName = role.description;
              } else {
                return false;
              }
            } else {
              return false;
            }
          }

          if (!params.data.__isNew) {
            params.data.__modified = true;
          }
          this.hasUnsavedChanges = true;

          return true;
        },
        cellEditorPopup: true
      },
      {
        field: 'solicitedBy',
        headerName: 'Solicitado por',
        width: 300,
        editable: false,
        cellRenderer: (params: any) => {
          const div = document.createElement('div');
          const displayValue = params.value || this.currentUserName || '';

          div.textContent = displayValue;
          div.style.cursor = 'pointer';

          div.addEventListener('mouseenter', () => {
            const rect = div.getBoundingClientRect();
            this.showSolicitedByTooltip(displayValue, rect);
          });

          div.addEventListener('mouseleave', () => {
            this.hideSolicitedByTooltip();
          });

          return div;
        }
      },
      {
        field: 'articlesCount',
        headerName: 'Articulos que solicita',
        width: 175,
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
        width: 110,
        cellRenderer: PdfButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => {
            // Validar que no sea una requisición temporal
            if (String(node.data.id).startsWith('temp_')) {
              alerts.reqBasicAlert('Información', 'Debe guardar la requisición antes de generar el PDF', 'info');
              return;
            }
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
        width: 210,
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

      {
        field: 'column8',
        headerName: 'Autorizar',
        width: 150,
         }
    ];

    return this._colMaster;
  }

  onCellClicked(event: any): void {
    event.node.setSelected(true);

    const colId = event.column.getColId();
    const isDetailColumn = colId === 'articlesCount';
    const isDepartmentColumn = colId === 'departmentId';

    // ✅ Si se hace clic en la columna de departamento, los departamentos ya están cargados globalmente
    // No es necesario cargar roles aquí, usamos el catálogo de departamentos

    if (isDetailColumn) {
      // Bloquear si la fila no está guardada
      if (event.data.__isNew || event.data.__modified) {
        alerts.reqWarningToast(
          'Guarda primero',
          'Debes guardar la requisición antes de poder ver su detalle'
        );
        return;
      }

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


      try {
        // 📊 Mostrar barra de progreso
        alerts.showLoadingWithProgress('Generando reporte', 'Por favor espere...', 0);


        // Simular progreso de generación (incrementos de 10%)
        for (let progress = 10; progress <= 90; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          alerts.updateLoadingProgress('Generando reporte', 'Por favor espere...', progress);

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


        // Expandir con el PDF
        setTimeout(() => {
          node.setExpanded(true);
        }, 0);

        // Cerrar alerta después de un delay
        setTimeout(() => {
          alerts.closeLoading();

        }, 800);

      } catch (error) {

        alerts.reqErrorToast('Error', 'No se pudo generar el reporte');
      } finally {
        // 🔓 Liberar lock
        this.isGeneratingReport = false;

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
    this.autoAdjustColumns();
    // Dejar que el DOM asiente tamaños antes de medir
    setTimeout(() => this.updateDetailRowHeight(), 0);

    // Aplicar visibilidad de columna según permisos (después de que estén cargados)
    setTimeout(() => {
      const hasPermission = this.authService.hasSubDetailedPermission('shoppingDelison', 'requisitions', 'Req_Art');
      this.gridApi.setColumnsVisible(['articlesCount'], hasPermission);
    }, 300);

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
              row.dateModified = this.localISOString();
              this.moveRowToTop(requisitionId);

              if (showAlert) {
                alerts.reqSuccessToast('Guardado', 'Los detalles han sido guardados correctamente');
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
              row.dateModified = this.localISOString();
              this.moveRowToTop(requisitionId);
            }
          },
          // Nueva función para forzar la actualización de la fila maestra
          refreshMasterRow: (requisitionId: number) => {
            const rowNode = this.gridApi.getRowNode(String(requisitionId));
            if (rowNode) {
              this.gridApi.refreshCells({ rowNodes: [rowNode], force: true });
            }
          },
          updateMasterUserAndDate: (requisitionId: number, solicitedBy: string, requestDate: string) => {
            const row = this.rowData.find(r => r.id === requisitionId);
            if (row) {
              row.solicitedBy = solicitedBy;
              row.requestDate = requestDate;
              row.dateModified = this.localISOString();
              this.moveRowToTop(requisitionId);
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
              alerts.reqSuccessToast('Guardado', 'Las compras han sido guardadas correctamente');
            }
          },
          delete: (params: any, callback: () => void) => {
            // Mock delete
            callback();
          },
          updateCount: (requisitionId: number, count: number) => {
            // Update count if needed
          }
        },
        // ✅ Método para recargar la tabla nivel 1 desde nivel 2
        reloadParentGrid: () => {
          this.loadRequisitions();
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

  onCellEditingStopped(event: any): void {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const currentIndex = this.editableColumnOrder.indexOf(event.column.getColId());
    if (currentIndex !== -1 && currentIndex < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({
          rowIndex: event.rowIndex,
          colKey: this.editableColumnOrder[currentIndex + 1]
        });
      }, 100);
    }
  }

  onRowGroupOpened(event: any): void {
    if (!event.expanded) {
      // Fila se ha colapsado - reordenar si hay cambios
      this.fullRowData.sort((a: any, b: any) =>
        new Date(b.dateModified || b.requestDate).getTime() - new Date(a.dateModified || a.requestDate).getTime()
      );
      this.rowData = [...this.fullRowData];

      // Guardar IDs de filas expandidas antes de vaciar
      const expandedIds = new Set<string>();
      this.gridApi.forEachNode((node: any) => {
        if (node.expanded) expandedIds.add(node.id!);
      });

      // Forzar recarga: vaciar → repoblar → restaurar expansión
      this.gridApi.setGridOption('rowData', []);
      setTimeout(() => {
        this.gridApi.setGridOption('rowData', this.rowData);
        if (expandedIds.size > 0) {
          setTimeout(() => {
            this.gridApi.forEachNode((node: any) => {
              if (expandedIds.has(node.id!)) node.setExpanded(true);
            });
          }, 0);
        }
      }, 0);
    }
  }

  addRequisition(): void {
    // ✅ Validar que haya al menos una sucursal disponible
    if (!this.branches || this.branches.length === 0) {
      alerts.reqErrorToast(
        'Error',
        'No hay sucursales disponibles'
      );
      return;
    }

    // ✅ Determinar qué sucursal usar para la nueva requisición
    let selectedBranchId: number;

    if (this.idBranch && this.idBranch > 0) {
      // Si hay una sucursal específica seleccionada, usarla
      selectedBranchId = this.idBranch;
    } else {
      // Si está en "Todas las sucursales" o no hay selección, usar la primera disponible
      selectedBranchId = this.branches[0].id;

    }

    // Los departamentos ya están cargados globalmente, crear la fila directamente
    const crearFila = (requisitionNumber: string) => {
      this.createNewRequisitionRow(selectedBranchId, requisitionNumber);
    };

    // Obtener el próximo número de requisición
    this.prefixSetupService.getNextFolio('branch', selectedBranchId, 'req').then((folio: string | null) => {
      if (folio) {
        crearFila(folio);
      } else {
        alerts.reqErrorToast('Error', 'No se pudo generar el número de requisición');
      }
    }).catch(() => {
      alerts.reqErrorToast('Error', 'No se pudo generar el número de requisición');
    });
  }

  private createNewRequisitionRow(selectedBranchId: number, requisitionNumber: string): void {

    // Buscar el nombre de la sucursal
    const branch = this.branches.find(b => b.id === selectedBranchId);
    const branchName = branch?.name || branch?.description || '';

    // Pre-poblar el primer departamento disponible del catálogo
    const defaultDeptId = this.departamentos && this.departamentos.length > 0 ? this.departamentos[0].id : null;
    const defaultDeptName = this.departamentos && this.departamentos.length > 0 ? this.departamentos[0].description : '';

    const newId = `temp_${Date.now()}`;
    const newItem = {
      id: newId,
      branch: branchName,
      requisitionNumber: requisitionNumber,
      requestDate: this.localISOString(),
      departmentId: defaultDeptId,
      departmentName: defaultDeptName,
      solicitedBy: this.currentUserName,
      articlesCount: 0,
      articleNumber: '',
      comments: '',
      column8: '',
      detailType: null,
      detailData: [],
      purchasesData: [],
      __isNew: true,
      __modified: false,
      idReference: selectedBranchId,
      delivery: '',
      deliveryTime: '',
      typeOc: '',
      dateSupply: '',
      idPayment: null,
      idCurrency: null,
      conditions: '',
      close: false,
      active: true,
      locked: false,
      purchasesCount: 0
    };

    this.rowData = [newItem, ...this.rowData];
    this.fullRowData = [...this.rowData];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      const firstRowIndex = 0;
      this.gridApi.ensureIndexVisible(firstRowIndex);
      if (this.idBranch && this.idBranch < 0) {
        this.gridApi.startEditingCell({
          rowIndex: firstRowIndex,
          colKey: 'idReference'
        });
      } else {
        this.gridApi.startEditingCell({
          rowIndex: firstRowIndex,
          colKey: 'departmentId'
        });
      }
    }, 0);
  }

  editRequisition(): void {
    // Implement edit
  }

  async deleteRequisition(): Promise<void> {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.reqBasicAlert(
        'Eliminar requisición',
        'Seleccione una requisición para eliminar',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    // Verificar si tiene artículos asociados
    if (selectedData.articlesCount > 0) {
      alerts.reqBasicAlert(
        'Eliminar requisición',
        'No se puede eliminar, tiene artículos asociados',
        'error'
      );
      return;
    }

    // Mostrar confirmación antes de eliminar
    const result = await alerts.confirmAlert(
      '¿Eliminar requisición?',
      `¿Está seguro que desea eliminar la requisición "${selectedData.requisitionNumber || 'Sin número'}"? Esta acción no se puede deshacer.`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) {
      return;
    }

    // Si es una fila nueva (temporal), solo eliminar localmente
    if (id && id.toString().startsWith('temp_')) {
      this.rowData = this.rowData.filter(row => row.id !== id);
      this.fullRowData = this.fullRowData.filter(row => row.id !== id);
      this.gridApi.setGridOption('rowData', this.rowData);

      // Verificar si aún hay cambios sin guardar
      this.hasUnsavedChanges = this.rowData.some(row => row.__isNew || row.__modified);

      // Recalcular consecutivos locales
      this.recalculateLocalConsecutives();

      alerts.reqSuccessToast(
        'Eliminar requisición',
        'Requisición eliminada satisfactoriamente'
      );
      return;
    }

    // Eliminar del servidor
    this.ocAndReqsService
      .deleteOcAndReq(id)
      .pipe(
        catchError((error) => {
          alerts.reqErrorToast(
            'Eliminar requisición',
            'Error al eliminar la requisición'
          );
          console.error(error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        alerts.reqSuccessToast(
          'Eliminar requisición',
          'Requisición eliminada satisfactoriamente'
        );

        // Eliminar de los arrays locales
        this.rowData = this.rowData.filter(row => row.id !== id);
        this.fullRowData = this.fullRowData.filter(row => row.id !== id);
        this.gridApi.setGridOption('rowData', this.rowData);

        this.hasUnsavedChanges = false;
      });
  }

  /**
   * Pre-carga los roles para todas las sucursales únicas presentes en las requisiciones
   * Esto permite que el valueFormatter muestre los nombres correctamente al cargar
   */
  private preloadRolesForBranch(branchId: number): void {
    if (!this.idUser || !branchId || branchId <= 0) return;
    this.rolesService.getRolesByBranchDelison(this.idUser, branchId).subscribe({
      next: (roles: any[]) => {
        this.rolesByBranchCache.set(branchId, roles.map(r => ({
          id: r.id,
          description: r.description,
          name: r.description
        })));
        if (this.gridApi) {
          this.gridApi.refreshCells({ force: true });
        }
      },
      error: () => {}
    });
  }

  private async ensureRolesForBranch(branchId: number): Promise<any[]> {
    if (!this.idUser || !branchId || branchId <= 0) return [];

    const cachedRoles = this.rolesByBranchCache.get(branchId);
    if (cachedRoles) {
      return cachedRoles;
    }

    try {
      const rolesRaw: any = await firstValueFrom(this.rolesService.getRolesByBranchDelison(this.idUser, branchId));
      const roles = Array.isArray(rolesRaw)
        ? rolesRaw.map(r => ({
            id: r.id,
            description: r.description,
            name: r.description
          }))
        : [];

      this.rolesByBranchCache.set(branchId, roles);
      return roles;
    } catch {
      return [];
    }
  }

  private async validateDepartmentsBeforeSave(itemsToSave: any[]): Promise<string | null> {
    for (const item of itemsToSave) {
      const branchId = Number(item?.idReference || 0);
      const departmentId = Number(item?.departmentId || 0);

      if (branchId <= 0 || departmentId <= 0) {
        const requisitionLabel = item?.requisitionNumber || `fila ${this.rowData.indexOf(item) + 1}`;
        return `La requisición ${requisitionLabel} no tiene un Departamento que solicita válido.`;
      }

      const roles = await this.ensureRolesForBranch(branchId);
      const departmentExists = roles.some((role: any) => Number(role?.id || 0) === departmentId);

      if (!departmentExists) {
        const requisitionLabel = item?.requisitionNumber || `fila ${this.rowData.indexOf(item) + 1}`;
        return `El Departamento que solicita de la requisición ${requisitionLabel} no existe o no está autorizado para la sucursal seleccionada.`;
      }
    }

    return null;
  }

  private preloadRolesForRequisitions(): void {
    if (!this.idUser) return;

    const uniqueBranchIds = new Set<number>();
    this.rowData.forEach(row => {
      if (row.idReference && row.idReference > 0) {
        uniqueBranchIds.add(row.idReference);
      }
    });

    uniqueBranchIds.forEach(branchId => {
      if (!this.rolesByBranchCache.has(branchId)) {
        this.preloadRolesForBranch(branchId);
      }
    });
  }

  /**
   * Recalcula los consecutivos locales basándose en las filas nuevas que existen actualmente.
   * Útil para asegurar que no haya duplicados después de agregar/eliminar filas.
   */
  private recalculateLocalConsecutives(): void {
    // Limpiar el Map actual
    this.localConsecutivesByBranch.clear();

    // Agrupar las filas nuevas por sucursal
    const newRowsByBranch = new Map<number, any[]>();

    this.rowData.filter(row => row.__isNew).forEach(row => {
      const branchId = row.idReference;
      if (!newRowsByBranch.has(branchId)) {
        newRowsByBranch.set(branchId, []);
      }
      newRowsByBranch.get(branchId)!.push(row);
    });

    // Los números de requisición ahora se generan del backend, así que no necesitamos mantener contadores locales
    this.localConsecutivesByBranch.clear();
  }

  private localISOString(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
  }

  private normalizeRequestDate(requestDate: any): string {
    if (!requestDate) {
      const today = new Date();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    if (requestDate instanceof Date) {
      const y = requestDate.getFullYear();
      const m = String(requestDate.getMonth() + 1).padStart(2, '0');
      const d = String(requestDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    return String(requestDate).substring(0, 10);
  }

  private moveRowToTop(rowId: string | number): void {
    const rowIndex = this.rowData.findIndex(row => row.id === rowId);
    if (rowIndex <= 0) {
      if (this.gridApi) {
        this.gridApi.ensureIndexVisible(0);
      }
      return;
    }

    const [targetRow] = this.rowData.splice(rowIndex, 1);
    this.rowData = [targetRow, ...this.rowData];
    this.fullRowData = [...this.rowData];

    if (!this.gridApi) {
      return;
    }

    const currentNode = this.gridApi.getRowNode(String(rowId));
    const wasExpanded = !!currentNode?.expanded;
    const wasSelected = !!currentNode?.isSelected?.();

    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      this.gridApi.ensureIndexVisible(0);
      const movedNode = this.gridApi.getRowNode(String(rowId));
      if (wasSelected && movedNode) {
        movedNode.setSelected(true);
      }
      if (wasExpanded && movedNode) {
        movedNode.setExpanded(true);
      }
      this.gridApi.refreshCells({ force: true });
    }, 0);
  }

  private async flushPendingGridEdits(): Promise<void> {
    if (!this.gridApi) {
      return;
    }

    this.gridApi.stopEditing();
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  async saveChanges(): Promise<void> {
    await this.flushPendingGridEdits();

    // Filtrar las filas nuevas o modificadas
    const itemsToSave = this.rowData.filter(row => row.__isNew || row.__modified);
    const invalidDepartmentMessage = await this.validateDepartmentsBeforeSave(itemsToSave);

    if (itemsToSave.length === 0) {
      alerts.reqBasicAlert('Información', 'No hay cambios que guardar', 'info');
      return;
    }
    if (invalidDepartmentMessage) {
      alerts.reqWarningToast('Departamento invÃ¡lido', invalidDepartmentMessage);
      return;
    }



    const newItems = itemsToSave.filter(row => row.__isNew);
    const modifiedItems = itemsToSave.filter(row => row.__modified && !row.__isNew);

    let hasErrors = false;

    try {
      // 1. Guardar nuevas requisiciones
      if (newItems.length > 0) {


        for (const item of newItems) {
          const newReqData = {
            id: 0, // Siempre 0 para nuevos registros
            idRoot: this.idRoot,
            folio: item.requisitionNumber || '',
            typeReference: 'branch',
            idReq: 0,
            idReference: item.idReference, // ✅ Usar el idReference de la fila, NO this.idBranch
            dateCreate: item.requestDate,
            idProvider: 0,
            idDepartament: item.departmentId || 0,
            delivery: item.delivery || 'NO APLICA', // ✅ Valor por defecto del backend
            deliveryTime: item.deliveryTime || '1 DAY', // ✅ Valor por defecto del backend
            typeOc: item.typeOc || 'INSUMOS', // ✅ Valor por defecto del backend
            dateSupply: item.dateSupply || this.localISOString(),
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



          try {
            await new Promise<void>((resolve, reject) => {
              this.ocAndReqsService.addOcAndReq(newReqData).subscribe({
                next: (response: any) => {
                  if (response?.id) {
                    this.pendingNewIds.add(response.id);
                  }
                  resolve();
                },
                error: (err) => {
                  hasErrors = true;
                  reject(err);
                }
              });
            });

            // ✅ Después de guardar exitosamente, confirmar el folio para incrementar el consecutivo
            try {
              const prefixSetup = await firstValueFrom(
                this.prefixSetupService.getPrefixSetup('branch', item.idReference)
              );
              if (prefixSetup && prefixSetup.id) {
                await this.prefixSetupService.confirmFolio(prefixSetup.id, 'req');
              }
            } catch (err) {
              console.warn('⚠️ No se pudo confirmar el folio:', err);
              // No bloquear el flujo si no se puede confirmar el folio
            }
          } catch (err) {
            // Error ya manejado arriba
          }
        }

        // Limpiar los contadores locales
        this.localConsecutivesByBranch.clear();
      }

      // 2. Actualizar requisiciones modificadas
      if (modifiedItems.length > 0) {


        for (const item of modifiedItems) {
          // Validar que tenga un ID válido (no temporal)
          if (!item.id || String(item.id).startsWith('temp_')) {
            continue;
          }

          const requestDateToSave = this.normalizeRequestDate(item.requestDate);
          const solicitToSave = item.solicitedBy || this.currentUserName;

          const updateReqData = {
            id: item.id,
            folio: item.requisitionNumber || '',
            typeReference: 'branch',
            idReq: 0,
            idReference: item.idReference,
            dateCreate: requestDateToSave,
            idProvider: 0,
            idDepartament: item.departmentId || 0,
            delivery: item.delivery || 'NO APLICA',
            deliveryTime: item.deliveryTime || '1 DAY',
            typeOc: item.typeOc || 'INSUMOS',
            dateSupply: item.dateSupply || this.localISOString(),
            idPayment: item.idPayment || 0,
            idCurrency: item.idCurrency || 0,
            conditions: item.conditions || null,
            idAuthorize: 0,
            priority: item.column8 || null,
            solicit: solicitToSave,
            discount: 0,
            ivaRetention: 0,
            idSolicit: 0,
            address: item.address || null,
            city: item.city || null,
            phone: item.phone || null,
            type: 'REQUIS',
            compliancePedimento: 0,
            complianceRequesicion: 0,
            comments: item.comments || null,
            close: item.close || false,
            active: item.active !== false
          };

          await new Promise<void>((resolve, reject) => {
            this.ocAndReqsService.updateOcAndReq(item.id, updateReqData).subscribe({
              next: () => {
                // Actualizar display local
                item.solicitedBy = solicitToSave;
                item.requestDate = requestDateToSave;
                resolve();
              },
              error: (err) => {
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

        // ✅ Limpiar el contador local de consecutivos
        this.localConsecutivesByBranch.clear();


        alerts.reqSuccessToast('Guardado', `Se guardaron ${itemsToSave.length} requisiciones correctamente`);

        // Recargar las requisiciones desde el servidor
        this.loadRequisitions();
      } else {
        alerts.reqWarningToast('Advertencia', 'Algunos cambios no se pudieron guardar');
      }

    } catch (error) {

      alerts.reqErrorToast('Error', 'Error al guardar los cambios');
    }
  }

  refreshData(): void {
    this.loadRequisitions();
    this.hasUnsavedChanges = false;
  }

  generatePDF(): void {
    if (!this.selectedRequisitionId) {
      alerts.reqErrorToast('Error', 'Seleccione una requisición primero');
      return;
    }

    // Validar que no sea una requisición temporal
    if (String(this.selectedRequisitionId).startsWith('temp_')) {
      alerts.reqWarningToast('Error', 'Guarde la requisición antes de generar el PDF');
      return;
    }

    // Llamar al servicio para generar PDF
    this.receiptsDelisonService.generateOC(this.selectedRequisitionId, 'open');
  }

  components = {
    selectDepartmentEditor: SelectDepartmentEditorComponent
  };

  private showDepartmentTooltip(departmentName: string, optionRect: DOMRect): void {
    this.hideDepartmentTooltip();

    this.departmentTooltipElement = this.renderer.createElement('div');
    this.renderer.setStyle(this.departmentTooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.departmentTooltipElement, 'z-index', '10001');
    this.renderer.setStyle(this.departmentTooltipElement, 'pointer-events', 'none');
    this.renderer.setStyle(this.departmentTooltipElement, 'min-width', '280px');
    this.renderer.setStyle(this.departmentTooltipElement, 'max-width', '400px');

    const arrow = this.renderer.createElement('div');
    this.renderer.setStyle(arrow, 'position', 'absolute');
    this.renderer.setStyle(arrow, 'left', '-8px');
    this.renderer.setStyle(arrow, 'top', '20px');
    this.renderer.setStyle(arrow, 'width', '0');
    this.renderer.setStyle(arrow, 'height', '0');
    this.renderer.setStyle(arrow, 'border-top', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-bottom', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-right', '8px solid #1e40af');
    this.renderer.appendChild(this.departmentTooltipElement, arrow);

    const content = this.renderer.createElement('div');
    this.renderer.setStyle(content, 'border-radius', '8px');
    this.renderer.setStyle(content, 'box-shadow', '0 8px 24px rgba(0, 0, 0, 0.4)');
    this.renderer.setStyle(content, 'overflow', 'hidden');
    this.renderer.setStyle(content, 'border', '1px solid rgba(255, 255, 255, 0.1)');
    this.renderer.setStyle(content, 'background', 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)');

    const header = this.renderer.createElement('div');
    this.renderer.setStyle(header, 'background', 'rgba(255, 255, 255, 0.15)');
    this.renderer.setStyle(header, 'padding', '10px 14px');
    this.renderer.setStyle(header, 'border-bottom', '1px solid rgba(255, 255, 255, 0.2)');
    this.renderer.setStyle(header, 'color', '#ffffff');
    this.renderer.setStyle(header, 'font-size', '13px');
    this.renderer.setStyle(header, 'display', 'flex');
    this.renderer.setStyle(header, 'align-items', 'center');
    this.renderer.setStyle(header, 'gap', '8px');
    this.renderer.setStyle(header, 'font-weight', '600');

    const headerIcon = this.renderer.createElement('i');
    this.renderer.addClass(headerIcon, 'bi');
    this.renderer.addClass(headerIcon, 'bi-building');
    this.renderer.setStyle(headerIcon, 'font-size', '16px');
    this.renderer.appendChild(header, headerIcon);

    const headerText = this.renderer.createElement('strong');
    const headerTextNode = this.renderer.createText(departmentName);
    this.renderer.appendChild(headerText, headerTextNode);
    this.renderer.appendChild(header, headerText);
    this.renderer.appendChild(content, header);

    const body = this.renderer.createElement('div');
    this.renderer.setStyle(body, 'padding', '12px 14px');
    this.renderer.setStyle(body, 'color', '#e2e8f0');
    this.renderer.setStyle(body, 'font-size', '12px');

    // Fila de Modificación
    const modRow = this.renderer.createElement('div');
    this.renderer.setStyle(modRow, 'display', 'flex');
    this.renderer.setStyle(modRow, 'align-items', 'center');
    this.renderer.setStyle(modRow, 'gap', '8px');
    this.renderer.setStyle(modRow, 'margin-bottom', '10px');

    const modLabel = this.renderer.createElement('span');
    this.renderer.setStyle(modLabel, 'color', 'rgba(255, 255, 255, 0.8)');
    this.renderer.setStyle(modLabel, 'font-weight', '600');
    const modLabelText = this.renderer.createText('Modificación:');
    this.renderer.appendChild(modLabel, modLabelText);
    this.renderer.appendChild(modRow, modLabel);

    const modValue = this.renderer.createElement('span');
    this.renderer.setStyle(modValue, 'color', '#ffffff');
    const modValueText = this.renderer.createText('--');
    this.renderer.appendChild(modValue, modValueText);
    this.renderer.appendChild(modRow, modValue);

    this.renderer.appendChild(body, modRow);

    // Fila de Origen
    const infoRow = this.renderer.createElement('div');
    this.renderer.setStyle(infoRow, 'display', 'flex');
    this.renderer.setStyle(infoRow, 'align-items', 'center');
    this.renderer.setStyle(infoRow, 'gap', '8px');

    const infoLabel = this.renderer.createElement('span');
    this.renderer.setStyle(infoLabel, 'color', 'rgba(255, 255, 255, 0.8)');
    this.renderer.setStyle(infoLabel, 'font-weight', '600');
    const infoLabelText = this.renderer.createText('Origen:');
    this.renderer.appendChild(infoLabel, infoLabelText);
    this.renderer.appendChild(infoRow, infoLabel);

    const infoValue = this.renderer.createElement('span');
    this.renderer.setStyle(infoValue, 'color', '#ffffff');
    const infoValueText = this.renderer.createText(departmentName);
    this.renderer.appendChild(infoValue, infoValueText);
    this.renderer.appendChild(infoRow, infoValue);

    this.renderer.appendChild(body, infoRow);
    this.renderer.appendChild(content, body);
    this.renderer.appendChild(this.departmentTooltipElement, content);
    this.renderer.appendChild(document.body, this.departmentTooltipElement);

    const top = optionRect.top;
    const left = optionRect.right + 8;
    this.renderer.setStyle(this.departmentTooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.departmentTooltipElement, 'left', `${left}px`);
  }

  private hideDepartmentTooltip(): void {
    if (this.departmentTooltipElement) {
      this.renderer.removeChild(document.body, this.departmentTooltipElement);
      this.departmentTooltipElement = null;
    }
  }

  private showSolicitedByTooltip(personName: string, optionRect: DOMRect): void {
    this.hideSolicitedByTooltip();

    this.solicitedByTooltipElement = this.renderer.createElement('div');
    this.renderer.setStyle(this.solicitedByTooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.solicitedByTooltipElement, 'z-index', '10001');
    this.renderer.setStyle(this.solicitedByTooltipElement, 'pointer-events', 'none');
    this.renderer.setStyle(this.solicitedByTooltipElement, 'min-width', '280px');
    this.renderer.setStyle(this.solicitedByTooltipElement, 'max-width', '400px');

    const arrow = this.renderer.createElement('div');
    this.renderer.setStyle(arrow, 'position', 'absolute');
    this.renderer.setStyle(arrow, 'left', '-8px');
    this.renderer.setStyle(arrow, 'top', '20px');
    this.renderer.setStyle(arrow, 'width', '0');
    this.renderer.setStyle(arrow, 'height', '0');
    this.renderer.setStyle(arrow, 'border-top', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-bottom', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-right', '8px solid #1e40af');
    this.renderer.appendChild(this.solicitedByTooltipElement, arrow);

    const content = this.renderer.createElement('div');
    this.renderer.setStyle(content, 'border-radius', '8px');
    this.renderer.setStyle(content, 'box-shadow', '0 8px 24px rgba(0, 0, 0, 0.4)');
    this.renderer.setStyle(content, 'overflow', 'hidden');
    this.renderer.setStyle(content, 'border', '1px solid rgba(255, 255, 255, 0.1)');
    this.renderer.setStyle(content, 'background', 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)');

    const header = this.renderer.createElement('div');
    this.renderer.setStyle(header, 'background', 'rgba(255, 255, 255, 0.15)');
    this.renderer.setStyle(header, 'padding', '10px 14px');
    this.renderer.setStyle(header, 'border-bottom', '1px solid rgba(255, 255, 255, 0.2)');
    this.renderer.setStyle(header, 'color', '#ffffff');
    this.renderer.setStyle(header, 'font-size', '13px');
    this.renderer.setStyle(header, 'display', 'flex');
    this.renderer.setStyle(header, 'align-items', 'center');
    this.renderer.setStyle(header, 'gap', '8px');
    this.renderer.setStyle(header, 'font-weight', '600');

    const headerIcon = this.renderer.createElement('i');
    this.renderer.addClass(headerIcon, 'bi');
    this.renderer.addClass(headerIcon, 'bi-person');
    this.renderer.setStyle(headerIcon, 'font-size', '16px');
    this.renderer.appendChild(header, headerIcon);

    const headerText = this.renderer.createElement('strong');
    const headerTextNode = this.renderer.createText(personName);
    this.renderer.appendChild(headerText, headerTextNode);
    this.renderer.appendChild(header, headerText);
    this.renderer.appendChild(content, header);

    const body = this.renderer.createElement('div');
    this.renderer.setStyle(body, 'padding', '12px 14px');
    this.renderer.setStyle(body, 'color', '#e2e8f0');
    this.renderer.setStyle(body, 'font-size', '12px');

    // Fila de Modificación
    const modRow = this.renderer.createElement('div');
    this.renderer.setStyle(modRow, 'display', 'flex');
    this.renderer.setStyle(modRow, 'align-items', 'center');
    this.renderer.setStyle(modRow, 'gap', '8px');
    this.renderer.setStyle(modRow, 'margin-bottom', '10px');

    const modLabel = this.renderer.createElement('span');
    this.renderer.setStyle(modLabel, 'color', 'rgba(255, 255, 255, 0.8)');
    this.renderer.setStyle(modLabel, 'font-weight', '600');
    const modLabelText = this.renderer.createText('Modificación:');
    this.renderer.appendChild(modLabel, modLabelText);
    this.renderer.appendChild(modRow, modLabel);

    const modValue = this.renderer.createElement('span');
    this.renderer.setStyle(modValue, 'color', '#ffffff');
    const modValueText = this.renderer.createText('--');
    this.renderer.appendChild(modValue, modValueText);
    this.renderer.appendChild(modRow, modValue);

    this.renderer.appendChild(body, modRow);

    // Fila de Solicito
    const infoRow = this.renderer.createElement('div');
    this.renderer.setStyle(infoRow, 'display', 'flex');
    this.renderer.setStyle(infoRow, 'align-items', 'center');
    this.renderer.setStyle(infoRow, 'gap', '8px');

    const infoLabel = this.renderer.createElement('span');
    this.renderer.setStyle(infoLabel, 'color', 'rgba(255, 255, 255, 0.8)');
    this.renderer.setStyle(infoLabel, 'font-weight', '600');
    const infoLabelText = this.renderer.createText('Solicito:');
    this.renderer.appendChild(infoLabel, infoLabelText);
    this.renderer.appendChild(infoRow, infoLabel);

    const infoValue = this.renderer.createElement('span');
    this.renderer.setStyle(infoValue, 'color', '#ffffff');
    const infoValueText = this.renderer.createText(personName);
    this.renderer.appendChild(infoValue, infoValueText);
    this.renderer.appendChild(infoRow, infoValue);

    this.renderer.appendChild(body, infoRow);
    this.renderer.appendChild(content, body);
    this.renderer.appendChild(this.solicitedByTooltipElement, content);
    this.renderer.appendChild(document.body, this.solicitedByTooltipElement);

    const top = optionRect.top;
    const left = optionRect.right + 8;
    this.renderer.setStyle(this.solicitedByTooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.solicitedByTooltipElement, 'left', `${left}px`);
  }

  private hideSolicitedByTooltip(): void {
    if (this.solicitedByTooltipElement) {
      this.renderer.removeChild(document.body, this.solicitedByTooltipElement);
      this.solicitedByTooltipElement = null;
    }
  }
}
