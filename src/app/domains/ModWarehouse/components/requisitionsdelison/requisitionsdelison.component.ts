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
import { RolesService } from 'app/services/roles.service';
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
  private rolesService = inject(RolesService);

  private gridApi!: GridApi;
  private isGeneratingReport: boolean = false;
  private isInitialized: boolean = false; // Flag para saber si ya se inicializó el componente

  constructor() {
    // ✅ Usar effect para reaccionar a cambios en el signal de sucursal
    effect(() => {
      const newIdBranch = this.signalsService.getBranchSelectedBySidebar()();

      console.log('🔄 Cambio detectado en idBranch:', newIdBranch);

      // Si cambió el idBranch y es válido, recargar requisiciones
      if (newIdBranch !== undefined && newIdBranch !== null && newIdBranch !== this.idBranch) {
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
      } else if (!newIdBranch && newIdBranch !== 0 && this.isInitialized) {
        // ⚠️ Solo mostrar alerta si ya se inicializó el componente (evita alerta en refresh)
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

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    // ✅ Esperar a que los signals se establezcan antes de inicializar
    setTimeout(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.currentUserName = this.signalsService.getDisplayName()() || 'Usuario';
      this.idUser = this.signalsService.getIdUSer()(); // ✅ Obtener ID del usuario

      console.log('🏢 idRoot:', this.idRoot);
      console.log('👤 Usuario actual:', this.currentUserName);
      console.log('🆔 idUser:', this.idUser);
      console.log('ℹ️ El idBranch se obtendrá desde el effect() cuando esté disponible');

      // ✅ Solo cargar si idRoot es válido
      if (this.idRoot) {
        this.loadBranches();
        this.obtenerDepartamentos();
      } else {
        console.warn('⚠️ idRoot no está disponible todavía, reintentando...');
        // Reintentar después de un delay adicional
        setTimeout(() => {
          this.idRoot = this.signalsService.getRootSelectedBySidebar()();
          if (this.idRoot) {
            console.log('✅ idRoot obtenido en reintento:', this.idRoot);
            this.loadBranches();
            this.obtenerDepartamentos();
          }
        }, 300);
      }

      // ✅ Marcar como inicializado
      this.isInitialized = true;
      console.log('✅ Componente marcado como inicializado');
    }, 200);
  }

  loadBranches() {
    this.branchsService.getBranches(this.idRoot).subscribe({
      next: (data: any[]) => {
        this.branches = data;
        this.branchesLoaded = true;
        console.log('🏪 Sucursales cargadas:', this.branches.length);

        // ✅ Obtener el idBranch actual del signal (puede ser negativo para "Todas las sucursales")
        const currentIdBranch = this.signalsService.getBranchSelectedBySidebar()();

        // ✅ Si hay un idBranch seleccionado (incluso si es negativo), cargar las requisiciones ahora
        if (currentIdBranch !== null && currentIdBranch !== undefined) {
          this.idBranch = currentIdBranch;
          console.log('✅ idBranch inicial detectado:', this.idBranch, '- cargando requisiciones ahora');
          this.loadRequisitions();
        } else {
          console.log('⏳ No hay idBranch inicial, esperando cambios del sidebar...');
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
    if (this.idBranch === null || this.idBranch === undefined) {
      console.warn('⚠️ No se puede cargar requisiciones: idBranch no está definido');
      this.fullRowData = [];
      this.rowData = [];
      return;
    }

    // 🔍 Detectar si se seleccionó "Todas las sucursales" (ID negativo)
    const isAllBranches = this.idBranch < 0;

    if (isAllBranches) {
      console.log('🌐 Cargando requisiciones de TODAS las sucursales...');
      this.loadRequisitionsFromAllBranches();
    } else {
      console.log('📋 Cargando requisiciones de una sucursal específica:', this.idBranch);
      this.loadRequisitionsFromSingleBranch(this.idBranch);
    }
  }

  private loadRequisitionsFromAllBranches() {
    // 🔍 Usar el catálogo de branches que ya está cargado en this.branches
    if (!this.branches || this.branches.length === 0) {
      console.warn('⚠️ No hay sucursales disponibles en el catálogo');
      this.fullRowData = [];
      this.rowData = [];
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', []);
      }
      return;
    }

    console.log('✅ Usando catálogo de', this.branches.length, 'sucursales ya cargadas');

    // 🔄 Hacer múltiples llamadas al endpoint, una por cada branch
    const requisitionPromises = this.branches.map(branch => {
      return new Promise<any[]>((resolve) => {
        this.ocAndReqsService.getOcAndReqs('branch', branch.id, 'REQUIS').subscribe({
          next: (data: any) => {
            console.log(`✅ Branch ${branch.name} (${branch.id}): ${Array.isArray(data) ? data.length : 0} requisiciones`);
            resolve(Array.isArray(data) ? data : []);
          },
          error: (error) => {
            console.error(`❌ Error al cargar requisiciones del branch ${branch.name}:`, error);
            resolve([]); // Retornar array vacío en caso de error
          }
        });
      });
    });

    // 🔀 Esperar a que todas las promesas se resuelvan
    Promise.all(requisitionPromises).then((allRequisitions: any[][]) => {
      // Combinar todos los resultados en un solo array
      const combinedData = allRequisitions.flat();
      console.log(`✅ Total de requisiciones combinadas: ${combinedData.length}`);

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
          requestDate: req.dateCreate || new Date().toISOString(),
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
          idReference: req.idReference
        };
      });

      this.rowData = [...this.fullRowData];
      console.log('✅ Requisiciones de todas las sucursales cargadas:', this.fullRowData.length);

      // ✅ Pre-cargar roles para todas las sucursales únicas en los datos
      this.preloadRolesForRequisitions();

      // Refrescar el grid
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.refreshCells({ force: true });
      }
    });
  }

  private loadRequisitionsFromSingleBranch(branchId: number) {
    console.log('📋 Cargando requisiciones desde el servidor...');
    console.log('   typeReference: branch');
    console.log('   idReference:', branchId);
    console.log('   type: REQUIS');

    // ✅ Llamar al endpoint real
    this.ocAndReqsService.getOcAndReqs('branch', branchId, 'REQUIS').subscribe({
      next: (data: any) => {
        console.log('✅ Datos recibidos del servidor:', data);

        // Mapear los datos del servidor al formato esperado por el grid
        this.fullRowData = Array.isArray(data) ? data.map((req: any) => {
          // ✅ Buscar el nombre de la sucursal usando idReference
          const branch = this.branches.find(b => b.id === req.idReference);
          const branchName = branch?.name || branch?.description || req.idReference?.toString() || '';

          // ✅ El nombre del departamento se obtendrá dinámicamente desde getRolesByBranchDelison
          // cuando se visualice o edite la celda (no se puede obtener aquí de forma sincrónica)
          const departmentName = '';

          console.log(`📋 Requisición ${req.id}: idReference=${req.idReference} → Sucursal: ${branchName}, idDepartament: ${req.idDepartament}, countrow: ${req.countrow}`);

          return {
            id: req.id,
            branch: branchName, // Nombre de la sucursal desde el catálogo
            requisitionNumber: req.folio || '', // Número de requisición
            requestDate: req.dateCreate || new Date().toISOString(), // Fecha de creación
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

        this.rowData = [...this.fullRowData];

        console.log('✅ Requisiciones cargadas:', this.fullRowData.length);

        // ✅ Pre-cargar roles para todas las sucursales únicas en los datos
        this.preloadRolesForRequisitions();

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
    if (this._colMaster.length > 0) {
      return this._colMaster;
    }

    this._colMaster = [
      {
        field: 'idReference',
        headerName: 'Sucursal',
        width: 150,
        // ✅ Solo editable si está en modo "Todas las sucursales" (idBranch negativo o no definido)
        editable: () => !this.idBranch || this.idBranch < 0,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => {
          return {
            values: this.branches.map(b => b.id),
            valueListGap: 0,
            valueListMaxHeight: 220,
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
          console.log('🔧 valueSetter idReference - newValue:', params.newValue, 'oldValue:', params.oldValue);
          console.log('🔧 Tipo de newValue:', typeof params.newValue);
          console.log('🔧 Datos actuales antes del cambio:', {
            idReference: params.data.idReference,
            branch: params.data.branch
          });

          // AG Grid agSelectCellEditor retorna el ID directamente como string
          const branchId = Number(params.newValue);

          // ✅ Validar que el ID no sea negativo (evitar -9 de "Todas las sucursales")
          if (branchId <= 0 || isNaN(branchId)) {
            console.error('❌ ID de sucursal inválido:', branchId);
            return false;
          }

          const branch = this.branches.find(b => b.id === branchId);

          if (branch) {
            params.data.idReference = branchId;
            params.data.branch = branch.name || branch.description;

            console.log('✅ Sucursal asignada:', {
              branchName: params.data.branch,
              idReference: params.data.idReference,
              isNew: params.data.__isNew
            });

            // 🔄 Obtener el prefijo y consecutivo de la nueva sucursal y actualizar el número de requisición
            this.typexPrefixesService.getPrefix('branch', branchId).subscribe({
              next: (prefixData: any) => {
                // ✅ Si es una fila nueva, usar el contador local
                let nextConsecutive: number;

                if (params.data.__isNew) {
                  let localConsecutive = this.localConsecutivesByBranch.get(branchId);

                  if (localConsecutive === undefined) {
                    // Primera vez que se asigna esta sucursal
                    localConsecutive = (prefixData.consecutive || 0) + 1;
                    this.localConsecutivesByBranch.set(branchId, localConsecutive);
                  }

                  nextConsecutive = localConsecutive;
                  console.log(`🔢 Usando consecutivo local para sucursal ${branchId}: ${nextConsecutive}`);
                } else {
                  // Fila editada, usar consecutivo del servidor
                  nextConsecutive = (prefixData.consecutive || 0) + 1;
                  console.log(`📊 Usando consecutivo del servidor para sucursal ${branchId}: ${nextConsecutive}`);
                }

                const newRequisitionNumber = `${prefixData.prefix || ''}${nextConsecutive}`;
                params.data.requisitionNumber = newRequisitionNumber;

                console.log('✅ Número de requisición actualizado:', {
                  oldNumber: params.data.requisitionNumber,
                  newNumber: newRequisitionNumber,
                  prefix: prefixData.prefix,
                  consecutive: nextConsecutive,
                  isNew: params.data.__isNew
                });

                // Guardar el prefixData para usarlo al guardar
                this.currentPrefixData = prefixData;

                // Forzar actualización del grid para mostrar el nuevo número
                if (this.gridApi) {
                  this.gridApi.refreshCells({ rowNodes: [params.node], force: true });
                }
              },
              error: (err) => {
                console.error('❌ Error al obtener prefijo de la nueva sucursal:', err);

                // ✅ Verificar si es una fila nueva o una fila editada
                if (params.data.__isNew) {
                  // 🗑️ Fila nueva: Eliminar la fila del grid
                  console.log('❌ Fila nueva sin prefijo configurado. Eliminando fila...');

                  alerts.basicAlert(
                    'Error',
                    'No se encontró configuración de prefijo para esta sucursal. La fila será eliminada.',
                    'error'
                  );

                  // Eliminar de rowData y fullRowData
                  this.rowData = this.rowData.filter(r => r.id !== params.data.id);
                  this.fullRowData = this.fullRowData.filter(r => r.id !== params.data.id);

                  // Actualizar el grid
                  if (this.gridApi) {
                    this.gridApi.setGridOption('rowData', this.rowData);
                  }
                } else {
                  // 🔄 Fila editada: Restaurar al branch original
                  console.log('❌ Fila editada sin prefijo configurado. Restaurando branch original...');

                  alerts.basicAlert(
                    'Advertencia',
                    'No se encontró configuración de prefijo para esta sucursal. Se restaurará la sucursal original.',
                    'warning'
                  );

                  // Restaurar al branch original (usando oldValue del params)
                  const originalBranchId = params.oldValue;
                  const originalBranch = this.branches.find(b => b.id === originalBranchId);

                  if (originalBranch) {
                    params.data.idReference = originalBranchId;
                    params.data.branch = originalBranch.name || originalBranch.description;

                    console.log('✅ Sucursal restaurada a:', {
                      branchName: params.data.branch,
                      idReference: params.data.idReference
                    });

                    // Forzar actualización del grid
                    if (this.gridApi) {
                      this.gridApi.refreshCells({ rowNodes: [params.node], force: true });
                    }
                  }
                }
              }
            });

            // Marcar como modificado si no es nuevo
            if (!params.data.__isNew) {
              params.data.__modified = true;
              console.log('🔴 Marcado como __modified');
            }
            this.hasUnsavedChanges = true;
            console.log('💾 hasUnsavedChanges = true');
            return true;
          }

          console.error('❌ No se encontró la sucursal con ID:', branchId);
          return false;
        },
        cellEditorPopup: true
      },
      {
        field: 'requisitionNumber',
        headerName: '# Requisicion',
        width: 120,
        filter: true,
        editable: false, // ✅ NO editable - se genera automáticamente
        cellStyle: { backgroundColor: '#f0f0f0' } // Estilo para indicar que no es editable
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
        editable: (params: any) => {
          // ✅ Solo editable si la fila tiene una sucursal seleccionada
          return params.data && params.data.idReference > 0;
        },
        cellEditor: 'agSelectCellEditor',
        valueGetter: (params: any) => {
          // ✅ Convertir el ID numérico a description para el editor
          const departmentId = params.data?.departmentId;
          if (!departmentId) return null;

          const branchId = params.data?.idReference;
          const cachedRoles = this.rolesByBranchCache.get(branchId);

          if (cachedRoles) {
            const role = cachedRoles.find(r => r.id === departmentId);
            if (role) {
              return role.description; // Retornar solo el description
            }
          }

          return null;
        },
        cellEditorParams: (params: any) => {
          // ✅ Obtener roles según la sucursal de la fila
          const branchId = params.data?.idReference;

          if (!branchId || !this.idUser) {
            console.warn('⚠️ No se puede obtener roles: branchId o idUser no disponible');
            return { values: [] };
          }

          // ✅ Si ya tenemos los roles en cache, usarlos
          if (this.rolesByBranchCache.has(branchId)) {
            const roles = this.rolesByBranchCache.get(branchId) || [];
            console.log(`✅ Usando roles en cache para sucursal ${branchId}:`, roles);

            // Crear mapas bidireccionales
            const descriptionToId: any = {};
            const idToDescription: any = {};

            roles.forEach(r => {
              descriptionToId[r.description] = r.id;
              idToDescription[r.id] = r.description;
            });

            // Guardar temporalmente para el valueSetter
            (params.data as any).__roleMapDescToId = descriptionToId;
            (params.data as any).__roleMapIdToDesc = idToDescription;

            return {
              values: roles.map(r => r.description), // Solo descriptions: ["PRUEBA", "OTRO", ...]
              valueListGap: 0,
              valueListMaxHeight: 220
            };
          }

          console.warn('⚠️ Roles no encontrados en cache para sucursal', branchId);
          return { values: [] };
        },
        valueFormatter: (params) => {
          // ✅ Mostrar el nombre del departamento
          if (!params.value) return '';

          const branchId = params.data?.idReference;
          const cachedRoles = this.rolesByBranchCache.get(branchId);

          if (cachedRoles) {
            const role = cachedRoles.find(r => r.id === params.value);
            return role?.description || params.value?.toString() || '';
          }

          return params.data?.departmentName || params.value?.toString() || '';
        },
        valueSetter: (params: any) => {
          console.log('🔧 valueSetter departmentId - newValue:', params.newValue, 'oldValue:', params.oldValue);

          if (!params.newValue) {
            params.data.departmentId = null;
            params.data.departmentName = '';
            return true;
          }

          // ✅ El valor viene como description, usar el mapa para obtener el ID
          const descToIdMap = (params.data as any).__roleMapDescToId;

          if (descToIdMap && descToIdMap[params.newValue]) {
            const departmentId = descToIdMap[params.newValue];
            const departmentName = params.newValue;

            params.data.departmentId = departmentId;
            params.data.departmentName = departmentName;

            console.log('✅ Departamento asignado:', {
              description: departmentName,
              departmentId: departmentId,
              isNew: params.data.__isNew
            });
          } else {
            // Fallback: buscar en cache
            const branchId = params.data.idReference;
            const cachedRoles = this.rolesByBranchCache.get(branchId);

            if (cachedRoles) {
              const role = cachedRoles.find(r => r.description === params.newValue);
              if (role) {
                params.data.departmentId = role.id;
                params.data.departmentName = role.description;
                console.log('✅ Departamento asignado desde cache fallback:', role);
              }
            } else {
              console.warn('⚠️ No se pudo mapear description a ID:', params.newValue);
              return false;
            }
          }

          // Marcar como modificado
          if (!params.data.__isNew) {
            params.data.__modified = true;
            console.log('🔴 Marcado como __modified');
          }
          this.hasUnsavedChanges = true;
          console.log('💾 hasUnsavedChanges = true');

          return true;
        },
        cellEditorPopup: true
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

    return this._colMaster;
  }

  onCellClicked(event: any): void {
    event.node.setSelected(true);

    const colId = event.column.getColId();
    const isDetailColumn = colId === 'articlesCount';
    const isDepartmentColumn = colId === 'departmentId';

    // ✅ Si se hace clic en la columna de departamento, pre-cargar los roles
    if (isDepartmentColumn) {
      const branchId = event.data?.idReference;

      if (branchId && this.idUser && !this.rolesByBranchCache.has(branchId)) {
        console.log(`🔄 Pre-cargando roles para sucursal ${branchId}...`);

        this.rolesService.getRolesByBranchDelison(this.idUser, branchId).subscribe({
          next: (roles: any[]) => {
            const mappedRoles = roles.map(r => ({
              id: r.id,
              description: r.description,
              name: r.description
            }));

            this.rolesByBranchCache.set(branchId, mappedRoles);
            console.log(`✅ Roles pre-cargados para sucursal ${branchId}:`, mappedRoles);
          },
          error: (err) => {
            console.error('❌ Error al pre-cargar roles:', err);
          }
        });
      }
    }

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
    // ✅ Validar que haya al menos una sucursal disponible
    if (!this.branches || this.branches.length === 0) {
      alerts.basicAlert(
        'Error',
        'No hay sucursales disponibles. Por favor, espere a que se carguen las sucursales.',
        'error'
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
      console.log('⚠️ Modo "Todas las sucursales" activo, usando primera sucursal disponible:', selectedBranchId);
    }

    // Obtener el prefijo y consecutivo de la sucursal
    this.typexPrefixesService.getPrefix('branch', selectedBranchId).subscribe({
      next: (prefixData: any) => {
        console.log('✅ Prefijo obtenido:', prefixData);
        this.currentPrefixData = prefixData;

        // ✅ Usar consecutivo local si ya existe, sino inicializarlo desde el servidor
        let localConsecutive = this.localConsecutivesByBranch.get(selectedBranchId);

        if (localConsecutive === undefined) {
          // Primera vez que se agrega una fila para esta sucursal
          localConsecutive = (prefixData.consecutive || 0) + 1;
          this.localConsecutivesByBranch.set(selectedBranchId, localConsecutive);
        } else {
          // Ya existe un consecutivo local, incrementarlo
          localConsecutive++;
          this.localConsecutivesByBranch.set(selectedBranchId, localConsecutive);
        }

        // Generar el número de requisición: prefix + consecutivo local
        const requisitionNumber = `${prefixData.prefix || ''}${localConsecutive}`;
        console.log(`🔢 Consecutivo local para sucursal ${selectedBranchId}: ${localConsecutive}`);

        // Buscar el nombre de la sucursal
        const branch = this.branches.find(b => b.id === selectedBranchId);
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
          idReference: selectedBranchId, // ✅ Guardar el ID de la sucursal seleccionada (NO this.idBranch)
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

        console.log('✅ Nueva requisición agregada:', requisitionNumber, 'para sucursal:', branchName, '(ID:', selectedBranchId, ')');

        setTimeout(() => {
          const firstRowIndex = 0;
          this.gridApi.ensureIndexVisible(firstRowIndex);
          // ✅ Comenzar editando la columna de Sucursal si está en modo "Todas las sucursales"
          if (this.idBranch && this.idBranch < 0) {
            this.gridApi.startEditingCell({
              rowIndex: firstRowIndex,
              colKey: 'idReference' // Editar sucursal primero
            });
          } else {
            this.gridApi.startEditingCell({
              rowIndex: firstRowIndex,
              colKey: 'departmentId'
            });
          }
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

  /**
   * Pre-carga los roles para todas las sucursales únicas presentes en las requisiciones
   * Esto permite que el valueFormatter muestre los nombres correctamente al cargar
   */
  private preloadRolesForRequisitions(): void {
    if (!this.idUser) {
      console.warn('⚠️ No se puede pre-cargar roles: idUser no disponible');
      return;
    }

    // Obtener sucursales únicas de todas las requisiciones
    const uniqueBranchIds = new Set<number>();
    this.rowData.forEach(row => {
      if (row.idReference && row.idReference > 0) {
        uniqueBranchIds.add(row.idReference);
      }
    });

    console.log(`🔄 Pre-cargando roles para ${uniqueBranchIds.size} sucursales...`);

    // Cargar roles para cada sucursal única
    uniqueBranchIds.forEach(branchId => {
      // Solo cargar si no están ya en cache
      if (!this.rolesByBranchCache.has(branchId)) {
        this.rolesService.getRolesByBranchDelison(this.idUser, branchId).subscribe({
          next: (roles: any[]) => {
            const mappedRoles = roles.map(r => ({
              id: r.id,
              description: r.description,
              name: r.description
            }));

            this.rolesByBranchCache.set(branchId, mappedRoles);
            console.log(`✅ Roles pre-cargados para sucursal ${branchId}:`, mappedRoles.length, 'roles');

            // Refrescar el grid para que muestre los nombres
            if (this.gridApi) {
              this.gridApi.refreshCells({ force: true });
            }
          },
          error: (err) => {
            console.error(`❌ Error al pre-cargar roles para sucursal ${branchId}:`, err);
          }
        });
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

    // Para cada sucursal, obtener el consecutivo del servidor y contar cuántas filas nuevas hay
    newRowsByBranch.forEach((rows, branchId) => {
      // El consecutivo local debería ser: consecutivo_servidor + cantidad_de_filas_nuevas
      // Asumimos que ya se han agregado esas filas, entonces el próximo consecutivo sería:
      this.typexPrefixesService.getPrefix('branch', branchId).subscribe({
        next: (prefixData: any) => {
          const nextConsecutive = (prefixData.consecutive || 0) + rows.length;
          this.localConsecutivesByBranch.set(branchId, nextConsecutive);
          console.log(`🔄 Consecutivo local recalculado para sucursal ${branchId}: ${nextConsecutive} (${rows.length} filas nuevas)`);
        }
      });
    });
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
            idReference: item.idReference, // ✅ Usar el idReference de la fila, NO this.idBranch
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

        // ✅ Actualizar los consecutivos de TODAS las sucursales que se usaron
        // Agrupar las nuevas requisiciones por sucursal (idReference)
        const itemsByBranch = new Map<number, any[]>();

        for (const item of newItems) {
          const branchId = item.idReference;
          if (!itemsByBranch.has(branchId)) {
            itemsByBranch.set(branchId, []);
          }
          itemsByBranch.get(branchId)!.push(item);
        }

        // Actualizar el consecutivo de cada sucursal
        for (const [branchId, items] of itemsByBranch.entries()) {
          console.log(`🔄 Actualizando consecutivo para sucursal ${branchId} (${items.length} requisiciones)`);

          // Obtener el prefijo actual de esta sucursal
          await new Promise<void>((resolve, reject) => {
            this.typexPrefixesService.getPrefix('branch', branchId).subscribe({
              next: (prefixData: any) => {
                const newConsecutive = (prefixData.consecutive || 0) + items.length;

                const updatedPrefixData = {
                  reqType: 'branch',
                  idReqType: branchId,
                  prefix: prefixData.prefix,
                  consecutive: newConsecutive,
                  active: true
                };

                console.log('📤 Actualizando consecutivo:', updatedPrefixData);

                this.typexPrefixesService.updatePrefix('branch', branchId, updatedPrefixData).subscribe({
                  next: () => {
                    console.log(`✅ Consecutivo actualizado para sucursal ${branchId}: ${newConsecutive}`);
                    resolve();
                  },
                  error: (err) => {
                    console.error(`❌ Error al actualizar consecutivo de sucursal ${branchId}:`, err);
                    hasErrors = true;
                    reject(err);
                  }
                });
              },
              error: (err) => {
                console.error(`❌ Error al obtener prefijo de sucursal ${branchId}:`, err);
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
            idReference: item.idReference, // ✅ Usar el idReference de la fila, NO this.idBranch
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

        // ✅ Limpiar el contador local de consecutivos
        this.localConsecutivesByBranch.clear();
        console.log('🧹 Contador local de consecutivos limpiado');

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
