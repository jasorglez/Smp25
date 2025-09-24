import { Component ,inject} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-detail-cell-renderer-banck',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div 
      style="padding: 10px; background-color: #f8f9fa;">
      <!-- Grid de Banckos -->
      <div style="margin-bottom: 15px; height: 250px;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Bancos de: {{ providerName }}</strong>
          <div>
            <button 
              class="btn btn-sm btn-success me-2" 
              (click)="addBank()"
              [disabled]="!bankGridApi">
              <i class="bi bi-plus-circle"></i> Agregar
            </button>
            <button 
              class="btn btn-sm btn-primary me-2" 
              (click)="saveBanks()"
              [disabled]="!hasBankChanges">
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              (click)="deleteSelectedBank()"
              [disabled]="!selectedBank">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="height: 100%; width: 100%;"
          [columnDefs]="bankColumnDefs"
          [rowData]="bankRowData"
          [gridOptions]="bankGridOptions"
          (gridReady)="onBankGridReady($event)"
          (cellValueChanged)="onBankCellValueChanged($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererComponentBanck implements ICellRendererAngularComp {

  params: any;
  providerId: number;
  providerName: string;
  
  bankRowData: any[] = [];
  hasBankChanges: boolean = false;
  bankGridApi: any;
  selectedBank: any = null;
  
  bankGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  bankColumnDefs = [
    { field: 'campo2', headerName: 'Nombre del Banco', editable: true, flex: 1 },
    { field: 'campo3', headerName: 'Cuenta', editable: true, flex: 1 },
    {
      field: 'campo4',
      headerName: 'Clabe', 
      editable: true,
      width: 100
    },
    {
      field: 'campo6',
      headerName: 'Comentarios',
      editable: true,
      width: 140,
      flex: 1
    },
    {
      field: 'campo5',
      headerName: 'Email',
      editable: true,
      width: 140
    },
    {
      field: 'campo7',
      headerName: 'Activo',
      editable: true,
      width: 60,
      cellEditor: 'agCheckboxCellEditor'
    },
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerId = params.data.id;
    this.providerName = params.data.company || params.data.nameContact;
    
    this.loadBankData();
  }

  refresh(): boolean {
    return false;
  }

  onBankGridReady(params: any) {
    this.bankGridApi = params.api;
    
    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedBank = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onBankCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasBankChanges = true;
  }

  loadBankData() {
    if (this.params && this.params.context.BANK && this.params.context.BANK.load) {
      this.params.context.BANK.load(this.providerId, 'BANK', (data: any) => {
        this.bankRowData = data;
      });
    }
  }

  addBank() {
    const newBank = {
      id: `temp_bank_${Date.now()}`,
      idTabla: this.providerId,
      type: 'BANK',
      __isNew: true
    };
    this.bankRowData = [newBank, ...this.bankRowData];
    this.hasBankChanges = true;

    setTimeout(() => {
      this.bankGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'campo2'
      });
    }, 100);
  }

  saveBanks() {
    if (this.params && this.params.context.BANK && this.params.context.BANK.save) {
      this.params.context.BANK.save(this.providerId, this.bankRowData, 'BANK');
      this.hasBankChanges = false;
    }
  }

  deleteSelectedBank() {
    if (!this.selectedBank) {
      return;
    }

    if (this.params && this.params.context.BANK && this.params.context.BANK.delete) {
      this.params.context.BANK.delete(
        { data: this.selectedBank, api: this.bankGridApi }, 
        () => {
          this.loadBankData();
          this.selectedBank = null;
        }
      );
    }
  }

}