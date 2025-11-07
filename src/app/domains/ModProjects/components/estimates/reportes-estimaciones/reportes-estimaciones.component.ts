import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, CellDoubleClickedEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { firstValueFrom } from 'rxjs';

// Importar los servicios que vamos a necesitar
import { OtService } from 'app/services/ot.service';
import { LogbookService } from 'app/services/logbook.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { ProjectsService } from 'app/services/projects.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { ModalService } from 'app/services/modal.service';

@Component({
  selector: 'app-reportes-estimaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, MultiLineEditorComponent],
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
  private modalService = inject(ModalService);

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

  // Flag para prevenir llamadas recursivas en onCuadrillaChanged
  private isUpdatingCuadrilla: boolean = false;

  // Flag para prevenir llamadas recursivas en onValidadoChanged
  private isUpdatingValidado: boolean = false;

  // Flag para prevenir llamadas recursivas en onObservationsChanged
  private isUpdatingObservations: boolean = false;

  // Flag para prevenir llamadas recursivas en onResultsChanged
  private isUpdatingResults: boolean = false;

  // Flag para prevenir llamadas recursivas en onClassificationChanged
  private isUpdatingClassification: boolean = false;

  // Flag para prevenir llamadas recursivas en onQuantityChanged
  private isUpdatingQuantity: boolean = false;

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
    stopEditingWhenCellsLoseFocus: true,
    enableBrowserTooltips: true,
    getContextMenuItems: (params: any) => this.getContextMenuItems(params),
    getRowStyle: (params: any) => {
      if (params.data?.downloaded === true) {
        return { background: '#d4edda' }; // Verde claro para filas descargadas
      }
      return undefined;
    }
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
    {
      headerName: 'Resultado del Trabajo',
      field: 'results',
      width: 300,
      editable: false,
      onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
        if (!event.node.group) {
          this.modalService.showModal({
            params: event,
            value: event.value
          });
        }
      },
      onCellValueChanged: (params: any) => {
        this.onResultsChanged(params);
      },
      cellRenderer: (params: ICellRendererParams) => {
        if (params.node.group) {
          return params.value;
        }
        return params.value;
      }
    },
    {
      headerName: 'Cantidad',
      field: 'quantity',
      type: 'numericColumn',
      editable: true,
      onCellValueChanged: (params: any) => {
        this.onQuantityChanged(params);
      }
    },
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
    {
      headerName: 'Validado',
      field: 'validado',
      editable: true,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: {
        values: ['PAGO', 'NO PAGO']
      },
      onCellValueChanged: (params: any) => {
        this.onValidadoChanged(params);
      }
    },
    {
      headerName: 'Observaciones',
      field: 'observations',
      width: 300,
      editable: false,
      onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
        if (!event.node.group) {
          this.modalService.showModal({
            params: event,
            value: event.value
          });
        }
      },
      onCellValueChanged: (params: any) => {
        this.onObservationsChanged(params);
      },
      cellRenderer: (params: ICellRendererParams) => {
        if (params.node.group) {
          return params.value;
        }
        return params.value;
      }
    },
    {
      headerName: 'Clasificación',
      field: 'classification',
      editable: true,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: {
        values: ['Interna', 'Externa']
      },
      onCellValueChanged: (params: any) => {
        this.onClassificationChanged(params);
      }
    },
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

  /**
   * Recarga solo los datos de la tabla sin cambiar filtros ni proyectos
   */
  reloadTableData() {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    if (!idRoot || !this.fechaInicio || !this.fechaFin) {
      return;
    }

    this.logbookService.getOtListxReport(idRoot, this.fechaInicio, this.fechaFin).subscribe({
      next: (data) => {
        this.rowData = data;
        console.log('Datos recargados:', data.length, 'registros');
      },
      error: (error) => {
        console.error('Error al recargar datos:', error);
        alerts.basicAlert('Error', 'Error al recargar los datos.', 'error');
      }
    });
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
    // Prevenir llamadas recursivas
    if (this.isUpdatingCuadrilla) {
      console.log('Llamada recursiva detectada, ignorando...');
      return;
    }

    if (params.newValue === params.oldValue) {
      return; // No change
    }

    const rowData = params.data;
    const idLogbook = rowData.idLogbook;

    console.log('=== onCuadrillaChanged ===');
    console.log('idLogbook obtenido:', idLogbook);
    console.log('rowData completo:', rowData);

    if (!idLogbook) {
      alerts.basicAlert('Error', 'No se encontró el ID del logbook para actualizar.', 'error');
      return;
    }

    const selectedProject = this.projectsList.find(p => p.name === params.newValue);
    if (!selectedProject) {
      alerts.basicAlert('Error', 'Proyecto seleccionado no válido.', 'error');
      return;
    }

    console.log('Proyecto seleccionado:', selectedProject);

    // Activar flag para prevenir recursión
    this.isUpdatingCuadrilla = true;

    // Obtener los datos completos del logbook primero
    this.logbookService.getDataForLogbook(idLogbook).subscribe({
      next: (response) => {
        console.log('Respuesta de getDataForLogbook:', response);

        if (response.success && response.data) {
          // Modificar solo el idProject en los datos obtenidos
          const logbookData = response.data;
          logbookData.idProject = selectedProject.id;

          console.log('Datos a enviar a updateDataForOt:', logbookData);

          // Enviar todo el objeto completo a updateDataForOt
          this.logbookService.updateDataForOt(idLogbook, logbookData).subscribe({
            next: (updateResponse) => {
              console.log('Respuesta de updateDataForOt:', updateResponse);
              alerts.basicAlert('Éxito', 'Proyecto de la cuadrilla actualizado correctamente.', 'success');
              this.isUpdatingCuadrilla = false;
            },
            error: (error) => {
              console.error('Error al actualizar logbook:', error);
              alerts.basicAlert('Error', 'Error al actualizar el proyecto de la cuadrilla.', 'error');
              // Revert the change
              params.node.setDataValue('name', params.oldValue);
              this.isUpdatingCuadrilla = false;
            }
          });
        } else {
          console.error('Respuesta sin éxito o sin data:', response);
          alerts.basicAlert('Error', 'No se pudieron obtener los datos del logbook.', 'error');
          params.node.setDataValue('name', params.oldValue);
          this.isUpdatingCuadrilla = false;
        }
      },
      error: (error) => {
        console.error('Error al obtener datos del logbook:', error);
        alerts.basicAlert('Error', 'Error al obtener los datos del logbook.', 'error');
        // Revert the change
        params.node.setDataValue('name', params.oldValue);
        this.isUpdatingCuadrilla = false;
      }
    });
  }

  onClassificationChanged(params: any) {
    // Prevenir llamadas recursivas
    if (this.isUpdatingClassification) {
      console.log('Llamada recursiva detectada en Classification, ignorando...');
      return;
    }

    if (params.newValue === params.oldValue) {
      return; // No change
    }

    const rowData = params.data;
    const idLogbook = rowData.idLogbook;
    const classification = params.newValue; // 'Interna' o 'Externa'

    console.log('=== onClassificationChanged ===');
    console.log('idLogbook obtenido:', idLogbook);
    console.log('Nueva clasificación:', classification);

    if (!idLogbook) {
      alerts.basicAlert('Error', 'No se encontró el ID del logbook para actualizar.', 'error');
      return;
    }

    // Activar flag para prevenir recursión
    this.isUpdatingClassification = true;

    // Obtener los datos completos del logbook primero
    this.logbookService.getDataForLogbook(idLogbook).subscribe({
      next: (response) => {
        console.log('Respuesta de getDataForLogbook (Classification):', response);

        if (response.success && response.data) {
          // Modificar solo el campo classification en los datos obtenidos
          const logbookData = response.data;
          logbookData.classification = classification;

          console.log('Datos a enviar a updateDataForOt (Classification):', logbookData);

          // Enviar todo el objeto completo a updateDataForOt
          this.logbookService.updateDataForOt(idLogbook, logbookData).subscribe({
            next: (updateResponse) => {
              console.log('Respuesta de updateDataForOt (Classification):', updateResponse);
              alerts.basicAlert('Éxito', `Clasificación actualizada a "${classification}".`, 'success');
              this.isUpdatingClassification = false;
            },
            error: (error) => {
              console.error('Error al actualizar clasificación:', error);
              alerts.basicAlert('Error', 'Error al actualizar la clasificación.', 'error');
              // Revert the change
              params.node.setDataValue('classification', params.oldValue);
              this.isUpdatingClassification = false;
            }
          });
        } else {
          console.error('Respuesta sin éxito o sin data (Classification):', response);
          alerts.basicAlert('Error', 'No se pudieron obtener los datos del logbook.', 'error');
          params.node.setDataValue('classification', params.oldValue);
          this.isUpdatingClassification = false;
        }
      },
      error: (error) => {
        console.error('Error al obtener datos del logbook (Classification):', error);
        alerts.basicAlert('Error', 'Error al obtener los datos del logbook.', 'error');
        // Revert the change
        params.node.setDataValue('classification', params.oldValue);
        this.isUpdatingClassification = false;
      }
    });
  }

  onQuantityChanged(params: any) {
    // Prevenir llamadas recursivas
    if (this.isUpdatingQuantity) {
      console.log('Llamada recursiva detectada en Quantity, ignorando...');
      return;
    }

    if (params.newValue === params.oldValue) {
      return; // No change
    }

    const rowData = params.data;
    const idLogbook = rowData.idLogbook;
    const newQuantity = params.newValue;

    console.log('=== onQuantityChanged ===');
    console.log('idLogbook obtenido:', idLogbook);
    console.log('Nueva cantidad:', newQuantity);

    if (!idLogbook) {
      alerts.basicAlert('Error', 'No se encontró el ID del logbook para actualizar.', 'error');
      return;
    }

    // Validar que la cantidad sea válida
    if (newQuantity === null || newQuantity === undefined || newQuantity < 0) {
      alerts.basicAlert('Error', 'La cantidad debe ser un valor numérico válido mayor o igual a 0.', 'error');
      params.node.setDataValue('quantity', params.oldValue);
      return;
    }

    // Activar flag para prevenir recursión
    this.isUpdatingQuantity = true;

    // Obtener los datos completos del logbook primero
    this.logbookService.getDataForLogbook(idLogbook).subscribe({
      next: (response) => {
        console.log('Respuesta de getDataForLogbook (Quantity):', response);

        if (response.success && response.data) {
          // Modificar solo el campo quantity en los datos obtenidos
          const logbookData = response.data;
          logbookData.quantity = newQuantity;

          console.log('Datos a enviar a updateDataForOt (Quantity):', logbookData);

          // Enviar todo el objeto completo a updateDataForOt
          this.logbookService.updateDataForOt(idLogbook, logbookData).subscribe({
            next: (updateResponse) => {
              console.log('Respuesta de updateDataForOt (Quantity):', updateResponse);
              alerts.basicAlert('Éxito', `Cantidad actualizada a ${newQuantity}.`, 'success');
              this.isUpdatingQuantity = false;
            },
            error: (error) => {
              console.error('Error al actualizar cantidad:', error);
              alerts.basicAlert('Error', 'Error al actualizar la cantidad.', 'error');
              // Revert the change
              params.node.setDataValue('quantity', params.oldValue);
              this.isUpdatingQuantity = false;
            }
          });
        } else {
          console.error('Respuesta sin éxito o sin data (Quantity):', response);
          alerts.basicAlert('Error', 'No se pudieron obtener los datos del logbook.', 'error');
          params.node.setDataValue('quantity', params.oldValue);
          this.isUpdatingQuantity = false;
        }
      },
      error: (error) => {
        console.error('Error al obtener datos del logbook (Quantity):', error);
        alerts.basicAlert('Error', 'Error al obtener los datos del logbook.', 'error');
        // Revert the change
        params.node.setDataValue('quantity', params.oldValue);
        this.isUpdatingQuantity = false;
      }
    });
  }

  onValidadoChanged(params: any) {
    // Prevenir llamadas recursivas
    if (this.isUpdatingValidado) {
      console.log('Llamada recursiva detectada en Validado, ignorando...');
      return;
    }

    if (params.newValue === params.oldValue) {
      return; // No change
    }

    const rowData = params.data;
    const idLogbook = rowData.idLogbook;

    console.log('=== onValidadoChanged ===');
    console.log('idLogbook obtenido:', idLogbook);
    console.log('Valor nuevo:', params.newValue);
    console.log('Valor anterior:', params.oldValue);

    if (!idLogbook) {
      alerts.basicAlert('Error', 'No se encontró el ID del logbook para actualizar.', 'error');
      return;
    }

    // Activar flag para prevenir recursión
    this.isUpdatingValidado = true;

    // Obtener los datos completos del logbook primero
    this.logbookService.getDataForLogbook(idLogbook).subscribe({
      next: (response) => {
        console.log('Respuesta de getDataForLogbook (Validado):', response);

        if (response.success && response.data) {
          // Modificar solo el campo validado en los datos obtenidos
          const logbookData = response.data;
          logbookData.validado = params.newValue;

          console.log('Datos a enviar a updateDataForOt (Validado):', logbookData);

          // Enviar todo el objeto completo a updateDataForOt
          this.logbookService.updateDataForOt(idLogbook, logbookData).subscribe({
            next: (updateResponse) => {
              console.log('Respuesta de updateDataForOt (Validado):', updateResponse);
              alerts.basicAlert('Éxito', 'Estado de validación actualizado correctamente.', 'success');
              this.isUpdatingValidado = false;
            },
            error: (error) => {
              console.error('Error al actualizar validado:', error);
              alerts.basicAlert('Error', 'Error al actualizar el estado de validación.', 'error');
              // Revert the change
              params.node.setDataValue('validado', params.oldValue);
              this.isUpdatingValidado = false;
            }
          });
        } else {
          console.error('Respuesta sin éxito o sin data (Validado):', response);
          alerts.basicAlert('Error', 'No se pudieron obtener los datos del logbook.', 'error');
          params.node.setDataValue('validado', params.oldValue);
          this.isUpdatingValidado = false;
        }
      },
      error: (error) => {
        console.error('Error al obtener datos del logbook (Validado):', error);
        alerts.basicAlert('Error', 'Error al obtener los datos del logbook.', 'error');
        // Revert the change
        params.node.setDataValue('validado', params.oldValue);
        this.isUpdatingValidado = false;
      }
    });
  }

  onObservationsChanged(params: any) {
    // Prevenir llamadas recursivas
    if (this.isUpdatingObservations) {
      console.log('Llamada recursiva detectada en Observaciones, ignorando...');
      return;
    }

    if (params.newValue === params.oldValue) {
      return; // No change
    }

    const rowData = params.data;
    const idOt = rowData.idOt;

    console.log('=== onObservationsChanged ===');
    console.log('idOt obtenido:', idOt);
    console.log('Valor nuevo:', params.newValue);
    console.log('Valor anterior:', params.oldValue);

    if (!idOt) {
      alerts.basicAlert('Error', 'No se encontró el ID de la OT para actualizar.', 'error');
      return;
    }

    // Activar flag para prevenir recursión
    this.isUpdatingObservations = true;

    // Obtener los datos completos de la OT primero
    this.otService.getOtDetails(idOt).subscribe({
      next: (response) => {
        console.log('Respuesta de getOtDetails (Observaciones):', response);

        // La respuesta es un array con un objeto
        if (response && response.length > 0) {
          const otData = response[0];
          // Modificar solo el campo observations
          otData.observations = params.newValue;

          console.log('Datos a enviar a updateOt (Observaciones):', otData);

          // Enviar todo el objeto completo a updateOt
          this.otService.updateOt(idOt, otData).subscribe({
            next: (updateResponse) => {
              console.log('Respuesta de updateOt (Observaciones):', updateResponse);
              alerts.basicAlert('Éxito', 'Observaciones actualizadas correctamente.', 'success');
              this.isUpdatingObservations = false;
            },
            error: (error) => {
              console.error('Error al actualizar observaciones:', error);
              alerts.basicAlert('Error', 'Error al actualizar las observaciones.', 'error');
              // Revert the change
              params.node.setDataValue('observations', params.oldValue);
              this.isUpdatingObservations = false;
            }
          });
        } else {
          console.error('Respuesta vacía o sin datos (Observaciones):', response);
          alerts.basicAlert('Error', 'No se pudieron obtener los datos de la OT.', 'error');
          params.node.setDataValue('observations', params.oldValue);
          this.isUpdatingObservations = false;
        }
      },
      error: (error) => {
        console.error('Error al obtener datos de la OT (Observaciones):', error);
        alerts.basicAlert('Error', 'Error al obtener los datos de la OT.', 'error');
        // Revert the change
        params.node.setDataValue('observations', params.oldValue);
        this.isUpdatingObservations = false;
      }
    });
  }

  onResultsChanged(params: any) {
    // Prevenir llamadas recursivas
    if (this.isUpdatingResults) {
      console.log('Llamada recursiva detectada en Results, ignorando...');
      return;
    }

    if (params.newValue === params.oldValue) {
      return; // No change
    }

    const rowData = params.data;
    const idOt = rowData.idOt;

    console.log('=== onResultsChanged ===');
    console.log('idOt obtenido:', idOt);
    console.log('Valor nuevo:', params.newValue);
    console.log('Valor anterior:', params.oldValue);

    if (!idOt) {
      alerts.basicAlert('Error', 'No se encontró el ID de la OT para actualizar.', 'error');
      return;
    }

    // Activar flag para prevenir recursión
    this.isUpdatingResults = true;

    // Obtener los datos completos de la OT primero
    this.otService.getOtDetails(idOt).subscribe({
      next: (response) => {
        console.log('Respuesta de getOtDetails (Results):', response);

        // La respuesta es un array con un objeto
        if (response && response.length > 0) {
          const otData = response[0];
          // Modificar solo el campo results
          otData.results = params.newValue;

          console.log('Datos a enviar a updateOt (Results):', otData);

          // Enviar todo el objeto completo a updateOt
          this.otService.updateOt(idOt, otData).subscribe({
            next: (updateResponse) => {
              console.log('Respuesta de updateOt (Results):', updateResponse);
              alerts.basicAlert('Éxito', 'Resultado del trabajo actualizado correctamente.', 'success');
              this.isUpdatingResults = false;
            },
            error: (error) => {
              console.error('Error al actualizar results:', error);
              alerts.basicAlert('Error', 'Error al actualizar el resultado del trabajo.', 'error');
              // Revert the change
              params.node.setDataValue('results', params.oldValue);
              this.isUpdatingResults = false;
            }
          });
        } else {
          console.error('Respuesta vacía o sin datos (Results):', response);
          alerts.basicAlert('Error', 'No se pudieron obtener los datos de la OT.', 'error');
          params.node.setDataValue('results', params.oldValue);
          this.isUpdatingResults = false;
        }
      },
      error: (error) => {
        console.error('Error al obtener datos de la OT (Results):', error);
        alerts.basicAlert('Error', 'Error al obtener los datos de la OT.', 'error');
        // Revert the change
        params.node.setDataValue('results', params.oldValue);
        this.isUpdatingResults = false;
      }
    });
  }

  /**
   * Configura las opciones del menú contextual para ag-grid
   */
  getContextMenuItems(params: any) {
    console.log('getContextMenuItems llamado', params);

    const result: any[] = [
      {
        name: 'Descargar multimedia',
        action: () => {
          console.log('Acción Descargar multimedia ejecutada');
          this.downloadMultimedia(params.node.data);
        },
        disabled: !params.node?.data?.idOt,
        cssClasses: ['custom-menu-item']
      },
      'separator',
      'copy',
      'copyWithHeaders',
      'paste',
      'separator',
      'export'
    ];

    console.log('Menú contextual generado:', result);
    return result;
  }

  /**
   * Descarga el archivo ZIP con fotos y videos de la OT
   */
  downloadMultimedia(rowData: any) {
    const idOt = rowData.idOt;
    const inmueble = rowData.cdc || 'N/A';

    if (!idOt) {
      alerts.basicAlert('Error', 'No se encontró el ID de la OT.', 'error');
      return;
    }

    console.log('=== downloadMultimedia iniciado ===');
    console.log('idOt:', idOt);
    console.log('inmueble:', inmueble);

    // CLAVE: Abrir ventana en blanco INMEDIATAMENTE (mientras tenemos contexto de usuario)
    // Esto previene el bloqueo de pop-ups porque se ejecuta síncronamente con el click del usuario
    const newWindow = window.open('about:blank', '_blank');
    console.log('Ventana en blanco creada:', newWindow ? 'SÍ' : 'NO');

    // Mostrar loading que no se puede cerrar
    alerts.showLoading(
      'Preparando archivos',
      'Creando archivo ZIP con fotos y videos. Por favor espere...'
    );

    this.logbookService.getMediaByOt(idOt).subscribe({
      next: (response) => {
        console.log('=== Respuesta de getMediaByOt ===', response);

        if (response.success && response.data && response.data.downloadUrl) {
          const { downloadUrl, zipFileName, fileCount } = response.data;

          console.log('downloadUrl:', downloadUrl);
          console.log('zipFileName:', zipFileName);
          console.log('fileCount:', fileCount);

          // Cerrar el loading
          alerts.closeLoading();

          // Si logramos abrir la ventana, redirigirla a la URL de descarga
          if (newWindow && !newWindow.closed) {
            console.log('✓ Redirigiendo ventana existente a:', downloadUrl);
            newWindow.location.href = downloadUrl;
          } else {
            // Fallback: Si la ventana se cerró o nunca se abrió, usar método alternativo
            console.warn('✗ Ventana no disponible, usando fallback...');

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = zipFileName;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            console.log('✓ Fallback <a> ejecutado');

            setTimeout(() => {
              document.body.removeChild(link);
            }, 500);
          }

          // Mostrar mensaje de éxito
          alerts.basicAlert(
            'Éxito',
            `Descargando ${fileCount} archivo(s) multimedia del INMUEBLE ${inmueble}.`,
            'success'
          );

          // Recargar los datos de la tabla para actualizar el estado de downloaded
          this.reloadTableData();

        } else {
          console.warn('Respuesta sin datos de descarga:', response);

          // Cerrar la ventana en blanco si no hay descarga
          if (newWindow && !newWindow.closed) {
            newWindow.close();
            console.log('Ventana en blanco cerrada (sin datos)');
          }

          // Cerrar el loading
          alerts.closeLoading();

          alerts.basicAlert(
            'Información',
            response.message || 'No hay archivos multimedia disponibles para esta OT.',
            'info'
          );
        }
      },
      error: (error) => {
        console.error('=== Error en downloadMultimedia ===', error);

        // Cerrar la ventana en blanco si hay error
        if (newWindow && !newWindow.closed) {
          newWindow.close();
          console.log('Ventana en blanco cerrada (error)');
        }

        // Cerrar el loading en caso de error
        alerts.closeLoading();

        // Verificar si es un error 404 (no hay archivos)
        if (error.status === 404) {
          alerts.basicAlert(
            'Sin archivos',
            'Esta orden de trabajo no tiene fotos o videos.',
            'info'
          );
        } else {
          // Otros errores
          const errorMessage = error.error?.message || error.message || 'Error al descargar los archivos multimedia.';
          alerts.basicAlert(
            'Error',
            errorMessage,
            'error'
          );
        }
      }
    });
  }
}