import { Component ,inject} from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { AuthService } from 'app/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-detail-cell-renderer-contact',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `<!-- MEJORA: Añadir listeners para evitar que el panel se cierre al pasar el mouse sobre él -->
    <div 
      style="padding: 10px; background-color: #e9ecef; height: 100%; display: flex; flex-direction: column;"
      (mouseenter)="params.onMouseEnter && params.onMouseEnter()"
      (mouseleave)="params.onMouseLeave && params.onMouseLeave()">
      <!-- Grid de Contactos -->
     <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Contactos de: {{ providerName }}</strong>
          <div>
            <button 
              class="btn btn-sm btn-success me-2" 
              (click)="addContact()"
              [disabled]="!contactGridApi"
              *ngIf="authService.getCrudPermission('shoppingDelison', 'providers', 'create')">
              <i class="bi bi-person-plus"></i> Agregar
            </button>
            <button 
              class="btn btn-sm btn-primary me-2" 
              (click)="saveContacts()"
              [disabled]="!hasContactChanges"
              *ngIf="authService.getCrudPermission('shoppingDelison', 'providers', 'create') || authService.getCrudPermission('shoppingDelison', 'providers', 'update')">
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              (click)="deleteSelectedContact()"
              [disabled]="!selectedContact" 
              *ngIf="authService.getCrudPermission('shoppingDelison', 'providers', 'delete')">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
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
export class DetailCellRendererComponentContact implements ICellRendererAngularComp {
   private signalsService = inject(SignalsService);
   authService = inject(AuthService);

  params: any;
  providerId: number;
  providerName: string;
  
  // Contact grid properties
  contactRowData: any[] = [];
  hasContactChanges: boolean = false;
  name: string = '';
  contactGridApi: any;
  selectedContact: any = null;
  
  contactGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    getRowStyle: params => {
      this.providerId
      if(params.data.campo2 === this.name){
        return { backgroundColor: '#ffcccc' };
      }
      return null;
    },
    onFirstDataRendered: (params) => {
      console.log('onFirstDataRendered - autosizing columns...');

      // Obtener todas las columnas
      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });

      console.log('Columns to autosize:', allColumnIds);

      // Autoajustar todas las columnas al contenido (skipHeader=true considera header y datos)
      params.api.autoSizeColumns(allColumnIds, true);

      console.log('Autosize completed');
    }
  };

  contactColumnDefs = [
     {
      field: 'vigente', //seran chechbox
      headerName: 'Activo',
      editable: true,      
      width: 66
    },
    {
      field: 'campo2',
      headerName: 'Nombre Contacto',
      editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
      width: 150,
      flex: 1
    },
    {
      field: 'campo3', 
      headerName: 'Puesto/Area',
      editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
      width: 120,
      flex: 1
    },
    {
      field: 'campo4',
      headerName: 'Teléfono', 
      editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
      width: 100
    },
    {
      field: 'campo5',
      headerName: 'Email',
      editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
      width: 140,
      flex: 1
    },
    {
      field: 'campo6',
      headerName: 'Comentarios',
      editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('shoppingDelison', 'providers', 'update');
        },
      width: 140
    },
     {
      field: 'principal',
      headerName: 'Principal', //seran chechbox
      editable: true,      
      width: 66
    },
  ];

  components = {};

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.providerId = params.data.id;
    this.providerName = params.data.company || params.data.nameContact;
    this.name = params.data.nameContact;

    
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
    if (this.params && this.params.context && this.params.context.CONTACT && this.params.context.CONTACT.load) {
      this.params.context.CONTACT.load(this.providerId, 'CONTACT', (data: any) => {
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
    if (this.params && this.params.context && this.params.context.CONTACT && this.params.context.CONTACT.save) {
      this.params.context.CONTACT.save(this.providerId, this.contactRowData, 'CONTACT');
      this.hasContactChanges = false;
      this.signalsService.triggerRefreshEmployees();
    }
  }

  deleteSelectedContact() {
    if (!this.selectedContact || !this.params.context.CONTACT.delete) {
      return;
    }

    if (this.params && this.params.context && this.params.context.CONTACT && this.params.context.CONTACT.delete) {
      this.params.context.CONTACT.delete(
        { data: this.selectedContact, api: this.contactGridApi }, 
        () => {
          this.loadContactData();
          this.selectedContact = null;
          this.signalsService.triggerRefreshEmployees();
        }
      );
    }
  }

}