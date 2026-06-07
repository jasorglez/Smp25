import { Component, OnInit, inject, effect, HostListener, OnDestroy } from '@angular/core';
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
import { RolesService } from 'app/services/roles.service';
import { PedimentoModificationService } from 'app/services/pedimento-modification.service';
import { UnsavedChangesTrackerService } from 'app/services/unsaved-changes-tracker.service';
import { CanComponentDeactivate } from 'app/guards/unsaved-changes.guard';
import { lastValueFrom, Subscription } from 'rxjs';

@Component({
  selector: 'app-quote-delison',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ButtonCellRendererComponent],
  templateUrl: './quote-delison.component.html',
  styleUrl: './quote-delison.component.scss'
})
export class QuoteDelisonComponent implements OnInit, OnDestroy, CanComponentDeactivate {

  // Inject services
  private signalsService = inject(SignalsService);
  private ocAndReqsService = inject(OcAndReqsService);
  private branchsService = inject(BranchsService);
  private rolesService = inject(RolesService);
  private pedimentoModificationService = inject(PedimentoModificationService);
  private unsavedTracker = inject(UnsavedChangesTrackerService);

  rowData: any[] | null = null;
  fullRowData: any[] = []; // Store original unfiltered data
  gridHeightPx = 600;
  detailRowHeightPx = 520;
  private gridApi: GridApi;
  private isInitialized: boolean = false; // Flag para saber si ya se inicializó el componente
  private expandedRequisitionId: number | null = null; // Almacenar ID de la requisición expandida
  private editingRequisitionId: number | null = null; // ID de requisición en edición (filtro)
  private modificationSub?: Subscription;

  idRoot: number = null;
  idBranch: number = null;
  idUser: number = null;
  private rolesByBranchCache: Map<number, any[]> = new Map();
  branches: any[] = []; // Catálogo de sucursales
  branchesLoaded: boolean = false; // Flag para saber si ya se cargaron las sucursales
  departments: any[] = []; // Catálogo de departamentos
  departmentsLoaded: boolean = false; // Flag para saber si ya se cargaron los departamentos

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  private _colMaster: (ColDef | ColGroupDef)[] | null = null;

  constructor() {
    this.updateGridHeight();
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
    detailRowHeight: 520,
    autoSizeStrategy: {
      type: 'fitCellContents',
    },
    defaultColDef: {
      resizable: true,
      sortable: true,
      filter: true,
      flex: 1,
      minWidth: 120,
    },
    getRowId: (params: any) => String(params.data.id),
    detailCellRendererParams: {
      autoHeight: false,
      context: {}
    },
    detailCellRenderer: DetailCellRendererPedimentosComponent
  };

  ngOnInit() {
    this.updateGridHeight();

    // ✅ Suscribirse a modificaciones de pedimentos para reordenar el Nivel 1
    this.modificationSub = this.pedimentoModificationService.requisitionModified$.subscribe((cotizacionId: number) => {
      this.reorderRequisitions(cotizacionId);
    });

    // ✅ Esperar a que los signals se establezcan antes de inicializar
    setTimeout(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idUser = this.signalsService.getIdUSer()();

      // ✅ Solo cargar si idRoot es válido
      if (this.idRoot) {
        this.loadBranches();
        this.loadDepartments();
      } else {
        console.warn('⚠️ idRoot no está disponible todavía, reintentando...');
        // Reintentar después de un delay adicional
        setTimeout(() => {
          this.idRoot = this.signalsService.getRootSelectedBySidebar()();
          if (this.idRoot) {
            this.loadBranches();
            this.loadDepartments();
          }
        }, 300);
      }

      // ✅ Marcar como inicializado
      this.isInitialized = true;
    }, 200);
  }

  ngOnDestroy() {
    this.modificationSub?.unsubscribe();
    this.unsavedTracker.clearAll();
  }

  async canDeactivate(): Promise<boolean> {
    if (!this.unsavedTracker.hasAnyDirty()) return true;
    const allowed = await this.unsavedTracker.confirmExitIfAny();
    if (allowed) this.unsavedTracker.clearAll();
    return allowed;
  }

  private reorderRequisitions(cotizacionId: number) {
    if (!this.rowData.length || !this.gridApi) return;

    // 1. Encontrar cuál requisición contiene este pedimento
    let targetRequisitionIndex = -1;
    for (let i = 0; i < this.rowData.length; i++) {
      if (this.rowData[i].pedimentos?.some((p: any) => p.id === cotizacionId)) {
        targetRequisitionIndex = i;
        break;
      }
    }

    // 2. Si la requisición no está ya al inicio, moverla
    if (targetRequisitionIndex > 0) {
      console.log('🎯 Reordenando requisición en nivel 1, moviéndola al inicio');
      const [targetRequisition] = this.rowData.splice(targetRequisitionIndex, 1);
      this.rowData.unshift(targetRequisition);
      this.fullRowData = [...this.rowData];

      // 3. Actualizar el grid sin hacer vaciar→repoblar (preserva nivel 2 y 3 abiertos)
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  onRowGroupOpened(event: any): void {
    // Este evento se dispara cuando el usuario colapsa/expande una fila manualmente
    // No hacemos nada aquí porque el reordenamiento se maneja en reorderRequisitions
  }

  filterToEditingRequisition(requisitionId: number): void {
    this.editingRequisitionId = requisitionId;
    this.rowData = this.fullRowData.filter(r => r.id === requisitionId);
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  restoreAllRequisitions(): void {
    this.editingRequisitionId = null;
    this.rowData = [...this.fullRowData];
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  loadBranches() {
    this.branchsService.getBranches(this.idRoot).subscribe({
      next: (data: any[]) => {
        this.branches = data;
        this.branchesLoaded = true;
        this.checkAndLoadQuotes();
      },
      error: (error) => {
        console.error('❌ Error al cargar sucursales:', error);
        this.branches = [];
        this.branchesLoaded = true; // Marcar como cargado aunque haya error
        this.checkAndLoadQuotes();
      }
    });
  }

  loadDepartments() {
    this.rolesService.getRoles(this.idRoot).subscribe({
      next: (data: any) => {
        this.departments = data?.data ?? data ?? [];
        this.departmentsLoaded = true;
        this.checkAndLoadQuotes();
      },
      error: (error) => {
        console.error('❌ Error al cargar departamentos:', error);
        this.departments = [];
        this.departmentsLoaded = true;
        this.checkAndLoadQuotes();
      }
    });
  }

  private checkAndLoadQuotes() {
    // ✅ Cargar cotizaciones solo cuando AMBOS catálogos estén cargados
    if (this.branchesLoaded && this.departmentsLoaded) {
      const currentIdBranch = this.signalsService.getBranchSelectedBySidebar()();
      if (currentIdBranch !== null && currentIdBranch !== undefined) {
        this.idBranch = currentIdBranch;
        this.loadQuotes();
      }
    }
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
    // ✅ Pasar el método reloadParentGrid al contexto
    this.gridApi.setGridOption('context', {
      reloadParentGrid: () => this.reloadParentGrid(),
      reorderRequisition: (cotizacionId: number) => this.reorderRequisitions(cotizacionId),
      filterToEditingRequisition: (requisitionId: number) => this.filterToEditingRequisition(requisitionId),
      restoreAllRequisitions: () => this.restoreAllRequisitions()
    });
    this.autoAdjustColumns();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.updateGridHeight();
    // Re-layout del grid para recalcular tamaños
    if (this.gridApi) {
      setTimeout(() => {
        // `doLayout` no existe en algunos typings/versiones; usar llamada segura
        (this.gridApi as any)?.doLayout?.();
        // Recalcular alturas (incluye detail row)
        (this.gridApi as any)?.resetRowHeights?.();
        this.autoAdjustColumns();
      }, 0);
    }
  }

  private autoAdjustColumns() {
    if (!this.gridApi) return;
    // Preferir autosize por contenido si existe; si no, ajustar al ancho disponible
    const apiAny = this.gridApi as any;
    if (typeof apiAny.autoSizeAllColumns === 'function') {
      // `skipHeader=true` evita que el header haga columnas demasiado anchas
      apiAny.autoSizeAllColumns(true);
      return;
    }
    if (typeof apiAny.sizeColumnsToFit === 'function') {
      apiAny.sizeColumnsToFit();
    }
  }

  /**
   * Extrae el prefijo de sucursal del folio de la requisición.
   * Folio típico: "BOD15-001" → "BOD15". Si lleva tipo (REQ-/COTIZ-/OC-), también lo limpia.
   * Usado para construir folios de slots: `${type}-{branchPrefix}-P{ped}-PRO{idProvider}`.
   */
  private extractBranchPrefix(folio: string | null | undefined): string {
    if (!folio) return 'NOPREF';
    let prefix = String(folio).replace(/^(REQ-|COTIZ-|OC-|CO-)/i, '');
    prefix = prefix.replace(/-(\d+)$/, '$1');
    return prefix || 'NOPREF';
  }

  private updateGridHeight() {
    // Ajusta este offset si tu header/toolbar cambia de tamaño
    const offsetPx = 320;
    const minPx = 320;
    const h = (typeof window !== 'undefined' ? window.innerHeight : 800) - offsetPx;
    this.gridHeightPx = Math.max(minPx, h);

    // Altura del 2º nivel (detail): usar TODO el espacio disponible del grid principal.
    // Como cuando expandes ocultas las demás filas (rowHeight=0), el detail puede ocupar casi todo el alto.
    // Nota: AG Grid espera número (px).
    const headerPx = Number(this.gridOptions?.headerHeight ?? 0);
    const rowPx = Number(this.gridOptions?.rowHeight ?? 0);
    const paddingPx = 20;
    this.detailRowHeightPx = Math.max(260, this.gridHeightPx - headerPx - rowPx - paddingPx);
    this.gridOptions.detailRowHeight = this.detailRowHeightPx;
    if (this.gridApi) {
      // Aplicar en caliente si el grid ya está listo
      (this.gridApi as any).setGridOption?.('detailRowHeight', this.detailRowHeightPx);
    }
  }

  loadQuotes() {
    // ✅ Capturar cuál requisición está expandida antes de recargar
    this.expandedRequisitionId = null;
    if (this.gridApi) {
      this.gridApi.forEachNode((node: any) => {
        if (node.expanded) {
          this.expandedRequisitionId = node.data?.id || null;
        }
      });
    }

    // ✅ Validar que idBranch sea válido antes de hacer la petición
    if (this.idBranch === null || this.idBranch === undefined) {
      console.warn('⚠️ No se puede cargar cotizaciones: idBranch no está definido');
      this.fullRowData = [];
      this.rowData = [];
      return;
    }

    this.rowData = null;

    // 🔍 Detectar si se seleccionó "Todas las sucursales" (ID negativo)
    const isAllBranches = this.idBranch < 0;

    if (isAllBranches) {
      this.loadQuotesFromAllBranches();
    } else {
      this.loadQuotesFromSingleBranch(this.idBranch);
    }
  }

  reloadParentGrid() {
    this.loadQuotes();
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

      // ✅ Extraer prefijo de sucursal del folio de la requisición (ej: "BOD15-001" → "BOD15")
      const branchPrefix = this.extractBranchPrefix(requisicion.folio);

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

      // ✅ PASO 2.2: Cargar pedimentos e verificar lock correcto en paralelo
      const shouldLockCheck = requisicion.locked === true
        ? lastValueFrom(this.ocAndReqsService.shouldLockRequisicion(requisicion.id)).catch(() => ({ shouldLock: false }))
        : Promise.resolve({ shouldLock: false });

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

        // ✅ Generar providerSlots dinámicos (orden de creación ASC, sin slots vacíos)
        const providerSlots = providerCotizs
          .filter(c => Number(c.idProvider) > 0)
          .sort((a, b) => a.id - b.id)
          .map((cotiz, index) => ({
            slotIndex: index + 1,
            cotizId: cotiz.id,
            folio: cotiz.folio || '',
            idProvider: cotiz.idProvider,
            name: cotiz.solicit || ''
          }));

        return {
          id: cotizacion.id,
          name: `Pedimento ${cotizacion.pedimento}`,
          pedimento: cotizacion.pedimento,
          folio: cotizacion.folio || '',
          idDepartament: requisicion.idDepartament || 0,
          providerSlots,
          branchPrefix,
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
            numArticle: item.numarticle || item.numArticle || '',
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
            justificationNewArticle: item.justificationNewArticle || '',
            caducidadMinimaRequerida: item.caducidadMinimaRequerida || item.caducidad || item.expiration || '',
            idProveedorSugerido: item.idProveedorSugerido ?? null  // proveedor sugerido por el panel (para el 💡)
          })),
          createdAt: cotizacion.dateCreate,
          dateModified: cotizacion.dateModified
        };
      }));

      // ✅ PASO 2.3: Resolver lock correcto y retornar requisición con sus cotizaciones
      const lockResult = await shouldLockCheck;
      const correctLocked = requisicion.locked === true ? (lockResult?.shouldLock === true) : false;
      // Si el lock en BD era incorrecto, corregirlo silenciosamente
      if (requisicion.locked === true && !correctLocked) {
        this.ocAndReqsService.lockRequisition(requisicion.id, false).subscribe();
      }

      const dept = this.departments.find(d => d.id === requisicion.idDepartament);
      const departmentName = dept?.description || dept?.name || `[ID: ${requisicion.idDepartament}]`;

      // Calcular la fecha de modificación más reciente (entre requisición y sus pedimentos)
      const lastModifiedFromPedimentos = pedimentosConItems.length > 0
        ? Math.max(...pedimentosConItems.map(p => new Date(p.dateModified || p.createdAt).getTime()))
        : new Date(requisicion.dateCreate).getTime();

      return {
        id: requisicion.id,
        branch: branchName,
        requisition: requisicion.folio || '',
        locked: correctLocked,
        pedimentos: pedimentosConItems,
        requiredDate: requisicion.dateCreate || new Date().toISOString(),
        requestedBy: requisicion.solicit || '',
        department: departmentName,
        idDepartament: requisicion.idDepartament || 0,
        idReference: requisicion.idReference,
        __lastModifiedSort: lastModifiedFromPedimentos
      };
    }));

    // ✅ Ordenar por modificación (más reciente arriba)
    requisitionsWithQuotes.sort((a, b) => (b.__lastModifiedSort || 0) - (a.__lastModifiedSort || 0));

    // ✅ Solo mostrar requisiciones que tienen al menos una cotización
    this.fullRowData = requisitionsWithQuotes.filter(r => r.pedimentos && r.pedimentos.length > 0);
    this.rowData = [...this.fullRowData];

    this.preloadRolesForQuotes();

    // Refrescar el grid
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
      this.gridApi.refreshCells({ force: true });

      // ✅ Re-expandir la requisición que estaba expandida
      if (this.expandedRequisitionId !== null) {
        setTimeout(() => {
          this.gridApi.forEachNode((node: any) => {
            if (node.data?.id === this.expandedRequisitionId) {
              node.setExpanded(true);
            }
          });
        }, 100);
      }
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

          // ✅ Extraer prefijo de sucursal del folio de la requisición (ej: "BOD15-001" → "BOD15")
          const branchPrefix = this.extractBranchPrefix(requisicion.folio);

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

          // ✅ PASO 3: Cargar pedimentos y verificar lock correcto en paralelo
          const shouldLockCheck2 = requisicion.locked === true
            ? lastValueFrom(this.ocAndReqsService.shouldLockRequisicion(requisicion.id)).catch(() => ({ shouldLock: false }))
            : Promise.resolve({ shouldLock: false });

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

            // ✅ Generar providerSlots dinámicos (orden de creación ASC, sin slots vacíos)
            const providerSlots = providerCotizs
              .filter(c => Number(c.idProvider) > 0)
              .sort((a, b) => a.id - b.id)
              .map((cotiz, index) => ({
                slotIndex: index + 1,
                cotizId: cotiz.id,
                folio: cotiz.folio || '',
                idProvider: cotiz.idProvider,
                name: cotiz.solicit || ''
              }));

            return {
              id: cotizacion.id,
              name: `Pedimento ${cotizacion.pedimento}`,
              pedimento: cotizacion.pedimento,
              folio: cotizacion.folio || '',
              idDepartament: requisicion.idDepartament || 0,
              providerSlots,
              branchPrefix,
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
                numArticle: item.numarticle || item.numArticle || '',
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
                justificationNewArticle: item.justificationNewArticle || '',
                caducidadMinimaRequerida: item.caducidadMinimaRequerida || item.caducidad || item.expiration || ''
              })),
              createdAt: cotizacion.dateCreate,
              dateModified: cotizacion.dateModified
            };
          }));

          // PASO 4: Resolver lock correcto y retornar requisición con sus cotizaciones
          const lockResult2 = await shouldLockCheck2;
          const correctLocked2 = requisicion.locked === true ? (lockResult2?.shouldLock === true) : false;
          if (requisicion.locked === true && !correctLocked2) {
            this.ocAndReqsService.lockRequisition(requisicion.id, false).subscribe();
          }

          const dept = this.departments.find(d => d.id === requisicion.idDepartament);
          const departmentName = dept?.description || dept?.name || `[ID: ${requisicion.idDepartament}]`;

          const lastModifiedFromPedimentos = pedimentosConItems.length > 0
            ? Math.max(...pedimentosConItems.map(p => new Date(p.dateModified || p.createdAt).getTime()))
            : new Date(requisicion.dateCreate).getTime();

          return {
            id: requisicion.id,
            branch: branchName,
            requisition: requisicion.folio || '',
            locked: correctLocked2,
            pedimentos: pedimentosConItems,
            requiredDate: requisicion.dateCreate || new Date().toISOString(),
            requestedBy: requisicion.solicit || '',
            department: departmentName,
            idDepartament: requisicion.idDepartament || 0,
            idReference: requisicion.idReference,
            __lastModifiedSort: lastModifiedFromPedimentos
          };
        }));

        // ✅ Ordenar inicialmente por modificación
        requisitionsWithQuotes.sort((a, b) => (b.__lastModifiedSort || 0) - (a.__lastModifiedSort || 0));

        // ✅ Solo mostrar requisiciones que tienen al menos una cotización
        this.fullRowData = requisitionsWithQuotes.filter(r => r.pedimentos && r.pedimentos.length > 0);
        this.rowData = [...this.fullRowData];

        this.preloadRolesForQuotes();

        // Refrescar el grid si ya existe
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
          this.gridApi.refreshCells({ force: true });

          // ✅ Re-expandir la requisición que estaba expandida
          if (this.expandedRequisitionId !== null) {
            setTimeout(() => {
              this.gridApi.forEachNode((node: any) => {
                if (node.data?.id === this.expandedRequisitionId) {
                  node.setExpanded(true);
                }
              });
            }, 100);
          }
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

  async togglePedimentosCascade(node: any) {
    if (this.unsavedTracker.hasAnyDirty()) {
      const allowed = await this.unsavedTracker.confirmExitIfAny();
      if (!allowed) return;
      this.unsavedTracker.clearAll();
    }

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
    if (this._colMaster && this._colMaster.length > 0) {
      return this._colMaster;
    }

    this._colMaster = [
      {
        field: 'branch',
        headerName: 'Sucursal',
        width: 120,
        editable: false
      },

      {
        field: 'requisition',
        headerName: 'Requisicion',
        width: 150,
        editable: false,
        cellRenderer: (params: any) => {
          const div = document.createElement('div');
          div.style.cssText = 'display:flex;align-items:center;gap:5px;';
          if (params.data?.locked) {
            const icon = document.createElement('i');
            icon.className = 'bi bi-lock-fill';
            icon.style.cssText = 'color:#b71c1c;font-size:0.85rem;flex-shrink:0;';
            div.appendChild(icon);
          }
          const text = document.createElement('span');
          text.textContent = params.value || '';
          div.appendChild(text);
          return div;
        }
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
       field: 'idDepartament',
       headerName: 'Departamento',
       width: 150,
       editable: false,
       valueFormatter: (params: any) => {
         if (!params.value) return '';
         const branchId = params.data?.idReference;
         const cachedRoles = this.rolesByBranchCache.get(branchId);
         if (cachedRoles) {
           const role = cachedRoles.find(r => r.id === params.value);
           if (role) return role.description;
         }
         return params.value?.toString() || '';
       }
     },

    {
        field: 'column8',
        headerName: 'Autorizar',
        width: 190,
    }

   ];

    return this._colMaster;
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

  private preloadRolesForQuotes(): void {
    if (!this.idUser) return;

    const uniqueBranchIds = new Set<number>();
    this.rowData.forEach(row => {
      if (row.idReference && row.idReference > 0) {
        uniqueBranchIds.add(row.idReference);
      }
    });

    uniqueBranchIds.forEach(branchId => {
      if (!this.rolesByBranchCache.has(branchId)) {
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
    });
  }
}
