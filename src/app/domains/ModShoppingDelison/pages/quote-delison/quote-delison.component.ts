import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ColGroupDef, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { DetailCellRendererPedimentosComponent } from './detail-cell-renderer-pedimentos.component';
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

      console.log('🔄 Cambio detectado en idBranch:', newIdBranch);

      // Si cambió el idBranch y es válido, recargar cotizaciones
      if (newIdBranch !== undefined && newIdBranch !== null && newIdBranch !== this.idBranch) {
        this.idBranch = newIdBranch;
        console.log('✅ Nueva sucursal seleccionada:', this.idBranch);

        // ✅ Esperar a que se carguen las sucursales antes de cargar cotizaciones
        if (this.branchesLoaded) {
          console.log('✅ Sucursales ya cargadas, cargando cotizaciones inmediatamente');
          this.loadQuotes();
        } else {
          console.log('⏳ Esperando a que se carguen las sucursales...');
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
    detailRowHeight: 400,
    detailCellRenderer: DetailCellRendererPedimentosComponent
  };

  ngOnInit() {
    // ✅ Esperar a que los signals se establezcan antes de inicializar
    setTimeout(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();

      console.log('🏢 idRoot:', this.idRoot);
      console.log('ℹ️ El idBranch se obtendrá desde el effect() cuando esté disponible');

      // ✅ Solo cargar si idRoot es válido
      if (this.idRoot) {
        this.loadBranches();
      } else {
        console.warn('⚠️ idRoot no está disponible todavía, reintentando...');
        // Reintentar después de un delay adicional
        setTimeout(() => {
          this.idRoot = this.signalsService.getRootSelectedBySidebar()();
          if (this.idRoot) {
            console.log('✅ idRoot obtenido en reintento:', this.idRoot);
            this.loadBranches();
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

        // ✅ Si hay un idBranch seleccionado (incluso si es negativo), cargar las cotizaciones ahora
        if (currentIdBranch !== null && currentIdBranch !== undefined) {
          this.idBranch = currentIdBranch;
          console.log('✅ idBranch inicial detectado:', this.idBranch, '- cargando cotizaciones ahora');
          this.loadQuotes();
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
      console.log('🌐 Cargando cotizaciones de TODAS las sucursales...');
      this.loadQuotesFromAllBranches();
    } else {
      console.log('📋 Cargando cotizaciones de una sucursal específica:', this.idBranch);
      this.loadQuotesFromSingleBranch(this.idBranch);
    }
  }

  private loadQuotesFromAllBranches() {
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
    const quotePromises = this.branches.map(branch => {
      return new Promise<any[]>((resolve) => {
        this.ocAndReqsService.getOcAndReqs('branch', branch.id, 'COTIZ').subscribe({
          next: (data: any) => {
            console.log(`✅ Branch ${branch.name} (${branch.id}): ${Array.isArray(data) ? data.length : 0} cotizaciones`);
            resolve(Array.isArray(data) ? data : []);
          },
          error: (error) => {
            console.error(`❌ Error al cargar cotizaciones del branch ${branch.name}:`, error);
            resolve([]); // Retornar array vacío en caso de error
          }
        });
      });
    });

    // 🔀 Esperar a que todas las promesas se resuelvan
    Promise.all(quotePromises).then(async (allQuotes: any[][]) => {
      // Combinar todos los resultados en un solo array
      const combinedData = allQuotes.flat();
      console.log(`✅ Total de cotizaciones combinadas: ${combinedData.length}`);

      // Mapear los datos al formato esperado por el grid
      const quotesWithItems = await Promise.all(combinedData.map(async (quote: any) => {
        const branch = this.branches.find(b => b.id === quote.idReference);
        const branchName = branch?.name || branch?.description || quote.idReference?.toString() || '';

        // ✅ Cargar los items de la cotización
        let items: any[] = [];
        try {
          const itemsData: any = await new Promise((resolve, reject) => {
            this.ocAndReqsService.getReqItems(quote.id).subscribe({
              next: (data) => resolve(data),
              error: (err) => reject(err)
            });
          });
          items = Array.isArray(itemsData) ? itemsData : [];
          console.log(`📦 Cotización ${quote.id}: ${items.length} items cargados`);
        } catch (error) {
          console.error(`❌ Error al cargar items de cotización ${quote.id}:`, error);
        }

        return {
          id: quote.id,
          branch: branchName,
          requisition: quote.folio || '',
          pedimentos: [{
            id: quote.pedimento || 1,
            name: `Pedimento ${quote.pedimento || 1}`,
            items: items.map((item: any) => {
              console.log(`📋 Item cargado - ID: ${item.id}, pedimentoNum: "${item.pedimentoNum}"`);
              return {
                article: item.description || item.nameArticle || '',
                quantity: item.quantity || 0,
                tipo: item.intorext || 'Externo',
                proveedorInterno: item.provint || '',
                priority: item.typePriority || 'Normal',
                observaciones: item.comment || '',
                pedimento: true,
                numArticle: item.numArticle || '',
                code: item.code || '',
                pedimentoNumber: item.pedimentoNum || '' // ✅ Backend usa "pedimentoNum"
              };
            }),
            createdAt: quote.dateCreate
          }],
          requiredDate: quote.dateCreate || new Date().toISOString(),
          requestedBy: quote.solicit || '',
          department: quote.departmentName || '',
          providers: [],
          idReference: quote.idReference,
          pedimento: quote.pedimento || 1
        };
      }));

      this.fullRowData = quotesWithItems;
      this.rowData = [...this.fullRowData];
      console.log('✅ Cotizaciones de todas las sucursales cargadas con items:', this.fullRowData.length);

      // Refrescar el grid
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.refreshCells({ force: true });
      }
    });
  }

  private async loadQuotesFromSingleBranch(branchId: number) {
    console.log('📋 Cargando cotizaciones desde el servidor...');
    console.log('   typeReference: branch');
    console.log('   idReference:', branchId);
    console.log('   type: COTIZ');

    // ✅ Llamar al endpoint real
    this.ocAndReqsService.getOcAndReqs('branch', branchId, 'COTIZ').subscribe({
      next: async (data: any) => {
        console.log('✅ Datos recibidos del servidor:', data);

        // Mapear los datos del servidor al formato esperado por el grid
        const quotesArray = Array.isArray(data) ? data : [];

        const quotesWithItems = await Promise.all(quotesArray.map(async (quote: any) => {
          // ✅ Buscar el nombre de la sucursal usando idReference
          const branch = this.branches.find(b => b.id === quote.idReference);
          const branchName = branch?.name || branch?.description || quote.idReference?.toString() || '';

          console.log(`📋 Cotización ${quote.id}: idReference=${quote.idReference} → Sucursal: ${branchName}`);

          // ✅ Cargar los items de la cotización
          let items: any[] = [];
          try {
            const itemsData: any = await new Promise((resolve, reject) => {
              this.ocAndReqsService.getReqItems(quote.id).subscribe({
                next: (data) => resolve(data),
                error: (err) => reject(err)
              });
            });
            items = Array.isArray(itemsData) ? itemsData : [];
            console.log(`📦 Cotización ${quote.id}: ${items.length} items cargados`);
          } catch (error) {
            console.error(`❌ Error al cargar items de cotización ${quote.id}:`, error);
          }

          return {
            id: quote.id,
            branch: branchName,
            requisition: quote.folio || '',
            pedimentos: [{
              id: quote.pedimento || 1,
              name: `Pedimento ${quote.pedimento || 1}`,
              items: items.map((item: any) => {
                console.log(`📋 Item cargado - ID: ${item.id}, pedimentoNum: "${item.pedimentoNum}"`);
                return {
                  article: item.description || item.nameArticle || '',
                  quantity: item.quantity || 0,
                  tipo: item.intorext || 'Externo',
                  proveedorInterno: item.provint || '',
                  priority: item.typePriority || 'Normal',
                  observaciones: item.comment || '',
                  pedimento: true,
                  numArticle: item.numArticle || '',
                  code: item.code || '',
                  pedimentoNumber: item.pedimentoNum || '' // ✅ Backend usa "pedimentoNum"
                };
              }),
              createdAt: quote.dateCreate
            }],
            requiredDate: quote.dateCreate || new Date().toISOString(),
            requestedBy: quote.solicit || '',
            department: quote.departmentName || '',
            providers: [],
            idReference: quote.idReference,
            pedimento: quote.pedimento || 1
          };
        }));

        this.fullRowData = quotesWithItems;
        this.rowData = [...this.fullRowData];

        console.log('✅ Cotizaciones cargadas con items:', this.fullRowData.length);

        // Refrescar el grid si ya existe
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
          this.gridApi.refreshCells({ force: true });
        }
      },
      error: (error) => {
        console.error('❌ Error al cargar cotizaciones:', error);
        alerts.basicAlert('Error', 'No se pudieron cargar las cotizaciones', 'error');

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
      // Si ya está expandido, colapsarlo
      node.setExpanded(false);
    } else {
      // Colapsar cualquier otra fila expandida
      this.gridApi.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id && otherNode.expanded) {
          otherNode.setExpanded(false);
        }
      });

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
