import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-detail-cell-renderer-subfamilia',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div
      style="padding: 10px; background-color: #fff3e0; height: 100%; display: flex; flex-direction: column;">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Subfamilias de: {{ materialName }}</strong>
          <div class="d-flex gap-2">
            <button
              class="btn btn-sm btn-success me-2"
              (click)="addSubfamilia()">
              <i class="bi bi-plus-lg"></i> Agregar
            </button>
            <button
              class="btn btn-sm btn-primary me-2 position-relative"
              (click)="saveSubfamilias()">
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button
              class="btn btn-sm btn-warning me-2"
              (click)="revertChanges()">
              <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button
              class="btn btn-sm btn-danger"
              (click)="deleteSelectedSubfamilia()"
              [disabled]="!selectedSubfamilia">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="subfamiliaColumnDefs"
          [rowData]="subfamiliaRowData"
          [gridOptions]="subfamiliaGridOptions"
          (gridReady)="onSubfamiliaGridReady($event)"
          (cellValueChanged)="onSubfamiliaCellValueChanged($event)"
          (selectionChanged)="onSubfamiliaSelectionChanged($event)">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererSubfamiliaComponent implements ICellRendererAngularComp {

  params: any;
  materialId: number;
  materialName: string;
  subfamiliaRowData: any[] = [];
  subfamiliaGridApi: any;
  selectedSubfamilia: any = null;

  // Data falsa para presentaciones (combo box)
  presentaciones: string[] = [
    'Presentación 1',
    'Presentación 2',
    'Presentación 3',
    'Presentación 4'
  ];

  subfamiliaGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowSelection: 'single'
  };

  subfamiliaColumnDefs = [
    {
      field: 'subfamilia',
      headerName: 'Subfamilia',
      editable: true,
      width: 250,
      flex: 1
    },
    {
      field: 'sabor',
      headerName: 'Sabor',
      editable: true,
      width: 200,
      flex: 1
    },
    {
      field: 'presentacion',
      headerName: 'Presentación',
      editable: true,
      width: 200,
      flex: 1,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: this.presentaciones
      }
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.materialId = params.data.id;
    this.materialName = params.data.articulo || params.data.insumo;

    // Cargar data falsa (4 registros)
    this.loadFakeData();
  }

  refresh(): boolean {
    return false;
  }

  loadFakeData() {
    // Data falsa con 4 registros
    this.subfamiliaRowData = [
      {
        id: 1,
        subfamilia: 'Subfamilia 1',
        sabor: 'Sabor A',
        presentacion: 'Presentación 1'
      },
      {
        id: 2,
        subfamilia: 'Subfamilia 2',
        sabor: 'Sabor B',
        presentacion: 'Presentación 2'
      },
      {
        id: 3,
        subfamilia: 'Subfamilia 3',
        sabor: 'Sabor C',
        presentacion: 'Presentación 3'
      },
      {
        id: 4,
        subfamilia: 'Subfamilia 4',
        sabor: 'Sabor D',
        presentacion: 'Presentación 4'
      }
    ];
  }

  onSubfamiliaGridReady(params: any) {
    this.subfamiliaGridApi = params.api;
    params.api.sizeColumnsToFit();

    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedSubfamilia = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onSubfamiliaCellValueChanged(event: any) {
    event.data.__modified = true;
    console.log('Subfamilia modificada:', event.data);
  }

  onSubfamiliaSelectionChanged(event: any): void {
    const selectedRows = event.api.getSelectedRows();
    this.selectedSubfamilia = selectedRows.length > 0 ? selectedRows[0] : null;
  }

  addSubfamilia(): void {
    if (!this.subfamiliaGridApi) {
      console.error('Subfamilia grid API not ready');
      return;
    }

    const newSubfamilia = {
      id: `temp_${Date.now()}`,
      subfamilia: '',
      sabor: '',
      presentacion: '',
      __isNew: true
    };

    this.subfamiliaRowData = [newSubfamilia, ...this.subfamiliaRowData];

    setTimeout(() => {
      this.subfamiliaGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'subfamilia'
      });
    }, 100);
  }

  saveSubfamilias() {
    console.log('Guardando subfamilias:', this.subfamiliaRowData);
    // Aquí iría la lógica de guardado real
  }

  revertChanges() {
    this.loadFakeData();
    this.selectedSubfamilia = null;
  }

  deleteSelectedSubfamilia(): void {
    if (!this.selectedSubfamilia) {
      return;
    }

    console.log('Eliminando subfamilia:', this.selectedSubfamilia);
    this.subfamiliaRowData = this.subfamiliaRowData.filter(
      item => item.id !== this.selectedSubfamilia.id
    );
    this.selectedSubfamilia = null;
  }
}
