import { Component, OnInit, inject } from '@angular/core';
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
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).default?.pdfMake?.vfs;

@Component({
  selector: 'app-detalles-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, ProductoAutocompleteEditorComponent],
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
  private administrationService = inject(AdministrationService);
  private pedidosService = inject(PedidosService);
  private remisionesService = inject(RemisionesService);
  private sanitizer = inject(DomSanitizer);

  rowData: any[] = [];
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

  /** Enter visto en captura (popup Rich Select no dispara cellKeyDown del grid) */
  private sawEnterDuringEdit = false;
  private enterCapture?: (ev: KeyboardEvent) => void;

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

  ngOnInit() {
    this.loadData();
    this.loadBancos();
  }

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.context = params.context;
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
        this.rowData = data.map(item => ({
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
        suppressKeyboardEvent: (params: any) => params.event.key === 'Enter' && params.editing,
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
          const aplicaImpuestos = params.data?.aplicaImpuestos === true || params.data?.aplicaImpuestos === 1 || params.data?.aplicaImpuestos === '1';
          const defaultImpuesto = Number(this.context?.componentParent?.defaultImpuesto ?? 16);
          return aplicaImpuestos ? defaultImpuesto : 0;
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
          const impuesto = params.data.impuesto || 0;
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
      }
    ];
  }

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    animateRows: true,
    rowSelection: 'single',
    domLayout: 'autoHeight',
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: true,
    suppressRowTransform: true,
    /** Popups (editores, selects) fuera del viewport para evitar recortes en master-detail */
    popupParent: typeof document !== 'undefined' ? document.body : undefined,
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

      if (this.isLocked) return;

      const colId = event.column?.getColId?.() ?? event.colDef?.field;
      const nextColId = this.NEXT_EDIT_COL[colId];
      if (!nextColId) return;

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

    this.rowData = [...this.rowData, newItem];
    this.hasUnsavedChanges = true;
    this.gridApi.setGridOption('rowData', this.rowData);
    this.notifyTotalVentaToParent();

    setTimeout(() => {
      const lastRowIndex = this.rowData.length - 1;
      this.gridApi.ensureIndexVisible(lastRowIndex);
      this.gridApi.startEditingCell({
        rowIndex: lastRowIndex,
        colKey: 'clienteName'
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
        this.notifyTotalVentaToParent();
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

    // Validación: cliente + producto + plataforma duplicados en el mismo pedido
    const normalizeKeyPart = (v: any) => String(v ?? '').trim().toUpperCase();
    const groups = new Map<string, any[]>();
    for (const r of this.rowData) {
      const clienteKey = normalizeKeyPart(r?.idCliente);
      const productoKey = normalizeKeyPart(r?.producto);
      const plataformaKey = normalizeKeyPart(r?.plataforma);
      if (!clienteKey || !productoKey || !plataformaKey) continue;
      const key = `${clienteKey}||${productoKey}||${plataformaKey}`;
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }

    const duplicates = [...groups.values()].filter(arr => arr.length > 1);
    if (duplicates.length > 0) {
      const msg =
        'Este cliente ya está registrado con este producto en la misma plataforma.\n\n' +
        '¿Quieres aumentar la cantidad (sumar) y eliminar duplicados?';

      const result = await alerts.confirmAlert(
        'Duplicado detectado',
        msg,
        'warning',
        'Sí, aumentar cantidad'
      );

      if (!result?.isConfirmed) return;

      // Merge: suma cantidades y elimina duplicados (en UI y backend si aplica)
      for (const arr of duplicates) {
        const keep = arr.find(r => !r.__isNew && r?.id) ?? arr[0];
        const totalCantidad = arr.reduce((sum, r) => sum + (Number(r?.cantidad) || 0), 0);
        keep.cantidad = totalCantidad > 0 ? totalCantidad : 1;
        keep.__modified = true;

        for (const r of arr) {
          if (r === keep) continue;
          // Si ya existía en backend, lo eliminamos para evitar duplicados
          if (!r.__isNew && r?.id && this.context?.pedidosService?.deleteDetalle) {
            try {
              await lastValueFrom(this.context.pedidosService.deleteDetalle(r.id));
            } catch (e) {
              console.error('Error eliminando duplicado:', e);
            }
          }
          this.rowData = this.rowData.filter(x => x !== r);
        }
      }

      this.hasUnsavedChanges = true;
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
        this.gridApi.refreshCells({ force: true });
      }
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

    const col = event.column?.getColId?.() ?? event.colDef?.field;
    if (col === 'venta') {
      this.notifyTotalVentaToParent();
    }
    if ((col === 'venta' || col === 'cantidad') && event.data.aplicaImpuestos) {
      if (this.gridApi) {
        this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['impuesto', 'total'], force: true });
      }
    }
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

  async sendSelectedItemToRemision(): Promise<void> {
    if (this.isLocked) {
      alerts.basicAlert('Pedido bloqueado', 'No se puede operar la remisión sobre un pedido bloqueado.', 'warning');
      return;
    }

    if (this.hasUnsavedChanges) {
      alerts.basicAlert('Guardar primero', 'Guarda o deshaz los cambios antes de mandar a remisión.', 'warning');
      return;
    }

    const selectedRows = this.gridApi?.getSelectedRows?.() || [];
    if (selectedRows.length === 0) {
      alerts.basicAlert('Selección requerida', 'Selecciona un detalle para mandarlo a remisión.', 'warning');
      return;
    }

    const selectedItem = selectedRows[0];
    if (selectedItem.__isNew || !selectedItem.id) {
      alerts.basicAlert('Guardar primero', 'El detalle debe existir en la base antes de mandarlo a remisión.', 'warning');
      return;
    }

    const estadoActual = String(selectedItem.estado ?? '').toUpperCase();
    if (estadoActual === 'ENTREGADO') {
      alerts.basicAlert('No permitido', 'Un detalle ENTREGADO ya no puede volver a remisión.', 'warning');
      return;
    }

    const cantidadMaxima = Number(selectedItem.cantidad) || 0;
    if (cantidadMaxima <= 0) {
      alerts.basicAlert('Cantidad inválida', 'El detalle debe tener una cantidad válida para remisionar.', 'warning');
      return;
    }

    const quantityResult = await alerts.inputAlert(
      'Cantidad a remisionar',
      'Indica la cantidad que deseas mandar a remisión.',
      'text',
      String(cantidadMaxima),
      {
        confirmButtonText: 'Continuar',
        inputAttributes: {
          inputmode: 'decimal',
          autocomplete: 'off',
        },
        swalOptions: {
          preConfirm: (value: string) => {
            const cantidad = Number(value);
            if (!Number.isFinite(cantidad) || cantidad <= 0) {
              return 'La cantidad debe ser mayor a 0';
            }
            if (cantidad > cantidadMaxima) {
              return `La cantidad no puede ser mayor a ${cantidadMaxima}`;
            }
            return null;
          },
        },
      }
    );

    if (!quantityResult.isConfirmed) return;

    const cantidadRemitida = Number(quantityResult.value);
    const commentResult = await alerts.inputAlert(
      'Comentario de remisión',
      'Puedes capturar un comentario opcional para este movimiento.',
      'textarea',
      '',
      {
        required: false,
        confirmButtonText: 'Mandar a remisión',
      }
    );

    if (!commentResult.isConfirmed) return;

    const comentario = String(commentResult.value ?? '').trim();
    const idCompany = this.context?.idCompany;
    const createdBy = this.context?.trackingService?.getEmail?.() || null;

    if (!idCompany || !selectedItem.idCliente) {
      alerts.basicAlert('Datos incompletos', 'Falta empresa o cliente para crear la remisión.', 'warning');
      return;
    }

    alerts.showLoading('Mandando a remisión...', 'Creando o reutilizando la remisión abierta.');
    try {
      await lastValueFrom(
        this.remisionesService.addDetalle({
          idCompany,
          idCliente: selectedItem.idCliente,
          idDetallePedido: selectedItem.id,
          cantidadRemitida,
          comentario,
          createdBy,
        })
      );

      alerts.closeLoading();
      alerts.toastAlert('Detalle mandado a remisión', 'success');
      this.loadData();
      this.context?.componentParent?.loadData?.();
    } catch (error) {
      alerts.closeLoading();
      console.error('Error mandando detalle a remisión:', error);
      alerts.basicAlert('Error', 'No se pudo mandar el detalle a remisión.', 'error');
    }
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
