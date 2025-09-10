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
      <!-- Grid de Contactos -->
      <div style="margin-bottom: 15px; height: 250px;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Contactos de: {{ providerName }}</strong>
          <div>
            <button 
              class="btn btn-sm btn-success me-2" 
              (click)="addContact()"
              [disabled]="!contactGridApi">
              <i class="bi bi-person-plus"></i> Agregar
            </button>
            <button 
              class="btn btn-sm btn-primary me-2" 
              (click)="saveContacts()"
              [disabled]="!hasContactChanges">
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              (click)="deleteSelectedContact()"
              [disabled]="!selectedContact">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="height: 100%; width: 100%;"
          [columnDefs]="contactColumnDefs"
          [rowData]="contactRowData"
          [gridOptions]="contactGridOptions"
          (gridReady)="onContactGridReady($event)"
          (cellValueChanged)="onContactCellValueChanged($event)"
          [components]="components">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererComponent implements ICellRendererAngularComp {
  params: any;
  providerId: number;
  providerName: string;
  
  // Contact grid properties
  contactRowData: any[] = [];
  hasContactChanges: boolean = false;
  contactGridApi: any;
  selectedContact: any = null;
  
  contactGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  contactColumnDefs = [
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
    this.providerName = params.data.company || params.data.nameContact;
    
    // Cargar datos del grid de contactos
    this.loadContactData();
  }

  refresh(): boolean {
    return false;
  }

  // ========== CONTACT GRID METHODS ==========
  onContactGridReady(params: any) {
    this.contactGridApi = params.api;
    params.api.sizeColumnsToFit();
    
    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedContact = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onContactCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasContactChanges = true;
  }

  loadContactData() {
    if (this.params && this.params.context && this.params.context.loadProviderContacts) {
      this.params.context.loadProviderContacts(this.providerId, (data: any) => {
        this.contactRowData = data;
      });
    }
  }

  addContact() {
    if (!this.contactGridApi) {
      console.error('Contact grid API not ready');
      return;
    }

    const tempId = `temp_contact_${Date.now()}`;
    const newContact = {
      id: tempId,
      idTabla: this.providerId,
      campo1: 0,
      campo2: '',
      campo3: '',
      campo4: '',
      campo5: '',
      campo6: 'NA',
      campo7: true,
      type: 'CONTACT',
      active: true,
      __isNew: true
    };

    this.contactRowData = [newContact, ...this.contactRowData];
    this.contactGridApi.setRowData(this.contactRowData);
    this.hasContactChanges = true;

    setTimeout(() => {
      this.contactGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'campo2'
      });
    }, 100);
  }

  saveContacts() {
    if (this.params && this.params.context && this.params.context.saveProviderContacts) {
      this.params.context.saveProviderContacts(this.providerId, this.contactRowData);
      this.hasContactChanges = false;
    }
  }

  deleteSelectedContact() {
    if (!this.selectedContact) {
      return;
    }

    if (this.params && this.params.context && this.params.context.deleteProviderContact) {
      this.params.context.deleteProviderContact(
        { data: this.selectedContact, api: this.contactGridApi }, 
        () => {
          this.loadContactData();
          this.selectedContact = null;
        }
      );
    }
  }

}