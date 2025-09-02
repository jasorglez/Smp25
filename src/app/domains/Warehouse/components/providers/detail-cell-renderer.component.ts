import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-detail-cell-renderer',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div style="padding: 10px; background-color: #f8f9fa;">
      <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
        <strong>Contactos de: {{ providerName }}</strong>
        <div>
          <button 
            class="btn btn-sm btn-success me-2" 
            (click)="addContact()"
            [disabled]="!detailGridApi">
            <i class="bi bi-person-plus"></i> Agregar
          </button>
          <button 
            class="btn btn-sm btn-primary" 
            (click)="saveContacts()"
            [disabled]="!hasChanges">
            <i class="bi bi-floppy"></i> Guardar
          </button>
        </div>
      </div>
      <ag-grid-angular
        class="ag-theme-quartz"
        style="height: 200px; width: 100%;"
        [columnDefs]="columnDefs"
        [rowData]="rowData"
        (gridReady)="onDetailGridReady($event)"
        (cellValueChanged)="onCellValueChanged($event)"
        [components]="components">
      </ag-grid-angular>
    </div>
  `
})
export class DetailCellRendererComponent implements ICellRendererAngularComp {
  params: any;
  providerId: number;
  providerName: string;
  rowData: any[] = [];
  hasChanges: boolean = false;
  detailGridApi: any;
  
  columnDefs = [
    {
      field: 'campo2',
      headerName: 'Nombre',
      editable: true,
      width: 200
    },
    {
      field: 'campo3', 
      headerName: 'Puesto',
      editable: true,
      width: 150
    },
    {
      field: 'campo4',
      headerName: 'Teléfono', 
      editable: true,
      width: 120
    },
    {
      field: 'campo5',
      headerName: 'Email',
      editable: true,
      width: 180
    },
    {
      field: 'active',
      headerName: 'Activo',
      editable: true,
      width: 80,
      cellEditor: 'agCheckboxCellEditor'
    },
    {
      headerName: 'Acciones',
      width: 100,
      cellRenderer: (params: any) => {
        const button = document.createElement('button');
        button.className = 'btn btn-sm btn-danger';
        button.innerHTML = '<i class="bi bi-trash"></i>';
        button.onclick = () => this.deleteContact(params);
        return button;
      },
      editable: false
    }
  ];

  components = {};

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerId = params.data.id;
    this.providerName = params.data.company || params.data.nameContact;
    
    // Cargar datos del detalle
    this.loadContactData();
  }

  refresh(): boolean {
    return false;
  }

  onDetailGridReady(params: any) {
    this.detailGridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasChanges = true;
  }

  loadContactData() {
    // Esta función será llamada por el componente padre
    if (this.params && this.params.context && this.params.context.loadProviderContacts) {
      this.params.context.loadProviderContacts(this.providerId, (data: any) => {
        this.rowData = data;
      });
    }
  }

  addContact() {
    const tempId = `temp_detail_${Date.now()}`;
    const newContact = {
      id: tempId,
      idTabla: this.providerId,
      campo1: 0,
      campo2: '',
      campo3: '',
      campo4: '',
      campo5: '',
      campo6: 'NA',
      campo7: false,
      type: this.params.context?.type || 'PROVIDERS',
      active: true,
      __isNew: true
    };

    this.rowData = [newContact, ...this.rowData];
    this.detailGridApi.setRowData(this.rowData);
    this.hasChanges = true;

    setTimeout(() => {
      this.detailGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'campo2'
      });
    }, 100);
  }

  saveContacts() {
    if (this.params && this.params.context && this.params.context.saveProviderContacts) {
      this.params.context.saveProviderContacts(this.providerId, this.rowData);
      this.hasChanges = false;
    }
  }

  deleteContact(params: any) {
    if (this.params && this.params.context && this.params.context.deleteProviderContact) {
      this.params.context.deleteProviderContact(params, () => {
        this.loadContactData();
      });
    }
  }
}