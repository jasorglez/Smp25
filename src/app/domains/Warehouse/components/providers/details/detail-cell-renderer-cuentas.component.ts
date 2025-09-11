import { Component ,inject} from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-detail-cell-renderer-cuentas',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div style="padding: 10px; background-color: #f8f9fa;"
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
              [disabled]="!CuentaGridApi">
              <i class="bi bi-person-plus"></i> Agregar
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
          [columnDefs]="CuentaColumnDefs"
          [rowData]="CuentaRowData"
          [gridOptions]="CuentaGridOptions"
          (gridReady)="onCuentaGridReady($event)"
          (cellValueChanged)="onCuentaCellValueChanged($event)"
          [components]="components">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererComponentCuentas implements ICellRendererAngularComp {
 private signalsService = inject(SignalsService);

  params: any;
  providerId: number;
  providerName: string;
  
  // Cuenta grid properties
  CuentaRowData: any[] = [];
  hasCuentaChanges: boolean = false;
  CuentaGridApi: any;
  selectedCuenta: any = null;
  
  CuentaGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  CuentaColumnDefs = [
    {
      field: 'campo2',
      headerName: 'Nombre',
      editable: true,
      width: 150,
      flex: 1
    },
    {
      field: 'campo3', 
      headerName: 'Puesto',
      editable: true,
      width: 120,
      flex: 1
    },
    {
      field: 'campo4',
      headerName: 'Teléfono', 
      editable: true,
      width: 100
    },
    {
      field: 'campo5',
      headerName: 'Email',
      editable: true,
      width: 140,
      flex: 1
    },
    {
      field: 'campo7',
      headerName: 'Activo',
      editable: true,
      width: 60,
      cellEditor: 'agCheckboxCellEditor'
    },
  ];

  components = {};

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerId = params.data.id;
    this.providerName = params.data.company || params.data.nameCuenta;
    
    // Cargar datos del grid de Cuentaos
    this.loadCuentaData();
  }

  refresh(): boolean {
    return false;
  }

  // ========== Cuenta GRID METHODS ==========
  onCuentaGridReady(params: any) {
    this.CuentaGridApi = params.api;
    params.api.sizeColumnsToFit();
    
    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedCuenta = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onCuentaCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasCuentaChanges = true;
  }

  loadCuentaData() {
    if (this.params && this.params.context && this.params.context.CUENTA && this.params.context.CUENTA.load) {
      this.params.context.CUENTA.load(this.providerId, 'CUENTA', (data: any) => {
        this.CuentaRowData = data;
      });
    }
  }

  addCuenta() {
    if (!this.CuentaGridApi) {
      console.error('Cuenta grid API not ready');
      return;
    }

    const tempId = `temp_Cuenta_${Date.now()}`;
    const newCuenta = {
      id: tempId,
      idTabla: this.providerId,
      campo1: 0,
      campo2: '',
      campo3: '',
      campo4: '',
      campo5: '',
      campo6: 'NA',
      campo7: true, // Asumo que campo7 es 'activo'
      type: 'CUENTA',
      active: true,
      __isNew: true
    };

    this.CuentaRowData = [newCuenta, ...this.CuentaRowData];
    this.CuentaGridApi.setRowData(this.CuentaRowData);
    this.hasCuentaChanges = true;

    setTimeout(() => {
      this.CuentaGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'campo2'
      });
    }, 100);
  }

  saveCuentas() {
    if (this.params && this.params.context && this.params.context.CUENTA && this.params.context.CUENTA.save) {
      this.params.context.CUENTA.save(this.providerId, this.CuentaRowData, 'CUENTA');
      this.hasCuentaChanges = false;
      this.signalsService.triggerRefreshEmployees();
    }
  }

  deleteSelectedCuenta() {
    if (!this.selectedCuenta || !this.params.context.CUENTA.delete) {
      return;
    }

    if (this.params && this.params.context && this.params.context.CUENTA && this.params.context.CUENTA.delete) {
      this.params.context.CUENTA.delete(
        { data: this.selectedCuenta, api: this.CuentaGridApi }, 
        () => {
          this.loadCuentaData();
          this.selectedCuenta = null;
          this.signalsService.triggerRefreshEmployees();
        }
      );
    }
  }

}