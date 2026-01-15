import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, ICellRendererParams, GridApi } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CustomersService } from 'app/services/customers.service';
import { SignalsService } from 'app/services/signals.service';
import { NgSelectModule } from '@ng-select/ng-select';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.vfs = pdfFonts.vfs;

@Component({
  selector: 'app-detail-cell-renderer-proveedor',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, NgSelectModule],
  template: `
    <div class="detail-grid-container">
      <!-- Header con controles -->
      <div class="mb-2 d-flex justify-content-between align-items-end gap-3">
        <!-- PDF Cotización -->
        <div style="flex: 0 0 auto;">
          <label class="form-label small">PDF Cotización:</label>
          <div class="input-group input-group-sm">
            <button class="btn btn-outline-secondary" type="button" (click)="generatePlaceholderPdf()" title="Ver PDF">
              <i class="bi bi-file-earmark-pdf text-danger"></i>
            </button>
            <input type="file" #fileInput accept=".pdf" style="display: none;" (change)="onFileSelected($event)">
            <button class="btn btn-outline-secondary" type="button" (click)="fileInput.click()" title="Cargar PDF">
              <i class="bi bi-upload"></i>
            </button>
          </div>
        </div>

        <!-- Fecha Proveedor -->
        <div style="flex: 0 0 auto;">
          <label class="form-label small">Fecha Proveedor:</label>
          <input type="date" class="form-control form-control-sm" [(ngModel)]="fechaProveedor" style="width: 140px;">
        </div>

        <!-- Seleccionar Proveedor -->
        <div style="flex: 1; min-width: 200px;">
          <label class="form-label small">Seleccionar Proveedor:</label>
          <ng-select
            [items]="providers"
            bindValue="id"
            bindLabel="description"
            [(ngModel)]="selectedProviderId"
            [clearable]="true"
            placeholder="Seleccione proveedor"
            (ngModelChange)="onProviderChange()">
          </ng-select>
        </div>

        <!-- Botones CRUD -->
        <div class="d-flex gap-1" style="flex: 0 0 auto;">
          <button type="button" class="btn btn-sm btn-success position-relative" (click)="saveChanges()" title="Guardar cambios">
            <i class="bi bi-floppy"></i>
            <span
              class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
              *ngIf="hasUnsavedChanges">
              <span class="visually-hidden">Hay cambios sin guardar</span>
            </span>
          </button>
          <button type="button" class="btn btn-sm btn-warning" (click)="revertChanges()" title="Deshacer cambios">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button type="button" class="btn btn-sm btn-danger" (click)="deleteItem()" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>

      <!-- Grid de artículos -->
      <ag-grid-angular
        class="ag-theme-quartz small-text-ag-grid"
        [rowData]="rowData"
        [columnDefs]="colDefs"
        [gridOptions]="gridOptions"
        [localeText]="AG_GRID_LOCALE_ES"
        (gridReady)="onGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        style="height: 200px; width: 100%;">
      </ag-grid-angular>
    </div>
  `,
  styles: [`
    .detail-grid-container {
      padding: 10px;
      background-color: #e3f2fd;
      border-radius: 8px;
    }
    .form-label {
      margin-bottom: 2px;
      font-weight: 500;
    }
  `]
})
export class DetailCellRendererProveedorComponent {
  private customersService = inject(CustomersService);
  private signalsService = inject(SignalsService);

  private params!: ICellRendererParams;
  private gridApi!: GridApi;

  rowData: any[] = [];
  providers: any[] = [];
  selectedProviderId: number | null = null;
  fechaProveedor: string = new Date().toISOString().split('T')[0];
  pdfFileName: string = '';
  selectedFile: File | null = null;
  hasUnsavedChanges: boolean = false;
  providerLabel: string = '';
  providerField: string = '';

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerLabel = params.context?.providerLabel || 'Proveedor';
    this.providerField = params.context?.providerField || 'idProvider';

    // Obtener el idProvider actual del row
    const currentProviderId = this.params.data[this.providerField];
    if (currentProviderId && currentProviderId > 0) {
      this.selectedProviderId = currentProviderId;
    }

    this.loadProviders();
    this.buildRowData();
  }

  onGridReady(params: any) {
    this.gridApi = params.api;
  }

  async loadProviders() {
    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      const allProviders: any = await this.customersService.getCustomersByCompany(idRoot, 'PROVIDERS').toPromise();

      // Filtrar solo vigentes y mapear a formato para ng-select
      this.providers = allProviders
        .filter((p: any) => p.vigente === true || p.vigente === 1)
        .map((p: any) => ({
          id: p.id,
          description: p.description || p.name || `Proveedor ${p.id}`
        }));

      console.log('📦 Proveedores cargados:', this.providers.length);
    } catch (error) {
      console.error('❌ Error cargando proveedores:', error);
      this.providers = [];
    }
  }

  buildRowData() {
    // Obtener los artículos del pedimento
    const articulos = this.params.data.articulos || [];

    this.rowData = articulos.map((item: any, index: number) => ({
      active: true,
      numArticulo: item.numArticle || (index + 1),
      articulo: item.article || '',
      codigoExterno: '',
      costoUnitario: 0,
      compraMinima: 1,
      tiempoEntrega: '',
      cantidadConfirmada: item.quantity || 0,
      costoTotal: 0,
      autorizado: false,
      oc: ''
    }));
  }

  onProviderChange() {
    this.hasUnsavedChanges = true;
    console.log('Proveedor seleccionado:', this.selectedProviderId);
  }

  onCellValueChanged(event: any) {
    this.hasUnsavedChanges = true;

    // Si cambia el costo unitario, recalcular costo total
    if (event.column.getColId() === 'costoUnitario' || event.column.getColId() === 'cantidadConfirmada') {
      const row = event.data;
      row.costoTotal = (row.costoUnitario || 0) * (row.cantidadConfirmada || 0);
      this.gridApi.refreshCells({ rowNodes: [event.node], force: true });
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
      this.pdfFileName = file.name;
      this.hasUnsavedChanges = true;
    } else if (file) {
      alert('Por favor seleccione un archivo PDF válido');
      this.pdfFileName = '';
      this.selectedFile = null;
    }
  }

  generatePlaceholderPdf() {
    // Generar PDF placeholder con logos y "En construcción"
    const docDefinition: any = {
      pageSize: 'LETTER',
      pageMargins: [40, 60, 40, 60],
      content: [
        // Logo superior (placeholder)
        {
          columns: [
            {
              text: '[ LOGO EMPRESA ]',
              alignment: 'left',
              fontSize: 12,
              color: '#666'
            },
            {
              text: '[ LOGO PROVEEDOR ]',
              alignment: 'right',
              fontSize: 12,
              color: '#666'
            }
          ],
          margin: [0, 0, 0, 40]
        },

        // Título
        {
          text: 'COTIZACIÓN DE PROVEEDOR',
          style: 'header',
          alignment: 'center',
          margin: [0, 40, 0, 20]
        },

        // Información del proveedor
        {
          text: `Proveedor: ${this.getSelectedProviderName()}`,
          fontSize: 12,
          margin: [0, 10, 0, 5]
        },
        {
          text: `Fecha: ${this.fechaProveedor}`,
          fontSize: 12,
          margin: [0, 0, 0, 30]
        },

        // Mensaje de en construcción
        {
          text: '🚧 EN CONSTRUCCIÓN 🚧',
          style: 'construction',
          alignment: 'center',
          margin: [0, 60, 0, 20]
        },
        {
          text: 'Esta funcionalidad está en desarrollo.',
          alignment: 'center',
          fontSize: 12,
          color: '#666',
          margin: [0, 0, 0, 10]
        },
        {
          text: 'Próximamente podrá ver la cotización completa del proveedor.',
          alignment: 'center',
          fontSize: 12,
          color: '#666'
        },

        // Tabla placeholder
        {
          margin: [0, 40, 0, 0],
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: '#', style: 'tableHeader' },
                { text: 'ARTÍCULO', style: 'tableHeader' },
                { text: 'CANTIDAD', style: 'tableHeader' },
                { text: 'PRECIO', style: 'tableHeader' },
                { text: 'TOTAL', style: 'tableHeader' }
              ],
              ...this.rowData.map((item, index) => [
                { text: index + 1, alignment: 'center' },
                { text: item.articulo || '-' },
                { text: item.cantidadConfirmada || 0, alignment: 'center' },
                { text: '$0.00', alignment: 'right' },
                { text: '$0.00', alignment: 'right' }
              ])
            ]
          }
        }
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          color: '#333'
        },
        construction: {
          fontSize: 24,
          bold: true,
          color: '#ff6600'
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          fillColor: '#4472C4',
          color: 'white',
          alignment: 'center'
        }
      }
    };

    pdfMake.createPdf(docDefinition).open();
  }

  getSelectedProviderName(): string {
    if (!this.selectedProviderId) return 'Sin seleccionar';
    const provider = this.providers.find(p => p.id === this.selectedProviderId);
    return provider ? provider.description : 'Sin seleccionar';
  }

  saveChanges() {
    // TODO: Implementar guardado en backend cuando esté disponible
    console.log('💾 Guardando cambios (frontend only)...');
    console.log('Provider:', this.selectedProviderId);
    console.log('Fecha:', this.fechaProveedor);
    console.log('Artículos:', this.rowData);

    this.hasUnsavedChanges = false;
    alert('Cambios guardados localmente. La integración con backend está pendiente.');
  }

  revertChanges() {
    this.buildRowData();
    this.hasUnsavedChanges = false;
    this.gridApi?.setGridOption('rowData', this.rowData);
  }

  deleteItem() {
    // TODO: Implementar eliminación
    console.log('🗑️ Eliminar (frontend only)');
    alert('Funcionalidad de eliminación pendiente de implementar.');
  }

  get colDefs(): ColDef[] {
    return [
      {
        field: 'active',
        headerName: 'Activo',
        width: 80,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
        editable: true
      },
      {
        field: 'numArticulo',
        headerName: '# Art',
        width: 70
      },
      {
        field: 'articulo',
        headerName: 'Artículo',
        width: 180,
        flex: 1
      },
      {
        field: 'codigoExterno',
        headerName: 'Cód. Externo',
        width: 110,
        editable: true
      },
      {
        field: 'costoUnitario',
        headerName: 'Costo Unit.',
        width: 100,
        editable: true,
        valueFormatter: params => params.value ? `$${params.value.toFixed(2)}` : '$0.00'
      },
      {
        field: 'compraMinima',
        headerName: 'Compra Mín.',
        width: 100,
        editable: true
      },
      {
        field: 'tiempoEntrega',
        headerName: 'T. Entrega',
        width: 100,
        editable: true
      },
      {
        field: 'cantidadConfirmada',
        headerName: 'Cant. Conf.',
        width: 100,
        editable: true
      },
      {
        field: 'costoTotal',
        headerName: 'Costo Total',
        width: 110,
        valueFormatter: params => params.value ? `$${params.value.toFixed(2)}` : '$0.00'
      },
      {
        field: 'autorizado',
        headerName: 'Autoriz.',
        width: 80,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
        editable: true
      },
      {
        field: 'oc',
        headerName: 'OC',
        width: 80,
        editable: true
      }
    ];
  }

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 28,
    animateRows: true,
    suppressCellFocus: false,
    stopEditingWhenCellsLoseFocus: true
  };
}
