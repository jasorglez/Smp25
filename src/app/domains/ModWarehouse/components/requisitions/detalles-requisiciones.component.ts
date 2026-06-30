import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-detalles-requisiciones',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './detalles-requisiciones.component.html',
  styleUrl: './detalles-requisiciones.component.scss'
})
export class DetallesRequisicionesComponent implements OnInit {
  private trackingService = inject(TrackingService);

  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private context: any;

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  productos: any[] = [];
  isLocked: boolean = false; // True when requisition is assigned to a QUOTE

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    // Load initial data
    this.loadData();
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.productos = this.context?.productos || [];
    // Check if requisition is locked (assigned to a QUOTE for cotización)
    this.isLocked = params.data?.locked === true;
    this.loadData();
  }

  loadData() {
    if (this.context && this.context.ITEMS && this.context.ITEMS.load) {
      const requisitionId = this.params.data.id;
      this.context.ITEMS.load(requisitionId, (data: any[]) => {
        this.rowData = data.map(item => ({
          ...item,
          __isNew: false,
          __modified: false
        }));
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
        // El campo pedimento se maneja desde el backend, no se actualiza desde aquí
      });
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    // Ensure columnDefs are updated with loaded products
    this.gridApi.setGridOption('columnDefs', this.colDefs);
  }

  get colDefs(): ColDef[] {
    return [
      {
        headerName: '#',
        width: 50,
        valueGetter: (params) => params.node!.rowIndex! + 1,
        pinned: 'left',
        cellStyle: { backgroundColor: '#f8f9fa', fontWeight: 'bold' }
      },
      {
        field: 'idSupplie',
        headerName: 'Producto',
        editable: () => !this.isLocked,
        width: 300,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: this.productos.map((item) => item.id),
          valueListMaxHeight: 220,
          formatValue: (value: any) => {
            const foundItem = this.productos.find((item) => item.id === value);
            return foundItem ? foundItem.description : value;
          }
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const foundItem = this.productos.find((item) => item.id === params.value);
          return foundItem ? foundItem.description : params.value;
        },
        valueSetter: (params: any) => {
          // Validar si el material ya existe
          const existingItem = this.findExistingMaterial(params.newValue);
          if (existingItem && existingItem.id !== params.data.id) {
            // Material duplicado encontrado
            this.showDuplicateMaterialAlert(existingItem, params);
            return false; // No cambiar el valor hasta confirmación
          }
          params.data.idSupplie = params.newValue;
          return true;
        }
      },
      {
        field: 'quantity',
        headerName: 'Cantidad',
        editable: () => !this.isLocked,
        width: 100,
        type: 'numericColumn',
        valueSetter: (params: any) => {
          params.data.quantity = params.newValue;
          return true;
        }
      },
      {
        field: 'dateuse',
        headerName: 'Fecha de uso',
        editable: () => !this.isLocked,
        width: 150,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        },
        valueSetter: (params: any) => {
          params.data.dateuse = params.newValue;
          return true;
        }
      },
      {
        field: 'comment',
        headerName: 'Comentario',
        editable: () => !this.isLocked,
        width: 250,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorParams: {
          maxLength: 500,
          rows: 3,
          cols: 50
        },
        valueSetter: (params: any) => {
          params.data.comment = params.newValue ? params.newValue.toUpperCase() : '';
          return true;
        }
      }
    ];
  }

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 28,
    animateRows: true,
    rowSelection: 'single',
    domLayout: 'normal', // Cambiar a normal para permitir expansión manual
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: true,
    onCellValueChanged: (event: any) => {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
  };

  addItem() {
    if (this.isLocked) {
      alerts.basicAlert('Requisicion bloqueada', 'No se pueden agregar items. Esta requisicion esta en proceso de cotizacion.', 'warning');
      return;
    }
    const tempId = `temp_item_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idMovement: this.params.data.id,
      idSupplie: 0,
      quantity: 0,
      price: 0,
      total: 0,
      type: 'REQUIS',
      comment: 'NINGUNO.',
      dateuse: new Date().toISOString(),
      active: true,
      __isNew: true,
      __modified: false
    };

    this.rowData = [...this.rowData, newItem];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

        // El contador se gestiona desde el backend al guardar los cambios

    setTimeout(() => {
      const lastRowIndex = this.rowData.length - 1;
      this.gridApi.ensureIndexVisible(lastRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: lastRowIndex,
        colKey: 'idSupplie'
      });
    }, 0);
  }

  deleteSelectedItem() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó detalles requisiciones', 'Almacenes', this.trackingService.getEmail());
    if (this.isLocked) {
      alerts.basicAlert('Requisicion bloqueada', 'No se pueden eliminar items. Esta requisicion esta en proceso de cotizacion.', 'warning');
      return;
    }
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


      });
    }
  }

  async saveChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en detalles requisiciones', 'Almacenes', this.trackingService.getEmail());
    if (this.isLocked) {
      alerts.basicAlert('Requisicion bloqueada', 'No se pueden guardar cambios. Esta requisicion esta en proceso de cotizacion.', 'warning');
      return;
    }
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    // Validar que todos los items tengan producto y fecha
    const isValid = this.rowData.every(item => item.idSupplie && item.dateuse);
    if (!isValid) {
      alerts.basicAlert('Validación', 'Todos los items deben tener producto y fecha de uso', 'warning');
      return;
    }

    if (this.context && this.context.ITEMS && this.context.ITEMS.save) {
      const requisitionId = this.params.data.id;
      
      // Guardar y esperar a que termine
      await this.context.ITEMS.save(requisitionId, this.rowData);
      this.hasUnsavedChanges = false;
      
      // Recargar los datos del servidor para tener los IDs actualizados y el contador actualizado
      setTimeout(() => {
        this.loadData();
      }, 500); // Pequeño delay para asegurar que el servidor procesó
    }
  }

  discardChanges() {
    if (this.isLocked) {
      return; // Nothing to discard when locked
    }
    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por descartar', 'info');
      return;
    }

    this.loadData();
    this.hasUnsavedChanges = false;
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasUnsavedChanges = true;
  }

  refreshByParent() {
    this.loadData();
  }

  private findExistingMaterial(materialId: number): any {
    return this.rowData.find(item => 
      item.idSupplie === materialId && 
      item.id !== this.params.data?.id
    );
  }

  private showDuplicateMaterialAlert(existingItem: any, params: any): void {
    const existingProduct = this.productos.find(p => p.id === existingItem.idSupplie);
    const productName = existingProduct ? existingProduct.description : 'Material desconocido';
    
    alerts.confirmAlert(
      'Material Duplicado',
      `El material "${productName}" ya existe con cantidad ${existingItem.quantity}.\n\n¿Desea sumar las cantidades?`,
      'warning',
      'Sí, sumar cantidades'
    ).then((result) => {
      if (result.isConfirmed) {
        // Usuario confirma - solicitar cantidad a sumar
        this.promptForQuantity(existingItem, params);
      } else {
        // Usuario cancela - mantener selección pero no sumar
        params.data.idSupplie = params.newValue;
        if (this.gridApi) {
          this.gridApi.refreshCells({ 
            rowNodes: [this.gridApi.getRowNode(params.data.id)], 
            columns: ['idSupplie'],
            force: true 
          });
        }
      }
    });
  }

  private promptForQuantity(existingItem: any, params: any): void {
    alerts.inputAlert(
      'Sumar Cantidades',
      `Material actual: ${existingItem.quantity}\nCantidad a agregar:`,
      'text',
      '',
      {
        confirmButtonText: 'Sumar',
        required: true
      }
    ).then((result) => {
      if (result.isConfirmed && result.value) {
        const newQuantity = parseFloat(result.value);
        if (!isNaN(newQuantity) && newQuantity > 0) {
          // Sumar cantidades
          existingItem.quantity += newQuantity;
          existingItem.__modified = true;
          this.hasUnsavedChanges = true;
          
          // Eliminar la fila actual
          const updatedRowData = this.rowData.filter(item => item.id !== params.data.id);
          this.rowData = updatedRowData;
          
          // Actualizar grid
          this.gridApi.setGridOption('rowData', this.rowData);
          
          // El contador se actualiza desde el backend
          
          alerts.basicAlert(
            'Cantidades Sumadas',
            `Se sumaron ${newQuantity} unidades al material existente. Total: ${existingItem.quantity}`,
            'success'
          );
        } else {
          alerts.basicAlert(
            'Error',
            'La cantidad debe ser un número mayor a cero.',
            'error'
          );
        }
      }
    });
  }
}
