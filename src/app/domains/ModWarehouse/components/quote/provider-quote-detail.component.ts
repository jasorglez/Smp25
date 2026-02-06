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
  cotizId: number = null;
  idProvider: number = null;
  providerName: string = '';

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

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
    this.cotizId = this.context?.providerQuoteData?.cotizId || null;
    this.idProvider = this.context?.providerQuoteData?.idProvider || null;
    this.productos = this.context?.productos || [];
    this.proveedores = this.context?.proveedores || [];
    this.idRoot = this.context?.idRoot || 0;

    // Get provider name
    if (this.idProvider) {
      const provider = this.proveedores.find((p: any) => p.id === this.idProvider);
      this.providerName = provider ? provider.name : `Proveedor ${this.idProvider}`;
    }

    console.log('Provider Quote Detail - Data:', {
      quoteData: this.quoteData,
      providerNumber: this.providerNumber,
      cotizId: this.cotizId,
      idProvider: this.idProvider,
      idRoot: this.idRoot
    });

    this.loadProviderQuoteData();
  }

  async loadProviderQuoteData() {
    // If we have a cotizId, load items from the COTIZ record
    if (this.cotizId) {
      try {
        const items: any[] = await lastValueFrom(
          this.ocAndReqsService.getReqItems(this.cotizId)
        );

        console.log('COTIZ items loaded:', items);

        this.rowData = items.map((item: any) => {
          const producto = this.productos.find((p: any) => p.id === (item.idSupplie || item.id_supplie));
          return {
            id: item.id,
            idMovement: item.idMovement || item.id_movement,
            idSupplie: item.idSupplie || item.id_supplie,
            idProvider: item.idProvider || item.id_provider,
            productName: producto ? producto.description : `Producto ${item.idSupplie || item.id_supplie}`,
            productCode: producto ? producto.code : (item.idSupplie || item.id_supplie),
            quantity: item.quantity || 0,
            price: item.price || 0,
            total: (item.quantity || 0) * (item.price || 0),
            comment: item.comment || '',
            dateuse: item.dateuse,
            providerNumber: this.providerNumber,
            __isNew: false,
            __modified: false
          };
        });

        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
      } catch (error) {
        console.error('Error loading COTIZ items:', error);
        alerts.basicAlert('Error', 'No se pudieron cargar los items de la cotización', 'error');
      }
      return;
    }

    // Fallback: load from REQUIS if no cotizId (shouldn't happen with new flow)
    if (!this.quoteData || !this.quoteData.idReq) {
      console.log('No hay requisición seleccionada');
      return;
    }

    try {
      const requisitionItems: any = await lastValueFrom(
        this.ocAndReqsService.getReqItems(this.quoteData.idReq)
      );

      console.log('Requisition items loaded (fallback):', requisitionItems);

      this.rowData = requisitionItems.map((item: any, index: number) => {
        const producto = this.productos.find((p: any) => p.id === (item.idSupplie || item.id_supplie));
        return {
          id: `provider_${this.providerNumber}_item_${index}`,
          idQuoteItem: null,
          idRequisitionItem: item.id,
          idSupplie: item.idSupplie || item.id_supplie,
          productName: producto ? producto.description : `Producto ${item.idSupplie || item.id_supplie}`,
          productCode: producto ? producto.code : (item.idSupplie || item.id_supplie),
          quantity: item.quantity || 0,
          price: 0,
          total: 0,
          comment: item.comment || '',
          dateuse: item.dateuse,
          providerNumber: this.providerNumber,
          __isNew: true,
          __modified: false
        };
      });

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
          return this.providerName || `PROVEEDOR ${this.providerNumber}`;
        },
        width: 150,
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
          params.data.__modified = true;
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
          params.data.__modified = true;
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

  // Save changes to DB
  async saveChanges() {
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    if (!this.cotizId) {
      alerts.basicAlert('Error', 'No hay cotización asociada para guardar.', 'error');
      return;
    }

    try {
      const modifiedItems = this.rowData.filter(item => item.__modified && !item.__isNew);
      const newItems = this.rowData.filter(item => item.__isNew);

      // Update existing items
      for (const item of modifiedItems) {
        const updateData: any = {
          idMovement: this.cotizId,
          idSupplie: item.idSupplie,
          idProvider: this.idProvider,
          quantity: item.quantity,
          price: item.price,
          type: 'COTIZ',
          comment: item.comment || '',
          active: true
        };
        await lastValueFrom(this.ocAndReqsService.updateReqItem(item.id.toString(), updateData));
      }

      // Add new items
      for (const item of newItems) {
        const provider = this.proveedores.find((p: any) => p.id === this.idProvider);
        const addData: any = {
          idMovement: this.cotizId,
          idSupplie: item.idSupplie,
          idProvider: this.idProvider,
          nameProvider: provider ? provider.name : '',
          quantity: item.quantity,
          price: item.price,
          type: 'COTIZ',
          comment: item.comment || '',
          dateuse: item.dateuse,
          active: true
        };
        await lastValueFrom(this.ocAndReqsService.addReqItem(addData));
      }

      alerts.basicAlert('Éxito', 'Cotización de proveedor guardada correctamente', 'success');
      this.hasUnsavedChanges = false;

      // Reload data from DB
      await this.loadProviderQuoteData();

    } catch (error) {
      console.error('Error saving COTIZ items:', error);
      alerts.basicAlert('Error', 'No se pudieron guardar los cambios.', 'error');
    }
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
    ).then(async (result) => {
      if (result.isConfirmed) {
        // If it has a real DB id, delete from server
        if (selectedItem.id && typeof selectedItem.id === 'number') {
          try {
            await lastValueFrom(this.ocAndReqsService.deleteReqItem(selectedItem.id));
          } catch (error) {
            console.error('Error deleting item from DB:', error);
          }
        }

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
    console.log('Generando PDF para proveedor', this.providerNumber, 'COTIZ ID:', this.cotizId);
  }
}
