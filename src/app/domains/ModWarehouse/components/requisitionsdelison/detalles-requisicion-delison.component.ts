import { Component, OnInit, OnDestroy, inject, Renderer2, RendererFactory2, HostListener, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { MaterialsService } from 'app/services/materials.service';
import { SignalsService } from 'app/services/signals.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { firstValueFrom, lastValueFrom, Subscription } from 'rxjs';
import { AuthService } from 'app/services/auth.service';
import { ItemCommentsCellRendererComponent } from 'app/shared/item-comments-cell-renderer/item-comments-cell-renderer.component';
import { ItemCommentsService } from 'app/services/item-comments.service';
import { PresentacionesPanelComponent } from './presentaciones-panel.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ReceiptsDelisonService } from 'app/services/receipts-delison.service';
import { PrefixSetupService } from 'app/services/prefix-setup.service';
import { ProvidersService } from 'app/services/providers.service';
import { SucursalByMaterialProveedorService } from 'app/services/sucursalByMaterialProveedor.service';
import { CustomersService } from 'app/services/customers.service';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { SearchableComboboxComponent } from 'app/shared/searchable-combobox/searchable-combobox.component';
import { RolesService } from 'app/services/roles.service';

@Component({
  selector: 'app-detalles-requisicion-delison',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, SelectWithTooltipEditorV2Component, MultiLineEditorComponent, ItemCommentsCellRendererComponent, SearchableComboboxComponent, PresentacionesPanelComponent],
  template: `
    <!-- Items Grid View -->
    <div *ngIf="detailType === 'items'" style="padding: 5px; background-color: #e3f2fd; height: 100%; max-height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
      <!-- Banner BLOQUEADA -->
      <div *ngIf="hasProviderAssigned"
           style="flex-shrink:0;background:#b71c1c;color:#fff;font-weight:700;font-size:0.8rem;
                  letter-spacing:1px;text-align:center;padding:4px 10px;border-radius:4px;
                  margin-bottom:4px;display:flex;align-items:center;justify-content:center;gap:6px;">
        <i class="bi bi-lock-fill"></i>
        REQUISICIÓN BLOQUEADA — No se pueden agregar ni eliminar artículos
      </div>

      <div style="margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
        <strong>Artículos de la Requisición</strong>
        <div class="d-flex gap-2">
        
       <button class="btn btn-primary btn-sm me-2" (click)="addItem()" [disabled]="hasProviderAssigned" *ngIf="authService.getCrudPermissionDetail('shoppingDelison', 'requisitions','Req_Art', 'create')"
          [title]="hasProviderAssigned ? 'No se puede agregar: la cotización ya tiene proveedor asignado' : ''">
          <i class="bi bi-plus-lg"></i> Agregar
        </button>
        
        <button class="btn btn-warning btn-sm me-2" (click)="discardChanges()"  >
          <i class="bi bi-arrow-counterclockwise"></i> Deshacer
        </button>
        
        <button class="btn btn-danger btn-sm me-2" (click)="deleteSelectedItem()" [disabled]="!hasRowSelected || hasProviderAssigned" *ngIf="authService.getCrudPermissionDetail('shoppingDelison', 'requisitions','Req_Art', 'delete')"
          [title]="hasProviderAssigned ? 'No se puede eliminar: la cotización ya tiene proveedor asignado' : ''">
          <i class="bi bi-trash"></i> Eliminar
        </button>
        
        <button class="btn btn-success btn-sm position-relative" (click)="saveChanges()" [disabled]="!isAddingNewItem && !hasUnsavedChanges" *ngIf="authService.getCrudPermissionDetail('shoppingDelison', 'requisitions','Req_Art', 'create') || authService.getCrudPermissionDetail('shoppingDelison', 'requisitions','Req_Art', 'update')">
          <i class="bi bi-floppy"></i> Guardar
          <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
            *ngIf="isAddingNewItem || hasUnsavedChanges">
            <span class="visually-hidden">Hay cambios sin guardar</span>
          </span>
        </button>

        <!-- Botón MultiGuardar (Hardcodeado con validación de permisos) -->
        <!-- <button *ngIf="authService.hasSubDetailedPermission('shoppingDelison', 'requisitions', 'Req_Mul')" -->
        <button *ngIf="canMultiguardar"
                class="btn btn-info btn-sm position-relative"
                (click)="saveMultiGuardar()"
                [title]="'Generar múltiples pedimentos de compra'"
                [disabled]="!hasPedimentoSelection">
          <i class="bi bi-file-earmark-pdf"></i> MultiGuardar
          <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
            *ngIf="hasPedimentoSelection">
            <span class="visually-hidden">Hay artículos seleccionados</span>
          </span>
        </button>

        <!-- Botones Dinámicos (otros) -->
        <ng-container *ngFor="let btn of dynamicButtons">
          <button *ngIf="actionMap[btn.identifier] && btn.identifier !== 'Req_Mul'"
                  class="btn btn-info btn-sm position-relative"
                  (click)="actionMap[btn.identifier]()"
                  [title]="btn.description || btn.name">
            <i [class]="btn.icon || 'bi bi-gear'"></i> {{ btn.name || btn.identifier }}
            <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
              *ngIf="badgeMap[btn.identifier] && badgeMap[btn.identifier]()">
              <span class="visually-hidden">Acción pendiente</span>
            </span>
          </button>
        </ng-container>
        </div>
      </div>

      <!-- Grid con tamaño completo -->
      <div style="flex: 1 1 auto; min-height: 0; position: relative; overflow: hidden;">
        <ag-grid-angular
        #agGrid
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        (cellClicked)="onCellClicked($event)"
        (selectionChanged)="onSelectionChanged($event)"
        [components]="components"
        style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>
    </div>

    <!-- Panel de Presentaciones (cajero) — se abre desde la celda Cantidad Requerida -->
    <app-presentaciones-panel
      *ngIf="panelOpen"
      [idMaterial]="panelMaterialId"
      [cantidad]="panelCantidad"
      [articleName]="panelArticle"
      [providerNames]="panelProviderNames"
      [permitirDividir]="false"
      (seleccionar)="onPanelSeleccionar($event)"
      (cerrar)="onPanelCerrar()">
    </app-presentaciones-panel>

     <!-- Modal para Nuevo Artículo (NgbModal lo monta en <body> para quedar por encima de todo) -->
    <ng-template #newArticleModalTpl>
      <div class="modal-header">
        <h5 class="modal-title">Registrar Nuevo Artículo</h5>
        <button type="button" class="btn-close" (click)="closeNewArticleModal()"></button>
      </div>
      <form class="modal-body" #newArticleForm="ngForm" (ngSubmit)="saveNewArticle()">
        <div class="mb-3">
          <label for="newArticleName" class="form-label">
            Nombre del Artículo <span class="text-danger">*</span>
          </label>
          <app-searchable-combobox
            name="newArticleName"
            inputId="newArticleName"
            inputName="newArticleName"
            [options]="newArticleNameOptions"
            placeholder="Escriba el nombre del artículo..."
            [uppercase]="true"
            [openOnFocus]="false"
            [statusField]="'status'"
            required
            #newArticleNameModel="ngModel"
            [class.is-invalid]="newArticleFormSubmitted && newArticleNameModel.invalid"
            [(ngModel)]="newArticle.description"
            (ngModelChange)="onArticleNameTyped($event)"
            (optionSelected)="onArticleSelected($event)">
          </app-searchable-combobox>
          <div class="invalid-feedback" *ngIf="newArticleFormSubmitted && newArticleNameModel.invalid">
            El nombre del artículo es obligatorio.
          </div>
          <div *ngIf="newArticleIsDuplicate"
               style="color:#b71c1c; font-size:12px; font-weight:600; margin-top:4px; display:flex; align-items:center; gap:4px;">
            <i class="bi bi-exclamation-circle-fill"></i>
            No puedes registrar este producto porque ya está registrado.
          </div>
        </div>
        <div class="mb-3">
          <label for="newArticleDesc" class="form-label">
            Descripción del Artículo <span class="text-danger">*</span>
          </label>
          <textarea
            class="form-control"
            id="newArticleDesc"
            name="newArticleDesc"
            rows="2"
            required
            #newArticleDescModel="ngModel"
            [class.is-invalid]="newArticleFormSubmitted && newArticleDescModel.invalid"
            [(ngModel)]="newArticle.descriptionNewArticle"
            (input)="newArticle.descriptionNewArticle = $any($event.target).value.toUpperCase()"
            style="text-transform: uppercase;"></textarea>
          <div class="invalid-feedback" *ngIf="newArticleFormSubmitted && newArticleDescModel.invalid">
            La descripción del artículo es obligatoria.
          </div>
        </div>
        <div class="mb-3">
          <label for="newArticleLink" class="form-label">Link del Artículo (Opcional)</label>
          <input
            type="text"
            class="form-control"
            id="newArticleLink"
            name="newArticleLink"
            [(ngModel)]="newArticle.urlNewArticle">
        </div>

        <!-- Categoría -->
        <div class="mb-3" [hidden]="true">
          <label for="newArticleCategory" class="form-label">
            Categoría <span class="text-danger">*</span>
          </label>
          <select
            class="form-control"
            id="newArticleCategory"
            name="newArticleCategory"
            required
            [(ngModel)]="newArticle.idCategory"
            (change)="onCategoryChange()">
            <option value="">Seleccionar categoría</option>
            <option *ngFor="let cat of categories" [value]="cat.id">
              {{ cat.description }}
            </option>
          </select>
        </div>

        <!-- Familia -->
        <div class="mb-3" [hidden]="true">
          <label for="newArticleFamily" class="form-label">
            Familia <span class="text-danger">*</span>
          </label>
          <select
            class="form-control"
            id="newArticleFamily"
            name="newArticleFamily"
            required
            [(ngModel)]="newArticle.idFamilia"
            (change)="onFamilyChange()">
            <option value="">Seleccionar familia</option>
            <option *ngFor="let fam of getFamiliesByCategory(newArticle.idCategory)" [value]="fam.id">
              {{ fam.description }}
            </option>
          </select>
        </div>

        <!-- Subfamilia -->
        <div class="mb-3" [hidden]="true">
          <label for="newArticleSubFamily" class="form-label">
            Subfamilia <span class="text-danger">*</span>
          </label>
          <select
            class="form-control"
            id="newArticleSubFamily"
            name="newArticleSubFamily"
            required
            [(ngModel)]="newArticle.idSubfamilia">
            <option value="">Seleccionar subfamilia</option>
            <option *ngFor="let subfam of getSubfamiliesByFamily(newArticle.idFamilia)" [value]="subfam.id">
              {{ subfam.description }}
            </option>
          </select>
        </div>

        <div class="mb-3">
          <label for="newArticleUsage" class="form-label">
            ¿Para qué se va a usar? <span class="text-danger">*</span>
          </label>
          <textarea
            class="form-control"
            id="newArticleUsage"
            name="newArticleUsage"
            rows="2"
            required
            #newArticleUsageModel="ngModel"
            [class.is-invalid]="newArticleFormSubmitted && newArticleUsageModel.invalid"
            [(ngModel)]="newArticle.justificationNewArticle"
            (input)="newArticle.justificationNewArticle = $any($event.target).value.toUpperCase()"
            style="text-transform: uppercase;"></textarea>
          <div class="invalid-feedback" *ngIf="newArticleFormSubmitted && newArticleUsageModel.invalid">
            Este campo es obligatorio.
          </div>
        </div>
      </form>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" (click)="closeNewArticleModal()">Salir</button>
        <button
          type="button"
          class="btn btn-primary"
          (click)="saveNewArticle()"
          [disabled]="!newArticle.description?.trim() || !newArticle.descriptionNewArticle?.trim() || !newArticle.justificationNewArticle?.trim() || newArticleIsDuplicate"
          [title]="(newArticleIsDuplicate ? '❌ Artículo duplicado - no se puede guardar' : '') + (!newArticle.description?.trim() ? 'Falta Nombre' : '') + (!newArticle.descriptionNewArticle?.trim() ? ' | Falta Descripción' : '') + (!newArticle.justificationNewArticle?.trim() ? ' | Falta Justificación' : '')">
          Guardar
        </button>
      </div>
    </ng-template>

    <!-- Multi-line editor component -->
    <app-multi-line-editor></app-multi-line-editor>

    <!-- PDF Report View -->
    <div class="report-detail-container" *ngIf="detailType === 'pdf'" style="padding: 15px; background-color: #ffffff; height: 100%; display: flex; flex-direction: column;">
      <div class="report-header d-flex justify-content-between align-items-center mb-3" style="flex-shrink: 0;">
        <h5 class="mb-0">Vista Previa - Requisición: {{ requisitionData?.requisitionNumber || 'Sin Número' }}</h5>
        <button type="button" class="btn btn-outline-secondary btn-sm" (click)="closeReport()">
          <i class="bi bi-x-lg"></i> Cerrar
        </button>
      </div>
      <div class="report-content" style="flex: 1; border: 1px solid #dee2e6; border-radius: 0.375rem; overflow: hidden;">
        <iframe
          *ngIf="pdfUrl"
          [src]="pdfUrl"
          style="width: 100%; height: 100%; border: none; border-radius: 0.375rem;">
        </iframe>
        <div *ngIf="!pdfUrl" class="d-flex justify-content-center align-items-center h-100">
          <div class="text-center">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Generando PDF...</span>
            </div>
            <p class="mt-3">Generando PDF...</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }

    .detail-unsaved {
      background-color: #fce4ec !important;
      color: black !important;
    }
  `]
})
export class DetallesRequisicionDelisonComponent implements OnInit, OnDestroy {

  private params!: any;
  private gridApi!: GridApi;
  private context: any;
  private ocAndReqsService = inject(OcAndReqsService);
  private materialsService = inject(MaterialsService);
  private signalsService = inject(SignalsService);
  private catalogsService = inject(CatalogsService);
  private modalService = inject(ModalService);
  private sanitizer = inject(DomSanitizer);
  private receiptsDelisonService = inject(ReceiptsDelisonService);
  private prefixSetupService = inject(PrefixSetupService);
  private itemCommentsService = inject(ItemCommentsService);
  private providersService = inject(ProvidersService);
  private sucursalByMaterialProveedorService = inject(SucursalByMaterialProveedorService);
  private customersService = inject(CustomersService);
  private ngbModal = inject(NgbModal);
  private rolesService = inject(RolesService);
  private commentSub?: Subscription;
  private sucursalSub?: Subscription;
  authService = inject(AuthService);
  canMultiguardar: boolean = false;
  // ✅ Controla si el usuario puede editar las columnas restringidas (Recurrente, Artículos,
  //    Cantidad Requerida, Proveedor, Prioridad) y borrar ítems de esta requisición.
  //    Cuando lectura_amplia = true, solo es true si el usuario tiene la combinación
  //    (sucursal, departamento) del REQ padre dada de alta en sus permisos.
  //    Cuando lectura_amplia = false, siempre true (el filtro del nivel 1 ya restringe la vista).
  canEditItemsInThisReq: boolean = true;
  // Tooltip
  private renderer: Renderer2;
  private tooltipElement: HTMLElement | null = null;

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  private localISOString(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
  }

  readonly actionMap: Record<string, () => void> = {
    'Req_Mul': () => this.saveMultiGuardar(),
  };

  readonly badgeMap: Record<string, () => boolean> = {
    'Req_Mul': () => this.hasPedimentoSelection,
  };

  get dynamicButtons(): any[] {
    return this.authService.getActiveSubDetailedByTipo('shoppingDelison', 'requisitions', 'Boton');
  }

  rowData: any[] = [];
  originalRowData: any[] = []; // Para poder deshacer cambios
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  isAddingNewItem: boolean = false;
  hasPedimentoSelection: boolean = false;
  hasRowSelected: boolean = false;
  hasProviderAssigned: boolean = false; // true = cotización con proveedor asignado → no eliminar
  materials: any[] = [];
  // Panel de Presentaciones (cajero) — disparado desde la celda Cantidad Requerida.
  validaPresentMap: Map<number, boolean> = new Map();
  panelOpen = false;
  panelMaterialId = 0;
  panelCantidad = 0;
  panelArticle = '';
  panelProviderNames: Map<number, string> | null = null;
  private panelRow: any = null;
  // Comentarios del panel pendientes de postear (al guardar): { materialId, texto }.
  private _deferredPanelComments: { materialId: number; texto: string }[] = [];
  frequentArticles: any[] = [];  // TOP 3 artículos más solicitados
  totalRequisitions: number = 0; // Total de requisiciones para calcular porcentajes
  private pedimentoCounter: number = 1;
  requisitionId: number = 0;
  currentBranchId: number = 0;
  idRoot: number | null = null;
  providersCache: Map<string, any[]> = new Map(); // Cache para proveedores por material+tipo

  // PDF properties
  detailType: string = 'items';
  requisitionData: any = null;
  pdfUrl: SafeResourceUrl | null = null;
  private originalPdfUrl: string | null = null;

  // Propiedades para el modal de nuevo artículo
  isNewArticleModalVisible = false;
  newArticleFormSubmitted = false;
  @ViewChild('newArticleModalTpl') newArticleModalTpl?: TemplateRef<unknown>;
  private newArticleModalRef: NgbModalRef | null = null;
  newArticle = {
    description: '',
    descriptionNewArticle: '',
    urlNewArticle: '',
    justificationNewArticle: '',
    idCategory: null as number | null,
    idFamilia: null as number | null,
    idSubfamilia: null as number | null
  };

  // Opciones para el combobox de "Nombre del Artículo" (se cargan desde materiales maestros)
  newArticleNameOptions: any[] = [];

  // Bandera para detectar duplicados
  newArticleIsDuplicate: boolean = false;

  // Catálogos para los selects
  categories: any[] = [];
  familias: any[] = [];
  subfamilias: any[] = [];
  filteredFamilias: any[] = [];
  filteredSubfamilias: any[] = [];
  private currentRowForNewArticle: any = null;
  private originalRecurrentValue: string | null = null;




  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    this.commentSub = this.itemCommentsService.commentSaved$.subscribe(async () => {
      // Actualizar la fecha de modificación del maestro para que se reordene en el padre
      try {
        const maestro: any = await firstValueFrom(this.ocAndReqsService.getDetailedReq(this.requisitionId));
        await firstValueFrom(this.ocAndReqsService.updateOcAndReq(this.requisitionId, {
          ...maestro,
          dateModified: this.localISOString()
        }));
      } catch { /* no bloquear el flujo */ }

      this.loadData();
      this.refreshParentGridAfterSave();
    });

    // ✅ Sincronización en tiempo real:
    // Si se modifican autorizaciones en el maestro, limpiar el caché local
    this.sucursalSub = this.sucursalByMaterialProveedorService.sucursalSaved$.subscribe(() => {
      this.providersCache.clear();
      // Si hay un grid activo, forzar el refresco de las celdas de proveedores
      if (this.gridApi) {
        this.gridApi.refreshCells({ columns: ['idProvider'], force: true });
      }
    });
  }

  agInit(params: any): void {
    this.params = params;
    this.context = params.context;
    this.requisitionData = params.data;
    this.detailType = params.data.detailType || 'items';
    this.hasProviderAssigned = params.data?.locked === true;
    this.currentBranchId = params.data?.idReference || 0;

    if (this.detailType === 'items') {
      this.loadMaterials();
      this.loadData();
      this.loadCatalogs();
      this.loadCanMultiguardar();
      this.loadCanEditItems();
    } else if (this.detailType === 'pdf') {
      this.generatePDF();
    }
  }

  /**
   * Determina si el usuario puede editar columnas restringidas y borrar ítems de esta requisición.
   * Regla:
   *  - lectura_amplia = false → siempre true (el filtro del nivel 1 ya garantiza que solo ve sus reqs).
   *  - lectura_amplia = true  → true sólo si tiene la combinación (idReference, departmentId) del padre
   *                              dada de alta en sus permisos (permissionBydescription).
   */
  private loadCanEditItems(): void {
    const lecturaAmplia = this.signalsService.lecturaAmplia();
    if (!lecturaAmplia) {
      this.canEditItemsInThisReq = true;
      return;
    }
    const idUser = this.signalsService.idUser();
    const idBranch = Number(this.params?.data?.idReference || 0);
    const idDept = Number(this.params?.data?.departmentId || 0);
    if (!idUser || idBranch <= 0 || idDept <= 0) {
      // Sin datos suficientes para validar: por seguridad, no autorizar.
      this.canEditItemsInThisReq = false;
      this.refreshRestrictedColumns();
      return;
    }
    this.rolesService.getRolesByBranchDelison(idUser, idBranch).subscribe({
      next: (roles: any[]) => {
        const arr = Array.isArray(roles) ? roles : [];
        this.canEditItemsInThisReq = arr.some((r: any) => Number(r?.id || 0) === idDept);
        this.refreshRestrictedColumns();
      },
      error: () => {
        this.canEditItemsInThisReq = false;
        this.refreshRestrictedColumns();
      }
    });
  }

  /** Re-pinta las 5 columnas restringidas para que cambien estilo/edición cuando el flag se resuelve. */
  private refreshRestrictedColumns(): void {
    if (!this.gridApi) return;
    this.gridApi.refreshCells({
      force: true,
      columns: ['recurrent', 'article', 'quantity', 'intorext', 'typePriority']
    });
  }

  private loadCanMultiguardar(): void {
    const idUser = this.signalsService.idUser();
    if (!idUser) return;
    this.rolesService.canUserMultiguardar(idUser).subscribe({
      next: (response: any) => {
        this.canMultiguardar = response?.data === true;
        if (this.gridApi) {
          this.gridApi.setColumnVisible('compraRapida', this.canMultiguardar);
          this.gridApi.setColumnVisible('pedimiento', this.canMultiguardar);
          this.gridApi.setColumnVisible('pedimentoNumber', this.canMultiguardar);
        }
      },
      error: () => { this.canMultiguardar = false; }
    });
  }

  loadData() {
    if (!this.params || !this.params.data) {
      console.warn('⚠️ No hay params disponibles para cargar items');
      return;
    }

    this.requisitionId = this.params.data.id;

    // ✅ Cargar artículos frecuentes para recomendaciones
    this.loadFrequentArticles();



    // ✅ Llamar al servicio real
    this.ocAndReqsService.getReqItems(this.requisitionId).subscribe({
      next: (data: any) => {


        // Mapear los datos del servidor al formato del grid
        this.rowData = Array.isArray(data) ? data.map((item: any) => ({
          id: item.id,
          idRequisition: item.idMovement, // El servidor usa idMovement
          idSupplie: item.idSupplie,
          materialId: item.idSupplie, // Para el editor de materiales
          article: item.description || '', // Usar description como article
          code: item.code || '',
          intorext: item.intorext || 'Interno',
          description: item.description || '',
          measure: item.measure || '',
          quantity: item.quantity || 0,
          price: item.price || 0,
          total: item.total || 0,
          type: item.type || 'REQUIS',
          idProvider: item.idProvider || 0,
          nameProvider: item.nameProvider || '',
          comment: item.comment || '',
          dateuse: item.dateuse || this.localISOString(),
          active: item.active !== undefined ? item.active : true,
          recurrent: item.recurrent || 'Recurrente', // Por defecto recurrente
          nameArticle: item.namearticle || item.nameArticle || '',
          numArticle: item.numarticle || item.numArticle || '',
          provint: item.provint || '',
          idProveedorSugerido: item.idProveedorSugerido ?? null, // proveedor sugerido por el panel
          typePriority: item.typePriority || 'Normal',
          pedimiento: item.pedimento || false, // ✅ Cargar desde backend, siempre debe ser false después de Multiguardar
          pedimentoNumber: item.pedimentoNum || '', // ✅ String con números separados por coma (ej: "1,3,4,6")
          descriptionNewArticle: item.descriptionNewArticle || '', // Descripción del artículo nuevo
          urlNewArticle: item.urlNewArticle || '', // URL/Link del artículo nuevo
          justificationNewArticle: item.justificationNewArticle || '', // Justificación del artículo nuevo
          typeOC: item.typeoc || item.typeOC || '',
          compraRapida: item.compraRapida === true,
          __isNew: false,
          __modified: false,
          saved: true
        })) : [];

        this.originalRowData = JSON.parse(JSON.stringify(this.rowData));

        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
          this.gridApi.redrawRows();
        }




        // Pre-cargar proveedores para todos los items que tienen material
        this.rowData.forEach(item => {
          const materialId = item.idSupplie || item.materialId || 0;
          const type = item.intorext || 'Externo';
          if (materialId > 0) {
            this.loadProviders(materialId, type);
          }
        });

        // ❌ NO actualizar el contador - ya viene del servidor con countrow
        // El contador articlesCount ya está correcto desde loadRequisitions()

        // ✅ Verificar estado locked fresco desde el servidor
        this.ocAndReqsService.getDetailedReq(this.requisitionId).subscribe({
          next: (req: any) => {
            this.hasProviderAssigned = req?.locked === true;
          },
          error: () => { } // silencioso
        });

        // Opción 3: postear los comentarios del panel ya con la fila recargada (numArticle real).
        this.postDeferredPanelComments();
      },
      error: (error) => {
        console.error('❌ Error al cargar items:', error);
        this.rowData = [];
        this.originalRowData = [];

        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', []);
        }
      }
    });
  }

  loadMaterials() {
    // Obtener idRoot desde el signal service
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();

    if (!this.idRoot) {

      this.materials = [];
      return;
    }



    // Cargar materiales desde el endpoint real
    this.materialsService.getMaterialsxview(this.idRoot).subscribe({
      next: (data) => {
        // Mapear los datos del endpoint al formato esperado por el SearchableSelect
        this.materials = data
          .filter(material => material.active) // Solo materiales activos
          .map(material => ({
            id: material.id,
            description: material.articulo,  // Nombre del artículo
            code: material.insumo,            // Código/número de material
            measure: material.measure || '',
            active: material.active,
            validaPresentaciones: !!(material as any).validaPresentaciones, // dispara el panel de presentaciones
            // Campos adicionales que podrían ser útiles
            idCategory: material.idCategory,
            idFamilia: material.idFamilia,
            idSubfamilia: material.idSubfamilia
          }));
        // Mapa rápido idMaterial → valida_presentaciones (para el botón del panel en Cantidad).
        this.validaPresentMap = new Map(this.materials.map((m: any) => [m.id, !!m.validaPresentaciones]));

        // Cargar opciones para el combobox "Nombre del Artículo" en el modal
        // Incluye activos e inactivos para detectar duplicados en cualquier caso
        this.newArticleNameOptions = data
          .filter((material: any) => material.articulo?.trim())
          .sort((a: any, b: any) => (a.articulo || '').localeCompare(b.articulo || ''))
          .map((material: any) => ({
            description: material.articulo,
            status: material.active ? 'Activo' : 'Inactivo'
          }));

      },
      error: (error) => {
        console.error('❌ Error al cargar materiales:', error);
        alerts.reqErrorToast('Error', 'No se pudieron cargar los materiales');
        this.materials = [];
        this.newArticleNameOptions = [];
      }
    });
  }

  async loadProviders(materialId: number, type?: string): Promise<any[]> {
    const cacheKey = `${materialId}`;

    // Verificar si ya están en caché
    if (this.providersCache.has(cacheKey)) {
      return this.providersCache.get(cacheKey)!;
    }

    try {

      // 1. Obtener datos maestros (Nombres y Tipos) de proveedores
      const [allProvidersRaw, warehouseProviders]: any = await Promise.all([
        firstValueFrom(this.customersService.getCustomersByCompany(this.idRoot || 0, 'PROVIDERS')),
        firstValueFrom(this.materialsService.getProvidersxmaterials(this.idRoot || 0)).catch(() => [])
      ]);

      // Mapa para búsqueda rápida de datos maestros
      const providerDataMap = new Map<number, { name: string, type: string }>();

      // Llenar mapa con nombres desde CustomersService
      (allProvidersRaw || []).forEach((p: any) => {
        const name = p.name || p.company || p.description || `Proveedor ${p.id}`;
        providerDataMap.set(p.id, { name, type: 'Externo' }); // Default Externo
      });

      // Actualizar tipos desde Warehouse
      (warehouseProviders || []).forEach((wp: any) => {
        if (wp.id && wp.typeIntOrExt) {
          const existing = providerDataMap.get(wp.id);
          if (existing) {
            existing.type = wp.typeIntOrExt;
          } else {
            providerDataMap.set(wp.id, { name: wp.company || `Proveedor ${wp.id}`, type: wp.typeIntOrExt });
          }
        }
      });

      // 2. Obtener las relaciones Maestro-Proveedor (ProveedorXTabla) para este material
      const relations: any = await firstValueFrom(
        this.providersService.getMaterXTable(materialId, 'MATERIAL')
      );


      if (!Array.isArray(relations)) return [];

      const validatedProviders = [];

      // 3. Validar cada relación contra la sucursal de la requisición (currentBranchId)
      for (const rel of relations) {
        try {
          const providerId = rel.idTabla;
          const masterData = providerDataMap.get(providerId);

          const realName = masterData?.name || rel.providerName || `Proveedor ${providerId}`;
          const realType = masterData?.type || rel.typeIntOrExt || 'Externo';


          // Consultar sucursales autorizadas para esta relación específica
          const authBranches = await firstValueFrom(
            this.sucursalByMaterialProveedorService.getSucursalByMaterial(rel.id)
          );

          // 4. EL FILTRO DE TRES NIVELES:
          const isAuthorized = Array.isArray(authBranches) && authBranches.some(branch => {
            const match = Number(branch.idSucursal) === Number(this.currentBranchId) &&
              (branch.vigente === true || branch.vigente === 1);
            return match;
          });

          if (isAuthorized) {
            const providerObj = {
              idProvider: providerId,
              providerName: realName,
              typeIntOrExt: realType
            };
            validatedProviders.push(providerObj);
          }
        } catch (e) {
          console.warn(`Error validando sucursales para relación ${rel.id}:`, e);
        }
      }

      this.providersCache.set(cacheKey, validatedProviders);
      return validatedProviders;
    } catch (error) {
      console.error('❌ Error al cargar y validar proveedores:', error);
      return [];
    }
  }

  private loadFrequentArticles() {
    if (!this.params?.data) return;

    const solicit = this.params.data.solicitedBy || '';  // Nombre del usuario que solicita
    const idDepartment = this.params.data.departmentId || 0;  // ID del departamento
    const idBranch = this.params.data.idReference || 0;  // ID de la sucursal

    if (!solicit || idDepartment <= 0 || idBranch <= 0) {
      this.frequentArticles = [];
      this.totalRequisitions = 0;
      return;
    }

    this.ocAndReqsService.getFrequentArticles(solicit, idDepartment, idBranch).subscribe({
      next: (response: any) => {
        // Manejar la nueva estructura con articles y totalRequisitions
        if (response?.articles) {
          this.frequentArticles = Array.isArray(response.articles) ? response.articles : [];
          this.totalRequisitions = response.totalRequisitions || 0;
        } else if (Array.isArray(response)) {
          // Fallback si el servidor devuelve array plano
          this.frequentArticles = response;
          this.totalRequisitions = 0;
        }
      },
      error: (error) => {
        console.warn('⚠️ Error cargando artículos frecuentes:', error);
        this.frequentArticles = [];
        this.totalRequisitions = 0;
      }
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    // Dejar el layout estable: ajustar columnas al ancho disponible
    setTimeout(() => this.autoAdjustColumns(), 0);

    // Limpiar tooltip al hacer scroll
    setTimeout(() => {
      const gridElement = (params as any).eGridDiv || document.querySelector('.ag-body-viewport');
      if (gridElement) {
        const viewport = gridElement.querySelector?.('.ag-body-viewport') || gridElement;
        viewport.addEventListener('scroll', () => this.hideNewArticleTooltip());
      }
    }, 100);
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.autoAdjustColumns();
  }

  private autoAdjustColumns(): void {
    if (!this.gridApi) return;
    this.gridApi.autoSizeAllColumns();
  }

  private _colDefs: ColDef[] = [];

  get colDefs(): ColDef[] {
    if (this._colDefs.length > 0) {
      return this._colDefs;
    }

    this._colDefs = [
      {
        headerName: '#',
        minWidth: 55,
        maxWidth: 70,
        flex: 0,
        suppressSizeToFit: true,
        valueGetter: (params) => params.node.rowIndex + 1,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
      },

      {
        field: 'recurrent',
        headerName: 'Recurrente',
        width: 110,
        suppressSizeToFit: true,
        // ✅ Bloqueada cuando el usuario no tiene la combinación (sucursal, depto) del REQ padre.
        editable: (params: any) => params.data?.__isNew || this.canEditItemsInThisReq,
        cellStyle: (params: any) => (params.data?.__isNew || this.canEditItemsInThisReq)
          ? null : { backgroundColor: '#f0f0f0' },
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Recurrente', 'Nuevo']
        },
      },

      {
        field: 'article',
        headerName: 'Articulos',
        minWidth: 260,
        flex: 1,
        wrapText: true,
        cellDataType: false, // Desactivar auto-detección de tipo
        editable: (params) => {
          // Solo es editable con SelectWithTooltipEditorV2 si es "Recurrente"
          // ✅ Y solo si el usuario tiene la combinación (sucursal, depto) del REQ padre.
          if (!(params.data?.__isNew || this.canEditItemsInThisReq)) return false;
          return params.data.recurrent !== 'Nuevo';
        },
        cellEditor: SelectWithTooltipEditorV2Component,
        cellRenderer: (params: any) => {
          const value = params.value || params.data?.nameArticle || '';
          const container = document.createElement('div');
          container.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center;';
          container.textContent = value;

          // Solo mostrar tooltip si es artículo "Nuevo" y tiene datos adicionales
          if (params.data?.recurrent === 'Nuevo') {
            container.style.cursor = 'pointer';

            container.addEventListener('mouseenter', (e) => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              this.showNewArticleTooltip(params.data, rect);
            });

            container.addEventListener('mouseleave', () => {
              this.hideNewArticleTooltip();
            });
          }

          return container;
        },
        cellEditorParams: (params: any) => {
          // ✅ Filtrar materiales que ya están siendo usados en otras filas
          // Considerar tanto materialId como idSupplie (pueden venir del servidor con idSupplie)
          const usedMaterialIds = this.rowData
            .filter(row =>
              row.id !== params.data.id && // Excluir la fila actual
              (row.materialId || row.idSupplie) && // Solo filas con material asignado
              (row.materialId > 0 || row.idSupplie > 0) // Excluir artículos nuevos (idSupplie = 0)
            )
            .map(row => row.materialId || row.idSupplie);

          const availableMaterials = this.materials.filter(
            m => !usedMaterialIds.includes(m.id)
          );

          // ✅ Crear mapping de artículos frecuentes por índice (0=Más solicitado, 1-2=recomendados)
          const frequentMap: { [key: number]: number } = {};
          this.frequentArticles.forEach((freq, index) => {
            frequentMap[freq.idSupplie] = index;
          });

          return {
            showAbbreviation: false,
            options: (() => {
              // Separar artículos frecuentes de los no frecuentes
              const frequentMaterials = availableMaterials
                .filter(m => frequentMap[m.id] !== undefined)
                .sort((a, b) => (frequentMap[a.id] ?? 999) - (frequentMap[b.id] ?? 999));

              const nonFrequentMaterials = availableMaterials
                .filter(m => frequentMap[m.id] === undefined);

              // Concatenar frecuentes primero, luego no frecuentes
              const sortedMaterials = [...frequentMaterials, ...nonFrequentMaterials];

              return sortedMaterials.map(m => {
                let description = m.description;
                const frequentIndex = frequentMap[m.id];

                // Calcular porcentaje para artículos frecuentes
                if (frequentIndex !== undefined && this.totalRequisitions > 0) {
                  const frequentArticle = this.frequentArticles[frequentIndex];
                  const percentage = Math.round((frequentArticle.countRequested / this.totalRequisitions) * 100);
                  description = `⭐ ${m.description} (${percentage}%)`;
                }

                return {
                  id: m.id,
                  description: description,
                  valueAddition: m.code || '',
                  valueAddition2: m.measure || ''
                };
              });
            })()
          };
        },
        valueFormatter: (params: any) => {
          // Si idSupplie es 0, mostrar nameArticle (artículo nuevo)
          if (params?.data?.idSupplie === 0 && params?.data?.nameArticle) {
            return params.data.nameArticle;
          }
          // Preferir el nombre guardado en la fila si existe
          if (params?.data?.article) return params.data.article;
          const material = this.materials?.find(m => m.id === params.value);
          return material ? material.description : (params.value ?? '');
        },
        valueSetter: (params: any) => {
          let newValue = params.newValue;

          // SelectWithTooltipEditorV2 devuelve el ID del material seleccionado
          const selectedMaterial = this.materials?.find(m => m.id === newValue);
          if (selectedMaterial) {
            params.data.materialId = selectedMaterial.id;
            params.data.idSupplie = selectedMaterial.id; // Para compatibilidad con el servidor
            params.data.article = selectedMaterial.description;
            params.data.nameArticle = selectedMaterial.description; // Guardar nombre en nameArticle
            params.data.code = selectedMaterial.code || '';
            params.data.description = selectedMaterial.description;
            params.data.measure = selectedMaterial.measure || '';
            // ✅ CAMBIO 1: Actualizar # del artículo con el num-mat (código)
            params.data.numArticle = selectedMaterial.code || '';

            // Limpiar el proveedor cuando cambia el material
            params.data.idProvider = 0;
            params.data.nameProvider = '';

            params.data.__modified = true;
            this.hasUnsavedChanges = true;

            // Pre-cargar proveedores para el nuevo material
            const type = params.data.intorext || 'Externo';
            this.loadProviders(selectedMaterial.id, type).then(() => {
            });

            // Refrescar las celdas para mostrar el articleNumber actualizado y limpiar proveedor.
            // Incluye 'quantity' para que el icono 🧮 (panel de presentaciones) aparezca de inmediato
            // si el material recién seleccionado tiene el flag valida_presentaciones.
            this.gridApi.refreshCells({
              rowNodes: [params.node],
              columns: ['articleNumber', 'idProvider', 'quantity'],
              force: true
            });

            return true;
          }

          return false;
        },
        onCellClicked: (params: any) => {
          // Si el valor de "Recurrente" es "Nuevo", abrir el modal de nuevo artículo
          if (params.data.recurrent === 'Nuevo') {
            this.currentRowForNewArticle = params.node;
            this.newArticle = {
              description: params.data.nameArticle || '',
              descriptionNewArticle: params.data.descriptionNewArticle || '',
              urlNewArticle: params.data.urlNewArticle || '',
              justificationNewArticle: params.data.justificationNewArticle || '',
              idCategory: params.data.idCategory || null,
              idFamilia: params.data.idFamilia || null,
              idSubfamilia: params.data.idSubfamilia || null
            };
            // Si no hay valores cargados, establecer valores por defecto
            if (!this.newArticle.idCategory && !this.newArticle.idFamilia && !this.newArticle.idSubfamilia) {
              this.setDefaultCatalogValues();
            }
            this.openNewArticleModal();
          }
        },
        cellStyle: (params: any) => {
          // ✅ Bloqueo por permiso: gris cuando no se puede editar (sin combinación sucursal+depto del REQ padre).
          if (!(params.data?.__isNew || this.canEditItemsInThisReq)) {
            return { backgroundColor: '#f0f0f0' };
          }
          if (!params.value && !params?.data?.article) {
            return { backgroundColor: '#f9f9f9', color: '#777' };
          }
          // Si es "Nuevo", mostrar cursor pointer para indicar que es clickeable
          if (params.data.recurrent === 'Nuevo') {
            return { cursor: 'pointer', backgroundColor: '#fff9e6' };
          }
          return null;
        },
        suppressMovable: true,
        filter: true,
        filterParams: {
          defaultToNothingSelected: true
        }
      },
      {
        field: 'numArticle',
        headerName: '# del Articulo',
        width: 140,
        suppressSizeToFit: true,
        editable: false,
        cellStyle: { textAlign: 'left' },
        valueSetter: (params: any) => {
          params.data.numArticle = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'quantity',
        headerName: 'Cantidad Requerida',
        width: 120,
        suppressSizeToFit: true,
        // ✅ Bloqueada cuando el usuario no tiene la combinación (sucursal, depto) del REQ padre.
        editable: (params: any) => params.data?.__isNew || this.canEditItemsInThisReq,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        // Para materiales con flag valida_presentaciones: muestra un botón 🧮 que abre el panel.
        cellRenderer: (params: any) => {
          const idMat = params.data?.materialId ?? params.data?.idSupplie;
          const hasFlag = !!(idMat && this.validaPresentMap?.get(Number(idMat)));
          const wrap = document.createElement('div');
          wrap.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;gap:6px;height:100%;';
          const val = document.createElement('span');
          val.textContent = (params.value === null || params.value === undefined || params.value === '') ? '' : String(params.value);
          wrap.appendChild(val);
          if (hasFlag) {
            const btn = document.createElement('button');
            btn.textContent = '🧮';
            btn.title = 'Armar cantidad con presentaciones';
            btn.style.cssText = 'border:none;background:#e3f2fd;color:#1565c0;border-radius:4px;cursor:pointer;padding:0 6px;line-height:18px;';
            btn.addEventListener('click', (e) => { e.stopPropagation(); this.openPresentacionesPanel(params.data); });
            wrap.appendChild(btn);
          }
          return wrap;
        },
        cellStyle: (params: any) => {
          const base: any = { textAlign: 'right' };
          if (!(params.data?.__isNew || this.canEditItemsInThisReq)) {
            base.backgroundColor = '#f0f0f0';
          }
          const idMat = params.data?.materialId ?? params.data?.idSupplie;
          if (idMat && this.validaPresentMap?.get(Number(idMat))) {
            base.backgroundColor = '#e8f5e9';   // verde suave: usa panel de presentaciones
          }
          return base;
        },
        cellEditorParams: {
          min: 0,
          precision: 3
        },
        suppressKeyboardEvent: (params: any) => {
          const event = params.event as KeyboardEvent;
          const key = event.key;

          // Permitir teclas de control: Backspace, Delete, Tab, Enter, Escape, flechas
          if (['Backspace', 'Delete', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) {
            return false; // No suprimir, permitir
          }

          // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
          if (event.ctrlKey || event.metaKey) {
            return false;
          }

          // Permitir números (0-9)
          if (/^[0-9]$/.test(key)) {
            return false;
          }

          // Permitir punto decimal (solo uno)
          if (key === '.') {
            const currentValue = params.node.data.quantity?.toString() || '';
            if (!currentValue.includes('.')) {
              return false; // Permitir si no hay punto aún
            }
            return true; // Suprimir si ya hay punto
          }

          // Suprimir cualquier otra tecla
          return true;
        }
      },
      {
        field: 'intorext',
        headerName: 'Proveedor',
        width: 110,
        suppressSizeToFit: true,
        editable: (params) => {
          // ✅ Bloqueada cuando el usuario no tiene la combinación (sucursal, depto) del REQ padre.
          if (!(params.data?.__isNew || this.canEditItemsInThisReq)) return false;
          return params.data.recurrent !== 'Nuevo';
        },
        cellStyle: (params: any) => (params.data?.__isNew || this.canEditItemsInThisReq)
          ? null : { backgroundColor: '#f0f0f0' },
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Externo', 'Interno'] // ✅ CAMBIO 2: Externo primero para que sea el default
        },
        valueSetter: (params: any) => {
          const oldValue = params.data.intorext;
          params.data.intorext = params.newValue;

          // Si cambió el tipo, limpiar el proveedor y recargar la lista
          if (oldValue !== params.newValue) {
            params.data.idProvider = 0;
            params.data.nameProvider = '';
            params.data.__modified = true;
            this.hasUnsavedChanges = true;

            // Pre-cargar proveedores para el nuevo tipo
            const materialId = params.data.idSupplie || params.data.materialId || 0;
            if (materialId > 0) {
              this.loadProviders(materialId, params.newValue).then(() => {
              });
            }

            // Refrescar la columna de proveedores para actualizar la lista
            this.gridApi.refreshCells({
              rowNodes: [params.node],
              columns: ['idProvider'],
              force: true
            });
          }

          return true;
        }
      },

      {
        field: 'idProvider',
        headerName: 'Proveedor Interno',
        width: 139,
        wrapHeaderText: true,
        autoHeaderHeight: true,
        editable: (params) => {
          // Solo editable si hay un material seleccionado Y el tipo es "Interno"
          const materialId = params.data.idSupplie || params.data.materialId || 0;
          const tipo = params.data.intorext || 'Externo';
          return materialId > 0 && tipo === 'Interno';
        },
        cellDataType: false,
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: (params: any) => {
          const materialId = params.data.idSupplie || params.data.materialId || 0;
          const type = params.data.intorext || 'Externo';

          if (materialId === 0) {
            console.warn('⚠️ No hay material seleccionado, no se pueden cargar proveedores');
            return { options: [] };
          }

          // Buscar proveedores en el caché (clave solo por material)
          const providers = this.providersCache.get(`${materialId}`) || [];

          // FILTRAR: Solo mostrar proveedores que sean typeIntOrExt === 'Interno'
          const filteredProviders = providers.filter(p => p.typeIntOrExt === 'Interno');

          return {
            options: filteredProviders.map(p => {
              const dashIdx = (p.providerName || '').indexOf(' - ');
              const display = dashIdx !== -1
                ? p.providerName.substring(dashIdx + 3).trim()
                : (p.providerName || '').trim();
              return { id: p.idProvider, description: display };
            })
          };
        },
        onCellClicked: async (params: any) => {
          // Pre-cargar proveedores cuando se hace clic en la celda
          const materialId = params.data.idSupplie || params.data.materialId || 0;
          const type = params.data.intorext || 'Externo';

          if (materialId > 0) {
            await this.loadProviders(materialId, type);
          }
        },
        valueFormatter: (params: any) => {
          // Mostrar el nombre del proveedor guardado en nameProvider
          if (params?.data?.nameProvider) {
            return params.data.nameProvider;
          }
          return params.value || '';
        },
        valueSetter: (params: any) => {
          const newValue = params.newValue;

          // SelectWithTooltipEditorV2 devuelve el ID del proveedor seleccionado
          if (newValue && typeof newValue === 'number') {
            params.data.idProvider = newValue;

            // Buscar el nombre del proveedor en la caché
            const materialId = params.data.idSupplie || params.data.materialId || 0;
            const cacheKey = `${materialId}`;

            if (this.providersCache.has(cacheKey)) {
              const providers = this.providersCache.get(cacheKey)!;
              const selectedProvider = providers.find(p => p.idProvider === newValue);
              if (selectedProvider) {
                const dashIdx = (selectedProvider.providerName || '').indexOf(' - ');
                params.data.nameProvider = dashIdx !== -1
                  ? selectedProvider.providerName.substring(dashIdx + 3).trim()
                  : (selectedProvider.providerName || '').trim();
              }
            }

            params.data.__modified = true;
            this.hasUnsavedChanges = true;
            return true;
          }

          return false;
        },
        cellStyle: (params: any) => {
          const materialId = params.data.idSupplie || params.data.materialId || 0;
          const tipo = params.data.intorext || 'Externo';
          // Bloqueado si no hay material o si el tipo es "Externo"
          if (materialId === 0 || tipo === 'Externo') {
            return { backgroundColor: '#f9f9f9', color: '#999', cursor: 'not-allowed' };
          }
          return { cursor: 'pointer' };
        }
      },

      {
        field: 'typePriority',
        headerName: 'Prioridad',
        width: 135,
        // ✅ Bloqueada cuando el usuario no tiene la combinación (sucursal, depto) del REQ padre.
        editable: (params: any) => params.data?.__isNew || this.canEditItemsInThisReq,
        cellStyle: (params: any) => (params.data?.__isNew || this.canEditItemsInThisReq)
          ? null : { backgroundColor: '#f0f0f0' },
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Normal', 'Urgente']
        },
      },

      /* {
         field: 'comment',
         headerName: 'Observaciones',
         width: 100,
         hide: !this.authService.hasSubDetailedPermission('shoppingDelison', 'requisitions', 'Req_Obs'),
         editable: true,
         // ✅ CAMBIO 3: Usar MultiLineEditor para comentarios
         onCellClicked: (params: any) => {
           if (params.event.target.classList.contains('ag-cell')) {
             this.modalService.showModal({ params });
           }
         },
         valueSetter: (params: any) => {
           params.data.comment = params.newValue ? params.newValue.toUpperCase() : '';
 
           return true;
         },
         cellStyle: { cursor: 'pointer', backgroundColor: '#f0f8ff' }
       },*/

      {
        headerName: 'Comentarios💬',
        width: 165,
        sortable: false,
        filter: false,
        cellRenderer: ItemCommentsCellRendererComponent,
        cellRendererParams: (params: any) => ({
          documentType: 'REQ',
          idDocument: this.requisitionId,
          numArticle: params.data?.numArticle || (!params.data?.__isNew && params.data?.idSupplie ? `SUPP-${params.data.idSupplie}` : ''),
          locked: !!params.data?.__isNew
        }),
      },

      {
        field: 'compraRapida',
        headerName: 'Compra Rapida',
        width: 110,
        wrapHeaderText: true,
        autoHeaderHeight: true,
        suppressSizeToFit: true,
        hide: true,
        editable: false,
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
        cellRenderer: (params: any) => {
          const isInterno = (params.data.intorext || '').toLowerCase() === 'interno';
          const hasPedimentoNumber = !!params.data.pedimentoNumber;
          const isDisabled = isInterno || hasPedimentoNumber;
          if (isDisabled && params.data.compraRapida) {
            params.data.compraRapida = false;
          }
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = isDisabled ? false : params.value === true;
          input.disabled = isDisabled;
          input.style.width = '16px';
          input.style.height = '16px';
          input.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
          input.style.opacity = isDisabled ? '0.4' : '1';
          input.title = isInterno ? 'No disponible para Proveedor Interno' : hasPedimentoNumber ? 'No disponible cuando hay número de pedimento asignado' : '';
          input.addEventListener('change', async () => {
            // Bloqueo: no permitir DESMARCAR si la compra rápida ya tiene entradas en almacén.
            if (!input.checked && params.data.id) {
              const hasEntradas = await firstValueFrom(
                this.ocAndReqsService.compraRapidaHasEntradas(params.data.id)
              ).catch(() => false);
              if (hasEntradas) {
                input.checked = true; // revertir
                alerts.reqWarningToast(
                  'No permitido',
                  'Este artículo ya tiene entradas en almacén, elimine estas si requiere borrar o desmarcar el artículo'
                );
                return;
              }
            }
            params.data.compraRapida = input.checked;
            if (input.checked) {
              params.data.pedimiento = false;
            }
            params.data.__modified = true;
            this.hasUnsavedChanges = true;
            params.api.refreshCells({ rowNodes: [params.node], columns: ['compraRapida', 'pedimiento'] });
            this.checkPedimentoSelection();
          });
          return input;
        }
      },

      {
        field: 'pedimiento',
        headerName: 'Pedimento',
        width: 112,
        suppressSizeToFit: true,
        // hide: !this.authService.hasSubDetailedPermission('shoppingDelison', 'requisitions', 'Req_Ped'),
        hide: true,
        editable: true,
        cellRenderer: (params: any) => {
          const isInterno = (params.data.intorext || '').toLowerCase() === 'interno';
          const isCompraRapida = params.data.compraRapida === true;
          const isDisabled = isInterno || isCompraRapida;

          // Forzar apagado si es Interno o Compra Rapida
          if (isDisabled && params.data.pedimiento) {
            params.data.pedimiento = false;
          }

          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = isDisabled ? false : params.value === true;
          input.disabled = isDisabled;
          input.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
          input.style.opacity = isDisabled ? '0.4' : '1';
          input.title = isInterno ? 'No disponible para Proveedor Interno' : isCompraRapida ? 'No disponible cuando Compra Rapida está activa' : '';

          input.addEventListener('change', () => {
            params.data.pedimiento = input.checked;
            params.api.refreshCells({ rowNodes: [params.node], columns: ['pedimiento'] });
            this.checkPedimentoSelection();
          });

          return input;
        }
      },

      {
        field: 'pedimentoNumber',
        headerName: 'Pedimento #',
        // hide: !this.authService.hasSubDetailedPermission('shoppingDelison', 'requisitions', 'Req_PeN'),
        hide: true,
        width: 110,
        suppressSizeToFit: true,
        editable: false,
        cellRenderer: (params: any) => {
          if (!params.value) {
            return ''; // Si no hay valor, la celda estará vacía.
          }

          const numbers = String(params.value).split(',');
          const colorMap: { [key: string]: string } = {
            '1': '#0d6efd', // Azul
            '2': '#198754', // Verde
            '3': '#6f42c1', // Púrpura
          };

          const coloredSpans = numbers.map(num => {
            const color = colorMap[num.trim()] || 'black'; // Color por defecto si no está en el mapa
            return `<span style="color: ${color}; font-weight: bold; padding: 0 2px;">${num.trim()}</span>`;
          }).join(',');

          return coloredSpans;
        }
      },

    ];

    return this._colDefs;
  }

  checkPedimentoSelection() {
    const anyChecked = this.rowData.some(item => item.pedimiento === true && !item.compraRapida);
    this.hasPedimentoSelection = anyChecked;
  }

  private refreshParentGridAfterSave(): void {
    // Recargar grilla padre para reordenar la requisición al tope
    // Con getRowId implementado, AG Grid mantiene el estado de expansión
    if (this.context?.reloadParentGrid) {
      this.context.reloadParentGrid();
    }
  }

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    animateRows: true,
    // Evita columnas “mini” cuando hay pocas filas: repartir al ancho del grid
    autoSizeStrategy: {
      type: 'fitCellContents',
    },
    rowSelection: 'multiple',
    getRowId: (params: any) => String(params.data.id),
    singleClickEdit: false, // Doble-click para editar (como tipo-proveedor)
    domLayout: 'normal', // El grid se ajusta al contenedor y permite scroll
    suppressHorizontalScroll: false,
    onFirstDataRendered: () => {
      this.autoAdjustColumns();
    },
    getRowClass: (params: any) => {
      // Si la fila ya tiene un número de pedimento, no la pintes de rosa.
      if (params.data && params.data.pedimentoNumber) {
        return ''; // Sin clase especial
      }
      return 'detail-purchase-row'; // Fila pendiente, color rosa
    }
  };

  components = {
    // No se necesita registrar SelectWithTooltipEditorV2Component aquí
    // porque se pasa directamente como clase en cellEditor
  };

  addItem() {
    const tempId = `temp_item_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      article: '',
      quantity: 1,
      recurrent: 'Recurrente',
      type: 'REQUIS', // Tipo por defecto para requisiciones
      intorext: 'Externo', // ✅ CAMBIO 2: Default "Externo" para Tipo columna
      internalProvider: '',
      typePriority: 'Normal',
      comment: '',
      compraRapida: false,
      __isNew: true,
      __modified: false
    };

    this.rowData = [...this.rowData, newItem];
    this.isAddingNewItem = true;
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    if (this.context && this.context.ITEMS && this.context.ITEMS.updateCount) {
      this.context.ITEMS.updateCount(this.params.data.id, this.rowData.length);
    }

    setTimeout(() => {
      const lastRowIndex = this.rowData.length - 1;
      this.gridApi.ensureIndexVisible(lastRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: lastRowIndex,
        colKey: 'article'
      });
    }, 0);
  }

  async deleteSelectedItem() {
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.reqWarningToast('Selección requerida', 'Seleccione un item para eliminar');
      return;
    }

    const selectedItem = selectedRows[0];

    // ✅ Bloquear borrado si el usuario no tiene la combinación (sucursal, depto) del REQ padre.
    //    Excepción: ítems nuevos (__isNew) siempre pueden retirarse del listado.
    if (!selectedItem.__isNew && !this.canEditItemsInThisReq) {
      alerts.reqWarningToast(
        'Eliminar ítem',
        'No tienes esta combinación de sucursal + departamento asignada en tu usuario, por lo que no puedes eliminar ítems de esta requisición.'
      );
      return;
    }

    // Si es un item nuevo (no guardado en BD), solo eliminarlo del grid
    if (selectedItem.__isNew) {
      this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
      this.gridApi.setGridOption('rowData', this.rowData);

      // Verificar si quedan cambios pendientes
      const hasChanges = this.rowData.some(item => item.__isNew || item.__modified);
      this.hasUnsavedChanges = hasChanges;
      this.isAddingNewItem = hasChanges;

      alerts.reqSuccessToast('Eliminado', 'Item eliminado del listado');
      return;
    }

    // Bloqueo: no permitir borrar si la compra rápida del item ya tiene entradas en almacén.
    if (selectedItem.id) {
      const hasEntradas = await firstValueFrom(
        this.ocAndReqsService.compraRapidaHasEntradas(selectedItem.id)
      ).catch(() => false);
      if (hasEntradas) {
        alerts.reqWarningToast(
          'No permitido',
          'Este artículo ya tiene entradas en almacén, elimine estas si requiere borrar o desmarcar el artículo'
        );
        return;
      }
    }

    // Si es un item existente, confirmar y eliminar de la BD
    const result = await alerts.confirmAlert(
      '¿Eliminar item?',
      `¿Está seguro de eliminar "${selectedItem.nameArticle || selectedItem.article || 'este item'}"?`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) return;

    try {
      await firstValueFrom(this.ocAndReqsService.deleteReqItem(selectedItem.id));

      // Limpiar el documento CR de compra rápida si correspondía a este item (sin entradas).
      try {
        await firstValueFrom(this.ocAndReqsService.syncCompraRapida(this.requisitionId));
      } catch { /* no bloquear el borrado */ }

      // Eliminar del grid
      this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
      this.originalRowData = this.originalRowData.filter(item => item.id !== selectedItem.id);
      this.gridApi.setGridOption('rowData', this.rowData);

      // Actualizar contador si existe el contexto
      if (this.context && this.context.ITEMS && this.context.ITEMS.updateCount) {
        this.context.ITEMS.updateCount(this.params.data.id, this.rowData.length);
      }

      // Actualizar fecha de modificación del maestro
      try {
        const maestro: any = await firstValueFrom(this.ocAndReqsService.getDetailedReq(this.requisitionId));
        await firstValueFrom(this.ocAndReqsService.updateOcAndReq(this.requisitionId, {
          ...maestro,
          dateModified: this.localISOString()
        }));
      } catch { /* no bloquear el flujo */ }

      // Recargar datos para sincronizar con servidor
      this.loadData();
      this.refreshParentGridAfterSave();

      alerts.reqSuccessToast('Eliminado', 'Item eliminado correctamente');
    } catch (error) {
      console.error('❌ Error al eliminar item:', error);
      alerts.reqErrorToast('Error', 'No se pudo eliminar el item');
    }
  }

  async saveChanges() {
    if (!this.params?.data?.departmentId) {
      alerts.reqWarningToast('Departamento requerido', 'Asigna un departamento a la requisición antes de guardar artículos');
      return;
    }

    // Captura comentarios del panel pendientes (keyed por material) para postearlos tras la recarga.
    this._deferredPanelComments = this.rowData
      .filter((r: any) => r.__pendingPresentComment)
      .map((r: any) => ({ materialId: Number(r.materialId ?? r.idSupplie), texto: r.__pendingPresentComment }));

    if (!this.isAddingNewItem && !this.hasUnsavedChanges) {
      alerts.reqBasicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    // Filtrar items nuevos y modificados
    const newItems = this.rowData.filter(item => item.__isNew);
    const modifiedItems = this.rowData.filter(item => item.__modified && !item.__isNew);

    if (newItems.length === 0 && modifiedItems.length === 0) {
      alerts.reqBasicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    // Validar que todos los items tengan artículo asignado
    const itemsSinArticulo = this.rowData.filter(item =>
      (item.__isNew || item.__modified) &&
      !item.article && !item.nameArticle
    );

    if (itemsSinArticulo.length > 0) {
      const filas = itemsSinArticulo.map((_, i) => {
        const idx = this.rowData.indexOf(itemsSinArticulo[i]) + 1;
        return `Fila ${idx}`;
      }).join(', ');

      alerts.reqWarningToast(
        'Campo obligatorio',
        `Seleccione un artículo en: ${filas}`
      );
      return;
    }

    // Validar que los items con Proveedor Interno tengan proveedor seleccionado
    const itemsSinProveedorInterno = this.rowData.filter(item =>
      (item.__isNew || item.__modified) &&
      (item.intorext || '').toLowerCase() === 'interno' &&
      (!item.idProvider || item.idProvider === 0)
    );

    if (itemsSinProveedorInterno.length > 0) {
      const filas = itemsSinProveedorInterno.map((_, i) => {
        const idx = this.rowData.indexOf(itemsSinProveedorInterno[i]) + 1;
        return `Fila ${idx}`;
      }).join(', ');

      alerts.reqWarningToast(
        'Campo obligatorio',
        `Seleccione un proveedor en: ${filas}`
      );
      return;
    }

    // Crear materiales para artículos nuevos sin materialId en BD
    for (const item of newItems) {
      if (item.recurrent === 'Nuevo' && (!item.materialId || item.materialId === 0)) {
        const idRoot = this.signalsService.getRootSelectedBySidebar()();
        try {
          const matResponse = await lastValueFrom(this.materialsService.addMaterial({
            idCompany: idRoot,
            articulo: '',
            description: item.description || item.article || '',
            idCategory: item.idCategory || null,
            idFamilia: item.idFamilia || null,
            idSubfamilia: item.idSubfamilia || null,
            insumo: (item.description || item.article || '').substring(0, 35),
            typeMaterial: 'CONSUMABLE',
            active: true,
            vigente: true,
            porAutorizar: true
          }));
          item.materialId = matResponse.id || matResponse.ID || 0;
          item.idSupplie = item.materialId;
          // Tomar el num-mat (insumo) del material recién creado para el "# del Articulo"
          item.numArticle = matResponse.insumo || matResponse.Insumo || item.numArticle || '';
          item.code = item.numArticle;
        } catch (err) {
          // Silenciar error - idSupplie permanece 0
        }
      }
    }

    // Crear materiales para artículos modificados que fueron cambiados a "Nuevo" sin materialId
    for (const item of modifiedItems) {
      if (item.recurrent === 'Nuevo' && (!item.materialId || item.materialId === 0)) {
        const idRoot = this.signalsService.getRootSelectedBySidebar()();
        try {
          const matResponse = await lastValueFrom(this.materialsService.addMaterial({
            idCompany: idRoot,
            articulo: '',
            description: item.description || item.article || '',
            idCategory: item.idCategory || null,
            idFamilia: item.idFamilia || null,
            idSubfamilia: item.idSubfamilia || null,
            insumo: (item.description || item.article || '').substring(0, 35),
            typeMaterial: 'CONSUMABLE',
            active: true,
            vigente: true,
            porAutorizar: true
          }));
          item.materialId = matResponse.id || matResponse.ID || 0;
          item.idSupplie = item.materialId;
          // Tomar el num-mat (insumo) del material recién creado para el "# del Articulo"
          item.numArticle = matResponse.insumo || matResponse.Insumo || item.numArticle || '';
          item.code = item.numArticle;
        } catch (err) {
          // Silenciar error - idSupplie permanece 0
        }
      }
    }

    // Guardar items nuevos (POST)
    const newItemsPromises = newItems.map(item => {
      // Si el artículo fue creado como "Nuevo", usar materialId si existe, sino 0
      const isNewArticle = item.recurrent === 'Nuevo';
      const materialId = item.materialId || item.idSupplie || 0;
      const idSupplieValue = isNewArticle ? (materialId > 0 ? materialId : 0) : (materialId || 0);

      const payload = {
        idMovement: this.requisitionId,
        idSupplie: idSupplieValue,
        description: item.article || '',
        nameArticle: item.article || '', // Guardar el nombre en nameArticle
        code: item.code || '',
        intorext: item.intorext || 'Externo',
        measure: item.measure || '',
        quantity: item.quantity || 0,
        price: item.price || 0,
        total: item.total || 0,
        type: item.type || 'REQUIS',
        recurrent: item.recurrent || 'Recurrente', // Enviar si es "Nuevo" o "Recurrente"
        typePriority: item.typePriority || 'Normal',
        idProvider: item.idProvider || 0,
        nameProvider: item.nameProvider || '', // Enviar el nombre del proveedor
        comment: item.comment || '',
        dateuse: item.dateuse || this.localISOString(),
        active: item.active !== undefined ? item.active : true,
        numArticle: item.numArticle || '',
        provint: item.provint || '',
        pedimento: item.pedimiento || false,
        pedimentoNum: item.pedimentoNumber || '',
        compraRapida: item.compraRapida === true,
        descriptionNewArticle: item.descriptionNewArticle || '',
        urlNewArticle: item.urlNewArticle || '',
        justificationNewArticle: item.justificationNewArticle || '',
        idProveedorSugerido: item.idProveedorSugerido ?? null
      };

      return firstValueFrom(this.ocAndReqsService.addReqItem(payload));
    });

    // Guardar items modificados (PUT) - enviar la fila completa
    const modifiedItemsPromises = modifiedItems.map(item => {
      // Si el artículo fue cambiado a "Nuevo", usar materialId si existe, sino 0
      const isNewArticle = item.recurrent === 'Nuevo';
      const materialId = item.materialId || item.idSupplie || 0;
      const idSupplieValue = isNewArticle ? (materialId > 0 ? materialId : 0) : (materialId || 0);

      const payload = {
        id: item.id,
        idMovement: this.requisitionId,
        idSupplie: idSupplieValue,
        description: item.article || '',
        nameArticle: item.article || '', // Guardar el nombre en nameArticle
        code: item.code || '',
        intorext: item.intorext || 'Externo',
        measure: item.measure || '',
        quantity: item.quantity || 0,
        price: item.price || 0,
        total: item.total || 0,
        type: item.type || 'REQUIS',
        recurrent: item.recurrent || 'Recurrente', // Enviar si es "Nuevo" o "Recurrente"
        typePriority: item.typePriority || 'Normal',
        idProvider: item.idProvider || 0,
        nameProvider: item.nameProvider || '', // Enviar el nombre del proveedor
        comment: item.comment || '',
        dateuse: item.dateuse || this.localISOString(),
        active: item.active !== undefined ? item.active : true,
        numArticle: item.numArticle || '',
        provint: item.provint || '',
        pedimento: item.pedimiento || false,
        pedimentoNum: item.pedimentoNumber || '',
        compraRapida: item.compraRapida === true,
        descriptionNewArticle: item.descriptionNewArticle || '',
        urlNewArticle: item.urlNewArticle || '',
        justificationNewArticle: item.justificationNewArticle || '',
        idProveedorSugerido: item.idProveedorSugerido ?? null
      };

      return firstValueFrom(this.ocAndReqsService.updateReqItem(item.id.toString(), payload));
    });

    // Capturar datos antes de limpiar flags
    const newItemsData = newItems.map(item => ({ ...item }));
    const modifiedItemsData = modifiedItems.map(item => ({ ...item }));

    // Ejecutar todas las promesas
    Promise.all([...newItemsPromises, ...modifiedItemsPromises])
      .then(async () => {
        // Marcar todos los items como guardados
        this.rowData.forEach(item => {
          if (item.__isNew || item.__modified) {
            item.__isNew = false;
            item.__modified = false;
            item.saved = true;
          }
        });

        this.isAddingNewItem = false;
        this.hasUnsavedChanges = false;
        this.gridApi.redrawRows();

        const totalSaved = newItems.length + modifiedItems.length;

        // Propagar cambios a todos los pedimentos existentes
        await this.propagateChangesToPedimentos(newItemsData, modifiedItemsData);

        // Generar/sincronizar documentos de Compra Rápida (ocandreq type='CR') de esta requisición.
        // Idempotente: crea los que falten, sincroniza los existentes y borra los desmarcados sin entradas.
        try {
          await firstValueFrom(this.ocAndReqsService.syncCompraRapida(this.requisitionId));
        } catch { /* no bloquear el guardado */ }

        // Actualizar dateModified del maestro para que se reordene en el padre
        try {
          const currentUser = this.signalsService.getDisplayName()();
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

          const maestro: any = await firstValueFrom(this.ocAndReqsService.getDetailedReq(this.requisitionId));
          await firstValueFrom(this.ocAndReqsService.updateOcAndReq(this.requisitionId, {
            ...maestro,
            solicit: currentUser,
            dateModified: this.localISOString()
          }));

          // Actualizar el maestro vía contexto (actualiza rowData + refresca celdas del grid padre)
          if (this.context?.ITEMS?.updateMasterUserAndDate) {
            this.context.ITEMS.updateMasterUserAndDate(this.requisitionId, currentUser, todayStr);
          }
        } catch { /* no bloquear el flujo */ }

        alerts.reqSuccessToast('Guardado', `Se guardaron ${totalSaved} artículo(s) exitosamente`);

        // Recargar datos desde el servidor
        this.loadData();

        // ✅ Forzar reordenamiento en tiempo real en el padre
        if (this.context?.ITEMS?.updateCount) {
          this.context.ITEMS.updateCount(this.requisitionId, this.rowData.length);
        }

        // ✅ Actualizar y reordenar tabla padre inmediatamente (ahora solo como respaldo)
        this.refreshParentGridAfterSave();
      })
      .catch(() => {
        alerts.reqErrorToast('Error', 'Ocurrió un error al guardar los artículos');
      });
  }

  async saveMultiGuardar() {
    // 1. Validar que haya al menos un item seleccionado
    const checkedItems = this.rowData.filter(item => item.pedimiento === true);
    if (checkedItems.length === 0) {
      alerts.reqWarningToast('Sin selección', 'Marque al menos un item en la columna "Pedimento"');
      return;
    }

    // 2. Validar que ningún item seleccionado sea de tipo Interno
    const internoItems = checkedItems.filter(item => (item.intorext || '').toLowerCase() === 'interno');
    if (internoItems.length > 0) {
      alerts.reqWarningToast(
        'Proveedor Interno',
        'Los artículos con Proveedor Interno no pueden incluirse en pedimentos'
      );
      return;
    }

    // 3. Validar que todos los items seleccionados sean del mismo tipo (Interno o Externo)
    const tipos = [...new Set(checkedItems.map(item => item.intorext || 'Externo'))];
    if (tipos.length > 1) {
      alerts.reqWarningToast(
        'Tipos mixtos',
        'Seleccione solo artículos del mismo tipo (Interno o Externo)'
      );
      return;
    }

    try {
      // 🔄 MOSTRAR ALERTA DE PROGRESO: Primera alerta
      alerts.showLoadingWithProgress('Generando Cotización', 'Por favor espera un momento...', 0);

      // 2. Obtener datos de la requisición original
      let requisicionOriginal = this.params.data;

      // ✅ Cargar datos frescos del servidor para asegurar que idDepartament sea correcto
      try {
        const reqFresca: any = await firstValueFrom(
          this.ocAndReqsService.getDetailedReq(requisicionOriginal.id)
        );
        if (reqFresca) {
          // Usar datos frescos pero mantener respaldo a los locales
          requisicionOriginal = { ...requisicionOriginal, ...reqFresca };
        }
      } catch (err) {
        // Usar datos locales si falla la carga fresca
      }

      // 3. Consultar cuántas cotizaciones ya existen para esta requisición
      const cotizacionesExistentes: any = await firstValueFrom(
        this.ocAndReqsService.getOcAndReqs('requisition', requisicionOriginal.id, 'COTIZ')
      );

      const numCotizaciones = Array.isArray(cotizacionesExistentes) ? cotizacionesExistentes.length : 0;
      const siguienteNumeroPedimento = numCotizaciones + 1;

      alerts.updateLoadingProgress('Generando Cotización', 'Validando información...', 20);

      // 4. Obtener el folio de cotización (PrefixSetupService actualiza automáticamente el consecutivo)
      const folioCotizacion = await this.prefixSetupService.getNextFolio('branch', requisicionOriginal.idReference, 'cotiz');

      if (!folioCotizacion) {
        throw new Error('No se pudo generar el folio de cotización. Verifica la configuración de prefijos.');
      }

      alerts.updateLoadingProgress('Generando Cotización', 'Creando maestro...', 30);


      // 5. Crear el maestro de la cotización
      const maestroCotizacion = {
        id: 0,
        folio: folioCotizacion,
        typeReference: 'requisition',
        idReq: requisicionOriginal.id,
        idReference: requisicionOriginal.id, // ✅ Relación con la requisición original
        dateCreate: this.localISOString(),
        idProvider: 0,
        idDepartament: requisicionOriginal.idDepartament || 0,
        delivery: requisicionOriginal.delivery || 'NO APLICA',
        deliveryTime: requisicionOriginal.deliveryTime || '1 DAY',
        typeOc: requisicionOriginal.typeOc || 'INSUMOS',
        dateSupply: requisicionOriginal.dateSupply || this.localISOString(),
        idPayment: requisicionOriginal.idPayment || 0,
        idCurrency: requisicionOriginal.idCurrency || 0,
        conditions: requisicionOriginal.conditions || null,
        idAuthorize: 0,
        priority: requisicionOriginal.column8 || null,
        solicit: requisicionOriginal.solicitedBy || '',
        discount: 0,
        ivaRetention: 0,
        idSolicit: 0,
        address: requisicionOriginal.address || null,
        city: requisicionOriginal.city || null,
        phone: requisicionOriginal.phone || null,
        type: 'COTIZ', // ✅ Tipo = COTIZ
        pedimento: siguienteNumeroPedimento, // ✅ Número de pedimento
        compliancePedimento: 0,
        complianceRequesicion: 0,
        comments: requisicionOriginal.comments || null,
        close: false,
        active: true
      };


      // Crear el maestro en la BD
      const cotizacionCreada: any = await firstValueFrom(
        this.ocAndReqsService.addOcAndReq(maestroCotizacion)
      );

      const idCotizacion = cotizacionCreada.id || cotizacionCreada.ID;

      if (!idCotizacion) {
        throw new Error('No se pudo obtener el ID de la cotización creada');
      }

      alerts.updateLoadingProgress('Generando Cotización', 'Confirmando folio...', 45);

      // ✅ Confirmar el folio en PrefixSetup (actualizar consecutivo después de guardar)
      try {
        const prefixSetup = await firstValueFrom(
          this.prefixSetupService.getPrefixSetup('branch', requisicionOriginal.idReference)
        );
        if (prefixSetup && prefixSetup.id) {
          await this.prefixSetupService.confirmFolio(prefixSetup.id, 'cotiz');
        }
      } catch (err) {
        console.warn('No se pudo confirmar el folio:', err);
      }

      alerts.updateLoadingProgress('Generando Cotización', 'Copiando artículos...', 55);

      // 6. Crear snapshot de TODOS los artículos de la requisición, marcando cuáles fueron solicitados

      // Crear Set de IDs seleccionados para búsqueda rápida
      const selectedIds = new Set(checkedItems.map(item => item.id));

      for (const item of this.rowData) {
        // Verificar si este item fue seleccionado para este pedimento
        const fueSeleccionado = selectedIds.has(item.id);

        const detallePayload = {
          idMovement: idCotizacion, // ✅ ID de la cotización recién creada
          idSupplie: item.idSupplie || item.materialId || 0,
          description: item.description || item.article || '',
          nameArticle: item.nameArticle || item.article || '',
          code: item.code || '',
          intorext: item.intorext || 'Externo',
          measure: item.measure || '',
          quantity: item.quantity || 0,
          price: item.price || 0,
          total: item.total || 0,
          type: 'COTIZ', // ✅ Tipo = COTIZ
          idProvider: item.idProvider || 0,
          comment: item.comment || '',
          dateuse: item.dateuse || this.localISOString(),
          active: true,
          recurrent: item.recurrent || 'Recurrente',
          numArticle: item.numArticle || '',
          provint: item.provint || '',
          typePriority: item.typePriority || 'Normal',
          pedimento: fueSeleccionado, // ✅ true = solicitado, false = solo snapshot
          descriptionNewArticle: item.descriptionNewArticle || '', // Descripción del artículo nuevo
          urlNewArticle: item.urlNewArticle || '', // URL/Link del artículo nuevo
          justificationNewArticle: item.justificationNewArticle || '', // Justificación del artículo nuevo
          idProveedorSugerido: item.idProveedorSugerido ?? null // ⚠️ preservar: SetValues lo borraría si falta
        };


        await firstValueFrom(
          this.ocAndReqsService.addReqItem(detallePayload)
        );
      }

      alerts.updateLoadingProgress('Generando Cotización', 'Actualizando números de pedimento...', 75);

      // 7. Actualizar el consecutivo del prefijo
      // El consecutivo ya fue actualizado automáticamente por getNextFolio


      // 8. Actualizar la columna "Pedimento #" de los items seleccionados
      checkedItems.forEach(item => {
        if (item.pedimentoNumber) {
          // Si ya tiene un valor, añadir el nuevo número separado por coma
          item.pedimentoNumber += `,${siguienteNumeroPedimento}`;
        } else {
          // Si está vacío, asignar el número
          item.pedimentoNumber = String(siguienteNumeroPedimento);
        }
        // Desmarcar el checkbox
        item.pedimiento = false;
      });

      // 9. ✅ GUARDAR los items actualizados en la base de datos

      for (const item of checkedItems) {
        const updatePayload = {
          id: item.id,
          idMovement: this.requisitionId,
          idSupplie: item.idSupplie || item.materialId || 0,
          description: item.description || item.article || '',
          nameArticle: item.nameArticle || item.article || '',
          code: item.code || '',
          intorext: item.intorext || 'Externo',
          measure: item.measure || '',
          quantity: item.quantity || 0,
          price: item.price || 0,
          total: item.total || 0,
          type: item.type || 'REQUIS',
          idProvider: item.idProvider || 0,
          comment: item.comment || '',
          dateuse: item.dateuse || this.localISOString(),
          active: item.active !== undefined ? item.active : true,
          recurrent: item.recurrent || 'Recurrente',
          numArticle: item.numArticle || '',
          provint: item.provint || '',
          typePriority: item.typePriority || 'Normal',
          pedimento: false, // ✅ SIEMPRE false después de Multiguardar para permitir múltiples cotizaciones
          pedimentoNum: item.pedimentoNumber || '', // ✅ String con números separados por coma (ej: "1,3,4,6")
          descriptionNewArticle: item.descriptionNewArticle || '', // Descripción del artículo nuevo
          urlNewArticle: item.urlNewArticle || '', // URL/Link del artículo nuevo
          justificationNewArticle: item.justificationNewArticle || '', // Justificación del artículo nuevo
          idProveedorSugerido: item.idProveedorSugerido ?? null // ⚠️ preservar: SetValues lo borraría si falta
        };


        await firstValueFrom(
          this.ocAndReqsService.updateReqItem(item.id.toString(), updatePayload)
        );
      }


      // 10. ✅ Actualizar el detailData en el maestro para refrescar "Cumplimiento Pedimento"
      if (this.context && this.context.ITEMS && this.context.ITEMS.save) {
        this.context.ITEMS.save(this.requisitionId, this.rowData, false);
      }

      alerts.updateLoadingProgress('Generando Cotización', 'Finalizando...', 90);

      // 11. Redibujar el grid
      this.hasPedimentoSelection = false;
      this.gridApi.redrawRows();

      // 12. Cerrar alerta de progreso y mostrar mensaje de éxito
      alerts.closeLoading();

      // ✅ Actualizar dateModified del maestro para que se reordene en el padre
      try {
        const maestroActual: any = await firstValueFrom(
          this.ocAndReqsService.getDetailedReq(requisicionOriginal.id)
        );
        await firstValueFrom(this.ocAndReqsService.updateOcAndReq(requisicionOriginal.id, {
          ...maestroActual,
          dateModified: this.localISOString()
        }));
        this.refreshParentGridAfterSave();
      } catch (err) {
        // No se pudo actualizar dateModified
      }

      setTimeout(() => {
        const message = `Cotización ${folioCotizacion} creada exitosamente con ${checkedItems.length} artículo(s)`;
        alerts.reqSuccessToast('Cotización Creada', message);
      }, 300);


    } catch (error) {
      alerts.closeLoading();
      alerts.reqErrorToast('Error', 'No se pudo crear la cotización');
    }
  }

  discardChanges() {
    if (!this.hasUnsavedChanges && !this.isAddingNewItem) {
      alerts.reqBasicAlert('Sin cambios', 'No hay cambios pendientes por descartar', 'info');
      return;
    }

    this.loadData();
    this.hasUnsavedChanges = false;
    this.isAddingNewItem = false; // Quitar el badge rojo del botón Guardar
    if (this.gridApi) {
      this.gridApi.redrawRows();
    }
  }

  onCellValueChanged(event: any) {
    // Marcar la fila como modificada
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
    this.isAddingNewItem = true;

    // Al cambiar 'recurrent', siempre limpiar artículo y campos relacionados
    if (event.colDef.field === 'recurrent') {
      event.data.idSupplie = 0;
      event.data.materialId = 0;
      event.data.article = '';
      event.data.nameArticle = '';
      event.data.code = '';
      event.data.numArticle = '';
      event.data.description = '';
      event.data.idProvider = 0;
      event.data.nameProvider = '';
      event.data.descriptionNewArticle = '';
      event.data.urlNewArticle = '';
      event.data.justificationNewArticle = '';

      if (event.newValue === 'Nuevo') {
        // Forzar Externo para artículos nuevos
        event.data.intorext = 'Externo';
      }

      this.gridApi.refreshCells({
        rowNodes: [event.node],
        columns: ['intorext', 'idProvider', 'article', 'numArticle'],
        force: true
      });
    }
  }

  async saveNewArticle() {
    this.newArticleFormSubmitted = true;

    const name = (this.newArticle.description || '').trim();
    const desc = (this.newArticle.descriptionNewArticle || '').trim();
    const usage = (this.newArticle.justificationNewArticle || '').trim();

    // Validación: campos obligatorios visibles
    if (!name || !desc || !usage) {
      alerts.reqWarningToast('Validación', 'Completa todos los campos obligatorios antes de guardar');
      return;
    }

    const materialId = 0;

    // Guardar los datos del formulario en la fila actual CON EL ID DEL MATERIAL
    this.currentRowForNewArticle.data.idSupplie = materialId;
    this.currentRowForNewArticle.data.materialId = materialId;
    this.currentRowForNewArticle.data.article = name;
    this.currentRowForNewArticle.data.nameArticle = name;
    this.currentRowForNewArticle.data.descriptionNewArticle = desc;
    this.currentRowForNewArticle.data.urlNewArticle = (this.newArticle.urlNewArticle || '').trim();
    this.currentRowForNewArticle.data.justificationNewArticle = usage;
    this.currentRowForNewArticle.data.code = '';
    this.currentRowForNewArticle.data.numArticle = '';
    this.currentRowForNewArticle.data.description = this.newArticle.description.trim();
    // Guardar categoría, familia y subfamilia
    this.currentRowForNewArticle.data.idCategory = this.newArticle.idCategory;
    this.currentRowForNewArticle.data.idFamilia = this.newArticle.idFamilia;
    this.currentRowForNewArticle.data.idSubfamilia = this.newArticle.idSubfamilia;
    this.currentRowForNewArticle.data.__modified = true;
    this.hasUnsavedChanges = true;
    this.isAddingNewItem = true;

    // Refrescar las celdas del grid
    this.gridApi.refreshCells({
      rowNodes: [this.currentRowForNewArticle],
      columns: ['article', 'numArticle'],
      force: true
    });

    alerts.reqSuccessToast('Éxito', 'Datos guardados. Presione "Guardar" para enviar');
    this.closeNewArticleModal();
  }

  onArticleNameTyped(value: string): void {
    const typed = (value || '').trim().toUpperCase();
    if (!typed) {
      this.newArticleIsDuplicate = false;
      return;
    }
    this.newArticleIsDuplicate = this.newArticleNameOptions.some(opt => {
      const name = typeof opt === 'string' ? opt : (opt?.description || '');
      return name.trim().toUpperCase() === typed;
    });
  }

  onArticleSelected(option: any): void {
    const selectedArticle = typeof option === 'string' ? option : option?.description || option;
    if (!selectedArticle?.trim?.()) return;
    this.newArticle.description = String(selectedArticle).trim();
    this.onArticleNameTyped(String(selectedArticle));
  }

  private openNewArticleModal() {
    this.isNewArticleModalVisible = true;
    this.newArticleFormSubmitted = false;
    this.newArticleIsDuplicate = false; // Resetear estado de duplicado

    // Resetear valores del formulario al abrir
    this.newArticle = {
      description: '',
      descriptionNewArticle: '',
      urlNewArticle: '',
      justificationNewArticle: '',
      idCategory: null,
      idFamilia: null,
      idSubfamilia: null
    };

    // Asegurar que el catálogo esté disponible antes de abrir (evita selects vacíos)
    if (!this.categories?.length || !this.familias?.length || !this.subfamilias?.length) {
      void this.loadCatalogs();
    }

    if (!this.newArticleModalTpl) {
      // El ViewChild podría no estar listo en algunos ciclos
      setTimeout(() => this.openNewArticleModal(), 0);
      return;
    }

    // Establecer valores por defecto después de resetear
    this.setDefaultCatalogValues();

    // Cerrar uno previo si existiera
    try { this.newArticleModalRef?.close(); } catch { }

    this.newArticleModalRef = this.ngbModal.open(this.newArticleModalTpl, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      size: 'lg',
      windowClass: 'new-article-modal-top'
    });

    this.newArticleModalRef.result.finally(() => {
      // Si el usuario cierra por cualquier vía, limpiar bandera
      this.isNewArticleModalVisible = false;
      this.newArticleModalRef = null;
    });
  }

  closeNewArticleModal() {
    this.isNewArticleModalVisible = false;
    try { this.newArticleModalRef?.close(); } catch { }
    this.newArticleModalRef = null;
    this.currentRowForNewArticle = null;
    this.newArticleFormSubmitted = false;
  }

  // ==================== CATÁLOGOS PARA NUEVO ARTÍCULO ====================

  private async loadCatalogs(): Promise<void> {
    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      if (!idRoot) {
        console.warn('⚠️ No idRoot disponible para cargar catálogos');
        return;
      }

      // Cargar TODAS las categorías/familias/subfamilias (sin filtro de bit MATERIAL)
      [this.categories, this.familias, this.subfamilias] = await Promise.all([
        lastValueFrom(this.catalogsService.getCatalogs(idRoot, 'CATEGORY')),
        lastValueFrom(this.catalogsService.getCatalogs(idRoot, 'FAM-CAT')),
        lastValueFrom(this.catalogsService.getCatalogs(idRoot, 'SUB-FAM'))
      ]);
    } catch (err) {
      // Error cargando catálogos
    }
  }

  onCategoryChange(): void {
    // Limpiar selecciones dependientes
    this.newArticle.idFamilia = null;
    this.newArticle.idSubfamilia = null;
  }

  onFamilyChange(): void {
    // Limpiar selección dependiente
    this.newArticle.idSubfamilia = null;
  }

  private setDefaultCatalogValues(): void {
    // Buscar "NUEVO" en categorías (para que el artículo caiga en "Artículos y Servicios Nuevos")
    const categoriaNuevo = this.categories.find(c =>
      c.description?.trim().toUpperCase() === 'NUEVO'
    );
    if (categoriaNuevo) {
      this.newArticle.idCategory = categoriaNuevo.id;
    }

    // Buscar "PRODUCTO NUEVO" en familias
    const productoNuevoFam = this.familias.find(f =>
      f.description?.toUpperCase().includes('PRODUCTO NUEVO')
    );
    if (productoNuevoFam) {
      this.newArticle.idFamilia = productoNuevoFam.id;
    }

    // Buscar "PRODUCTO NUEVO" en subfamilias
    const productoNuevoSubfam = this.subfamilias.find(sf =>
      sf.description?.toUpperCase().includes('PRODUCTO NUEVO')
    );
    if (productoNuevoSubfam) {
      this.newArticle.idSubfamilia = productoNuevoSubfam.id;
    }
  }

  getFamiliesByCategory(categoryId: number | null | string): any[] {
    if (!categoryId) return [];
    const catIdNum = Number(categoryId);
    const result = this.familias.filter(f => Number(f.parentId) === catIdNum);
    return result;
  }

  getSubfamiliesByFamily(familyId: number | null | string): any[] {
    if (!familyId) return [];
    const famIdNum = Number(familyId);
    return this.subfamilias.filter(sf => Number(sf.subParentId) === famIdNum);
  }

  onCellClicked(event: any): void {
    event.node.setSelected(true);

    // Limpiar tooltip al hacer clic en cualquier celda
    this.hideNewArticleTooltip();
  }

  onSelectionChanged(_event: any): void {
    const selectedRows = this.gridApi?.getSelectedRows() || [];
    this.hasRowSelected = selectedRows.length > 0;
  }

  // ==================== PANEL DE PRESENTACIONES (cajero) ====================

  /** Abre el panel para armar la cantidad del artículo con presentaciones por proveedor. */
  async openPresentacionesPanel(row: any): Promise<void> {
    const idMaterial = row?.materialId ?? row?.idSupplie;
    if (!idMaterial) return;
    this.panelRow = row;
    this.panelMaterialId = idMaterial;
    this.panelCantidad = Number(row?.quantity) || 0;
    this.panelArticle = row?.article || '';
    // Resuelve nombres desde el maestro de proveedores (por id), no desde loadProviders:
    // loadProviders filtra por sucursal autorizada y usa el campo idProvider, no cubría todos.
    try {
      const allProvs: any = await firstValueFrom(
        this.customersService.getCustomersByCompany(this.idRoot || 0, 'PROVIDERS')
      ).catch(() => []);
      const map = new Map<number, string>();
      (allProvs || []).forEach((p: any) => {
        const name = p.name || p.company || p.description || `Proveedor ${p.id}`;
        if (p.id) map.set(Number(p.id), name);
      });
      this.panelProviderNames = map;
    } catch { this.panelProviderNames = null; }
    this.panelOpen = true;
  }

  /** El usuario eligió una cantidad/proveedor en el panel: la escribe en la celda + comenta. */
  onPanelSeleccionar(ev: { cantidad: number; idProvider: number; proveedor: string; texto: string }): void {
    if (this.panelRow) {
      this.panelRow.quantity = ev.cantidad;
      this.panelRow.idProveedorSugerido = ev.idProvider;   // proveedor sugerido (se persiste al guardar)
      this.panelRow.__modified = true;
      this.hasUnsavedChanges = true;
      // Opción 3: el comentario NO se postea ahora (eso recargaría el grid y borraría lo no guardado).
      // Se deja pendiente en la fila y se postea cuando el usuario GUARDA (saveChanges → tras recargar).
      this.panelRow.__pendingPresentComment = `🧮 [Req] ${ev.texto}`;
      this.gridApi?.refreshCells({ force: true });
    }
    this.onPanelCerrar();
  }

  onPanelCerrar(): void {
    this.panelOpen = false;
    this.panelRow = null;
  }

  /** Postea los comentarios del panel pendientes, ya con las filas recargadas (numArticle real). */
  private postDeferredPanelComments(): void {
    if (!this._deferredPanelComments.length) return;
    const pending = this._deferredPanelComments;
    this._deferredPanelComments = [];   // limpiar ANTES de emitir (evita reentradas vía commentSaved$ → loadData)
    for (const c of pending) {
      const row = this.rowData.find((r: any) => Number(r.materialId ?? r.idSupplie) === c.materialId);
      const numArticle = row?.numArticle || (row?.idSupplie ? `SUPP-${row.idSupplie}` : '');
      if (!numArticle) continue;
      this.itemCommentsService.openChatFor$.next({
        documentType: 'REQ',
        idDocument: this.requisitionId,
        numArticle,
        autoMessage: c.texto,
        forceComment: true,
        articleName: row?.article || '',
      });
    }
  }


  // ==================== PROPAGACIÓN A PEDIMENTOS ====================

  /**
   * Propaga cambios (nuevos productos y observaciones modificadas) a todos los pedimentos
   * existentes de esta requisición.
   */
  private async propagateChangesToPedimentos(newItems: any[], modifiedItems: any[]) {
    if (newItems.length === 0 && modifiedItems.length === 0) return;

    try {
      // 1. Obtener todas las cotizaciones (pedimentos) de esta requisición
      const cotizaciones: any = await firstValueFrom(
        this.ocAndReqsService.getOcAndReqs('requisition', this.requisitionId, 'COTIZ')
      );

      if (!Array.isArray(cotizaciones) || cotizaciones.length === 0) {
        return;
      }


      // 2. Para cada cotización, propagar cambios
      for (const cotizacion of cotizaciones) {
        const cotizacionId = cotizacion.id;

        // Obtener items existentes de esta cotización
        const cotizItemsRaw: any = await firstValueFrom(
          this.ocAndReqsService.getReqItems(cotizacionId)
        );
        const cotizItems = Array.isArray(cotizItemsRaw) ? cotizItemsRaw : [];

        // 3. Agregar nuevos items (como contexto, pedimento: false)
        for (const newItem of newItems) {
          const idSupplie = newItem.idSupplie || newItem.materialId || 0;
          const nameArticle = newItem.nameArticle || newItem.article || '';

          // Verificar si ya existe en la cotización para evitar duplicados
          const alreadyExists = cotizItems.some((ci: any) => {
            if (idSupplie > 0) return ci.idSupplie === idSupplie;
            return ci.nameArticle === nameArticle && ci.idSupplie === 0;
          });

          if (alreadyExists) {
            continue;
          }

          const payload = {
            idMovement: cotizacionId,
            idSupplie: idSupplie,
            description: newItem.description || newItem.article || '',
            nameArticle: nameArticle,
            code: newItem.code || '',
            intorext: newItem.intorext || 'Externo',
            measure: newItem.measure || '',
            quantity: newItem.quantity || 0,
            price: newItem.price || 0,
            total: newItem.total || 0,
            type: 'COTIZ',
            idProvider: newItem.idProvider || 0,
            comment: newItem.comment || '',
            dateuse: newItem.dateuse || this.localISOString(),
            active: true,
            recurrent: newItem.recurrent || 'Recurrente',
            numArticle: newItem.numArticle || '',
            provint: newItem.provint || '',
            typePriority: newItem.typePriority || 'Normal',
            pedimento: false, // Nuevo item = contexto en pedimentos existentes
            descriptionNewArticle: newItem.descriptionNewArticle || '',
            urlNewArticle: newItem.urlNewArticle || '',
            justificationNewArticle: newItem.justificationNewArticle || ''
          };

          await firstValueFrom(this.ocAndReqsService.addReqItem(payload));
        }

        // 4. Actualizar observaciones de items modificados
        for (const modItem of modifiedItems) {
          const idSupplie = modItem.idSupplie || modItem.materialId || 0;
          const nameArticle = modItem.nameArticle || modItem.article || '';

          // Buscar el item correspondiente en la cotización
          const matchingItem = cotizItems.find((ci: any) => {
            if (idSupplie > 0) return ci.idSupplie === idSupplie;
            return ci.nameArticle === nameArticle && ci.idSupplie === 0;
          });

          if (!matchingItem) {
            continue;
          }

          // Solo actualizar si el comentario cambió
          if (matchingItem.comment === (modItem.comment || '')) continue;

          const updatePayload = {
            id: matchingItem.id,
            idMovement: cotizacionId,
            idSupplie: matchingItem.idSupplie,
            description: matchingItem.description,
            nameArticle: matchingItem.nameArticle,
            code: matchingItem.code || '',
            intorext: matchingItem.intorext || 'Externo',
            measure: matchingItem.measure || '',
            quantity: matchingItem.quantity || 0,
            price: matchingItem.price || 0,
            total: matchingItem.total || 0,
            type: matchingItem.type || 'COTIZ',
            idProvider: matchingItem.idProvider || 0,
            comment: modItem.comment || '', // Observación actualizada
            dateuse: matchingItem.dateuse || this.localISOString(),
            active: matchingItem.active !== undefined ? matchingItem.active : true,
            recurrent: matchingItem.recurrent || 'Recurrente',
            numArticle: matchingItem.numArticle || '',
            provint: matchingItem.provint || '',
            typePriority: matchingItem.typePriority || 'Normal',
            pedimento: matchingItem.pedimento || false,
            descriptionNewArticle: matchingItem.descriptionNewArticle || '',
            urlNewArticle: matchingItem.urlNewArticle || '',
            justificationNewArticle: matchingItem.justificationNewArticle || ''
          };

          await firstValueFrom(
            this.ocAndReqsService.updateReqItem(matchingItem.id.toString(), updatePayload)
          );
        }
      }


    } catch (error) {
      console.error('❌ Error al propagar cambios a pedimentos:', error);
      // No lanzar error para no bloquear el guardado principal
    }
  }

  // ==================== PDF METHODS ====================

  async generatePDF() {
    if (!this.requisitionData || !this.requisitionData.id) {
      console.error('No hay datos de requisición para generar PDF');
      this.pdfUrl = null;
      return;
    }


    try {
      // Usar el servicio receiptsDelisonService para generar el PDF como Blob
      const blob = await this.receiptsDelisonService.generateOC(this.requisitionData.id, 'blob');

      if (blob instanceof Blob) {
        // Limpiar URL anterior si existe
        if (this.originalPdfUrl) {
          URL.revokeObjectURL(this.originalPdfUrl);
        }

        // Crear nueva URL para el blob
        this.originalPdfUrl = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.originalPdfUrl);
      } else {
        console.error('⚠️ El servicio no retornó un Blob');
        this.pdfUrl = null;
      }

    } catch (error) {
      console.error('❌ Error al generar PDF:', error);
      this.pdfUrl = null;
      alerts.reqErrorToast('Error', 'No se pudo generar el PDF de la requisición');
    }
  }

  private async createCotizationAutomatically(): Promise<void> {
    try {
      // 1. Obtener datos completos de la requisición
      const requisitionData: any = await firstValueFrom(
        this.ocAndReqsService.getDetailedReq(this.requisitionId)
      );

      if (!requisitionData) {
        console.warn('⚠️ No se pudo obtener datos de la requisición');
        return;
      }

      // 2. Verificar si ya existe una cotización para esta requisición
      const existingCotiz: any = await firstValueFrom(
        this.ocAndReqsService.getOcAndReqs('branch', requisitionData.idReference, 'COTIZ') as any
      );

      const hasCotiz = Array.isArray(existingCotiz) && existingCotiz.some((c: any) => c.idReq === this.requisitionId);
      if (hasCotiz) {
        return;
      }

      // 3. Generar folio para la cotización
      const folioCotiz = await this.prefixSetupService.generateNextFolio(
        'branch',
        requisitionData.idReference,
        'cotiz'
      );

      if (!folioCotiz) {
        console.warn('⚠️ No se pudo generar folio para la cotización');
        return;
      }

      // 4. Crear objeto de cotización copiando datos de la requisición
      const newCotization = {
        id: 0,
        idRoot: requisitionData.idRoot,
        folio: folioCotiz,
        typeReference: 'requisition', // ✅ Las cotizaciones se relacionan a requisiciones
        idReq: this.requisitionId, // ✅ Vinculado a la requisición
        idReference: this.requisitionId, // ✅ Para que se encuentre con getOcAndReqs('requisition', idReq, 'COTIZ')
        dateCreate: this.localISOString(),
        idProvider: requisitionData.idProvider || 0,
        idDepartament: requisitionData.idDepartament || 0,
        delivery: requisitionData.delivery || 'NO APLICA',
        deliveryTime: requisitionData.deliveryTime || '1 DAY',
        typeOc: requisitionData.typeOc || 'INSUMOS',
        dateSupply: requisitionData.dateSupply || this.localISOString(),
        idPayment: requisitionData.idPayment || 0,
        idCurrency: requisitionData.idCurrency || 0,
        conditions: requisitionData.conditions || null,
        idAuthorize: 0,
        priority: requisitionData.priority || null,
        solicit: requisitionData.solicit || '',
        discount: requisitionData.discount || 0,
        ivaRetention: requisitionData.ivaRetention || 0,
        idSolicit: requisitionData.idSolicit || 0,
        address: requisitionData.address || null,
        city: requisitionData.city || null,
        phone: requisitionData.phone || null,
        type: 'COTIZ', // ✅ Tipo cotización
        pedimento: 1,
        compliancePedimento: 0,
        complianceRequesicion: 0,
        comments: requisitionData.comments || null,
        close: false,
        active: true
      };

      // 5. Guardar la cotización
      await firstValueFrom(this.ocAndReqsService.addOcAndReq(newCotization));

      // 6. Confirmar el folio para incrementar el consecutivo
      try {
        const prefixSetup = await firstValueFrom(
          this.prefixSetupService.getPrefixSetup('branch', requisitionData.idReference)
        );
        if (prefixSetup && prefixSetup.id) {
          await this.prefixSetupService.confirmFolio(prefixSetup.id, 'cotiz');
        }
      } catch (err) {
        console.warn('⚠️ No se pudo confirmar el folio de cotización:', err);
      }
    } catch (error) {
      throw error;
    }
  }

  closeReport() {
    // Emit event to parent component to handle collapse
    if (this.context && this.context.componentParent) {
      this.context.componentParent.collapsePdfDetail(this.requisitionData.id);
    }
  }

  ngOnDestroy() {
    this.commentSub?.unsubscribe();
    this.sucursalSub?.unsubscribe();
    if (this.originalPdfUrl) {
      URL.revokeObjectURL(this.originalPdfUrl);
      this.originalPdfUrl = null;
    }
    this.hideNewArticleTooltip();
  }

  // ==================== TOOLTIP METHODS ====================

  private showNewArticleTooltip(data: any, cellRect: DOMRect): void {
    this.hideNewArticleTooltip();

    const name = data.nameArticle || 'Sin nombre';
    const description = data.descriptionNewArticle || 'Sin descripción';
    const url = data.urlNewArticle || '';
    const justification = data.justificationNewArticle || 'Sin justificación';

    // Crear contenedor del tooltip
    this.tooltipElement = this.renderer.createElement('div');
    this.renderer.setStyle(this.tooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipElement, 'z-index', '10001');
    this.renderer.setStyle(this.tooltipElement, 'pointer-events', 'none');
    this.renderer.setStyle(this.tooltipElement, 'min-width', '300px');
    this.renderer.setStyle(this.tooltipElement, 'max-width', '450px');

    // Crear flecha del tooltip
    const arrow = this.renderer.createElement('div');
    this.renderer.setStyle(arrow, 'position', 'absolute');
    this.renderer.setStyle(arrow, 'left', '-8px');
    this.renderer.setStyle(arrow, 'top', '20px');
    this.renderer.setStyle(arrow, 'width', '0');
    this.renderer.setStyle(arrow, 'height', '0');
    this.renderer.setStyle(arrow, 'border-top', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-bottom', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-right', '8px solid #d97706');
    this.renderer.appendChild(this.tooltipElement, arrow);

    // Crear contenido del tooltip
    const content = this.renderer.createElement('div');
    this.renderer.setStyle(content, 'border-radius', '8px');
    this.renderer.setStyle(content, 'box-shadow', '0 8px 24px rgba(0, 0, 0, 0.4)');
    this.renderer.setStyle(content, 'overflow', 'hidden');
    this.renderer.setStyle(content, 'border', '1px solid rgba(255, 255, 255, 0.1)');
    this.renderer.setStyle(content, 'background', 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)');

    // Header
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
    this.renderer.addClass(headerIcon, 'bi-box-seam');
    this.renderer.setStyle(headerIcon, 'font-size', '16px');
    this.renderer.appendChild(header, headerIcon);

    const headerText = this.renderer.createElement('strong');
    const headerTextNode = this.renderer.createText(`Artículo Nuevo: ${name}`);
    this.renderer.appendChild(headerText, headerTextNode);
    this.renderer.appendChild(header, headerText);
    this.renderer.appendChild(content, header);

    // Body
    const body = this.renderer.createElement('div');
    this.renderer.setStyle(body, 'padding', '12px 14px');
    this.renderer.setStyle(body, 'color', '#ffffff');
    this.renderer.setStyle(body, 'font-size', '12px');

    // Descripción
    this.appendTooltipRow(body, 'bi-card-text', 'Descripción:', description);

    // URL (solo si existe)
    if (url) {
      this.appendTooltipRow(body, 'bi-link-45deg', 'URL:', url);
    }

    // Justificación
    this.appendTooltipRow(body, 'bi-question-circle', 'Justificación:', justification, true);

    this.renderer.appendChild(content, body);
    this.renderer.appendChild(this.tooltipElement, content);

    // Agregar al body
    this.renderer.appendChild(document.body, this.tooltipElement);

    // Posicionar tooltip a la derecha de la celda
    const top = cellRect.top;
    const left = cellRect.right + 8;
    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);

    // Animación de entrada
    this.renderer.setStyle(this.tooltipElement, 'opacity', '0');
    setTimeout(() => {
      if (this.tooltipElement) {
        this.renderer.setStyle(this.tooltipElement, 'opacity', '1');
        this.renderer.setStyle(this.tooltipElement, 'transition', 'opacity 0.3s ease');
      }
    }, 10);
  }

  private appendTooltipRow(container: HTMLElement, iconClass: string, label: string, value: string, isLast: boolean = false): void {
    const row = this.renderer.createElement('div');
    this.renderer.setStyle(row, 'display', 'flex');
    this.renderer.setStyle(row, 'align-items', 'flex-start');
    this.renderer.setStyle(row, 'gap', '8px');
    if (!isLast) {
      this.renderer.setStyle(row, 'margin-bottom', '10px');
    }

    const labelEl = this.renderer.createElement('span');
    this.renderer.setStyle(labelEl, 'color', 'rgba(255, 255, 255, 0.9)');
    this.renderer.setStyle(labelEl, 'font-weight', '600');
    this.renderer.setStyle(labelEl, 'min-width', '100px');
    this.renderer.setStyle(labelEl, 'display', 'flex');
    this.renderer.setStyle(labelEl, 'align-items', 'center');
    this.renderer.setStyle(labelEl, 'gap', '5px');
    this.renderer.setStyle(labelEl, 'flex-shrink', '0');

    const icon = this.renderer.createElement('i');
    this.renderer.addClass(icon, 'bi');
    this.renderer.addClass(icon, iconClass);
    this.renderer.setStyle(icon, 'font-size', '12px');
    this.renderer.appendChild(labelEl, icon);

    const labelText = this.renderer.createText(label);
    this.renderer.appendChild(labelEl, labelText);
    this.renderer.appendChild(row, labelEl);

    const valueEl = this.renderer.createElement('span');
    this.renderer.setStyle(valueEl, 'color', '#ffffff');
    this.renderer.setStyle(valueEl, 'word-break', 'break-word');
    this.renderer.setStyle(valueEl, 'line-height', '1.4');
    const valueText = this.renderer.createText(value);
    this.renderer.appendChild(valueEl, valueText);
    this.renderer.appendChild(row, valueEl);

    this.renderer.appendChild(container, row);
  }

  private hideNewArticleTooltip(): void {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

}

