import { Component ,inject} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-detail-cell-renderer-cuentas',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div style="padding: 10px; background-color: #f8f9fa;">
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
          (cellValueChanged)="onCuentaCellValueChanged($event)">
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
  
  cuentaGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  cuentaColumnDefs = [
    { field: 'campo2', headerName: 'Folio', editable: true, flex: 1 },
    { field: 'campo3', headerName: 'Fecha', editable: true, flex: 1, cellEditor: 'agDateCellEditor' },
    { field: 'campo4', headerName: 'Monto', editable: true, flex: 1, valueFormatter: params => `$${Number(params.value || 0).toFixed(2)}` },
    { field: 'campo5', headerName: 'Saldo', editable: true, flex: 1, valueFormatter: params => `$${Number(params.value || 0).toFixed(2)}` },
    { field: 'campo7', headerName: 'Pagada', editable: true, width: 80, cellEditor: 'agCheckboxCellEditor' }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerId = params.data.id;
    this.providerName = params.data.company || params.data.nameContact;
    
    this.loadCuentaData();
  }

  refresh(): boolean {
    return false;
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
    const newCuenta = {
      id: `temp_cuenta_${Date.now()}`,
      idTabla: this.providerId,
      type: 'CUENTA',
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