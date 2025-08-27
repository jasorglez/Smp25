import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { OtService } from 'app/services/ot.service';
import { ProjectsService } from 'app/services/projects.service';
import { SignalsService } from 'app/services/signals.service';
import { AuthService } from 'app/services/auth.service';
import { alerts } from 'app/helpers/alerts';

// Interface para los datos catastrales
interface CatastralData {
  id?: number;
  idProject: number;
  projectName?: string; // Nombre del proyecto para mostrar
  otNumber: string;
  cdc: string;
  description: string;
  observations: string;
  // Propiedades de control CRUD
  __isNew?: boolean;
  __modified?: boolean;
}

@Component({
  selector: 'app-catastrales',
  standalone: true,
  imports: [CommonModule, TranslateModule, AgGridModule],
  templateUrl: './catastrales.component.html',
  styleUrl: './catastrales.component.scss'
})
export class CatastralesComponent implements OnInit {

  // Servicios
  private otService = inject(OtService);
  private projectsService = inject(ProjectsService);
  private signalsService = inject(SignalsService);
  private authService = inject(AuthService);

  // Variables del grid
  public gridApi!: GridApi;
  public rowData: CatastralData[] = [];
  public projectsList: any[] = [];

  // Variables de control CRUD
  public notSavedChanges: boolean = false;
  private tempIdCounter: number = 1;

  // Configuración del grid
  public gridOptions: any = {
    headerHeight: 40,
    rowHeight: 35,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: true,
    paginationPageSize: 15
  };

  // Definición de columnas
  public get columnDefs(): ColDef[] {
    return [
      {
        field: 'id',
        headerName: 'ID',
        sortable: true,
        filter: true,
        resizable: true,
        width: 80,
        editable: false
      },
      {
        field: 'projectName',
        headerName: 'Proyecto',
        sortable: true,
        filter: true,
        resizable: true,
        flex: 2,
        editable: false, // No editable porque todas las OTs pertenecen al proyecto seleccionado
        valueGetter: (params: any) => {
          // Si no tiene projectName, buscar en la lista usando idProject
          if (params.data.projectName) {
            return params.data.projectName;
          }
          const project = this.projectsList.find(p => p.id === params.data.idProject);
          return project ? project.name : 'Proyecto no encontrado';
        }
      },
      {
        field: 'otNumber',
        headerName: 'Número OT',
        sortable: true,
        filter: true,
        resizable: true,
        flex: 1,
        editable: true
      },
      {
        field: 'cdc',
        headerName: 'CDC',
        sortable: true,
        filter: true,
        resizable: true,
        flex: 1,
        editable: true
      },
      {
        field: 'description',
        headerName: 'Descripción',
        sortable: true,
        filter: true,
        resizable: true,
        flex: 3,
        editable: true,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorParams: {
          maxLength: 500,
          rows: 3
        }
      },
      {
        field: 'observations',
        headerName: 'Observaciones',
        sortable: true,
        filter: true,
        resizable: true,
        flex: 3,
        editable: true,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorParams: {
          maxLength: 500,
          rows: 3
        }
      }
    ];
  }

  constructor() {
    // Escuchar cambios en el proyecto seleccionado del sidebar usando effects
    effect(() => {
      const projectId = this.signalsService.getProjectSelectedBySidebar()();
      if (projectId) {
        console.log('Proyecto seleccionado desde sidebar:', projectId);
        this.loadData(projectId);
      } else {
        // Si no hay proyecto seleccionado, limpiar datos
        this.loadData();
      }
    });
  }

  ngOnInit(): void {
    this.loadProjects();
  }

  // Cargar lista de proyectos
  loadProjects(): void {
    this.projectsService.getProjects().subscribe({
      next: (data: any) => {
        this.projectsList = data;
        console.log('Lista de proyectos cargada:', this.projectsList);
      },
      error: (error) => {
        console.error('Error al cargar proyectos:', error);
        alerts.basicAlert('Error', 'No se pudieron cargar los proyectos', 'error');
      }
    });
  }

  // Cargar datos catastrales usando getOtListByProject
  loadData(idProject?: number): void {
    // Si no hay proyecto seleccionado, limpiar datos
    if (!idProject) {
      this.rowData = [];
      return;
    }

    // Cargar OTs del proyecto seleccionado
    this.otService.getOtListByProject(idProject).subscribe({
      next: (data: any) => {
        console.log('OTs cargadas para proyecto', idProject, ':', data);
        
        // Obtener el nombre del proyecto actual
        const currentProject = this.projectsList.find(p => p.id === idProject);
        const projectName = currentProject ? currentProject.name : 'Proyecto no encontrado';
        
        // Mapear los datos del endpoint a nuestro formato
        this.rowData = data.map((ot: any, index: number) => ({
          id: ot.id || index + 1,
          idProject: idProject, // ID del proyecto
          projectName: projectName, // Nombre del proyecto para mostrar
          otNumber: ot.otNumber || ot.number || ot.codigo || 'N/A',
          cdc: ot.cdc || ot.costCenter || 'N/A',
          description: ot.description || ot.descripcion || ot.name || 'Sin descripción',
          observations: ot.observations || ot.observaciones || ''
        }));
      },
      error: (error) => {
        console.error('Error al cargar OTs:', error);
        alerts.basicAlert('Error', 'No se pudieron cargar las OTs del proyecto', 'error');
        this.rowData = [];
      }
    });
  }

  // Métodos del grid
  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  onSelectionChanged(event: any): void {
    const selectedRows = this.gridApi.getSelectedRows();
    console.log('Fila seleccionada:', selectedRows);
  }

  onCellValueChanged(event: any): void {
    const data = event.data;
    const field = event.colDef.field;
    const newValue = event.newValue;
    const oldValue = event.oldValue;

    if (newValue !== oldValue) {
      if (data.__isNew) {
        // Para filas nuevas, solo marcar que hay cambios
        this.notSavedChanges = true;
      } else {
        // Para filas existentes, marcar como modificada
        data.__modified = true;
        this.notSavedChanges = true;
      }
      console.log(`Campo ${field} cambiado de ${oldValue} a ${newValue}`);
    }
  }

  // Métodos CRUD
  addRow(): void {
    const tempId = `temp_${this.tempIdCounter++}`;
    const currentProject = this.signalsService.getProjectSelectedBySidebar()();
    const currentProjectData = this.projectsList.find(p => p.id === currentProject);
    
    const newItem: CatastralData = {
      id: undefined,
      idProject: currentProject || 0,
      projectName: currentProjectData ? currentProjectData.name : 'Sin proyecto',
      otNumber: '',
      cdc: '',
      description: '',
      observations: ''
    };
    
    // Agregar propiedades de control
    (newItem as any).__isNew = true;
    (newItem as any).tempId = tempId;
    
    this.rowData = [newItem, ...this.rowData];
    this.notSavedChanges = true;
    
    // Enfocar en la primera celda editable
    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.setFocusedCell(0, 'idProject');
        this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'idProject' });
      }
    }, 100);
  }

  saveChanges(): void {
    const newRows = this.rowData.filter(row => row.__isNew);
    const modifiedRows = this.rowData.filter(row => row.__modified && !row.__isNew);

    // Validar filas nuevas
    const invalidNewRows = newRows.filter(item => 
      !item.otNumber?.trim() || !item.cdc?.trim() || !item.description?.trim()
    );
    
    if (invalidNewRows.length > 0) {
      alerts.basicAlert(
        'Validación', 
        'Complete los campos: Número OT, CDC y Descripción antes de guardar.', 
        'warning'
      );
      return;
    }

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Info', 'No hay cambios para guardar', 'info');
      return;
    }

    // TODO: Implementar llamadas al servicio cuando se definan los endpoints
    console.log('Guardando cambios:', { newRows, modifiedRows });
    
    // Simular guardado exitoso
    this.rowData.forEach(item => {
      delete item.__isNew;
      delete item.__modified;
      if (!item.id && (item as any).tempId) {
        item.id = Math.floor(Math.random() * 10000);
        delete (item as any).tempId;
      }
    });
    
    this.notSavedChanges = false;
    alerts.basicAlert('Éxito', 'Cambios guardados exitosamente', 'success');
  }

  revert(): void {
    const currentProject = this.signalsService.getProjectSelectedBySidebar()();
    if (currentProject) {
      this.loadData(currentProject);
    } else {
      this.loadData();
    }
    this.notSavedChanges = false;
    alerts.basicAlert('Info', 'Cambios revertidos', 'info');
  }

  deleteEntry(): void {
    const selectedNodes = this.gridApi.getSelectedNodes();
    
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Advertencia', 'Seleccione una fila para eliminar', 'warning');
      return;
    }
    
    const selectedData = selectedNodes[0].data;
    
    if (confirm('¿Está seguro de que desea eliminar este registro?')) {
      // TODO: Implementar llamada al servicio para eliminar
      this.rowData = this.rowData.filter(row => row !== selectedData);
      this.notSavedChanges = true;
      alerts.basicAlert('Éxito', 'Registro eliminado', 'success');
    }
  }
}