import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ColGroupDef, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { DetailCellRendererPedimentosComponent } from './detalle-pedimentosxproveedor.component';
import { SignalsService } from 'app/services/signals.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { BranchsService } from 'app/services/branchs.service';

@Component({
  selector: 'app-quote-delison',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ButtonCellRendererComponent, DetailCellRendererPedimentosComponent],
  templateUrl: './quote-delison.component.html',
  styleUrl: './quote-delison.component.scss'
})
export class QuoteDelisonComponent implements OnInit {

  // Inject services
  private signalsService = inject(SignalsService);
  private ocAndReqsService = inject(OcAndReqsService);
  private branchsService = inject(BranchsService);

  rowData: any[] = [];
  fullRowData: any[] = []; // Store original unfiltered data
  gridHeight: string = '80vh';
  private gridApi: GridApi;
  private isInitialized: boolean = false; // Flag para saber si ya se inicializó el componente

  idRoot: number = null;
  idBranch: number = null;
  branches: any[] = []; // Catálogo de sucursales
  branchesLoaded: boolean = false; // Flag para saber si ya se cargaron las sucursales

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  constructor() {
    // ✅ Usar effect para reaccionar a cambios en el signal de sucursal
    effect(() => {
      const newIdBranch = this.signalsService.getBranchSelectedBySidebar()();


      // Si cambió el idBranch y es válido, recargar cotizaciones
      if (newIdBranch !== undefined && newIdBranch !== null && newIdBranch !== this.idBranch) {
        this.idBranch = newIdBranch;

        // ✅ Esperar a que se carguen las sucursales antes de cargar cotizaciones
        if (this.branchesLoaded) {
          this.loadQuotes();
        } else {
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
          'Por favor, seleccione una sucursal en el sidebar para ver las cotizaciones',
          'warning'
        );
      }
    });
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    singleClickEdit: true,
    masterDetail: true,
    detailRowHeight: 700,
    detailCellRendererParams: {
      autoHeight: false
    },
    detailCellRenderer: DetailCellRendererPedimentosComponent
  };

  ngOnInit() {
    // ✅ Esperar a que los signals se establezcan antes de inicializar
    setTimeout(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();


      // ✅ Solo cargar si idRoot es válido
      if (this.idRoot) {
        this.loadBranches();
      } else {
        console.warn('⚠️ idRoot no está disponible todavía, reintentando...');
        // Reintentar después de un delay adicional
        setTimeout(() => {
          this.idRoot = this.signalsService.getRootSelectedBySidebar()();
          if (this.idRoot) {
            this.loadBranches();
          }
        }, 300);
      }

      // ✅ Marcar como inicializado
      this.isInitialized = true;
    }, 200);
  }

  loadBranches() {
    this.branchsService.getBranches(this.idRoot).subscribe({
      next: (data: any[]) => {
        this.branches = data;
        this.branchesLoaded = true;

        // ✅ Obtener el idBranch actual del signal (puede ser negativo para "Todas las sucursales")
        const currentIdBranch = this.signalsService.getBranchSelectedBySidebar()();

        // ✅ Si hay un idBranch seleccionado (incluso si es negativo), cargar las cotizaciones ahora
        if (currentIdBranch !== null && currentIdBranch !== undefined) {
          this.idBranch = currentIdBranch;
          this.loadQuotes();
        } else {
        }
      },
      error: (error) => {
        console.error('❌ Error al cargar sucursales:', error);
        this.branches = [];
        this.branchesLoaded = true; // Marcar como cargado aunque haya error
      }
    });
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
  }

  loadQuotes() {
    // ✅ Validar que idBranch sea válido antes de hacer la petición
    if (this.idBranch === null || this.idBranch === undefined) {
      console.warn('⚠️ No se puede cargar cotizaciones: idBranch no está definido');
      this.fullRowData = [];
      this.rowData = [];
      return;
    }

    // 🔍 Detectar si se seleccionó "Todas las sucursales" (ID negativo)
    const isAllBranches = this.idBranch < 0;

    if (isAllBranches) {
      this.loadQuotesFromAllBranches();
    } else {
      this.loadQuotesFromSingleBranch(this.idBranch);
    }
  }

  private async loadQuotesFromAllBranches() {
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


    // 🔄 PASO 1: Obtener REQUISICIONES de cada branch (igual que loadQuotesFromSingleBranch)
    const requisitionPromises = this.branches.map(branch => {
      return new Promise<any[]>((resolve) => {
        this.ocAndReqsService.getOcAndReqs('branch', branch.id, 'REQUIS').subscribe({
          next: (data: any) => {
            const requisiciones = Array.isArray(data) ? data : [];
            resolve(requisiciones);
          },
          error: (error) => {
            console.error(`❌ Error al cargar requisiciones del branch ${branch.name}:`, error);
            resolve([]);
          }
        });
      });
    });

    // 🔀 Esperar a que todas las requisiciones se carguen
    const allRequisitions = await Promise.all(requisitionPromises);
    const combinedRequisitions = allRequisitions.flat();

    // 🔄 PASO 2: Para cada requisición, cargar sus cotizaciones (igual que loadQuotesFromSingleBranch)
    const requisitionsWithQuotes = await Promise.all(combinedRequisitions.map(async (requisicion: any) => {
      // ✅ Buscar el nombre de la sucursal usando idReference
      const branch = this.branches.find(b => b.id === requisicion.idReference);
      const branchName = branch?.name || branch?.description || requisicion.idReference?.toString() || '';


      // ✅ PASO 2.1: Cargar COTIZACIONES de esta requisición
      let cotizaciones: any[] = [];
      try {
        const cotizacionesData: any = await new Promise((resolve, reject) => {
          this.ocAndReqsService.getOcAndReqs('requisition', requisicion.id, 'COTIZ').subscribe({
            next: (data) => resolve(data),
            error: (err) => reject(err)
          });
        });
        cotizaciones = Array.isArray(cotizacionesData) ? cotizacionesData : [];
      } catch (error) {
        console.error(`❌ Error al cargar cotizaciones de requisición ${requisicion.id}:`, error);
      }

      // ✅ PASO 2.2: Para cada cotización, cargar sus items y sus COTIZes de proveedor
      const pedimentosConItems = await Promise.all(cotizaciones.map(async (cotizacion: any) => {
        let items: any[] = [];
        try {
          const itemsData: any = await new Promise((resolve, reject) => {
            this.ocAndReqsService.getReqItems(cotizacion.id).subscribe({
              next: (data) => resolve(data),
              error: (err) => reject(err)
            });
          });
          items = Array.isArray(itemsData) ? itemsData : [];
        } catch (error) {
          console.error(`   ❌ Error al cargar items de cotización ${cotizacion.id}:`, error);
        }

        // Cargar COTIZes de proveedor (hijos del pedimento, typeReference='delison')
        let providerCotizs: any[] = [];
        try {
          const pcData: any = await new Promise((resolve, reject) => {
            this.ocAndReqsService.getOcAndReqs('delison', cotizacion.id, 'COTIZ').subscribe({
              next: (d) => resolve(d), error: (e) => reject(e)
            });
          });
          providerCotizs = Array.isArray(pcData) ? pcData : [];
        } catch (_) {}

        // Mapear slot A/B/C por folio → extraer idProvider + nombre (solicit)
        const slotA = providerCotizs.filter(c => c.folio?.includes('-A-')).sort((a,b) => b.id - a.id)[0];
        const slotB = providerCotizs.filter(c => c.folio?.includes('-B-')).sort((a,b) => b.id - a.id)[0];
        const slotC = providerCotizs.filter(c => c.folio?.includes('-C-')).sort((a,b) => b.id - a.id)[0];

        return {
          id: cotizacion.id,
          name: `Pedimento ${cotizacion.pedimento}`,
          pedimento: cotizacion.pedimento,
          folio: cotizacion.folio || '',
          idProvider:  slotA?.idProvider || 0,
          idProvider2: slotB?.idProvider || 0,
          idProvider3: slotC?.idProvider || 0,
          name_idProvider:  slotA?.solicit || '',
          name_idProvider2: slotB?.solicit || '',
          name_idProvider3: slotC?.solicit || '',
          createdBy: cotizacion.createdBy || cotizacion.solicit || '',
          items: items.map((item: any) => ({
            id: item.id,
            idSupplie: item.idSupplie || 0,
            nameArticle: item.nameArticle || '',
            recurrent: item.recurrent || '',
            article: item.description || item.nameArticle || '',
            quantity: item.quantity || 0,
            tipo: item.intorext || 'Externo',
            proveedorInterno: item.provint || '',
            priority: item.typePriority || 'Normal',
            comment: item.comment || '',
            pedimento: item.pedimento || false,
            numArticle: item.numArticle || '',
            code: item.code || '',
            pedimentoNumber: item.pedimentoNum || '',
            idMovement: item.idMovement || 0,
            measure: item.measure || '',
            price: item.price || 0,
            total: item.total || 0,
            type: item.type || 'COTIZ',
            idProvider: item.idProvider || 0,
            dateuse: item.dateuse || '',
            active: item.active !== undefined ? item.active : true,
            typePriority: item.typePriority || 'Normal',
            descriptionNewArticle: item.descriptionNewArticle || '',
            urlNewArticle: item.urlNewArticle || '',
            justificationNewArticle: item.justificationNewArticle || ''
          })),
          createdAt: cotizacion.dateCreate
        };
      }));

      // ✅ PASO 2.3: Retornar requisición con sus cotizaciones
      return {
        id: requisicion.id,
        branch: branchName,
        requisition: requisicion.folio || '',
        pedimentos: pedimentosConItems,
        requiredDate: requisicion.dateCreate || new Date().toISOString(),
        requestedBy: requisicion.solicit || '',
        department: requisicion.departmentName || '',
        idReference: requisicion.idReference
      };
    }));

    this.fullRowData = requisitionsWithQuotes;
    this.rowData = [...this.fullRowData];

    // Refrescar el grid
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.refreshCells({ force: true });
    }
  }

  private async loadQuotesFromSingleBranch(branchId: number) {

    // ✅ PASO 1: Cargar REQUISICIONES de la sucursal
    this.ocAndReqsService.getOcAndReqs('branch', branchId, 'REQUIS').subscribe({
      next: async (data: any) => {

        // Mapear los datos del servidor al formato esperado por el grid
        const requisiciones = Array.isArray(data) ? data : [];

        const requisitionsWithQuotes = await Promise.all(requisiciones.map(async (requisicion: any) => {
          // ✅ Buscar el nombre de la sucursal usando idReference
          const branch = this.branches.find(b => b.id === requisicion.idReference);
          const branchName = branch?.name || branch?.description || requisicion.idReference?.toString() || '';


          // ✅ PASO 2: Cargar COTIZACIONES de esta requisición
          let cotizaciones: any[] = [];
          try {
            const cotizacionesData: any = await new Promise((resolve, reject) => {
              this.ocAndReqsService.getOcAndReqs('requisition', requisicion.id, 'COTIZ').subscribe({
                next: (data) => resolve(data),
                error: (err) => reject(err)
              });
            });
            cotizaciones = Array.isArray(cotizacionesData) ? cotizacionesData : [];
          } catch (error) {
            console.error(`❌ Error al cargar cotizaciones de requisición ${requisicion.id}:`, error);
          }

          // ✅ PASO 3: Para cada cotización, cargar sus items y sus COTIZes de proveedor
          const pedimentosConItems = await Promise.all(cotizaciones.map(async (cotizacion: any) => {
            let items: any[] = [];
            try {
              const itemsData: any = await new Promise((resolve, reject) => {
                this.ocAndReqsService.getReqItems(cotizacion.id).subscribe({
                  next: (data) => resolve(data),
                  error: (err) => reject(err)
                });
              });
              items = Array.isArray(itemsData) ? itemsData : [];
            } catch (error) {
              console.error(`   ❌ Error al cargar items de cotización ${cotizacion.id}:`, error);
            }

            // Cargar COTIZes de proveedor (hijos del pedimento, typeReference='delison')
            let providerCotizs: any[] = [];
            try {
              const pcData: any = await new Promise((resolve, reject) => {
                this.ocAndReqsService.getOcAndReqs('delison', cotizacion.id, 'COTIZ').subscribe({
                  next: (d) => resolve(d), error: (e) => reject(e)
                });
              });
              providerCotizs = Array.isArray(pcData) ? pcData : [];
            } catch (_) {}

            const slotA = providerCotizs.filter(c => c.folio?.includes('-A-')).sort((a,b) => b.id - a.id)[0];
            const slotB = providerCotizs.filter(c => c.folio?.includes('-B-')).sort((a,b) => b.id - a.id)[0];
            const slotC = providerCotizs.filter(c => c.folio?.includes('-C-')).sort((a,b) => b.id - a.id)[0];

            return {
              id: cotizacion.id,
              name: `Pedimento ${cotizacion.pedimento}`,
              pedimento: cotizacion.pedimento,
              folio: cotizacion.folio || '',
              idProvider:  slotA?.idProvider || 0,
              idProvider2: slotB?.idProvider || 0,
              idProvider3: slotC?.idProvider || 0,
              name_idProvider:  slotA?.solicit || '',
              name_idProvider2: slotB?.solicit || '',
              name_idProvider3: slotC?.solicit || '',
              createdBy: cotizacion.createdBy || cotizacion.solicit || '',
              items: items.map((item: any) => ({
                id: item.id,
                idSupplie: item.idSupplie || 0,
                nameArticle: item.nameArticle || '',
                recurrent: item.recurrent || '',
                article: item.description || item.nameArticle || '',
                quantity: item.quantity || 0,
                tipo: item.intorext || 'Externo',
                proveedorInterno: item.provint || '',
                priority: item.typePriority || 'Normal',
                comment: item.comment || '',
                pedimento: item.pedimento || false,
                numArticle: item.numArticle || '',
                code: item.code || '',
                pedimentoNumber: item.pedimentoNum || '',
                idMovement: item.idMovement || 0,
                measure: item.measure || '',
                price: item.price || 0,
                total: item.total || 0,
                type: item.type || 'COTIZ',
                idProvider: item.idProvider || 0,
                dateuse: item.dateuse || '',
                active: item.active !== undefined ? item.active : true,
                typePriority: item.typePriority || 'Normal',
                descriptionNewArticle: item.descriptionNewArticle || '',
                urlNewArticle: item.urlNewArticle || '',
                justificationNewArticle: item.justificationNewArticle || ''
              })),
              createdAt: cotizacion.dateCreate
            };
          }));

          // PASO 4: Retornar requisición con sus cotizaciones
          return {
            id: requisicion.id,
            branch: branchName,
            requisition: requisicion.folio || '',
            pedimentos: pedimentosConItems, // ✅ Array de cotizaciones (no un solo objeto)
            requiredDate: requisicion.dateCreate || new Date().toISOString(),
            requestedBy: requisicion.solicit || '',
            department: requisicion.departmentName || '',
            idReference: requisicion.idReference
          };
        }));

        this.fullRowData = requisitionsWithQuotes;
        this.rowData = [...this.fullRowData];


        // Refrescar el grid si ya existe
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
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

  togglePedimentosCascade(node: any) {
    node.setSelected(true);

    const isCurrentlyExpanded = node.expanded;

    if (isCurrentlyExpanded) {
      // Si ya está expandido, colapsarlo y mostrar todas las filas
      node.setExpanded(false);

      // Restaurar la altura de todas las filas
      this.gridApi.forEachNode((otherNode: any) => {
        otherNode.setRowHeight(undefined);
      });
      this.gridApi.onRowHeightChanged();
    } else {
      // Colapsar cualquier otra fila expandida y ocultar las demás filas
      this.gridApi.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) {
          if (otherNode.expanded) {
            otherNode.setExpanded(false);
          }
          // Ocultar las otras filas
          otherNode.setRowHeight(0);
        } else {
          // Mantener la altura normal de la fila seleccionada
          otherNode.setRowHeight(undefined);
        }
      });

      // Aplicar los cambios de altura
      this.gridApi.onRowHeightChanged();

      // Expandir el nodo
      node.setExpanded(true);
    }
  }

  get colMaster(): (ColDef | ColGroupDef)[] {
    return [
      {
        field: 'branch',
        headerName: 'Sucursal',
        width: 120,
        editable: false
      },
    
      {
        field: 'requisition',
        headerName: 'Requisicion',
        width: 120,
        editable: false
      },
    
      {
        field: 'pedimentos',
        headerName: 'Pedimentos',
        width: 150,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.togglePedimentosCascade(node),
        },
        valueGetter: params => params.data.pedimentos ? params.data.pedimentos.length : 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer' }
      },

     {
        field: 'requestedBy',
        headerName: 'Quien lo Pidio',
        width: 150,
        editable: false
      },

     {
       field: 'department',
       headerName: 'Departamento',
       width: 150,
       editable: false
     },

    {
        field: 'column8',
        headerName: 'Autorizar',
        width: 190,
    }

   ];
  }


  // --- Lógica de botones CRUD principal (ejemplos) ---

  addQuote() {
    alerts.basicAlert('Función no implementada', 'La lógica para agregar una nueva cotización aún no se ha implementado.', 'info');
  }

  deleteQuote() {
    alerts.basicAlert('Función no implementada', 'La lógica para eliminar una cotización aún no se ha implementado.', 'info');
  }

  saveChanges() {
    alerts.basicAlert('Función no implementada', 'La lógica para guardar cambios en las cotizaciones aún no se ha implementado.', 'info');
  }
}
