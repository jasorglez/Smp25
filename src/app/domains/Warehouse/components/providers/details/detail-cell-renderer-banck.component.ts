import { Component ,inject} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { AuthService } from 'app/services/auth.service';
import { AdministrationService } from 'app/services/administration.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';

@Component({
  selector: 'app-detail-cell-renderer-banck',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div 
      style="padding: 10px; background-color: #f8f9fa; height: 100%; display: flex; flex-direction: column;">
      <!-- Grid de Banckos -->
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Bancos de: {{ providerName }}</strong>
          <div>
            <button 
              class="btn btn-sm btn-success me-2" 
              (click)="addBank()"
              [disabled]="!bankGridApi"
              *ngIf="authService.getCrudPermission('shoppingDelison', 'providers', 'create')">
              <i class="bi bi-plus-circle"></i> Agregar
            </button>
            <button 
              class="btn btn-sm btn-primary me-2" 
              (click)="saveBanks()"
              [disabled]="!hasBankChanges"
              *ngIf="authService.getCrudPermission('shoppingDelison', 'providers', 'create') || authService.getCrudPermission('shoppingDelison', 'providers', 'update')">
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              (click)="deleteSelectedBank()"
              [disabled]="!selectedBank"
              *ngIf="authService.getCrudPermission('shoppingDelison', 'providers', 'delete')">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="bankColumnDefs"
          [rowData]="bankRowData"
          [gridOptions]="bankGridOptions"
          (gridReady)="onBankGridReady($event)"
          (cellValueChanged)="onBankCellValueChanged($event)"
          [components]="components">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererComponentBanck implements ICellRendererAngularComp {
  private administrationService = inject(AdministrationService);
  params: any;
  providerId: number;
  providerName: string;
  authService = inject(AuthService);
  
  bankRowData: any[] = [];
  hasBankChanges: boolean = false;
  bankGridApi: any;
  selectedBank: any = null;
  banks: any[] = [];
  
  bankGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  components = {
    autocompleteEditor: AutocompleteEditorComponent,
  };

  bankColumnDefs = [
     {
       field: 'vigente', //seran chechbox
       headerName: 'Activo',
       editable: true,      
       width: 98
    },
    { field: 'campo2', headerName: 'Nombre Titular', editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        }, width: 190 },
    { field: 'campo3', 
      headerName: 'Banco', 
      editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
      suppressMovable: true,
          filter: true,
          filterParams: {
            // can be 'windows' or 'mac'
            defaultToNothingSelected: true,
            //excelMode: 'mac',
          },
          width: 200,
          cellEditor: 'autocompleteEditor',
          cellEditorParams: (params) => {
            return {
              filterList: this.banks ? this.banks.map((b) => b.name) : [],
              placeholder: 'Buscar banco...',
              minLength: 1
            };
          },
          // valueSetter se asegura de que el valor seleccionado (el nombre) se guarde en el campo 'campo3'
          valueSetter: (params) => {
            params.data.campo3 = params.newValue;
            return true;
          }
    },
    { field: 'campo4', headerName: 'Numero Cuenta', editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },width: 190 },
    
    { field: 'campo5', headerName: 'Clabe', editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },width: 190 
    },
    
    {
      field: 'campo6',
      headerName: 'Comentario',
      editable: true,
      width: 250
    },
    
    {
      field: 'vigente', //seran chechbox
      headerName: 'Principal', 
      editable: true,      
      width: 98
    },
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerId = params.data.id;
    this.providerName = params.data.company || params.data.nameContact;
    this.getBanks();
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
  getBanks() {
    this.administrationService.get2fieldsBanks().subscribe(
      (data: any) => {
        this.banks = [{ idBank: '', name: 'EFECTIVO' }, ...data];
      },      
      (error) => {
        if (error.status == 404) this.banks = [];
        console.error('Error fetching data:', error);
      }
    );
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