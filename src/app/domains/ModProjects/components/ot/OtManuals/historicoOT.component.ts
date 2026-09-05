import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { OtService } from 'app/services/ot.service';
import { ProjectsService } from 'app/services/projects.service';
import { SignalsService } from 'app/services/signals.service';
import { AuthService } from 'app/services/auth.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { alerts } from 'app/helpers/alerts';
import { environment } from '@env/environment';
import { TrackingService } from 'app/services/tracking.service';

// Interface para los datos históricos de OT
interface HistoricoOTData {
  id?: number;
  idProject: number;
  projectName?: string; // Nombre del proyecto para mostrar
  cuentaHoja?: number | string;
  otNumber: string;
  cdc: string;
  package?: string;
  description: string;
  observations: string;
  area?: string; // Campo texto del área
  closed?: boolean; // Campo cerrado (true/false)
  closedApp?: boolean; // Campo cerrado desde la app (true/false)
    // Propiedades de control CRUD
  __isNew?: boolean;
  __modified?: boolean;
}

@Component({
  selector: 'app-historico-ot',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AgGridModule],
  templateUrl: './historicoOT.component.html',
  styleUrl: './historicoOT.component.scss'
})
export class HistoricoOTComponent implements OnInit {
  private lastManualDescription = 'RECONEXION DE MEDIDOR';
  private lastManualArea = '';
  private lastManualPackage = '';

  private trackingService = inject(TrackingService);

  // Servicios
  private otService = inject(OtService);
  private projectsService = inject(ProjectsService);
  private signalsService = inject(SignalsService);
  private authService = inject(AuthService);
  private catalogsService = inject(CatalogsService);

  // Variables del grid
  public gridApi!: GridApi;
  public rowData: HistoricoOTData[] = [];
  public projectsList: any[] = [];
  public catalogArea: any[] = []; // Catálogo de áreas (fases)
  public showOpenOnly = false;

  // Variables de control CRUD
  public notSavedChanges: boolean = false;
  private tempIdCounter: number = 1;
  private idcompany: number;

  // Configuración del grid
  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 110
  };

  public gridOptions: any = {
    headerHeight: 40,
    rowHeight: 35,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: false,
    animateRows: true,
    pagination: true,
    paginationPageSize: 50
  };

  // Definición estable: no se reconstruye al editar otra celda y conserva el ancho del editor Área.
  public readonly columnDefs: ColDef[] = [
      {
        field: 'id',
        headerName: 'ID',
        sortable: true,
        filter: true,
        resizable: true,
        width: 100,
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
        field: 'cuentaHoja',
        headerName: 'Nº Hoja',
        sortable: true,
        filter: true,
        resizable: true,
        width: 110,
        editable: true,
        cellEditor: 'agTextCellEditor',
        cellEditorParams: {
          maxLength: 20
        },
        valueParser: (params: any) => this.normalizeText(params.newValue)
      },
      {
        field: 'otNumber',
        headerName: 'Número OT',
        sortable: true,
        filter: true,
        resizable: true,
        flex: 2,
        editable: true
      },
      {
        field: 'cdc',
        headerName: 'CDC',
        sortable: true,
        filter: true,
        resizable: true,
        flex: 2,
        editable: true
      },
      {
        field: 'package',
        headerName: 'Paquete',
        sortable: true,
        filter: true,
        resizable: true,
        flex: 2,
        editable: true,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorParams: {
          maxLength: 500,
          rows: 3
        }
      },
      {
        field: 'area',
        headerName: 'Área',
        sortable: true,
        filter: true,
        resizable: true,
        width: 180,
        minWidth: 180,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorPopup: true,
        cellEditorParams: () => ({
          values: this.getAreaOptions(),
          formatValue: (value: any) => value || 'Seleccione área'
        })
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
        flex: 2,
        editable: true,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorParams: {
          maxLength: 500,
          rows: 3
        }
      },
      {
        field: 'closed',
        headerName: 'Cerrado Web',
        sortable: true,
        filter: true,
        resizable: true,
        width: 150,
        editable: true,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor'
      },
        {
        field: 'closedApp',
        headerName: 'Cerrado App',
        sortable: true,
        filter: true,
        resizable: true,
        width: 150,
        editable: true,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor'
      }
  ];

  constructor() {
    // Escuchar cambios en el proyecto seleccionado del sidebar usando effects
    effect(() => {
      const projectId = this.signalsService.getProjectSelectedBySidebar()();
      const newIdcompany = this.signalsService.getRootSelectedBySidebar()();
      
      // Si cambia la compañía, recargar el catálogo de áreas
      if (newIdcompany !== this.idcompany) {
        this.idcompany = newIdcompany;
        this.obtenerArea();
      }
      
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
    this.obtenerArea();
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

  // Cargar catálogo de áreas (fases)
  obtenerArea(): void {
    if (!this.idcompany) {
      console.log('idcompany no disponible para cargar áreas');
      return;
    }

    this.catalogsService.getPhases(this.idcompany).subscribe({
      next: (data: any) => {
        this.catalogArea = data;
        console.log('Catálogo de áreas cargado:', this.catalogArea);
      },
      error: (error) => {
        console.error('Error al cargar catálogo de áreas:', error);
        alerts.basicAlert('Error', 'No se pudo cargar el catálogo de áreas', 'error');
      }
    });
  }

  // Cargar datos históricos de OT usando getOtListByProject
  loadData(idProject?: number): void {
    // Si no hay proyecto seleccionado, limpiar datos
    if (!idProject) {
      this.rowData = [];
      this.autoSizeColumns();
      return;
    }

    const showClosed = !this.showOpenOnly;

   // Cargar OTs del proyecto seleccionado
this.otService.getOtListByProject(idProject, showClosed).subscribe({
  next: (data: any) => {
    console.log('OTs cargadas para proyecto', idProject, ':', data);
    
    // Verificar si data es un array directamente o viene dentro de una respuesta
    const otsArray = Array.isArray(data) ? data : (data.data || data.ots || []);
    
    // Obtener el nombre del proyecto actual
    const currentProject = this.projectsList.find(p => p.id === idProject);
    const projectName = currentProject ? currentProject.name : 'Proyecto no encontrado';
    
    // Verificar si hay datos
    if (otsArray.length === 0) {
      console.log(`No se encontraron OTs ${showClosed ? 'cerradas' : 'abiertas'} para el proyecto`, idProject);
      this.rowData = [];
      this.autoSizeColumns();
      // Opcional: mostrar mensaje informativo en lugar de error
      // alerts.basicAlert('Información', 'No se encontraron OTs cerradas para este proyecto', 'info');
      return;
    }
    
    const orderedOtsArray = [...otsArray].sort((left: any, right: any) => this.compareOtsNewestFirst(left, right));

    // Mapear los datos del endpoint a nuestro formato
    this.rowData = orderedOtsArray.map((ot: any, index: number) => ({
      id: ot.id || index + 1,
      idProject: idProject, // ID del proyecto
      projectName: projectName, // Nombre del proyecto para mostrar
      cuentaHoja: ot.cuentaHoja ?? ot.CuentaHoja ?? '',
      otNumber: ot.otNumber || ot.number || ot.codigo || 'N/A',
      cdc: ot.cdc || ot.costCenter || 'N/A',
      package: ot.package || '',
      description: ot.description || ot.descripcion || ot.name || 'Sin descripción',
      observations: ot.observations || ot.observaciones || '',
      area: ot.area || '',
      closed: ot.closed || false,
      closedApp: ot.closedApp || false
    }));
    this.rememberLastManualValues();
    
    console.log(`Se cargaron ${this.rowData.length} OTs ${showClosed ? 'cerradas' : 'abiertas'} para el proyecto ${projectName}`);
    this.autoSizeColumns();
  },
  error: (error) => {
    console.error('Error al cargar OTs:', error);
    
    // Manejo más específico de errores
    if (error.status === 404) {
      // El controlador anterior devolvía 404, pero el nuevo no debería
      console.log(`No se encontraron OTs ${showClosed ? 'cerradas' : 'abiertas'} (404)`);
      this.rowData = [];
      this.autoSizeColumns();
      // Opcional: mostrar mensaje informativo
      // alerts.basicAlert('Información', 'No se encontraron OTs cerradas para este proyecto', 'info');
    } else if (error.status === 500) {
      console.error('Error interno del servidor:', error.error);
      alerts.basicAlert('Error', 'Error interno del servidor al cargar las OTs', 'error');
      this.rowData = [];
      this.autoSizeColumns();
    } else if (error.status === 0) {
      console.error('Error de conexión');
      alerts.basicAlert('Error', 'Error de conexión. Verifique su red.', 'error');
      this.rowData = [];
      this.autoSizeColumns();
    } else {
      console.error('Error desconocido:', error);
      alerts.basicAlert('Error', 'No se pudieron cargar las OTs del proyecto', 'error');
      this.rowData = [];
      this.autoSizeColumns();
    }
  }
  });
  }

  onOpenOnlyChange(): void {
    const currentProject = this.signalsService.getProjectSelectedBySidebar()();
    if (currentProject) {
      this.loadData(currentProject);
    }
  }

  private autoSizeColumns(): void {
    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.sizeColumnsToFit();
      }
    }, 0);
  }


  // Métodos del grid
  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    this.autoSizeColumns();
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

    console.log(`onCellValueChanged - Campo: ${field}, Valor anterior: ${oldValue}, Valor nuevo: ${newValue}`);

      if (newValue !== oldValue) {
      if (field === 'description') {
        const normalizedDescription = this.normalizeText(newValue);
        if (normalizedDescription) {
          this.lastManualDescription = normalizedDescription;
        }
      }

      if (field === 'area') {
        this.lastManualArea = this.normalizeText(newValue);
      }

      if (field === 'package') {
        this.lastManualPackage = this.normalizeText(newValue);
      }

      if (data.__isNew) {
        // Para filas nuevas, solo marcar que hay cambios
        this.notSavedChanges = true;
        console.log('Fila nueva modificada, notSavedChanges =', this.notSavedChanges);
      } else {
        // Para filas existentes, marcar como modificada
        data.__modified = true;
        this.notSavedChanges = true;
        console.log('Fila existente modificada, notSavedChanges =', this.notSavedChanges);
      }
      console.log(`Campo ${field} cambiado de ${oldValue} a ${newValue}`);
      
      // Forzar detección de cambios
      setTimeout(() => {
        console.log('Estado final notSavedChanges:', this.notSavedChanges);
      });
    }
  }

  // Método adicional para detectar cambios en la edición de celdas
  onCellEditingStarted(event: any): void {
    console.log('Edición iniciada en celda:', event.colDef.field);
  }

  onCellEditingStopped(event: any): void {
    console.log('Edición finalizada en celda:', event.colDef.field);
    // Verificar si hay cambios pendientes después de cada edición
    this.updateNotSavedChangesStatus();

    if (event?.colDef?.field === 'cuentaHoja' && this.gridApi) {
      setTimeout(() => {
        const rowIndex = event?.rowIndex ?? 0;
        this.gridApi.setFocusedCell(rowIndex, 'otNumber');
        this.gridApi.startEditingCell({ rowIndex, colKey: 'otNumber' });
      }, 0);
    }

    if (event?.colDef?.field === 'otNumber' && this.gridApi) {
      setTimeout(() => {
        const rowIndex = event?.rowIndex ?? 0;
        this.gridApi.setFocusedCell(rowIndex, 'cdc');
        this.gridApi.startEditingCell({ rowIndex, colKey: 'cdc' });
      }, 0);
    }

    if (event?.colDef?.field === 'cdc' && this.gridApi) {
      setTimeout(() => {
        const rowIndex = event?.rowIndex ?? 0;
        this.gridApi.setFocusedCell(rowIndex, 'observations');
        this.gridApi.startEditingCell({ rowIndex, colKey: 'observations' });
      }, 0);
    }
  }

  onCellKeyDown(event: any): void {
    if (event?.event?.key !== 'Enter') {
      return;
    }

    const field = event?.colDef?.field;
    if (field === 'cuentaHoja' && this.gridApi) {
      event.event.preventDefault();
      event.event.stopPropagation();
      setTimeout(() => {
        const rowIndex = event?.rowIndex ?? 0;
        this.gridApi.setFocusedCell(rowIndex, 'otNumber');
        this.gridApi.startEditingCell({ rowIndex, colKey: 'otNumber' });
      }, 0);
      return;
    }

    if (field === 'cdc' && this.gridApi) {
      event.event.preventDefault();
      event.event.stopPropagation();
      setTimeout(() => {
        const rowIndex = event?.rowIndex ?? 0;
        this.gridApi.setFocusedCell(rowIndex, 'observations');
        this.gridApi.startEditingCell({ rowIndex, colKey: 'observations' });
      }, 0);
    }
  }

  // Método para actualizar el estado de cambios no guardados
  updateNotSavedChangesStatus(): void {
    const hasNewRows = this.rowData.some(row => row.__isNew);
    const hasModifiedRows = this.rowData.some(row => row.__modified);
    const previousState = this.notSavedChanges;
    
    this.notSavedChanges = hasNewRows || hasModifiedRows;
    
    if (previousState !== this.notSavedChanges) {
      console.log('Estado de notSavedChanges actualizado:', this.notSavedChanges);
    }
  }

  private getAreaOptions(): string[] {
    return this.catalogArea
      .map(area => this.normalizeText(area?.description))
      .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);
  }

  private rememberLastManualValues(): void {
    const latestRow = this.rowData[0];
    if (!latestRow) {
      return;
    }

    this.lastManualDescription = this.normalizeText(latestRow.description) || this.lastManualDescription;
    this.lastManualArea = this.normalizeText(latestRow.area) || this.lastManualArea;
    this.lastManualPackage = this.normalizeText(latestRow.package) || this.lastManualPackage;
  }

  private getNextCuentaHoja(): string {
    const lastSheet = this.rowData
      .map(row => this.normalizeText(row.cuentaHoja?.toString()))
      .find(value => /^\d+$/.test(value));

    return lastSheet ? (Number(lastSheet) + 1).toString() : '';
  }

  private compareOtsNewestFirst(left: any, right: any): number {
    const leftDate = this.parseOtDate(left);
    const rightDate = this.parseOtDate(right);

    if (leftDate && rightDate && leftDate.getTime() !== rightDate.getTime()) {
      return rightDate.getTime() - leftDate.getTime();
    }

    const leftId = Number(left?.id ?? 0);
    const rightId = Number(right?.id ?? 0);
    return rightId - leftId;
  }

  private parseOtDate(ot: any): Date | null {
    const rawDate = ot?.registerDate ?? ot?.RegisterDate ?? ot?.date ?? ot?.Date ?? ot?.createdAt ?? ot?.CreatedAt;
    if (!rawDate) {
      return null;
    }

    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private normalizeText(value: string | null | undefined): string {
    return (value ?? '').toString().trim().replace(/\s+/g, ' ');
  }

  private toNumberOrNull(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  // Métodos CRUD
  addRow(): void {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo historicoOT', 'Proyectos', this.trackingService.getEmail());
    const tempId = `temp_${this.tempIdCounter++}`;
    const currentProject = this.signalsService.getProjectSelectedBySidebar()();
    const currentProjectData = this.projectsList.find(p => p.id === currentProject);
    const defaultDescription = this.normalizeText(this.lastManualDescription) || 'RECONEXION DE MEDIDOR';
    
    // Validar que hay un proyecto seleccionado
    if (!currentProject) {
      alerts.basicAlert('Advertencia', 'Debe seleccionar un proyecto antes de agregar una OT', 'warning');
      return;
    }
    
    const newItem: HistoricoOTData = {
      id: undefined,
      idProject: currentProject,
      projectName: currentProjectData ? currentProjectData.name : 'Sin proyecto',
      cuentaHoja: this.getNextCuentaHoja(),
      otNumber: '',
      cdc: '',
      package: this.lastManualPackage,
      description: defaultDescription,
      observations: '',
      area: this.lastManualArea,
      closed: false,
      closedApp: false
    };
    
    // Agregar propiedades de control
    (newItem as any).__isNew = true;
    (newItem as any).tempId = tempId;
    
    this.rowData = [newItem, ...this.rowData];
    this.updateNotSavedChangesStatus();
    
    console.log('Nueva fila agregada, notSavedChanges:', this.notSavedChanges);
    
    // Enfocar en la primera celda editable (otNumber en lugar de idProject)
    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.setFocusedCell(0, 'cuentaHoja');
        this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'cuentaHoja' });
      }
    }, 100);
  }

  saveChanges(): void {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en historicoOT', 'Proyectos', this.trackingService.getEmail());
    this.gridApi?.stopEditing();
    const newRows = this.rowData.filter(row => row.__isNew);
    const modifiedRows = this.rowData.filter(row => row.__modified && !row.__isNew);

    // Validar filas nuevas - campos requeridos y proyecto válido
    const invalidNewRows = newRows.filter(item =>
      !item.otNumber?.trim() || !item.cdc?.trim() || !item.description?.trim() || !item.idProject
    );

    if (invalidNewRows.length > 0) {
      const missingFields = invalidNewRows.map((item, index) => {
        const fields: string[] = [];
        if (!item.otNumber?.trim()) fields.push('Número OT');
        if (!item.cdc?.trim()) fields.push('CDC');
        if (!item.description?.trim()) fields.push('Descripción');
        if (!item.idProject) fields.push('Proyecto');
        return `${index + 1}) Faltan: ${fields.join(', ')}`;
      }).join(' | ');

      alerts.basicAlert(
        'Validación', 
        `Complete los campos obligatorios antes de guardar. ${missingFields}`, 
        'warning'
      );
      return;
    }

    // Validar filas modificadas - proyecto válido
    const invalidModifiedRows = modifiedRows.filter(item => !item.idProject);
    
    if (invalidModifiedRows.length > 0) {
      alerts.basicAlert(
        'Validación', 
        'Hay registros sin proyecto asignado. Verifique los datos.', 
        'warning'
      );
      return;
    }

    if (newRows.length === 0 && modifiedRows.length === 0) {
      alerts.basicAlert('Info', 'No hay cambios para guardar', 'info');
      return;
    }

    let completedOperations = 0;
    const totalOperations = newRows.length + modifiedRows.length;

    // Procesar filas nuevas - CREATE
    newRows.forEach(row => {
      const newOtData = {
        idProject: row.idProject,
        cuentaHoja: this.toNumberOrNull(row.cuentaHoja),
        otNumber: row.otNumber,
        cdc: row.cdc,
        package: row.package || '',
        description: row.description,
        observations: row.observations,
        area: row.area || '',
        closed: row.closed || false,
        closedApp: row.closedApp || false
      };

      console.log('Enviando datos para crear OT:', newOtData);
      console.log('URL del endpoint:', `${environment.urlSmp}/OT`);

      this.otService.addOt(newOtData).subscribe({
        next: (response: any) => {
          console.log('OT creada exitosamente:', response);
          // Actualizar el ID de la fila con el ID devuelto por el servidor
          row.id = response.id || response;
          this.lastManualDescription = this.normalizeText(row.description) || this.lastManualDescription;
          this.lastManualArea = this.normalizeText(row.area) || this.lastManualArea;
          this.lastManualPackage = this.normalizeText(row.package) || this.lastManualPackage;
          delete row.__isNew;
          delete (row as any).tempId;

          alerts.basicAlert('Guardado', `Se guardó correctamente la OT manual ${row.otNumber}.`, 'success');
          
          completedOperations++;
          if (completedOperations === totalOperations) {
            this.updateNotSavedChangesStatus();
            alerts.basicAlert('Éxito', 'Registro(s) guardado(s) correctamente.', 'success');
            // Recargar datos después de guardar exitosamente
            const currentProject = this.signalsService.getProjectSelectedBySidebar()();
            if (currentProject) {
              this.loadData(currentProject);
            }
          }
        },
        error: (error) => {
          console.error('Error al crear OT:', error);
          console.error('Detalles del error:', error.error);
          console.error('Estado HTTP:', error.status);
          alerts.basicAlert('Error', `No se pudo guardar la OT manual ${row.otNumber}. ${error.error?.message || error.message || 'Verifique los datos e intente nuevamente.'}`, 'error');
        }
      });
    });

    // Procesar filas modificadas - UPDATE
    modifiedRows.forEach(row => {
      if (!row.id) {
        completedOperations++;
        return;
      }

      const updateOtData = {
        id: row.id,
        idProject: row.idProject,
        cuentaHoja: this.toNumberOrNull(row.cuentaHoja),
        otNumber: row.otNumber,
        cdc: row.cdc,
        package: row.package || '',
        description: row.description,
        observations: row.observations,
        area: row.area || '',
        closed: row.closed || false,
        closedApp: row.closedApp || false
      };

      this.otService.updateOt(row.id, updateOtData).subscribe({
        next: (response: any) => {
          console.log('OT actualizada exitosamente:', response);
          this.lastManualDescription = this.normalizeText(row.description) || this.lastManualDescription;
          this.lastManualArea = this.normalizeText(row.area) || this.lastManualArea;
          this.lastManualPackage = this.normalizeText(row.package) || this.lastManualPackage;
          delete row.__modified;

          alerts.basicAlert('Guardado', `Se actualizó correctamente la OT manual ${row.otNumber}.`, 'success');
          
          completedOperations++;
          if (completedOperations === totalOperations) {
            this.updateNotSavedChangesStatus();
            alerts.basicAlert('Éxito', 'Registro(s) guardado(s) correctamente.', 'success');
            // Recargar datos después de guardar exitosamente
            const currentProject = this.signalsService.getProjectSelectedBySidebar()();
            if (currentProject) {
              this.loadData(currentProject);
            }
          }
        },
        error: (error) => {
          console.error('Error al actualizar OT:', error);
          alerts.basicAlert('Error', `No se pudo actualizar la OT manual ${row.otNumber}. ${error.error?.message || error.message || 'Verifique los datos e intente nuevamente.'}`, 'error');
        }
      });
    });
  }

  revert(): void {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Deshizo cambios en historicoOT', 'Proyectos', this.trackingService.getEmail());
    const currentProject = this.signalsService.getProjectSelectedBySidebar()();
    if (currentProject) {
      this.loadData(currentProject);
    } else {
      this.loadData();
    }
    this.updateNotSavedChangesStatus();
    alerts.basicAlert('Info', 'Cambios revertidos', 'info');
  }

  deleteEntry(): void {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Eliminó historicoOT', 'Proyectos', this.trackingService.getEmail());
    const selectedNodes = this.gridApi.getSelectedNodes();
    
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Advertencia', 'Seleccione una fila para eliminar', 'warning');
      return;
    }
    
    const selectedData = selectedNodes[0].data;
    
    if (confirm('¿Está seguro de que desea eliminar este registro?')) {
      // Si es una fila nueva (no guardada), solo eliminarla del grid
      if (selectedData.__isNew) {
        this.rowData = this.rowData.filter(row => row !== selectedData);
        this.updateNotSavedChangesStatus();
        alerts.basicAlert('Éxito', 'Registro eliminado', 'success');
        return;
      }

      // Si tiene ID, llamar al endpoint para eliminar
      if (selectedData.id) {
        this.otService.deleteOt(selectedData.id).subscribe({
          next: (response: any) => {
            console.log('OT eliminada exitosamente:', response);
            this.rowData = this.rowData.filter(row => row !== selectedData);
            this.updateNotSavedChangesStatus();
            alerts.basicAlert('Éxito', 'OT eliminada exitosamente', 'success');
          },
          error: (error) => {
            console.error('Error al eliminar OT:', error);
            alerts.basicAlert('Error', 'Error al eliminar la OT', 'error');
          }
        });
      } else {
        // Fallback: eliminar del grid si no tiene ID
        this.rowData = this.rowData.filter(row => row !== selectedData);
        this.updateNotSavedChangesStatus();
        alerts.basicAlert('Éxito', 'Registro eliminado', 'success');
      }
    }
  }
}
