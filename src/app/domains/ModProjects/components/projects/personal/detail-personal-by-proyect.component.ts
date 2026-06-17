import { Component, effect, inject, ChangeDetectorRef} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { SignalsService } from 'app/services/signals.service';
import { EmployeesService } from 'app/services/employees.service';
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { PersonalByProyectService } from 'app/services/personalByProyect.service';
import { alerts } from 'app/helpers/alerts';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';

@Component({
  selector: 'app-personal-by-proyect',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div
  style="
    padding: 10px;
    background-color: #e8f5e9;
    height: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  "
  (mouseenter)="params.onMouseEnter && params.onMouseEnter()"
  (mouseleave)="params.onMouseLeave && params.onMouseLeave()">

  <!-- CONTENEDOR CABECERA -->
  <div style="
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
      <!-- Mensaje a la derecha -->
    <div>
      <strong>Personal del Proyecto: {{ projectName }}</strong>
    </div>
      
    <!-- Botones a la izquierda -->
    <div class="btn-group btn-group-sm" role="group">
      <button type="button" class="btn btn-outline-primary" (click)="onAddRow()">
        <i class="bi bi-plus-lg"></i> Agregar
      </button>
      <button type="button" class="btn btn-outline-warning" (click)="onSave()">
        <i class="bi bi-pencil"></i> Guardar
      </button>
      <button type="button" class="btn btn-outline-danger" (click)="onRemoveSelected()">
        <i class="bi bi-trash3"></i> Eliminar
      </button>
      <button type="button" class="btn btn-outline-secondary" (click)="onUndo()">
        <i class="bi bi-arrow-90deg-left"></i> Deshacer
      </button>
    </div>

    
  </div>

  <!-- TABLA ABAJO -->
  <ag-grid-angular
    class="ag-theme-quartz small-text-ag-grid"
    style="width: 100%; flex-grow: 1;"
    [columnDefs]="personalColumnDefs"
    [rowData]="personalRowData"
    [gridOptions]="personalGridOptions"
    (gridReady)="onPersonalGridReady($event)">
  </ag-grid-angular>

</div>

  `
})
export class DetailPersonalByProyectComponent implements ICellRendererAngularComp {
  private personalByProyectService = inject(PersonalByProyectService);
  private readonly cdr = inject(ChangeDetectorRef);
  private signalsService = inject(SignalsService);
  private employeeService = inject(EmployeesService);
  params: any;
  projectId: number;
  projectName: string;
  personalRowData: any[] = [];
  personalGridApi: any;
  idRoot: number;
  empleadoCatalgos: any[] = [];

  personalGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowSelection: 'single',
  };

 personalColumnDefs: ColDef[] = [
 {
   field: 'idPersonal',
   headerName: 'Nombre',
   width: 250,
   editable: true,
   cellEditor: SelectWithTooltipEditorV2Component,

  cellEditorParams: () => {
    // Mapear al shape que espera SelectDropdownService: { id, description }
    const opts = (this.empleadoCatalgos || []).map(e => ({
      id: e.id,
      description: e.name,
      // opcionales: agregar campos auxiliares si los necesita el tooltip
    }));

    return { options: opts };
  },

  valueFormatter: (params) => {
    // Aceptar que el valor pueda ser un objeto (editor devuelve {value,label})
    const raw = params.value;
    const val = (raw && typeof raw === 'object') ? (raw.value ?? raw.id) : raw;
    const emp = this.empleadoCatalgos?.find(e => e.id === val);
    // Si no encontramos el empleado pero el raw es objeto, mostrar su label como respaldo
    if (emp) return emp.name;
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
      alerts.basicAlert('Campo requerido', 'El empleado es obligatorio', 'error');
      return false;
    }

    const duplicateExists = this.personalRowData.some((row, i) =>
      i !== params.node.rowIndex && row.idPersonal === value
    );

    if (duplicateExists) {
      alerts.basicAlert('Valor duplicado', 'Ya existe ese empleado.', 'error');
      return false;
    }

    params.data.idPersonal = value;

    const emp = this.empleadoCatalgos.find(e => e.id === value);
    params.data.name = emp?.name || (editorValue && editorValue.label) || '';

    return true;
  }
  },
];

constructor() {
  effect(() => {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (idRoot) {
      this.cargarCatalogoEmpleados(idRoot);
    }
    effect(() => {
           setTimeout(() => {
            this.onUndo();
          }, 500); 
        });
  });
}

agInit(params: any): void {
  this.params = params;
  this.projectId = params.data.id;
  this.projectName = params.data.name;
  this.obtenerEmpleados();
  const idRoot = this.signalsService.getRootSelectedBySidebar()();
  if (idRoot) {
    this.cargarCatalogoEmpleados(idRoot);
  }
  setTimeout(() => {
    this.onUndo();
  }, 500); 

  this.cdr.detectChanges();}

 cargarCatalogoEmpleados(idRoot: number): Promise<boolean> {
   return new Promise((resolve) => {
     this.employeeService.getEmployees(-idRoot).subscribe(
       (data: any) => {
         this.empleadoCatalgos = data;
         resolve(true);
       },
       (error) => {
         console.error('Error al cargar catálogo de empleados:', error);
         resolve(false);
       }
     );
   });
 }
  refresh(): boolean {
    return false;
  }

  onPersonalGridReady(params: GridReadyEvent): void {
    this.personalGridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  obtenerEmpleados(): void {
    this.personalByProyectService.getPersonalByProyect(this.projectId).subscribe(
      (data: any) => {
        this.personalRowData = data;
      },
      (error) => {
        console.error('Error fetching personal data:', error);
        this.personalRowData = [];
      }
    );
  }

  onAddRow() {
    const newRow = {
      id: 'temp_' + Date.now(), // temp id
      idProyect: this.projectId,
      idPersonal: null,
      active: true,
      __isNew: true
    };
    this.personalGridApi.applyTransaction({ add: [newRow] });
    // Also update personalRowData if needed, but applyTransaction should handle it
  }

  async onSave() {
       const allRows: any[] = [];
       this.personalGridApi.forEachNode(node => allRows.push(node.data));
       const newRows = allRows.filter((row) => row.__isNew);
       const modifiedRows = allRows.filter(
         (row) => row.__modified && !row.__isNew
       );
     
      const addObservables = newRows.map((row) => {
        const cleanedData = this.cleanDataForServer(row);
        return this.personalByProyectService.addPersonalByProyect(cleanedData);
      });
    
      const updateObservables = modifiedRows.map((row) => {
        const cleanedData = this.cleanDataForServer(row);
        return this.personalByProyectService.updatePersonalByProyect(row.id, cleanedData);
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
        this.obtenerEmpleados() 
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
    
       this.cdr.detectChanges();}
  
    private cleanDataForServer(data: any): any {
      const cleanedData = { ...data };
      delete cleanedData.__isNew;
      delete cleanedData.__modified;
      if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
        delete cleanedData.id;
      }
      return cleanedData;
    }
  
    onUndo() {
      this.obtenerEmpleados();
    }
    onRemoveSelected() {
        // Asegurarnos de que la API del grid esté lista
        if (!this.personalGridApi) {
          alerts.basicAlert('Error', 'Grid no inicializado.', 'error');
          return;
        }

        const selectedNodes = this.personalGridApi.getSelectedNodes();
        if (!selectedNodes || selectedNodes.length === 0) {
          alerts.basicAlert(
            'Eliminar empleado',
            'Por favor, seleccione un empleado para eliminar.',
            'error'
          );
          return;
        }

        const node = selectedNodes[0];
        const selectedData = node?.data;
        if (!selectedData) {
          alerts.basicAlert('Eliminar empleado', 'No se encontró la fila seleccionada.', 'error');
          return;
        }

        // Confirmación antes de eliminar
        alerts
          .confirmAlert(
            'Eliminar empleado',
            '¿Está seguro que desea eliminar este empleado del proyecto?',
            'warning',
            'Sí, eliminar'
          )
          .then((result) => {
            if (!result.isConfirmed) return;

            // Determinar el id real
            const realId = selectedData.id ?? null;

            // Si la fila es nueva (no guardada en servidor) o no tiene id, la eliminamos localmente
            if (selectedData.__isNew || !realId) {
              this.personalGridApi.applyTransaction({ remove: [selectedData] });
              // Mantener personalRowData sincronizado
              this.personalRowData = this.personalRowData.filter((r) => r !== selectedData);
              alerts.basicAlert('Empleado eliminado', 'El empleado se eliminó localmente.', 'success');
              return;
            }

            // Si la fila existe en servidor, llamamos al servicio para eliminarla
            const id = realId;
            this.personalByProyectService
              .deletePersonalByProyect(id)
              .pipe(
                catchError((error) => {
                  alerts.basicAlert(
                    'Eliminar empleado',
                    'Error al eliminar el empleado.',
                    'error'
                  );
                  console.error(error);
                  return EMPTY;
                })
              )
              .subscribe(() => {
                alerts.basicAlert(
                  'Empleado eliminado',
                  'El empleado se eliminó correctamente.',
                  'success'
                );
                // Recargar datos desde el servidor para mantener consistencia
                this.obtenerEmpleados();
                // Deseleccionar
                setTimeout(() => {
                  if (this.personalGridApi && !this.personalGridApi.isDestroyed()) {
                    try { this.personalGridApi.deselectAll(); } catch (e) { /* noop */ }
                  }
                }, 50);
              });
          });
      }
}
