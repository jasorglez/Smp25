import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { firstValueFrom } from 'rxjs';

// Importar los servicios que vamos a necesitar
import { OtService } from 'app/services/ot.service';
import { LogbookService } from 'app/services/logbook.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { ProjectsService } from 'app/services/projects.service';

@Component({
  selector: 'app-reportes-estimaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './reportes-estimaciones.component.html',
  styleUrl: './reportes-estimaciones.component.scss'
})
export class ReportesEstimacionesComponent {

  // Inyectar servicios
  private otService = inject(OtService);
  private logbookService = inject(LogbookService);
  private workprogramsService = inject(WorkprogramsService);
  private signalsService = inject(SignalsService);
  private projectsService = inject(ProjectsService);

  // Propiedades para los filtros
  fechaInicio: string = '';
  fechaFin: string = '';
  isLoading: boolean = false;

  // Lista de proyectos para el combo box
  public projectsList: any[] = [];

  // Cache de conceptos por proyecto para carga on-demand
  private conceptsCache: { [projectId: number]: any[] } = {};

  // Cache de OT para combo box
  private otCache: any[] = [];
  
  // Propiedades para el grid
  private gridApi: GridApi;
  public rowData: any[] = [];
  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 150, // Ancho mínimo para evitar que las columnas se aplasten
    cellStyle: { 'vertical-align': 'middle' }
  };

  public gridOptions: any = {
    headerHeight: 35,
    rowHeight: 25,
    suppressDragLeaveHidesColumns: true,
    suppressHorizontalScroll: true,
    animateRows: true,
    pagination: false,
    domLayout: 'normal',
    singleClickEdit: true,
    stopEditingWhenCellsLoseFocus: true
  };

  columnDefs: ColDef[] = [
     {
       headerName: 'Numero OS',
       field: 'otNumber',
       pinned: 'left',
       width: 70,
       editable: true,
       cellEditor: 'agRichSelectCellEditor',
       cellEditorParams: {
         values: () => this.otCache.map(ot => ot.otNumber),
         formatValue: (value: any) => value
       },
       valueGetter: (params) => {
         return params.data.otNumber || '';
       },
       valueSetter: (params) => {
         const selectedOtNumber = params.newValue;
         const selectedOt = this.otCache.find(ot => ot.otNumber === selectedOtNumber);
         if (selectedOt) {
           // Actualizar campos relacionados si es necesario
           params.data.otNumber = selectedOt.otNumber;
           params.data.idOt = selectedOt.id; // Asumir que tiene id
           // Otros campos como cdc, etc., si se quieren actualizar
           return true;
         }
         return false;
       }
     },
    { headerName: 'INMUEBLE', field: 'cdc', pinned: 'left', width: 90 },
    { headerName: 'Nombre del servicio', field: 'descripTD', width: 300 },
    { headerName: 'Colonia', field: 'neighborhood' },
    { headerName: 'Calle', field: 'address' },
    {
      headerName: 'Cuadrilla',
      field: 'name',
      editable: true,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: {
        values: () => this.projectsList.map(p => p.name),
        formatValue: (value: any) => value
      },
      valueGetter: (params) => {
        return params.data?.name || '';
      },
      valueSetter: (params) => {
        const selectedProject = this.projectsList.find(p => p.name === params.newValue);
        if (selectedProject) {
          params.data.idProject = selectedProject.id;
          params.data.name = selectedProject.name;
          return true;
        }
        return false;
      },
      onCellValueChanged: (params: any) => {
        this.onCuadrillaChanged(params);
      }
    },
    {
      headerName: 'Trabajo realizado',
      field: 'descripConcepto',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (params: any) => ({
        values: this.getConceptsForProject(params.data.idProject),
        filterList: true,
        placeholder: 'Selecciona trabajo...'
      }),
      valueGetter: (params) => {
        return params.data.descripConcepto || '';
      },
      valueSetter: (params) => {
        const selectedConceptName = params.newValue;
        const projectId = params.data.idProject;
        const concepts = this.conceptsCache[projectId];
        if (concepts) {
          const concept = concepts.find(c => c.actandNom === selectedConceptName);
          if (concept) {
            params.data.descripConcepto = concept.actandNom;
            params.data.idResource = concept.id; // Asumir que existe o agregar si no
            return true;
          }
        }
        // Si no encuentra, al menos setear el nombre
        params.data.descripConcepto = selectedConceptName;
        return true;
      }
    },
    { headerName: 'Resultado del Trabajo', field: 'results' },
    { headerName: 'Cantidad', field: 'quantity', type: 'numericColumn' },
    {
      headerName: 'Fecha de Asignacion',
      field: 'registerDate',
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        return '';
      }
    },
    {
      headerName: 'Fecha de Ejecucion',
      field: 'fechaLogbook',
      valueFormatter: (params) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        return '';
      }
    },
    { headerName: 'Area', field: 'area' },
    { headerName: 'Validado', field: 'validado' },
    { headerName: 'Observaciones', field: 'observations', width: 300 }
  ];

  constructor() {
    // Inicializar fechas por defecto (último mes)
    const hoy = new Date();
    const haceUnMes = new Date();
    haceUnMes.setMonth(hoy.getMonth() - 1);

    this.fechaInicio = haceUnMes.toISOString().split('T')[0];
    this.fechaFin = hoy.toISOString().split('T')[0];
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('rowHeight', 35);
    this.gridApi.setGridOption('headerHeight', 40);
  }

  /**
   * Método principal que se llamará al presionar el botón "Consultar".
   * Orquestará la carga de datos y la construcción de la grilla.
   */
  consultarEstimaciones() {
    if (!this.fechaInicio || !this.fechaFin) {
      alerts.basicAlert('Error', 'Por favor, seleccione un rango de fechas válido.', 'error');
      return;
    }
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (!idRoot) {
      alerts.basicAlert('Error', 'No se ha seleccionado una compañía.', 'error');
      return;
    }

    // Cargar lista de proyectos si no está cargada
    if (this.projectsList.length === 0) {
      this.projectsService.getProjectListByCompany(idRoot).subscribe({
        next: (data: any) => {
          this.projectsList = data;
          console.log('Proyectos cargados:', this.projectsList);
        },
        error: (error) => {
          console.error('Error al cargar proyectos:', error);
          alerts.basicAlert('Error', 'Error al cargar la lista de proyectos.', 'error');
        }
      });
    }

    // Cargar lista de OT si no está cargada
    if (this.otCache.length === 0) {
      this.otService.getOtAllt(idRoot).subscribe({
        next: (data: any) => {
          this.otCache = data;
          console.log('OT cargadas:', this.otCache);
        },
        error: (error) => {
          console.error('Error al cargar OT:', error);
          alerts.basicAlert('Error', 'Error al cargar la lista de OT.', 'error');
        }
      });
    }

    console.log(`Consultando datos desde ${this.fechaInicio} hasta ${this.fechaFin} para idRoot ${idRoot}`);
    this.isLoading = true;

    this.logbookService.getOtListxReport(idRoot, this.fechaInicio, this.fechaFin).subscribe({
      next: (data) => {
        this.rowData = data;
        this.isLoading = false;
        console.log('Datos obtenidos:', data);

        // Cargar conceptos para proyectos únicos en los datos
        this.loadConceptsForVisibleProjects(data);
      },
      error: (error) => {
        this.isLoading = false;
        alerts.basicAlert('Error', 'Error al consultar los datos.', 'error');
        console.error('Error:', error);
      }
    });
  }

  exportarExcel() {
    if (this.gridApi) {
      this.gridApi.exportDataAsExcel({
        fileName: `Reporte_Estimaciones_${new Date().toISOString().split('T')[0]}.xlsx`
      });
    }
  }

  // Método para cargar conceptos de proyectos visibles en los datos
  loadConceptsForVisibleProjects(data: any[]) {
    const uniqueProjectIds = [...new Set(data.map(row => row.idProject).filter(id => id))];
    uniqueProjectIds.forEach(projectId => {
      if (!this.conceptsCache[projectId]) {
        this.workprogramsService.getActivities(projectId).subscribe({
          next: (concepts) => {
            this.conceptsCache[projectId] = concepts;
            console.log(`Conceptos cargados para proyecto ${projectId}:`, concepts);
          },
          error: (error) => {
            console.error(`Error al cargar conceptos para proyecto ${projectId}:`, error);
          }
        });
      }
    });
  }

  // Método para obtener conceptos de un proyecto (desde cache)
  getConceptsForProject(projectId: number): string[] {
    if (this.conceptsCache[projectId]) {
      return this.conceptsCache[projectId].map(c => c.actandNom);
    }
    return [];
  }

  onCuadrillaChanged(params: any) {
    if (params.newValue === params.oldValue) {
      return; // No change
    }

    const rowData = params.data;
    const idLogbook = rowData.idLogbook; // Assuming the data has idLogbook

    if (!idLogbook) {
      alerts.basicAlert('Error', 'No se encontró el ID del logbook para actualizar.', 'error');
      return;
    }

    const selectedProject = this.projectsList.find(p => p.name === params.newValue);
    if (!selectedProject) {
      alerts.basicAlert('Error', 'Proyecto seleccionado no válido.', 'error');
      return;
    }

    // Prepare data to update
    const updateData = {
      idProject: selectedProject.id,
      // Include other necessary fields if needed
      idOt: rowData.idOt,
      idReporte: rowData.idReporte,
      typeNote: 'LOG', // Assuming type for logbook
      description: 'Actualización de proyecto',
      quantity: rowData.quantity || 1,
      date: rowData.fechaLogbook || new Date().toISOString().split('T')[0],
      start: '08:00:00',
      end: '17:00:00'
    };

    this.logbookService.updateDataForOt(idLogbook, updateData).subscribe({
      next: (response) => {
        console.log('Logbook actualizado:', response);
        alerts.basicAlert('Éxito', 'Proyecto de la cuadrilla actualizado correctamente.', 'success');
      },
      error: (error) => {
        console.error('Error al actualizar logbook:', error);
        alerts.basicAlert('Error', 'Error al actualizar el proyecto de la cuadrilla.', 'error');
        // Revert the change
        params.node.setDataValue('name', params.oldValue);
      }
    });
  }
}