import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { NgSelectModule } from '@ng-select/ng-select';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';

import { PosService } from 'app/services/pos.service';
import { SignalsService } from 'app/services/signals.service';
import { MaterialsService } from 'app/services/materials.service';
import { SearchableSelectComponent } from 'app/shared/searchable-select/searchable-select.component';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, SearchableSelectComponent, NgSelectModule],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.scss'
})
export class PosComponent {
  // Inyección de servicios
  private posService = inject(PosService);
  private signalsService = inject(SignalsService);
  private materialsService = inject(MaterialsService);

  // Componentes disponibles para el grid
  components = {
    searchableSelectComponent: SearchableSelectComponent,
  };

  // Variables de identificación
  idClient: number = null;
  idBranch: number = null;
  idCompany: number = null;
  notSavedChanges: boolean = false;
  idVenta: number = null;
  lector: boolean = false;
  credit: boolean = false;

  // Arrays para almacenar datos
  clients: any[] = [];          // Lista de clientes
  rowData: any[] = [];         // Datos de la tabla
  productos: any[] = [];       // Lista de productos
  newlyAddedRows: string[] = []; // IDs de filas recién añadidas

  // Variables de control del grid
  selectedRowData: any = null;  // Fila seleccionada actualmente
  tempIdCounter: number = 0;    // Contador para IDs temporales
  private gridApi: GridApi;     // API del grid

  // Configuración del grid
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  constructor() {
    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      if (this.idBranch == null) {
        alerts.basicAlert('Error', 'Seleccione una sucursal para continuar.', 'error');
      }
      this.getCustomers();
    });

    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.getProducts();
    });
  }

  ngOnInit() {
    this.getCustomers();
    this.getProducts();
  }

  // Método para obtener clientes de la sucursal seleccionada
  getCustomers() {
    this.posService.getClients(this.idBranch).subscribe(
      (data: any) => {
        this.clients = data;
      },
      (error) => console.error('Error fetching clients:', error)
    );
  }

  // Método para obtener productos de la compañía
  getProducts() {
    this.materialsService.getMaterials2Fields(this.idCompany).subscribe(
      (data: any) => {
        this.productos = data;
      },
      (error) => console.error('Error fetching materials:', error)
    );
  }

  addRow() {
    if (this.idClient == null) {
      alerts.basicAlert('Error', 'No se puede agregar una fila sin seleccionar un cliente.', 'error');
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idSale: null,
      idProduct: null,
      quantity: null,
      pu: null,
      total: null,
      unit: true,
      boxNumber: null,
      unitNumber: null,
      active: true
    }

    this.rowData = [...this.rowData, newItem];
    this.newlyAddedRows.push(tempId);
    this.gridApi.setGridOption('rowData', this.rowData);

    requestAnimationFrame(() => {
      const rowNode = this.gridApi.getRowNode(tempId);
      if (rowNode) {
        rowNode.setSelected(true);
        this.selectedRowData = newItem;
      }
    });
  }

  deleteRow() {
    if (!this.selectedRowData) {
      alerts.basicAlert('Error', 'Por favor, seleccione una fila para eliminar.', 'error');
      return;
    }

    this.rowData = this.rowData.filter(row => row.id !== this.selectedRowData.id);
    this.gridApi.setGridOption('rowData', this.rowData);
    this.selectedRowData = null;
    this.notSavedChanges = true;
  }

  printReceipt() {
    const data = {
      idCustomer: this.idClient,
      date: new Date().toISOString(),
      lector: this.lector,
      credit: this.credit,
      amount: this.totalGeneral,
      active: true
    }
    console.log(data)
    alerts.basicAlert('Info','Aún no se implementa la impresión de recibos.','warning');
/*     this.posService.addSaleXCustomerItem(data).subscribe(
      {
        next: (response) => {
          const saleId = response.id;
          console.log('ID de venta:', saleId);
        },
        error: (error) => {
          console.error('Error al crear la venta', error);
        }
      }
    ) */
  }

  onClientChange(event: any) {
    this.idClient = event.id;
  }

  onSelectionChanged() {
    const selectedRows = this.gridApi.getSelectedRows();
    this.selectedRowData = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.addEventListener('selectionChanged', () => this.onSelectionChanged());
  }

  // Definición de columnas para el grid
  get colMaster(): ColDef[] {
    return [
      // ID oculto
      {
        field: 'id',
        headerName: 'id',
        hide: true
      },
      {
        field: 'idSale',
        headerName: 'idCustomer',
        hide: true
      },
      {
        field: 'idProduct',
        headerName: 'Producto',
        flex: 3,
        editable: true,
        cellEditor: 'searchableSelectComponent',
        cellEditorParams: {
          options: this.productos,
        },
        valueFormatter: (params) => {
          const foundItem = this.productos
            ? this.productos.find((item) => item.id === params.value)
            : null;
          return foundItem ? `${foundItem.description}` : params.value;
        },
      },
      {
        field: 'quantity',
        headerName: 'Cantidad',
        flex: 1,
        editable: true,
        type: 'numericColumn',
        valueParser: (params) => Number(params.newValue)
      },
      {
        field: 'pu',
        headerName: 'Precio Unitario',
        flex: 1,
        editable: true,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
          }).format(params.value || 0);
        }
      },
      {
        field: 'total',
        headerName: 'Total',
        flex: 1,
        editable: false,
        valueGetter: (params) => {
          const quantity = Number(params.data.quantity) || 0;
          const pu = Number(params.data.pu) || 0;
          return quantity * pu;
        },
        valueFormatter: (params) => {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
          }).format(params.value || 0);
        }
      },
      {
        field: 'unit',
        headerName: '¿Menudeo?',
        flex: 1,
        editable: true,
        cellDataType: 'boolean'
      },
      {
        field: 'boxNumber',
        headerName: 'Caja',
        flex: 1,
        editable: true
      },
      {
        field: 'unitNumber',
        headerName: 'Número de Unidad',
        flex: 1,
        editable: true
      }
    ];
  }

  // Propiedad computada para obtener el total
  get totalGeneral(): number {
    return this.rowData.reduce((sum, row) => {
      const quantity = Number(row.quantity) || 0;
      const pu = Number(row.pu) || 0;
      return sum + (quantity * pu);
    }, 0);
  }

  // Método para formatear el total en moneda
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value);
  }
}
