import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { DetailCellRendererRequisitionsPurchasesComponent } from './detail-cell-renderer-requisitions-purchases.component';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { MaterialsService } from 'app/services/materials.service';
import { SignalsService } from 'app/services/signals.service';
import { SelectWithTooltipEditorV2Component } from 'app/domains/Almacenes/components/materiales-maestro/editors/select-with-tooltip-editor-v2.component';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';

@Component({
  selector: 'app-detail-cell-renderer-requisitions-items',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, SelectWithTooltipEditorV2Component, MultiLineEditorComponent],
  template: `
    <div style="padding: 5px; background-color: #e3f2fd; height: 100%; max-height: 100%; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
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
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Registrar Nuevo Artículo</h5>
            <button type="button" class="btn-close" (click)="closeNewArticleModal()"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label for="newArticleName" class="form-label">Nombre del Artículo</label>
              <input type="text" class="form-control" id="newArticleName" [(ngModel)]="newArticle.name">
            </div>
            <div class="mb-3">
              <label for="newArticleDesc" class="form-label">Descripción del Artículo</label>
              <textarea class="form-control" id="newArticleDesc" rows="2" [(ngModel)]="newArticle.description"></textarea>
            </div>
            <div class="mb-3">
              <label for="newArticleLink" class="form-label">Link del Artículo (Opcional)</label>
              <input type="text" class="form-control" id="newArticleLink" [(ngModel)]="newArticle.link">
            </div>
            <div class="mb-3">
              <label for="newArticleUsage" class="form-label">¿Para qué se va a usar?</label>
              <textarea class="form-control" id="newArticleUsage" rows="2" [(ngModel)]="newArticle.usage"></textarea>
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
export class DetailCellRendererRequisitionsItemsComponent implements OnInit {

  private params!: any;
  private gridApi!: GridApi;
  private context: any;
  private ocAndReqsService = inject(OcAndReqsService);
  private materialsService = inject(MaterialsService);
  private signalsService = inject(SignalsService);
  private modalService = inject(ModalService);

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

  // Propiedades para el modal de nuevo artículo
  isNewArticleModalVisible = false;
  newArticle = { name: '', description: '', link: '', usage: '' };
  private currentRowForNewArticle: any = null;
  private originalRecurrentValue: string | null = null;



  // Purchases related properties
  purchasesData: any[] = [];
  hasPurchaseUnsavedChanges: boolean = false;
  purchasesTempIdCounter: number = 0;
  purchasesGridApi!: any;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    this.loadData();
  }

  agInit(params: any): void {
    this.params = params;
    this.context = params.context;
    this.loadMaterials();
    this.loadData();
    this.loadPurchasesData();
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
          type: item.type || 'Interno',
          idProvider: item.idProvider || 0,
          comment: item.comment || '',
          dateuse: item.dateuse || new Date().toISOString(),
          active: item.active !== undefined ? item.active : true,
          recurrent: 'Recurrente', // Por defecto recurrente
          numarticle: item.numarticle || '',
          provint: item.provint || '',
          priorityType: item.TypePriority || 'Normal',
          pedimiento: false,
          pedimentoNumber: '',
          purchasesData: [], // Se puede cargar después si es necesario
          purchasesExpanded: false,
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

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;

    this.gridApi.setGridOption('detailCellRendererParams', {
      getDetailRowData: (params: any) => {
        params.successCallback(params.data.purchasesData || []);
      },
      context: {
        componentParent: this,
        gridApi: this.gridApi,
        PURCHASES: {
          load: (articleId: number, callback: (data: any[]) => void) => {
            const article = this.rowData.find(r => r.id === articleId);
            callback(article ? article.purchasesData || [] : []);
          },
          save: (articleId: number, data: any[]) => {
            const article = this.rowData.find(r => r.id === articleId);
            if (article) {
              article.purchasesData = data;
              this.gridApi.refreshCells({ force: true });
              alerts.basicAlert('Guardado', 'Las compras han sido guardadas correctamente', 'success');
            }
          },
          delete: (params: any, callback: () => void) => {
            // Mock delete
            callback();
          },
          updateCount: (articleId: number, count: number) => {
            // Update count if needed
          },
          getRowClass: (params: any) => {
            return 'detail-purchase-row';
          }
        }
      }
    });
  }

  get colDefs(): ColDef[] {
    return [
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
        valueSetter: (params: any) => {
          params.data.recurrent = params.newValue;
          return true;
        }
      },

      {
        field: 'article',
        headerName: 'Articulos',
        width: 300,
        cellDataType: false, // Desactivar auto-detección de tipo
        editable: true,
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
            params.data.code = selectedMaterial.code || '';
            params.data.description = selectedMaterial.description;
            params.data.measure = selectedMaterial.measure || '';
            // ✅ CAMBIO 1: Actualizar # del artículo con el num-mat (código)
            params.data.numArticle = selectedMaterial.code || '';
            params.data.__modified = true;
            this.hasUnsavedChanges = true;

            // Refrescar las celdas para mostrar el articleNumber actualizado
            this.gridApi.refreshCells({
              rowNodes: [params.node],
              columns: ['articleNumber'],
              force: true
            });

            return true;
          }

          return false;
        },
        cellStyle: (params: any) => {
          if (!params.value && !params?.data?.article) {
            return { backgroundColor: '#f9f9f9', color: '#777' };
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
        editable: true,
        valueSetter: (params: any) => {
          params.data.numArticle = params.newValue ? params.newValue.toUpperCase() : '';
          params.data.__modified = true;
          this.isAddingNewItem = true;
          return true;
        }
      },
      {
        field: 'quantity',
        headerName: 'cantidad',
        width: 100,
        editable: true,
        type: 'numericColumn',
        valueSetter: (params: any) => {
          params.data.quantity = params.newValue;
          params.data.__modified = true;
          this.isAddingNewItem = true;
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
          params.data.intorext = params.newValue;
          params.data.__modified = true;
          this.isAddingNewItem = true;
          return true;
        }
      },
      {
        field: 'provint',
        headerName: 'Proveedor Interno',
        width: 100,
        editable: true,
        valueSetter: (params: any) => {
          params.data.provint = params.newValue ? params.newValue.toUpperCase() : '';
          params.data.__modified = true;
          this.isAddingNewItem = true;
          return true;
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
        valueSetter: (params: any) => {
          params.data.typePriority = params.newValue;
          params.data.__modified = true;
          this.isAddingNewItem = true;
          return true;
        }
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
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          return true;
        },
        cellStyle: { cursor: 'pointer', backgroundColor: '#f0f8ff' }
      },

      {
        field: 'pedimiento',
        headerName: 'Pedimiento',
        width: 100,
        editable: false,
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
  }

  checkPedimentoSelection() {
    const anyChecked = this.rowData.some(item => item.pedimiento === true);
    this.hasPedimentoSelection = anyChecked;
  }

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 25,
    animateRows: true,
    masterDetail: true,
    detailRowHeight: 400,
    isRowMaster: (dataItem: any) => true,
    detailCellRenderer: DetailCellRendererRequisitionsPurchasesComponent,
    rowSelection: 'single',
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

  public purchasesGridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single',
    onCellValueChanged: (event: any) => {
      event.data.__modified = true;
      this.hasPurchaseUnsavedChanges = true;
    }
  };

  get purchasesColDefs(): ColDef[] {
    return [
      {
        headerName: '#',
        width: 50,
        valueGetter: (params) => params.node.rowIndex + 1,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
      },
      {
        field: 'supplier',
        headerName: 'Proveedor',
        width: 250,
        editable: true,
        valueSetter: (params: any) => {
          params.data.supplier = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'amount',
        headerName: 'Monto',
        width: 150,
        editable: true,
        type: 'numericColumn',
        valueFormatter: (params: any) => {
          if (!params.value) return '';
          return `$${params.value.toLocaleString()}`;
        }
      }
    ];
  }

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
      type: 'Externo', // ✅ CAMBIO 2: Default "Externo"
      internalProvider: '',
      priorityType: 'Normal',
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

    // Lógica para guardar los nuevos items agregados
    // Aquí iría la llamada al servicio para guardar en la base de datos
    // Por ahora, simularemos que se guardó
    this.rowData.forEach(item => {
      if (item.__isNew) {
        item.__isNew = false;
        item.saved = true; // Marcar como guardado
      }
    });

    this.isAddingNewItem = false;
    this.hasUnsavedChanges = false; // Opcional, dependiendo de tu flujo
    this.gridApi.redrawRows();
    alerts.basicAlert('Guardado', 'El nuevo artículo ha sido guardado.', 'success');
  }

  saveMultiGuardar() {
    const checkedItems = this.rowData.filter(item => item.pedimiento === true);
    if (checkedItems.length === 0) {
      alerts.basicAlert('Sin selección', 'Por favor, marque al menos un item en la columna "Pedimento".', 'warning');
      return;
    }

    // Asignar el número de pedimento actual y quitar el check
    checkedItems.forEach(item => {
      if (item.pedimentoNumber) {
        // Si ya tiene un valor, añade el nuevo número separado por coma
        item.pedimentoNumber += `,${this.pedimentoCounter}`;
      } else {
        // Si está vacío, simplemente asigna el número
        item.pedimentoNumber = this.pedimentoCounter;
      }
      item.pedimiento = false;
    });

    const message = `Pedimento ${this.pedimentoCounter} guardado con ${checkedItems.length} artículo(s).`;

    this.hasPedimentoSelection = false; // Desactivar el botón

    // 1. Guardar los datos modificados de vuelta en la fila maestra.
    // ESTE ES EL CAMBIO CLAVE.
    if (this.context && this.context.ITEMS && this.context.ITEMS.save) {
      // Llamamos a la función 'save' del contexto, que actualizará la fila maestra y la refrescará.
      // Pasamos 'false' para evitar que muestre su propia alerta de "Guardado".
      this.context.ITEMS.save(this.params.data.id, this.rowData, false);
    }

    // Redibujar esta cuadrícula de detalle para que se actualicen los colores de las filas.
    this.gridApi.redrawRows();

    // 2. Incrementar el contador para la siguiente vuelta.
    this.pedimentoCounter = (this.pedimentoCounter % 3) + 1;

    // 3. Mostrar nuestra alerta específica de pedimentos.
    alerts.basicAlert('Pedimento Guardado', message, 'success');
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
    // Si el cambio no es en la columna 'recurrent', actuar como siempre.
    if (event.colDef.field !== 'recurrent') {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
      return;
    }

    // Si el valor cambia a 'Nuevo', abrir el modal.
    if (event.newValue === 'Nuevo') {
      this.currentRowForNewArticle = event.node;
      this.originalRecurrentValue = event.oldValue; // Guardar valor original por si cancela
      this.newArticle = { name: '', description: '', link: '', usage: '' }; // Resetear el formulario
      this.isNewArticleModalVisible = true;
    } else {
      // Si cambia a 'Recurrente' o cualquier otro valor, comportamiento normal.
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
  }

  saveNewArticle() {
    if (!this.newArticle.name) {
      alerts.basicAlert('Validación', 'El nombre del artículo es obligatorio.', 'warning');
      return;
    }
    // ✅ Solo rellenar el nombre del artículo
    this.currentRowForNewArticle.data.article = this.newArticle.name;
    this.currentRowForNewArticle.data.__modified = true;
    this.hasUnsavedChanges = true;
    this.gridApi.refreshCells({ rowNodes: [this.currentRowForNewArticle], columns: ['article'], force: true });
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
      this.newArticle = { ...(event.data.newArticleInfo || { name: '', description: '', link: '', usage: '' }) };
      this.isNewArticleModalVisible = true;
      return; // Detener para no interferir con la lógica de la otra cascada.
    }


    const colId = event.column.getColId();
    const isPurchasesColumn = colId === 'purchases';

    if (isPurchasesColumn) {
      const node = event.node;
      const api = event.api;

      if (event.data.purchasesExpanded) {
        // Close purchases cascade and show all rows
        node.setExpanded(false);
        event.data.purchasesExpanded = false;

        // Restore all row heights
        api.forEachNode((otherNode: any) => {
          otherNode.setRowHeight(undefined);
        });
        api.onRowHeightChanged();
        api.redrawRows();
      } else {
        // Close any other expanded purchases cascades
        api.forEachNode((otherNode: any) => {
          if (otherNode.data.purchasesExpanded && otherNode.id !== node.id) {
            otherNode.setExpanded(false);
            otherNode.data.purchasesExpanded = false;
          }
        });

        // Hide all other rows (set height to 0)
        api.forEachNode((otherNode: any) => {
          if (otherNode.id !== node.id) {
            otherNode.setRowHeight(0);
          }
        });

        // Open purchases cascade for this row
        event.data.purchasesExpanded = true;
        node.setExpanded(true);

        // Apply height changes
        api.onRowHeightChanged();
        api.redrawRows();
      }
    }
  }

  togglePurchasesCascade(node: any) {
    const event = {
      node: node,
      api: this.gridApi,
      data: node.data,
      column: { getColId: () => 'purchases' }
    };
    this.onCellClicked(event);
  }

  // Purchases methods
  onPurchasesGridReady(params: GridReadyEvent) {
    this.purchasesGridApi = params.api;
  }

  addPurchase() {
    const tempId = `temp_purchase_${this.purchasesTempIdCounter++}`;
    const newPurchase = {
      id: tempId,
      supplier: '',
      amount: 0,
      __isNew: true,
      __modified: false
    };

    this.purchasesData = [...this.purchasesData, newPurchase];
    this.hasPurchaseUnsavedChanges = true;
    this.purchasesGridApi.setGridOption('rowData', this.purchasesData);

    setTimeout(() => {
      const lastRowIndex = this.purchasesData.length - 1;
      this.purchasesGridApi.ensureIndexVisible(lastRowIndex);
      this.purchasesGridApi.startEditingCell({
        rowIndex: lastRowIndex,
        colKey: 'supplier'
      });
    }, 0);
  }

  deleteSelectedPurchase() {
    const selectedRows = this.purchasesGridApi.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione una compra para eliminar', 'warning');
      return;
    }

    const selectedPurchase = selectedRows[0];
    // Mock delete - in real implementation, call service
    this.purchasesData = this.purchasesData.filter(item => item.id !== selectedPurchase.id);
    this.purchasesGridApi.setGridOption('rowData', this.purchasesData);
    this.hasPurchaseUnsavedChanges = true;
  }

  savePurchaseChanges() {
    if (!this.hasPurchaseUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    if (this.context && this.context.PURCHASES && this.context.PURCHASES.save) {
      const requisitionId = this.params.data.id;
      this.context.PURCHASES.save(requisitionId, this.purchasesData);
      this.hasPurchaseUnsavedChanges = false;
    }
  }

  discardPurchaseChanges() {
    if (!this.hasPurchaseUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por descartar', 'info');
      return;
    }

    this.loadPurchasesData();
    this.hasPurchaseUnsavedChanges = false;
  }

  onPurchaseCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasPurchaseUnsavedChanges = true;
  }

  loadPurchasesData() {
    if (this.context && this.context.PURCHASES && this.context.PURCHASES.load) {
      const requisitionId = this.params.data.id;
      this.context.PURCHASES.load(requisitionId, (data: any[]) => {
        this.purchasesData = data.map(item => ({
          ...item,
          __isNew: false,
          __modified: false
        }));
        if (this.purchasesGridApi) {
          this.purchasesGridApi.setGridOption('rowData', this.purchasesData);
        }
      });
    }
  }

}