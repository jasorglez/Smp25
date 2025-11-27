import { Component ,inject} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-detalles-cuentas',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div 
       style="padding: 10px; background-color: #f8f9fa; height: 100%; display: flex; flex-direction: column;"
      (mouseenter)="params.onMouseEnter && params.onMouseEnter()"
      (mouseleave)="params.onMouseLeave && params.onMouseLeave()">
      <!-- Grid de Banckos -->
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
           <strong>Detalles de cuentas: {{ providerName }}</strong>
          <!--<div>
            <button 
              class="btn btn-sm btn-success me-2" 
              (click)="addDetallesCuentas()"
              [disabled]="!DetallesCuentasGridApi">
              <i class="bi bi-plus-circle"></i> Agregar
            </button>
            <button 
              class="btn btn-sm btn-primary me-2" 
              (click)="saveDetallesCuentass()"
              [disabled]="!hasDetallesCuentasChanges">
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              (click)="deleteSelectedDetallesCuentas()"
              [disabled]="!selectedDetallesCuentas">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>-->
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="DetallesCuentasColumnDefs"
          [rowData]="DetallesCuentasRowData"
          [gridOptions]="DetallesCuentasGridOptions"
          (gridReady)="onDetallesCuentasGridReady($event)"
          (cellValueChanged)="onDetallesCuentasCellValueChanged($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetallesComponentCuentas implements ICellRendererAngularComp {

  params: any;
  providerId: number;
  providerName: string;
  gridHeight: string = '90vh';
  DetallesCuentasRowData: any[] = [];
  hasDetallesCuentasChanges: boolean = false;
  DetallesCuentasGridApi: any;
  selectedDetallesCuentas: any = null;
  
  DetallesCuentasGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  DetallesCuentasColumnDefs = [
    { field: 'campo2', headerName: 'Articulo', editable: true, flex: 1 },
    { field: 'campo3', headerName: 'Categoria', editable: true, flex: 1 },
    { field: 'campo4', headerName: 'Familia', editable: true, flex: 1 },
    { field: 'campo5', headerName: 'SubFamilia', editable: true, flex: 1 },
    { field: 'campo1', headerName: 'Cantidad', editable: true, width: 100 },
    {
      field: 'campo7',
      headerName: 'Precio unitario',
      editable: true,
      width: 120,
      valueFormatter: params => `$${Number(params.value || 0).toFixed(2)}`
    },
    {
      field: 'campo6',
      headerName: 'Total por nota',
      editable: true,
      width: 140,
      valueFormatter: params => `$${Number(params.value || 0).toFixed(2)}`
    },
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    // El ID ahora viene del 'id' de la fila de la cuenta, no del proveedor principal
    this.providerId = params.data.id; 
    this.providerName = params.data.company || params.data.nameContact;
    this.loadDetallesCuentasData();
  }

  refresh(): boolean {
    return false;
  }

  onDetallesCuentasGridReady(params: any) {
    this.DetallesCuentasGridApi = params.api;
    
    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedDetallesCuentas = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onDetallesCuentasCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasDetallesCuentasChanges = true;
  }

  loadDetallesCuentasData() {
    // Usamos el contexto que pasamos desde el componente padre (DetailCellRendererComponentCuentas)
    if (this.params && this.params.context.CUENTA && this.params.context.CUENTA.load) {
      this.params.context.CUENTA.load(this.providerId, 'SUB_CUENTA', (data: any) => {
        this.DetallesCuentasRowData = data;
      });
    }
  }

  addDetallesCuentas() {
    const newDetallesCuentas = {
      id: `temp_DetallesCuentas_${Date.now()}`,
      idTabla: this.providerId,
      type: 'SUB_CUENTA',
      __isNew: true
    };
    this.DetallesCuentasRowData = [newDetallesCuentas, ...this.DetallesCuentasRowData];
    this.hasDetallesCuentasChanges = true;

    setTimeout(() => {
      this.DetallesCuentasGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'campo2'
      });
    }, 100);
  }

  saveDetallesCuentass() {
    if (this.params && this.params.context.CUENTA && this.params.context.CUENTA.save) {
      this.params.context.CUENTA.save(this.providerId, this.DetallesCuentasRowData, 'SUB_CUENTA');
      this.hasDetallesCuentasChanges = false;
    }
  }

  deleteSelectedDetallesCuentas() {
    if (!this.selectedDetallesCuentas) {
      return;
    }

    if (this.params && this.params.context.CUENTA && this.params.context.CUENTA.delete) {
      this.params.context.CUENTA.delete(
        { data: this.selectedDetallesCuentas, api: this.DetallesCuentasGridApi }, 
        () => {
          this.loadDetallesCuentasData();
          this.selectedDetallesCuentas = null;
        }
      );
    }
  }

}