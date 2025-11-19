import { Component, inject } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-detail-cell-renderer-parametros',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div
      style="padding: 10px; background-color: #e9ecef; height: 100%; display: flex; flex-direction: column;"
      (mouseenter)="params.onMouseEnter && params.onMouseEnter()"
      (mouseleave)="params.onMouseLeave && params.onMouseLeave()">
      <!-- Grid de Parámetros -->
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Parámetros de: {{ materialName }}</strong>
          <div>
            <button
              class="btn btn-sm btn-success me-2"
              (click)="addParametro()"
              [disabled]="!parametrosGridApi"
            >
              <i class="bi bi-plus-circle"></i> Agregar
            </button>
            <button
              class="btn btn-sm btn-primary me-2"
              (click)="saveParametros()"
              [disabled]="!hasParametrosChanges"
            >
              <i class="bi bi-floppy"></i> Guardar
            </button>
            <button
              class="btn btn-sm btn-warning me-2"
              (click)="refreshParametros()"
            >
              <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button
              class="btn btn-sm btn-danger"
              (click)="deleteSelectedParametro()"
              [disabled]="!selectedParametro"
            >
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="parametrosColumnDefs"
          [rowData]="parametrosRowData"
          [gridOptions]="parametrosGridOptions"
          (gridReady)="onParametrosGridReady($event)"
          (cellValueChanged)="onParametrosCellValueChanged($event)"
          [components]="components">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererParametrosComponent implements ICellRendererAngularComp {

  params: any;
  materialId: number;
  materialName: string;

  // Parámetros grid properties
  parametrosRowData: any[] = [];
  hasParametrosChanges: boolean = false;
  parametrosGridApi: any;
  selectedParametro: any = null;

  parametrosGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    onFirstDataRendered: (params) => {
      console.log('onFirstDataRendered - autosizing columns...');

      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });

      console.log('Columns to autosize:', allColumnIds);
      params.api.autoSizeColumns(allColumnIds, false);
      console.log('Autosize completed');
    }
  };

  parametrosColumnDefs = [
    {
      field: 'parametro',
      headerName: 'Parámetros',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['BRIX', 'PH', 'OH']
      },
      width: 120,
      valueSetter: (params) => {
        const value = params.newValue;
        if (!value || typeof value !== 'string') {
          alerts.basicAlert('Campo requerido', 'El parámetro es obligatorio', 'error');
          return false;
        }
        params.data[params.colDef.field] = value;
        return true;
      }
    },
    {
      field: 'minimo',
      headerName: 'Mínimo',
      editable: true,
      cellEditor: 'agNumberCellEditor',
      width: 100,
      valueSetter: (params) => {
        const value = params.newValue;
        if (value === null || value === undefined || value === '') {
          alerts.basicAlert('Campo requerido', 'El mínimo es obligatorio', 'error');
          return false;
        }
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          alerts.basicAlert('Valor inválido', 'El mínimo debe ser un número', 'error');
          return false;
        }
        params.data[params.colDef.field] = numValue;
        return true;
      }
    },
    {
      field: 'objetivo',
      headerName: 'Objetivo',
      editable: true,
      cellEditor: 'agNumberCellEditor',
      width: 100,
      valueSetter: (params) => {
        const value = params.newValue;
        if (value === null || value === undefined || value === '') {
          alerts.basicAlert('Campo requerido', 'El objetivo es obligatorio', 'error');
          return false;
        }
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          alerts.basicAlert('Valor inválido', 'El objetivo debe ser un número', 'error');
          return false;
        }
        params.data[params.colDef.field] = numValue;
        return true;
      }
    },
    {
      field: 'maximo',
      headerName: 'Máximo',
      editable: true,
      cellEditor: 'agNumberCellEditor',
      width: 100,
      valueSetter: (params) => {
        const value = params.newValue;
        if (value === null || value === undefined || value === '') {
          alerts.basicAlert('Campo requerido', 'El máximo es obligatorio', 'error');
          return false;
        }
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          alerts.basicAlert('Valor inválido', 'El máximo debe ser un número', 'error');
          return false;
        }
        params.data[params.colDef.field] = numValue;
        return true;
      }
    },
    {
      field: 'activo',
      headerName: 'Activo',
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor',
      editable: true,
      width: 80
    }
  ];

  components = {};

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.materialId = params.data.id;
    this.materialName = params.data.articulo || params.data.insumo;

    // Load fake data for parámetros
    this.loadParametrosData();
  }

  refresh(): boolean {
    return false;
  }

  // ========== PARÁMETROS GRID METHODS ==========
  onParametrosGridReady(params: any) {
    this.parametrosGridApi = params.api;
    params.api.sizeColumnsToFit();

    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedParametro = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onParametrosCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasParametrosChanges = true;
  }

  loadParametrosData() {
    // Generate fake data for parámetros
    const fakeParametros = this.generateFakeParametros();
    this.parametrosRowData = fakeParametros;

    // Refresh grid if exists
    if (this.parametrosGridApi) {
      this.parametrosGridApi.setGridOption('rowData', this.parametrosRowData);
    }
  }

  private generateFakeParametros(): any[] {
    const parametros = ['BRIX', 'PH', 'OH'];
    const parametrosData = [];

    // Generate 2-4 parameters per material
    const count = Math.floor(Math.random() * 3) + 2;

    for (let i = 0; i < count; i++) {
      const parametro = parametros[Math.floor(Math.random() * parametros.length)];

      let minimo, objetivo, maximo;

      if (parametro === 'BRIX') {
        minimo = Math.floor(Math.random() * 5) + 8; // 8-12
        objetivo = Math.floor(Math.random() * 3) + 10; // 10-12
        maximo = Math.floor(Math.random() * 3) + 12; // 12-14
      } else if (parametro === 'PH') {
        minimo = Math.floor(Math.random() * 2) + 3; // 3-4
        objetivo = Math.floor(Math.random() * 2) + 4; // 4-5
        maximo = Math.floor(Math.random() * 2) + 5; // 5-6
      } else if (parametro === 'OH') {
        minimo = Math.floor(Math.random() * 5) + 1; // 1-5
        objetivo = Math.floor(Math.random() * 5) + 3; // 3-7
        maximo = Math.floor(Math.random() * 5) + 6; // 6-10
      }

      parametrosData.push({
        id: `param_${this.materialId}_${i + 1}`,
        idMaterial: this.materialId,
        parametro: parametro,
        minimo: minimo,
        objetivo: objetivo,
        maximo: maximo,
        activo: Math.random() > 0.2, // 80% active
        type: 'PARAMETRO'
      });
    }

    return parametrosData;
  }

  refreshParametros() {
    this.loadParametrosData();
    this.hasParametrosChanges = false;
  }

  addParametro() {
    if (!this.parametrosGridApi) {
      console.error('Parámetros grid API not ready');
      return;
    }

    const tempId = `temp_parametro_${Date.now()}`;
    const newParametro = {
      id: tempId,
      idMaterial: this.materialId,
      parametro: '',
      minimo: 0,
      objetivo: 0,
      maximo: 0,
      activo: true,
      type: 'PARAMETRO',
      __isNew: true
    };

    this.parametrosRowData = [newParametro, ...this.parametrosRowData];
    this.hasParametrosChanges = true;

    // Refresh grid
    if (this.parametrosGridApi) {
      this.parametrosGridApi.setGridOption('rowData', this.parametrosRowData);
    }

    setTimeout(() => {
      this.parametrosGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'parametro'
      });
    }, 100);
  }

  async saveParametros() {
    if (this.params && this.params.context && this.params.context.PARAMETROS && this.params.context.PARAMETROS.save) {
      try {
        await this.params.context.PARAMETROS.save(this.materialId, this.parametrosRowData, 'PARAMETROS');

        await new Promise(resolve => setTimeout(resolve, 500));

        this.hasParametrosChanges = false;

        // Reload data
        this.loadParametrosData();

      } catch (error) {
        console.error('Error saving parámetros:', error);
      }
    }
  }

  deleteSelectedParametro() {
    if (!this.selectedParametro || !this.params.context.PARAMETROS.delete) {
      return;
    }

    if (this.params && this.params.context && this.params.context.PARAMETROS && this.params.context.PARAMETROS.delete) {
      this.params.context.PARAMETROS.delete(
        { data: this.selectedParametro, api: this.parametrosGridApi },
        async () => {
          this.loadParametrosData();
          this.selectedParametro = null;
        }
      );
    }
  }
}