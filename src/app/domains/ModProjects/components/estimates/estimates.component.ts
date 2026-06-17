import { Component, effect, HostListener, inject, ChangeDetectorRef} from '@angular/core';
import { ColDef, GridApi, GridReadyEvent, CellDoubleClickedEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EstimatesService } from 'app/services/estimates.service';
import { SignalsService } from 'app/services/signals.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { GeneratorsComponent } from './generators.component';
import { PdfEstimatesService } from 'app/services/pdf-estimates.service';
import { TrackingService } from 'app/services/tracking.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { GeneratorsService } from 'app/services/generators.service';

@Component({
  selector: 'app-estimates',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, GeneratorsComponent],
  templateUrl: './estimates.component.html'
})
export class EstimatesComponent {

  private estimatesService = inject(EstimatesService);
  private readonly cdr = inject(ChangeDetectorRef);
  private signalsService = inject(SignalsService);
  private pdfEstimatesService = inject(PdfEstimatesService);
  private trackingService = inject(TrackingService);
  private workprogramsService = inject(WorkprogramsService);
  private generatorsService = inject(GeneratorsService);

  constructor() {
    effect(() => {
      this.contract = this.signalsService.getContractSelectedBySidebar()();
      if (this.validateContractSelected()) {
        this.obtenerDatos();
      }
    });
  }

  ngOnInit() {
    if (!this.validateContractSelected()) {
      return;
    }

    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Acceso a Estimaciones',
      'Modulo Proyectos - Estimaciones',
      this.trackingService.getEmail()
    );
    
    this.obtenerDatos();
    this.loadActivities();
  }

  components = {
    autocompleteEditor: AutocompleteEditorComponent
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedEstimate: any = null; // Variable única como Income
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private contract = this.signalsService.getContractSelectedBySidebar()();
  private hasShownContractWarning: boolean = false;
  private editableColumnOrder = ['number', 'typeMoney', 'dateStart', 'dateEnd', 'amountMX', 'amountDLL', 'type', 'comment'];
  private enterPressed: boolean = false;
  
  // Propiedades simplificadas
  gridHeight: string = '500px';
  
  // Propiedades para vista detalle de items
  viewMode: 'master' | 'detail' = 'master';
  selectedEstimateForDetail: any = null;
  estimateItems: any[] = [];
  selectedEstimateItem: any = null;
  
  // Conceptos/actividades para dropdown
  activitiesOptions: any[] = [];
  private project = this.signalsService.getProjectSelectedBySidebar()();

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
        return true;
      }
      return false;
    }
  };

  obtenerDatos() {
    if (!this.validateContractSelected()) {
      this.rowData = [];
      return;
    }

    this.estimatesService
      .getEstimates(this.contract)
      .subscribe((data: any) => {
        this.rowData = data;
      }, (error) => {
        console.error(error); // Manejo de error
        this.rowData = []; // Retornar un array vacío en caso de error
      });
  }

  private validateContractSelected(): boolean {
    const contractSelected = this.signalsService.getContractSelectedBySidebar()();
    const hasValidContract = !!contractSelected && Number(contractSelected) > 0;

    if (hasValidContract) {
      this.contract = contractSelected;
      this.hasShownContractWarning = false;
      return true;
    }

    if (!this.hasShownContractWarning) {
      alerts.basicAlert(
        'Contrato requerido',
        'Hey debes de tener siempre un Contrato para una estimacion',
        'warning'
      );
      this.hasShownContractWarning = true;
    }

    return false;
  }

  loadActivities() {
    if (!this.project) return;
    this.workprogramsService.getActivities(this.project)
      .subscribe((activities: any[]) => {
        this.activitiesOptions = activities;
      }, (error) => {
        console.error('Error al cargar actividades:', error);
        this.activitiesOptions = [];
      });
  }


  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const currentIndex = this.editableColumnOrder.indexOf(event.column.getColId());
    if (currentIndex !== -1 && currentIndex < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({
          rowIndex: event.rowIndex,
          colKey: this.editableColumnOrder[currentIndex + 1]
        });
      }, 100);
    }
  }

  // GridOptions simple para ambas vistas
  get gridOptions(): any {
    return {
      headerHeight: 30,
      rowHeight: 30,
      rowClassRules: {
        'new-row-highlight': (params) => !!params.data?.__isNew
      },
      getRowClass: (params) => {
        if (params.node.isSelected()) {
          return 'selected-row';
        }
        return '';
      },
      onRowClicked: (event) => {
        event.node.setSelected(true);
      },
      onRowSelected: (event) => {
        if (event.node.isSelected()) {
          this.gridApi.forEachNode((node) => {
            if (node.id !== event.node.id) {
              node.setSelected(false);
            }
          });
        }
      }
    };
  }


  // Columnas para la vista de items de estimación (exactas a generators)
  getItemsColumnDefs(): ColDef[] {
    return [
      { 
        field: 'idResource', 
        headerName: 'Recurso', 
        editable: true, 
        flex: 2,
        cellEditor: 'agSelectCellEditor', 
        cellEditorParams: { 
          values: this.activitiesOptions.map(a => a.id) 
        },
        valueFormatter: (p) => this.activitiesOptions.find(a => a.id === p.value)?.actandNom || ''
      },
      { 
        field: 'quantity', 
        headerName: 'Cantidad', 
        editable: true, 
        flex: 1, 
        cellDataType: 'number'
      },
      { 
        field: 'accumulate', 
        headerName: 'Acumulado', 
        editable: true, 
        flex: 1, 
        cellDataType: 'number'
      },
      { 
        field: 'comment', 
        headerName: 'Comentarios', 
        editable: true, 
        flex: 2 
      }
    ];
  }

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'number',
        headerName: 'Estimación',
        editable: true,
        flex: 1.4
      },

      {
        field: 'typeMoney',
        headerName: 'Tipo Moneda',
        editable: true,
        flex: 1.6,      
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['MX', 'USD'],
        }

      },

      {
        field: 'dateStart',
        headerName: 'Fecha inicial',
        editable: true,
        flex: 1.5,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'dateEnd',
        headerName: 'Fecha final',
        editable: true,
        flex: 1.4,
        cellDataType: 'dateString',
        valueFormatter: (params) => {
          if (params.value) {
            return params.value.split('T')[0];
          }
          return '';
        }
      },
      {
        field: 'dias',
        headerName: 'Días',
        editable: false,
        flex: 1
      },
      {
        field: 'amountMX',
        headerName: 'MXN',
        cellDataType: 'number',
        editable: true,
        flex: 1.3,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
        }
      },
      {
        field: 'amountDLL',
        headerName: 'DLL',
        cellDataType: 'number',
        editable: true,
        flex: 1,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(params.value);
        }
      },
      {
        field: 'acumulateMX',
        headerName: 'Acumulado MXN',
        cellDataType: 'number',
        editable: false,
        flex: 1.9,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(params.value);
        }
      },
      {
        field: 'acumulateDLL',
        headerName: 'Acumulado DLL',
        cellDataType: 'number',
        editable: false,
        flex: 1.8,
        valueFormatter: (params) => {
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(params.value);
        }
      },
      {
        field: 'type',
        headerName: 'Tipo',
        editable: true,
        flex: 1.3,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['NORMAL', 'ADICIONAL', 'EXTRAORDIN'],
        }
      },
      {
        field: 'authorizeUser',
        headerName: 'Autoriza',
        editable: false,
        flex: 1.6
      },
      {
        field: 'comment',
        headerName: 'Comentarios',
        editable: true,
        flex: 2
      }
    ];
  }

  // Método limpio de selección como Income
  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedEstimate = selectedNodes[0].data;
      this.id = this.selectedEstimate.id;
      
      // Mostrar detalle automáticamente al seleccionar
      this.showEstimateDetail();
    } else {
      this.selectedEstimate = null;
      this.id = null;
      this.hideEstimateDetail();
    }
  }

  // Método para mostrar detalle automáticamente
  private showEstimateDetail() {
    if (!this.selectedEstimate || !this.id) {
      return;
    }
    
    // No aplicar filtros si hay filas temporales (nuevas)
    const hasNewRows = this.rowData.some(row => row.id && row.id.toString().startsWith('temp_'));
    if (hasNewRows) {
      return;
    }

    this.gridApi.setFilterModel({
      id: { type: 'equals', filter: this.id }
    });
    this.gridApi.onFilterChanged();
    
    // Activar generadores después del filtrado
    this.activateGeneratorsTab();
  }

  // Método para ocultar detalle
  private hideEstimateDetail() {
    this.resetGridSize();
  }

  // Función para ver detalles de la estimación seleccionada
  viewEstimateDetails() {
    if (!this.selectedEstimate) {
      alerts.basicAlert(
        'Ver Detalle',
        'Por favor, seleccione una estimación.',
        'warning'
      );
      return;
    }
    
    this.selectedEstimateForDetail = this.selectedEstimate;
    this.viewMode = 'detail';
    this.loadEstimateItems();
    
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Ver Detalle Items Estimación',
      'Modulo Proyectos - Estimaciones Detalle',
      this.trackingService.getEmail()
    );
  }

  // Función para volver a la vista maestro
  backToMasterView() {
    this.viewMode = 'master';
    this.selectedEstimateForDetail = null;
    this.estimateItems = [];
    this.selectedEstimateItem = null;
  }

  // Cargar items de la estimación seleccionada (lista simple como generators)
  private loadEstimateItems() {
    if (!this.selectedEstimateForDetail?.id) {
      this.estimateItems = [];
      return;
    }

    this.generatorsService.getItemsEstimaciones(this.selectedEstimateForDetail.id)
      .subscribe({
        next: (items: any[]) => {
          this.estimateItems = items || [];
        },
        error: (error) => {
          console.error('Error al cargar items de estimación:', error);
          this.estimateItems = [];
          alerts.basicAlert(
            'Error',
            'Error al cargar los items de la estimación.',
            'error'
          );
        }
      });
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Agregar Estimación',
      'Modulo Proyectos - Estimaciones',
      this.trackingService.getEmail()
    );
    
    const tempId = `temp_${this.tempIdCounter++}`;
    const existingNumbers = (this.rowData || [])
      .map((r: any) => parseInt(r.number, 10))
      .filter((n: number) => !isNaN(n));
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    const consecutive = String(nextNumber).padStart(3, '0');
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10);
    const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0, 10);
    const newItem = {
      id: tempId,
      number: consecutive,
      idRoot: this.signalsService.getRootSelectedBySidebar()(),
      idContract: this.contract,
      typeMoney: 'MX',
      dateStart: firstDay,
      dateEnd: lastDay,
      amountMX: 0,
      amountDLL: 0,
      acumulateMX: 0,
      acumulateDLL: 0,
      type: 'NORMAL',
      authorizeUser: localStorage.getItem('mail'),
      comment: '',
      active: true,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Encontrar el índice de la nueva fila
    const newRowIndex = this.rowData.findIndex((row) => row.id === tempId);

    // Encontrar la primera columna editable
    const firstEditableCol = this.columnDefs.find(col => col.editable);
    const firstEditableColKey = firstEditableCol ? firstEditableCol.field : null;

    // Usar setTimeout para asegurar que el grid haya renderizado la nueva fila
    setTimeout(() => {
      if (firstEditableColKey) {
        this.gridApi.startEditingCell({
          rowIndex: newRowIndex,
          colKey: firstEditableColKey, // Editar la primera columna editable
        });
      }
    }, 50); // Un pequeño retraso de 50ms
  }

  async saveChanges() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Guardar Cambios Estimaciones',
      'Modulo Proyectos - Estimaciones',
      this.trackingService.getEmail()
    );
    
    const isValid = this.rowData.every((item) => item.number);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar todos los campos antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      // Asignar el ID temporal al campo idEstimacion
      return this.estimatesService.addEstimate(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.estimatesService.updateEstimate(row.id, cleanedData);
    });

    // Using concat to combine observables and lastValueFrom for async/await
    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  
    this.cdr.detectChanges();}

  async deleteEntry() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Eliminar Estimación',
      'Modulo Proyectos - Estimaciones',
      this.trackingService.getEmail()
    );
    
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    const estimationNumber = selectedData.number || 'la estimación seleccionada';
    
    // Confirmación antes de eliminar
    const result = await alerts.confirmAlert(
      'Confirmar eliminación',
      `¿Está seguro de que desea eliminar ${estimationNumber}? Esta acción no se puede deshacer.`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) {
      return;
    }

    const id = selectedData.id;
    selectedData.active = 0;
    this.estimatesService.deleteEstimate(id).pipe(
      catchError((error) => {
        alerts.basicAlert(
          'Error al eliminar',
          'Error al eliminar la entrada.',
          'error'
        );
        console.error(error);
        return EMPTY;
      })
    )
      .subscribe(
        () => {
          alerts.basicAlert(
            'Eliminado',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.obtenerDatos();
          this.notSavedChanges = false;
          this.selectedEstimate = null;
        }
      );
  
    this.cdr.detectChanges();}

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  // Función separada para filtrar por estimación seleccionada (obsoleta)
  filterBySelectedEstimate() {
    // Funcionalidad movida a showEstimateDetail()
    return;
  }

  // Función para limpiar filtros
  clearFilters() {
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      // El grid se actualizará automáticamente
    }
  }




  async activateGeneratorsTab() {
    await this.adjustGridSize();
  
    this.cdr.detectChanges();}

  async adjustGridSize() {
    this.gridHeight = '250px'; // Reducir tamaño del grid
  }

  resetGridSize() {
    this.gridHeight = '500px'; // Restaurar tamaño original
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

  generateSamplePdf() {
    if (!this.selectedEstimate) {
      alerts.basicAlert(
        'Generar PDF',
        'Por favor, seleccione una estimación para generar el PDF.',
        'warning'
      );
      return;
    }

    this.generatePdfWithRealData(this.selectedEstimate.id, false);
  }

  downloadSamplePdf() {
    if (!this.selectedEstimate) {
      alerts.basicAlert(
        'Descargar PDF',
        'Por favor, seleccione una estimación para descargar el PDF.',
        'warning'
      );
      return;
    }

    this.generatePdfWithRealData(this.selectedEstimate.id, true);
  }

  private async generatePdfWithRealData(estimateId: number, download: boolean = false) {
    try {
      // Obtener datos de la estimación
      const estimateData = await lastValueFrom(this.estimatesService.getEstimateById(estimateId));
      
      // Obtener items de la estimación
      const estimateItems = await lastValueFrom(this.estimatesService.getItemsFromEstimate(estimateId));
      
      // Obtener conceptos para cada item
      const conceptPromises = estimateItems.map(item => 
        lastValueFrom(this.workprogramsService.getWorkProgramsWithoutType(item.idResource))
      );
      
      const conceptsResults = await Promise.all(conceptPromises);
      
      // Crear estructura de datos para el PDF
      const pdfData = await this.createEstimateDataFromServices(estimateData, estimateItems, conceptsResults);
      
      if (download) {
        const fileName = `Estimacion_${estimateData.number}_${new Date().getTime()}.pdf`;
        this.pdfEstimatesService.downloadEstimatePdf(pdfData, fileName);
      } else {
        this.pdfEstimatesService.generateEstimatePdf(pdfData);
      }
      
    } catch (error) {
      console.error('Error generando PDF:', error);
      alerts.basicAlert(
        'Error',
        'Error al generar el PDF. Por favor, intente nuevamente.',
        'error'
      );
    }
  
    this.cdr.detectChanges();}

  private async createEstimateDataFromServices(estimateData: any, estimateItems: any[], conceptsResults: any[][]) {
    // Procesar items y agrupar por categorías si es necesario
    const items = estimateItems.map((item, index) => {
      const concept = conceptsResults[index] && conceptsResults[index].length > 0 
        ? conceptsResults[index][0] 
        : null;
      
      return {
        clave: concept?.id || item.idResource,
        concepto: concept?.text || `Concepto ${item.idResource}`,
        unidad: concept?.measure || 'PZA',
        cantidad: concept?.quantity || item.quantity || 0,
        precioUnitario: concept?.costMX || 0,
        importe: (concept?.quantity || item.quantity || 0) * (concept?.costMX || 0),
        cantidadEjecutada: item.accumulate || 0,
        importeEjecutado: (item.accumulate || 0) * (concept?.costMX || 0),
        comment: item.comment
      };
    });

    // Agrupar por fases o categorías (usando la fase del concepto si está disponible)
    const categorias = this.groupItemsByCategory(items, conceptsResults);

    // Calcular el total general sumando solo los totales de las categorías (filas grises)
    const totalGeneral = categorias.reduce((sum, categoria) => sum + categoria.total, 0);
    
    // Calcular el total ejecutado sumando los importes ejecutados de las categorías
    const totalEjecutado = categorias.reduce((sum, categoria) => {
      const totalEjecutadoCategoria = categoria.items.reduce((catSum, item) => catSum + (item.importeEjecutado || 0), 0);
      return sum + totalEjecutadoCategoria;
    }, 0);

    return {
      proyecto: conceptsResults[0]?.[0]?.text || 'PROYECTO', // Usar el primer concepto como referencia del proyecto
      estimacion: estimateData.number,
      fechaInicio: this.formatDateForPdf(estimateData.dateStart),
      fechaFin: this.formatDateForPdf(estimateData.dateEnd),
      totalGeneral: totalGeneral, // Suma de totales de categorías (filas grises)
      totalEjecutado: totalEjecutado, // Suma de importes ejecutados
      pagina: 1,
      totalPaginas: 1,
      categorias: categorias
    };
  }

  private groupItemsByCategory(items: any[], conceptsResults: any[][]) {
    const categoriesMap = new Map();
    const parentItems = [];

    // Primero, identificar los items Parent y crear categorías para ellos
    items.forEach((item, index) => {
      const concept = conceptsResults[index] && conceptsResults[index].length > 0 
        ? conceptsResults[index][0] 
        : null;
      
      if (concept?.typeActivity === 'Parent') {
        const categoryName = concept?.text || item.concepto;
        parentItems.push({ item, concept, categoryName });
        
        if (!categoriesMap.has(categoryName)) {
          categoriesMap.set(categoryName, {
            nombre: categoryName,
            total: item.importe || 0,
            items: []
          });
        }
      }
    });

    // Luego, procesar todos los items (incluyendo los de phase)
    items.forEach((item, index) => {
      const concept = conceptsResults[index] && conceptsResults[index].length > 0 
        ? conceptsResults[index][0] 
        : null;
      
      // Skip items que ya son categorías Parent
      if (concept?.typeActivity === 'Parent') {
        return;
      }
      
      const categoryName = concept?.phase;
      
      // Solo procesar si tiene categoryName válido
      if (categoryName) {
        if (!categoriesMap.has(categoryName)) {
          categoriesMap.set(categoryName, {
            nombre: categoryName,
            total: 0,
            items: []
          });
        }
        
        const category = categoriesMap.get(categoryName);
        category.items.push(item);
        category.total += item.importe;
      }
    });

    return Array.from(categoriesMap.values());
  }

  private formatDateForPdf(dateString: string): string {
    const date = new Date(dateString);
    const monthsOfYear = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];

    const day = date.getDate();
    const monthName = monthsOfYear[date.getMonth()];
    const year = date.getFullYear();

    return `${day} de ${monthName} de ${year}`;
  }

  // ======================================================================
  // ===== MÉTODOS PARA MANEJO DE ITEMS DE ESTIMACIÓN ===================
  // ======================================================================

  // Selección de items de estimación
  onEstimateItemSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    this.selectedEstimateItem = selectedNodes.length > 0 ? selectedNodes[0].data : null;
  }

  // Cambio de valores en items de estimación
  onEstimateItemValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  // Agregar nuevo item de estimación
  addEstimateItem() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Agregar Item Estimación',
      'Modulo Proyectos - Items Estimaciones',
      this.trackingService.getEmail()
    );

    if (!this.selectedEstimateForDetail) {
      alerts.basicAlert('Agregar Item', 'No hay estimación seleccionada.', 'warning');
      return;
    }

    const tempId = `temp_${Date.now()}`;
    const newItem = {
      id: tempId,
      idType: this.selectedEstimateForDetail.id,
      idResource: 0,
      quantity: 0,
      accumulate: 0,
      type: 'ESTIMACION',
      comment: '',
      active: true,
      __isNew: true
    };

    this.estimateItems = [newItem, ...this.estimateItems];
    this.notSavedChanges = true;

    // Auto-seleccionar y editar primer campo editable
    setTimeout(() => {
      const newRowIndex = this.estimateItems.findIndex((row) => row.id === tempId);
      if (newRowIndex >= 0 && this.gridApi) {
        this.gridApi.startEditingCell({
          rowIndex: newRowIndex,
          colKey: 'idResource'
        });
      }
    }, 50);
  }

  // Verificar si hay cambios en items de estimación
  hasEstimateItemChanges(): boolean {
    return this.estimateItems.some(item => item.__isNew || item.__modified);
  }

  // Guardar cambios en items de estimación
  async saveEstimateItems() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Guardar Items Estimación',
      'Modulo Proyectos - Items Estimaciones',
      this.trackingService.getEmail()
    );

    const isValid = this.estimateItems.every((item) => 
      item.idResource !== undefined && item.quantity !== undefined
    );
    
    if (!isValid) {
      alerts.basicAlert(
        'Guardar Items',
        'Debe llenar todos los campos requeridos antes de guardar.',
        'error'
      );
      return;
    }

    const newItems = this.estimateItems.filter((item) => item.__isNew);
    const modifiedItems = this.estimateItems.filter((item) => item.__modified && !item.__isNew);

    try {
      // Guardar Items Nuevos
      for (const item of newItems) {
        const cleanedData = this.cleanEstimateItemDataForServer(item);
        const response = await lastValueFrom(this.generatorsService.addItemGenerador(cleanedData));
        if (response && response.id) {
          item.id = response.id;
          item.originalId = response.id;
        }
        item.__isNew = false;
      }

      // Guardar Items Modificados
      for (const item of modifiedItems) {
        const cleanedData = this.cleanEstimateItemDataForServer(item);
        await lastValueFrom(this.generatorsService.updateItemGenerador(item.id, cleanedData));
        item.__modified = false;
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Los items se han guardado correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.loadEstimateItems(); // Recargar items
    } catch (error) {
      console.error('Error al guardar items:', error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al guardar los items. Por favor, intente nuevamente.',
        'error'
      );
    }
  
    this.cdr.detectChanges();}

  // Eliminar item de estimación
  async deleteEstimateItem() {
    if (!this.selectedEstimateItem) {
      alerts.basicAlert(
        'Eliminar Item',
        'Por favor, seleccione un item para eliminar.',
        'error'
      );
      return;
    }

    const itemName = `el item de recurso ${this.selectedEstimateItem.idResource || 'seleccionado'}`;
    
    const result = await alerts.confirmAlert(
      'Confirmar eliminación',
      `¿Está seguro de que desea eliminar ${itemName}? Esta acción no se puede deshacer.`,
      'warning',
      'Sí, eliminar'
    );

    if (!result.isConfirmed) {
      return;
    }

    const itemId = this.selectedEstimateItem.id;

    // Si es un item temporal, solo eliminarlo de la lista
    if (itemId.toString().startsWith('temp_')) {
      this.estimateItems = this.estimateItems.filter(item => item.id !== itemId);
      this.selectedEstimateItem = null;
      return;
    }

    try {
      await lastValueFrom(this.generatorsService.deleteItemGenerador(itemId));
      alerts.basicAlert(
        'Eliminado',
        'Item eliminado satisfactoriamente.',
        'success'
      );
      this.loadEstimateItems(); // Recargar items
      this.selectedEstimateItem = null;
    } catch (error) {
      console.error('Error al eliminar item:', error);
      alerts.basicAlert(
        'Error',
        'Error al eliminar el item.',
        'error'
      );
    }
  
    this.cdr.detectChanges();}

  // Limpiar datos de item para servidor
  private cleanEstimateItemDataForServer(data: any): any {
    return {
      idType: data.idType,
      idResource: data.idResource,
      quantity: data.quantity,
      accumulate: data.accumulate,
      type: data.type || 'ESTIMACION',
      comment: data.comment || '',
      active: data.active !== false
    };
  }

}
