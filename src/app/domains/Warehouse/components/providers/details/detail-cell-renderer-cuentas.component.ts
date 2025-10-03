import { Component ,inject} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { DetallesComponentCuentas } from './subdetalles/Detalles-Cuentas.component';

@Component({
  selector: 'app-detail-cell-renderer-cuentas',
  standalone: true,
  providers: [CurrencyPipe],
  imports: [AgGridModule, CommonModule, DetallesComponentCuentas],
  template: `
    <div 
      style="padding: 10px; background-color: #f8f9fa;"
      (mouseenter)="params.onMouseEnter && params.onMouseEnter()"
      (mouseleave)="params.onMouseLeave && params.onMouseLeave()">
      <!-- Grid de Cuenta -->
      <div style="margin-bottom: 15px; height: 250px;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Cuentas de: {{ providerName }}</strong>
          <div>
            <button 
              class="btn btn-sm btn-success me-2" 
              (click)="addCuenta()"
              [disabled]="!cuentaGridApi">
              <i class="bi bi-plus-circle"></i> Agregar
            </button>
            <button 
              class="btn btn-sm btn-primary me-2" 
              (click)="saveCuentas()"
              [disabled]="!hasCuentaChanges">
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              (click)="deleteSelectedCuenta()"
              [disabled]="!selectedCuenta">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="height: 100%; width: 100%;"
          [columnDefs]="cuentaColumnDefs"
          [rowData]="cuentaRowData"
          [gridOptions]="cuentaGridOptions"
          (gridReady)="onCuentaGridReady($event)"
          (cellValueChanged)="onCuentaCellValueChanged($event)"
          [components]="components">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererComponentCuentas implements ICellRendererAngularComp {

  params: any;
  providerId: number;
  providerName: string;
  
  cuentaRowData: any[] = [];
  hasCuentaChanges: boolean = false;
  cuentaGridApi: any;
  selectedCuenta: any = null;
  private collapseTimer: any = null;

  components = {
    detallesCuentasRenderer: DetallesComponentCuentas
  };
  
  cuentaGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    masterDetail: true,
    isRowMaster: (dataItem) => dataItem && dataItem.id,
    detailCellRenderer: 'detallesCuentasRenderer',
    detailCellRendererParams: (p) => { // 'p' para evitar conflicto con this.params
      return {
        context: this.params?.context, // Pasamos el contexto principal
        // La lógica del mouse ahora se maneja aquí, como en providers.component.ts
        onMouseEnter: () => {
          if (this.collapseTimer) clearTimeout(this.collapseTimer);
        },
        onMouseLeave: () => {
          this.collapseTimer = setTimeout(() => p.node.setExpanded(false), 300);
        }
      };
    },
  };

  constructor(private currencyPipe: CurrencyPipe) {}

  /*cuentaColumnDefs = [
    { field: 'campo2', headerName: 'Fecha OC', editable: true, flex: 1 },
    { field: 'campo3', headerName: 'Factura o Nota', editable: true, flex: 1, cellEditor: 'agDateCellEditor' },
    { field: 'campo4', headerName: 'MNumero Factura o Nota', editable: true, flex: 1, valueFormatter: params => `$${Number(params.value || 0).toFixed(2)}` },
    { field: 'campo5', headerName: 'Articulo', editable: true, flex: 1, valueFormatter: params => `$${Number(params.value || 0).toFixed(2)}` },
    { field: 'campo3', headerName: 'Categoria', editable: true, flex: 1, cellEditor: 'agDateCellEditor' },
    { field: 'campo4', headerName: 'Familia', editable: true, flex: 1, valueFormatter: params => `$${Number(params.value || 0).toFixed(2)}` },
    { field: 'campo5', headerName: 'SubFamilia', editable: true, flex: 1, valueFormatter: params => `$${Number(params.value || 0).toFixed(2)}` },
    { field: 'campo2', headerName: 'Cantidad', editable: true, flex: 1 },
    { field: 'campo3', headerName: 'Precio Unitario', editable: true, flex: 1, cellEditor: 'agDateCellEditor' },
    { field: 'campo4', headerName: 'Total x Nota', editable: true, flex: 1, valueFormatter: params => `$${Number(params.value || 0).toFixed(2)}` },
    { field: 'campo5', headerName: 'Abono a Cuenta', editable: true, flex: 1, valueFormatter: params => `$${Number(params.value || 0).toFixed(2)}` },
    { field: 'campo4', headerName: 'Restante', editable: true, flex: 1, valueFormatter: params => `$${Number(params.value || 0).toFixed(2)}` },
  ];*/
  cuentaColumnDefs = [
    { 
      field: 'campo8', 
      headerName: 'Fecha OC', 
      editable: true, 
       cellEditor: 'agDateCellEditor',
      cellEditorParams: {
        min: '2020-01-01',
        max: '2030-12-31'
      },
      valueFormatter: (params) => {
        if (!params.value) return '';
        // Convertir YYYY-MM-DD a DD/MM/YYYY para mostrar
        const dateValue = params.value.split('T')[0];
        const [year, month, day] = dateValue.split('-');
        return `${day}/${month}/${year}`;
      },
      valueParser: (params) => {
        // Convertir DD/MM/YYYY a YYYY-MM-DD para guardar
        if (!params.newValue) return '';

        // Si ya viene en formato YYYY-MM-DD (del date picker), usar así
        if (params.newValue.includes('-')) {
          return params.newValue.split('T')[0];
        }

        // Si viene en formato DD/MM/YYYY, convertir
        const [day, month, year] = params.newValue.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      },
      valueSetter: (params) => {
        if (params.newValue) {
          let dateValue;

          // Si es un objeto Date (del date picker)
          if (params.newValue instanceof Date) {
            const year = params.newValue.getFullYear();
            const month = String(params.newValue.getMonth() + 1).padStart(2, '0');
            const day = String(params.newValue.getDate()).padStart(2, '0');
            dateValue = `${year}-${month}-${day}`;
          }
          // Si es string y contiene guiones (formato YYYY-MM-DD)
          else if (typeof params.newValue === 'string' && params.newValue.includes('-')) {
            dateValue = params.newValue.split('T')[0];
          }
          // Si es string y contiene barras (formato DD/MM/YYYY)
          else if (typeof params.newValue === 'string' && params.newValue.includes('/')) {
            const [day, month, year] = params.newValue.split('/');
            dateValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
          // Si es otro tipo de string, intentar parsearlo
          else if (typeof params.newValue === 'string') {
            dateValue = params.newValue;
          }

          params.data[params.colDef.field] = dateValue;
        } else {
          params.data[params.colDef.field] = '';
        }
        return true;
      },
      flex: 1 
    },
    { 
      field: 'campo2', 
      headerName: 'Factura o Nota', 
      editable: true, 
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['FACTURA', 'NOTA'] // Opciones del selector
      },
      flex: 1
    },
    { 
      field: 'campo1', 
      headerName: 'Numero Factura o Nota', 
      editable: true, 
      flex: 1
    },
    { 
      field: 'campo4', 
      headerName: 'Total por nota', 
      editable: false, 
      flex: 1,
      valueFormatter: params => this.currencyPipe.transform(params.value, 'MXN', 'symbol', '1.2-2')
    },
    { 
      field: 'campo5', 
      headerName: 'Abono a Cuenta', 
      editable: false,
      // Este cellRenderer ahora solo muestra el ícono y el valor
      cellRenderer: (params) => {
        const value = this.currencyPipe.transform(params.value, 'MXN', 'symbol', '1.2-2');
        return `<i class="bi bi-box-arrow-in-down" style="cursor: pointer; color: #0d6efd;"></i> ${value || ''}`;
      },
      flex: 1
    },
    { 
      field: 'campo6', 
      headerName: 'Restante', 
      editable: false, 
      flex: 1,
      valueFormatter: params => this.currencyPipe.transform(params.value, 'MXN', 'symbol-narrow', '1.2-2')
    },
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerId = params.data.id;
    this.providerName = params.data.company || params.data.nameContact;
    
    // Asegurarse de que el contexto se pase al gridOptions del detalle
    this.cuentaGridOptions.detailCellRendererParams.context = params.context;
    this.loadCuentaData();
  }

  refresh(): boolean {
    return false;
  }
  createDetailToggleCellRenderer(detailType: string): (params: any) => HTMLElement {
    return (params: any): HTMLElement => {
      const div = document.createElement('div');
      const value = this.currencyPipe.transform(params.value, 'MXN', 'symbol', '1.2-2');
      div.innerHTML = `<i class="bi bi-box-arrow-in-down"></i> ${value || ''}`;
      div.style.cursor = 'pointer';
      div.style.textDecoration = 'underline';
      div.style.color = '#0d6efd';
      return div;
    };
  }

  onCellMouseOver(event: any) {
    if (event.column.getColId() === 'campo5') {
      if (this.collapseTimer) clearTimeout(this.collapseTimer);
      this.cuentaGridApi.forEachNode(node => node.setExpanded(false));
      event.node.setExpanded(true);
    }
  }

  onCellMouseOut(event: any) {
    if (event.column.getColId() === 'campo5') {
      this.collapseTimer = setTimeout(() => {
        event.node.setExpanded(false);
      }, 300);
    }
  }

  onCuentaGridReady(params: any) {
    this.cuentaGridApi = params.api;
    
    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedCuenta = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onCuentaCellValueChanged(event: any) {
    if (event.newValue !== event.oldValue) {
      event.data.__modified = true;
      this.hasCuentaChanges = true;
    }
  }

  loadCuentaData() {
    if (this.params && this.params.context && this.params.context.CUENTA && this.params.context.CUENTA.load) {
      this.params.context.CUENTA.load(this.providerId, 'CUENTA', (data: any) => {
        this.cuentaRowData = data;
      });
    }
  }

  addCuenta() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Los meses son base 0
    const day = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    const newCuenta = {
      id: `temp_cuenta_${Date.now()}`,
      idTabla: this.providerId,
      type: 'CUENTA',
      campo4: '',
      campo5: '',
      campo6: '0',
      campo8: formattedDate, // Asignar la fecha de hoy
      __isNew: true
    };
    this.cuentaRowData = [newCuenta, ...this.cuentaRowData];
    this.hasCuentaChanges = true;
  }

  saveCuentas() {
    if (this.params && this.params.context && this.params.context.CUENTA.save) {
      this.params.context.CUENTA.save(this.providerId, this.cuentaRowData, 'CUENTA');
      this.hasCuentaChanges = false;
    }
  }

  deleteSelectedCuenta() {
    if (!this.selectedCuenta) return;
    if (this.params && this.params.context && this.params.context.CUENTA.delete) {
      this.params.context.CUENTA.delete({ data: this.selectedCuenta, api: this.cuentaGridApi }, () => {
        this.loadCuentaData();
        this.selectedCuenta = null;
      });
    }
  }

}