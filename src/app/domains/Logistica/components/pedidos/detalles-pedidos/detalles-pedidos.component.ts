import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { CustomersService } from 'app/services/customers.service';
import { MaterialsService } from 'app/services/materials.service';
import { CatalogadmonService } from 'app/services/catalogadmon.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-detalles-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './detalles-pedidos.component.html',
  styleUrls: ['./detalles-pedidos.component.scss']
})
export class DetallesPedidosComponent implements OnInit {
  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private context: any;
  private customersService = inject(CustomersService);
  private materialsService = inject(MaterialsService);
  private catalogadmonService = inject(CatalogadmonService);

  rowData: any[] = [];
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  clientes: any[] = [];
  productos: any[] = [];
  plataformas: any[] = [];
  isLocked: boolean = false;

  showPlataformaModal: boolean = false;
  newPlataforma: any = {};

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  ngOnInit() {
    this.loadData();
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
    this.isLocked = params.data?.locked === true;
    this.loadClientes();
    this.loadProductos();
    this.loadPlataformas();
    this.loadData();
  }

  private loadClientes() {
    const idCompany = this.context?.idCompany;
    if (idCompany) {
      this.customersService.getCustomersByCompany(idCompany, 'CUSTOMERS').subscribe({
        next: (data: any) => {
          this.clientes = data?.data || data || [];
          if (this.gridApi) {
            this.gridApi.setGridOption('columnDefs', this.colDefs);
          }
        },
        error: (error) => {
          console.error('Error loading clientes:', error);
          this.clientes = [];
        }
      });
    }
  }

  private loadProductos() {
    const idCompany = this.context?.idCompany;
    if (idCompany) {
      this.materialsService.getMaterials2Fields(idCompany).subscribe({
        next: (data: any) => {
          this.productos = data?.data || data || [];
          if (this.gridApi) {
            this.gridApi.setGridOption('columnDefs', this.colDefs);
          }
        },
        error: (error) => {
          console.error('Error loading productos:', error);
          this.productos = [];
        }
      });
    }
  }

  private loadPlataformas() {
    const idRoot = this.context?.idCompany;
    if (idRoot) {
      this.catalogadmonService.getCatalogsByType(idRoot, 'PLATAFORMA').subscribe({
        next: (data: any) => {
          this.plataformas = data?.data || data || [];
          if (this.gridApi) {
            this.gridApi.setGridOption('columnDefs', this.colDefs);
          }
        },
        error: (error) => {
          console.error('Error loading plataformas:', error);
          this.plataformas = [];
        }
      });
    }
  }

  loadData() {
    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.load) {
      const pedidoId = this.params.data.id;
      this.context.CONCEPTS.load(pedidoId, (data: any[]) => {
        this.rowData = data.map(item => ({
          ...item,
          __isNew: false,
          __modified: false
        }));
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
        if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.updateCount) {
          this.context.CONCEPTS.updateCount(pedidoId, this.rowData.length);
        }
      });
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
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
        field: 'idCliente',
        headerName: 'Cliente',
        editable: () => !this.isLocked,
        width: 200,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: this.clientes.map(item => item.id),
          valueListMaxHeight: 220,
          formatValue: (value: any) => {
            const found = this.clientes.find(item => item.id === value);
            return found ? found.name : value;
          }
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const found = this.clientes.find(item => item.id === params.value);
          return found ? found.name : params.value;
        },
        valueSetter: (params: any) => {
          params.data.idCliente = params.newValue;
          return true;
        }
      },
      {
        field: 'idProducto',
        headerName: 'Producto',
        editable: () => !this.isLocked,
        width: 250,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: this.productos.map(item => item.id),
          valueListMaxHeight: 220,
          formatValue: (value: any) => {
            const found = this.productos.find(item => item.id === value);
            return found ? found.description : value;
          }
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const found = this.productos.find(item => item.id === params.value);
          return found ? found.description : params.value;
        },
        valueSetter: (params: any) => {
          params.data.idProducto = params.newValue;
          return true;
        }
      },

    {
        field: 'cantidad',
        headerName: 'Cantidad',
        editable: () => !this.isLocked,
        width: 90,
        type: 'numericColumn',
        valueSetter: (params: any) => {
          const val = parseInt(params.newValue);
          params.data.cantidad = isNaN(val) || val < 1 ? 1 : val;
          return true;
        }
      },

      {
        field: 'plataforma',
        headerName: 'Plataforma',
        editable: () => !this.isLocked,
        width: 180,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: [
            ...this.plataformas.map(p => p.description),
            '➕ Nueva Plataforma...'
          ]
        }),
        valueSetter: (params: any) => {
          if (params.newValue === '➕ Nueva Plataforma...') {
            this.openPlataformaModal(this.context?.idCompany);
            return false;
          }
          params.data.plataforma = params.newValue;
          return true;
        }
      },
      {
        field: 'aplicaimpuestos',
        headerName: 'Aplica Impuestos',
        editable: () => !this.isLocked,
        width: 130,
        cellRenderer: (params: ICellRendererParams) => {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = params.value === true || params.value === 1 || params.value === '1';
          checkbox.style.cursor = 'pointer';
          return checkbox;
        },
        valueSetter: (params: any) => {
          params.data.aplicaimpuestos = params.newValue;
          return true;
        }
      },
      {
        field: 'costo',
        headerName: 'Costo',
        editable: () => !this.isLocked,
        width: 100,
        type: 'numericColumn',
        valueFormatter: (params) => {
          if (params.value) {
            return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
          }
          return '$0.00';
        },
        valueSetter: (params: any) => {
          const val = parseFloat(params.newValue);
          params.data.costo = isNaN(val) ? 0 : val;
          return true;
        }
      },
      {
        field: 'venta',
        headerName: 'Venta',
        editable: () => !this.isLocked,
        width: 100,
        type: 'numericColumn',
        valueFormatter: (params) => {
          if (params.value) {
            return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
          }
          return '$0.00';
        },
        valueSetter: (params: any) => {
          const val = parseFloat(params.newValue);
          params.data.venta = isNaN(val) ? 0 : val;
          return true;
        }
      },
      {
        field: 'estado',
        headerName: 'Estado',
        editable: () => !this.isLocked,
        width: 120,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['SOLICITADO', 'EN PROCESO', 'ENVIADO', 'ENTREGADO', 'CANCELADO']
        },
        valueSetter: (params: any) => {
          params.data.estado = params.newValue;
          return true;
        },
        cellStyle: (params) => {
          if (params.value === 'ENTREGADO') return { backgroundColor: '#d4edda' };
          if (params.value === 'CANCELADO') return { backgroundColor: '#f8d7da' };
          if (params.value === 'ENVIADO') return { backgroundColor: '#cce5ff' };
          if (params.value === 'EN PROCESO') return { backgroundColor: '#fff3cd' };
          return { backgroundColor: '#e2e3e5' };
        }
      },
      {
        field: 'comentario',
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
          params.data.comentario = params.newValue ? params.newValue.toUpperCase() : '';
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
    domLayout: 'normal',
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: true,
    onCellValueChanged: (event: any) => {
      console.log('🔄 Cell changed:', event.colDef.field, event.newValue);
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
  };

  addItem() {
    if (this.isLocked) {
      alerts.basicAlert('Pedido bloqueado', 'No se pueden agregar items. Este pedido está en proceso.', 'warning');
      return;
    }

    const tempId = `temp_detalle_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idPedido: this.params.data.id,
      idCliente: 0,
      idProducto: 0,
      cantidad: 1,
      plataforma: '',
      aplicaimpuestos: false,
      comentario: '',
      active: true,
      __isNew: true,
      __modified: false
    };

    this.rowData = [...this.rowData, newItem];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);

    setTimeout(() => {
      const lastRowIndex = this.rowData.length - 1;
      this.gridApi.ensureIndexVisible(lastRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: lastRowIndex,
        colKey: 'idCliente'
      });
    }, 0);
  }

  deleteSelectedItem() {
    if (this.isLocked) {
      alerts.basicAlert('Pedido bloqueado', 'No se pueden eliminar items. Este pedido está en proceso.', 'warning');
      return;
    }

    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length === 0) {
      alerts.basicAlert('Selección requerida', 'Por favor seleccione un item para eliminar', 'warning');
      return;
    }

    const selectedItem = selectedRows[0];
    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.delete) {
      const newCount = this.rowData.length - 1;
      this.context.CONCEPTS.delete({ data: selectedItem, api: this.gridApi }, () => {
        this.rowData = this.rowData.filter(item => item.id !== selectedItem.id);
        this.gridApi.setGridOption('rowData', this.rowData);
        this.hasUnsavedChanges = true;
      }, newCount);
    }
  }

  async saveChanges() {
    if (this.isLocked) {
      alerts.basicAlert('Pedido bloqueado', 'No se pueden guardar cambios. Este pedido está en proceso.', 'warning');
      return;
    }

    if (!this.hasUnsavedChanges) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes por guardar', 'info');
      return;
    }

    const isValid = this.rowData.every(item => item.idCliente);
    if (!isValid) {
      alerts.basicAlert('Validación', 'Todos los detalles deben tener cliente', 'warning');
      return;
    }

    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.save) {
      const pedidoId = this.params.data.id;
      await this.context.CONCEPTS.save(pedidoId, { detalles: this.rowData });
      this.hasUnsavedChanges = false;
      
      setTimeout(() => {
        this.loadData();
      }, 500);
    }
    
    alerts.basicAlert('Guardado', 'Registro actualizado correctamente', 'success');
  }

  discardChanges() {
    if (this.isLocked) return;
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

  // ==================== MODAL NUEVA PLATAFORMA ====================

  openPlataformaModal(idCompany: number) {
    this.newPlataforma = {
      idCompany: idCompany,
      description: '',
      valueAddition: 'NA',
      valueAddition2: 'NA',
      type: 'PLATAFORMA',
      active: 1
    };
    this.showPlataformaModal = true;
    document.body.classList.add('modal-open');
  }

  closePlataformaModal() {
    this.showPlataformaModal = false;
    document.body.classList.remove('modal-open');
  }

  async saveNewPlataforma() {
    if (!this.newPlataforma.description) {
      alerts.basicAlert('Error', 'La descripción de la plataforma es obligatoria.', 'error');
      return;
    }

    try {
      const result: any = await lastValueFrom(
        this.catalogadmonService.addCatalogAdmon(this.newPlataforma)
      );

      alerts.basicAlert('Plataforma creada', 'La plataforma se ha creado correctamente.', 'success');

      this.onPlataformaCreated({
        id: result.id,
        description: this.newPlataforma.description
      });

      this.closePlataformaModal();
    } catch (error: any) {
      alerts.basicAlert('Error', `Error al crear la plataforma. ${error?.error?.message || error?.message || 'Error desconocido'}`, 'error');
    }
  }

  onPlataformaCreated(plataformaData: { id: number; description: string }) {
    this.plataformas = [...this.plataformas, { id: plataformaData.id, description: plataformaData.description }];
    this.gridApi.setGridOption('columnDefs', this.colDefs);
  }
}