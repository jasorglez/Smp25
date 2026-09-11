import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, ICellRendererComp } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { SelectMaterialEditorComponent } from './select-material-editor.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PdfReportsService } from 'app/services/pdf-reports.service';
import { TrackingService } from 'app/services/tracking.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-detail-cell-renderer-entry-items',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, SelectWithTooltipEditorV2Component, SelectMaterialEditorComponent],
  template: `
    <!-- Items Grid View -->
    <div class="detail-grid-container" *ngIf="detailType === 'items'">
      <div class="detail-actions d-flex justify-content-end mb-2">
        <button class="btn btn-primary btn-sm me-2" (click)="addItem()">
          <i class="bi bi-plus-lg"></i> Agregar
        </button>
        <button *ngIf="entryData?.idOc > 0" class="btn btn-secondary btn-sm me-2" (click)="importarItemsDeOC()"
          title="Importar artículos desde la Orden de Compra">
          <i class="bi bi-box-arrow-in-down"></i> OC
        </button>
        <button class="btn btn-warning btn-sm me-2" (click)="discardChanges()">
          <i class="bi bi-arrow-counterclockwise"></i> Deshacer
        </button>
        <button class="btn btn-danger btn-sm me-2" (click)="deleteSelectedItem()">
          <i class="bi bi-trash"></i> Eliminar
        </button>
        <button class="btn btn-success btn-sm position-relative" (click)="saveChanges()">
          <i class="bi bi-floppy"></i> Guardar
          <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
            *ngIf="hasUnsavedChanges">
            <span class="visually-hidden">Hay cambios sin guardar</span>
          </span>
        </button>
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
        <button type="button" class="btn btn-outline-secondary btn-sm" (click)="closeReport()">
          <i class="bi bi-x-lg"></i> Cerrar
        </button>
      </div>
      <div class="report-content" style="height: 700px; border: 1px solid #dee2e6; border-radius: 0.375rem;">
        <iframe
          *ngIf="pdfUrl"
          [src]="pdfUrl"
          style="width: 100%; height: 100%; border: none; border-radius: 0.375rem; zoom: 80%;">
        </iframe>
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
  private context: any;
  private sanitizer = inject(DomSanitizer);
  private pdfReportsService = inject(PdfReportsService);

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  materials: any[] = [];

  // Report properties
  detailType: string = 'items';
  entryData: any = null;
  pdfUrl: SafeResourceUrl | null = null;
  private originalPdfUrl: string | null = null;

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
    if (this.context && this.context.ITEMS && this.context.ITEMS.load) {
      const entryId = this.params.data.id;
      this.context.ITEMS.load(entryId, (data: any[]) => {
        if (data.length === 0 && this.params.data?.idOc > 0 && this.context.ITEMS.importFromOC) {
          this.context.ITEMS.importFromOC(this.params.data.idOc, entryId, (ocItems: any[]) => {
            this.rowData = ocItems;
            if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
            if (ocItems.length > 0) this.hasUnsavedChanges = true;
            if (this.context.ITEMS.updateCount) this.context.ITEMS.updateCount(entryId, this.rowData.length);
          });
          return;
        }
        this.rowData = data.map(item => ({
          ...item,
          materialName: item.description || '',
          __isNew: false,
          __modified: false
        }));
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
    this.context.ITEMS.importFromOC(idOc, entryId, (ocItems: any[]) => {
      if (!ocItems || ocItems.length === 0) {
        alerts.basicAlert('Sin artículos', 'La OC no tiene artículos activos para importar', 'info');
        return;
      }
      this.rowData = ocItems;
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
      this.hasUnsavedChanges = true;
      if (this.context.ITEMS.updateCount) this.context.ITEMS.updateCount(entryId, this.rowData.length);
      alerts.toastAlert(`${ocItems.length} artículo(s) importados de la OC`, 'success');
    });
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
              params.data.measure = selectedMaterial.measure || selectedMaterial.unit || selectedMaterial.unidad || '';
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
            params.data.measure = selectedMaterial.measure || selectedMaterial.unit || selectedMaterial.unidad || '';
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
        field: 'measure',
        headerName: 'Medida',
        width: 100,
        editable: true,
        valueSetter: (params: any) => {
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
          const newValue = params.newValue;
          if (this.context.movementType === 'OUT' && newValue > params.data.pending) {
            alerts.basicAlert('Cantidad excedida', `La cantidad no puede ser mayor al total de entradas disponibles (${params.data.pending})`, 'warning');
            return false;
          }
          params.data.quantity = newValue;
          params.data.total = newValue;
          return true;
        }
      },
      {
        field: 'pending',
        headerName: this.context.movementType === 'OUT' ? 'Total Entradas' : 'Pendiente',
        width: 100,
        editable: true,
        type: 'numericColumn'
      },
      {
        field: 'total',
        headerName: 'Total',
        width: 100,
        editable: true,
        type: 'numericColumn'
      },
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

  saveChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en detail cell renderer entry items', 'ModWareHousesTD', this.trackingService.getEmail());
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    if (this.context && this.context.ITEMS && this.context.ITEMS.save) {
      const entryId = this.params.data.id;
      this.context.ITEMS.save(entryId, this.rowData);
      this.hasUnsavedChanges = false;
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
      const idWarehouse = this.entryData.idWarehouse;
      console.log('Calling getSumaIn with idProduct:', event.data.idProduct, 'idWarehouse:', idWarehouse);
      this.context.inandoutService.getSumaIn(event.data.idProduct, idWarehouse).subscribe({
        next: (data: any) => {
          console.log('getSumaIn response:', data);
          event.data.pending = data || 0;
          if (this.gridApi) {
            this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['pending'] });
          }
        },
        error: (error) => {
          console.error('Error in getSumaIn:', error);
          event.data.pending = 0;
        }
      });
    }

    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  loadMaterials() {
    if (this.context && this.context.materialsService && this.context.idRoot) {
      this.context.materialsService.getMaterials2Fields(this.context.idRoot).subscribe({
        next: (data: any[]) => {
          this.materials = data.filter(mat => mat.active && mat.vigente);
          // Update columnDefs to refresh the select values
          if (this.gridApi) {
            this.gridApi.setGridOption('columnDefs', this.colDefs);
          }
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
    const ask = async (title: string, placeholder: string) => {
      const result = await alerts.inputAlert(title, '', 'text', '', { inputAttributes: { placeholder } });
      return result.isConfirmed ? String(result.value || '').trim() : '';
    };
    const description = await ask('Nuevo material', 'Descripción');
    if (!description) return;
    const code = await ask('Código del material', 'Código (opcional)');
    const measure = await ask('Unidad de medida', 'Ej: PZA, KG, M');
    const family = await ask('Familia', 'Familia (opcional)');
    const subfamily = await ask('Subfamilia', 'Subfamilia (opcional)');
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
      description: material.description,
      measure: material.measure || material.unit || material.unidad || '',
      quantity: 1,
      pending: 0,
      total: 1,
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

      // Get items data from the rowData (same data displayed in the grid cascade)
      const itemsData = this.rowData || [];

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
      this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(pdfUrl);

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
