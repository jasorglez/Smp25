import { PdfReportViewerComponent } from 'app/shared/pdf-report-viewer/pdf-report-viewer.component';
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ICellRendererComp } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { hasPersistedMasterId } from 'app/helpers/master-detail-guard';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { SelectMaterialEditorComponent } from './select-material-editor.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PdfReportsService } from 'app/services/pdf-reports.service';
import { pdfPreviewUrl } from 'app/helpers/pdf-viewer';
import { TrackingService } from 'app/services/tracking.service';
import Swal from 'sweetalert2';
import { catchError, forkJoin, from, lastValueFrom, map, mergeMap, of, toArray } from 'rxjs';

@Component({
  selector: 'app-detail-cell-renderer-entry-items',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, SelectWithTooltipEditorV2Component, SelectMaterialEditorComponent, PdfReportViewerComponent],
  template: `
    <!-- Items Grid View -->
    <div class="detail-grid-container" *ngIf="detailType === 'items'">
      <div *ngIf="context?.movementType === 'IN' && entryData?.idOc > 0" class="alert alert-info py-1 px-2 mb-2 small">
        <i class="bi bi-info-circle me-1"></i>
        Las partidas de la OC se cargan al abrir el detalle. Captura la cantidad recibida y guarda.
      </div>
      <div *ngIf="context?.movementType === 'IN' && hasConvertedMaterials" class="alert alert-info py-1 px-2 mb-2 small">
        <i class="bi bi-info-circle me-1"></i>
        Los materiales con conversión se capturan en su unidad origen; el inventario se guarda en la unidad destino configurada.
      </div>
      <div class="detail-actions d-flex justify-content-end mb-2">
        <button class="btn btn-primary btn-sm me-2" (click)="addItem()" [disabled]="!masterSaved">
          <i class="bi bi-plus-lg"></i> Agregar
        </button>
        <button *ngIf="entryData?.idOc > 0" class="btn btn-secondary btn-sm me-2" (click)="importarItemsDeOC()" [disabled]="!masterSaved"
          title="Importar artículos desde la Orden de Compra">
          <i class="bi bi-box-arrow-in-down"></i> OC
        </button>
        <button class="btn btn-warning btn-sm me-2" (click)="discardChanges()">
          <i class="bi bi-arrow-counterclockwise"></i> Deshacer
        </button>
        <button class="btn btn-danger btn-sm me-2" (click)="deleteSelectedItem()">
          <i class="bi bi-trash"></i> Eliminar
        </button>
        <button class="btn btn-success btn-sm position-relative" (click)="saveChanges()" [disabled]="!masterSaved">
          <i class="bi bi-floppy"></i> Guardar
          <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
            *ngIf="hasUnsavedChanges">
            <span class="visually-hidden">Hay cambios sin guardar</span>
          </span>
        </button>
      </div>
      <div *ngIf="!masterSaved" class="alert alert-info py-1 px-2 mb-2 small">
        <i class="bi bi-info-circle me-1"></i> Guarda primero la entrada o salida para habilitar sus partidas.
      </div>
      <ag-grid-angular
        #agGrid
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        [components]="components"
        style="height: 300px; width: 100%;">
      </ag-grid-angular>
    </div>

    <!-- PDF Report View -->
    <div class="report-detail-container" *ngIf="detailType === 'report'">
      <div class="report-header d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">Vista Previa del Reporte - Folio: {{ entryData?.folio || 'Sin Folio' }}</h5>
        <div class="d-flex align-items-center gap-2">

          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="closeReport()"><i class="bi bi-x-lg"></i> Cerrar</button>
        </div>
      </div>
      <div class="report-content" style="width:100%; min-width:0; height:920px; margin-top:64px; border: 1px solid #dee2e6; border-radius: 0.375rem;">
        <app-pdf-report-viewer *ngIf="pdfUrl" [sourceUrl]="pdfUrl" title="Reporte de entrada" fileName="Reporte_Entrada.pdf"></app-pdf-report-viewer>
        <div *ngIf="!pdfUrl" class="d-flex justify-content-center align-items-center h-100">
          <div class="text-center">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Generando reporte...</span>
            </div>
            <p class="mt-2 text-muted">Generando reporte PDF...</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 10px;
    }
  `]
})
export class DetailCellRendererEntryItemsComponent implements OnInit {
  private trackingService = inject(TrackingService);

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  public context: any;
  private sanitizer = inject(DomSanitizer);
  private pdfReportsService = inject(PdfReportsService);

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  materials: any[] = [];

  get masterSaved(): boolean {
    return hasPersistedMasterId(this.params?.data?.id, this.params?.data?.__isNew);
  }

  get hasConvertedMaterials(): boolean {
    return this.materials.some(material => !!material.conversion);
  }

  // Report properties
  detailType: string = 'items';
  entryData: any = null;
  pdfUrl: SafeResourceUrl | null = null;
  private originalPdfUrl: string | null = null;
  pdfZoom = 125;
  readonly minPdfZoom = 75;
  readonly maxPdfZoom = 200;

  zoomIn(): void { this.setPdfZoom(this.pdfZoom + 10); }
  zoomOut(): void { this.setPdfZoom(this.pdfZoom - 10); }
  private setPdfZoom(value: number): void {
    this.pdfZoom = Math.max(this.minPdfZoom, Math.min(this.maxPdfZoom, value));
    if (!this.originalPdfUrl) return;
    this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      pdfPreviewUrl(this.originalPdfUrl, this.pdfZoom)
    );
  }

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    // Load initial data
    this.loadData();
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.entryData = params.data;
    this.detailType = params.data.detailType || 'items';

    if (this.detailType === 'items') {
      this.loadMaterials();
      this.loadData();
    } else if (this.detailType === 'report') {
      // Load data first, then generate report
      this.loadDataForReport();
    }
  }

  loadData() {
    if (!this.masterSaved) {
      this.rowData = [];
      this.gridApi?.setGridOption('rowData', this.rowData);
      return;
    }
    if (this.context && this.context.ITEMS && this.context.ITEMS.load) {
      const entryId = this.params.data.id;
      this.context.ITEMS.load(entryId, (data: any[]) => {
        if (data.length === 0 && this.params.data?.idOc > 0 && this.context.ITEMS.importFromOC) {
          this.context.ITEMS.importFromOC(this.params.data.idOc, entryId, (ocItems: any[]) => {
            this.rowData = ocItems;
            if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
            if (ocItems.length > 0) this.hasUnsavedChanges = true;
            if (this.context.ITEMS.updateCount) this.context.ITEMS.updateCount(entryId, this.rowData.length);
            if (ocItems.length > 0 && this.context.movementType === 'IN') {
              alerts.toastAlert(`${ocItems.length} partida(s) de la OC cargada(s); captura lo recibido y guarda.`, 'info');
            }
          });
          return;
        }
        this.rowData = data.map(item => ({
          ...item,
          materialName: item.description || '',
          __isNew: false,
          __modified: false
        }));
        this.applyTransferStockToRows();
        this.applyBrandStockToRows();
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
        if (this.context && this.context.ITEMS && this.context.ITEMS.updateCount) {
          this.context.ITEMS.updateCount(entryId, this.rowData.length);
        }
      });
    }
  }

  importarItemsDeOC() {
    const idOc = this.params.data?.idOc;
    if (!idOc || idOc <= 0) {
      alerts.basicAlert('Sin OC', 'Esta entrada no tiene una Orden de Compra asignada', 'warning');
      return;
    }
    const entryId = this.params.data.id;
    const loadItems = () => this.context.ITEMS.importFromOC(idOc, entryId, (ocItems: any[]) => {
      if (!ocItems || ocItems.length === 0) {
        alerts.basicAlert('Sin artículos', 'La OC no tiene artículos activos para importar', 'info');
        return;
      }
      const existingProducts = new Set(this.rowData.map(item => this.materialBrandKey(item)).filter(Boolean));
      const missingItems = ocItems.filter(item => {
        const materialBrandKey = this.materialBrandKey(item);
        if (!materialBrandKey || existingProducts.has(materialBrandKey)) return false;
        existingProducts.add(materialBrandKey);
        return true;
      });
      if (missingItems.length === 0) {
        alerts.basicAlert('Sin partidas nuevas', 'Los artículos de la OC ya están en el detalle.', 'info');
        return;
      }
      this.rowData = [...this.rowData, ...missingItems];
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = true;
      if (this.context.ITEMS.updateCount) this.context.ITEMS.updateCount(entryId, this.rowData.length);
      alerts.toastAlert(`${missingItems.length} partida(s) nueva(s) agregada(s) desde la OC`, 'success');
    });
    loadItems();
  }

  private materialBrandKey(item: any): string {
    const materialId = Number(item?.idProduct || item?.idSupplie || 0);
    if (!materialId) return '';
    const brand = item?.idBrand != null
      ? `id:${Number(item.idBrand)}`
      : `name:${String(item?.brandName || item?.brand || '').trim().toLocaleUpperCase()}`;
    return `${materialId}|${brand}`;
  }

  loadDataForReport() {
    if (this.context && this.context.ITEMS && this.context.ITEMS.load) {
      const entryId = this.params.data.id;
      this.context.ITEMS.load(entryId, (data: any[]) => {
        this.rowData = data.map(item => ({
          ...item,
          materialName: item.description || '',
          __isNew: false,
          __modified: false
        }));
        // Generate report after data is loaded
        this.generateReport();
      });
    } else {
      // If no data loader available, generate report anyway
      this.generateReport();
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    // Ensure columnDefs are updated with loaded materials
    this.gridApi.setGridOption('columnDefs', this.colDefs);
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
        field: 'code',
        headerName: 'Código',
        width: 100,
        editable: true,
        valueSetter: (params: any) => {
          params.data.code = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'description',
        headerName: 'Descripción',
        width: 300,
        cellDataType: false, // Desactivar auto-detección de tipo
        editable: true,
        cellEditor: 'selectMaterialEditor',
        cellEditorParams: (params: any) => {
          return {
            options: (this.materials || [])
              .filter(m => m.active)
              .map(m => ({ id: m.id, description: m.description }))
              .concat([{ id: '__ADD_MATERIAL__', description: '+ Agregar material...' }]),
            onAddMaterial: () => this.quickAddMaterial()
          };
        },
        valueFormatter: (params: any) => {
          // Preferir el nombre guardado en la fila si existe
          if (params?.data?.materialName) return params.data.materialName;
          const material = this.materials?.find(m => String(m.id) === String(params.value) || m.description === params.value);
          return material ? material.description : (params.value ?? '');
        },
        valueSetter: (params: any) => {
          let newValue = params.newValue;

          // Si el editor devuelve un objeto { id, description }
          if (newValue && typeof newValue === 'object' && newValue.id && newValue.description) {
            const selectedMaterial = this.materials?.find(m => m.id === newValue.id);
            if (selectedMaterial) {
              params.data.idProduct = selectedMaterial.id;
              params.data.materialName = selectedMaterial.description;
              params.data.description = selectedMaterial.description;
              params.data.code = selectedMaterial.code || '';
              params.data.measure = this.context.movementType === 'OUT' && selectedMaterial.conversion
                ? selectedMaterial.conversion.measureTo
                : (selectedMaterial.measure || selectedMaterial.unit || selectedMaterial.unidad || '');
              params.data.sourceMeasure = this.context.movementType === 'IN' && selectedMaterial.conversion
                ? selectedMaterial.measure
                : null;
              params.data.sourceMeasureId = this.context.movementType === 'IN' && selectedMaterial.conversion
                ? Number(selectedMaterial.idMeasure)
                : null;
              this.setSelectedMaterialBrand(params.data, selectedMaterial);
            }
            return true;
          }

          // Fallback for other cases
          const selectedMaterial = this.materials?.find(m => String(m.id) === String(newValue) || m.description === newValue);
          if (selectedMaterial) {
            params.data.idProduct = selectedMaterial.id;
            params.data.materialName = selectedMaterial.description;
            params.data.description = selectedMaterial.description;
            params.data.code = selectedMaterial.code || '';
            params.data.measure = this.context.movementType === 'OUT' && selectedMaterial.conversion
              ? selectedMaterial.conversion.measureTo
              : (selectedMaterial.measure || selectedMaterial.unit || selectedMaterial.unidad || '');
            params.data.sourceMeasure = this.context.movementType === 'IN' && selectedMaterial.conversion
              ? selectedMaterial.measure
              : null;
            params.data.sourceMeasureId = this.context.movementType === 'IN' && selectedMaterial.conversion
              ? Number(selectedMaterial.idMeasure)
              : null;
            this.setSelectedMaterialBrand(params.data, selectedMaterial);
          }

          return true;
        },
        cellStyle: (params: any) => {
          if (!params.value && !params?.data?.materialName) {
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
        field: 'idBrand',
        headerName: 'Marca',
        width: 130,
        editable: (params: any) => (this.materials.find(item => Number(item.id) === Number(params.data?.idProduct))?.brands?.length || 0) > 1,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: (params: any) => {
          const material = this.materials.find(item => Number(item.id) === Number(params.data?.idProduct));
          const brandValues = (material?.brands || []).map((brand: any) => String(brand.brand));
          if (this.context.movementType === 'OUT' || this.isTransferEntry()) brandValues.unshift('Sin marca');
          return {
            values: brandValues,
            valueListMaxHeight: 220,
            formatValue: (value: any) => value || 'Selecciona una marca'
          };
        },
        valueGetter: (params: any) => params.data?.idBrand == null
          ? (params.data?.brandName || '')
          : (this.materials.find(item => Number(item.id) === Number(params.data?.idProduct))?.brands || [])
              .find((brand: any) => Number(brand.id) === Number(params.data.idBrand))?.brand || params.data?.brandName || '',
        valueFormatter: (params: any) => {
          const material = this.materials.find(item => Number(item.id) === Number(params.data?.idProduct));
          if (!(material?.brands?.length)) return '—';
          return params.value || (material.brands.length === 1 ? material.brands[0].brand : 'Seleccionar marca');
        },
        valueSetter: (params: any) => {
          const material = this.materials.find(item => Number(item.id) === Number(params.data?.idProduct));
          if (!material?.brands?.length) return false;
          if (String(params.newValue) === 'Sin marca' && (this.context.movementType === 'OUT' || this.isTransferEntry())) {
            params.data.idBrand = null;
            params.data.brandName = 'Sin marca';
          } else {
            const brand = material.brands.find((item: any) => String(item.brand) === String(params.newValue));
            if (!brand) return false;
            params.data.idBrand = Number(brand.id);
            params.data.brandName = brand.brand;
          }
          this.updatePendingForBrand(params.data);
          return true;
        },
        cellStyle: (params: any) => {
          const material = this.materials.find(item => Number(item.id) === Number(params.data?.idProduct));
          return (material?.brands?.length || 0) > 1 && params.data?.idBrand == null && params.data?.brandName !== 'Sin marca'
            ? { backgroundColor: '#fff3cd', color: '#664d03' }
            : null;
        }
      },
      {
        field: 'measure',
        headerName: this.context.movementType === 'OUT' ? 'Unidad de salida' : 'Unidad de entrada',
        width: 100,
        editable: (params: any) => {
          const material = this.materials.find(item => Number(item.id) === Number(params.data?.idProduct));
          if (!material?.conversions?.length) return true;
          return this.context.movementType === 'IN';
        },
        cellEditorSelector: (params: any) => {
          const material = this.materials.find(item => Number(item.id) === Number(params.data?.idProduct));
          if (material?.conversions?.length) {
            return {
              component: 'agRichSelectCellEditor',
              params: {
                values: material.conversions.map((conversion: any) => conversion.measureFrom),
                valueListMaxHeight: 220,
                allowTyping: true,
                filterList: true,
              },
            };
          }
          return { component: 'agTextCellEditor' };
        },
        valueSetter: (params: any) => {
          const material = this.materials.find(item => Number(item.id) === Number(params.data?.idProduct));
          if (this.context.movementType === 'IN' && material?.conversions?.length) {
            const conversion = material.conversions.find((row: any) => row.measureFrom === params.newValue);
            if (!conversion) return false;
            params.data.measure = conversion.measureFrom;
            params.data.sourceMeasure = conversion.measureFrom;
            params.data.sourceMeasureId = Number(conversion.idMeasureFrom);
            return true;
          }
          params.data.measure = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'quantity',
        headerName: 'Cantidad',
        width: 100,
        editable: true,
        type: 'numericColumn',
        valueSetter: (params: any) => {
          const newValue = Number(params.newValue);
          if (!Number.isFinite(newValue) || newValue < 0) {
            alerts.basicAlert('Cantidad inválida', 'La cantidad debe ser un número igual o mayor a cero.', 'warning');
            return false;
          }
          if (this.context.movementType === 'OUT' && newValue > params.data.pending) {
            alerts.basicAlert('Cantidad excedida', `La cantidad no puede ser mayor al total de entradas disponibles (${params.data.pending})`, 'warning');
            return false;
          }
          if (this.context.movementType === 'IN' && this.entryData?.idOc > 0 && newValue > Number(params.data.pending || 0)) {
            alerts.basicAlert('Cantidad excedida', `La cantidad recibida no puede superar la cantidad de la OC (${params.data.pending}).`, 'warning');
            return false;
          }
          params.data.quantity = newValue;
          params.data.total = newValue;
          return true;
        }
      },
      {
        field: 'pending',
        headerName: this.context.movementType === 'OUT'
          ? 'Total Entradas'
          : (this.isTransferEntry() ? 'Existencia origen' : (this.entryData?.idOc > 0 ? 'Cantidad OC' : 'Pendiente')),
        width: 100,
        editable: false,
        type: 'numericColumn'
      },
      {
        field: 'total',
        headerName: 'Total',
        width: 100,
        editable: true,
        type: 'numericColumn'
      },
      ...(this.context?.movementType === 'OUT' ? [{
        field: 'addToDailyReport',
        headerName: 'R. diario',
        width: 100,
        editable: true,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
        headerTooltip: 'Agregar este material al Reporte diario al guardar la salida',
        tooltipValueGetter: () => 'Al guardar se pedirá confirmación y se creará el Reporte diario si aún no existe.'
      }] : []),
      {
        field: 'active',
        headerName: 'Activo',
        width: 80,
        editable: true,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor'
      }
    ];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single',
    onCellValueChanged: (event: any) => {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
  };

  components = {
    selectWithTooltipEditor: SelectWithTooltipEditorV2Component,
    selectMaterialEditor: SelectMaterialEditorComponent
  };

  addItem() {
    const tempId = `temp_item_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      code: '',
      idInandout: this.params.data.id,
      idProduct: 0,
      description: '',
      materialName: '',
      measure: '',
      quantity: 1,
      pending: 0,
      total: 1,
      addToDailyReport: false,
      active: true,
      __isNew: true,
      __modified: false
    };

    this.rowData = [...this.rowData, newItem];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    // Update count in master grid
    if (this.context && this.context.ITEMS && this.context.ITEMS.updateCount) {
      this.context.ITEMS.updateCount(this.params.data.id, this.rowData.length);
    }

    setTimeout(() => {
      const lastRowIndex = this.rowData.length - 1;
      this.gridApi.ensureIndexVisible(lastRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: lastRowIndex,
        colKey: 'description'
      });
    }, 0);
  }

  deleteSelectedItem() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó detail cell renderer entry items', 'ModWareHousesTD', this.trackingService.getEmail());
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

        // Update count in master grid
        if (this.context && this.context.ITEMS && this.context.ITEMS.updateCount) {
          this.context.ITEMS.updateCount(this.params.data.id, this.rowData.length);
        }
      });
    }
  }

  async saveChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en detail cell renderer entry items', 'ModWareHousesTD', this.trackingService.getEmail());
    if (!this.masterSaved) {
      alerts.basicAlert('Guarda primero el movimiento', 'Guarda la entrada o salida antes de guardar sus partidas.', 'warning');
      return;
    }
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    if (this.context && this.context.ITEMS && this.context.ITEMS.save) {
      const entryId = this.params.data.id;
      const saved = await this.context.ITEMS.save(entryId, this.rowData);
      if (saved === false) return;
      this.hasUnsavedChanges = this.rowData.some(item => item.__isNew || item.__modified || item.addToDailyReport);
    }
  }

  discardChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por descartar', 'info');
      return;
    }

    this.loadData();
    this.hasUnsavedChanges = false;
  }

  onCellValueChanged(event: any) {
    if (event.colDef.field === 'quantity') {
      event.data.total = event.newValue;
    }

    if (event.colDef.field === 'description' && this.context.movementType === 'OUT' && event.data.idProduct) {
      this.updatePendingForBrand(event.data);
    }

    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  private isTransferEntry(): boolean {
    return this.context?.movementType === 'IN' && !!this.context?.isTransferType?.(this.entryData?.idType);
  }

  private getStockValue(response: any): number {
    const value = response?.data ?? response?.stock ?? response?.quantity ?? response;
    const stock = Number(value);
    return Number.isFinite(stock) ? stock : 0;
  }

  private applyTransferStockToRows(): void {
    if (!this.isTransferEntry()) return;
    const stockByMaterial = new Map(this.materials.map(material => [String(material.id), material.availableStock]));
    this.rowData.forEach(item => {
      item.pending = Number(stockByMaterial.get(String(item.idProduct)) || 0);
    });
    if (this.gridApi) this.gridApi.refreshCells({ force: true });
  }

  private updatePendingForBrand(row: any): void {
    const material = this.materials.find(item => Number(item.id) === Number(row?.idProduct));
    const brandCount = material?.brands?.length || 0;
    const usesBrandStock = brandCount > 0;
    const brandId = row?.idBrand == null
      ? (row?.brandName === 'Sin marca' ? 0 : (brandCount === 1 ? Number(material.brands[0].id) : null))
      : Number(row.idBrand);
    if ((this.context?.movementType !== 'OUT' && !this.isTransferEntry()) || !material) return;
    if (usesBrandStock && brandId == null) {
      row.pending = 0;
      this.gridApi?.refreshCells({ force: true, columns: ['pending'] });
      return;
    }
    const warehouseId = Number(this.entryData?.idWarehouse || this.context?.idWarehouse || 0);
    if (!warehouseId || !this.context?.inandoutService?.getStock) return;
    this.context.inandoutService.getStock(Number(row.idProduct), warehouseId, usesBrandStock ? brandId : undefined).subscribe({
      next: (response: any) => {
        row.pending = this.getStockValue(response);
        this.gridApi?.refreshCells({ force: true, columns: ['pending'] });
      },
      error: () => {
        row.pending = 0;
        this.gridApi?.refreshCells({ force: true, columns: ['pending'] });
      }
    });
  }

  private setSelectedMaterialBrand(row: any, material: any): void {
    const brands = material?.brands || [];
    if (brands.length === 1) {
      row.idBrand = Number(brands[0].id);
      row.brandName = brands[0].brand;
    } else {
      row.idBrand = null;
      row.brandName = '';
    }
    this.updatePendingForBrand(row);
  }

  private applyBrandStockToRows(): void {
    this.rowData.forEach(row => {
      const material = this.materials.find(item => Number(item.id) === Number(row.idProduct));
      if ((material?.brands?.length || 0) > 1 && row.idBrand == null && row.id > 0) row.brandName = 'Sin marca';
      this.updatePendingForBrand(row);
    });
  }

  loadMaterials() {
    if (this.context && this.context.materialsService && this.context.idRoot) {
      forkJoin({
        materials: this.context.materialsService.getMaterials2Fields(this.context.idRoot),
        conversions: this.context.materialsService.getMaterialConversions(this.context.idRoot),
        brands: this.context.materialsService.getMaterialBrands(this.context.idRoot).pipe(catchError(() => of([]))),
      }).subscribe({
        next: ({ materials, conversions, brands }: { materials: any[]; conversions: any[]; brands: any[] }) => {
          const activeMaterials = materials.filter(mat => mat.active && mat.vigente).map(mat => {
            const materialConversions = conversions.filter(row => Number(row.idMaterial) === Number(mat.id));
            const conversion = materialConversions.find(row => Number(row.idMeasureFrom) === Number(mat.idMeasure));
            const materialBrands = brands.filter(row => Number(row.idMaterial) === Number(mat.id));
            return { ...mat, conversion, conversions: materialConversions, brands: materialBrands };
          });
          if (!this.isTransferEntry()) {
            this.materials = activeMaterials;
            this.applyBrandStockToRows();
            if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.colDefs);
            return;
          }

          const sourceWarehouseId = Number(this.entryData?.idWarehouse || this.context?.idWarehouse || 0);
          if (!sourceWarehouseId || !this.context?.inandoutService?.getStock) {
            this.materials = [];
            if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.colDefs);
            return;
          }

          from(activeMaterials).pipe(
            mergeMap(material => this.context.inandoutService.getStock(material.id, sourceWarehouseId).pipe(
              map((response: any) => ({ ...material, availableStock: this.getStockValue(response) })),
              catchError(() => this.context.inandoutService.getSumaIn(material.id, sourceWarehouseId).pipe(
                map((response: any) => ({ ...material, availableStock: this.getStockValue(response) })),
                catchError(() => of({ ...material, availableStock: 0 }))
              ))
            ), 8),
            toArray()
          ).subscribe({
            next: (materialsWithStock: any[]) => {
              this.materials = materialsWithStock.filter(material => material.availableStock > 0);
              this.applyTransferStockToRows();
              this.applyBrandStockToRows();
              if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.colDefs);
            },
            error: error => {
              console.error('Error loading transfer stock:', error);
              this.materials = [];
              if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.colDefs);
            }
          });
        },
        error: (error) => {
          console.error('Error loading materials:', error);
          this.materials = [];
        }
      });
    } else {
      this.materials = [];
    }
  }

  private async quickAddMaterial(): Promise<void> {
    const service = this.context?.materialsService;
    const idRoot = this.context?.idRoot;
    if (!service || !idRoot) return;
    const result = await Swal.fire({
      title: '<span style="font-weight:700;color:#20344b">Agregar material</span>',
      width: 680,
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-check2-circle me-1"></i> Guardar material',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: { popup: 'material-quick-create', confirmButton: 'btn btn-primary px-4', cancelButton: 'btn btn-light ms-2 px-4' },
      html: `
        <div style="text-align:left;background:#f7f9fc;border:1px solid #e5ebf3;border-radius:16px;padding:18px;margin-top:8px">
          <div style="color:#73849a;font-size:12px;font-weight:700;letter-spacing:.08em;margin-bottom:12px">DATOS DEL MATERIAL</div>
          <label class="form-label small fw-semibold mb-1">Descripción *</label>
          <div class="input-group mb-3"><span class="input-group-text bg-white"><i class="bi bi-box-seam text-primary"></i></span><input id="quick-material-description" class="form-control" placeholder="Nombre o descripción del material" maxlength="200"></div>
          <div class="row g-3">
            <div class="col-md-6"><label class="form-label small fw-semibold mb-1">Código</label><div class="input-group"><span class="input-group-text bg-white"><i class="bi bi-upc text-primary"></i></span><input id="quick-material-code" class="form-control" placeholder="Código del material" maxlength="35"></div></div>
            <div class="col-md-6"><label class="form-label small fw-semibold mb-1">Unidad *</label><div class="input-group"><span class="input-group-text bg-white"><i class="bi bi-rulers text-primary"></i></span><input id="quick-material-measure" class="form-control" placeholder="PZA, KG, M…"></div></div>
            <div class="col-md-6"><label class="form-label small fw-semibold mb-1">Familia</label><div class="input-group"><span class="input-group-text bg-white"><i class="bi bi-collection text-primary"></i></span><input id="quick-material-family" class="form-control" placeholder="Familia del material"></div></div>
            <div class="col-md-6"><label class="form-label small fw-semibold mb-1">Subfamilia</label><div class="input-group"><span class="input-group-text bg-white"><i class="bi bi-diagram-2 text-primary"></i></span><input id="quick-material-subfamily" class="form-control" placeholder="Subfamilia"></div></div>
          </div>
        </div>`,
      focusConfirm: false,
      didOpen: () => (document.getElementById('quick-material-description') as HTMLInputElement)?.focus(),
      preConfirm: () => {
        const value = (id: string) => String((document.getElementById(id) as HTMLInputElement)?.value || '').trim();
        const description = value('quick-material-description');
        const measure = value('quick-material-measure');
        if (!description || !measure) {
          Swal.showValidationMessage('Captura la descripción y la unidad para guardar el material.');
          return false;
        }
        return { description, code: value('quick-material-code'), measure, family: value('quick-material-family'), subfamily: value('quick-material-subfamily') };
      }
    });
    if (!result.isConfirmed || !result.value) return;
    const { description, code, measure, family, subfamily } = result.value;
    try {
      await lastValueFrom(service.addMaterial({ idRoot, description, code, measure, family, subfamily, active: true, vigente: true }));
      this.loadMaterials();
      alerts.basicAlert('Material agregado', 'El material ya está disponible en el combo.', 'success');
    } catch (error) {
      console.error('Error al agregar material rápido:', error);
      alerts.basicAlert('Error', 'No fue posible agregar el material.', 'error');
    }
  }

  addItemFromMaterial(material: any) {
    const tempId = `temp_item_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      code: material.code,
      idInandout: this.params.data.id,
      idProduct: material.id,
      idBrand: material.brands?.length === 1 ? Number(material.brands[0].id) : null,
      brandName: material.brands?.length === 1 ? material.brands[0].brand : '',
      description: material.description,
      measure: this.context.movementType === 'OUT' && material.conversion
        ? material.conversion.measureTo
        : (material.measure || material.unit || material.unidad || ''),
      sourceMeasure: this.context.movementType === 'IN' && material.conversion ? material.measure : null,
      sourceMeasureId: this.context.movementType === 'IN' && material.conversion ? Number(material.idMeasure) : null,
      quantity: 1,
      pending: 0,
      total: 1,
      addToDailyReport: false,
      active: true,
      __isNew: true,
      __modified: false
    };

    this.rowData = [...this.rowData, newItem];
    this.updatePendingForBrand(newItem);
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    // Update count in master grid
    if (this.context && this.context.ITEMS && this.context.ITEMS.updateCount) {
      this.context.ITEMS.updateCount(this.params.data.id, this.rowData.length);
    }

    setTimeout(() => {
      const lastRowIndex = this.rowData.length - 1;
      this.gridApi.ensureIndexVisible(lastRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: lastRowIndex,
        colKey: 'quantity'
      });
    }, 0);
  }

  refreshByParent() {
    this.loadData();
  }

  closeReport() {
    // Emit event to parent component to handle collapse
    if (this.context && this.context.componentParent) {
      this.context.componentParent.collapseReportDetail(this.entryData.id);
    }
  }

  private async generateReport() {
    if (!this.entryData) return;

    try {
      // Get the idRoot from context
      const idRoot = this.context?.idRoot;
      if (!idRoot) {
        console.error('No idRoot available for PDF generation');
        return;
      }

      // Resolve brand names for PDF rows even when the API only returns idBrand.
      const brandRows = this.context?.materialsService?.getMaterialBrands
        ? await lastValueFrom(this.context.materialsService.getMaterialBrands(idRoot).pipe(catchError(() => of([]))))
        : [];
      const brandMap = new Map(((brandRows || []) as any[]).map((brand: any) => [Number(brand.id), brand.brand]));
      const itemsData = (this.rowData || []).map(item => ({
        ...item,
        brandName: item.brandName || item.brand || item.marca || brandMap.get(Number(item.idBrand)) || ''
      }));

      // Find OT Name
      let otName = 'N/A';
      const otId = this.entryData.idOt || this.entryData.id_ot;

      if (otId && this.context?.componentParent?.otList) {
        const ot = this.context.componentParent.otList.find((o: any) => o.id === otId);
        if (ot) otName = ot.name;
      }

      const reportEntryData = { ...this.entryData, otName };

      // Generate PDF using the service
      const pdfUrl = await this.pdfReportsService.generateEntryReport(reportEntryData, itemsData, idRoot);

      // Clean up previous URL
      if (this.originalPdfUrl) {
        URL.revokeObjectURL(this.originalPdfUrl);
      }

      // Set the new URL
      this.originalPdfUrl = pdfUrl;
      this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(pdfPreviewUrl(pdfUrl, this.pdfZoom));

    } catch (error) {
      console.error('Error generating report PDF:', error);
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
