import { Component } from '@angular/core';
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
      style="padding: 10px; background-color: #f8f9fa;"
      (mouseenter)="params.onMouseEnter && params.onMouseEnter()"
      (mouseleave)="params.onMouseLeave && params.onMouseLeave()">
      <!-- Grid de Banckos -->
      <div style="margin-bottom: 15px; height: 250px;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Bancos de: {{ providerName }}</strong>
          <div>
            <button 
              class="btn btn-sm btn-success me-2" 
              (click)="addBanck()"
              [disabled]="!BanckGridApi">
              <i class="bi bi-person-plus"></i> Agregar
            </button>
            <button 
              class="btn btn-sm btn-primary me-2" 
              (click)="saveBancks()"
              [disabled]="!hasBanckChanges">
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              (click)="deleteSelectedBanck()"
              [disabled]="!selectedBanck">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="height: 100%; width: 100%;"
          [columnDefs]="BanckColumnDefs"
          [rowData]="BanckRowData"
          [gridOptions]="BanckGridOptions"
          (gridReady)="onBanckGridReady($event)"
          (cellValueChanged)="onBanckCellValueChanged($event)"
          [components]="components">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererComponentBanck implements ICellRendererAngularComp {
  params: any;
  providerId: number;
  providerName: string;
  
  // Banck grid properties
  BanckRowData: any[] = [];
  hasBanckChanges: boolean = false;
  BanckGridApi: any;
  selectedBanck: any = null;
  
  BanckGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single'
  };

  BanckColumnDefs = [
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
    this.providerName = params.data.company || params.data.nameBanck;
    
    // Cargar datos del grid de Banckos
    this.loadBanckData();
  }

  refresh(): boolean {
    return false;
  }

  // ========== Banck GRID METHODS ==========
  onBanckGridReady(params: any) {
    this.BanckGridApi = params.api;
    params.api.sizeColumnsToFit();
    
    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedBanck = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onBanckCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasBanckChanges = true;
  }

  loadBanckData() {
    if (this.params && this.params.context.BANK && this.params.context.BANK.load) {
      this.params.context.BANK.load(this.providerId, 'BANK', (data: any) => {
        this.BanckRowData = data;
      });
    }
  }

  addBanck() {
    if (!this.BanckGridApi) {
      console.error('Banck grid API not ready');
      return;
    }

    const tempId = `temp_Banck_${Date.now()}`;
    const newBanck = {
      id: tempId,
      idTabla: this.providerId,
      campo1: 0,
      campo2: '',
      campo3: '',
      campo4: '',
      campo5: '',
      campo6: 'NA',
      campo7: true,
      type: 'BANK',
      active: true,
      __isNew: true
    };

    this.BanckRowData = [newBanck, ...this.BanckRowData];
    this.BanckGridApi.setRowData(this.BanckRowData);
    this.hasBanckChanges = true;

    setTimeout(() => {
      this.BanckGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'campo2'
      });
    }, 100);
  }

  saveBancks() {
    if (this.params && this.params.context.BANK && this.params.context.BANK.save) {
      this.params.context.BANK.save(this.providerId, this.BanckRowData, 'BANK');
      this.hasBanckChanges = false;
    }
  }

  deleteSelectedBanck() {
    if (!this.selectedBanck) {
      return;
    }

    if (this.params && this.params.context.BANK && this.params.context.BANK.delete) {
      this.params.context.BANK.delete(
        { data: this.selectedBanck, api: this.BanckGridApi }, 
        () => {
          this.loadBanckData();
          this.selectedBanck = null;
        }
      );
    }
  }

}