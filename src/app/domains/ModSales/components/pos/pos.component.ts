import { CommonModule } from '@angular/common';
import { Component, DestroyRef, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { NgSelectModule } from '@ng-select/ng-select';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { PosService } from 'app/services/pos.service';
import { SignalsService } from 'app/services/signals.service';
import { MaterialsService } from 'app/services/materials.service';
import { SearchableSelectComponent } from 'app/shared/searchable-select/searchable-select.component';
import { alerts } from 'app/helpers/alerts';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  Observable,
  of,
  Subject,
  switchMap,
} from 'rxjs';
import { CustomersService } from 'app/services/customers.service';
import { CustomersComponent } from 'app/domains/ModAdmon/components/customers/customers.component';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    SearchableSelectComponent,
    NgSelectModule,
    CustomersComponent,
  ],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.scss',
})
export class PosComponent {
  // Inyección de servicios
  private posService = inject(PosService);
  private signalsService = inject(SignalsService);
  private materialsService = inject(MaterialsService);
  private customerService = inject(CustomersService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  /** Sub-apartado desde ?view= en la ruta `pos` (documentos | clientes | ticket | nueva). */
  posView: 'nueva' | 'documentos' | 'clientes' | 'ticket' = 'nueva';

  // products
  productInput$ = new Subject<string>();
  products$: Observable<any[]>;
  selectedProduct: any;

  // Componentes disponibles para el grid
  components = {
    searchableSelectComponent: SearchableSelectComponent,
  };

  // Variables de identificación
  idCustomer: number = null;
  idBranch: number = null;
  idCompany: number = null;
  idVenta: number = null;
  lector: boolean = false;
  credit: boolean = false;

  // Arrays para almacenar datos
  clients: any[] = []; // Lista de clientes
  rowData: any[] = []; // Datos de la tabla
  productos: any[] = []; // Lista de productos
  newlyAddedRows: string[] = []; // IDs de filas recién añadidas

  // Variables de control del grid
  selectedRowData: any = null; // Fila seleccionada actualmente
  tempIdCounter: number = 0; // Contador para IDs temporales
  private gridApi: GridApi; // API del grid

  // Configuración del grid
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'never';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'never';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  // Agregar variable para almacenar el total
  private _totalGeneral: number = 0;

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => {
        const raw = (q.get('view') ?? 'nueva').toLowerCase();
        const allowed = new Set(['nueva', 'documentos', 'clientes', 'ticket']);
        this.posView = (allowed.has(raw) ? raw : 'nueva') as typeof this.posView;
      });

    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.idCustomer = this.signalsService.getIdCustomerFromPOS()();
      this.getCustomers();
    });

    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.getProducts();
    });

    // Actualizar la lógica de products$ para manejar entradas vacías
    this.products$ = this.productInput$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap((term) => {
        console.log('Buscando materiales con término:', term);
        return this.materialsService
          .getMaterialsByNameOrBarcode(this.idCompany, term)
          .pipe(
            catchError((error) => {
              console.error('Error fetching materials:', error);
              // Return an empty array instead of throwing an error
              return of([]);
            })
          );
      })
    );
  }

  ngOnInit() {
    this.getCustomers();
    this.getProducts();
  }

  get posSectionTitle(): string {
    switch (this.posView) {
      case 'documentos':
        return 'Documentos';
      case 'clientes':
        return 'Clientes';
      case 'ticket':
        return 'Imprimir ticket';
      default:
        return 'Punto de venta';
    }
  }

  get posSectionSubtitle(): string {
    switch (this.posView) {
      case 'documentos':
        return 'Consulta documentos y movimientos ligados a la venta actual.';
      case 'clientes':
        return 'Mismo catálogo que Administración: alta, edición y facturación electrónica.';
      case 'ticket':
        return 'Revisa el total y genera el ticket cuando esté listo.';
      default:
        return 'Selecciona un cliente, agrega productos y genera el ticket.';
    }
  }

  get showProductSearch(): boolean {
    return this.posView !== 'clientes';
  }

  get leftCardTitle(): string {
    return this.showProductSearch ? 'Cliente y producto' : 'Cliente';
  }

  onProductSelect(product: any) {
    //this.selectedProduct = product;
    if (!product) return;

    if (this.idCustomer == null) {
      alerts.basicAlert(
        'Error',
        'Seleccione un cliente antes de agregar un producto.',
        'error'
      );
      return;
    }

    // Find existing row with the same product
    const existingRowIndex = this.rowData.findIndex(
      (row) => row.idProduct === product.id
    );

    if (existingRowIndex !== -1) {
      // Increment quantity of existing row
      const updatedRowData = [...this.rowData];
      updatedRowData[existingRowIndex] = {
        ...updatedRowData[existingRowIndex],
        quantity: (updatedRowData[existingRowIndex].quantity || 0) + 1,
        total:
          product.price *
          ((updatedRowData[existingRowIndex].quantity || 0) + 1),
      };

      this.rowData = updatedRowData;
      this.gridApi.setGridOption('rowData', this.rowData);
    } else {
      // Add new row if product not found
      const tempId = `temp_${this.tempIdCounter++}`;
      const newItem = {
        id: tempId,
        idSale: null,
        idProduct: product.id,
        quantity: 1,
        pu: product.price || 0,
        total: product.price || 0,
        unit: true,
        boxNumber: 0,
        unitNumber: 0,
        active: true,
      };

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

    // Recalculate total
    this.calculateTotal();
  }

  // Método para obtener clientes de la sucursal seleccionada
  getCustomers() {
    this.customerService.getCustomers(this.idBranch, 'CUSTOMERS').subscribe(
      (data: any) => {
        this.clients = data;
        // Seleccionar el primer cliente si idCustomer es null
        if (this.idCustomer === null && this.clients.length > 0) {
          this.idCustomer = this.clients[0].id; // Seleccionar el primer cliente
          this.signalsService.setIdCustomerFromPOS(this.idCustomer); // Enviar a la signal
        }
        console.log(data);
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
    if (this.idCustomer == null) {
      alerts.basicAlert(
        'Error',
        'No se puede agregar una fila sin seleccionar un cliente.',
        'error'
      );
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
      boxNumber: 0,
      unitNumber: 0,
      active: true,
    };

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
      alerts.basicAlert(
        'Error',
        'Por favor, seleccione una fila para eliminar.',
        'error'
      );
      return;
    }

    this.rowData = this.rowData.filter(
      (row) => row.id !== this.selectedRowData.id
    );
    this.gridApi.setGridOption('rowData', this.rowData);
    this.selectedRowData = null;
  }

  printReceipt() {
    // Consumir el servicio getPosSetup
    this.posService.getPosSetup(this.idBranch, this.idCustomer).subscribe({
      next: (setupResponse) => {
        console.log(this.idBranch, this.idCustomer);
        console.log(setupResponse);
        if (setupResponse.length === 0) {
          alerts.basicAlert(
            'Error',
            'No se encontraron datos de configuración para el POS.',
            'error'
          );
          return;
        }

        const { prefix, consecutive } = setupResponse[0]; // Asumiendo que el primer elemento tiene los valores
        const newConsecutive = consecutive + 1; // Aumentar consecutive
        const numberNote = `${prefix}-${newConsecutive}`; // Concatenar prefix y consecutive

        const data = {
          idCustomer: this.idCustomer,
          numberNote: numberNote, // Usar el nuevo numberNote
          date: new Date().toISOString(),
          lector: this.lector,
          credit: this.credit,
          amount: this.totalGeneral,
          active: true,
        };

        this.posService.addSaleXCustomerItem(data).subscribe({
          next: (response) => {
            const saleId = response.id;
            console.log('ID de venta:', saleId);

            // Actualizar el idSale en todas las filas y eliminar el id temporal
            this.rowData = this.rowData.map((row) => {
              const { id, ...rowWithoutId } = row;
              return {
                ...rowWithoutId,
                idSale: saleId,
              };
            });

            // Crear un array de promesas para enviar cada fila
            const savePromises = this.rowData.map((row) =>
              this.posService.addSaleXConceptItem(row).toPromise()
            );

            // Esperar a que todas las filas se guarden
            Promise.all(savePromises)
              .then(() => {
                // Mostrar mensaje de éxito
                alerts.basicAlert(
                  'Éxito',
                  'La compra se ha realizado correctamente. El ID de nota es el ' +
                    numberNote +
                    '.',
                  'success'
                );

                // Actualizar el consecutive en el setupResponse
                const updatedSetup = {
                  ...setupResponse[0],
                  consecutive: newConsecutive,
                };
                this.posService
                  .updatePosSetup(this.idBranch, this.idCustomer, updatedSetup)
                  .subscribe({
                    next: () => {
                      console.log('Consecutive actualizado correctamente.');
                    },
                    error: (error) => {
                      console.error(
                        'Error al actualizar el consecutive:',
                        error
                      );
                      alerts.basicAlert(
                        'Error',
                        'Hubo un error al actualizar el consecutive.',
                        'error'
                      );
                    },
                  });

                // Limpiar el grid
                this.rowData = [];
                this.gridApi.setGridOption('rowData', this.rowData);
                this._totalGeneral = 0;
              })
              .catch((error) => {
                console.error('Error al guardar los conceptos:', error);
                alerts.basicAlert(
                  'Error',
                  'Hubo un error al guardar los conceptos.',
                  'error'
                );
              });
          },
          error: (error) => {
            console.error('Error al crear la venta', error);
            alerts.basicAlert(
              'Error',
              'Hubo un error al crear la venta.',
              'error'
            );
          },
        });
      },
      error: (error) => {
        console.error('Error al obtener la configuración del POS', error);
        alerts.basicAlert(
          'Error',
          'Hubo un error al obtener la configuración del POS.',
          'error'
        );
      },
    });
  }

  onClientChange(event: any) {
    this.idCustomer = event.id;
    this.signalsService.setIdCustomerFromPOS(this.idCustomer);
  }

  onSelectionChanged() {
    const selectedRows = this.gridApi.getSelectedRows();
    this.selectedRowData = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.addEventListener('selectionChanged', () =>
      this.onSelectionChanged()
    );
    // Agregar el evento para actualizar el total cuando cambie una celda
    this.gridApi.addEventListener('cellValueChanged', () =>
      this.calculateTotal()
    );
  }

  // Método para calcular el total
  private calculateTotal() {
    this._totalGeneral = this.rowData.reduce((sum, row) => {
      const quantity = Number(row.quantity) || 0;
      const pu = Number(row.pu) || 0;
      return sum + quantity * pu;
    }, 0);
  }

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    getRowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      // Deseleccionar otras filas cuando se selecciona una nueva
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  get colMaster(): ColDef[] {
    return [
      // ID oculto
      {
        field: 'id',
        headerName: 'id',
        hide: true,
      },
      {
        field: 'idSale',
        headerName: 'idSale',
        hide: true,
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
        valueParser: (params) => Number(params.newValue),
      },
      {
        field: 'pu',
        headerName: 'Precio Unitario',
        flex: 1,
        editable: true,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(params.value || 0);
        },
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
            currency: 'MXN',
          }).format(params.value || 0);
        },
      },
      {
        field: 'unit',
        headerName: '¿Menudeo?',
        flex: 1,
        editable: true,
        cellDataType: 'boolean',
      },
      {
        field: 'boxNumber',
        headerName: 'Caja',
        flex: 1,
        editable: true,
      },
      {
        field: 'unitNumber',
        headerName: 'Número de Unidad',
        flex: 1,
        editable: true,
      },
    ];
  }

  // Modificar el getter para usar el valor almacenado
  get totalGeneral(): number {
    return this._totalGeneral;
  }

  // Método para formatear el total en moneda
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value);
  }

  onSearchChange(event: any) {
    const searchTerm = event.target.value.trim(); // Extraer el valor y eliminar espacios en blanco

    // Emitir cadena vacía si no hay término de búsqueda
    if (searchTerm === '') {
      this.productInput$.next('');
    } else {
      this.productInput$.next(searchTerm);
    }
  }
}
