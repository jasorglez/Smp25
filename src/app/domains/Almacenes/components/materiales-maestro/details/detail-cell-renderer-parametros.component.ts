import { Component, effect, inject, signal } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { alerts } from 'app/helpers/alerts';
import { ColDef, GridApi, GridReadyEvent, ValueGetterParams, ValueSetterParams, IRowNode, ValueFormatterParams } from 'ag-grid-community';
import { ParameterByMaterialDescriptionService } from 'app/services/parameterByMaterialDescription.service';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';

@Component({
  selector: 'app-detail-cell-renderer-parametros',
  standalone: true,
  imports: [AgGridModule, CommonModule, SelectWithTooltipEditorV2Component],
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
  private parameterByMaterialDescriptionService = inject(ParameterByMaterialDescriptionService);
  params: any;
  materialId: number;
  materialName: string;
  parameterVigente: any[] = [];
  parameter: any[] = [];
  private gridApi!: GridApi;
  // Parámetros grid properties
  parametrosRowData: any[] = [];
  hasParametrosChanges: boolean = false;
  parametrosGridApi: any;

  selectedParametro = signal<any>(null);

  parametrosGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
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
   private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  parametrosColumnDefs = [
    {
      field: 'idParameter',
      headerName: 'Parámetros',
      editable: true,
      cellDataType: 'number',
      cellEditor: SelectWithTooltipEditorV2Component,
      cellEditorParams: (params) => {
        return {
          options: this.parameter?.map(f => ({
            id: f.id,
            description: f.description,
            valueAddition: f.valueAddition ?? '',
            valueAddition2: f.valueAddition2 ?? ''
          }))
        };
      },
      valueFormatter: (params) => {
        // Aceptar que el valor pueda ser un objeto (editor devuelve {value,label})
        const raw = params.value;
        const val = (raw && typeof raw === 'object') ? (raw.value ?? raw.id) : raw;
        console.log('Valor en valueFormatter:', val);
        const fam = this.parameterVigente?.find(f => f.id === val);
        // Si no encontramos la familia pero el raw es objeto, mostrar su label como respaldo
        if (fam) return fam.description;
        if (raw && typeof raw === 'object') return raw.label ?? '';
        return '';
      },
    
      valueSetter: (params) => {
        const editorValue = params.newValue;
        // El editor puede devolver: raw id, o un objeto { value, label } o { id, label }
        let value: any = editorValue;
        if (editorValue && typeof editorValue === 'object') {
          value = editorValue.id ?? editorValue.value ?? editorValue;
        }
        if (value === undefined || value === null || value === '') {
          alerts.basicAlert('Campo requerido', 'La subfamilia es obligatoria', 'error');
          return false;
        }
        const duplicateExists = this.parametrosRowData.some((row, i) =>
          i !== params.node.rowIndex && row.idParameter === value
        );
        if (duplicateExists) {
          alerts.basicAlert('Valor duplicado', 'Ya existe esa subfamilia.', 'error');
          return false;
        }
        params.data.idParameter = value;
        const fam = this.parameterVigente.find(f => f.idSubfamily === value);
        params.data.description = fam?.description || (editorValue && editorValue.label) || '';
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
      field: 'vigente',
      headerName: 'Activo',
      cellRenderer: 'agCheckboxCellRenderer',
      cellEditor: 'agCheckboxCellEditor',
      editable: true,
      width: 80
    }
  ];

  components = {};

  agInit(params: any): void {
    this.params = params;
    this.refreshParametros();
    console.log('////////////////DetailCellRendererParametrosComponent initialized with params:', params);
    this.materialId = params.data.id;
    this.materialName = params.data.articulo;
    this.parameterVigentes();
    this.parameters();
    // Load fake data for parámetros
    this.loadParametrosData();
  }
   constructor() {
      effect(() => {
        //this.gridApi.refreshCells({ force: true });
        setTimeout(() => {
        this.parameterVigentes();
        this.parameters();
      }, 1000);
      });
    }
  parameters(){
    this.parameterByMaterialDescriptionService.getParameterVigente(9).subscribe(
      (data: any) => {
        this.parameterVigente = data;
        console.log(data)
      },
      (error) => console.error('Error fetching data:', error)
    );
  }
  parameterVigentes(){
    this.parameterByMaterialDescriptionService.getParameter(9, this.materialId).subscribe(
      (data: any) => {
        this.parameter= data;
        console.log(data)
      },
      (error) => console.error('Error fetching data:', error)
    );
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
      this.selectedParametro.set(selectedNodes.length > 0 ? selectedNodes[0].data : null);
    });
  }

  onParametrosCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasParametrosChanges = true;
  }

  loadParametrosData() {
    return new Promise((resolve) => {
      this.parameterByMaterialDescriptionService.getParameterByMaterialDescription(this.materialId).subscribe(
        (data: any) => {
            this.parametrosRowData = data;
          console.log('Datos obtenidos del servidor:', this.parametrosRowData);

          // Calcular y almacenar los valores calculados para cada fila
        },
        (error) => {
          console.error('Error fetching data:', error);
          resolve(false);
        }
      );
    });
  }

  

  refreshParametros() {
    this.parameterVigentes();
    this.parameters();
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
    idMaster: this.materialId,
    idParameter: null,
    minimo: 0,
    objetivo: 0,
    maximo: 0,
    activo: true,
    vigente: true,
    type: 'PARAMETRO',
    __isNew: true
  };

  // 👇 ESTA ES LA FORMA CORRECTA
  this.parametrosRowData = [newParametro, ...this.parametrosRowData];

  this.hasParametrosChanges = true;

  setTimeout(() => {
    this.parametrosGridApi.startEditingCell({
      rowIndex: 0,
      colKey: 'idParameter'
    });
  }, 100);
}


  async saveParametros() {
    /*
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
    }*/
    const newRows = this.parametrosRowData.filter((row) => row.__isNew);
    const modifiedRows = this.parametrosRowData.filter(
        (row) => row.__modified && !row.__isNew
      );
     
      const addObservables = newRows.map((row) => {
        const cleanedData = this.cleanDataForServer(row);
        return this.parameterByMaterialDescriptionService.addParameterByMaterialDescription(cleanedData);
      });
     
      const updateObservables = modifiedRows.map((row) => {
        const cleanedData = this.cleanDataForServer(row);
        return this.parameterByMaterialDescriptionService.updateParameterByMaterialDescription(row.id, cleanedData);
      });
     
      try {
        await lastValueFrom(
          concat(...addObservables, ...updateObservables).pipe(toArray())
        );
        /*
        // Determinar qué ID vamos a seleccionar después de recargar
        if (modifiedRows.length > 0) {
          // Si hay filas modificadas, guardamos el ID de la última modificada
          this.lastEditedRowId = modifiedRows[modifiedRows.length - 1].id;
        } else if (newRows.length > 0) {
          // Si hay filas nuevas, marcaremos que necesitamos seleccionar el ID máximo
          this.lastEditedRowId = 'SELECT_MAX_ID';
        }
        */
        alerts.basicAlert(
          'Datos actualizados',
          'Se han actualizado los datos correctamente.',
          'success'
        ); 
         this.refreshParametros() // Esperar a que se actualicen los datos
        /*
        // Seleccionar la fila apropiada después de recargar
        if (this.lastEditedRowId) {
          if (this.lastEditedRowId === 'SELECT_MAX_ID') {
            // Encontrar el ID máximo en los datos actuales
            const maxId = Math.max(...this.rowData.map((row) => Number(row.id)));
            this.selectRowById(maxId);
          } else {
            this.selectRowById(this.lastEditedRowId);
          }
          this.lastEditedRowId = null; // Resetear el ID
        }*/
      } catch (error) {
        console.error(error);
        alerts.basicAlert(
          'Error',
          'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
          'error'
        );
      }
  }

  deleteSelectedParametro() {
    if (!this.parametrosGridApi) {
      alerts.basicAlert('Error', 'Grid no inicializado.', 'error');
      return;
    }

    const selected = this.selectedParametro();
    if (!selected) {
      alerts.basicAlert(
        'Eliminar parámetro',
        'Por favor, seleccione un parámetro para eliminar.',
        'error'
      );
      return;
    }

    // Confirmación antes de eliminar
    alerts
      .confirmAlert(
        'Eliminar parámetro',
        '¿Está seguro que desea eliminar este parámetro?',
        'warning',
        'Sí, eliminar'
      )
      .then((result) => {
        if (!result.isConfirmed) return;

        // Determinar el id real
        const realId = selected.id ?? null;

        // Si la fila es nueva (no guardada en servidor) o no tiene id, la eliminamos localmente
        if (selected.__isNew || !realId) {
          this.parametrosGridApi.applyTransaction({ remove: [selected] });
          // Mantener parametrosRowData sincronizado
          this.parametrosRowData = this.parametrosRowData.filter((r) => r !== selected);
          this.selectedParametro.set(null);
          alerts.basicAlert('Parámetro eliminado', 'El parámetro se eliminó localmente.', 'success');
          return;
        }

        // Si la fila existe en servidor, llamamos al servicio para eliminarla
        this.parameterByMaterialDescriptionService
          .deleteParameterByMaterialDescription(realId)
          .pipe(
            catchError((error) => {
              alerts.basicAlert(
                'Eliminar parámetro',
                'Error al eliminar el parámetro.',
                'error'
              );
              console.error(error);
              return EMPTY;
            })
          )
          .subscribe(() => {
            alerts.basicAlert(
              'Parámetro eliminado',
              'El parámetro se eliminó correctamente.',
              'success'
            );
            // Recargar datos desde el servidor para mantener consistencia
            this.refreshParametros();
            this.selectedParametro.set(null);
          });
      });
  }
}
