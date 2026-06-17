import { Component, inject, ChangeDetectorRef} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams, ColDef } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { AuthService } from 'app/services/auth.service';
import { CommonModule } from '@angular/common';
import { alerts } from 'app/helpers/alerts';
import { ProjectsService } from 'app/services/projects.service';
import { OilfieldService } from 'app/services/oilfield.service';
import { FollowprojectsService } from 'app/services/followprojects.service';
import { lastValueFrom, concat, toArray } from 'rxjs';

@Component({
  selector: 'app-detail-cell-renderer-proyectos',
  standalone: true,
  imports: [AgGridModule, CommonModule],
  template: `
    <div
      style="padding: 10px; background-color: #e9ecef; height: 100%; display: flex; flex-direction: column;"
      (mouseenter)="params.onMouseEnter && params.onMouseEnter()"
      (mouseleave)="params.onMouseLeave && params.onMouseLeave()">
      <div style="margin-bottom: 15px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong>Proyectos del Contrato: {{ contractNumber }}</strong>
          <div>
            <button
              class="btn btn-sm btn-success me-2"
              (click)="addProject()"
              [disabled]="!projectGridApi">
              <i class="bi bi-plus-lg"></i> Agregar
            </button>
            <button
              class="btn btn-sm btn-primary me-2 position-relative"
              (click)="saveProjects()"
              [disabled]="!hasProjectChanges">
              <i class="bi bi-floppy"></i> Guardar
              <span
                class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
                *ngIf="hasProjectChanges">
                <span class="visually-hidden">Hay cambios sin guardar</span>
              </span>
            </button>
            <button
              class="btn btn-sm btn-warning me-2"
              (click)="refreshProjects()">
              <i class="bi bi-arrow-clockwise"></i> Deshacer
            </button>
            <button
              class="btn btn-sm btn-danger"
              (click)="deleteSelectedProject()"
              [disabled]="!selectedProject">
              <i class="bi bi-trash"></i> Borrar
            </button>
          </div>
        </div>
        <ag-grid-angular
          class="ag-theme-quartz small-text-ag-grid"
          style="width: 100%; flex-grow: 1;"
          [columnDefs]="projectColumnDefs"
          [rowData]="projectRowData"
          [gridOptions]="projectGridOptions"
          [defaultColDef]="defaultColDef"
          (gridReady)="onProjectGridReady($event)"
          (cellValueChanged)="onProjectCellValueChanged($event)"
          [stopEditingWhenCellsLoseFocus]="true">
        </ag-grid-angular>
      </div>
    </div>
  `
})
export class DetailCellRendererProyectosComponent implements ICellRendererAngularComp {
  private projectsService = inject(ProjectsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private oilfieldService = inject(OilfieldService);
  private followprojectsService = inject(FollowprojectsService);
  authService = inject(AuthService);

  params: any;
  contractId: number;
  contractNumber: string;

  projectRowData: any[] = [];
  hasProjectChanges: boolean = false;
  projectGridApi: any;
  selectedProject: any = null;
  oilfields: any[] = [];

  private tempIdCounter: number = 0;

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100
  };

  projectGridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    suppressEnterWhenEditing: false,
    rowSelection: 'single',
    onFirstDataRendered: (params) => {
      const allColumnIds: string[] = [];
      params.api.getColumns()?.forEach((column: any) => {
        allColumnIds.push(column.getId());
      });
      params.api.autoSizeColumns(allColumnIds, false);
    },
    // Enter key navigation - move to next cell like Tab
    tabToNextCell: (params) => {
      const previousCell = params.previousCellPosition;
      const nextCell = params.nextCellPosition;

      // If backwards (Shift+Tab), use default behavior
      if (params.backwards) {
        return nextCell;
      }

      // Return the next cell position
      return nextCell;
    },
    onCellKeyDown: (event) => {
      const keyboardEvent = event.event as KeyboardEvent;
      if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey) {
        // Stop the default Enter behavior
        keyboardEvent.preventDefault();

        const api = event.api;
        const currentColumn = event.column;
        const currentRowIndex = event.rowIndex;

        // Get all visible columns
        const allColumns = api.getColumns();
        const editableColumns = allColumns.filter(col => {
          const colDef = col.getColDef();
          return colDef.editable === true;
        });

        // Find current column index in editable columns
        const currentColIndex = editableColumns.findIndex(col => col.getColId() === currentColumn.getColId());

        // Move to next editable column
        if (currentColIndex < editableColumns.length - 1) {
          // Move to next column in same row
          setTimeout(() => {
            api.startEditingCell({
              rowIndex: currentRowIndex,
              colKey: editableColumns[currentColIndex + 1].getColId()
            });
          }, 50);
        } else {
          // Last column - move to first editable column of next row
          const nextRowIndex = currentRowIndex + 1;
          const rowCount = api.getDisplayedRowCount();

          if (nextRowIndex < rowCount && editableColumns.length > 0) {
            setTimeout(() => {
              api.startEditingCell({
                rowIndex: nextRowIndex,
                colKey: editableColumns[0].getColId()
              });
            }, 50);
          }
        }
      }
    }
  };

  projectColumnDefs: ColDef[] = [
    {
      headerName: '#',
      valueGetter: 'node.rowIndex + 1',
      width: 50,
      maxWidth: 60,
      sortable: false,
      filter: false,
      editable: false,
      suppressMovable: true,
      cellStyle: { textAlign: 'center', fontWeight: 'bold', backgroundColor: '#f5f5f5' }
    },
    {
      field: 'idConsecutivo',
      headerName: 'Id Obra',
      editable: true,
      minWidth: 80,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { min: 0 },
      valueSetter: (params: any) => {
        params.data.idConsecutivo = params.newValue || 0;
        params.data.__modified = true;
        this.hasProjectChanges = true;
        return true;
      }
    },
    
    {
      field: 'number',
      headerName: 'Proyecto',
      editable: true,
      minWidth: 100,
      valueSetter: (params: any) => {
        params.data.number = params.newValue || '';
        params.data.__modified = true;
        this.hasProjectChanges = true;
        return true;
      }
    },
    {
      field: 'name',
      headerName: 'Nombre',
      editable: true,
      minWidth: 150,
      flex: 1,
      valueSetter: (params: any) => {
        params.data.name = params.newValue ? params.newValue.toUpperCase() : '';
        params.data.__modified = true;
        this.hasProjectChanges = true;
        return true;
      }
    },
    
    {
      field: 'year',
      headerName: 'Anio',
      editable: true,
      minWidth: 80,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028', '2029', '2030']
      },
      valueSetter: (params: any) => {
        params.data.year = params.newValue || new Date().getFullYear().toString();
        params.data.__modified = true;
        this.hasProjectChanges = true;
        return true;
      }
    },
    {
      field: 'description',
      headerName: 'Descripcion',
      editable: true,
      minWidth: 200,
      flex: 2,
      valueSetter: (params: any) => {
        params.data.description = params.newValue ? params.newValue.toUpperCase() : '';
        params.data.__modified = true;
        this.hasProjectChanges = true;
        return true;
      }
    },
    {
      field: 'state',
      headerName: 'Estado',
      editable: true,
      minWidth: 100,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['Ejecucion', 'Terminado', 'Suspendido', 'Cancelado', 'Pendiente']
      },
      valueSetter: (params: any) => {
        params.data.state = params.newValue || 'Ejecucion';
        params.data.__modified = true;
        this.hasProjectChanges = true;
        return true;
      }
    },
    {
      field: 'classification',
      headerName: 'Clasificacion',
      editable: true,
      minWidth: 120,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['A', 'B', 'C', 'D', 'MAYOR', 'MENOR', 'OTRO']
      },
      valueSetter: (params: any) => {
        params.data.classification = params.newValue || '';
        params.data.__modified = true;
        this.hasProjectChanges = true;
        return true;
      }
    },
    {
      field: 'typeConstruction',
      headerName: 'Tipo Construccion',
      editable: true,
      minWidth: 130,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['LINEA', 'ESTACION', 'DUCTO', 'INSTALACION', 'MANTENIMIENTO', 'OTRO']
      },
      valueSetter: (params: any) => {
        params.data.typeConstruction = params.newValue || '';
        params.data.__modified = true;
        this.hasProjectChanges = true;
        return true;
      }
    },
    {
      field: 'idOilfield',
      headerName: 'Ubicacion',
      editable: true,
      minWidth: 130,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => ({
        values: this.oilfields.map(o => o.id)
      }),
      valueFormatter: (params) => {
        if (!params.value) return '';
        const oilfield = this.oilfields.find(o => o.id === params.value);
        return oilfield ? oilfield.name : params.value;
      },
      valueGetter: (params) => {
        if (!params.data || !params.data.idOilfield) return '';
        const oilfield = this.oilfields.find(o => o.id === params.data.idOilfield);
        return oilfield ? oilfield.name : '';
      },
      valueSetter: (params: any) => {
        // Find the oilfield by name or id
        const oilfield = this.oilfields.find(o => o.name === params.newValue || o.id === params.newValue);
        params.data.idOilfield = oilfield ? oilfield.id : params.newValue;
        params.data.__modified = true;
        this.hasProjectChanges = true;
        return true;
      }
    },
    {
      field: 'programStart',
      headerName: 'Fecha Inicio Prog.',
      editable: true,
      minWidth: 120,
      cellEditor: 'agDateCellEditor',
      valueGetter: (params) => {
        if (!params.data?.programStart) return null;
        return params.data.programStart instanceof Date
          ? params.data.programStart
          : new Date(params.data.programStart);
      },
      valueSetter: (params) => {
        if (!params.newValue) {
          params.data.programStart = null;
          return true;
        }
        const date = params.newValue instanceof Date
          ? params.newValue
          : new Date(params.newValue);
        if (isNaN(date.getTime())) return false;
        params.data.programStart = date.toISOString().split('T')[0];
        params.data.__modified = true;
        this.hasProjectChanges = true;
        return true;
      },
      valueFormatter: (params) => {
        if (!params.value) return '';
        const date = params.value instanceof Date ? params.value : new Date(params.value);
        if (isNaN(date.getTime())) return '';
        return `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
      }
    },
    {
      field: 'programEnd',
      headerName: 'Fecha Fin Prog.',
      editable: true,
      minWidth: 120,
      cellEditor: 'agDateCellEditor',
      valueGetter: (params) => {
        if (!params.data?.programEnd) return null;
        return params.data.programEnd instanceof Date
          ? params.data.programEnd
          : new Date(params.data.programEnd);
      },
      valueSetter: (params) => {
        if (!params.newValue) {
          params.data.programEnd = null;
          return true;
        }
        const date = params.newValue instanceof Date
          ? params.newValue
          : new Date(params.newValue);
        if (isNaN(date.getTime())) return false;
        params.data.programEnd = date.toISOString().split('T')[0];
        params.data.__modified = true;
        this.hasProjectChanges = true;
        return true;
      },
      valueFormatter: (params) => {
        if (!params.value) return '';
        const date = params.value instanceof Date ? params.value : new Date(params.value);
        if (isNaN(date.getTime())) return '';
        return `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
      }
    },
    {
      field: 'priority',
      headerName: 'Prioridad',
      editable: true,
      minWidth: 90,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { min: 0, max: 10 },
      valueSetter: (params: any) => {
        params.data.priority = params.newValue || 0;
        params.data.__modified = true;
        this.hasProjectChanges = true;
        return true;
      }
    }
  ];

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.contractId = params.data.id;
    this.contractNumber = params.data.numberContract || '';

    // Load oilfields for the dropdown
    this.loadOilfields();
    // Load projects for this contract
    this.loadProjectData();
  
    this.cdr.detectChanges();}

  refresh(): boolean {
    return false;
  }

  loadOilfields() {
    this.oilfieldService.getOilfields().subscribe({
      next: (data: any) => {
        this.oilfields = data || [];
      },
      error: (error) => {
        console.error('Error loading oilfields:', error);
        this.oilfields = [];
      }
    });
  }

  onProjectGridReady(params: any) {
    this.projectGridApi = params.api;
    params.api.sizeColumnsToFit();

    params.api.addEventListener('selectionChanged', () => {
      const selectedNodes = params.api.getSelectedNodes();
      this.selectedProject = selectedNodes.length > 0 ? selectedNodes[0].data : null;
    });
  }

  onProjectCellValueChanged(event: any) {
    event.data.__modified = true;
    this.hasProjectChanges = true;
  }

  loadProjectData(): Promise<void> {
    return new Promise((resolve) => {
      this.projectsService.getProjectListByContract(this.contractId).subscribe({
        next: (data: any) => {
          this.projectRowData = data || [];
          if (this.projectGridApi) {
            this.projectGridApi.setGridOption('rowData', this.projectRowData);
          }
          resolve();
        },
        error: (error) => {
          console.error('Error loading projects:', error);
          this.projectRowData = [];
          resolve();
        }
      });
    });
  }

  refreshProjects() {
    this.hasProjectChanges = false;
    this.loadProjectData();
  }

  addProject() {
    if (!this.projectGridApi) {
      console.error('Project grid API not ready');
      return;
    }

    const tempId = `temp_project_${this.tempIdCounter++}`;
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const newProject = {
      id: tempId,
      idContrato: this.contractId,
      number: '',
      name: '',
      idConsecutivo: 0,
      year: today.getFullYear().toString(),
      description: '',
      state: 'Ejecucion',
      classification: 'A',
      typeConstruction: 'LINEA',
      idOilfield: null,
      programStart: today.toISOString().split('T')[0],
      programEnd: nextMonth.toISOString().split('T')[0],
      realPronosticLPO: today.toISOString().split('T')[0],
      realPronosticTTT: nextMonth.toISOString().split('T')[0],
      priority: 0,
      active: 1,
      idActive: 1,
      diameter: '0',
      length: 0,
      budgetManagement: 'NO',
      lineRight: 'NO',
      receivedEngineering: 'NO',
      government: 'NO',
      request: '',
      __isNew: true
    };

    this.projectRowData = [newProject, ...this.projectRowData];
    this.hasProjectChanges = true;

    if (this.projectGridApi) {
      this.projectGridApi.setGridOption('rowData', this.projectRowData);
    }

    setTimeout(() => {
      this.projectGridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'number'
      });
    }, 100);
  }

  async saveProjects() {
    // Validate required fields
    const invalidRows = this.projectRowData.filter(row =>
      (row.__isNew || row.__modified) && (!row.name || !row.description)
    );

    if (invalidRows.length > 0) {
      alerts.basicAlert(
        'Validacion',
        'Debe llenar los campos obligatorios (Nombre y Descripcion) antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.projectRowData.filter(row => row.__isNew);
    const modifiedRows = this.projectRowData.filter(row => row.__modified && !row.__isNew);

    try {
      // Save new projects
      for (const row of newRows) {
        const cleanedData = this.cleanDataForServer(row);
        await lastValueFrom(this.projectsService.addProject(cleanedData));
      }

      // Update modified projects
      for (const row of modifiedRows) {
        const cleanedData = this.cleanDataForServer(row);
        await lastValueFrom(this.projectsService.updateProject(row.id, cleanedData));
      }

      if (newRows.length > 0 || modifiedRows.length > 0) {
        alerts.basicAlert(
          'Proyectos guardados',
          'Se han guardado los proyectos correctamente.',
          'success'
        );

        this.hasProjectChanges = false;

        // Reload projects — await so projectRowData is fresh before counting
        await this.loadProjectData();

        // Update project count in parent grid with fresh data
        await this.updateProjectCountInParent();
      }
    } catch (error) {
      console.error('Error saving projects:', error);
      alerts.basicAlert(
        'Error',
        'Error al guardar los proyectos.',
        'error'
      );
    }
  
    this.cdr.detectChanges();}

  async deleteSelectedProject() {
    if (!this.selectedProject) {
      return;
    }

    // Confirm before deleting
    const confirmResult = await alerts.confirmAlert(
      '¿Esta seguro?',
      `¿Desea eliminar el proyecto "${this.selectedProject.name || this.selectedProject.number || 'seleccionado'}"? Esta accion no se puede deshacer.`,
      'warning',
      'Si, eliminar'
    );

    if (!confirmResult.isConfirmed) {
      return;
    }

    if (this.selectedProject.__isNew) {
      // If it's a new row, just remove it from the array
      this.projectRowData = this.projectRowData.filter(
        item => item.id !== this.selectedProject.id
      );
      if (this.projectGridApi) {
        this.projectGridApi.setGridOption('rowData', this.projectRowData);
      }
      this.selectedProject = null;
      this.hasProjectChanges = this.projectRowData.some(r => r.__isNew || r.__modified);
    } else {
      // Delete from server
      try {
        await lastValueFrom(this.projectsService.deleteProject(this.selectedProject.id));

        alerts.basicAlert(
          'Proyecto eliminado',
          'El proyecto se elimino correctamente.',
          'success'
        );

        await this.loadProjectData();
        this.selectedProject = null;

        // Update project count in parent grid with fresh data
        await this.updateProjectCountInParent();
      } catch (error) {
        console.error('Error deleting project:', error);
        alerts.basicAlert(
          'Error',
          'Error al eliminar el proyecto.',
          'error'
        );
      }
    }
  
    this.cdr.detectChanges();}

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.detailType;

    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }

    return cleanedData;
  }

  private async updateProjectCountInParent(): Promise<void> {
    try {
      // projectRowData is already fresh (loadProjectData was awaited before calling this)
      const projectCount = this.projectRowData.length;

      // Update the counter in the parent grid row (visual)
      this.params.data.project = projectCount.toString();

      // Persist the count to the database
      const contractData = {
        ...this.params.data,
        project: projectCount.toString()
      };
      // Clean internal flags
      delete contractData.__isNew;
      delete contractData.__modified;
      delete contractData.detailType;

      await lastValueFrom(this.followprojectsService.updateContract(this.contractId, contractData));

      // Refresh the parent grid cell
      if (this.params.api) {
        this.params.api.refreshCells({
          rowNodes: [this.params.node],
          columns: ['project'],
          force: true
        });
      }

    } catch (error) {
      console.error('Error updating project count:', error);
    }
  
    this.cdr.detectChanges();}
}
