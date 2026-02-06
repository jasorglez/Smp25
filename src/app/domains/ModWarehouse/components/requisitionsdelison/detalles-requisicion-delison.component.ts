import { Component, OnInit, OnDestroy, inject, Renderer2, RendererFactory2 } from '@angular/core';
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
import { AuthService } from 'app/services/auth.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ReceiptsDelisonService } from 'app/services/receipts-delison.service';
import { TypexPrefixesService } from 'app/services/typexprefixes.service';

@Component({
  selector: 'app-detalles-requisicion-delison',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, SelectWithTooltipEditorV2Component, MultiLineEditorComponent],
  template: `
    <!-- Items Grid View -->
    <div *ngIf="detailType === 'items'" style="padding: 5px; background-color: #e3f2fd; height: 100%; max-height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
      <div style="margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
        <strong>Artículos de la Requisición</strong>
        <div class="d-flex gap-2">
        
       <button class="btn btn-primary btn-sm me-2" (click)="addItem()" *ngIf="authService.getCrudPermissionDetail('shoppingDelison', 'requisitions','Req_Art', 'create')">
          <i class="bi bi-plus-lg"></i> Agregar
        </button>
        
        <button class="btn btn-warning btn-sm me-2" (click)="discardChanges()"  >
          <i class="bi bi-arrow-counterclockwise"></i> Deshacer
        </button>
        
        <button class="btn btn-danger btn-sm me-2" (click)="deleteSelectedItem()" [disabled]="!hasRowSelected" *ngIf="authService.getCrudPermissionDetail('shoppingDelison', 'requisitions','Req_Art', 'delete')">
          <i class="bi bi-trash"></i> Eliminar
        </button>
        
        <button class="btn btn-success btn-sm position-relative" (click)="saveChanges()" [disabled]="!isAddingNewItem" *ngIf="authService.getCrudPermissionDetail('shoppingDelison', 'requisitions','Req_Art', 'create') || authService.getCrudPermissionDetail('shoppingDelison', 'requisitions','Req_Art', 'update')">
          <i class="bi bi-floppy"></i> Guardar
          <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
            *ngIf="isAddingNewItem">
            <span class="visually-hidden">Hay cambios sin guardar</span>
          </span>
        </button>

           <button class="btn btn-info btn-sm position-relative" (click)="saveMultiGuardar()" *ngIf="authService.hasSubDetailedPermission('shoppingDelison', 'requisitions', 'Req_Mul')">
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
        (selectionChanged)="onSelectionChanged($event)"
        [components]="components"
        style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
        </ag-grid-angular>
      </div>
    </div>

     <!-- Modal para Nuevo Artículo -->
    <div class="modal" tabindex="-1" [ngStyle]="{'display': isNewArticleModalVisible ? 'block' : 'none'}">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Registrar Nuevo Artículo</h5>
            <button type="button" class="btn-close" (click)="closeNewArticleModal()"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label for="newArticleName" class="form-label">Nombre del Artículo</label>
              <input type="text" class="form-control" id="newArticleName" [(ngModel)]="newArticle.description"
                (input)="newArticle.description = $any($event.target).value.toUpperCase()" style="text-transform: uppercase;">
            </div>
            <div class="mb-3">
              <label for="newArticleDesc" class="form-label">Descripción del Artículo</label>
              <textarea class="form-control" id="newArticleDesc" rows="2" [(ngModel)]="newArticle.descriptionNewArticle"
                (input)="newArticle.descriptionNewArticle = $any($event.target).value.toUpperCase()" style="text-transform: uppercase;"></textarea>
            </div>
            <div class="mb-3">
              <label for="newArticleLink" class="form-label">Link del Artículo (Opcional)</label>
              <input type="text" class="form-control" id="newArticleLink" [(ngModel)]="newArticle.urlNewArticle">
            </div>
            <div class="mb-3">
              <label for="newArticleUsage" class="form-label">¿Para qué se va a usar?</label>
              <textarea class="form-control" id="newArticleUsage" rows="2" [(ngModel)]="newArticle.justificationNewArticle"
                (input)="newArticle.justificationNewArticle = $any($event.target).value.toUpperCase()" style="text-transform: uppercase;"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeNewArticleModal()">Salir</button>
            <button type="button" class="btn btn-primary" (click)="saveNewArticle()">Guardar</button>
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
export class DetallesRequisicionDelisonComponent implements OnInit, OnDestroy {

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
  authService = inject(AuthService);
  // Tooltip
  private renderer: Renderer2;
  private tooltipElement: HTMLElement | null = null;

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  rowData: any[] = [];
  originalRowData: any[] = []; // Para poder deshacer cambios
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  isAddingNewItem: boolean = false;
  hasPedimentoSelection: boolean = false;
  hasRowSelected: boolean = false;
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
    descriptionNewArticle: '',
    urlNewArticle: '',
    justificationNewArticle: ''
  };
  private currentRowForNewArticle: any = null;
  private originalRecurrentValue: string | null = null;




  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    this.loadData();
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
          dateuse: item.dateuse || new Date().toISOString(),
          active: item.active !== undefined ? item.active : true,
          recurrent: item.recurrent || 'Recurrente', // Por defecto recurrente
          nameArticle: item.nameArticle || '',
          numArticle: item.numArticle || '',
          provint: item.provint || '',
          typePriority: item.typePriority || 'Normal',
          pedimiento: item.pedimento || false, // ✅ Cargar desde backend, siempre debe ser false después de Multiguardar
          pedimentoNumber: item.pedimentoNum || '', // ✅ String con números separados por coma (ej: "1,3,4,6")
          descriptionNewArticle: item.descriptionNewArticle || '', // Descripción del artículo nuevo
          urlNewArticle: item.urlNewArticle || '', // URL/Link del artículo nuevo
          justificationNewArticle: item.justificationNewArticle || '', // Justificación del artículo nuevo
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


      },
      error: (error) => {
        console.error('❌ Error al cargar materiales:', error);
        alerts.basicAlert('Error', 'No se pudieron cargar los materiales', 'error');
        this.materials = [];
      }
    });
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


      return providers;
    } catch (error) {

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
              description: params.data.nameArticle || '',
              descriptionNewArticle: params.data.descriptionNewArticle || '',
              urlNewArticle: params.data.urlNewArticle || '',
              justificationNewArticle: params.data.justificationNewArticle || ''
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
        cellEditor: 'agNumberCellEditor',
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
        headerName: 'Proveedor Interno',
        width: 170,
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

  async deleteSelectedItem() {
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un item para eliminar', 'warning');
      return;
    }

    const selectedItem = selectedRows[0];

    // Si es un item nuevo (no guardado en BD), solo eliminarlo del grid
    if (selectedItem.__isNew) {
      this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
      this.gridApi.setGridOption('rowData', this.rowData);

      // Verificar si quedan cambios pendientes
      const hasChanges = this.rowData.some(item => item.__isNew || item.__modified);
      this.hasUnsavedChanges = hasChanges;
      this.isAddingNewItem = hasChanges;

      alerts.basicAlert('Eliminado', 'Item eliminado del listado', 'success');
      return;
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

      // Eliminar del grid
      this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
      this.originalRowData = this.originalRowData.filter(item => item.id !== selectedItem.id);
      this.gridApi.setGridOption('rowData', this.rowData);

      // Actualizar contador si existe el contexto
      if (this.context && this.context.ITEMS && this.context.ITEMS.updateCount) {
        this.context.ITEMS.updateCount(this.params.data.id, this.rowData.length);
      }

      alerts.basicAlert('Eliminado', 'Item eliminado correctamente', 'success');
    } catch (error) {
      console.error('❌ Error al eliminar item:', error);
      alerts.basicAlert('Error', 'No se pudo eliminar el item', 'error');
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
        pedimentoNum: item.pedimentoNumber || '', // ✅ String con números separados por coma
        descriptionNewArticle: item.descriptionNewArticle || '', // Descripción del artículo nuevo
        urlNewArticle: item.urlNewArticle || '', // URL/Link del artículo nuevo
        justificationNewArticle: item.justificationNewArticle || '' // Justificación del artículo nuevo
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
        pedimentoNum: item.pedimentoNumber || '', // ✅ String con números separados por coma
        descriptionNewArticle: item.descriptionNewArticle || '', // Descripción del artículo nuevo
        urlNewArticle: item.urlNewArticle || '', // URL/Link del artículo nuevo
        justificationNewArticle: item.justificationNewArticle || '' // Justificación del artículo nuevo
      };

      console.log('📤 PUT - Enviando item modificado al endpoint:', payload);

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

    // 2. Validar que todos los items seleccionados sean del mismo tipo (Interno o Externo)
    const tipos = [...new Set(checkedItems.map(item => item.intorext || 'Externo'))];
    if (tipos.length > 1) {
      alerts.basicAlert(
        'Tipos mixtos',
        'No se pueden crear pedimentos con artículos de tipos mixtos (Interno y Externo). Por favor, seleccione solo artículos del mismo tipo.',
        'warning'
      );
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

      // 6. Crear snapshot de TODOS los artículos de la requisición, marcando cuáles fueron solicitados
      console.log('📦 Creando snapshot completo de la cotización...');
      console.log(`   Total de items en requisición: ${this.rowData.length}`);
      console.log(`   Items seleccionados para este pedimento: ${checkedItems.length}`);

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
          dateuse: item.dateuse || new Date().toISOString(),
          active: true,
          recurrent: item.recurrent || 'Recurrente',
          numArticle: item.numArticle || '',
          provint: item.provint || '',
          typePriority: item.typePriority || 'Normal',
          pedimento: fueSeleccionado, // ✅ true = solicitado, false = solo snapshot
          descriptionNewArticle: item.descriptionNewArticle || '', // Descripción del artículo nuevo
          urlNewArticle: item.urlNewArticle || '', // URL/Link del artículo nuevo
          justificationNewArticle: item.justificationNewArticle || '' // Justificación del artículo nuevo
        };

        console.log(`📤 ${fueSeleccionado ? '✓ SOLICITADO' : '○ Snapshot'}: ${item.nameArticle || item.article}`);

        await firstValueFrom(
          this.ocAndReqsService.addReqItem(detallePayload)
        );
      }

      console.log('✅ Snapshot completo creado con marcas de selección');

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
          pedimentoNum: item.pedimentoNumber || '', // ✅ String con números separados por coma (ej: "1,3,4,6")
          descriptionNewArticle: item.descriptionNewArticle || '', // Descripción del artículo nuevo
          urlNewArticle: item.urlNewArticle || '', // URL/Link del artículo nuevo
          justificationNewArticle: item.justificationNewArticle || '' // Justificación del artículo nuevo
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
    if (!this.hasUnsavedChanges && !this.isAddingNewItem) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por descartar', 'info');
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

    // Si el cambio es en la columna 'recurrent' y el valor es 'Nuevo', abrir el modal
    if (event.colDef.field === 'recurrent' && event.newValue === 'Nuevo') {
      this.currentRowForNewArticle = event.node;
      this.originalRecurrentValue = event.oldValue; // Guardar valor original por si cancela
      this.newArticle = { description: '', descriptionNewArticle: '', urlNewArticle: '', justificationNewArticle: '' }; // Resetear el formulario
      this.isNewArticleModalVisible = true;
    }
  }

  saveNewArticle() {
    // Validación: solo el nombre del artículo es obligatorio
    if (!this.newArticle.description || !this.newArticle.description.trim()) {
      alerts.basicAlert('Validación', 'El nombre del artículo es obligatorio.', 'warning');
      return;
    }

    console.log('💾 Guardando datos del nuevo artículo en la fila...');
    console.log('📋 Datos del formulario:', this.newArticle);

    // Guardar los datos del formulario en la fila actual
    // idSupplie = 0 indica que es un artículo nuevo (no recurrente)
    this.currentRowForNewArticle.data.idSupplie = 0;
    this.currentRowForNewArticle.data.materialId = 0;
    this.currentRowForNewArticle.data.article = this.newArticle.description.trim();
    this.currentRowForNewArticle.data.nameArticle = this.newArticle.description.trim();
    this.currentRowForNewArticle.data.descriptionNewArticle = this.newArticle.descriptionNewArticle.trim();
    this.currentRowForNewArticle.data.urlNewArticle = this.newArticle.urlNewArticle.trim();
    this.currentRowForNewArticle.data.justificationNewArticle = this.newArticle.justificationNewArticle.trim();
    this.currentRowForNewArticle.data.code = '';
    this.currentRowForNewArticle.data.numArticle = '';
    this.currentRowForNewArticle.data.description = this.newArticle.description.trim();
    this.currentRowForNewArticle.data.__modified = true;
    this.hasUnsavedChanges = true;
    this.isAddingNewItem = true;

    // Refrescar las celdas del grid
    this.gridApi.refreshCells({
      rowNodes: [this.currentRowForNewArticle],
      columns: ['article', 'numArticle'],
      force: true
    });

    alerts.basicAlert('Éxito', 'Datos del artículo guardados. Presione "Guardar" para enviar al servidor.', 'success');
    this.closeNewArticleModal();
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
      this.newArticle = {
        description: event.data.nameArticle || '',
        descriptionNewArticle: event.data.descriptionNewArticle || '',
        urlNewArticle: event.data.urlNewArticle || '',
        justificationNewArticle: event.data.justificationNewArticle || ''
      };
      this.isNewArticleModalVisible = true;
      return;
    }
  }

  onSelectionChanged(_event: any): void {
    const selectedRows = this.gridApi?.getSelectedRows() || [];
    this.hasRowSelected = selectedRows.length > 0;
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
        console.log('📋 No hay pedimentos existentes para propagar cambios');
        return;
      }

      console.log(`🔄 Propagando cambios a ${cotizaciones.length} pedimento(s)...`);
      console.log(`   Nuevos items: ${newItems.length}, Modificados: ${modifiedItems.length}`);

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
            console.log(`   ⏭️ Item "${nameArticle}" ya existe en cotización ${cotizacionId}, omitiendo`);
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
            dateuse: newItem.dateuse || new Date().toISOString(),
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
          console.log(`   ✅ Nuevo item "${nameArticle}" agregado a cotización ${cotizacionId}`);
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
            console.log(`   ⚠️ No se encontró item "${nameArticle}" en cotización ${cotizacionId}`);
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
            dateuse: matchingItem.dateuse || new Date().toISOString(),
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
          console.log(`   ✅ Observaciones de "${nameArticle}" actualizadas en cotización ${cotizacionId}`);
        }
      }

      console.log('✅ Propagación a pedimentos completada');

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
    // Clean up tooltip
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
