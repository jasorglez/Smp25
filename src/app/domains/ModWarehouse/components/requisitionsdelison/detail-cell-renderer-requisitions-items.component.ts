import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { MaterialsService } from 'app/services/materials.service';
import { SignalsService } from 'app/services/signals.service';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { firstValueFrom } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ReceiptsDelisonService } from 'app/services/receipts-delison.service';
import { TypexPrefixesService } from 'app/services/typexprefixes.service';
import { CatalogsService } from 'app/services/catalogs.service';

@Component({
  selector: 'app-detail-cell-renderer-requisitions-items',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, SelectWithTooltipEditorV2Component, MultiLineEditorComponent],
  template: `
    <!-- Items Grid View -->
    <div *ngIf="detailType === 'items'" style="padding: 5px; background-color: #e3f2fd; height: 100%; max-height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
      <div style="margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
        <strong>Artículos de la Requisición</strong>
        <div class="d-flex gap-2">
        
       <button class="btn btn-primary btn-sm me-2" (click)="addItem()">
          <i class="bi bi-plus-lg"></i> Agregar
        </button>
        
        <button class="btn btn-warning btn-sm me-2" (click)="discardChanges()">
          <i class="bi bi-arrow-counterclockwise"></i> Deshacer
        </button>
        
        <button class="btn btn-danger btn-sm me-2" (click)="deleteSelectedItem()" [disabled]="!isAddingNewItem && !hasPedimentoSelection">
          <i class="bi bi-trash"></i> Eliminar
        </button>
        
        <button class="btn btn-success btn-sm position-relative" (click)="saveChanges()" [disabled]="!isAddingNewItem">
          <i class="bi bi-floppy"></i> Guardar
          <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
            *ngIf="isAddingNewItem">
            <span class="visually-hidden">Hay cambios sin guardar</span>
          </span>
        </button>

           <button class="btn btn-info btn-sm position-relative" (click)="saveMultiGuardar()">
          <i class="bi bi-files"></i> MultiGuardar
          <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
            *ngIf="hasPedimentoSelection">
            <span class="visually-hidden">Hay cambios sin guardar</span>
          </span>
        </button>
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
        [components]="components"
        style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>
    </div>

    <!-- Modal para Nuevo Artículo -->
    <div class="modal" tabindex="-1" [ngStyle]="{'display': isNewArticleModalVisible ? 'block' : 'none'}">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header bg-success text-white">
            <h5 class="modal-title">
              <i class="bi bi-plus-circle me-2"></i>
              Registrar Nuevo Material
            </h5>
            <button type="button" class="btn-close btn-close-white" (click)="closeNewArticleModal()"></button>
          </div>
          <div class="modal-body">
            <!-- Descripción del Material -->
            <div class="row mb-3">
              <div class="col-12">
                <label for="newArticleDesc" class="form-label fw-bold">
                  <i class="bi bi-file-text me-1"></i>
                  Descripción/Nombre del Material <span class="text-danger">*</span>
                </label>
                <input type="text" class="form-control" id="newArticleDesc" [(ngModel)]="newArticle.description" placeholder="Ingrese el nombre del material">
                <small class="form-text text-muted">El número de material se generará automáticamente</small>
              </div>
            </div>

            <div class="row">
              <!-- Categoría -->
              <div class="col-md-4 mb-3">
                <label for="newArticleCategory" class="form-label fw-bold">
                  <i class="bi bi-folder me-1"></i>
                  Categoría <span class="text-danger">*</span>
                </label>
                <select class="form-select" id="newArticleCategory" [(ngModel)]="newArticle.idCategory" (ngModelChange)="onCategoryChange()">
                  <option [ngValue]="0" selected>Seleccione una categoría</option>
                  <option *ngFor="let cat of categories" [ngValue]="cat.id">
                    {{ cat.description }}
                  </option>
                </select>
              </div>

              <!-- Familia -->
              <div class="col-md-4 mb-3">
                <label for="newArticleFamily" class="form-label fw-bold">
                  <i class="bi bi-diagram-3 me-1"></i>
                  Familia <span class="text-danger">*</span>
                </label>
                <select class="form-select" id="newArticleFamily" [(ngModel)]="newArticle.idFamilia" [disabled]="!newArticle.idCategory" (ngModelChange)="onFamilyChange()">
                  <option [ngValue]="0" selected>Seleccione una familia</option>
                  <option *ngFor="let fam of filteredFamilies" [ngValue]="fam.id">
                    {{ fam.description }}
                  </option>
                </select>
              </div>

              <!-- Subfamilia -->
              <div class="col-md-4 mb-3">
                <label for="newArticleSubfamily" class="form-label fw-bold">
                  <i class="bi bi-diagram-2 me-1"></i>
                  Subfamilia <span class="text-danger">*</span>
                </label>
                <select class="form-select" id="newArticleSubfamily" [(ngModel)]="newArticle.idSubfamilia" [disabled]="!newArticle.idFamilia">
                  <option [ngValue]="0" selected>Seleccione una subfamilia</option>
                  <option *ngFor="let sub of filteredSubfamilies" [ngValue]="sub.id">
                    {{ sub.description }}
                  </option>
                </select>
              </div>
            </div>

            <div class="alert alert-info mb-0">
              <i class="bi bi-info-circle me-2"></i>
              <strong>Nota:</strong> Todos los campos son obligatorios. El número de material será generado automáticamente al guardar.
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeNewArticleModal()">
              <i class="bi bi-x-lg me-1"></i>
              Cancelar
            </button>
            <button type="button" class="btn btn-primary" (click)="saveNewArticle()">
              <i class="bi bi-floppy me-1"></i>
              Guardar Material
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Backdrop para el modal -->
    <div class="modal-backdrop fade show" *ngIf="isNewArticleModalVisible"></div>

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
export class DetailCellRendererRequisitionsItemsComponent implements OnInit, OnDestroy {

  private params!: any;
  private gridApi!: GridApi;
  private context: any;
  private ocAndReqsService = inject(OcAndReqsService);
  private materialsService = inject(MaterialsService);
  private signalsService = inject(SignalsService);
  private modalService = inject(ModalService);
  private sanitizer = inject(DomSanitizer);
  private receiptsDelisonService = inject(ReceiptsDelisonService);
  private typexPrefixesService = inject(TypexPrefixesService);
  private catalogsService = inject(CatalogsService);

  rowData: any[] = [];
  originalRowData: any[] = []; // Para poder deshacer cambios
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  isAddingNewItem: boolean = false;
  hasPedimentoSelection: boolean = false;
  materials: any[] = [];
  private pedimentoCounter: number = 1;
  requisitionId: number = 0;
  idRoot: number | null = null;
  providersCache: Map<string, any[]> = new Map(); // Cache para proveedores por material+tipo

  // PDF properties
  detailType: string = 'items';
  requisitionData: any = null;
  pdfUrl: SafeResourceUrl | null = null;
  private originalPdfUrl: string | null = null;

  // Propiedades para el modal de nuevo artículo
  isNewArticleModalVisible = false;
  newArticle = {
    description: '',
    idCategory: 0,
    idFamilia: 0,
    idSubfamilia: 0
  };
  private currentRowForNewArticle: any = null;
  private originalRecurrentValue: string | null = null;

  // Catálogos para el modal
  categories: any[] = [];
  families: any[] = [];
  subfamilies: any[] = [];

  // Catálogos filtrados (cache para evitar recálculos en cada ciclo de change detection)
  filteredFamilies: any[] = [];
  filteredSubfamilies: any[] = [];




  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    this.loadData();
    this.loadCatalogs();
  }

  agInit(params: any): void {
    this.params = params;
    this.context = params.context;
    this.requisitionData = params.data;
    this.detailType = params.data.detailType || 'items';

    if (this.detailType === 'items') {
      this.loadMaterials();
      this.loadData();
    } else if (this.detailType === 'pdf') {
      this.generatePDF();
    }
  }

  loadData() {
    if (!this.params || !this.params.data) {
      console.warn('⚠️ No hay params disponibles para cargar items');
      return;
    }

    this.requisitionId = this.params.data.id;

    console.log('🔍 ==================== DEBUG ITEMS COMPONENT ====================');
    console.log('📦 ID de requisición que se está abriendo:', this.requisitionId);
    console.log('📋 Datos completos de la fila:', this.params.data);
    console.log('🔢 Tipo de dato del ID:', typeof this.requisitionId);
    console.log('================================================================');

    // ✅ Llamar al servicio real
    this.ocAndReqsService.getReqItems(this.requisitionId).subscribe({
      next: (data: any) => {
        console.log('✅ Items recibidos del servidor:', data);

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
          dateuse: item.dateuse || new Date().toISOString(),
          active: item.active !== undefined ? item.active : true,
          recurrent: item.recurrent || 'Recurrente', // Por defecto recurrente
          nameArticle: item.nameArticle || '',
          numArticle: item.numArticle || '',
          provint: item.provint || '',
          typePriority: item.typePriority || 'Normal',
          pedimiento: item.pedimento || false, // ✅ Cargar desde backend, siempre debe ser false después de Multiguardar
          pedimentoNumber: item.pedimentoNum || '', // ✅ String con números separados por coma (ej: "1,3,4,6")
          __isNew: false,
          __modified: false,
          saved: true
        })) : [];

        this.originalRowData = JSON.parse(JSON.stringify(this.rowData));

        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
          this.gridApi.redrawRows();
        }

        console.log('✅ Items cargados:', this.rowData.length);

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
      console.warn('⚠️ No hay idRoot disponible para cargar materiales');
      this.materials = [];
      return;
    }

    console.log('📦 Cargando materiales desde endpoint con idRoot:', this.idRoot);

    // Cargar materiales desde el endpoint real
    this.materialsService.getMaterialsxview(this.idRoot).subscribe({
      next: (data) => {
        // Mapear los datos del endpoint al formato esperado por el SearchableSelect
        this.materials = data
          .filter(material => material.vigente) // Solo materiales activos
          .map(material => ({
            id: material.id,
            description: material.articulo,  // Nombre del artículo
            code: material.insumo,            // Código/número de material
            measure: material.measure || '',
            active: material.vigente,
            // Campos adicionales que podrían ser útiles
            idCategory: material.idCategory,
            idFamilia: material.idFamilia,
            idSubfamilia: material.idSubfamilia
          }));

        console.log(`✅ Materiales cargados: ${this.materials.length} items`);
      },
      error: (error) => {
        console.error('❌ Error al cargar materiales:', error);
        alerts.basicAlert('Error', 'No se pudieron cargar los materiales', 'error');
        this.materials = [];
      }
    });
  }

  async loadCatalogs() {
    // Obtener idRoot desde el signal service
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();

    if (!this.idRoot) {
      console.warn('⚠️ No hay idRoot disponible para cargar catálogos');
      return;
    }

    try {
      console.log('📦 Cargando catálogos para modal de nuevo artículo con idRoot:', this.idRoot);

      // Cargar en paralelo: categorías, familias y subfamilias
      [this.categories, this.families, this.subfamilies] = await Promise.all([
        firstValueFrom(this.catalogsService.getCatalogsMaterialBit(this.idRoot, 'CATEGORY')),
        firstValueFrom(this.catalogsService.getCatalogsMaterialBit(this.idRoot, 'FAM-CAT')),
        firstValueFrom(this.catalogsService.getCatalogsMaterialBit(this.idRoot, 'SUB-FAM'))
      ]);

      console.log('✅ Catálogos cargados:', {
        categories: this.categories.length,
        families: this.families.length,
        subfamilies: this.subfamilies.length
      });

    } catch (error) {
      console.error('❌ Error al cargar catálogos:', error);
      this.categories = [];
      this.families = [];
      this.subfamilies = [];
    }
  }

  onCategoryChange() {
    // Resetear familia y subfamilia cuando cambia la categoría
    console.log('🔄 Categoría cambiada:', this.newArticle.idCategory);
    this.newArticle.idFamilia = 0;
    this.newArticle.idSubfamilia = 0;

    // Pre-calcular familias filtradas (cache)
    this.filteredFamilies = this.newArticle.idCategory
      ? this.families.filter(f => f.parentId === this.newArticle.idCategory)
      : [];
    this.filteredSubfamilies = [];

    console.log('✅ Familias disponibles:', this.filteredFamilies.length);
  }

  onFamilyChange() {
    // Resetear subfamilia cuando cambia la familia
    console.log('🔄 Familia cambiada:', this.newArticle.idFamilia);
    this.newArticle.idSubfamilia = 0;

    // Pre-calcular subfamilias filtradas (cache)
    this.filteredSubfamilies = this.newArticle.idFamilia
      ? this.subfamilies.filter(sf => sf.subParentId === this.newArticle.idFamilia)
      : [];

    console.log('✅ Subfamilias disponibles:', this.filteredSubfamilies.length);
  }

  async loadProviders(materialId: number, type: string): Promise<any[]> {
    const cacheKey = `${materialId}_${type}`;

    // Verificar si ya están en caché
    if (this.providersCache.has(cacheKey)) {
      return this.providersCache.get(cacheKey)!;
    }

    try {
      const providers = await firstValueFrom(
        this.ocAndReqsService.getProviders(materialId, type)
      );

      // Guardar en caché
      this.providersCache.set(cacheKey, providers);

      console.log(`✅ Proveedores cargados para material ${materialId} tipo ${type}:`, providers.length);
      return providers;
    } catch (error) {
      console.error('❌ Error al cargar proveedores:', error);
      return [];
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  private _colDefs: ColDef[] = [];

  get colDefs(): ColDef[] {
    if (this._colDefs.length > 0) {
      return this._colDefs;
    }

    this._colDefs = [
      {
        headerName: '#',
        width: 50,
        valueGetter: (params) => params.node.rowIndex + 1,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
      },

      {
        field: 'recurrent',
        headerName: 'Recurrente',
        width: 120,
        editable: (params) => {
          // Solo es editable si el valor NO es 'Nuevo'.
          return params.data.recurrent !== 'Nuevo';
        },
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Recurrente', 'Nuevo']
        },
      },

      {
        field: 'article',
        headerName: 'Articulos',
        width: 200,
        cellDataType: false, // Desactivar auto-detección de tipo
        editable: (params) => {
          // Solo es editable con SelectWithTooltipEditorV2 si es "Recurrente"
          return params.data.recurrent !== 'Nuevo';
        },
        cellEditor: SelectWithTooltipEditorV2Component,
        cellEditorParams: (params: any) => {
          // ✅ Filtrar materiales que ya están siendo usados en otras filas
          const usedMaterialIds = this.rowData
            .filter(row =>
              row.id !== params.data.id && // Excluir la fila actual
              row.materialId // Solo filas con material asignado
            )
            .map(row => row.materialId);

          const availableMaterials = this.materials.filter(
            m => !usedMaterialIds.includes(m.id)
          );

          console.log('🔧 SelectWithTooltipEditorV2 params:', {
            totalMaterials: this.materials?.length || 0,
            usedMaterials: usedMaterialIds.length,
            availableMaterials: availableMaterials.length,
            currentRowId: params.data.id
          });

          return {
            options: availableMaterials.map(m => ({
              id: m.id,
              description: m.description,
              valueAddition: m.code || '',
              valueAddition2: m.measure || ''
            }))
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
              console.log(`✅ Proveedores pre-cargados para material ${selectedMaterial.id} tipo ${type}`);
            });

            // Refrescar las celdas para mostrar el articleNumber actualizado y limpiar proveedor
            this.gridApi.refreshCells({
              rowNodes: [params.node],
              columns: ['articleNumber', 'idProvider'],
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
              description: '',
              idCategory: 0,
              idFamilia: 0,
              idSubfamilia: 0
            };
            this.isNewArticleModalVisible = true;
          }
        },
        cellStyle: (params: any) => {
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
        width: 120,
        editable: false,
        valueSetter: (params: any) => {
          params.data.numArticle = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'quantity',
        headerName: 'cantidad',
        width: 100,
        editable: true,
        type: 'numericColumn',
      },
      {
        field: 'intorext',
        headerName: 'Tipo',
        width: 100,
        editable: true,
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
                console.log(`✅ Proveedores pre-cargados para material ${materialId} tipo ${params.newValue}`);
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
        headerName: 'Proveedor',
        width: 250,
        editable: (params) => {
          // Solo editable si hay un material seleccionado
          const materialId = params.data.idSupplie || params.data.materialId || 0;
          return materialId > 0;
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

          const cacheKey = `${materialId}_${type}`;

          // Buscar proveedores en el caché
          const providers = this.providersCache.get(cacheKey) || [];

          console.log(`🔍 cellEditorParams - Material: ${materialId}, Tipo: ${type}, Proveedores en caché: ${providers.length}`);

          return {
            options: providers.map(p => ({
              id: p.idProvider,
              description: p.providerName
            }))
          };
        },
        onCellClicked: async (params: any) => {
          // Pre-cargar proveedores cuando se hace clic en la celda
          const materialId = params.data.idSupplie || params.data.materialId || 0;
          const type = params.data.intorext || 'Externo';

          if (materialId > 0) {
            console.log(`🔄 Pre-cargando proveedores para material ${materialId} tipo ${type}`);
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
            const type = params.data.intorext || 'Externo';
            const cacheKey = `${materialId}_${type}`;

            if (this.providersCache.has(cacheKey)) {
              const providers = this.providersCache.get(cacheKey)!;
              const selectedProvider = providers.find(p => p.idProvider === newValue);
              if (selectedProvider) {
                params.data.nameProvider = selectedProvider.providerName;
                console.log(`✅ Proveedor seleccionado: ${selectedProvider.providerName}`);
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
          if (materialId === 0) {
            return { backgroundColor: '#f9f9f9', color: '#999', cursor: 'not-allowed' };
          }
          return { cursor: 'pointer' };
        }
      },

      {
        field: 'typePriority',
        headerName: 'Tipo Prioridad',
        width: 120,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Normal', 'Urgente']
        },
      },
      {
        field: 'comment',
        headerName: 'Observaciones',
        width: 160,
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
      },

      {
        field: 'pedimiento',
        headerName: 'Pedimiento',
        width: 100,
        editable: true,
        cellRenderer: (params: any) => {
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = params.value === true;

          input.addEventListener('change', () => {
            params.data.pedimiento = input.checked;
            params.api.refreshCells({ rowNodes: [params.node], columns: ['pedimiento'] });
            this.checkPedimentoSelection();
            // Refresh master grid comments column
            if (this.context && this.context.gridApi) {
              this.context.gridApi.refreshCells({ force: true });
            }
          });

          return input;
        }
      },

      {
        field: 'pedimentoNumber',
        headerName: 'Pedimento #',
        width: 140,
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
    const anyChecked = this.rowData.some(item => item.pedimiento === true);
    this.hasPedimentoSelection = anyChecked;
  }

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    animateRows: true,
    rowSelection: 'multiple',
    singleClickEdit: false, // Doble-click para editar (como tipo-proveedor)
    domLayout: 'normal', // El grid se ajusta al contenedor y permite scroll
    suppressHorizontalScroll: false,
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

  deleteSelectedItem() {
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un item para eliminar', 'warning');
      return;
    }

    const selectedItem = selectedRows[0];
    if (this.context && this.context.ITEMS && this.context.ITEMS.delete) {
      this.context.ITEMS.delete({ data: selectedItem, api: this.gridApi }, () => {
        this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
        this.gridApi.setGridOption('rowData', this.rowData);
        this.hasUnsavedChanges = true;

        if (this.context && this.context.ITEMS && this.context.ITEMS.updateCount) {
          this.context.ITEMS.updateCount(this.params.data.id, this.rowData.length);
        }
      });
    }
  }

  saveChanges() {
    if (!this.isAddingNewItem) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    // Filtrar items nuevos y modificados
    const newItems = this.rowData.filter(item => item.__isNew);
    const modifiedItems = this.rowData.filter(item => item.__modified && !item.__isNew);

    if (newItems.length === 0 && modifiedItems.length === 0) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    // Guardar items nuevos (POST)
    const newItemsPromises = newItems.map(item => {
      // Si el artículo fue creado como "Nuevo", idSupplie debe ser 0
      const isNewArticle = item.recurrent === 'Nuevo';

      const payload = {
        idMovement: this.requisitionId,
        idSupplie: isNewArticle ? 0 : (item.idSupplie || item.materialId || 0),
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
        dateuse: item.dateuse || new Date().toISOString(),
        active: item.active !== undefined ? item.active : true,
        numArticle: item.numArticle || '',
        provint: item.provint || '',
        pedimento: item.pedimiento || false, // ✅ Estado del checkbox
        pedimentoNum: item.pedimentoNumber || '' // ✅ String con números separados por coma
      };

      console.log('📤 POST - Enviando item nuevo al endpoint:', payload);

      return firstValueFrom(this.ocAndReqsService.addReqItem(payload));
    });

    // Guardar items modificados (PUT) - enviar la fila completa
    const modifiedItemsPromises = modifiedItems.map(item => {
      // Si el artículo fue cambiado a "Nuevo", idSupplie debe ser 0
      const isNewArticle = item.recurrent === 'Nuevo';

      const payload = {
        id: item.id,
        idMovement: this.requisitionId,
        idSupplie: isNewArticle ? 0 : (item.idSupplie || item.materialId || 0),
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
        dateuse: item.dateuse || new Date().toISOString(),
        active: item.active !== undefined ? item.active : true,
        numArticle: item.numArticle || '',
        provint: item.provint || '',
        pedimento: item.pedimiento || false, // ✅ Estado del checkbox
        pedimentoNum: item.pedimentoNumber || '' // ✅ String con números separados por coma
      };

      console.log('📤 PUT - Enviando item modificado al endpoint:', payload);

      return firstValueFrom(this.ocAndReqsService.updateReqItem(item.id.toString(), payload));
    });

    // Ejecutar todas las promesas
    Promise.all([...newItemsPromises, ...modifiedItemsPromises])
      .then(() => {
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
        alerts.basicAlert('Guardado', `Se guardaron ${totalSaved} artículo(s) exitosamente.`, 'success');

        // Recargar datos desde el servidor
        this.loadData();
      })
      .catch((error) => {
        console.error('Error al guardar artículos:', error);
        alerts.basicAlert('Error', 'Ocurrió un error al guardar los artículos', 'error');
      });
  }

  async saveMultiGuardar() {
    // 1. Validar que haya al menos un item seleccionado
    const checkedItems = this.rowData.filter(item => item.pedimiento === true);
    if (checkedItems.length === 0) {
      alerts.basicAlert('Sin selección', 'Por favor, marque al menos un item en la columna "Pedimento".', 'warning');
      return;
    }

    try {
      console.log('🔵 ========== INICIANDO CREACIÓN DE COTIZACIÓN ==========');

      // 2. Obtener datos de la requisición original
      const requisicionOriginal = this.params.data;
      console.log('📋 Requisición original:', requisicionOriginal);
      console.log('   ID:', requisicionOriginal.id);
      console.log('   Sucursal (idReference):', requisicionOriginal.idReference);
      console.log('   Folio:', requisicionOriginal.requisitionNumber);

      // 3. Consultar cuántas cotizaciones ya existen para esta requisición
      const cotizacionesExistentes: any = await firstValueFrom(
        this.ocAndReqsService.getOcAndReqs('requisition', requisicionOriginal.id, 'COTIZ')
      );

      const numCotizaciones = Array.isArray(cotizacionesExistentes) ? cotizacionesExistentes.length : 0;
      const siguienteNumeroPedimento = numCotizaciones + 1;

      console.log('📊 Cotizaciones existentes:', numCotizaciones);
      console.log('🔢 Siguiente número de pedimento:', siguienteNumeroPedimento);

      // 4. Obtener el prefijo de la sucursal para generar el folio
      const prefixData: any = await firstValueFrom(
        this.typexPrefixesService.getPrefix('branch', requisicionOriginal.idReference)
      );

      const siguienteConsecutivo = (prefixData.consecutive || 0) + 1;
      const folioCotizacion = `${prefixData.prefix || ''}${siguienteConsecutivo}`;

      console.log('📝 Prefijo obtenido:', prefixData);
      console.log('📄 Folio de la cotización:', folioCotizacion);

      // 5. Crear el maestro de la cotización
      const maestroCotizacion = {
        id: 0,
        folio: folioCotizacion,
        typeReference: 'requisition',
        idReq: 0,
        idReference: requisicionOriginal.id, // ✅ Relación con la requisición original
        dateCreate: new Date().toISOString(),
        idProvider: 0,
        idDepartament: requisicionOriginal.departmentId || 0,
        delivery: requisicionOriginal.delivery || 'NO APLICA',
        deliveryTime: requisicionOriginal.deliveryTime || '1 DAY',
        typeOc: requisicionOriginal.typeOc || 'INSUMOS',
        dateSupply: requisicionOriginal.dateSupply || new Date().toISOString(),
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

      console.log('📤 ========== MAESTRO COTIZACIÓN - DATA A ENVIAR ==========');
      console.log(JSON.stringify(maestroCotizacion, null, 2));

      // Crear el maestro en la BD
      const cotizacionCreada: any = await firstValueFrom(
        this.ocAndReqsService.addOcAndReq(maestroCotizacion)
      );

      console.log('✅ Cotización creada:', cotizacionCreada);
      const idCotizacion = cotizacionCreada.id || cotizacionCreada.ID;

      if (!idCotizacion) {
        throw new Error('No se pudo obtener el ID de la cotización creada');
      }

      console.log('🆔 ID de cotización creada:', idCotizacion);

      // 6. Crear los detalles de la cotización (items seleccionados)
      console.log('📦 Creando detalles de la cotización...');

      for (const item of checkedItems) {
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
          dateuse: item.dateuse || new Date().toISOString(),
          active: true,
          recurrent: item.recurrent || 'Recurrente',
          numArticle: item.numArticle || '',
          provint: item.provint || '',
          typePriority: item.typePriority || 'Normal'
        };

        console.log('📤 Detalle a crear:', detallePayload);

        await firstValueFrom(
          this.ocAndReqsService.addReqItem(detallePayload)
        );
      }

      console.log('✅ Todos los detalles fueron creados');

      // 7. Actualizar el consecutivo del prefijo
      const updatedPrefixData = {
        reqType: 'branch',
        idReqType: requisicionOriginal.idReference,
        prefix: prefixData.prefix,
        consecutive: siguienteConsecutivo,
        active: true
      };

      await firstValueFrom(
        this.typexPrefixesService.updatePrefix('branch', requisicionOriginal.idReference, updatedPrefixData)
      );

      console.log('✅ Consecutivo actualizado');

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
      console.log('📤 Guardando items de requisición con pedimentoNumber actualizado...');

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
          dateuse: item.dateuse || new Date().toISOString(),
          active: item.active !== undefined ? item.active : true,
          recurrent: item.recurrent || 'Recurrente',
          numArticle: item.numArticle || '',
          provint: item.provint || '',
          typePriority: item.typePriority || 'Normal',
          pedimento: false, // ✅ SIEMPRE false después de Multiguardar para permitir múltiples cotizaciones
          pedimentoNum: item.pedimentoNumber || '' // ✅ String con números separados por coma (ej: "1,3,4,6")
        };

        console.log(`📤 Actualizando item ${item.id} con pedimentoNum: ${item.pedimentoNumber} (pedimento: false)`);

        await firstValueFrom(
          this.ocAndReqsService.updateReqItem(item.id.toString(), updatePayload)
        );
      }

      console.log('✅ Items actualizados en la base de datos');

      // 10. ✅ Actualizar el detailData en el maestro para refrescar "Cumplimiento Pedimento"
      if (this.context && this.context.ITEMS && this.context.ITEMS.save) {
        console.log('📊 Actualizando detailData en el maestro después de Multiguardar');
        this.context.ITEMS.save(this.requisitionId, this.rowData, false);
      }

      // 11. Redibujar el grid
      this.hasPedimentoSelection = false;
      this.gridApi.redrawRows();

      // 12. Mostrar mensaje de éxito
      const message = `Cotización ${folioCotizacion} creada exitosamente con ${checkedItems.length} artículo(s). Pedimento #${siguienteNumeroPedimento}`;
      alerts.basicAlert('Cotización Creada', message, 'success');

      console.log('✅ ========== COTIZACIÓN CREADA EXITOSAMENTE ==========');

    } catch (error) {
      console.error('❌ Error al crear cotización:', error);
      alerts.basicAlert('Error', 'No se pudo crear la cotización. Revise la consola para más detalles.', 'error');
    }
  }

  discardChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por descartar', 'info');
      return;
    }

    this.loadData();
    this.hasUnsavedChanges = false;
    if (this.gridApi) {
      this.gridApi.redrawRows();
    }
  }

  onCellValueChanged(event: any) {
    // Marcar la fila como modificada
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
    this.isAddingNewItem = true;

    // Si el cambio es en la columna 'recurrent' y el valor es 'Nuevo', abrir el modal
    if (event.colDef.field === 'recurrent' && event.newValue === 'Nuevo') {
      this.currentRowForNewArticle = event.node;
      this.originalRecurrentValue = event.oldValue; // Guardar valor original por si cancela
      this.newArticle = { description: '', idCategory: 0, idFamilia: 0, idSubfamilia: 0 }; // Resetear el formulario
      this.isNewArticleModalVisible = true;
    }
  }

  async saveNewArticle() {
    // Validaciones
    if (!this.newArticle.description || !this.newArticle.description.trim()) {
      alerts.basicAlert('Validación', 'La descripción del artículo es obligatoria.', 'warning');
      return;
    }

    if (!this.newArticle.idCategory || this.newArticle.idCategory === 0) {
      alerts.basicAlert('Validación', 'Debe seleccionar una categoría.', 'warning');
      return;
    }

    if (!this.newArticle.idFamilia || this.newArticle.idFamilia === 0) {
      alerts.basicAlert('Validación', 'Debe seleccionar una familia.', 'warning');
      return;
    }

    if (!this.newArticle.idSubfamilia || this.newArticle.idSubfamilia === 0) {
      alerts.basicAlert('Validación', 'Debe seleccionar una subfamilia.', 'warning');
      return;
    }

    try {
      console.log('💾 Guardando nuevo material en la base de datos...');
      console.log('📋 Datos del formulario:', this.newArticle);
      console.log('🏢 idRoot:', this.idRoot);

      // Preparar el payload siguiendo la estructura de materiales-maestro
      // El backend generará automáticamente el número de material (insumo)
      const materialPayload = {
        idCompany: this.idRoot,
        idBranch: null,
        typeOcorReq: '',
        idCustomer: null,
        insumo: '', // El backend lo genera automáticamente
        barCode: '',
        barcode: '',
        company: '',
        articulo: this.newArticle.description.trim(),
        idCategory: this.newArticle.idCategory,
        idFamilia: this.newArticle.idFamilia,
        idSubfamilia: this.newArticle.idSubfamilia,
        idMedida: 0,
        idUbication: 0,
        description: this.newArticle.description.trim(),
        folio: '',
        price: 0,
        quantity: 0,
        date: new Date().toISOString(),
        merma: 0,
        fecha: new Date().toISOString(),
        aplicaResg: false,
        costoMN: 0,
        costoDLL: 0,
        ventaMN: 0,
        ventaDLL: 0,
        stockMin: 0,
        stockMax: 0,
        picture: '',
        typeMaterial: 'CONSUMABLE',
        folioOcorReq: '',
        vigente: true,
        active: true
      };

      console.log('📤 Payload del nuevo material (insumo será generado por el backend):', materialPayload);
      console.log('🔧 Llamando a materialsService.addMaterial...');

      // Guardar en la base de datos
      const response: any = await firstValueFrom(
        this.materialsService.addMaterial(materialPayload)
      );

      console.log('✅ Material guardado exitosamente. Respuesta del backend:', response);
      console.log('⚠️ El backend retorna id:0 e insumo vacío, necesitamos recargar los materiales');

      // El backend NO retorna el ID ni el número generado en la respuesta
      // Necesitamos recargar los materiales y buscar el recién creado por descripción
      console.log('🔄 Esperando 500ms antes de recargar materiales...');

      // Esperar un poco para que el backend indexe el material
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('🔄 Recargando lista de materiales...');

      // Intentar hasta 3 veces con delays incrementales
      let createdMaterial: any = null;
      let allMaterials: any[] = [];

      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`🔄 Intento ${attempt}/3 de recargar materiales...`);

        allMaterials = await firstValueFrom(
          this.materialsService.getMaterialsxview(this.idRoot)
        );

        console.log(`📦 Materiales recargados en intento ${attempt}:`, allMaterials.length);

        // Buscar el material recién creado por descripción, categoría, familia y subfamilia
        createdMaterial = allMaterials.find((m: any) =>
          m.description === this.newArticle.description.trim() &&
          m.idCategory === this.newArticle.idCategory &&
          m.idFamilia === this.newArticle.idFamilia &&
          m.idSubfamilia === this.newArticle.idSubfamilia
        );

        if (createdMaterial) {
          console.log(`✅ Material encontrado en intento ${attempt}!`);
          break;
        }

        if (attempt < 3) {
          console.log(`⏳ Material no encontrado, esperando ${attempt * 500}ms antes del siguiente intento...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 500));
        }
      }

      if (!createdMaterial) {
        throw new Error('No se pudo encontrar el material recién creado después de 3 intentos. El material fue guardado pero no aparece en la lista. Por favor, recargue la página manualmente.');
      }

      console.log('✅ Material encontrado:', createdMaterial);

      const newMaterialId = createdMaterial.id;
      const backendGeneratedNumber = createdMaterial.insumo || createdMaterial.code || '';

      console.log('🔢 ID del material:', newMaterialId);
      console.log('🔢 Número generado por el backend:', backendGeneratedNumber);

      // Actualizar la fila actual con el ID del material creado y el número generado por el backend
      this.currentRowForNewArticle.data.idSupplie = newMaterialId;
      this.currentRowForNewArticle.data.materialId = newMaterialId;
      this.currentRowForNewArticle.data.article = this.newArticle.description.trim();
      this.currentRowForNewArticle.data.nameArticle = this.newArticle.description.trim();
      this.currentRowForNewArticle.data.code = backendGeneratedNumber;
      this.currentRowForNewArticle.data.numArticle = backendGeneratedNumber;
      this.currentRowForNewArticle.data.description = this.newArticle.description.trim();
      this.currentRowForNewArticle.data.__modified = true;
      this.hasUnsavedChanges = true;

      // Actualizar la lista local de materiales con todos los materiales recargados
      this.materials = allMaterials.map(m => ({
        id: m.id,
        description: m.description,
        code: m.insumo || m.code,
        measure: m.measure || '',
        active: m.active,
        idCategory: m.idCategory,
        idFamilia: m.idFamilia,
        idSubfamilia: m.idSubfamilia
      }));

      this.gridApi.refreshCells({
        rowNodes: [this.currentRowForNewArticle],
        columns: ['article', 'numArticle'],
        force: true
      });

      alerts.basicAlert('Éxito', `Material registrado exitosamente con número ${backendGeneratedNumber}.`, 'success');
      this.closeNewArticleModal();

    } catch (error: any) {
      console.error('❌ Error al guardar el material:', error);
      console.error('❌ Tipo de error:', typeof error);
      console.error('❌ Error name:', error?.name);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error stack:', error?.stack);

      if (error?.error) {
        console.error('❌ Error.error:', error.error);
      }

      if (error?.status) {
        console.error('❌ HTTP Status:', error.status);
        console.error('❌ HTTP StatusText:', error.statusText);
      }

      const errorMsg = error?.error?.message || error?.message || 'Error desconocido al guardar el material';
      alerts.basicAlert('Error', errorMsg, 'error');
    }
  }

  closeNewArticleModal() {
    this.isNewArticleModalVisible = false;
    this.currentRowForNewArticle = null;
  }

  onCellClicked(event: any): void {
    event.node.setSelected(true);

    // Si se hace clic en la columna 'Recurrente' y su valor es 'Nuevo', abrir el modal para editar.
    if (event.column.getColId() === 'recurrent' && event.data.recurrent === 'Nuevo') {
      this.currentRowForNewArticle = event.node;
      // Cargar los datos del artículo temporal guardados previamente en la fila.
      this.newArticle = { ...(event.data.newArticleInfo || { name: '', description: '', link: '', usage: '' }) };
      this.isNewArticleModalVisible = true;
      return;
    }
  }


  // ==================== PDF METHODS ====================

  async generatePDF() {
    if (!this.requisitionData || !this.requisitionData.id) {
      console.error('No hay datos de requisición para generar PDF');
      this.pdfUrl = null;
      return;
    }

    console.log('🔄 Generando PDF para requisición:', this.requisitionData.id);

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
        console.log('✅ PDF generado y cargado en el iframe');
      } else {
        console.error('⚠️ El servicio no retornó un Blob');
        this.pdfUrl = null;
      }

    } catch (error) {
      console.error('❌ Error al generar PDF:', error);
      this.pdfUrl = null;
      alerts.basicAlert('Error', 'No se pudo generar el PDF de la requisición', 'error');
    }
  }

  closeReport() {
    // Emit event to parent component to handle collapse
    if (this.context && this.context.componentParent) {
      this.context.componentParent.collapsePdfDetail(this.requisitionData.id);
    }
  }

  ngOnDestroy() {
    // Clean up blob URL when component is destroyed
    if (this.originalPdfUrl) {
      URL.revokeObjectURL(this.originalPdfUrl);
      this.originalPdfUrl = null;
    }
  }

}
