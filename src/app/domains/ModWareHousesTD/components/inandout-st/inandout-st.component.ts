import { Component, OnInit, inject, effect, Input, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { NgSelectModule } from '@ng-select/ng-select';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE } from 'assets/i18n/ag-grid.locale';
import { SignalsService } from 'app/services/signals.service';
import { PermitionsService } from 'app/services/permitions.service';
import { TrackingService } from 'app/services/tracking.service';
import { InandoutService } from 'app/services/inandout.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { MaterialsService } from 'app/services/materials.service';
import { OtService } from 'app/services/ot.service';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { ProjectsService } from 'app/services/projects.service';
import { DetailCellRendererEntryItemsComponent } from './detail-cell-renderer-entry-items.component';
import { alerts } from 'app/helpers/alerts';
import { hasPersistedMasterId } from 'app/helpers/master-detail-guard';
import { ButtonCellRendererComponent } from './button-cell-renderer.component';
import { PdfButtonCellRendererComponent } from '../../../ModAdmon/components/egresos-palacio/pdf-button-cell-renderer.component';
import { catchError, forkJoin, lastValueFrom, map, of, switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { UsersService } from 'app/services/users.service';
import { PrefixSetupService } from 'app/services/prefix-setup.service';
import { DailyReportService } from 'app/services/daily-report.service';
import { LogbookService } from 'app/services/logbook.service';
import { BranchsService } from 'app/services/branchs.service';
import { WarehousesService } from 'app/services/warehouses.service';
import { restoreGridColumnWidths, saveGridColumnWidths } from 'app/helpers/grid-column-widths';
import { navigateEditableCellOnEnter } from 'app/helpers/ag-grid-enter-navigation';
import { ProjectsComponent } from 'app/domains/ModProjects/components/projects/projects.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { InandoutEvidenceService } from 'app/services/inandout-evidence.service';
import { RootService } from 'app/services/root.service';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { Base64EncodeService } from 'app/services/base64encode.service';
import { PdfPreviewService } from 'app/services/pdf-preview.service';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;
const evidencePdfFontsBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';

@Component({
  selector: 'app-inandout-st',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NgSelectModule, TranslateModule, DetailCellRendererEntryItemsComponent, PdfButtonCellRendererComponent, ProjectsComponent],
  templateUrl: './inandout-st.component.html',
  styleUrl: './inandout-st.component.scss',
})
export class InandoutStComponent implements OnInit {

  @ViewChild(ProjectsComponent) projectCreator?: ProjectsComponent;
  private pendingProjectNode: any = null;

  private gridApi!: GridApi;
  private _colMaster: ColDef[] = [];
  private signalsService = inject(SignalsService);
  private permitionsService = inject(PermitionsService);
  private trackingService = inject(TrackingService);
  private inandoutService = inject(InandoutService);
  private catalogsService = inject(CatalogsService);
  private materialsService = inject(MaterialsService);
  private otService = inject(OtService);
  private ocService = inject(OcAndReqsService);
  private projectsService = inject(ProjectsService);
  private route = inject(ActivatedRoute);
  private usersService = inject(UsersService);
  private prefixSetupService = inject(PrefixSetupService);
  private dailyReportService = inject(DailyReportService);
  private logbookService = inject(LogbookService);
  private branchesService = inject(BranchsService);
  private warehousesService = inject(WarehousesService);
  private translate = inject(TranslateService);
  private base64EncodeService = inject(Base64EncodeService);
  private pdfPreview = inject(PdfPreviewService);
  private inandoutEvidenceService = inject(InandoutEvidenceService);
  private rootService = inject(RootService);

  private isGeneratingReport: boolean = false;
  private warehouseLoadRequest = 0;
  private otLoadRequest = 0;
  private sourceEntryLoadRequest = 0;
  rowData: any[] = [];
  selectedWarehouse: any = null;
  warehouses: any[] = [];
  gridHeight: string = '85vh';
  // Alturas responsivas del detalle master-detail. Se recalculan según el viewport
  // para que, en pantallas pequeñas, el detalle no "se trague" el grid maestro.
  detailRowHeightItems = 1150;
  detailRowHeightReport = 1080;
  detailInnerGridHeight = 610;
  detailInnerReportHeight = 920;
  selectedEntry: any = null;
  hasUnsavedChanges: boolean = false;
  idRoot: number | null = null;
  idBranch: number | null = null;
  projectId: number | null = null;
  contractId: number | null = null;
  movementScope: 'project' | 'contract' | 'all' = 'all';

  onMovementScopeChange(scope: 'project' | 'contract' | 'all'): void {
    this.movementScope = scope;
    this.refreshColumns();
    this.loadEntries();
  }
  movementType: 'IN' | 'OUT' = 'IN';
  newlyAddedRows: string[] = [];
  private tempIdCounter: number = 0;

  catalogs: any[] = [];
  private movementTypeCatalogs: any[] = [];
  selectedCatalog: any = null;
  otList: any[] = [];
  selectedOt: any = null;
  ocList: any[] = [];
  entryList: any[] = [];
  sourceBalanceWarning = '';
  private ocRemainingItemsById = new Map<number, any[]>();
  private entryRemainingItemsById = new Map<number, any[]>();
  projectList: any[] = [];
  users: any[] = [];

  readonly addNewSentinel = '__ADD_NEW__';
  private previousCatalog: any = null;

  public rowSelection: 'single' | 'multiple' = 'single';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE;

  constructor() {
    effect(() => {
      const selectedRoot = this.signalsService.getRootSelectedBySidebar()();
      const rootChanged = Number(selectedRoot || 0) !== Number(this.idRoot || 0);
      this.idRoot = selectedRoot;
      if (rootChanged) {
        this.warehouses = [];
        this.selectedWarehouse = null;
        this.rowData = [];
        this.selectedEntry = null;
        this.projectId = null;
        this.warehouseLoadRequest++;
      }
      const email = this.trackingService.getEmail();
      if (this.idRoot && email) {
        this.loadCatalogs();
        this.loadUsers();
        this.loadProjectList();
        if (rootChanged) this.loadWarehouses(email);
      }
    });

    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.warehouses = [];
      this.selectedWarehouse = null;
      this.rowData = [];
      this.selectedEntry = null;
      this.warehouseLoadRequest++;
      if (this.idBranch != null) {
        this.loadOcList();
        const email = this.trackingService.getEmail();
        if (email) this.loadWarehouses(email);
      }
    });

    effect(() => {
      this.projectId = this.signalsService.getProjectSelectedBySidebar()();
      this.contractId = this.signalsService.getContractSelectedBySidebar()();
      this.loadOts();
      const email = this.trackingService.getEmail();
      if (this.projectId && email) {
        this.loadWarehouses(email);
        this.loadOcList();
      } else {
        this.rowData = [];
        this.selectedEntry = null;
      }
    });
  }

  /** Calcula las alturas del detalle en función del viewport. El grid maestro usa
   *  85vh; reservamos ~220px (encabezado + ~5 filas) para que siga visible aunque
   *  haya un detalle expandido, en vez de que el detalle fijo lo tape por completo. */
  private computeDetailHeights(): void {
    const vh = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 900;
    const cap = Math.round(vh * 0.85 - 220);
    const desiredItems = this.movementType === 'IN' ? 1150 : 1050;
    this.detailRowHeightItems  = Math.max(360, Math.min(desiredItems, cap));
    this.detailRowHeightReport = Math.max(420, Math.min(1080, cap));
    // Cromo sobre el grid interno (botones + alertas + padding) ≈ 190px;
    // encabezado + margen del visor de reporte ≈ 130px.
    this.detailInnerGridHeight   = Math.max(180, this.detailRowHeightItems - 190);
    this.detailInnerReportHeight = Math.max(240, this.detailRowHeightReport - 130);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const prev = this.detailRowHeightItems;
    this.computeDetailHeights();
    if (this.gridApi && prev !== this.detailRowHeightItems) {
      this.gridApi.setGridOption('context', { ...this.gridApi.getGridOption('context'),
        detailInnerGridHeight: this.detailInnerGridHeight,
        detailInnerReportHeight: this.detailInnerReportHeight });
      this.gridApi.resetRowHeights();
    }
  }

  ngOnInit() {
    this.movementType = this.route.snapshot.data['movementType'] || 'IN';
    this.computeDetailHeights();
    this.loadUsers();
    const email = this.trackingService.getEmail();
    if (this.idRoot && email) {
      this.loadCatalogs();
      this.loadProjectList();
    }
    if (this.projectId && email) {
      this.loadWarehouses(email);
      this.loadOts();
      this.loadOcList();
    }
  }

  loadWarehouses(email: string) {
    const idRoot = Number(this.idRoot || 0);
    const idBranch = Number(this.idBranch || 0);
    const requestId = ++this.warehouseLoadRequest;
    if (!idRoot || !idBranch) {
      this.warehouses = [];
      this.selectedWarehouse = null;
      this.rowData = [];
      return;
    }

    this.warehouses = [];
    this.selectedWarehouse = null;
    this.rowData = [];
    forkJoin({
      permitted: this.permitionsService.getPermisionswarehousexEmail(email).pipe(catchError(() => of([]))),
      branches: this.branchesService.getBranches2fields(idRoot).pipe(catchError(() => of([]))),
    }).pipe(
      switchMap(({ permitted, branches }: any) => {
        const branchList: any[] = Array.isArray(branches) ? branches : [];
        const selectedBranches = idBranch < 0
          ? branchList
          : branchList.filter(branch => Number(branch.id) === idBranch);
        if (!selectedBranches.length) return of({ permitted, warehouses: [] });

        return forkJoin(selectedBranches.map(branch =>
          this.warehousesService.getWarehouses(Number(branch.id)).pipe(
            catchError(() => of([])),
            map((result: any) => Array.isArray(result) ? result : [])
          )
        )).pipe(map((groups: any[][]) => ({ permitted, warehouses: groups.flat() })));
      })
    ).subscribe({
      next: ({ permitted, warehouses }: any) => {
        // Ignora respuestas tardías si el usuario cambió de empresa, sucursal
        // o proyecto mientras las consultas seguían en curso.
        if (requestId !== this.warehouseLoadRequest ||
            Number(this.signalsService.getRootSelectedBySidebar()() || 0) !== idRoot ||
            Number(this.signalsService.getBranchSelectedBySidebar()() || 0) !== idBranch) return;

        const permittedRows: any[] = Array.isArray(permitted) ? permitted : [];
        const getWarehouseId = (warehouse: any): number => Number(
          warehouse?.idAlmacen ?? warehouse?.idWarehouse ?? warehouse?.warehouseId ?? warehouse?.id ?? 0
        );
        const permittedIds = new Set(permittedRows.map(getWarehouseId).filter(id => id > 0));
        const seen = new Set<number>();
        this.warehouses = (warehouses as any[]).map(warehouse => {
          const id = getWarehouseId(warehouse);
          if (!id) return null;
          return {
            ...warehouse,
            idAlmacen: id,
            nombreAlmacen: warehouse?.nombreAlmacen ?? warehouse?.nameWarehouse ?? warehouse?.name ?? warehouse?.description ?? `Almacén #${id}`,
          };
        }).filter((warehouse: any) => {
          const id = Number(warehouse?.idAlmacen);
          if (!id || seen.has(id) || !permittedIds.has(id)) return false;
          seen.add(id);
          return true;
        });
        this.rowData = [];
        this.selectedEntry = null;
        this.refreshColumns();
        // Selecciona el primer almacén automáticamente para que la pantalla
        // muestre información al entrar, en vez de quedar vacía hasta elegir.
        if (this.warehouses.length) {
          this.onWarehouseChange(this.warehouses[0].idAlmacen);
        } else {
          this.selectedWarehouse = null;
        }
      },
      error: (error) => {
        if (requestId !== this.warehouseLoadRequest) return;
        console.error('Error loading warehouses:', error);
        this.warehouses = [];
        this.selectedWarehouse = null;
        this.rowData = [];
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.error'), this.translate.instant('modules.warehouses.ui.movements.messages.loadWarehousesFailed'), 'error');
      }
    });
  }

  loadCatalogs() {
    if (!this.idRoot) return;
    const companyId = Number(this.idRoot);
    forkJoin({
      movementTypes: this.catalogsService.getCatalogs(companyId, this.movementType).pipe(catchError(() => of([]))),
      allCatalogs: this.catalogsService.getCatalogsAll(companyId).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ movementTypes, allCatalogs }) => {
        this.catalogs = Array.isArray(movementTypes) ? movementTypes : [];
        this.movementTypeCatalogs = Array.isArray(allCatalogs) ? allCatalogs : [];
        if (this.catalogs.length > 0) {
          this.selectedCatalog = this.catalogs[0];
          this.previousCatalog = this.catalogs[0];
        }
        this.refreshColumns();
      },
      error: (error) => {
        console.error('Error loading movement type catalogs:', error);
        this.catalogs = [];
        this.movementTypeCatalogs = [];
      }
    });
  }

  private getMovementTypeLabel(idType: any): string {
    if (idType == null || idType === '') return '';
    const catalog = this.getMovementCatalogById(idType);
    return catalog?.description || `Tipo no disponible (#${idType})`;
  }

  private getMovementCatalogById(idType: any): any {
    if (idType == null || idType === '') return null;
    return this.catalogs.find(item => Number(item.id) === Number(idType))
      || this.movementTypeCatalogs.find(item => Number(item.id) === Number(idType))
      || null;
  }

  loadOts() {
    const requestProjectId = Number(this.projectId || 0);
    const requestId = ++this.otLoadRequest;
    this.otList = [];
    this.selectedOt = null;
    this.refreshColumns();
    if (!requestProjectId) return;

    this.otService.get2fieldsByPect(requestProjectId).subscribe({
      next: (data) => {
        if (requestId !== this.otLoadRequest || Number(this.projectId || 0) !== requestProjectId) return;
        const results = Array.isArray(data) ? data : (data?.data ?? data?.result ?? []);
        this.otList = Array.isArray(results) ? results : [];
        if (this.otList.length > 0) this.selectedOt = this.otList[0];
        this.refreshColumns();
      },
      error: (error) => {
        if (requestId !== this.otLoadRequest || Number(this.projectId || 0) !== requestProjectId) return;
        if (error?.status !== 404) console.error('Error loading OTs:', error);
        this.otList = [];
        this.selectedOt = null;
        this.refreshColumns();
      }
    });
  }

  loadOcList() {
    this.sourceBalanceWarning = '';
    if (this.movementType === 'OUT') {
      this.ocList = [];
      this.loadAvailableEntrySources();
      this.refreshColumns();
      return;
    }
    // El proyecto seleccionado determina la OC disponible; la sucursal solo
    // aplica cuando el usuario trabaja sin un proyecto seleccionado.
    const typeReference = this.projectId ? 'project' : (this.idBranch ? 'branch' : null);
    const idReference = this.projectId || this.idBranch;
    if (!typeReference || !idReference) {
      this.ocList = [];
      this.ocRemainingItemsById.clear();
      this.refreshColumns();
      return;
    }
    const requestId = Number(idReference);
    const requestedWarehouseId = Number(this.selectedWarehouse?.idAlmacen || 0);

    this.ocService.getOcAndReqs(typeReference, requestId, 'OC').pipe(catchError(() => {
      this.sourceBalanceWarning = 'No se pudieron cargar las órdenes de compra; no se puede comprobar cuánto queda por recibir.';
      return of([]);
    })).subscribe({
      next: async (response: any) => {
        if (typeReference === 'project' && Number(this.projectId) !== requestId) return;
        if (typeReference === 'branch' && (this.projectId || Number(this.idBranch) !== requestId)) return;
        if (requestedWarehouseId !== Number(this.selectedWarehouse?.idAlmacen || 0)) return;
        const scopedOrders: any[] = Array.isArray(response) ? response : (response?.data ?? response?.result ?? []);
        const seen = new Set<number>();
        const uniqueOrders = scopedOrders.filter((oc: any) => {
          if (!oc?.id || seen.has(oc.id)) return false;
          seen.add(oc.id);
          return true;
        });
        if (!this.selectedWarehouse) {
          this.ocList = uniqueOrders;
          this.refreshColumns();
          return;
        }
        try {
          const inboundResponse: any = await lastValueFrom(this.inandoutService
            .getInAndOuts(this.projectId, Number(this.selectedWarehouse.idAlmacen), 'IN')
            .pipe(catchError(() => {
              this.sourceBalanceWarning = 'No se pudieron cargar las entradas previas; el pendiente de recepción no está comprobado.';
              return of([]);
            })));
          const inboundEntries = Array.isArray(inboundResponse) ? inboundResponse : [];
          const receivedItemsByOc = new Map<number, any[]>();
          await Promise.all(inboundEntries
            .filter((entry: any) => Number(entry.idOc) > 0 && entry.active !== false && Number(entry.active) !== 0)
            .map(async (entry: any) => {
              const details: any = await lastValueFrom(this.inandoutService.getInAndOutItems(Number(entry.id))
                .pipe(catchError(() => {
                  this.sourceBalanceWarning = 'No se pudieron cargar todas las partidas recibidas; el pendiente de recepción no está comprobado.';
                  return of([]);
                })));
              const ocId = Number(entry.idOc);
              const bucket = receivedItemsByOc.get(ocId) || [];
              bucket.push(...(Array.isArray(details) ? details : []));
              receivedItemsByOc.set(ocId, bucket);
            }));

          const remainingByOc = new Map<number, any[]>();
          await Promise.all(uniqueOrders.map(async (order: any) => {
            const orderedResponse: any = await lastValueFrom(this.ocService.getReqItems(Number(order.id))
              .pipe(catchError(() => {
                this.sourceBalanceWarning = 'No se pudieron cargar partidas de una OC; el pendiente de recepción no está comprobado.';
                return of([]);
              })));
            const ordered = (Array.isArray(orderedResponse) ? orderedResponse : [])
              .filter((item: any) => item.active !== false && Number(item.active) !== 0);
            const received = receivedItemsByOc.get(Number(order.id)) || [];
            const receivedByMaterial = new Map<string, number>();
            received.filter((item: any) => item.active !== false && Number(item.active) !== 0).forEach((item: any) => {
              const key = this.materialBrandKey(item);
              if (key) receivedByMaterial.set(key, (receivedByMaterial.get(key) || 0) + this.getMovementQuantity(item));
            });
            const orderedByMaterial = new Map<string, { item: any; quantity: number }>();
            ordered.forEach((item: any) => {
              const key = this.materialBrandKey(item);
              if (!key) return;
              const current = orderedByMaterial.get(key);
              if (current) current.quantity += Math.max(0, Number(item.quantity) || 0);
              else orderedByMaterial.set(key, { item, quantity: Math.max(0, Number(item.quantity) || 0) });
            });
            const remaining = Array.from(orderedByMaterial.entries()).map(([key, value]) => ({
              ...value.item,
              remainingQuantity: Math.max(0, value.quantity - (receivedByMaterial.get(key) || 0))
            })).filter((item: any) => item.remainingQuantity > 0);
            remainingByOc.set(Number(order.id), remaining);
          }));
          this.ocRemainingItemsById = remainingByOc;
          const selectedOcId = Number(this.selectedEntry?.idOc || 0);
          this.ocList = uniqueOrders.filter((order: any) =>
            (remainingByOc.get(Number(order.id)) || []).length > 0 || Number(order.id) === selectedOcId
          );
          this.refreshColumns();
        } catch (error) {
          console.error('No fue posible calcular las cantidades pendientes por recibir:', error);
          this.sourceBalanceWarning = 'No se pudo calcular cuánto queda por recibir. Actualiza antes de capturar una entrada vinculada a una OC.';
          this.ocList = [];
          this.refreshColumns();
        }
      },
      error: () => {
        this.sourceBalanceWarning = 'No se pudieron cargar las órdenes de compra; no se puede comprobar cuánto queda por recibir.';
        this.ocList = [];
        this.ocRemainingItemsById.clear();
      }
    });
  }

  private async loadAvailableEntrySources(): Promise<void> {
    const requestId = ++this.sourceEntryLoadRequest;
    this.sourceBalanceWarning = '';
    if (this.movementType !== 'OUT' || !this.selectedWarehouse) {
      this.entryList = [];
      this.entryRemainingItemsById.clear();
      return;
    }
    const projectId = Number(this.projectId || 0) || null;
    const warehouseId = Number(this.selectedWarehouse.idAlmacen);
    try {
      const [inResponse, outResponse]: any[] = await Promise.all([
        lastValueFrom(this.inandoutService.getInAndOuts(projectId, warehouseId, 'IN').pipe(catchError(() => {
          this.sourceBalanceWarning = 'No se pudieron cargar las entradas; el pendiente del vale no está comprobado.';
          return of([]);
        }))),
        lastValueFrom(this.inandoutService.getInAndOuts(projectId, warehouseId, 'OUT').pipe(catchError(() => {
          this.sourceBalanceWarning = 'No se pudieron cargar las salidas; el pendiente del vale no está comprobado.';
          return of([]);
        })))
      ]);
      if (requestId !== this.sourceEntryLoadRequest || warehouseId !== Number(this.selectedWarehouse?.idAlmacen || 0) || projectId !== (Number(this.projectId || 0) || null)) return;
      const entries = (Array.isArray(inResponse) ? inResponse : []).filter((entry: any) =>
        entry.active !== false && Number(entry.active) !== 0 && !this.isTransferType(entry.idType)
      );
      const outs = (Array.isArray(outResponse) ? outResponse : []).filter((out: any) =>
        Number(out.idEntry) > 0 && out.active !== false && Number(out.active) !== 0
      );
      const outDetailsByEntry = new Map<number, any[]>();
      await Promise.all(outs.map(async (out: any) => {
        const details: any = await lastValueFrom(this.inandoutService.getInAndOutItems(Number(out.id))
          .pipe(catchError(() => {
            this.sourceBalanceWarning = 'No se pudieron cargar las partidas de todas las salidas; el pendiente del vale no está comprobado.';
            return of([]);
          })));
        const sourceId = Number(out.idEntry);
        const bucket = outDetailsByEntry.get(sourceId) || [];
        bucket.push(...(Array.isArray(details) ? details : []));
        outDetailsByEntry.set(sourceId, bucket);
      }));
      const remainingByEntry = new Map<number, any[]>();
      const availableEntries: any[] = [];
      for (const entry of entries) {
        const sourceResponse: any = await lastValueFrom(this.inandoutService.getInAndOutItems(Number(entry.id))
          .pipe(catchError(() => {
            this.sourceBalanceWarning = 'No se pudieron cargar las partidas de una entrada; el pendiente del vale no está comprobado.';
            return of([]);
          })));
        const sourceItems = (Array.isArray(sourceResponse) ? sourceResponse : [])
          .filter((item: any) => item.active !== false && Number(item.active) !== 0);
        const used = new Map<string, number>();
        (outDetailsByEntry.get(Number(entry.id)) || []).forEach((item: any) => {
          if (item.active === false || Number(item.active) === 0) return;
          const key = this.materialBrandKey(item);
          if (key) used.set(key, (used.get(key) || 0) + this.getMovementQuantity(item));
        });
        const totals = new Map<string, { item: any; quantity: number }>();
        sourceItems.forEach((item: any) => {
          const key = this.materialBrandKey(item);
          if (!key) return;
          const current = totals.get(key);
          if (current) current.quantity += this.getMovementQuantity(item);
          else totals.set(key, { item, quantity: this.getMovementQuantity(item) });
        });
        const remaining = Array.from(totals.entries()).map(([key, value]) => ({
          ...value.item,
          remainingQuantity: Math.max(0, value.quantity - (used.get(key) || 0))
        })).filter((item: any) => item.remainingQuantity > 0);
        if (remaining.length || Number(entry.id) === Number(this.selectedEntry?.idEntry)) {
          availableEntries.push(entry);
          remainingByEntry.set(Number(entry.id), remaining);
        }
      }
      this.entryList = availableEntries;
      this.entryRemainingItemsById = remainingByEntry;
      this.refreshColumns();
    } catch (error) {
      if (requestId !== this.sourceEntryLoadRequest) return;
      console.error('No fue posible calcular el saldo de los vales de entrada:', error);
      this.sourceBalanceWarning = 'No se pudo calcular cuánto queda del vale de entrada. Actualiza antes de usarlo para una salida.';
      this.entryList = [];
      this.entryRemainingItemsById.clear();
      this.refreshColumns();
    }
  }

  private materialBrandKey(item: any): string {
    const productId = Number(item?.idProduct || item?.idSupplie || 0);
    if (!productId) return '';
    const brand = item?.idBrand != null
      ? `id:${Number(item.idBrand)}`
      : `name:${String(item?.brandName || item?.brand || '').trim().toLocaleUpperCase()}`;
    return `${productId}|${brand}`;
  }

  private getMovementQuantity(item: any): number {
    return Math.max(0, Number(item?.quantity ?? item?.total ?? 0) || 0);
  }

  loadProjectList() {
    if (!this.idRoot) return;
    this.projectsService.getProjectListByCompany(this.idRoot).subscribe({
      next: (data: any) => {
        this.projectList = Array.isArray(data) ? data : (data?.data ?? []);
        this.refreshColumns();
      },
      error: (error) => {
        if (error?.status !== 404) console.error('Error loading projects:', error);
        this.projectList = [];
      }
    });
  }

  loadUsers() {
    if (!this.idRoot) return;
    this.usersService.get2fieldsUsers(this.idRoot).subscribe({
      next: (data) => {
        this.users = data.data || data;
        this.refreshColumns();
      },
      error: (error) => console.error('Error loading users:', error)
    });
  }

  private refreshColumns() {
    this._colMaster = [];
    if (this.gridApi) {
      const widths = this.gridApi.getColumnState()
        .filter(column => Number.isFinite(column.width))
        .map(column => ({ colId: column.colId, width: column.width, flex: column.flex ?? null }));
      this.gridApi.setGridOption('columnDefs', this.colMaster);
      if (widths.length) {
        this.gridApi.applyColumnState({ state: widths, applyOrder: false });
      }
    }
  }

  private isTransferType(idType: any): boolean {
    return String(this.getMovementCatalogById(idType)?.valueAddition || '').trim().toUpperCase() === 'TRANSFER';
  }

  private isInventorySetupType(idType: any): boolean {
    return ['INITIAL_INVENTORY', 'INVENTORY_ADJUSTMENT']
      .includes(String(this.getMovementCatalogById(idType)?.valueAddition || '').trim().toUpperCase());
  }

  onWarehouseChange(id?: number | string) {
    if (id !== undefined) {
      this.selectedWarehouse = this.warehouses.find(w => String(w.idAlmacen) === String(id)) || null;
      this.rowData = [];
      this.selectedEntry = null;
    }
    if (this.selectedWarehouse) {
      this.loadEntries();
      this.loadOcList();
    }
  }

  async onCatalogChange(): Promise<void> {
    if (this.selectedCatalog?.id === '__ADD_NEW__') {
      this.selectedCatalog = this.previousCatalog;
      const result = await alerts.inputAlert(
        'Nuevo Tipo de Movimiento',
        `Tipo: ${this.movementType === 'IN' ? 'Entrada' : 'Salida'}`,
        'text', '',
        {
          inputAttributes: { placeholder: this.translate.instant('modules.warehouses.ui.movements.messages.movementDescription') },
          confirmButtonText: 'Guardar',
          confirmButtonColor: '#28a745'
        }
      );
      if (result.isConfirmed && result.value) {
        await this.saveNewCatalog(result.value);
      }
      return;
    }
    this.previousCatalog = this.selectedCatalog;
    this.loadEntries();
  }

  async saveNewCatalog(description: string): Promise<number | null> {
    if (!this.idRoot) return null;
    try {
      const payload = {
        description: description.trim().toUpperCase(),
        valueAddition: 'STANDARD',
        type: this.movementType,
        idCompany: this.idRoot,
        active: 1,
        vigente: true
      };
      const created = await lastValueFrom(this.catalogsService.addCatalog(payload));
      await new Promise<void>(resolve => {
        this.catalogsService.getCatalogs(this.idRoot!, this.movementType).subscribe({
          next: (data) => { this.catalogs = data; this.refreshColumns(); resolve(); },
          error: () => resolve()
        });
      });
      alerts.toastAlert(this.translate.instant('modules.warehouses.ui.movements.messages.movementTypeCreated'), 'success');
      return created?.id ?? null;
    } catch (error: any) {
      const msg = error?.error?.message || error?.message || 'Error desconocido';
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.error'), `${this.translate.instant('modules.warehouses.ui.movements.messages.createFailed')}: ${msg}`, 'error');
      return null;
    }
  }

  onOtChange() {
    this.loadEntries();
  }

  loadEntries() {
    if (!this.selectedWarehouse) return;
    const requestWarehouseId = Number(this.selectedWarehouse.idAlmacen);
    const requestRootId = Number(this.idRoot);
    if (!requestWarehouseId || !requestRootId) {
      this.rowData = [];
      console.error('No se pueden cargar entradas con el contexto actual:', {
        idRoot: requestRootId,
        idWarehouse: requestWarehouseId,
      });
      return;
    }
    this.inandoutService.getInAndOuts(null, requestWarehouseId, this.movementType).subscribe({
      next: (data: any[]) => {
        if (requestWarehouseId !== Number(this.selectedWarehouse?.idAlmacen) ||
            requestRootId !== Number(this.idRoot)) return;
        const warehouseEntries = data.filter(entry => {
          if (this.movementScope === 'project') return Number(entry.idProject) === Number(this.projectId);
          if (this.movementScope !== 'contract' || !this.contractId) return true;
          const project = this.projectList.find(item => Number(item.id) === Number(entry.idProject));
          return Number(project?.idContrato) === Number(this.contractId);
        });
        this.rowData = warehouseEntries.map(entry => ({
          ...entry,
          projectName: this.getProjectName(entry.idProject),
          contractName: this.getProjectContract(entry.idProject),
          ...(this.isTransferType(entry.idType) ? {
            idWarehouse: entry.idWarehouseOrigin,
            idWarehouseOrigin: entry.idWarehouse,
          } : {}),
          countrow: entry.countRow || 0,
          evidenceCount: 0,
          detailType: null,
          detailData: []
        })).sort((entryA, entryB) => {
          // Agrupa visualmente por proyecto (AG Grid rowGroup no es compatible
          // con masterDetail, así que se agrupa por orden + franja de color en
          // vez de usar row grouping nativo).
          const projectCompare = String(entryA.projectName || '').localeCompare(String(entryB.projectName || ''));
          if (projectCompare !== 0) return projectCompare;
          return (Number(entryB.id) || 0) - (Number(entryA.id) || 0);
        });
        this.loadEvidenceCounts();
      },
      error: (error) => {
        if (requestWarehouseId !== Number(this.selectedWarehouse?.idAlmacen) ||
            requestRootId !== Number(this.idRoot)) return;
        console.error(`Error loading entries:`, error);
        const message = error?.error?.message || error?.error?.title || error?.message || 'Error desconocido';
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.error'), `${this.translate.instant('modules.warehouses.ui.movements.messages.loadFailed')} ${this.translate.instant(this.movementType === 'IN' ? 'modules.warehouses.ui.movements.receipt' : 'modules.warehouses.ui.movements.issue')}: ${message}`, 'error');
      }
    });
  }

  private getProjectName(projectId: number | null | undefined): string {
    if (!projectId) return this.translate.instant('modules.warehouses.ui.movements.noProject');
    const project = this.projectList.find(item => Number(item.id) === Number(projectId));
    return project ? (project.description || project.name || `#${projectId}`) : `#${projectId}`;
  }

  private getProjectContract(projectId: number | null | undefined): string {
    const project = this.projectList.find(item => Number(item.id) === Number(projectId));
    const contractId = Number(project?.idContrato || 0);
    if (!contractId) return this.translate.instant('modules.warehouses.ui.movements.noContract');
    return project?.contractNumber || `#${contractId}`;
  }

  // Paleta estable (misma pastilla siempre para el mismo proyecto) usada como
  // franja visual de agrupación por proyecto en la columna Proyecto.
  private readonly projectBandPalette = ['#e3f2fd', '#e8f5e9', '#fff3e0', '#f3e5f5', '#fce4ec', '#e0f7fa', '#fff9c4', '#ede7f6'];
  private getProjectBandColor(projectId: number | null | undefined): string {
    const key = Number(projectId) || 0;
    const idx = Math.abs(key) % this.projectBandPalette.length;
    return this.projectBandPalette[idx];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: false,
    masterDetail: true,
    // AG Grid no soporta Row Grouping junto con Master-Detail: con rowGroup
    // activo, expandir filas para ver items/PDF deja de funcionar. Por eso el
    // "agrupado por proyecto" se logra con orden (ver sort en loadEntries) +
    // franja de color (ver getRowStyle), no con rowGroup/autoGroupColumn.
    detailRowHeight: 1050,
    getRowHeight: (params: any) => {
      if (!params.node.detail) return undefined;
      // El reporte PDF siempre con altura generosa fija (necesita espacio para
      // renderizar el documento); solo el grid de items se adapta al viewport.
      if (params.node.parent?.data?.detailType === 'report') return 1080;
      if (params.node.parent?.data?.detailType === 'evidence') return 480;
      return this.detailRowHeightItems;
    },
    isRowMaster: (dataItem: any) => true,
    detailCellRenderer: DetailCellRendererEntryItemsComponent,
    getRowClass: (params: any) => {
      if (params.node.isSelected()) return 'selected-row';
      if (params.node.group || !params.data) return '';
      if (params.data.__isNew) return 'new-row-highlight';
      if (params.data.__modified) return 'modified-row';
      return '';
    },
    onRowClicked: (event: any) => {
      if (!event.node.group && event.node.data && event.column && !['pdfReport', 'pdfBranchReport', 'authorizationAction'].includes(event.column.getColId())) {
        event.node.setSelected(true);
      }
    },
    onRowSelected: (event: any) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) node.setSelected(false);
        });
      }
    },
    onCellValueChanged: (event: any) => {
      if (event.colDef.field === 'directEntry') {
        event.data.directEntry = event.newValue === true || event.newValue === 1;
      }
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
      if (event.colDef.field === 'idType') {
        this.selectedEntry = event.data;
        this.refreshColumns();
      }
      setTimeout(() => {
        this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
      }, 0);
    }
  };

  get colMaster(): ColDef[] {
    if (this._colMaster.length) return this._colMaster;
    this._colMaster = [
      {
        headerName: '#',
        width: 56,
        pinned: 'left',
        lockPinned: true,
        suppressMovable: true,
        sortable: false,
        filter: false,
        editable: false,
        // Consecutivo por posición en rowData → numera 1..N las filas (entradas/salidas),
        // sin saltos aunque haya detalles expandidos.
        valueGetter: (params: any) => {
          const idx = this.rowData.indexOf(params.data);
          return idx >= 0 ? idx + 1 : '';
        },
        cellStyle: { color: '#64748b', fontWeight: '600', textAlign: 'center' }
      },
      {
        field: 'countrow',
        headerName: this.translate.instant('modules.warehouses.ui.movements.items'),
        width: 80,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleCascade(node),
        },
        valueGetter: params => params.data?.countrow || 0,
        editable: false,
        cellStyle: { backgroundColor: '#e8f5e9', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'pdfReport',
        headerName: this.translate.instant('modules.warehouses.ui.movements.pdf'),
        width: 70, pinned: 'right', lockPinned: true, suppressMovable: true,
        cellRenderer: PdfButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleReportDetail(node),
          icon: 'bi-file-earmark-pdf',
          iconColor: '#dc3545',
          title: this.translate.instant('modules.warehouses.ui.movements.generatePdf')
        },
        editable: false,
        cellStyle: { backgroundColor: '#fff3e0', textAlign: 'center' }
      },
      {
        field: 'pdfBranchReport',
        headerName: this.translate.instant('modules.warehouses.ui.movements.branchPdf'),
        width: 115, pinned: 'right', lockPinned: true, suppressMovable: true,
        cellRenderer: PdfButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleReportDetail(node, true),
          icon: 'bi-file-earmark-pdf', iconColor: '#0d6efd',
          title: this.translate.instant('modules.warehouses.ui.movements.branchPdf'),
        },
        editable: false,
        cellStyle: { backgroundColor: '#eef5ff', textAlign: 'center' },
      },
      {
        field: 'evidenceCount',
        headerName: this.translate.instant('modules.warehouses.ui.movements.support'),
        width: 90,
        cellRenderer: ButtonCellRendererComponent,
        cellRendererParams: {
          onClick: (node: any) => this.toggleEvidence(node),
          icon: 'bi-camera',
          title: this.translate.instant('modules.warehouses.ui.movements.evidenceDetail')
        },
        valueGetter: params => params.data?.evidenceCount || 0,
        editable: false,
        filter: false,
        sortable: false,
        cellStyle: { backgroundColor: '#e3f2fd', cursor: 'pointer', textDecoration: 'underline' }
      },
      {
        field: 'contractName',
        headerName: this.translate.instant('modules.warehouses.ui.movements.contract'),
        width: 140,
        hide: this.movementScope !== 'all',
        editable: false,
      },
      {
        field: 'idProject',
        colId: 'projectAssignment',
        headerName: this.translate.instant('modules.warehouses.ui.movements.project'),
        width: 160,
        editable: (params: any) => this.canEditAuthorizedRow(params.data),
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: [this.addNewSentinel, ...this.projectList.map(p => Number(p.id))],
          valueListMaxHeight: 200,
          formatValue: (value: any) => {
          if (value === this.addNewSentinel) return `+ ${this.translate.instant('modules.warehouses.ui.movements.createProject')}`;
            const p = this.projectList.find(x => Number(x.id) === Number(value));
            return p ? (p.description || p.name || `#${value}`) : `#${value}`;
          }
        }),
        valueFormatter: (params: any) => {
          const p = this.projectList.find(x => Number(x.id) === Number(params.value));
          return p ? (p.description || p.name || `#${params.value}`) : (params.value || '');
        },
        cellStyle: (params: any) => ({ backgroundColor: this.getProjectBandColor(params.data?.idProject), fontWeight: '600' }),
      },
      {
        field: 'idWarehouse',
        headerName: this.translate.instant('modules.warehouses.ui.movements.warehouse'),
        width: 140,
        editable: (params: any) => this.canEditAuthorizedRow(params.data),
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: this.warehouses.map(wh => wh.idAlmacen),
          valueListMaxHeight: 200,
          formatValue: (value: any) => {
            const wh = this.warehouses.find(w => w.idAlmacen === value);
            return wh ? wh.name : value;
          }
        }),
        valueFormatter: (params: any) => {
          const wh = this.warehouses.find(w => w.idAlmacen === params.value);
          return wh ? wh.name : (params.value || '');
        }
      },
      {
        field: 'idType',
        headerName: this.translate.instant('modules.warehouses.ui.movements.movementType'),
        width: 170,
        editable: (params: any) => this.canEditAuthorizedRow(params.data),
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: [...this.catalogs.map(c => c.id), '__ADD_NEW__'],
          valueListMaxHeight: 200,
          formatValue: (value: any) => {
            if (value === '__ADD_NEW__') return `+ ${this.translate.instant('modules.warehouses.ui.movements.addRecord')}`;
            return this.getMovementTypeLabel(value);
          }
        }),
        valueFormatter: (params: any) => {
          return this.getMovementTypeLabel(params.value);
        }
      },
      {
        field: 'idOt',
        headerName: this.translate.instant('modules.warehouses.ui.movements.workOrder'),
        width: 160,
        hide: this.otList.length === 0,
        editable: (params: any) => this.canEditAuthorizedRow(params.data),
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: [0, ...this.otList.map(ot => ot.id)],
          valueListMaxHeight: 220,
          formatValue: (value: any) => {
          if (!value) return `(${this.translate.instant('modules.warehouses.ui.movements.noWorkOrder')})`;
            const ot = this.otList.find(o => o.id === value);
            return ot ? (ot.description || ot.folio || ot.num || `OT #${ot.id}`) : `OT #${value}`;
          }
        }),
        valueFormatter: (params: any) => {
          if (!params.value) return `(${this.translate.instant('modules.warehouses.ui.movements.noWorkOrder')})`;
          const ot = this.otList.find(o => o.id === params.value);
          return ot ? (ot.description || ot.folio || ot.num || `OT #${ot.id}`) : `OT #${params.value}`;
        }
      },
      {
        field: 'idOc',
        headerName: this.translate.instant('modules.warehouses.ui.movements.purchaseOrder'),
        width: 160,
        hide: this.movementType !== 'IN' || this.isTransferType(this.selectedEntry?.idType) || this.isInventorySetupType(this.selectedEntry?.idType),
        editable: (params: any) => this.canEditAuthorizedRow(params.data),
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: [0, ...this.ocList.map(oc => oc.id)],
          valueListMaxHeight: 220,
          formatValue: (value: any) => {
          if (!value) return `(${this.translate.instant('modules.warehouses.ui.movements.noPurchaseOrder')})`;
            const oc = this.ocList.find(o => o.id === value);
            return oc ? (oc.folio || `OC #${oc.id}`) : `OC #${value}`;
          }
        }),
        valueFormatter: (params: any) => {
          if (!params.value || params.value === 0) return `(${this.translate.instant('modules.warehouses.ui.movements.noPurchaseOrder')})`;
          const oc = this.ocList.find(o => o.id === params.value);
          return oc ? (oc.folio || `OC #${oc.id}`) : `OC #${params.value}`;
        }
      },
      {
        field: 'idEntry',
        headerName: this.translate.instant('modules.warehouses.ui.movements.receiptVoucher'),
        width: 160,
        hide: this.movementType !== 'OUT' || this.isTransferType(this.selectedEntry?.idType),
        editable: (params: any) => this.movementType === 'OUT' && this.canEditAuthorizedRow(params.data),
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: [0, ...this.entryList.map(entry => Number(entry.id))],
          valueListMaxHeight: 220,
          formatValue: (value: any) => {
            if (!value) return `(${this.translate.instant('modules.warehouses.ui.movements.noVoucher')})`;
            const entry = this.entryList.find(item => Number(item.id) === Number(value));
            return entry ? (entry.folio || `Entrada #${entry.id}`) : `Entrada #${value}`;
          }
        }),
        valueFormatter: (params: any) => {
          if (!params.value || params.value === 0) return `(${this.translate.instant('modules.warehouses.ui.movements.noVoucher')})`;
          const entry = this.entryList.find(item => Number(item.id) === Number(params.value));
          return entry ? (entry.folio || `Entrada #${entry.id}`) : `Entrada #${params.value}`;
        }
      },
      {
        field: 'folio',
        headerName: this.translate.instant('modules.warehouses.ui.movements.reference'),
        width: 180,
        minWidth: 160,
        filter: true,
        editable: (params: any) => this.canEditAuthorizedRow(params.data),
        valueSetter: (params: any) => {
          params.data.folio = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'date',
        headerName: this.translate.instant('modules.warehouses.ui.movements.date'),
        width: 110,
        editable: (params: any) => this.canEditAuthorizedRow(params.data),
        valueFormatter: (params: any) => {
          if (!params.value) return '';
          return new Date(params.value).toLocaleDateString();
        },
        valueSetter: (params: any) => {
          params.data.date = params.newValue;
          return true;
        }
      },
      {
        field: 'idWarehouseOrigin',
        headerName: this.translate.instant('modules.warehouses.ui.movements.destinationWarehouse'),
        width: 190,
        hide: !this.isTransferType(this.selectedEntry?.idType),
        editable: (params: any) => this.isTransferType(params.data?.idType) && this.canEditAuthorizedRow(params.data),
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: (params: any) => {
          const destinationId = Number(params.data?.idWarehouse || this.selectedWarehouse?.idAlmacen || 0);
          const available = this.warehouses.filter(warehouse => Number(warehouse.idAlmacen) !== destinationId);
          return {
            values: available.map(warehouse => warehouse.idAlmacen),
            valueListMaxHeight: 220,
            formatValue: (value: any) => {
              const warehouse = available.find(item => Number(item.idAlmacen) === Number(value));
              return warehouse ? (warehouse.nombreAlmacen || warehouse.name || warehouse.description) : (value || '');
            }
          };
        },
        valueFormatter: (params: any) => {
          if (!params.value) return '';
          const warehouse = this.warehouses.find(item => Number(item.idAlmacen) === Number(params.value));
          return warehouse ? (warehouse.nombreAlmacen || warehouse.name || warehouse.description) : `Almacén #${params.value}`;
        }
      },
      {
        field: 'numBill',
        headerName: this.translate.instant('modules.warehouses.ui.movements.invoice'),
        width: 120,
        hide: this.isTransferType(this.selectedEntry?.idType),
        editable: (params: any) => !this.isTransferType(params.data?.idType) && this.canEditAuthorizedRow(params.data),
        valueSetter: (params: any) => {
          params.data.numBill = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'deliverName',
        headerName: this.translate.instant('modules.warehouses.ui.movements.deliveredBy'),
        width: 180,
        editable: (params: any) => this.canEditAuthorizedRow(params.data),
        valueSetter: (params: any) => {
          params.data.deliverName = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'idAutoriza',
        headerName: this.translate.instant('modules.warehouses.ui.movements.authorizedBy'),
        width: 180,
        editable: (params: any) => this.canEditAuthorizedRow(params.data),
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => ({
          values: this.usersService.filterUsersCanAuthorizeProcesses(this.users).map(u => u.id),
          valueListMaxHeight: 220,
          formatValue: (value: any) => {
            const user = this.users.find(u => u.id === value);
            return user ? user.displayName : value;
          }
        }),
        valueFormatter: (params: any) => {
          const user = this.users.find(u => u.id === params.value);
          return user ? user.displayName : (params.value || '');
        }
      },
      {
        headerName: this.translate.instant('modules.warehouses.ui.movements.open'), colId: 'authorizationAction', width: 64, editable: false,
        cellRenderer: (params: any) => {
          if (Number(params.data?.idAutoriza) <= 0) {
            return '<span class="text-success" title="Sin autorización; movimiento editable" aria-label="Movimiento editable"><i class="bi bi-unlock-fill"></i></span>';
          }
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn btn-sm btn-outline-danger py-0 px-2';
          button.title = 'Quitar autorización y abrir edición';
          button.setAttribute('aria-label', 'Quitar autorización y abrir edición');
          button.innerHTML = '<i class="bi bi-lock-fill"></i>';
          button.addEventListener('click', (clickEvent) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            void this.removeAuthorization(params);
          });
          return button;
        },
      },
      {
        field: 'comment',
        headerName: this.translate.instant('modules.warehouses.ui.movements.comment'),
        width: 300,
        editable: (params: any) => this.canEditAuthorizedRow(params.data),
        valueSetter: (params: any) => {
          params.data.comment = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
    ];
    return this._colMaster;
  }

  onCellClicked(event: any): void {
    const colId = event.column.getColId();
    if (colId === 'authorizationAction') {
      void this.removeAuthorization(event);
      return;
    }
    event.node.setSelected(true);
    if (colId === 'countrow') {
      const node = event.node;
      const api = event.api;
      const isCurrentlyExpanded = node.expanded && event.data.detailType === 'items';

      if (isCurrentlyExpanded) {
        node.setExpanded(false);
        api.forEachNode((otherNode: any) => otherNode.setRowHeight(undefined));
        api.onRowHeightChanged();
      } else {
        api.forEachNode((otherNode: any) => {
          if (otherNode.expanded && otherNode.id !== node.id) otherNode.setExpanded(false);
        });
        api.forEachNode((otherNode: any) => {
          if (otherNode.id !== node.id) otherNode.setRowHeight(0);
        });
        if (node.expanded && event.data.detailType !== 'items') node.setExpanded(false);
        event.data.detailType = 'items';
        api.onRowHeightChanged();
        setTimeout(() => node.setExpanded(true), 0);
      }
    }
  }

  canEditAuthorizedRow(row: any): boolean {
    return !Number(row?.idAutoriza);
  }

  private async removeAuthorization(event: any): Promise<void> {
    const row = event.data;
    if (!Number(row?.idAutoriza)) return;
    if (Number(row.idAutoriza) !== Number(this.trackingService.getId())) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.authorizationAssigned'), this.translate.instant('modules.warehouses.ui.movements.messages.onlyAssignedCanRemove'), 'warning');
      return;
    }
    const documentLabel = this.movementType === 'IN' ? 'entrada' : 'salida';
    const confirmation = await alerts.confirmAlert(this.translate.instant('modules.warehouses.ui.movements.messages.removeAuthorization'), this.translate.instant('modules.warehouses.ui.movements.messages.willBeEditable', { document: documentLabel }), 'warning', this.translate.instant('modules.warehouses.ui.movements.messages.yesRemove'));
    if (!confirmation.isConfirmed) return;
    try {
      const updatedRow = { ...row, idAutoriza: 0 };
      await lastValueFrom(this.inandoutService.updateInAndOut(row.id, this.prepareEntryData(updatedRow)));
      const persistedRow = { ...updatedRow, __modified: false };
      event.node.setData(persistedRow);
      this.rowData = this.rowData.map(item => Number(item.id) === Number(row.id) ? persistedRow : item);
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.authorizationRemoved'), this.translate.instant('modules.warehouses.ui.movements.messages.editableAgain', { document: documentLabel }), 'success');
    } catch (error: any) {
      const message = error?.error?.message || error?.message || 'No fue posible retirar la autorización.';
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.removeFailed'), message, 'error');
    }
  }

  toggleCascade(node: any) {
    if (Number(node?.data?.idAutoriza) > 0) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.movementAuthorized'), this.translate.instant('modules.warehouses.ui.movements.messages.removeAuthorizationToEdit'), 'warning');
      return;
    }
    const event = {
      node: node,
      api: this.gridApi,
      data: node.data,
      column: { getColId: () => 'countrow' }
    };
    this.onCellClicked(event);
  }

  toggleEvidence(node: any) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'evidence';

    if (isCurrentlyExpanded) {
      node.setExpanded(false);
      api.forEachNode((otherNode: any) => otherNode.setRowHeight(undefined));
      api.onRowHeightChanged();
      return;
    }

    api.forEachNode((otherNode: any) => {
      if (otherNode.expanded && otherNode.id !== node.id) otherNode.setExpanded(false);
    });
    api.forEachNode((otherNode: any) => {
      if (otherNode.id !== node.id) otherNode.setRowHeight(0);
    });
    if (node.expanded && node.data.detailType !== 'evidence') node.setExpanded(false);
    node.data.detailType = 'evidence';
    api.onRowHeightChanged();
    setTimeout(() => node.setExpanded(true), 0);
  }

  collapseEvidenceDetail(entryId: number): void {
    if (!this.gridApi) return;
    this.gridApi.forEachNode((node: any) => {
      if (Number(node.data?.id) === Number(entryId)) {
        node.data.detailType = null;
        node.setExpanded(false);
      }
      node.setRowHeight(undefined);
    });
    this.gridApi.onRowHeightChanged();
  }

  async toggleReportDetail(node: any, branchLogo = false) {
    const api = this.gridApi;
    const isCurrentlyExpanded = node.expanded && node.data.detailType === 'report' && !!node.data.branchLogoReport === branchLogo;

    if (isCurrentlyExpanded) {
      node.setExpanded(false);
      api.forEachNode((otherNode: any) => otherNode.setRowHeight(undefined));
      api.onRowHeightChanged();
      return;
    }

    if (this.isGeneratingReport) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.processing'), this.translate.instant('modules.warehouses.ui.movements.messages.reportAlreadyGenerating'), 'warning');
      return;
    }

    this.isGeneratingReport = true;
    let progress = 0;
    alerts.showLoadingWithProgress('Generando reporte...', 'Por favor espere mientras se procesa el documento', progress);
    const progressInterval = setInterval(() => {
      progress += 10;
      if (progress <= 90) alerts.updateLoadingProgress('Generando reporte...', 'Por favor espere mientras se procesa el documento', progress);
    }, 100);

    try {
      api.forEachNode((otherNode: any) => {
        if (otherNode.expanded && otherNode.id !== node.id) otherNode.setExpanded(false);
      });
      api.forEachNode((otherNode: any) => {
        if (otherNode.id !== node.id) otherNode.setRowHeight(0);
      });
      if (node.expanded) node.setExpanded(false);
      node.data.detailType = 'report';
      node.data.branchLogoReport = branchLogo;
      api.onRowHeightChanged();
      await new Promise(resolve => setTimeout(resolve, 1000));
      node.setExpanded(true);
      // Keep the explicit 0 px heights on all other records while the PDF
      // preview is open; resetRowHeights() would make them visible again.
      api.onRowHeightChanged();
      clearInterval(progressInterval);
      alerts.updateLoadingProgress('Reporte generado', 'El documento se ha procesado correctamente', 100);
      setTimeout(() => {
        alerts.closeLoading();
        this.isGeneratingReport = false;
      }, 800);
    } catch (error) {
      clearInterval(progressInterval);
      alerts.closeLoading();
      this.isGeneratingReport = false;
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.error'), this.translate.instant('modules.warehouses.ui.movements.messages.reportFailed'), 'error');
      console.error('Error generando reporte:', error);
    }
  }

  collapseReportDetail(entryId: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === entryId) {
          node.setExpanded(false);
          node.data.detailType = null;
        }
      });
      this.gridApi.forEachNode((node) => node.setRowHeight(undefined));
      this.gridApi.onRowHeightChanged();
    }
  }

  collapseItemsDetail(entryId: number): void {
    if (!this.gridApi) return;
    this.gridApi.forEachNode((node: any) => {
      if (Number(node.data?.id) === Number(entryId)) {
        node.data.detailType = null;
        node.setExpanded(false);
      }
      // Al abrir un detalle, el resto de los maestros queda en 0 px.
      // Al cerrar desde la X se restauran las filas para ver todos los maestros.
      node.setRowHeight(undefined);
    });
    this.gridApi.onRowHeightChanged();
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('columnDefs', this.colMaster);
    restoreGridColumnWidths(this.gridApi, `inandout:${this.movementType}:master`, this.trackingService.getEmail());
    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params) => {
        params.successCallback(params.data.detailData);
      },
      context: {
        movementType: this.movementType,
        detailInnerGridHeight: this.detailInnerGridHeight,
        detailInnerReportHeight: this.detailInnerReportHeight,
        isTransferType: (idType: any) => this.isTransferType(idType),
        getMovementTypeBehavior: (idType: any) => this.getMovementCatalogById(idType)?.valueAddition || '',
        idRoot: this.idRoot,
        projectId: this.projectId,
        getSelectedProjectId: () => Number(this.projectId || 0),
        idWarehouse: this.selectedWarehouse?.idAlmacen,
        getSelectedWarehouseId: () => Number(this.selectedWarehouse?.idAlmacen || 0),
        inandoutService: this.inandoutService,
        componentParent: this,
        gridApi: this.gridApi,
        getSourceRemainingQuantity: (movementType: 'IN' | 'OUT', sourceId: number, item: any) => {
          const sourceItems = movementType === 'IN'
            ? this.ocRemainingItemsById.get(Number(sourceId))
            : this.entryRemainingItemsById.get(Number(sourceId));
          const key = this.materialBrandKey(item);
          const sourceItem = (sourceItems || []).find((candidate: any) => this.materialBrandKey(candidate) === key);
          return Number(sourceItem?.remainingQuantity || 0);
        },
        getSourceRemainingItems: (movementType: 'IN' | 'OUT', sourceId: number) => movementType === 'IN'
          ? this.ocRemainingItemsById.get(Number(sourceId)) || []
          : this.entryRemainingItemsById.get(Number(sourceId)) || [],
        getSourceBalanceWarning: () => this.sourceBalanceWarning,
        refreshSourceEntries: () => this.loadAvailableEntrySources(),
        ITEMS: {
          load: (entryId: number, callback: (data: any[]) => void) => {
            this.loadEntryItemsData(entryId, callback);
          },
          save: (entryId: number, data: any[]) => {
            return this.saveEntryItemsById(entryId, data);
          },
          delete: (params: any, callback: () => void) => {
            this.deleteDetailRow(params, callback, 'ITEMS');
          },
          updateCount: (entryId: number, count: number) => {
            this.updateEntryItemsCount(entryId, count);
          },
          importFromOC: (idOc: number, entryId: any, callback: (data: any[]) => void) => {
            this.importItemsFromOC(idOc, entryId, callback);
          },
          importFromEntry: (sourceEntryId: number, outingId: any, callback: (data: any[]) => void) => {
            this.importItemsFromEntry(sourceEntryId, outingId, callback);
          }
        },
        EVIDENCE: {
          load: (entryId: number, callback: (data: any[]) => void) => {
            this.loadEntryEvidence(entryId, callback);
          },
          add: (entryId: number, imageUrl: string, comment: string, callback: (saved: any) => void) => {
            this.addEntryEvidence(entryId, imageUrl, comment, callback);
          },
          update: (id: number, comment: string, callback: (saved: any) => void) => {
            this.editEntryEvidence(id, comment, callback);
          },
          delete: (id: number, callback: () => void) => {
            this.deleteEntryEvidence(id, callback);
          },
          updateCount: (entryId: number, count: number) => {
            this.updateEvidenceCount(entryId, count);
          }
        },
        materialsService: this.materialsService
      }
    });
  }

  onMasterGridCellKeyDown(event: any): void {
    const keyEvent: KeyboardEvent = event?.event || event;
    if (keyEvent?.key === 'Enter') {
      navigateEditableCellOnEnter(event);
      return;
    }
    if (keyEvent?.key !== 'F10') return;
    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    if (keyEvent.repeat) return;
    event.api?.stopEditing();
    void this.saveChanges();
  }

  onMasterColumnResized(event: any): void {
    saveGridColumnWidths(this.gridApi, `inandout:${this.movementType}:master`, this.trackingService.getEmail(), event);
  }

  onSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedEntry = selectedRows.length > 0 ? selectedRows[0] : null;
    this.refreshColumns();
  }

  onCellValueChanged(event: any): void {
    if (event.colDef.field === 'idAutoriza' && Number(event.newValue) > 0) {
      const authorizer = (this.users || []).find((user: any) => Number(user.id) === Number(event.newValue));
      const documentLabel = this.translate.instant(this.movementType === 'IN' ? 'modules.warehouses.ui.movements.receipt' : 'modules.warehouses.ui.movements.issue');
      alerts.basicAlert(
        this.translate.instant('modules.warehouses.ui.movements.messages.authorizerSelected'),
        this.translate.instant('modules.warehouses.ui.movements.messages.authorizerAssigned', { name: authorizer?.displayName || this.translate.instant('modules.warehouses.ui.movements.messages.selectedUser'), document: documentLabel }),
        'success'
      );
    }
    if (event.colDef.field === 'directEntry') {
      this.isDirectEntryMode = event.newValue;
    }
    this.hasUnsavedChanges = true;
    this.gridApi?.refreshCells({ rowNodes: [event.node], force: true });
    if (event.colDef.field === 'idType') {
      this.selectedEntry = event.data;
      this.refreshColumns();
    }
    if (event.colDef.field === 'idOc' || event.colDef.field === 'idEntry') {
      this.selectedEntry = event.data;
      this.refreshColumns();
    }
  }

  isDirectEntryMode: boolean = false;

  onCellEditingStopped(event: any): void {
    if (event.colDef.field === 'idProject' && event.newValue === this.addNewSentinel) {
      event.node.data.idProject = event.oldValue ?? null;
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
      this.pendingProjectNode = event.node;
      this.projectCreator?.openModal();
      return;
    }
    // Sentinel para Tipo de Movimiento en el grid
    if (event.colDef.field === 'idType' && event.newValue === '__ADD_NEW__') {
      event.node.data.idType = event.oldValue ?? null;
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
      this.openAddTipoDialogForNode(event.node);
      return;
    }
    if (event.colDef.field === 'directEntry') {
      this.isDirectEntryMode = event.newValue;
    }
    if (event.colDef.field === 'idType') {
      this.selectedEntry = event.data;
      this.refreshColumns();
      this.refreshExpandedItemsDetail(event.node);
    }
  }

  onProjectCreated(project: any): void {
    const projectId = Number(project?.id ?? project?.Proyecto?.id ?? project?.proyecto?.id ?? 0);
    const projectName = project?.description ?? project?.name ?? project?.Proyecto?.description ?? project?.Proyecto?.name;
    this.projectsService.getProjectListByCompany(this.idRoot).subscribe({
      next: (data: any) => {
        this.projectList = Array.isArray(data) ? data : (data?.data ?? []);
        const created = this.projectList.find(item => projectId ? Number(item.id) === projectId :
          String(item.description ?? item.name).trim() === String(projectName ?? '').trim());
        if (created && this.pendingProjectNode) {
          this.pendingProjectNode.data.idProject = Number(created.id);
          this.pendingProjectNode.setDataValue('idProject', Number(created.id));
          this.hasUnsavedChanges = true;
        }
        this.pendingProjectNode = null;
        this.refreshColumns();
      },
      error: error => console.error('Error recargando proyectos:', error)
    });
  }

  /**
   * El detalle toma el comportamiento del tipo al inicializarse. Si el usuario
   * cambia el tipo con el detalle abierto, se recrea para volver a cargar los
   * materiales con las reglas del valueAddition vigente.
   */
  private refreshExpandedItemsDetail(node: any): void {
    if (!node?.expanded || node.data?.detailType !== 'items') return;
    node.setExpanded(false);
    setTimeout(() => {
      if (this.gridApi && node.data?.detailType === 'items') node.setExpanded(true);
    }, 0);
  }

  async openAddTipoDialogForNode(node: any): Promise<void> {
    const result = await alerts.inputAlert(
      'Nuevo Tipo de Movimiento',
      `Tipo: ${this.movementType === 'IN' ? 'Entrada' : 'Salida'}`,
      'text', '',
      {
        inputAttributes: { placeholder: this.translate.instant('modules.warehouses.ui.movements.messages.movementDescription') },
        confirmButtonText: 'Guardar',
        confirmButtonColor: '#28a745'
      }
    );
    if (result.isConfirmed && result.value) {
      const newId = await this.saveNewCatalog(result.value);
      if (newId !== null) {
        node.data.idType = newId;
        node.data.__modified = true;
        this.hasUnsavedChanges = true;
        this.selectedEntry = node.data;
        this.refreshColumns();
        this.gridApi.refreshCells({ rowNodes: [node], force: true });
      }
    }
  }

  onCellDoubleClicked(event: any): void {
    if (event.colDef.editable) {
      this.gridApi.startEditingCell({
        rowIndex: event.rowIndex,
        colKey: event.column.getColId()
      });
    }
  }

  async addEntry(): Promise<void> {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idBranch: this.idBranch,
      idProject: this.projectId,
      idWarehouse: this.selectedWarehouse?.idAlmacen || 0,
      idWarehouseOrigin: null,
      idType: this.selectedCatalog?.id || 0,
      idOt: this.selectedOt?.id || 0,
      idOc: 0,
      idEntry: 0,
      folio: '',
      date: new Date().toISOString(),
      deliveryDate: new Date().toISOString(),
      numBill: 'SIN FACTURA',
      deliverName: 'POR CLIENTE',
      idAutoriza: 0,
      comment: '',
      type: this.movementType,
      active: true,
      directEntry: false,
      countrow: 0,
      evidenceCount: 0,
      detailType: null,
      detailData: [],
      __isNew: true,
    };

    // Obtener el folio desde la configuración en el momento de agregar la
    // fila, para que el usuario lo vea inmediatamente (entradas y salidas).
    newItem.folio = await this.getNextMovementFolio(newItem) || '';
    if (!newItem.folio) {
      console.warn('No se encontró configuración de folio para el movimiento', {
        movementType: this.movementType,
        idBranch: this.idBranch,
        projectId: this.projectId
      });
    }

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      this.gridApi.ensureIndexVisible(0);
      this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'folio' });
    }, 0);
  }

  async deleteEntry(): Promise<void> {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó inandout st', 'ModWareHousesTD', this.trackingService.getEmail());
    if (!this.selectedEntry) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.selectionRequired'), this.translate.instant('modules.warehouses.ui.movements.messages.selectMovementToDelete'), 'warning');
      return;
    }
    if (Number(this.selectedEntry?.idAutoriza) > 0) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.movementAuthorized'), this.translate.instant('modules.warehouses.ui.movements.messages.removeAuthorizationToDelete'), 'warning');
      return;
    }

    const selectedEntry = this.selectedEntry;
    const movementLabel = this.movementType === 'IN' ? 'Entrada' : 'Salida';
    const selectedId = Number(selectedEntry?.id || 0);
    if (selectedId > 0) {
      try {
        const details: any = await lastValueFrom(this.inandoutService.getInAndOutItems(selectedId));
        if (!Array.isArray(details)) throw new Error('Respuesta de partidas inválida');
        const activeItems = details.filter((item: any) => item.active !== false && item.active !== 0);
        if (activeItems.length) {
          alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.cannotDelete'), this.translate.instant('modules.warehouses.ui.movements.messages.removeLineItemsFirst', { document: this.translate.instant(this.movementType === 'IN' ? 'modules.warehouses.ui.movements.receipt' : 'modules.warehouses.ui.movements.issue') }), 'warning');
          return;
        }
      } catch (error) {
        console.error('No fue posible validar las partidas del movimiento antes de eliminarlo:', error);
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.couldNotValidate'), this.translate.instant('modules.warehouses.ui.movements.messages.notDeletedCouldNotCheckItems'), 'warning');
        return;
      }
    }

    const result = await alerts.confirmAlert(
      this.translate.instant('modules.warehouses.ui.movements.messages.deleteTitle', { movement: this.translate.instant(this.movementType === 'IN' ? 'modules.warehouses.ui.movements.receipt' : 'modules.warehouses.ui.movements.issue') }),
      this.translate.instant('modules.warehouses.ui.movements.messages.confirmDelete', { movement: this.translate.instant(this.movementType === 'IN' ? 'modules.warehouses.ui.movements.receipt' : 'modules.warehouses.ui.movements.issue'), folio: selectedEntry.folio }),
      'warning',
      this.translate.instant('modules.warehouses.ui.movements.messages.yesDelete')
    );

    if (result.isConfirmed) {
      try {
        if (selectedEntry.__isNew || String(selectedEntry.id).startsWith('temp_')) {
          this.rowData = this.rowData.filter(entry => entry !== selectedEntry);
          this.gridApi.setGridOption('rowData', this.rowData);
          this.selectedEntry = null;
          this.hasUnsavedChanges = this.rowData.some(entry => entry.__isNew || entry.__modified);
          return;
        }
        const entryId = Number(selectedEntry.id);
        await lastValueFrom(this.inandoutService.deleteInAndOut(entryId));
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.deleted'), this.translate.instant('modules.warehouses.ui.movements.messages.movementDeleted', { movement: this.translate.instant(this.movementType === 'IN' ? 'modules.warehouses.ui.movements.receipt' : 'modules.warehouses.ui.movements.issue') }), 'success');
        this.selectedEntry = null;
        this.loadEntries();
      } catch (error: any) {
        const errorMsg = error?.error?.message || error?.error?.Message || error?.message || this.translate.instant('modules.warehouses.ui.movements.messages.unknownError');
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.error'), this.translate.instant('modules.warehouses.ui.movements.messages.deleteMovementFailed', { movement: this.translate.instant(this.movementType === 'IN' ? 'modules.warehouses.ui.movements.receipt' : 'modules.warehouses.ui.movements.issue'), error: errorMsg }), 'error');
      }
    }
  }

  async saveChanges(): Promise<void> {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en inandout st', 'ModWareHousesTD', this.trackingService.getEmail());
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.noChanges'), this.translate.instant('modules.warehouses.ui.movements.messages.noPendingChanges'), 'info');
      return;
    }

    const newRows = this.rowData.filter((row: any) => row.__isNew);
    const modifiedRows = this.rowData.filter((row: any) => row.__modified && !row.__isNew);

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.noChanges'), this.translate.instant('modules.warehouses.ui.movements.messages.noPendingChanges'), 'info');
      this.hasUnsavedChanges = false;
      return;
    }

    const invalidTransfer = [...newRows, ...modifiedRows].find((row: any) =>
      this.isTransferType(row.idType) &&
      (!Number(row.idWarehouseOrigin) || Number(row.idWarehouseOrigin) === Number(row.idWarehouse || this.selectedWarehouse?.idAlmacen))
    );
    if (invalidTransfer) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.destinationRequired'), this.translate.instant('modules.warehouses.ui.movements.messages.selectDifferentDestination'), 'warning');
      return;
    }

    try {
      for (const newRow of newRows) {
        const entryData = this.prepareEntryData(newRow);
        if (!entryData.folio) {
          entryData.folio = await this.getNextMovementFolio(entryData) || '';
          if (!entryData.folio) {
            console.warn('No se encontró configuración de folio para la entrada/salida', {
              movementType: this.movementType,
              owner: this.getMovementFolioOwner(entryData)
            });
          }
        }
        console.info('[Entradas][POST /Inandout] Enviando encabezado:', entryData);
        const response = await lastValueFrom(this.inandoutService.addInAndOut(entryData));
        console.info('[Entradas][POST /Inandout] Respuesta:', response);
      }
      for (const modifiedRow of modifiedRows) {
        const entryData = this.prepareEntryData(modifiedRow);
        await lastValueFrom(this.inandoutService.updateInAndOut(modifiedRow.id, entryData));
      }
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.saved'), this.translate.instant('modules.warehouses.ui.movements.messages.changesSaved'), 'success');
      this.hasUnsavedChanges = false;
      this.loadEntries();
    } catch (error: any) {
      const errorMsg = error?.error?.message || error?.message || 'Error desconocido';
      console.error(`[Entradas][Error al guardar encabezado ${this.movementType}]`, {
        status: error?.status,
        message: error?.message,
        response: error?.error,
        error
      });
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.error'), `${this.translate.instant('modules.warehouses.ui.movements.messages.saveChangesFailed')}: ${errorMsg}`, 'error');
    }
  }

  private prepareEntryData(row: any): any {
    const isTransfer = this.isTransferType(row.idType);
    return {
      idBranch: this.idBranch,
      idProject: row.idProject || this.projectId,
      idWarehouse: isTransfer
        ? (row.idWarehouseOrigin || null)
        : (row.idWarehouse || this.selectedWarehouse?.idAlmacen || 0),
      idWarehouseOrigin: isTransfer
        ? (row.idWarehouse || this.selectedWarehouse?.idAlmacen || null)
        : null,
      idType: row.idType || 0,
      idOt: row.idOt || 0,
      idOc: row.idOc || 0,
      idEntry: row.idEntry || 0,
      folio: row.folio || '',
      date: row.date || new Date().toISOString(),
      deliveryDate: row.deliveryDate || new Date().toISOString(),
      numBill: this.isTransferType(row.idType) ? null : (row.numBill || ''),
      deliverName: row.deliverName || '',
      idAutoriza: row.idAutoriza || 0,
      comment: row.comment || '',
      type: this.movementType,
      active: row.active ?? true,
      directEntry: row.directEntry === true || row.directEntry === 1,
      ocList: row.ocList || '',
      countrow: row.countrow || 0
    };
  }

  async generateEvidenceReport(): Promise<void> {
    const entriesWithEvidence = this.rowData.filter((row: any) => Number(row.evidenceCount) > 0);
    if (!entriesWithEvidence.length) {
      alerts.basicAlert(
        this.translate.instant('modules.warehouses.ui.movements.evidenceReport'),
        this.translate.instant('modules.warehouses.ui.movements.noEvidence'),
        'warning'
      );
      return;
    }

    alerts.showLoadingWithProgress(
      this.translate.instant('modules.warehouses.ui.movements.generatingReport'),
      this.translate.instant('modules.warehouses.ui.movements.processingPhotos'),
      0
    );

    try {
      const photosPerPage = 4;
      const photos: { base64: string; caption: string }[] = [];
      const step = 80 / entriesWithEvidence.length;
      let progress = 10;

      for (const entry of entriesWithEvidence) {
        try {
          const evidenceRows: any[] = await lastValueFrom(this.inandoutEvidenceService.getByInandout(entry.id));
          const dateText = entry.date ? new Date(entry.date).toLocaleDateString() : '';
          const typeLabel = this.translate.instant(entry.type === 'IN' ? 'modules.warehouses.ui.movements.receipt' : 'modules.warehouses.ui.movements.issue');
          const baseCaption = `${entry.folio || ''} · ${typeLabel} · ${dateText}${entry.deliverName ? ' · ' + entry.deliverName : ''}`;
          for (const evidence of (Array.isArray(evidenceRows) ? evidenceRows : [])) {
            try {
              const base64 = await this.base64EncodeService.convertImageToBase64(evidence.image);
              const caption = evidence.comment ? `${baseCaption}\n${evidence.comment}` : baseCaption;
              photos.push({ base64, caption });
            } catch (error) {
              console.error('Error convirtiendo imagen de evidencia:', evidence.id, error);
            }
          }
        } catch (error) {
          console.error('Error cargando evidencia del movimiento:', entry.id, error);
        }
        progress += step;
        alerts.updateLoadingProgress(
          this.translate.instant('modules.warehouses.ui.movements.generatingReport'),
          this.translate.instant('modules.warehouses.ui.movements.processingPhotos'),
          progress
        );
      }

      if (!photos.length) {
        alerts.closeLoading();
        alerts.basicAlert(
          this.translate.instant('modules.warehouses.ui.movements.evidenceReport'),
          this.translate.instant('modules.warehouses.ui.movements.noEvidence'),
          'warning'
        );
        return;
      }

      const content: any[] = [];
      for (let i = 0; i < photos.length; i += photosPerPage) {
        const pageGroup = photos.slice(i, i + photosPerPage);
        const rows: any[] = [];
        for (let r = 0; r < pageGroup.length; r += 2) {
          const pair = pageGroup.slice(r, r + 2);
          rows.push({
            columns: pair.map(photo => ({
              width: '*',
              stack: [
                { image: photo.base64, width: 220, height: 220, fit: [220, 220], alignment: 'center' },
                { text: photo.caption, fontSize: 8, alignment: 'center', margin: [0, 4, 0, 10] }
              ]
            })),
            columnGap: 20
          });
        }
        content.push({
          stack: rows,
          pageBreak: i > 0 ? 'before' : undefined
        });
      }

      const warehouseName = this.selectedWarehouse?.nombreAlmacen || this.selectedWarehouse?.name || '';
      const typeTitle = this.translate.instant(this.movementType === 'IN' ? 'modules.warehouses.ui.movements.receipt' : 'modules.warehouses.ui.movements.issue');
      const reportTitle = `${this.translate.instant('modules.warehouses.ui.movements.evidenceReportTitle')} - ${typeTitle}${warehouseName ? ' - ' + warehouseName : ''}`;

      let logo = '';
      let company: any = {};
      try {
        company = await lastValueFrom(this.rootService.getRootbyId(this.idRoot));
        if (company?.picture) logo = await this.base64EncodeService.convertImageToBase64(company.picture);
      } catch (error) {
        console.error('Error cargando logo de la empresa para el reporte de evidencias:', error);
      }

      pdfMake.fonts = {
        Montserrat: {
          normal: `${evidencePdfFontsBaseUrl}/assets/fonts/Montserrat-Regular.ttf`,
          bold: `${evidencePdfFontsBaseUrl}/assets/fonts/Montserrat-Bold.ttf`,
          italics: `${evidencePdfFontsBaseUrl}/assets/fonts/Montserrat-Italic.ttf`,
          bolditalics: `${evidencePdfFontsBaseUrl}/assets/fonts/Montserrat-BoldItalic.ttf`,
        }
      };

      const docDefinition: any = {
        pageSize: 'LETTER',
        pageOrientation: 'portrait',
        pageMargins: [40, 100, 40, 60],
        defaultStyle: { fontSize: 8, font: 'Montserrat' },
        styles: {
          companyName: { fontSize: 12, bold: true },
          companyInfo: { fontSize: 8 },
          reportTitle: { fontSize: 13, bold: true }
        },
        header: () => ({
          margin: [40, 15, 40, 5],
          columns: [
            { width: 70, stack: logo ? [{ image: logo, width: 60, height: 45 }] : [{ text: '' }] },
            {
              width: '*',
              stack: [
                { text: company?.name || '', style: 'companyName', alignment: 'center' },
                { text: [company?.address, company?.city, company?.state].filter(Boolean).join(', '), style: 'companyInfo', alignment: 'center' },
                { text: `RFC: ${company?.rfc || 'N/A'} | Email: ${company?.email || 'N/A'} | Tel: ${company?.phone || 'N/A'}`, style: 'companyInfo', alignment: 'center' }
              ],
              margin: [10, 5, 10, 0]
            },
            { width: 150, stack: [{ text: reportTitle, style: 'reportTitle', alignment: 'right' }] }
          ]
        }),
        content: [...content],
        footer: (currentPage: number, pageCount: number) => ({
          text: `${currentPage} / ${pageCount}`,
          fontSize: 8,
          alignment: 'center'
        })
      };

      alerts.closeLoading();
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Generó reporte fotográfico de evidencias', 'ModWareHousesTD', this.trackingService.getEmail());
      const fileName = `Reporte_Evidencias_${this.movementType}_${new Date().getTime()}.pdf`;
      void this.pdfPreview.show(pdfMake.createPdf(docDefinition), this.translate.instant('modules.warehouses.ui.movements.evidenceReportTitle'), fileName);
    } catch (error) {
      alerts.closeLoading();
      console.error('Error generando reporte de evidencias:', error);
      alerts.basicAlert(
        this.translate.instant('modules.warehouses.ui.movements.messages.error'),
        this.translate.instant('modules.warehouses.ui.movements.evidenceReport'),
        'error'
      );
    }
  }

  refreshData(): void {
    this.loadEntries();
    this.selectedEntry = null;
    this.hasUnsavedChanges = false;
    alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.refreshed'), this.translate.instant('modules.warehouses.ui.movements.messages.dataRefreshed'), 'success');
  }

  // ==================== ITEMS DE ENTRADA ====================

  loadEntryItemsData(entryId: number, successCallback: any) {
    console.info(`[Entradas][GET /Detailsinandout/${entryId}] Cargando artículos`);
    this.inandoutService.getInAndOutItems(entryId).subscribe({
      next: (data: any) => {
        console.info(`[Entradas][GET /Detailsinandout/${entryId}] Respuesta:`, data);
        successCallback(data);
      },
      error: (error) => {
        console.error(`[Entradas][GET /Detailsinandout/${entryId}] Error`, {
          status: error?.status,
          message: error?.message,
          response: error?.error
        });
        successCallback([]);
      }
    });
  }

  importItemsFromOC(idOc: number, entryId: any, callback: (data: any[]) => void) {
    if (!idOc || idOc <= 0) { callback([]); return; }
    const items = this.ocRemainingItemsById.get(Number(idOc)) || [];
    if (!items.length) { callback([]); return; }
    {
        let tempCounter = Date.now();
        const mapped = items.map((item: any) => ({
          id: `temp_item_${tempCounter++}`,
          idInandout: entryId,
          idProduct: item.idSupplie || item.idProduct || 0,
          idBrand: item.idBrand ?? null,
          brandName: item.brandName || item.brand || '',
          code: item.code || '',
          description: item.description || '',
          materialName: item.description || '',
          measure: item.measure || '',
          quantity: 0,
          pending: item.remainingQuantity || 0,
          total: item.remainingQuantity || 0,
          active: true,
          __isNew: true,
          __modified: false
        }));
        callback(mapped);
    }
  }

  importItemsFromEntry(sourceEntryId: number, outingId: any, callback: (data: any[]) => void) {
    if (!sourceEntryId || sourceEntryId <= 0) { callback([]); return; }
    const items = this.entryRemainingItemsById.get(Number(sourceEntryId)) || [];
    let tempCounter = Date.now();
    callback(items.map((item: any) => ({
      id: `temp_item_${tempCounter++}`,
      idInandout: outingId,
      idProduct: Number(item.idProduct || 0),
      idBrand: item.idBrand ?? null,
      brandName: item.brandName || '',
      code: item.code || '',
      description: item.description || '',
      materialName: item.description || '',
      measure: item.measure || '',
      quantity: 0,
      pending: Number(item.remainingQuantity) || 0,
      total: 0,
      active: true,
      __isNew: true,
      __modified: false
    })));
  }

  async saveEntryItemsById(entryId: any, data: any[]): Promise<boolean> {
    let masterEntry = this.rowData.find((entry: any) => String(entry.id) === String(entryId));
    if (!hasPersistedMasterId(entryId, masterEntry?.__isNew)) {
      const savedId = await this.saveMasterEntryForItems(masterEntry);
      if (!savedId) return false;
      data.forEach((item: any) => item.idInandout = savedId);
      entryId = savedId;
      masterEntry = this.rowData.find((entry: any) => String(entry.id) === String(savedId));
    }
    const newItems = data.filter((row: any) => row.__isNew);
    const modifiedItems = data.filter((row: any) => row.__modified && !row.__isNew);
    const dailyReportItems = this.movementType === 'OUT'
      ? data.filter((row: any) => row.addToDailyReport === true)
      : [];

    if (dailyReportItems.some((item: any) => Number(item.quantity) <= 0)) {
      alerts.basicAlert(
        this.translate.instant('modules.warehouses.ui.movements.messages.quantityRequired'),
        this.translate.instant('modules.warehouses.ui.movements.messages.dailyReportQuantity'),
        'warning'
      );
      return false;
    }

    let shouldAddToDailyReport = false;
    if (dailyReportItems.length > 0) {
      const entry = this.rowData.find(item => String(item.id) === String(entryId));
      const date = this.formatDateForDisplay(entry?.date);
      const confirmation = await alerts.confirmAlert(
        this.translate.instant('modules.warehouses.ui.movements.messages.addToDailyReport'),
        this.translate.instant('modules.warehouses.ui.movements.messages.confirmDailyReportItems', { count: dailyReportItems.length, date }),
        'question',
        this.translate.instant('modules.warehouses.ui.movements.messages.yesAdd')
      );
      shouldAddToDailyReport = confirmation.isConfirmed;
    }

    let currentOperation = 'iniciar guardado de artículos';
    try {
      for (const item of newItems) {
        const payload = this.cleanItemData(item);
        currentOperation = `POST /Detailsinandout artículo ${item.idProduct ?? item.id ?? '(nuevo)'}`;
        console.info(`[Entradas][${currentOperation}] Payload:`, payload);
        const response = await lastValueFrom(this.inandoutService.addInAndOutItem(payload));
        console.info(`[Entradas][${currentOperation}] Respuesta:`, response);
      }
      for (const item of modifiedItems) {
        const payload = this.cleanItemData(item);
        currentOperation = `PUT /Detailsinandout/${item.id}`;
        console.info(`[Entradas][${currentOperation}] Payload:`, payload);
        const response = await lastValueFrom(this.inandoutService.updateInAndOutItem(item.id, payload));
        console.info(`[Entradas][${currentOperation}] Respuesta:`, response);
      }

      if (newItems.length > 0 || modifiedItems.length > 0 || shouldAddToDailyReport) {
        currentOperation = `GET /Detailsinandout/${entryId} después de guardar`;
        console.info(`[Entradas][${currentOperation}] Consultando artículos guardados`);
        const persistedItems = await lastValueFrom(this.inandoutService.getInAndOutItems(entryId));
        console.info(`[Entradas][${currentOperation}] Respuesta:`, persistedItems);
        const persistedCount = Array.isArray(persistedItems) ? persistedItems.length : data.length;
        this.updateEntryItemsCount(entryId, persistedCount);
        const masterEntry = this.rowData.find(entry => entry.id === entryId);
        if (masterEntry) {
          masterEntry.countrow = persistedCount;
          await lastValueFrom(this.inandoutService.updateInAndOut(String(entryId), this.prepareEntryData(masterEntry)));
        }

        let addedToDailyReport = 0;
        let dailyReportFailed = false;
        if (shouldAddToDailyReport) {
          try {
            addedToDailyReport = await this.addItemsToDailyReport(entryId, dailyReportItems);
            dailyReportItems.forEach((item: any) => delete item.addToDailyReport);
          } catch (error) {
            console.error('Error adding outgoing items to daily report:', error);
            // Conserva la selección para que el usuario pueda volver a intentar
            // sin tener que marcar los artículos otra vez.
            dailyReportFailed = true;
          }
        } else {
          dailyReportItems.forEach((item: any) => delete item.addToDailyReport);
        }

        data.forEach(row => {
          delete row.__isNew;
          delete row.__modified;
        });
        if (dailyReportFailed) {
          this.keepItemsDetailOpen(entryId);
          alerts.basicAlert(
            this.translate.instant('modules.warehouses.ui.movements.messages.itemsSaved'),
            this.translate.instant('modules.warehouses.ui.movements.messages.dailyReportAddFailed'),
            'warning'
          );
          return true;
        }
        this.keepItemsDetailOpen(entryId);
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.detailsSaved'), this.translate.instant('modules.warehouses.ui.movements.messages.itemsSaved'), 'success');
        if (addedToDailyReport > 0) {
          alerts.toastAlert(this.translate.instant('modules.warehouses.ui.movements.messages.addedToDailyReport', { count: addedToDailyReport }), 'success');
        }
        return true;
      }
      return true;
    } catch (error: any) {
      console.error(`[Entradas][Error durante ${currentOperation}]`, {
        status: error?.status,
        message: error?.message,
        response: error?.error,
        error
      });
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.error'), this.translate.instant('modules.warehouses.ui.movements.messages.saveItemsFailed'), 'error');
      return false;
    }
  }

  private async saveMasterEntryForItems(entry: any): Promise<number | null> {
    if (!entry) return null;
    if (this.isTransferType(entry.idType) && (!Number(entry.idWarehouseOrigin) || Number(entry.idWarehouseOrigin) === Number(entry.idWarehouse || this.selectedWarehouse?.idAlmacen))) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.destinationRequired'), this.translate.instant('modules.warehouses.ui.movements.messages.selectDifferentDestinationForItems'), 'warning');
      return null;
    }

    const entryData = this.prepareEntryData(entry);
    if (!entryData.folio) {
      entryData.folio = await this.getNextMovementFolio(entryData) || '';
    }

    try {
      const response: any = await lastValueFrom(this.inandoutService.addInAndOut(entryData));
      const savedId = Number(response?.id ?? response?.data?.id ?? response?.idInandout ?? response?.idInAndOut ?? 0);
      if (!savedId) throw new Error('El servidor no devolvió el identificador del movimiento.');
      entry.id = savedId;
      entry.folio = response?.folio || entryData.folio || entry.folio;
      delete entry.__isNew;
      delete entry.__modified;
      this.hasUnsavedChanges = this.rowData.some((row: any) => row.__isNew || row.__modified);
      this.gridApi?.refreshCells({ force: true });
      return savedId;
    } catch (error: any) {
      console.error('Error guardando el encabezado antes de sus partidas:', error);
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.saveMovementFailed'), error?.error?.message || error?.message || this.translate.instant('modules.warehouses.ui.movements.messages.checkHeaderAndRetry'), 'error');
      return null;
    }
  }

  private getMovementFolioOwner(entry: any): { type: 'project' | 'branch'; id: number } | null {
    const projectId = Number(entry?.idProject || this.projectId || 0);
    if (projectId > 0) return { type: 'project', id: projectId };

    const branchId = Number(entry?.idBranch || this.idBranch || 0);
    if (branchId > 0) return { type: 'branch', id: branchId };
    return null;
  }

  private async getNextMovementFolio(entry: any): Promise<string | null> {
    const owner = this.getMovementFolioOwner(entry);
    if (!owner) return null;

    const documentType = String(entry?.type || this.movementType).toUpperCase() === 'OUT' ? 'out' : 'entry';
    console.info('[Almacenes][Folio] Consultando configuración:', {
      companyId: this.idRoot,
      ownerType: owner.type,
      ownerId: owner.id,
      documentType
    });
    const folio = await this.prefixSetupService.getNextFolio(owner.type, owner.id, documentType);
    console.info('[Almacenes][Folio] Resultado:', { ownerType: owner.type, ownerId: owner.id, documentType, folio });
    return folio;
  }

  async deleteDetailRow(params: any, successCallback: () => void, type: string) {
    const entryId = params.data.idInandout;
    const detailId = params.data.id;

    const confirmation = await alerts.confirmAlert(
      this.translate.instant('modules.warehouses.ui.movements.messages.deleteLineItem'),
      this.translate.instant('modules.warehouses.ui.movements.messages.confirmDeleteLineItem'),
      'warning',
      this.translate.instant('modules.warehouses.ui.movements.messages.yesDelete')
    );
    if (!confirmation.isConfirmed) return;

    if (params.data.__isNew) {
      params.api.applyTransaction({ remove: [params.data] });
      this.hasUnsavedChanges = true;
      const currentCount = params.api.getDisplayedRowCount();
      this.updateEntryItemsCount(entryId, currentCount - 1);
      successCallback();
    } else {
      try {
        await lastValueFrom(this.inandoutService.deleteInAndOutItem(detailId));
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.itemDeleted'), this.translate.instant('modules.warehouses.ui.movements.messages.itemDeletedSuccessfully'), 'success');
        successCallback();
      } catch (error) {
        console.error('Error deleting detail row:', error);
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.error'), this.translate.instant('modules.warehouses.ui.movements.messages.deleteItemFailed'), 'error');
      }
    }
  }

  private cleanItemData(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.__autoStockRow;
    delete cleanedData.material;
    delete cleanedData.materialName;
    delete cleanedData.addToDailyReport;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_item_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  updateEntryItemsCount(entryId: number, count: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === entryId) {
          node.data.countrow = count;
          this.gridApi.refreshCells({ rowNodes: [node], columns: ['countrow'], force: true });
        }
      });
    }
  }

  // ==================== EVIDENCIA FOTOGRÁFICA (detalle) ====================

  loadEntryEvidence(entryId: number, callback: (data: any[]) => void) {
    this.inandoutEvidenceService.getByInandout(entryId).subscribe({
      next: (data: any) => callback(Array.isArray(data) ? data : []),
      error: (error) => {
        console.error('Error loading evidence:', error);
        callback([]);
      }
    });
  }

  addEntryEvidence(entryId: number, imageUrl: string, comment: string, callback: (saved: any) => void) {
    this.inandoutEvidenceService.add({ idInandout: entryId, image: imageUrl, comment }).subscribe({
      next: (saved: any) => callback(saved),
      error: (error) => {
        console.error('Error saving evidence:', error);
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.error'), this.translate.instant('modules.warehouses.ui.movements.messages.evidenceSaveFailed'), 'error');
        callback(null);
      }
    });
  }

  editEntryEvidence(id: number, comment: string, callback: (saved: any) => void) {
    this.inandoutEvidenceService.update(id, comment).subscribe({
      next: (saved: any) => callback(saved),
      error: (error) => {
        console.error('Error updating evidence comment:', error);
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.error'), this.translate.instant('modules.warehouses.ui.movements.messages.evidenceSaveFailed'), 'error');
        callback(null);
      }
    });
  }

  deleteEntryEvidence(id: number, callback: () => void) {
    this.inandoutEvidenceService.delete(id).subscribe({
      next: () => callback(),
      error: (error) => {
        console.error('Error deleting evidence:', error);
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.movements.messages.error'), this.translate.instant('modules.warehouses.ui.movements.messages.evidenceDeleteFailed'), 'error');
      }
    });
  }

  updateEvidenceCount(entryId: number, count: number) {
    if (this.gridApi) {
      this.gridApi.forEachNode((node) => {
        if (node.data && node.data.id === entryId) {
          node.data.evidenceCount = count;
          this.gridApi.refreshCells({ rowNodes: [node], columns: ['evidenceCount'], force: true });
        }
      });
    }
  }

  private loadEvidenceCounts(): void {
    const ids = this.rowData.map((row: any) => Number(row.id)).filter((id: number) => Number.isFinite(id) && id > 0);
    if (!ids.length) return;
    this.inandoutEvidenceService.getCounts(ids).subscribe({
      next: (counts: Record<string, number>) => {
        this.rowData.forEach((row: any) => {
          row.evidenceCount = counts?.[row.id] || 0;
        });
        if (this.gridApi) this.gridApi.refreshCells({ columns: ['evidenceCount'], force: true });
      },
      error: (error) => console.error('Error loading evidence counts:', error)
    });
  }

  /**
   * Envía los artículos seleccionados de una salida al reporte diario del mismo
   * proyecto y fecha. El reporte se crea sólo cuando aún no existe y los
   * materiales iguales se acumulan en una sola línea de bitácora.
   */
  private async addItemsToDailyReport(entryId: number, items: any[]): Promise<number> {
    const entry = this.rowData.find(item => String(item.id) === String(entryId));
    const idProject = Number(entry?.idProject || this.projectId);
    if (!idProject) {
      throw new Error('La salida debe tener un proyecto para agregar materiales al Reporte diario.');
    }

    const reportDate = this.toDateOnly(entry?.date);
    const report = await this.findOrCreateDailyReport(idProject, reportDate, entry);
    const reportId = Number(report?.id);
    if (!reportId) {
      throw new Error('No fue posible obtener el reporte diario creado.');
    }

    const response = await lastValueFrom(this.logbookService.getInfoByReporte(reportId, 'MATERIAL'));
    const logbookItems: any[] = response?.success === false ? [] : (response?.data || []);
    const groupedItems = new Map<string, { item: any; quantity: number }>();
    items.forEach(item => {
      const key = String(item.idProduct || item.description || item.materialName || '').trim();
      if (!key) return;
      const current = groupedItems.get(key);
      if (current) current.quantity += Number(item.quantity || 0);
      else groupedItems.set(key, { item, quantity: Number(item.quantity || 0) });
    });

    const reference = `Salida ${entry?.folio || `#${entryId}`}`;
    let insertedOrUpdated = 0;
    for (const { item, quantity } of groupedItems.values()) {
      const existing = logbookItems.find((row: any) =>
        item.idProduct && Number(row.idResource) === Number(item.idProduct)
      );
      // Hace el reintento idempotente: si una petición anterior alcanzó a
      // registrar este material de la misma salida, no se vuelve a sumar.
      if (existing && String(existing.supervisor || '').includes(reference)) continue;
      const note = this.appendDailyReportReference(existing?.supervisor, reference);
      const payload = {
        idReporte: reportId,
        idProject,
        typeNote: 'MATERIAL',
        date: reportDate,
        orden: existing?.orden || logbookItems.length + 1,
        quantity: Number(existing?.quantity || 0) + quantity,
        description: existing?.description || item.description || item.materialName || null,
        supervisor: note,
        position: existing?.position || item.measure || null,
        idResource: item.idProduct || null,
      };

      if (existing?.id) {
        await lastValueFrom(this.logbookService.updateDataForOt(existing.id, payload));
      } else {
        const created = await lastValueFrom(this.logbookService.addDataForOt(payload));
        logbookItems.push({ ...payload, id: created?.id || `new_${logbookItems.length}` });
      }
      insertedOrUpdated++;
    }

    await lastValueFrom(this.dailyReportService.updateBitacoraCount(reportId, 'MATERIAL', logbookItems.length));
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      `Agregó ${groupedItems.size} material(es) de salida ${entry?.folio || entryId} al Reporte diario ${reportId}`,
      'Almacenes / Reporte diario',
      this.trackingService.getEmail()
    );
    return insertedOrUpdated;
  }

  private async findOrCreateDailyReport(idProject: number, date: string, entry: any): Promise<any> {
    const response = await lastValueFrom(this.dailyReportService.getDailyReportsByProject(idProject));
    const reports = response?.data || response || [];
    const existing = reports.find((report: any) =>
      report?.active !== false && this.toDateOnly(report.date) === date
    );
    if (existing) return existing;

    const created = await lastValueFrom(this.dailyReportService.addDailyReport({
      idOt: entry?.idOt || null,
      idProject,
      date,
      startTime: '07:52:00',
      endTime: '17:02:00',
      type: 'CORTE',
      description: `Creado automáticamente desde la salida ${entry?.folio || ''}`.trim(),
      totalPay: 0,
      close: false,
      paid: true,
      tiempos: 0,
      personal: 0,
      fotos: 0,
      videos: 0,
      material: 0,
      equipos: 0,
      conceptos: 0,
      notas: 0,
      active: true,
    }));
    const report = created?.data || created;
    if (report?.id) return report;

    // Algunos servicios responden sin el objeto creado; se vuelve a consultar
    // para recuperar el registro recién generado.
    const refreshed = await lastValueFrom(this.dailyReportService.getDailyReportsByProject(idProject));
    return (refreshed?.data || refreshed || []).find((item: any) => this.toDateOnly(item.date) === date);
  }

  private toDateOnly(value: any): string {
    const raw = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.substring(0, 10);
    const parsed = new Date(value || Date.now());
    return isNaN(parsed.getTime()) ? new Date().toISOString().substring(0, 10) : parsed.toISOString().substring(0, 10);
  }

  private formatDateForDisplay(value: any): string {
    const [year, month, day] = this.toDateOnly(value).split('-');
    return `${day}/${month}/${year}`;
  }

  private appendDailyReportReference(note: any, reference: string): string {
    const current = String(note || '').trim();
    if (!current) return reference;
    return current.includes(reference) ? current : `${current} | ${reference}`;
  }

  private keepItemsDetailOpen(entryId: number): void {
    this.gridApi?.forEachNode((node: any) => {
      if (Number(node.data?.id) !== Number(entryId)) return;
      node.data.detailType = 'items';
      if (!node.expanded) node.setExpanded(true);
    });
  }
}
