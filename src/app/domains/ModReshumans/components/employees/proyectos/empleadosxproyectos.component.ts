import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { EmpleadosxProyectosService } from 'app/services/empleadosxproyectos.service';
import { ProjectsService } from 'app/services/projects.service';
import { SignalsService } from 'app/services/signals.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-empleadosxproyectos',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './empleadosxproyectos.component.html',
})
export class EmpleadosxProyectosComponent {
  private signalsService = inject(SignalsService);
  private projectsService = inject(ProjectsService);
  private empleadosxProyectosService = inject(EmpleadosxProyectosService);

  idEmployee: number = null;
  idRoot: number = null;
  rowData: any[] = [];
  private originalAssignments: Set<number> = new Set();
  private gridApi: GridApi;
  hasUnsavedChanges = false;
  isLoading = false;

  defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
  };

  gridOptions: any = {
    headerHeight: 28,
    rowHeight: 28,
  };

  columnDefs: ColDef[] = [
    {
      headerName: 'Asignado',
      field: 'assigned',
      width: 90,
      editable: true,
      cellEditor: 'agCheckboxCellEditor',
      cellRenderer: 'agCheckboxCellRenderer',
      onCellValueChanged: (params) => {
        params.data.__modified = true;
        this.hasUnsavedChanges = true;
      },
    },
    {
      headerName: 'No. Proyecto',
      field: 'number',
      width: 130,
      editable: false,
    },
    {
      headerName: 'Nombre',
      field: 'name',
      flex: 1,
      minWidth: 200,
      editable: false,
    },
    {
      headerName: 'Estado',
      field: 'state',
      width: 120,
      editable: false,
    },
  ];

  constructor() {
    effect(() => {
      this.idEmployee = this.signalsService.getIdEmployee()();
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      if (this.idEmployee && this.idRoot) {
        this.loadData();
      }
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  async loadData() {
    this.isLoading = true;
    try {
      const [projects, assignments] = await Promise.all([
        lastValueFrom(this.projectsService.getProjectListByCompany(this.idRoot)),
        lastValueFrom(this.empleadosxProyectosService.getByEmployee(this.idEmployee)),
      ]);

      const employeeAssignments: Map<number, number> = new Map();
      (assignments as any[]).forEach(a => {
        employeeAssignments.set(a.idProyect, a.id);
      });

      this.originalAssignments = new Set(employeeAssignments.keys());

      this.rowData = (projects as any[]).map(p => ({
        ...p,
        assigned: employeeAssignments.has(p.id),
        assignmentId: employeeAssignments.get(p.id) ?? null,
        __modified: false,
      }));

      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }
      this.hasUnsavedChanges = false;
    } catch (error) {
      console.error('Error cargando proyectos:', error);
      alerts.basicAlert('Error', 'No se pudieron cargar los proyectos', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async saveChanges() {
    const modified = this.rowData.filter(r => r.__modified);
    if (!modified.length) return;

    try {
      for (const row of modified) {
        if (row.assigned && !this.originalAssignments.has(row.id)) {
          // Nueva asignación
          await lastValueFrom(
            this.empleadosxProyectosService.add({
              idEmployee: this.idEmployee,
              idProyect: row.id,
            })
          );
        } else if (!row.assigned && this.originalAssignments.has(row.id) && row.assignmentId) {
          // Remover asignación
          await lastValueFrom(
            this.empleadosxProyectosService.delete(row.assignmentId)
          );
        }
      }
      alerts.basicAlert('Guardado', 'Proyectos actualizados correctamente', 'success');
      await this.loadData();
    } catch (error) {
      console.error('Error guardando proyectos:', error);
      alerts.basicAlert('Error', 'No se pudieron guardar los cambios', 'error');
    }
  }

  revertChanges() {
    this.loadData();
  }
}
