import { Component ,inject} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { AuthService } from 'app/services/auth.service';
import { AdministrationService } from 'app/services/administration.service';
import { SelectWithTooltipEditorV2Component } from 'app/domains/Almacenes/components/materiales-maestro/editors/select-with-tooltip-editor-v2.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';

@Component({
  selector: 'app-detail-cell-renderer-banck',
  standalone: true,
  imports: [AgGridModule, CommonModule, SelectWithTooltipEditorV2Component],
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
              >
              <i class="bi bi-plus-circle"></i> Agregar
            </button>
            <button 
              class="btn btn-sm btn-primary me-2" 
              (click)="saveBanks()"
              [disabled]="!hasBankChanges"
              >
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button 
              class="btn btn-sm btn-warning me-2" 
              (click)="refresBanks()"
              >
              <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              (click)="deleteSelectedBank()"
              [disabled]="!selectedBank"
              >
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
    //suppressEnterWhenEditing: false,
    rowSelection: 'single',
    onFirstDataRendered: (params) => {
      console.log('onFirstDataRendered - autosizing columns...');

      // Obtener todas las columnas
      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });

      console.log('Columns to autosize:', allColumnIds);

      // Autoajustar todas las columnas al contenido (skipHeader=false incluye header en el cálculo)
      params.api.autoSizeColumns(allColumnIds, false);

      console.log('Autosize completed');
    }
  };

  components = {
    autocompleteEditor: AutocompleteEditorComponent,
    selectWithTooltipEditor: SelectWithTooltipEditorV2Component
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
          return true
        }, width: 190 },
   // ...existing code...
{
  field: 'campo3',
  headerName: 'Banco',
  width: 200,
  editable: (params: any) => true,
  cellEditor: 'selectWithTooltipEditor',
  cellEditorParams: (params: any) => ({
    options: (this.banks || [])
      .filter(b => b.active)
      .map(b => ({ id: b.id, description: b.name }))
  }),

  valueFormatter: (params: any) => {
    // Preferir el nombre guardado en la fila si existe
    if (params?.data?.nombreBanco) return params.data.nombreBanco;
    const bank = this.banks?.find(b => String(b.id) === String(params.value) || b.name === params.value);
    return bank ? bank.name : (params.value ?? '');
  },

  valueSetter: (params: any) => {
    // Depurar temporalmente si hace falta:
    // console.log('campo3 valueSetter newValue=', params.newValue);

    let newValue = params.newValue;

    // Si el editor devuelve un objeto con distintas formas, extraer id/valor y descripción
    if (newValue && typeof newValue === 'object') {
      // cubrir casos comunes: { id, description }, { value, description }, { value }
      const possibleId = newValue.id ?? newValue.value ?? newValue.code ?? null;
      const possibleDesc = newValue.description ?? newValue.label ?? newValue.text ?? null;
      newValue = possibleId ?? possibleDesc ?? newValue;
      // si ahora newValue es object sin id/desc, dejamos como está y se tratará abajo
      if (possibleId || possibleDesc) {
        // reemplazar newValue por id si existe, si no por la descripción
        newValue = possibleId ?? possibleDesc;
      }
    }

    // Buscar banco por id o por nombre
    const selectedBank = this.banks?.find(b => String(b.id) === String(newValue) || b.name === newValue);

    // Guardar siempre campo3 (id o el valor elegido) y nombre legible en nombreBanco
    params.data.campo3 = selectedBank ? selectedBank.id : newValue;
    params.data.nombreBanco = selectedBank ? selectedBank.name : (typeof newValue === 'string' ? newValue : '');

    return true;
  },

  cellStyle: (params: any) => {
    if (!params.value && !params?.data?.nombreBanco) {
      return { backgroundColor: '#f9f9f9', color: '#777' };
    }
    return null;
  },
  suppressMovable: true,
  filter: true,
  filterParams: {
    defaultToNothingSelected: true
  }
},
// ...existing code...
    { field: 'campo4', headerName: 'Numero Cuenta', editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },width: 190 },
    
    { field: 'campo5', headerName: 'Clabe', editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
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
        console.log(data)
      });
    }
  }

  refresBanks(){
    this.loadBankData();
  }
  getBanks() {
    this.administrationService.get2fieldsBanks().subscribe(
      (data: any) => {
        // Normalizar la estructura recibida para evitar mismatch de propiedades
        const normalized = (data || []).map((b: any) => ({
          id: b.id ?? b.idBank ?? b.ID ?? b.value ?? '',
          name: b.name ?? b.nombre ?? b.descripcion ?? b.text ?? String(b.id ?? b.idBank ?? ''),
          active: (b.active ?? b.vigente ?? true) // trata distintos nombres posibles
        }));
        this.banks = [{ id: '', name: 'EFECTIVO', active: true }, ...normalized];
        console.log(this.banks);
      },
      (error) => {
        if (error.status == 404) this.banks = [{ id: '', name: 'EFECTIVO', active: true }];
        console.error('Error fetching data:', error);
      }
    );
  }

  addBank() {
    const newBank = {
      id: `temp_bank_${Date.now()}`,
      idTabla: this.providerId,
      type: 'BANK',
      vigente: true,
      principal: false,
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