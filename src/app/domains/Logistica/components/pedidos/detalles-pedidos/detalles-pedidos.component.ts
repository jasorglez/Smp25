import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { alerts } from 'app/helpers/alerts';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CustomersService } from 'app/services/customers.service';
import { MaterialsService } from 'app/services/materials.service';
import { CatalogadmonService } from 'app/services/catalogadmon.service';
import { AdministrationService } from 'app/services/administration.service';
import { PedidosService } from 'app/services/pedidos.service';
import { RemisionesService } from 'app/services/remisiones.service';
import { lastValueFrom } from 'rxjs';
import { ProductoAutocompleteEditorComponent } from './producto-autocomplete-editor.component';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import Swal from 'sweetalert2';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-detalles-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ProductoAutocompleteEditorComponent],
  templateUrl: './detalles-pedidos.component.html',
  styleUrls: ['./detalles-pedidos.component.scss']
})
export class DetallesPedidosComponent implements OnInit, OnDestroy {
  private params!: ICellRendererParams;
  private gridApi!: GridApi;
  private context: any;
  private customersService = inject(CustomersService);
  private materialsService = inject(MaterialsService);
  private catalogadmonService = inject(CatalogadmonService);
  private administrationService = inject(AdministrationService);
  private pedidosService = inject(PedidosService);
  private remisionesService = inject(RemisionesService);
  private sanitizer = inject(DomSanitizer);

  rowData: any[] = [];
  selectedRow: any = null;
  hasUnsavedChanges: boolean = false;
  tempIdCounter: number = 0;
  clientes: any[] = [];
  productos: any[] = [];
  plataformas: any[] = [];
  productoSuggestions: string[] = [];
  isLocked: boolean = false;

  // PDF view
  detailType: string = 'pedidos';
  pdfUrl: SafeResourceUrl | null = null;
  private originalPdfUrl: string | null = null;

  showPlataformaModal: boolean = false;
  newPlataforma: any = {};

  // Modal Banco
  showBancoModal: boolean = false;
  selectedBanco: string = '';
  totalBanco: number | null = null;
  bancos: any[] = [];
  hasBancoInfo: boolean = false;
  bancoModalTitle: string = 'Agregar pago al banco';

  private keyboardShortcuts?: (ev: KeyboardEvent) => void;

  /** Enter visto en captura (popup Rich Select no dispara cellKeyDown del grid) */
  private sawEnterDuringEdit = false;
  private enterCapture?: (ev: KeyboardEvent) => void;
  /** Bloquea la navegación Enter mientras el Swal de recepción parcial está abierto */
  private handlingPartialReceipt = false;

  /** Un frame: abrir Producto tras Enter en Cliente; el editor ignora el Enter “fantasma” en el input */
  skipFirstEnterOnProductoEditor = false;

  /** Secuencia de navegación con Enter entre columnas editables */
  private readonly NEXT_EDIT_COL: Record<string, string> = {
    'clienteName': 'producto',
    'producto':    'cantidad',
    'cantidad':    'venta',
    'plataforma':  'venta',
    'venta':       'impuesto',
    'impuesto':    'estado',
    'estado':      'comentario'
  };
  private readonly BLOCKED_MANUAL_STATES = ['REMISION', 'ENTREGADO'];
  private readonly MANUAL_ESTADOS = ['RECIBIDO', 'CANCELADO', 'ALMACENADO', 'REVENDIDO', 'SOLICITADO'];

  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  private getDefaultImpuestoRate(): number {
    const rate = Number(this.context?.componentParent?.defaultImpuesto ?? 16);
    return Number.isFinite(rate) && rate > 0 ? rate : 0;
  }

  private isAplicaImpuestos(value: any): boolean {
    return value === true || value === 1 || value === '1' || (typeof value === 'string' && value.toLowerCase() === 'true');
  }

  private getImpuestoAmountFromRow(row: any): number {
    if (!this.isAplicaImpuestos(row?.aplicaImpuestos)) return 0;
    const cantidad = Number(row?.cantidad) || 0;
    const venta = Number(row?.venta) || 0;
    const subtotal = cantidad * venta;
    const rate = this.getDefaultImpuestoRate();
    return Number(((subtotal * rate) / 100).toFixed(2));
  }

  private recalcImpuestoInRow(row: any): void {
    if (!row) return;
    row.impuesto = this.getImpuestoAmountFromRow(row);
  }

  ngOnInit() {
    this.loadData();
    this.loadBancos();
  }

  ngOnDestroy() {
    if (this.keyboardShortcuts) {
      window.removeEventListener('keydown', this.keyboardShortcuts);
    }
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;

    this.keyboardShortcuts = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (ev.key === 'Insert') {
        ev.preventDefault();
        this.addItem();
      } else if (ev.key === 'F10') {
        ev.preventDefault();
        this.saveChanges();
      }
    };
    window.addEventListener('keydown', this.keyboardShortcuts);
    this.isLocked = params.data?.locked === true;
    this.detailType = params.data?.detailType || 'pedidos';

    // Detectar si ya tiene banco e información
    this.hasBancoInfo = !!(params.data?.banco || params.data?.totalPagarBanco);
    this.bancoModalTitle = this.hasBancoInfo ? 'Editar pago al banco' : 'Agregar pago al banco';

    if (this.detailType === 'pdf') {
      this.generateReport();
    } else {
      this.loadClientes();
      this.loadProductos();
      this.loadPlataformas();
      this.loadBancos();
      this.loadData();
      this.loadProductoSuggestions();
    }
  }

  private async generateReport(): Promise<void> {
    const componentParent = this.context?.componentParent;
    if (typeof componentParent?.generatePedidoPDF !== 'function') {
      console.error('generatePedidoPDF is not available in detail renderer context.');
      return;
    }

    await componentParent.generatePedidoPDF(this.params?.node);
  }

  private loadProductoSuggestions(): void {
    const idCompany = this.context?.idCompany;
    if (!idCompany || !this.context?.pedidosService) return;
    this.context.pedidosService.getDetallesByCompany(idCompany).subscribe({
      next: (response: any) => {
        const detalles: any[] = response?.data || response || [];
        const unique = [...new Set(
          detalles
            .map((d: any) => d.producto)
            .filter((p: any) => p && p.trim() !== '')
        )] as string[];
        this.productoSuggestions = unique.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      },
      error: () => { this.productoSuggestions = []; }
    });
  }

  private resolveClienteName(idCliente: number): string {
    const found = this.clientes.find((c: any) => c.id == idCliente);
    return found?.nameContact || found?.company || '';
  }

  private loadClientes() {
    const idBranch = this.context?.componentParent?.idBranch || this.context?.idBranch;
    const idCompany = this.context?.idCompany;
    const request$ = idBranch
      ? this.customersService.getCustomers(idBranch, 'CUSTOMERS')
      : this.customersService.getCustomersByCompany(idCompany, 'CUSTOMERS');
    if (idBranch || idCompany) {
      request$.subscribe({
        next: (data: any) => {
          this.clientes = data?.data || data || [];
          // Re-resolver nombres ahora que clientes está cargado
          if (this.rowData.length > 0) {
            this.rowData = this.rowData.map(item => ({
              ...item,
              clienteName: this.resolveClienteName(item.idCliente) || item.clienteName || ''
            }));
            if (this.gridApi) {
              this.gridApi.setGridOption('rowData', this.rowData);
            }
          }
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

  private loadBancos() {
    this.administrationService.getBanks().subscribe({
      next: (data: any) => {
        this.bancos = data?.Bankdata || data || [];
      },
      error: (error) => {
        console.error('Error loading bancos:', error);
        this.bancos = [];
      }
    });
  }

  loadData() {
    if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.load) {
      const pedidoId = this.params.data.id;
      this.context.CONCEPTS.load(pedidoId, (data: any[]) => {
        this.rowData = data
          .filter(item => item.active !== false && item.active !== 0)
          .map(item => ({
          ...item,
          clienteName: this.resolveClienteName(item.idCliente) || item.clienteName || '',
          __isNew: false,
          __modified: false
        }));
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
        this.notifyTotalVentaToParent();
        if (this.context && this.context.CONCEPTS && this.context.CONCEPTS.updateCount) {
          this.context.CONCEPTS.updateCount(pedidoId, this.rowData.length);
        }
      });
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('columnDefs', this.colDefs);
    this.gridApi.refreshCells({ columns: ['clienteName'], force: true });
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
        field: 'clienteName',
        headerName: 'Cliente',
        editable: () => !this.isLocked,
        width: 200,
        cellEditor: 'agRichSelectCellEditor',
           filter: 'agSetColumnFilter',
      filterParams: {
        defaultToNothingSelected: true,
      },
        cellEditorParams: () => ({
          values: this.clientes
            .map(item => item.Description || item.nameContact || item.company || item.name || item.description)
            .filter(Boolean),
          valueListMaxHeight: 220,
          formatValue: (value: any) => {
            return value || '';
          }
        }),
        valueFormatter: (params) => {
          return params.data?.clienteName || params.value || '';
        },
        valueSetter: (params: any) => {
          const found = this.clientes.find(item =>
            (item.Description || item.nameContact || item.company || item.name || item.description) === params.newValue
          );
          params.data.idCliente = found?.id ?? params.data.idCliente;
          params.data.clienteName = params.newValue;
          return true;
        }
      },
      {
        field: 'producto',
        headerName: 'Producto',
        editable: () => !this.isLocked,
           filter: 'agSetColumnFilter',
      filterParams: {
        defaultToNothingSelected: true,
      },
        width: 250,
        cellEditor: ProductoAutocompleteEditorComponent,
        cellEditorParams: () => ({
          suggestions: this.productoSuggestions,
          ignoreFirstEnterNavigation: this.skipFirstEnterOnProductoEditor
        }),
        valueSetter: (params: any) => {
          params.data.producto = params.newValue;
          return true;
        }
      },

      {
        field: 'cantidad',
        headerName: 'Cantidad',
        editable: () => !this.isLocked,
        width: 90,
        type: 'numericColumn',
        suppressKeyboardEvent: (params: any) => {
          if (params.event.key === 'Enter' && params.editing) {
            this.sawEnterDuringEdit = false;
            params.api.stopEditing();
            setTimeout(() => {
              params.api.setFocusedCell(params.node.rowIndex, 'venta');
              params.api.startEditingCell({
                rowIndex: params.node.rowIndex,
                colKey: 'venta'
              });
            }, 0);
            return true;
          }
          return false;
        },
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
        field: 'costo',
        headerName: 'Costo',
        editable: () => !this.isLocked,
        width: 100,
        hide: true,
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
        field: 'aplicaImpuestos',
        headerName: 'Aplica Impuestos',
        editable: false,
        width: 130,
        cellStyle: { cursor: this.isLocked ? 'not-allowed' : 'pointer', textAlign: 'center' },
        cellRenderer: (params: ICellRendererParams) => {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          const val = params.value;
          checkbox.checked = val === true || val === 1 || val === '1' || (typeof val === 'string' && val.toLowerCase() === 'true');
          checkbox.style.pointerEvents = 'none';
          checkbox.style.cursor = 'inherit';
          return checkbox;
        },
        onCellClicked: (params: any) => {
          if (this.isLocked) return;
          // Asegurar que cualquier celda en edición haya confirmado su valor antes de leer venta
          params.api.stopEditing();
          const currentVal = params.data.aplicaImpuestos;
          const isCurrentlyChecked = currentVal === true || currentVal === 1 || currentVal === '1' || (typeof currentVal === 'string' && currentVal.toLowerCase() === 'true');
          const checked = !isCurrentlyChecked;
          params.data.aplicaImpuestos = checked;
          if (checked) params.data.plataforma = 'TEMU';
          this.recalcImpuestoInRow(params.data);
          params.data.__modified = true;
          this.hasUnsavedChanges = true;
          params.api.refreshCells({
            rowNodes: [params.node],
            columns: ['aplicaImpuestos', 'plataforma', 'impuesto', 'total'],
            force: true
          });
        }
      },
      {
        field: 'impuesto',
        headerName: 'Impuesto %',
        editable: false,
        width: 100,
        valueGetter: (params) => {
          return this.isAplicaImpuestos(params.data?.aplicaImpuestos) ? this.getDefaultImpuestoRate() : 0;
        },
        valueFormatter: (params) => {
          const val = params.value ?? 0;
          return val.toFixed(2) + '%';
        }
      },
      {
        field: 'total',
        headerName: 'Total',
        editable: false,
        width: 120,
        valueGetter: (params) => {
          const cantidad = params.data.cantidad || 0;
          const venta = params.data.venta || 0;
          const impuesto = this.getImpuestoAmountFromRow(params.data);
          return (cantidad * venta) + impuesto;
        },
        valueFormatter: (params) => {
          if (params.value) {
            return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
          }
          return '$0.00';
        },
        cellStyle: { backgroundColor: '#d4edda', fontWeight: 'bold' }
      },
      {
        field: 'estado',
        headerName: 'Estado',
        editable: (params) => !this.isLocked && !this.isBlockedManualState(params.data?.estado),
        width: 120,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.MANUAL_ESTADOS
        },
        valueSetter: (params: any) => {
          params.data.estado = params.newValue;
          return true;
        },
        cellStyle: (params) => {
          if (params.value === 'RECIBIDO') return { backgroundColor: '#d4edda' };
          if (params.value === 'CANCELADO') return { backgroundColor: '#f8d7da' };
          if (params.value === 'ALMACENADO') return { backgroundColor: '#cce5ff' };
          if (params.value === 'REVENDIDO') return { backgroundColor: '#fff3cd' };
          if (params.value === 'REMISION') return { backgroundColor: '#ffe5b4' };
          if (params.value === 'ENTREGADO') return { backgroundColor: '#d1ecf1' };
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
      },
    ];
  }

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    animateRows: true,
    rowSelection: 'single',
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: true,
    suppressRowTransform: true,
    /** Popups (editores, selects) fuera del viewport para evitar recortes en master-detail */
    popupParent: typeof document !== 'undefined' ? document.body : undefined,
    onSelectionChanged: (event: any) => {
      const rows = event.api.getSelectedRows();
      this.selectedRow = rows.length > 0 ? rows[0] : null;
    },
    onCellEditingStarted: (event: any) => {
      if (this.isLocked) return;
      this.sawEnterDuringEdit = false;
      if (this.enterCapture) {
        window.removeEventListener('keydown', this.enterCapture, true);
        this.enterCapture = undefined;
      }
      this.enterCapture = (ev: KeyboardEvent) => {
        if (ev.key === 'Enter') this.sawEnterDuringEdit = true;
      };
      window.addEventListener('keydown', this.enterCapture, true);
    },
    onCellEditingStopped: (event: any) => {
      if (this.enterCapture) {
        window.removeEventListener('keydown', this.enterCapture, true);
        this.enterCapture = undefined;
      }

      if (this.isLocked || this.handlingPartialReceipt) return;

      const colId = event.column?.getColId?.() ?? event.colDef?.field;
      const nextColId = this.NEXT_EDIT_COL[colId];
      if (!nextColId) return;
      // Si cambiaron a RECIBIDO con cantidad > 1, se abrirá el Swal de recepción parcial:
      // evitamos mover el foco con Enter porque eso roba foco al input del modal.
      if (
        colId === 'estado' &&
        String(event?.data?.estado ?? '').toUpperCase() === 'RECIBIDO' &&
        Number(event?.data?.cantidad) > 1
      ) {
        this.sawEnterDuringEdit = false;
        return;
      }

      const browserEvent = event.event as Event | undefined;
      if (browserEvent instanceof MouseEvent) {
        this.sawEnterDuringEdit = false;
        return;
      }

      const ke = browserEvent instanceof KeyboardEvent ? browserEvent : undefined;
      if (ke?.key === 'Tab' || ke?.key === 'Escape') {
        this.sawEnterDuringEdit = false;
        return;
      }

      const keyboardEnter = ke?.key === 'Enter';
      const capturedEnter = this.sawEnterDuringEdit;
      this.sawEnterDuringEdit = false;

      // clienteName usa RichSelect: requiere value change + Enter capturado
      if (colId === 'clienteName') {
        if (!capturedEnter || !event.valueChanged) return;
      } else {
        if (!keyboardEnter && !capturedEnter) return;
      }

      const rowIndex = event.node?.rowIndex;
      if (rowIndex == null || !this.gridApi) return;

      if (nextColId === 'producto') {
        setTimeout(() => {
          this.skipFirstEnterOnProductoEditor = true;
          this.gridApi.setFocusedCell(rowIndex, 'producto');
          this.gridApi.startEditingCell({ rowIndex, colKey: 'producto' });
          queueMicrotask(() => { this.skipFirstEnterOnProductoEditor = false; });
        }, 0);
      } else {
        setTimeout(() => {
          this.gridApi.setFocusedCell(rowIndex, nextColId);
          this.gridApi.startEditingCell({ rowIndex, colKey: nextColId });
        }, 0);
      }
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
      clienteName: '',
      idProducto: 0,
      cantidad: 1,
      plataforma: 'TEMU',
      aplicaImpuestos: false,
      impuesto: 0,
      costo: 0,
      venta: 0,
      comentario: '',
      active: true,
      __isNew: true,
      __modified: false
    };

    this.rowData = [newItem, ...this.rowData];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);
    this.notifyTotalVentaToParent();

    setTimeout(() => {
      let targetIndex = 0;
      this.gridApi.forEachNodeAfterFilterAndSort((node, index) => {
        if (node.data?.id === tempId) targetIndex = index;
      });
      this.gridApi.ensureIndexVisible(targetIndex, 'middle');
      this.gridApi.startEditingCell({ rowIndex: targetIndex, colKey: 'clienteName' });
    }, 100);
  }

  async deleteSelectedItem() {
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

    // Fila nueva (sin guardar): quitar solo del grid sin llamar al API
    if (selectedItem.__isNew) {
      this.rowData = this.rowData.filter(item => item !== selectedItem);
      this.gridApi.setGridOption('rowData', this.rowData);
      this.notifyTotalVentaToParent();
      if (this.context?.CONCEPTS?.updateCount) {
        this.context.CONCEPTS.updateCount(this.params.data.id, this.rowData.length);
      }
      return;
    }

    const confirm = await alerts.confirmAlert(
      '¿Eliminar registro?',
      '¿Deseas borrar este registro?',
      'warning',
      'Sí, borrar'
    );
    if (!confirm?.isConfirmed) return;

    try {
      await lastValueFrom(this.pedidosService.deleteDetalle(selectedItem.id));
      this.rowData = this.rowData.filter(item => item !== selectedItem);
      this.gridApi.setGridOption('rowData', this.rowData);
      if (this.context?.CONCEPTS?.removeFromCache) {
        this.context.CONCEPTS.removeFromCache(this.params.data.id, selectedItem.id);
      }
      this.notifyTotalVentaToParent();
      if (this.context?.CONCEPTS?.updateCount) {
        this.context.CONCEPTS.updateCount(this.params.data.id, this.rowData.length);
      }
      alerts.toastAlert('Registro eliminado', 'success');
    } catch (err) {
      console.error('Error al eliminar detalle:', err);
      alerts.basicAlert('Error', 'No se pudo eliminar el registro', 'error');
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
      const detallesActualizados = await this.context.CONCEPTS.save(pedidoId, { detalles: this.rowData });
      if (Array.isArray(detallesActualizados) && detallesActualizados.length >= 0) {
        this.rowData = detallesActualizados.map((item: any) => ({
          ...item,
          __isNew: false,
          __modified: false
        }));
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
          this.gridApi.refreshCells({ force: true });
        }
      }
      this.hasUnsavedChanges = false;
    }
    
    alerts.toastAlert('Se guardó un registro', 'success');
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

  async onCellValueChanged(event: any) {
    const wasModified = !!event.data.__modified;

    if (event?.data) {
      this.recalcImpuestoInRow(event.data);
    }
    event.data.__modified = true;
    this.hasUnsavedChanges = true;

    const col = event.column?.getColId?.() ?? event.colDef?.field;

    if (col === 'estado' && event.newValue === 'RECIBIDO' && Number(event.data.cantidad) > 1) {
      await this.handlePartialReceipt(event, wasModified);
    }

    if (col === 'venta') {
      this.notifyTotalVentaToParent();
    }
    if ((col === 'venta' || col === 'cantidad') && event.data.aplicaImpuestos) {
      if (this.gridApi) {
        this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['impuesto', 'total'], force: true });
      }
    }
  }

  private async handlePartialReceipt(event: any, wasModified: boolean): Promise<void> {
    const totalCantidad = Number(event.data.cantidad) || 1;

    this.handlingPartialReceipt = true;
    this.gridApi?.stopEditing();

    const result = await Swal.fire({
      title: 'Recepción de mercancía',
      html: `¿Cuántas piezas se reciben?<br><small>Cantidad del ítem: <b>${totalCantidad}</b></small>`,
      input: 'number',
      inputValue: String(totalCantidad),
      inputAttributes: { min: '1', max: String(totalCantidad), step: '1' },
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      preConfirm: (value: string) => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 1) {
          Swal.showValidationMessage('Ingresa una cantidad válida (mínimo 1)');
          return false;
        }
        if (num > totalCantidad) {
          Swal.showValidationMessage(`No puede exceder ${totalCantidad}`);
          return false;
        }
        return num;
      }
    });

    if (!result.isConfirmed) {
      this.handlingPartialReceipt = false;
      // Revertir estado
      event.data.estado = event.oldValue || 'SOLICITADO';
      if (!wasModified) event.data.__modified = false;
      if (this.gridApi) {
        this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['estado'], force: true });
      }
      return;
    }

    const cantidadRecibida = Number(result.value);
    const cantidadRestante = totalCantidad - cantidadRecibida;

    if (cantidadRestante <= 0) {
      this.handlingPartialReceipt = false;
      await this.confirmAndSaveAfterReceipt();
      return; // Recibe todo -> sin cambios adicionales
    }

    // Recepción parcial: ajustar fila actual y crear fila pendiente
    event.data.cantidad = cantidadRecibida;
    this.recalcImpuestoInRow(event.data);

    const tempId = `temp_detalle_${this.tempIdCounter++}`;
    const pendingRow: any = {
      id: tempId,
      idPedido: event.data.idPedido,
      idCliente: event.data.idCliente,
      clienteName: event.data.clienteName,
      producto: event.data.producto,
      cantidad: cantidadRestante,
      plataforma: event.data.plataforma,
      aplicaImpuestos: event.data.aplicaImpuestos,
      costo: event.data.costo,
      venta: event.data.venta,
      comentario: event.data.comentario,
      active: event.data.active ?? true,
      estado: event.oldValue || 'SOLICITADO',
      __isNew: true,
      __modified: false
    };
    this.recalcImpuestoInRow(pendingRow);

    this.rowData = [...this.rowData, pendingRow];
    this.gridApi?.setGridOption('rowData', this.rowData);
    this.gridApi?.refreshCells({ force: true });
    this.notifyTotalVentaToParent();
    this.handlingPartialReceipt = false;
    await this.confirmAndSaveAfterReceipt();
  }

  private async confirmAndSaveAfterReceipt(): Promise<void> {
    const saveResult = await Swal.fire({
      title: 'Guardar registro',
      text: 'Desea guardar el registro ahora?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Si, guardar',
      cancelButtonText: 'No'
    });

    if (!saveResult.isConfirmed) return;
    await this.saveChanges();
  }

  private notifyTotalVentaToParent(): void {
    const pedidoId = this.params?.data?.id;
    if (!pedidoId) return;
    const sumVenta = (this.rowData || []).reduce((sum, r) => {
      const cantidad = Number(r?.cantidad) || 0;
      const venta = Number(r?.venta) || 0;
      const impuesto = Number(r?.impuesto) || 0;
      return sum + (cantidad * venta) + impuesto;
    }, 0);
    if (this.context?.CONCEPTS?.updateTotalVenta) {
      this.context.CONCEPTS.updateTotalVenta(pedidoId, sumVenta);
    }
  }

  refreshByParent() {
    this.loadData();
  }

  private isBlockedManualState(estado: unknown): boolean {
    return this.BLOCKED_MANUAL_STATES.includes(String(estado ?? '').toUpperCase());
  }

  // ==================== REMISIÓN ====================

  async sendToRemision(item: any): Promise<void> {
    const detalleId  = Number(item?.id ?? 0);
    const clienteId  = Number(item?.idCliente ?? 0);
    const pedidoId   = Number(item?.idPedido ?? 0);
    const idCompany  = Number(this.context?.idCompany ?? 0);

    if (detalleId <= 0 || !idCompany || !clienteId) {
      alerts.basicAlert('Datos incompletos', 'Falta empresa, cliente o ID del ítem.', 'warning');
      return;
    }

    const cantidadDisponible = Number(item.cantidad) || 0;
    if (cantidadDisponible <= 0) {
      alerts.basicAlert('Cantidad inválida', 'El ítem debe tener una cantidad válida para remisionar.', 'warning');
      return;
    }

    const qResult = await Swal.fire({
      title: 'Cantidad a remisionar',
      text: 'Indica la cantidad que deseas mandar a remisión.',
      input: 'number',
      inputValue: String(cantidadDisponible),
      inputAttributes: { min: '1', max: String(cantidadDisponible), step: '1' },
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      preConfirm: (value: string) => {
        const cantidad = Number(value);
        if (!Number.isFinite(cantidad) || cantidad <= 0) {
          Swal.showValidationMessage('La cantidad debe ser mayor a 0');
          return false;
        }
        if (cantidad > cantidadDisponible) {
          Swal.showValidationMessage(`Disponible: ${cantidadDisponible}`);
          return false;
        }
        return cantidad;
      }
    });
    if (!qResult.isConfirmed) return;

    const cantidadRemitida = Number(qResult.value);
    const comentario = '';
    const createdBy  = localStorage.getItem('mail') || 'WEB';

    try {
      alerts.showLoading('Preparando remisión...', 'Consultando remisiones abiertas del cliente.');
      const abiertasResponse: any = await lastValueFrom(
        this.remisionesService.getByCliente(idCompany, clienteId, 'ABIERTA')
      );
      const remisionesAbiertas = this.extractOpenRemisiones(abiertasResponse, idCompany, clienteId);
      alerts.closeLoading();

      let idRemision = 0;
      let openResponse: any = null;

      if (remisionesAbiertas.length > 0) {
        const selectedOption = await this.askOpenRemisionSelection(remisionesAbiertas);
        if (!selectedOption) return;

        if (selectedOption === 'NEW') {
          alerts.showLoading('Creando remisión...', '');
          openResponse = await lastValueFrom(
            this.remisionesService.createOrReuseOpen({
              idCompany, IdCompany: idCompany,
              idCliente: clienteId, IdCliente: clienteId,
              forceNew: true, ForceNew: true,
              comentario, Comentario: comentario,
              createdBy, CreatedBy: createdBy,
            })
          );
          alerts.closeLoading();
        } else {
          idRemision = Number(selectedOption);
        }
      } else {
        alerts.showLoading('Creando remisión...', '');
        openResponse = await lastValueFrom(
          this.remisionesService.createOrReuseOpen({
            idCompany, IdCompany: idCompany,
            idCliente: clienteId, IdCliente: clienteId,
            comentario, Comentario: comentario,
            createdBy, CreatedBy: createdBy,
          })
        );
        alerts.closeLoading();
      }

      if (openResponse) {
        idRemision = Number(
          openResponse?.id ?? openResponse?.Id ??
          openResponse?.Data?.id ?? openResponse?.Data?.Id ??
          openResponse?.data?.id ?? openResponse?.data?.Id ??
          openResponse?.remision?.id ?? openResponse?.remision?.Id ?? 0
        );
      }

      if (idRemision <= 0) throw new Error('No se pudo determinar la remisión destino.');

      const payload = {
        idCompany, IdCompany: idCompany,
        idCliente: clienteId, IdCliente: clienteId,
        idRemision, IdRemision: idRemision,
        idPedido: pedidoId, IdPedido: pedidoId,
        idDetallePedido: detalleId, IdDetallePedido: detalleId,
        idDetalle: detalleId, IdDetalle: detalleId,
        cantidadRemitida, CantidadRemitida: cantidadRemitida,
        cantidad: cantidadRemitida, Cantidad: cantidadRemitida,
        comentario, Comentario: comentario,
        createdBy, CreatedBy: createdBy,
      };

      alerts.showLoading('Mandando a remisión...', 'Agregando detalle a la remisión seleccionada.');
      await lastValueFrom(this.remisionesService.addDetalle(payload));
      alerts.closeLoading();
      alerts.toastAlert('Detalle mandado a remisión', 'success');
      this.loadData();
    } catch (error) {
      alerts.closeLoading();
      const msg = (error as any)?.error?.message || (error as any)?.message || 'No se pudo mandar el detalle a remisión.';
      alerts.basicAlert('Error', msg, 'error');
    }
  }

  private extractOpenRemisiones(response: any, idCompany: number, idCliente: number): any[] {
    const possibleLists = [
      response?.data, response?.Data,
      response?.data?.remisiones, response?.Data?.Remisiones,
      response?.remisiones, response?.Remisiones
    ];
    let list: any[] = [];
    for (const candidate of possibleLists) {
      if (Array.isArray(candidate)) { list = candidate; break; }
      if (candidate && typeof candidate === 'object') {
        const nested = candidate?.remisiones || candidate?.Remisiones;
        if (Array.isArray(nested)) { list = nested; break; }
      }
    }
    return list
      .filter((r: any) =>
        String(r?.estado ?? '').toUpperCase() === 'ABIERTA' &&
        Number(r?.idCompany ?? r?.IdCompany ?? 0) === idCompany &&
        Number(r?.idCliente ?? r?.IdCliente ?? 0) === idCliente
      )
      .sort((a: any, b: any) =>
        new Date(b?.fechaCreacion || 0).getTime() - new Date(a?.fechaCreacion || 0).getTime()
      );
  }

  private async askOpenRemisionSelection(remisionesAbiertas: any[]): Promise<number | 'NEW' | null> {
    const inputOptions: Record<string, string> = {};
    for (const r of remisionesAbiertas) {
      const id = Number(r?.id ?? r?.Id ?? 0);
      if (id <= 0) continue;
      const folio = r?.folio || r?.Folio || `#${id}`;
      const fecha = r?.fechaCreacion || r?.FechaCreacion;
      inputOptions[String(id)] = `${folio} | Creada: ${fecha ? new Date(fecha).toLocaleString('es-MX') : '-'}`;
    }
    inputOptions['NEW'] = '➕ Crear nueva remisión';

    const firstId = Number(remisionesAbiertas[0]?.id ?? remisionesAbiertas[0]?.Id ?? 0);
    const defaultSelected = remisionesAbiertas.length === 1 && firstId > 0 ? String(firstId) : '';

    const result = await Swal.fire({
      title: 'Selecciona remisión abierta',
      text: 'Elige a cuál remisión deseas enviar el detalle.',
      input: 'radio',
      inputOptions,
      inputValue: defaultSelected,
      width: '28rem',
      showCancelButton: true,
      confirmButtonText: 'Usar remisión',
      cancelButtonText: 'Cancelar',
      customClass: {
        container: 'swal-over-modal',
        popup: 'swal-remisiones-popup',
        title: 'swal-remisiones-title',
        htmlContainer: 'swal-remisiones-text',
        input: 'swal-remisiones-radio',
        actions: 'swal-remisiones-actions',
      },
      inputValidator: (value) => (!value ? 'Debes seleccionar una remisión' : null)
    });

    if (!result.isConfirmed) return null;
    if (result.value === 'NEW') return 'NEW';
    const selectedId = Number(result.value || 0);
    return selectedId > 0 ? selectedId : null;
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

  openBancoModal() {
    this.showBancoModal = true;
    // Si ya tiene banco, precargar los valores para editar
    if (this.hasBancoInfo) {
      this.selectedBanco = this.params?.data?.banco || '';
      this.totalBanco = this.params?.data?.totalPagarBanco || null;
    } else {
      this.selectedBanco = '';
      this.totalBanco = null;
    }
    document.body.classList.add('modal-open');
  }

  closeBancoModal() {
    this.showBancoModal = false;
    this.selectedBanco = '';
    this.totalBanco = null;
    document.body.classList.remove('modal-open');
  }

  async saveBancoTotal() {
    if (!this.selectedBanco || !this.totalBanco) {
      alerts.basicAlert('Error', 'Selecciona un banco e ingresa el total.', 'error');
      return;
    }

    try {
      // Preparar datos para guardar en BD
      const pedidoId = this.params?.data?.id;
      if (!pedidoId) {
        alerts.basicAlert('Error', 'No se encontró el ID del pedido', 'error');
        return;
      }

      const dataToSend = {
        id: pedidoId,
        idCompany: this.params.data.idCompany,
        numero: this.params.data.numero,
        fecha: this.params.data.fecha,
        comentario: this.params.data.comentario,
        active: this.params.data.active,
        banco: this.selectedBanco,
        totalPagarBanco: this.totalBanco,
      };

      // Guardar en BD
      await lastValueFrom(this.pedidosService.updatePedido(pedidoId, dataToSend));

      // Actualizar la fila en memoria
      if (this.params && this.params.data) {
        this.params.data.banco = this.selectedBanco;
        this.params.data.totalPagarBanco = this.totalBanco;

        // Refrescar la fila en el grid
        if (this.context?.gridApi) {
          this.context.gridApi.refreshCells({ rowNodes: [this.params.node], force: true });
        }
      }

      alerts.basicAlert('Éxito', `Total de $${this.totalBanco} agregado para ${this.selectedBanco}`, 'success');
      this.closeBancoModal();
    } catch (error) {
      console.error('Error guardando banco y total:', error);
      alerts.basicAlert('Error', 'No se pudieron guardar los datos', 'error');
    }
  }
}
