import { PdfReportViewerComponent } from 'app/shared/pdf-report-viewer/pdf-report-viewer.component';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ICellRendererComp } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE } from 'assets/i18n/ag-grid.locale';
import { alerts } from 'app/helpers/alerts';
import { hasPersistedMasterId } from 'app/helpers/master-detail-guard';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { SelectMaterialEditorComponent } from './select-material-editor.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PdfReportsService } from 'app/services/pdf-reports.service';
import { pdfPreviewUrl } from 'app/helpers/pdf-viewer';
import { TrackingService } from 'app/services/tracking.service';
import { InventarioWarehouseService } from 'app/services/inventario-warehouse.service';
import { restoreGridColumnWidths, saveGridColumnWidths } from 'app/helpers/grid-column-widths';
import { navigateEditableCellOnEnter } from 'app/helpers/ag-grid-enter-navigation';
import Swal from 'sweetalert2';
import { catchError, forkJoin, from, lastValueFrom, map, mergeMap, of, switchMap, toArray } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-detail-cell-renderer-entry-items',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, SelectWithTooltipEditorV2Component, SelectMaterialEditorComponent, PdfReportViewerComponent, TranslateModule],
  template: `
    <!-- Items Grid View -->
    <div class="detail-grid-container" *ngIf="detailType === 'items'">
      <div *ngIf="context?.movementType === 'IN' && entryData?.idOc > 0" class="alert alert-info py-1 px-2 mb-2 small">
        <i class="bi bi-info-circle me-1"></i>
        {{ 'modules.warehouses.ui.entryDetail.poLoadedMessage' | translate }}
      </div>
      <div *ngIf="isLinkedSourceBalanceUnverified()" class="alert alert-warning py-1 px-2 mb-2 small" role="alert">
        <i class="bi bi-exclamation-triangle-fill me-1"></i>{{ context?.getSourceBalanceWarning?.() }}
        {{ 'modules.warehouses.ui.entryDetail.sourceBalanceMessage' | translate }}
      </div>
      <div *ngIf="isInitialInventoryEntry()" class="alert alert-info py-1 px-2 mb-2 small">
        <i class="bi bi-info-circle me-1"></i>
        {{ 'modules.warehouses.ui.entryDetail.initialInventoryMessage' | translate }}
      </div>
      <div *ngIf="isInventoryAdjustmentEntry()" class="alert alert-info py-1 px-2 mb-2 small">
        <i class="bi bi-info-circle me-1"></i>
        {{ 'modules.warehouses.ui.entryDetail.adjustmentMessage' | translate }}
      </div>
      <div *ngIf="isTransferEntry()" class="alert alert-info py-1 px-2 mb-2 small">
        <i class="bi bi-info-circle me-1"></i>
        {{ 'modules.warehouses.ui.entryDetail.transferMessage' | translate }}
      </div>
      <div *ngIf="isStandardOutgoingEntry() && !isTransferMovement()" class="alert alert-info py-1 px-2 mb-2 small">
        <i class="bi bi-exclamation-circle me-1"></i>
        {{ 'modules.warehouses.ui.entryDetail.unlinkedIssueMessage' | translate }}
        <span>{{ 'modules.warehouses.ui.entryDetail.addIssueItemsPrompt' | translate }}</span>
      </div>
      <div *ngIf="(isStockRestrictedEntry() || isStandardOutgoingEntry()) && loadingWarehouseStock" class="alert alert-info py-2 px-2 mb-2 small" role="status" aria-live="polite">
        <div class="d-flex align-items-center gap-2 mb-1">
          <span class="spinner-border spinner-border-sm text-primary" aria-hidden="true"></span>
          <span>{{ 'modules.warehouses.ui.entryDetail.loadingInventoryItems' | translate }}</span>
        </div>
        <div class="progress" style="height: 6px;" [attr.aria-label]="'modules.warehouses.ui.entryDetail.loadingInventory' | translate">
          <div class="progress-bar progress-bar-striped progress-bar-animated w-100"></div>
        </div>
      </div>
      <div *ngIf="context?.movementType === 'IN' && hasConvertedMaterials" class="alert alert-info py-1 px-2 mb-2 small">
        <i class="bi bi-info-circle me-1"></i>
        {{ 'modules.warehouses.ui.entryDetail.conversionMessage' | translate }}
      </div>
      <div class="detail-actions d-flex justify-content-end mb-2">
        <button *ngIf="!isInventoryAdjustmentEntry()" class="btn btn-primary btn-sm me-2" (click)="addItem()"
          [title]="'modules.warehouses.ui.entryDetail.addItem' | translate">
          <i class="bi bi-plus-lg"></i> {{ 'modules.warehouses.ui.entryDetail.addItem' | translate }}
        </button>
        <button *ngIf="entryData?.idOc > 0" class="btn btn-secondary btn-sm me-2" (click)="importarItemsDeOC()"
          [title]="'modules.warehouses.ui.entryDetail.importPoItems' | translate">
          <i class="bi bi-box-arrow-in-down"></i> OC
        </button>
        <button *ngIf="context?.movementType === 'OUT' && entryData?.idEntry > 0" class="btn btn-secondary btn-sm me-2" (click)="importarItemsDeEntrada()"
          [title]="'modules.warehouses.ui.entryDetail.importReceiptQuantities' | translate">
          <i class="bi bi-box-arrow-in-down"></i> {{ 'modules.warehouses.ui.movements.receiptVoucher' | translate }}
        </button>
        <button class="btn btn-warning btn-sm me-2" (click)="discardChanges()">
          <i class="bi bi-arrow-counterclockwise"></i> {{ 'undo' | translate }}
        </button>
        <button class="btn btn-danger btn-sm me-2" (click)="deleteSelectedItem()">
          <i class="bi bi-trash"></i> {{ 'delete' | translate }}
        </button>
        <button class="btn btn-success btn-sm position-relative" (click)="saveChanges()" [title]="'modules.warehouses.ui.entryDetail.saveItemsF10' | translate">
          <i class="bi bi-floppy"></i> {{ 'save' | translate }}
          <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
            *ngIf="hasUnsavedChanges">
            <span class="visually-hidden">{{ 'modules.userSetup.unsavedChanges' | translate }}</span>
          </span>
        </button>
        <button type="button" class="btn btn-outline-secondary btn-sm ms-2" (click)="closeDetail()"
          [title]="'modules.warehouses.ui.entryDetail.closeDetail' | translate" [attr.aria-label]="'modules.warehouses.ui.entryDetail.closeDetail' | translate">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
      <div *ngIf="!masterSaved" class="alert alert-info py-1 px-2 mb-2 small">
        <i class="bi bi-info-circle me-1"></i> {{ 'modules.warehouses.ui.entryDetail.masterWillSaveMessage' | translate }}
      </div>
      <ag-grid-angular
        #agGrid
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)"
        (cellKeyDown)="onDetailGridCellKeyDown($event)"
        (columnResized)="onColumnResized($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        [components]="components"
        [style.height.px]="context?.detailInnerGridHeight || (context?.movementType === 'IN' ? 610 : 450)"
        style="width: 100%;">
      </ag-grid-angular>
    </div>

    <!-- PDF Report View -->
    <div class="report-detail-container" *ngIf="detailType === 'report'">
      <div class="report-header d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">{{ 'modules.warehouses.ui.entryDetail.reportPreview' | translate }} - {{ 'modules.warehouses.ui.entryDetail.folio' | translate }}: {{ entryData?.folio || ('modules.warehouses.ui.entryDetail.noFolio' | translate) }}</h5>
        <div class="d-flex align-items-center gap-2">

          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="closeReport()"><i class="bi bi-x-lg"></i> {{ 'modules.warehouses.ui.entryDetail.closeReport' | translate }}</button>
        </div>
      </div>
      <div class="report-content" style="width:100%; min-width:0; height:920px; margin-top:64px; border: 1px solid #dee2e6; border-radius: 0.375rem;">
        <app-pdf-report-viewer *ngIf="pdfUrl" [sourceUrl]="pdfUrl" [title]="'modules.warehouses.ui.entryDetail.receiptReport' | translate" fileName="Receipt_Report.pdf"></app-pdf-report-viewer>
        <div *ngIf="!pdfUrl" class="d-flex justify-content-center align-items-center h-100">
          <div class="text-center">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">{{ 'modules.warehouses.ui.entryDetail.generatingReport' | translate }}</span>
            </div>
            <p class="mt-2 text-muted">{{ 'modules.warehouses.ui.entryDetail.generatingPdfReport' | translate }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .detail-grid-container,
    .report-detail-container {
      padding: 10px;
      height: 100%;
      overflow-y: auto;
    }
  `]
})
export class DetailCellRendererEntryItemsComponent {
  private translate = inject(TranslateService);
  private trackingService = inject(TrackingService);
  private inventoryService = inject(InventarioWarehouseService);

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  public context: any;
  private sanitizer = inject(DomSanitizer);
  private pdfReportsService = inject(PdfReportsService);

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  materials: any[] = [];
  private stockRowsLoaded = false;
  private detailRowsLoaded = false;
  loadingWarehouseStock = false;

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

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE;

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
      this.detailRowsLoaded = true;
      this.seedStockRowsWhenReady();
      this.gridApi?.setGridOption('rowData', this.rowData);
      return;
    }
    if (this.context && this.context.ITEMS && this.context.ITEMS.load) {
      const entryId = this.params.data.id;
      this.context.ITEMS.load(entryId, (data: any[]) => {
        if (data.length === 0 && this.context?.movementType === 'IN' && this.params.data?.idOc > 0 && this.context.ITEMS.importFromOC) {
          this.context.ITEMS.importFromOC(this.params.data.idOc, entryId, (ocItems: any[]) => {
            this.rowData = ocItems;
            if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
            if (ocItems.length > 0) this.hasUnsavedChanges = true;
            if (this.context.ITEMS.updateCount) this.context.ITEMS.updateCount(entryId, this.rowData.length);
            if (ocItems.length > 0 && this.context.movementType === 'IN') {
              alerts.toastAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.purchaseOrderItemsLoaded', { count: ocItems.length }), 'info');
            }
          });
          return;
        }
        if (data.length === 0 && this.context?.movementType === 'OUT' && this.params.data?.idEntry > 0 && this.context.ITEMS.importFromEntry) {
          this.context.ITEMS.importFromEntry(this.params.data.idEntry, entryId, (entryItems: any[]) => {
            this.rowData = entryItems;
            this.gridApi?.setGridOption('rowData', this.rowData);
            if (entryItems.length > 0) this.hasUnsavedChanges = true;
            this.context.ITEMS.updateCount?.(entryId, this.rowData.length);
            if (entryItems.length > 0) alerts.toastAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.pendingReceiptItemsLoaded', { count: entryItems.length }), 'info');
          });
          return;
        }
        this.rowData = data.map(item => {
          const sourceId = this.context?.movementType === 'OUT'
            ? Number(this.entryData?.idEntry || 0)
            : Number(this.entryData?.idOc || 0);
          const quantity = Number(item.quantity ?? item.total ?? 0) || 0;
          const remaining = sourceId > 0
            ? Number(this.context?.getSourceRemainingQuantity?.(this.context.movementType, sourceId, item) || 0)
            : Number(item.pending || 0);
          return {
            ...item,
            pending: sourceId > 0 ? remaining + quantity : item.pending,
            materialName: item.description || '',
            __originalQuantity: quantity,
            __isNew: false,
            __modified: false
          };
        });
        this.detailRowsLoaded = true;
        this.applyWarehouseStockToRows();
        this.applyBrandStockToRows();
        this.seedStockRowsWhenReady();
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
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.noPurchaseOrder'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.entryHasNoPurchaseOrder'), 'warning');
      return;
    }
    const entryId = this.params.data.id;
    const loadItems = () => this.context.ITEMS.importFromOC(idOc, entryId, (ocItems: any[]) => {
      if (!ocItems || ocItems.length === 0) {
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.noArticles'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.purchaseOrderHasNoActiveArticles'), 'info');
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
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.noNewItems'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.purchaseOrderItemsAlreadyAdded'), 'info');
        return;
      }
      this.rowData = [...this.rowData, ...missingItems];
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = true;
      if (this.context.ITEMS.updateCount) this.context.ITEMS.updateCount(entryId, this.rowData.length);
      alerts.toastAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.newItemsAddedFromPurchaseOrder', { count: missingItems.length }), 'success');
    });
    loadItems();
  }

  importarItemsDeEntrada() {
    const sourceEntryId = Number(this.params.data?.idEntry || 0);
    if (!sourceEntryId) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.noReceiptVoucher'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.selectReceiptVoucherForPending'), 'warning');
      return;
    }
    const outingId = this.params.data.id;
    this.context.ITEMS.importFromEntry(sourceEntryId, outingId, (items: any[]) => {
      if (!items?.length) {
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.noPendingQuantities'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.receiptVoucherFullySupplied'), 'info');
        return;
      }
      const existingProducts = new Set(this.rowData.map(item => this.materialBrandKey(item)).filter(Boolean));
      const missingItems = items.filter(item => {
        const key = this.materialBrandKey(item);
        if (!key || existingProducts.has(key)) return false;
        existingProducts.add(key);
        return true;
      });
      if (!missingItems.length) {
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.noNewItems'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.receiptItemsAlreadyAdded'), 'info');
        return;
      }
      this.rowData = [...this.rowData, ...missingItems];
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = true;
      this.context.ITEMS.updateCount?.(outingId, this.rowData.length);
      alerts.toastAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.pendingItemsAddedFromReceipt', { count: missingItems.length }), 'success');
    });
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
    restoreGridColumnWidths(this.gridApi, this.gridWidthScope, this.trackingService.getEmail());
  }

  isStockRestrictedEntry(): boolean {
    return this.isTransferEntry() || this.isInventoryAdjustmentEntry();
  }

  onColumnResized(event: any): void {
    saveGridColumnWidths(this.gridApi, this.gridWidthScope, this.trackingService.getEmail(), event);
  }

  private get gridWidthScope(): string {
    const movementType = String(this.context?.movementType || 'IN').toUpperCase();
    return `inandout:${movementType}:detail`;
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
        headerName: this.translate.instant('modules.warehouses.ui.entryDetail.code'),
        width: this.isInventoryAdjustmentEntry() ? 140 : 100,
        filter: 'agTextColumnFilter',
        editable: (params: any) => (!this.isStockRestrictedEntry() && !this.isStandardOutgoingEntry()) || !params.data?.__autoStockRow,
        valueSetter: (params: any) => {
          params.data.code = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      },
      {
        field: 'description',
        headerName: this.translate.instant('modules.warehouses.ui.entryDetail.description'),
        width: this.isInventoryAdjustmentEntry() ? 500 : 430,
        minWidth: this.isInventoryAdjustmentEntry() ? 500 : 430,
        resizable: true,
        suppressSizeToFit: true,
        cellDataType: false, // Desactivar auto-detección de tipo
        editable: (params: any) => (!this.isStockRestrictedEntry() && !this.isStandardOutgoingEntry()) || !params.data?.__autoStockRow,
        cellEditor: 'selectMaterialEditor',
        cellEditorParams: (params: any) => {
          const isTransfer = this.isTransferEntry();
          const stockRestricted = isTransfer || this.isInventoryAdjustmentEntry();
          const isOutgoing = this.context?.movementType === 'OUT';
          return {
            options: this.getMaterialPickerOptions()
              .concat(stockRestricted || isOutgoing ? [] : [{ id: '__ADD_MATERIAL__', code: '', description: '+ Agregar material...' }]),
            currentIdBrand: params.data?.idBrand,
            // En un traspaso solo se pueden seleccionar materiales ya existentes
            // que tengan existencia en el almacén origen.
            onAddMaterial: stockRestricted || isOutgoing ? undefined : () => this.quickAddMaterial()
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
            const selectedMaterial = this.materials?.find(m => Number(m.id) === Number(newValue.id));
            if (selectedMaterial) {
              params.data.idProduct = selectedMaterial.id;
              params.data.materialName = selectedMaterial.description;
              params.data.description = selectedMaterial.description;
              params.data.code = selectedMaterial.code || '';
              params.data.measure = this.context.movementType === 'OUT' && selectedMaterial.conversion
                ? selectedMaterial.conversion.measureTo
                : (selectedMaterial.measure || selectedMaterial.unit || selectedMaterial.unidad || '');
              const stockRestricted = this.isTransferEntry() || this.isInventoryAdjustmentEntry();
              if (stockRestricted || this.context.movementType === 'OUT') {
                params.data.idBrand = newValue.idBrand == null ? null : Number(newValue.idBrand);
                params.data.brandName = newValue.brandName || '';
                params.data.pending = Number(newValue.availableStock || 0);
              }
              params.data.sourceMeasure = this.context.movementType === 'IN' && selectedMaterial.conversion
                ? selectedMaterial.measure
                : null;
              params.data.sourceMeasureId = this.context.movementType === 'IN' && selectedMaterial.conversion
                ? Number(selectedMaterial.idMeasure)
                : null;
              if (stockRestricted && newValue.brandName) this.updatePendingForBrand(params.data);
              else if (!stockRestricted) this.setSelectedMaterialBrand(params.data, selectedMaterial);
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
            if (this.isTransferEntry() || this.isInventoryAdjustmentEntry()) {
              params.data.pending = Number(selectedMaterial.availableStock || 0);
            }
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
        headerName: this.translate.instant('modules.warehouses.ui.entryDetail.brand'),
        width: 240,
        minWidth: 220,
        filter: 'agTextColumnFilter',
        editable: (params: any) => !params.data?.__autoStockRow
          && !this.isTransferEntry() && !this.isInventoryAdjustmentEntry()
          && (this.materials.find(item => Number(item.id) === Number(params.data?.idProduct))?.brands?.length || 0) > 1,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: (params: any) => {
          const material = this.materials.find(item => Number(item.id) === Number(params.data?.idProduct));
          const brandValues = (material?.brands || []).map((brand: any) => String(brand.brand));
          if (this.context.movementType === 'OUT' || this.isTransferEntry() || this.isInventoryAdjustmentEntry()) brandValues.unshift('Sin marca');
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
          if (String(params.newValue) === 'Sin marca' && (this.context.movementType === 'OUT' || this.isTransferEntry() || this.isInventoryAdjustmentEntry())) {
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
        headerName: this.translate.instant(this.context.movementType === 'OUT' ? 'modules.warehouses.ui.entryDetail.issueUnit' : 'modules.warehouses.ui.entryDetail.receiptUnit'),
        width: 100,
        editable: (params: any) => {
          if ((this.isStockRestrictedEntry() || this.isStandardOutgoingEntry()) && params.data?.__autoStockRow) return false;
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
        headerName: this.translate.instant(this.isInitialInventoryEntry() ? 'modules.warehouses.ui.entryDetail.stock' : 'modules.warehouses.ui.entryDetail.quantity'),
        width: 100,
        editable: true,
        type: 'numericColumn',
        valueSetter: (params: any) => {
          const newValue = Number(params.newValue);
          if (!Number.isFinite(newValue) || newValue < 0) {
            alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.invalidQuantity'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.quantityMustBeNonNegative'), 'warning');
            return false;
          }
          if (this.context.movementType === 'OUT' && newValue > params.data.pending) {
            alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.quantityExceeded'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.quantityExceedsAvailableReceipts', { pending: params.data.pending }), 'warning');
            return false;
          }
          if (this.isTransferEntry() && newValue > Number(params.data.pending || 0)) {
            alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.quantityExceeded'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.quantityExceedsSelectedBrandStock', { pending: params.data.pending }), 'warning');
            return false;
          }
          if (this.context.movementType === 'IN' && this.entryData?.idOc > 0 && newValue > Number(params.data.pending || 0)) {
            alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.quantityExceeded'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.quantityExceedsPurchaseOrder', { pending: params.data.pending }), 'warning');
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
          ? (this.entryData?.idEntry > 0 ? this.translate.instant('modules.warehouses.ui.entryDetail.pendingVoucher') : this.translate.instant('modules.warehouses.ui.entryDetail.stock'))
          : ((this.isTransferEntry() || this.isInventoryAdjustmentEntry())
            ? this.translate.instant('modules.warehouses.ui.entryDetail.warehouseStock')
            : (this.entryData?.idOc > 0 ? this.translate.instant('modules.warehouses.ui.entryDetail.purchaseOrderQuantity') : this.translate.instant('modules.warehouses.ui.entryDetail.pending'))),
        width: this.context.movementType === 'OUT' ? 135 : 120,
        minWidth: this.context.movementType === 'OUT' ? 135 : 120,
        editable: false,
        type: 'numericColumn'
      },
      {
        field: 'total',
        headerName: this.translate.instant('modules.warehouses.ui.entryDetail.total'),
        width: 120,
        minWidth: 120,
        editable: (params: any) => (!this.isStockRestrictedEntry() && !this.isStandardOutgoingEntry()) || !params.data?.__autoStockRow,
        type: 'numericColumn'
      },
      {
        field: 'comment',
        headerName: this.translate.instant('modules.warehouses.ui.entryDetail.comment'),
        width: 240,
        minWidth: 180,
        editable: true,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorPopup: true,
        cellEditorParams: { maxLength: 500, rows: 4, cols: 40 },
        valueSetter: (params: any) => {
          params.data.comment = String(params.newValue ?? '').trim();
          return true;
        }
      },
      ...(this.context?.movementType === 'OUT' ? [{
        field: 'addToDailyReport',
        headerName: this.translate.instant('modules.warehouses.ui.entryDetail.dailyReport'),
        width: 100,
        editable: true,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
        headerTooltip: this.translate.instant('modules.warehouses.ui.entryDetail.addMaterialToDailyReportTooltip'),
        tooltipValueGetter: () => this.translate.instant('modules.warehouses.ui.entryDetail.dailyReportCreationTooltip')
      }] : []),
    ];
  }

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single',
    onCellKeyDown: navigateEditableCellOnEnter,
    onCellClicked: (event: any) => {
      if (event.colDef?.field !== 'description' || event.rowIndex == null) return;
      const alreadyEditing = event.api.getEditingCells().some((cell: any) =>
        cell.rowIndex === event.rowIndex && cell.column.getColId() === 'description'
      );
      if (!alreadyEditing) {
        event.api.startEditingCell({ rowIndex: event.rowIndex, colKey: 'description' });
      }
    },
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
    const startsAtZero = this.isInitialInventoryEntry() || this.isInventoryAdjustmentEntry() || this.isTransferEntry();
    const newItem = {
      id: tempId,
      code: '',
      idInandout: this.params.data.id,
      idProduct: 0,
      description: '',
      materialName: '',
      measure: '',
      quantity: startsAtZero ? 0 : 1,
      pending: 0,
      total: startsAtZero ? 0 : 1,
      comment: '',
      addToDailyReport: false,
      active: true,
      __originalQuantity: 0,
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

  onDetailGridCellKeyDown(event: any): void {
    const keyEvent: KeyboardEvent = event?.event || event;
    if (keyEvent?.key !== 'F10') return;
    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    if (keyEvent.repeat) return;
    event.api?.stopEditing();
    void this.saveChanges();
  }

  deleteSelectedItem() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó detail cell renderer entry items', 'ModWareHousesTD', this.trackingService.getEmail());
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.selectionRequired'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.selectItemToDelete'), 'warning');
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

        if (selectedItem.__isNew) {
          this.applyBrandStockToRows();
        } else {
          this.loadMaterials();
        }
      });
    }
  }

  private async validateOutgoingStock(): Promise<boolean> {
    const warehouseId = Number(this.entryData?.idWarehouse || this.context?.idWarehouse || 0);
    const stockService = this.context?.inandoutService;
    if (!warehouseId || !stockService?.getStock) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.warehouseRequired'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.selectWarehouseBeforeSavingIssue'), 'warning');
      return false;
    }

    const groups = new Map<string, { item: any; quantity: number; originalQuantity: number }>();
    for (const item of this.rowData.filter(row => row.active !== false && Number(row.active) !== 0)) {
      const productId = Number(item.idProduct || 0);
      const quantity = Math.max(0, Number(item.quantity ?? item.total) || 0);
      if (!productId || quantity <= 0) continue;
      const material = this.materials.find(candidate => Number(candidate.id) === productId);
      if ((material?.brands?.length || 0) > 1 && item.idBrand == null && item.brandName !== 'Sin marca') {
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.brandRequired'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.selectBrandBeforeSavingIssue', { material: item.description || material.description }), 'warning');
        return false;
      }
      const key = this.materialBrandKey(item);
      const group = groups.get(key);
      const originalQuantity = item.__isNew ? 0 : Math.max(0, Number(item.__originalQuantity) || 0);
      if (group) {
        group.quantity += quantity;
        group.originalQuantity += originalQuantity;
      } else {
        groups.set(key, { item, quantity, originalQuantity });
      }
    }

    for (const { item, quantity, originalQuantity } of groups.values()) {
      const material = this.materials.find(candidate => Number(candidate.id) === Number(item.idProduct));
      const brandCount = material?.brands?.length || 0;
      const brandId = item.idBrand != null
        ? Number(item.idBrand)
        : (item.brandName === 'Sin marca' ? 0 : (brandCount === 1 ? Number(material.brands[0].id) : undefined));
      let currentStock: number;
      try {
        if (this.isStandardOutgoingEntry() && Array.isArray(material?.stockOptions)) {
          const stockOption = material.stockOptions.find((option: any) => {
            if (brandId === 0) return Number(option.idBrand) === 0 || option.brandName === 'Sin marca';
            if (brandId == null) return option.idBrand == null;
            return Number(option.idBrand) === Number(brandId);
          });
          currentStock = Math.max(0, Number(stockOption?.availableStock) || 0);
        } else {
          const response = await lastValueFrom(stockService.getStock(Number(item.idProduct), warehouseId, brandId));
          currentStock = this.getStockValue(response);
        }
      } catch {
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.stockValidationFailed'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.couldNotCheckStock'), 'error');
        return false;
      }

      let availableToThisDocument = currentStock + originalQuantity;
      const sourceEntryId = Number(this.entryData?.idEntry || 0);
      if (sourceEntryId > 0 && this.context?.getSourceRemainingQuantity) {
        const remainingFromSource = Number(this.context.getSourceRemainingQuantity('OUT', sourceEntryId, item)) || 0;
        availableToThisDocument = Math.min(availableToThisDocument, remainingFromSource + originalQuantity);
      }
      if (quantity > availableToThisDocument) {
        alerts.basicAlert(
          this.translate.instant('modules.warehouses.ui.entryDetail.messages.insufficientStock'),
          this.translate.instant('modules.warehouses.ui.entryDetail.messages.issueQuantityExceedsStock', { material: item.description || material?.description || this.translate.instant('modules.warehouses.ui.entryDetail.material'), available: availableToThisDocument, quantity }),
          'warning'
        );
        return false;
      }
    }
    return true;
  }

  async saveChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en detail cell renderer entry items', 'ModWareHousesTD', this.trackingService.getEmail());
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.noChanges'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.noPendingChangesToSave'), 'info');
      return;
    }

    if (this.context && this.context.ITEMS && this.context.ITEMS.save) {
      if (this.isLinkedSourceBalanceUnverified()) {
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.pendingQuantityUnverified'), this.context?.getSourceBalanceWarning?.() || this.translate.instant('modules.warehouses.ui.entryDetail.messages.couldNotCheckSourcePending'), 'warning');
        return;
      }
      if (this.context.movementType === 'OUT' && !(await this.validateOutgoingStock())) return;
      const entryId = this.params.data.id;
      const hasAutoStockRows = this.rowData.some(item => item.__autoStockRow);
      if (this.isStockRestrictedEntry() && hasAutoStockRows && !this.rowData.some(item => item.__autoStockRow && Number(item.quantity) > 0)) {
        alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.noQuantities'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.enterPositiveQuantityBeforeSaving'), 'info');
        return;
      }
      const rowsToSave = this.rowData.filter(item => !item.__autoStockRow || Number(item.quantity) > 0);
      const saved = await this.context.ITEMS.save(entryId, rowsToSave);
      if (saved === false) return;
      this.rowData = this.rowData.filter(item => !item.__autoStockRow || Number(item.quantity) > 0);
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.rowData.forEach(item => {
        item.__originalQuantity = Number(item.quantity) || 0;
        item.__isNew = false;
        item.__modified = false;
        item.__autoStockRow = false;
      });
      this.context.ITEMS.updateCount?.(entryId, this.rowData.length);
      this.hasUnsavedChanges = this.rowData.some(item => item.__isNew || item.__modified || item.addToDailyReport);
    }
  }

  isLinkedSourceBalanceUnverified(): boolean {
    const sourceId = this.context?.movementType === 'IN'
      ? Number(this.entryData?.idOc || 0)
      : Number(this.entryData?.idEntry || 0);
    return sourceId > 0 && Boolean(this.context?.getSourceBalanceWarning?.());
  }

  discardChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.noChanges'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.noPendingChangesToDiscard'), 'info');
      return;
    }

    this.loadData();
    this.hasUnsavedChanges = false;
  }

  onCellValueChanged(event: any) {
    if (event.colDef.field === 'quantity') {
      event.data.total = event.newValue;
      const key = this.materialBrandKey(event.data);
      if (key) {
        this.rowData
          .filter(item => item !== event.data && this.materialBrandKey(item) === key)
          .forEach(item => this.updatePendingForBrand(item));
      }
    }

    if (event.colDef.field === 'description' && this.context.movementType === 'OUT' && event.data.idProduct) {
      this.updatePendingForBrand(event.data);
    }
    if (event.colDef.field === 'idBrand' && this.context.movementType === 'OUT' && event.data.idProduct) {
      this.rowData
        .filter(item => item !== event.data && Number(item.idProduct) === Number(event.data.idProduct))
        .forEach(item => this.updatePendingForBrand(item));
    }

    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  isTransferEntry(): boolean {
    return this.context?.movementType === 'IN' && !!this.context?.isTransferType?.(this.entryData?.idType);
  }

  private getStockValue(response: any): number {
    const value = response?.data ?? response?.stock ?? response?.quantity ?? response;
    const stock = Number(value);
    return Number.isFinite(stock) ? stock : 0;
  }

  private applyWarehouseStockToRows(): void {
    if (!this.isTransferEntry() && !this.isInventoryAdjustmentEntry()) return;
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
    const needsAvailableStock = this.context?.movementType === 'OUT' || this.isTransferEntry() || this.isInventoryAdjustmentEntry();
    if (!needsAvailableStock || !material) return;
    if (this.isTransferEntry() || this.isInventoryAdjustmentEntry()) {
      const stock = (material.stockOptions || []).find((option: any) => {
        if (brandId === 0) return Number(option.idBrand) === 0;
        if (brandId == null) return option.idBrand == null;
        return Number(option.idBrand) === Number(brandId);
      });
      row.pending = Math.max(0, Number(stock?.availableStock) || 0);
      this.gridApi?.refreshCells({ force: true, columns: ['pending'] });
      return;
    }
    if (this.isStandardOutgoingEntry() && Array.isArray(material.stockOptions)) {
      const stock = material.stockOptions.find((option: any) => {
        if (brandId === 0) return Number(option.idBrand) === 0;
        if (brandId == null) return option.idBrand == null;
        return Number(option.idBrand) === Number(brandId);
      });
      const available = Math.max(0, Number(stock?.availableStock) || 0);
      const reservedByOtherRows = this.rowData
        .filter(item => item !== row && this.materialBrandKey(item) === this.materialBrandKey(row))
        .reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
      row.pending = Math.max(0, available - reservedByOtherRows);
      this.gridApi?.refreshCells({ force: true, columns: ['pending'] });
      return;
    }
    if (usesBrandStock && brandId == null) {
      row.pending = 0;
      this.gridApi?.refreshCells({ force: true, columns: ['pending'] });
      return;
    }
    const sourceEntryId = Number(this.entryData?.idEntry || 0);
    if (this.context?.movementType === 'OUT' && sourceEntryId > 0) {
      const sourceItem = (this.context?.getSourceRemainingItems?.('OUT', sourceEntryId) || []).find((item: any) => {
        if (Number(item.idProduct || item.idSupplie || 0) !== Number(row.idProduct)) return false;
        if (item.idBrand == null && row.idBrand == null) return true;
        if (item.idBrand != null && row.idBrand != null) return Number(item.idBrand) === Number(row.idBrand);
        return (material?.brands?.length || 0) === 1;
      });
      if (sourceItem) {
        row.pending = Math.max(0, Number(sourceItem.remainingQuantity) || 0);
        this.gridApi?.refreshCells({ force: true, columns: ['pending'] });
        return;
      }
    }
    const warehouseId = Number(this.entryData?.idWarehouse || this.context?.idWarehouse || 0);
    if (!warehouseId || !this.context?.inandoutService?.getStock) return;
    const rowKey = this.materialBrandKey(row);
    const matchingRows = this.rowData.filter(item => rowKey && this.materialBrandKey(item) === rowKey);
    const originalDocumentQuantity = matchingRows
      .reduce((total, item) => total + Math.max(0, Number(item.__originalQuantity) || 0), 0);
    const reservedByOtherRows = matchingRows
      .filter(item => item !== row)
      .reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0);
    const queryBrandId = brandCount > 1 ? brandId : undefined;
    this.context.inandoutService.getStock(Number(row.idProduct), warehouseId, queryBrandId).subscribe({
      next: (response: any) => {
        row.pending = Math.max(0, this.getStockValue(response) + originalDocumentQuantity - reservedByOtherRows);
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
          const activeMaterials = materials.filter(mat => this.isMaterialActive(mat)).map(mat => {
            const materialConversions = conversions.filter(row => Number(row.idMaterial) === Number(mat.id));
            const conversion = materialConversions.find(row => Number(row.idMeasureFrom) === Number(mat.idMeasure));
            const materialBrands = brands.filter(row => Number(row.idMaterial) === Number(mat.id));
            return { ...mat, conversion, conversions: materialConversions, brands: materialBrands };
          });
          if (this.isStandardOutgoingEntry()) {
            const warehouseId = this.getSelectedWarehouseId();
            if (!warehouseId) {
              this.materials = [];
              if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.colDefs);
              return;
            }
            this.loadWarehouseStockMaterials(activeMaterials, warehouseId);
            return;
          }
          if (this.context.movementType === 'OUT') {
            const warehouseId = Number(this.entryData?.idWarehouse || this.context?.idWarehouse || 0);
            if (!warehouseId || !this.context?.inandoutService?.getStock) {
              this.materials = [];
              if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.colDefs);
              return;
            }
            from(activeMaterials).pipe(
              mergeMap(material => this.context.inandoutService.getStock(material.id, warehouseId).pipe(
                map((response: any) => ({ ...material, availableStock: this.getStockValue(response) })),
                catchError(() => of({ ...material, availableStock: 0 }))
              ), 8),
              toArray()
            ).subscribe({
              next: async (materialsWithStock: any[]) => {
                const sourceEntryId = Number(this.entryData?.idEntry || 0);
                if (sourceEntryId > 0) {
                  await this.context?.refreshSourceEntries?.();
                }
                const productsAlreadyInDetails = new Set(this.rowData.map(item => Number(item.idProduct)).filter(id => id > 0));
                const sourceProductIds = new Set<number>(
                  (this.context?.getSourceRemainingItems?.('OUT', sourceEntryId) || [])
                    .map((item: any) => Number(item.idProduct || item.idSupplie || 0))
                    .filter((id: number) => id > 0)
                );
                this.materials = materialsWithStock.filter(material =>
                  material.availableStock > 0
                  || productsAlreadyInDetails.has(Number(material.id))
                  || sourceProductIds.has(Number(material.id))
                );
                this.applyBrandStockToRows();
                if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.colDefs);
              },
              error: error => {
                console.error('Error loading materials with available stock:', error);
                this.materials = [];
                if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.colDefs);
              }
            });
            return;
          }
          if (!this.isTransferEntry() && !this.isInventoryAdjustmentEntry()) {
            this.materials = activeMaterials;
            this.applyBrandStockToRows();
            if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.colDefs);
            return;
          }

          const stockWarehouseId = this.getSelectedWarehouseId();
          if (!stockWarehouseId) {
            this.materials = [];
            if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.colDefs);
            return;
          }

          this.loadWarehouseStockMaterials(activeMaterials, stockWarehouseId);
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

  private getSelectedWarehouseId(): number {
    // En un traspaso ya guardado, la fila conserva el almacén origen en idWarehouse
    // y el destino en idWarehouseOrigin, aunque la lista esté filtrada por destino.
    if (this.isTransferEntry() && Number(this.entryData?.id || 0) > 0) {
      const sourceWarehouseId = Number(this.entryData?.idWarehouse || this.entryData?.idWarehouseOrigin || 0);
      if (sourceWarehouseId) return sourceWarehouseId;
    }
    if (typeof this.context?.getSelectedWarehouseId === 'function') {
      return Number(this.context.getSelectedWarehouseId() || 0);
    }
    return Number(this.context?.idWarehouse || this.entryData?.idWarehouse || 0);
  }

  private getMaterialPickerOptions(): any[] {
    const options: any[] = [];
    const requiresStock = this.isStockRestrictedEntry() || this.context?.movementType === 'OUT';
    this.materials.forEach(material => {
      const stockOptions = material.stockOptions || [{
        idBrand: null,
        brandName: '',
        availableStock: material.availableStock || 0,
        stockAvailable: true
      }];
      stockOptions.forEach((stockOption: any) => {
        const usedInCurrentDetail = this.rowData.some(row =>
          Number(row.idProduct) === Number(material.id) &&
          (row.idBrand == null ? stockOption.idBrand == null : Number(row.idBrand) === Number(stockOption.idBrand))
        );
        if (requiresStock && Number(stockOption.availableStock) <= 0 && !usedInCurrentDetail) return;
        if (requiresStock && stockOption.stockAvailable === false && !usedInCurrentDetail) return;
        options.push({
          id: material.id,
          valueKey: `${material.id}:${stockOption.idBrand == null ? 'none' : stockOption.idBrand}`,
          code: material.code || '',
          description: material.description,
          idBrand: stockOption.idBrand ?? null,
          brandName: stockOption.brandName || '',
          availableStock: Number(stockOption.availableStock) || 0
        });
      });
    });
    return options;
  }

  /** Uses the same warehouse movement aggregation as Inventarios, grouped by material and brand. */
  private loadWarehouseStockMaterials(activeMaterials: any[], warehouseId: number): void {
    const requestWarehouseId = Number(warehouseId);
    this.loadingWarehouseStock = true;
    const movements$ = (['IN', 'OUT'] as const).map(type =>
      this.inventoryService.getWarehouseMovements(requestWarehouseId, type).pipe(
        catchError(error => {
          console.error(`Error consultando movimientos ${type} del almacén ${requestWarehouseId}:`, error);
          return of([]);
        }),
        switchMap((response: any) => {
          const masters = Array.isArray(response) ? response : (response?.data || response?.result || []);
          if (!masters.length) return of([]);
          return forkJoin(masters.map((master: any) =>
            this.inventoryService.getMovementItems(Number(master.id ?? master.Id)).pipe(
              catchError(error => {
                console.error(`Error consultando partidas del movimiento ${master.id ?? master.Id}:`, error);
                return of([]);
              }),
              map((details: any) => Array.isArray(details) ? details : (details?.data || details?.result || []))
            )
          )).pipe(map((groups: any[][]) => groups.flat()));
        })
      )
    );

    forkJoin(movements$).subscribe({
      next: (movementGroups: any[][]) => {
        this.loadingWarehouseStock = false;
        if (Number(this.getSelectedWarehouseId()) !== requestWarehouseId) return;
        const quantitiesByMaterialBrand = new Map<string, number>();
        movementGroups.forEach((details: any[], movementIndex: number) => {
          details.forEach((item: any) => {
            if (item.active === false || Number(item.active) === 0) return;
            const materialId = Number(item.idProduct ?? item.IdProduct ?? item.idSupplie ?? 0);
            if (!materialId) return;
            const brandId = item.idBrand ?? item.IdBrand;
            const key = `${materialId}|${brandId == null ? 'none' : Number(brandId)}`;
            const quantity = Number(item.quantity ?? item.Quantity ?? item.total ?? item.Total ?? 0);
            const signedQuantity = movementIndex === 0 ? quantity : -quantity;
            quantitiesByMaterialBrand.set(key, (quantitiesByMaterialBrand.get(key) || 0) + signedQuantity);
          });
        });

        const materialsWithStock = activeMaterials.map(material => {
          const brands = material.brands || [];
          const stockOptions = brands.length > 1
            ? [
                ...brands.map((brand: any) => ({
                  idBrand: Number(brand.id ?? brand.Id),
                  brandName: brand.brand ?? brand.Brand ?? '',
                  availableStock: this.getBrandStock(quantitiesByMaterialBrand, Number(material.id), Number(brand.id ?? brand.Id))
                })),
                { idBrand: 0, brandName: 'Sin marca', availableStock: this.getBrandStock(quantitiesByMaterialBrand, Number(material.id), 0) }
              ]
            : brands.length === 1
              ? [{
                  idBrand: Number(brands[0].id ?? brands[0].Id),
                  brandName: brands[0].brand ?? brands[0].Brand ?? '',
                  availableStock: this.getBrandStock(quantitiesByMaterialBrand, Number(material.id), Number(brands[0].id ?? brands[0].Id))
                    + this.getBrandStock(quantitiesByMaterialBrand, Number(material.id), null)
                }]
              : [{ idBrand: null, brandName: '', availableStock: this.getBrandStock(quantitiesByMaterialBrand, Number(material.id), null) }];
          return {
            ...material,
            stockOptions: stockOptions.map((option: any) => ({ ...option, stockAvailable: true })),
            availableStock: stockOptions.reduce((sum: number, option: any) => sum + Math.max(0, Number(option.availableStock) || 0), 0)
          };
        });
        const alreadyInDetails = new Set(this.rowData.map(item => Number(item.idProduct)).filter(Boolean));
        this.materials = materialsWithStock.filter(material => material.availableStock > 0 || alreadyInDetails.has(Number(material.id)));
        this.stockRowsLoaded = true;
        this.applyWarehouseStockToRows();
        this.applyBrandStockToRows();
        this.seedStockRowsWhenReady();
        if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.colDefs);
      },
      error: error => {
        this.loadingWarehouseStock = false;
        console.error('Error loading warehouse stock for inventory adjustment, transfer, or normal outgoing:', error);
        this.materials = [];
        if (this.gridApi) this.gridApi.setGridOption('columnDefs', this.colDefs);
      }
    });
  }

  private getBrandStock(stockByMaterialBrand: Map<string, number>, materialId: number, brandId: number | null): number {
    if (brandId === 0 || brandId == null) {
      return Number(stockByMaterialBrand.get(`${materialId}|none`) || 0)
        + Number(stockByMaterialBrand.get(`${materialId}|0`) || 0);
    }
    return Number(stockByMaterialBrand.get(`${materialId}|${brandId == null ? 'none' : brandId}`) || 0);
  }

  /** Loads stock rows automatically only for inventory adjustment details. */
  private seedStockRowsWhenReady(): void {
    if (!this.isInventoryAdjustmentEntry() || !this.stockRowsLoaded || !this.detailRowsLoaded) return;
    if (Number(this.entryData?.idAutoriza || 0) > 0) return;
    const rows = this.materials.flatMap(material => (material.stockOptions || [])
      .filter((stock: any) => Number(stock.availableStock) > 0)
      .filter((stock: any) => !this.rowData.some(row => this.isSameMaterialStock(row, material, stock)))
      .map((stock: any) => ({
        id: `temp_item_${this.tempIdCounter++}`,
        idInandout: this.entryData?.id,
        idProduct: Number(material.id),
        idBrand: stock.idBrand == null ? null : Number(stock.idBrand),
        brandName: stock.brandName || (stock.idBrand === 0 ? 'Sin marca' : ''),
        code: material.code || '',
        description: material.description || '',
        materialName: material.description || '',
        measure: material.measure || material.unit || material.unidad || '',
        quantity: 0,
        total: 0,
        pending: Number(stock.availableStock) || 0,
        active: true,
        __autoStockRow: true,
        __originalQuantity: 0,
        __isNew: true,
        __modified: false
      })));
    if (!rows.length) return;
    this.rowData = [...this.rowData, ...rows];
    this.gridApi?.setGridOption('rowData', this.rowData);
    this.context?.ITEMS?.updateCount?.(this.entryData?.id, this.rowData.length);
  }

  private isSameMaterialStock(row: any, material: any, stock: any): boolean {
    if (Number(row?.idProduct || 0) !== Number(material?.id || 0)) return false;
    const rowBrandId = row?.idBrand == null ? null : Number(row.idBrand);
    const stockBrandId = stock?.idBrand == null ? null : Number(stock.idBrand);
    if (stockBrandId === 0) return rowBrandId === 0 || (rowBrandId == null && row?.brandName === 'Sin marca');
    if (stockBrandId != null) {
      return rowBrandId === stockBrandId
        || (rowBrandId == null && (material?.brands?.length || 0) === 1 && row?.brandName !== 'Sin marca');
    }
    return rowBrandId == null && row?.brandName !== 'Sin marca';
  }

  private isMaterialActive(material: any): boolean {
    const isEnabled = (value: any) => value === true || value === 1 || String(value).trim().toLowerCase() === 'true' || String(value).trim() === '1';
    // Inventarios conserva los materiales activos aunque su vigencia comercial haya cambiado.
    return isEnabled(material?.active);
  }

  isInitialInventoryEntry(): boolean {
    return this.getMovementTypeBehavior() === 'INITIAL_INVENTORY';
  }

  isStandardOutgoingEntry(): boolean {
    return this.context?.movementType === 'OUT' && Number(this.entryData?.idEntry || 0) <= 0;
  }

  isTransferMovement(): boolean {
    const idType = this.entryData?.idType;
    return this.getMovementTypeBehavior() === 'TRANSFER'
      || !!this.context?.isTransferType?.(idType);
  }

  isInventoryAdjustmentEntry(): boolean {
    return this.getMovementTypeBehavior() === 'INVENTORY_ADJUSTMENT';
  }

  private getMovementTypeBehavior(): string {
    const configured = String(this.context?.getMovementTypeBehavior?.(this.entryData?.idType) || '').trim().toUpperCase();
    return ['STANDARD', 'TRANSFER', 'INITIAL_INVENTORY', 'INVENTORY_ADJUSTMENT'].includes(configured)
      ? configured
      : 'STANDARD';
  }

  private async quickAddMaterial(): Promise<void> {
    const service = this.context?.materialsService;
    const idRoot = this.context?.idRoot;
    if (!service || !idRoot) return;
    const result = await Swal.fire({
      title: `<span style="font-weight:700;color:#20344b">${this.translate.instant('modules.warehouses.ui.entryDetail.messages.addMaterial')}</span>`,
      width: 680,
      showCancelButton: true,
      confirmButtonText: `<i class="bi bi-check2-circle me-1"></i> ${this.translate.instant('modules.warehouses.ui.entryDetail.messages.saveMaterial')}`,
      cancelButtonText: this.translate.instant('modules.warehouses.ui.entryDetail.messages.cancel'),
      buttonsStyling: false,
      customClass: { popup: 'material-quick-create', confirmButton: 'btn btn-primary px-4', cancelButton: 'btn btn-light ms-2 px-4' },
      html: `
        <div style="text-align:left;background:#f7f9fc;border:1px solid #e5ebf3;border-radius:16px;padding:18px;margin-top:8px">
          <div style="color:#73849a;font-size:12px;font-weight:700;letter-spacing:.08em;margin-bottom:12px">${this.translate.instant('modules.warehouses.ui.entryDetail.messages.materialData')}</div>
          <label class="form-label small fw-semibold mb-1">${this.translate.instant('modules.warehouses.ui.entryDetail.messages.description')} *</label>
          <div class="input-group mb-3"><span class="input-group-text bg-white"><i class="bi bi-box-seam text-primary"></i></span><input id="quick-material-description" class="form-control" placeholder="${this.translate.instant('modules.warehouses.ui.entryDetail.messages.materialDescriptionPlaceholder')}" maxlength="200"></div>
          <div class="row g-3">
            <div class="col-md-6"><label class="form-label small fw-semibold mb-1">${this.translate.instant('modules.warehouses.ui.entryDetail.messages.code')}</label><div class="input-group"><span class="input-group-text bg-white"><i class="bi bi-upc text-primary"></i></span><input id="quick-material-code" class="form-control" placeholder="${this.translate.instant('modules.warehouses.ui.entryDetail.messages.materialCodePlaceholder')}" maxlength="35"></div></div>
            <div class="col-md-6"><label class="form-label small fw-semibold mb-1">${this.translate.instant('modules.warehouses.ui.entryDetail.messages.unit')} *</label><div class="input-group"><span class="input-group-text bg-white"><i class="bi bi-rulers text-primary"></i></span><input id="quick-material-measure" class="form-control" placeholder="PZA, KG, M…"></div></div>
            <div class="col-md-6"><label class="form-label small fw-semibold mb-1">${this.translate.instant('modules.warehouses.ui.entryDetail.messages.family')}</label><div class="input-group"><span class="input-group-text bg-white"><i class="bi bi-collection text-primary"></i></span><input id="quick-material-family" class="form-control" placeholder="${this.translate.instant('modules.warehouses.ui.entryDetail.messages.materialFamilyPlaceholder')}"></div></div>
            <div class="col-md-6"><label class="form-label small fw-semibold mb-1">${this.translate.instant('modules.warehouses.ui.entryDetail.messages.subfamily')}</label><div class="input-group"><span class="input-group-text bg-white"><i class="bi bi-diagram-2 text-primary"></i></span><input id="quick-material-subfamily" class="form-control" placeholder="${this.translate.instant('modules.warehouses.ui.entryDetail.messages.subfamilyPlaceholder')}"></div></div>
          </div>
        </div>`,
      focusConfirm: false,
      didOpen: () => (document.getElementById('quick-material-description') as HTMLInputElement)?.focus(),
      preConfirm: () => {
        const value = (id: string) => String((document.getElementById(id) as HTMLInputElement)?.value || '').trim();
        const description = value('quick-material-description');
        const measure = value('quick-material-measure');
        if (!description || !measure) {
          Swal.showValidationMessage(this.translate.instant('modules.warehouses.ui.entryDetail.messages.descriptionAndUnitRequired'));
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
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.materialAdded'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.materialAvailableInList'), 'success');
    } catch (error) {
      console.error('Error al agregar material rápido:', error);
      alerts.basicAlert(this.translate.instant('modules.warehouses.ui.entryDetail.messages.error'), this.translate.instant('modules.warehouses.ui.entryDetail.messages.couldNotAddMaterial'), 'error');
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

  closeDetail(): void {
    const entryId = this.entryData?.id;
    if (this.context?.componentParent?.collapseItemsDetail) {
      this.context.componentParent.collapseItemsDetail(entryId);
      return;
    }
    this.params?.node?.setExpanded(false);
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
        comment: item.comment || item.Comment || item.observaciones || '',
        brandName: item.brandName || item.brand || item.marca || brandMap.get(Number(item.idBrand)) || ''
      }));

      // Find OT Name
      let otName = 'N/A';
      const otId = this.entryData.idOt || this.entryData.id_ot;

      if (otId && this.context?.componentParent?.otList) {
        const ot = this.context.componentParent.otList.find((o: any) => o.id === otId);
        if (ot) otName = ot.name;
      }

      const sourceEntryId = Number(this.entryData?.idEntry || 0);
      const sourceEntry = sourceEntryId > 0
        ? (this.context?.componentParent?.entryList || []).find((entry: any) => Number(entry.id) === sourceEntryId)
        : null;
      const destinationWarehouseId = Number(this.entryData?.idWarehouseOrigin || 0);
      const destinationWarehouse = (this.context?.componentParent?.warehouses || []).find((warehouse: any) =>
        Number(warehouse.idAlmacen ?? warehouse.idWarehouse ?? warehouse.id) === destinationWarehouseId
      );
      const destinationWarehouseName = destinationWarehouse
        ? destinationWarehouse.nombreAlmacen || destinationWarehouse.nameWarehouse || destinationWarehouse.name || destinationWarehouse.description
        : destinationWarehouseId ? `Almacén #${destinationWarehouseId}` : '';
      const sourceWarehouseId = Number(this.entryData?.idWarehouse || this.context?.idWarehouse || 0);
      const sourceWarehouse = (this.context?.componentParent?.warehouses || []).find((warehouse: any) =>
        Number(warehouse.idAlmacen ?? warehouse.idWarehouse ?? warehouse.id) === sourceWarehouseId
      );
      const sourceWarehouseName = sourceWarehouse
        ? sourceWarehouse.nombreAlmacen || sourceWarehouse.nameWarehouse || sourceWarehouse.name || sourceWarehouse.description
        : sourceWarehouseId ? `Almacén #${sourceWarehouseId}` : '';
      const movementCatalog = (this.context?.componentParent?.catalogs || []).find((catalog: any) =>
        Number(catalog.id) === Number(this.entryData?.idType)
      );
      const reportEntryData = {
        ...this.entryData,
        otName,
        sourceEntryFolio: sourceEntry?.folio || '',
        isTransfer: this.isTransferEntry(),
        movementTypeName: movementCatalog?.description || movementCatalog?.name || '',
        sourceWarehouseName,
        destinationWarehouseName
      };

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
