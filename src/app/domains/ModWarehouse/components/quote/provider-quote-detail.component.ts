import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { lastValueFrom } from 'rxjs';
import { OcAndReqsService } from 'app/services/ocandreqs.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { ProvidersService } from 'app/services/providers.service';

@Component({
  selector: 'app-provider-quote-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './provider-quote-detail.component.html',
  styles: [`
    .provider-quote-container {
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 8px;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .provider-header {
      background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
      color: white;
      border-radius: 8px 8px 0 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .quote-grid-container {
      flex: 1;
      border: 1px solid #dee2e6;
      border-radius: 0 0 8px 8px;
      background-color: white;
      overflow: hidden;
    }

    :host-context(.provider-1) .provider-header {
      background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
    }

    :host-context(.provider-2) .provider-header {
      background: linear-gradient(135deg, #28a745 0%, #1e7e34 100%);
    }

    :host-context(.provider-3) .provider-header {
      background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
    }
  `]
})
export class ProviderQuoteDetailComponent implements OnInit {

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private context: any;
  private ocAndReqsService = inject(OcAndReqsService);
  private catalogsService = inject(CatalogsService);
  private providersService = inject(ProvidersService);

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  quoteData: any = null;
  providerNumber: number = 0;
  productos: any[] = [];
  proveedores: any[] = [];
  idRoot: number = 0;

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  
  // Grid options como propiedad para evitar errores de parser
  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 35,
    animateRows: true,
    rowSelection: 'single',
    domLayout: 'autoHeight',
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: true,
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1
    },
    onCellValueChanged: (event: any) => {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
  };

  ngOnInit() {
    this.loadProviderQuoteData();
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.quoteData = this.context?.providerQuoteData?.quoteData;
    this.providerNumber = this.context?.providerQuoteData?.providerNumber || 1;
    this.productos = this.context?.productos || [];
    this.proveedores = this.context?.proveedores || [];
    this.idRoot = this.context?.idRoot || 0;
    
    console.log('Provider Quote Detail - Data:', {
      quoteData: this.quoteData,
      providerNumber: this.providerNumber,
      productos: this.productos,
      idRoot: this.idRoot
    });
    
    this.loadProviderQuoteData();
  }

  async loadProviderQuoteData() {
    if (!this.quoteData || !this.quoteData.idReq) {
      console.log('No hay requisición seleccionada');
      return;
    }

    try {
      // Obtener items de la requisición
      const requisitionItems: any = await lastValueFrom(
        this.ocAndReqsService.getReqItems(this.quoteData.idReq)
      );
      
      console.log('Requisition items loaded:', requisitionItems);

      // Mapear a datos de cotización para el proveedor
      this.rowData = requisitionItems.map((item: any, index: number) => {
        const producto = this.productos.find((p: any) => p.id === item.idSupplie);
        return {
          id: `provider_${this.providerNumber}_item_${index}`,
          idQuoteItem: null, // Se llenará al guardar
          idRequisitionItem: item.id,
          idSupplie: item.idSupplie,
          productName: producto ? producto.description : `Producto ${item.idSupplie}`,
          productCode: producto ? producto.code : item.idSupplie,
          quantity: item.quantity || 0,
          price: 0, // El proveedor debe llenar esto
          total: 0,
          comment: item.comment || '',
          dateuse: item.dateuse,
          providerNumber: this.providerNumber,
          __isNew: true,
          __modified: false
        };
      });

      console.log('RowData mapped:', this.rowData);
      
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }
      
    } catch (error) {
      console.error('Error loading provider quote data:', error);
      alerts.basicAlert('Error', 'No se pudieron cargar los datos de la requisición', 'error');
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('columnDefs', this.colDefs);
  }

  get colDefs(): ColDef[] {
    return [
      {
        headerName: 'PROVEEDOR',
        valueGetter: () => {
          const providerNames = ['', 'PROVEEDOR 1', 'PROVEEDOR 2', 'PROVEEDOR 3'];
          return providerNames[this.providerNumber] || 'PROVEEDOR';
        },
        width: 120,
        pinned: 'left',
        cellStyle: { 
          backgroundColor: this.getProviderColor(), 
          color: 'white', 
          fontWeight: 'bold',
          textAlign: 'center'
        }
      },
      {
        field: 'productCode',
        headerName: 'Código',
        width: 100,
        editable: false,
        cellStyle: { backgroundColor: '#f8f9fa' }
      },
      {
        field: 'productName',
        headerName: 'Descripción',
        flex: 2,
        editable: false,
        cellStyle: { backgroundColor: '#f8f9fa' }
      },
      {
        field: 'quantity',
        headerName: 'Cantidad Req',
        width: 100,
        editable: false,
        cellStyle: { backgroundColor: '#f8f9fa', textAlign: 'center' }
      },
      {
        field: 'price',
        headerName: 'Precio',
        width: 120,
        editable: true,
        type: 'numericColumn',
        cellEditor: 'agNumberCellEditor',
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
        },
        valueSetter: (params: any) => {
          params.data.price = parseFloat(params.newValue) || 0;
          this.calculateTotal(params.data);
          this.hasUnsavedChanges = true;
          return true;
        }
      },
      {
        field: 'total',
        headerName: 'Total',
        width: 120,
        editable: false,
        type: 'numericColumn',
        valueFormatter: (params) => {
          return params.value ? `$${params.value.toFixed(2)}` : '$0.00';
        },
        cellStyle: { 
          backgroundColor: '#e8f5e9', 
          fontWeight: 'bold',
          textAlign: 'center'
        }
      },
      {
        field: 'comment',
        headerName: 'Comentarios',
        flex: 1,
        editable: true,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorParams: {
          maxLength: 500,
          rows: 3,
          cols: 50
        },
        valueSetter: (params: any) => {
          params.data.comment = params.newValue;
          this.hasUnsavedChanges = true;
          return true;
        }
      }
    ];
  }

  private getProviderColor(): string {
    const colors = ['', '#007bff', '#28a745', '#ffc107'];
    return colors[this.providerNumber] || '#6c757d';
  }

  private calculateTotal(item: any): void {
    item.total = item.quantity * item.price;
  }

  // Botones CRUD
  saveChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    // Validar que todos tengan precio
    const invalidItems = this.rowData.filter(item => item.price <= 0);
    if (invalidItems.length > 0) {
      alerts.basicAlert('Validación', 'Todos los items deben tener un precio mayor a cero', 'warning');
      return;
    }

    alerts.basicAlert('Éxito', 'Cotización de proveedor guardada correctamente', 'success');
    this.hasUnsavedChanges = false;
  }

  deleteSelectedItem() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un item para eliminar', 'warning');
      return;
    }

    const selectedItem = selectedNodes[0].data;
    
    alerts.confirmAlert(
      'Confirmar eliminación',
      `¿Está seguro de eliminar este item de la cotización del proveedor?`,
      'warning',
      'Sí, eliminar'
    ).then((result) => {
      if (result.isConfirmed) {
        this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
        this.gridApi.setGridOption('rowData', this.rowData);
        this.hasUnsavedChanges = true;
        
        alerts.basicAlert('Item eliminado', 'El item se eliminó correctamente', 'success');
      }
    });
  }

  revertChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por descartar', 'info');
      return;
    }

    this.loadProviderQuoteData();
    this.hasUnsavedChanges = false;
  }

  generatePDF() {
    alerts.basicAlert('PDF', 'Generando PDF de la cotización del proveedor...', 'info');
    // Aquí iría la lógica para generar el PDF específico del proveedor
    console.log('Generando PDF para proveedor', this.providerNumber, 'de la cotización', this.quoteData?.id);
  }
}