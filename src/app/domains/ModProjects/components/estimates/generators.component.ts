import { Component, inject, HostListener, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { GeneratorsService } from 'app/services/generators.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { SignalsService } from 'app/services/signals.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';

@Component({
  selector: 'app-generators',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './generators.component.html',
  styleUrl: './generators.component.scss'
})
export class GeneratorsComponent implements OnChanges {

  @Input() idEstimacion: number = 0;

  private generatorsService = inject(GeneratorsService);
  private workprogramsService = inject(WorkprogramsService);
  private signalsService = inject(SignalsService);

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  projectId: number = 0;
  notSavedChanges: boolean = false;
  rowData: any[] = [];
  selectedRowData: any = null;
  newlyAddedRows: string[] = [];
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  // Propiedades para Tree Data
  treeData: any[] = [];
  selectedNodeType: 'generator' | 'item' | null = null;
  selectedParentId: number | null = null;
  
  // Propiedades para controlar las vistas
  viewMode: 'master' | 'detail' = 'master'; // Controla qué vista mostrar
  selectedGeneratorForDetail: any = null; // Generador seleccionado para mostrar detalle
  
  // Lista de actividades para el dropdown de recursos
  activitiesOptions: any[] = [];
  private project = this.signalsService.getProjectSelectedBySidebar()();

  // Propiedades legacy para Master-Detail (aún referenciadas)
  selectedGeneratorId: number | null = null;
  showDetailGrid: boolean = false;
  detailRowData: any[] = [];
  detailGridApi: GridApi;

  constructor() { }

  ngOnInit() {
    this.obtenerDatos();
    this.loadActivities();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['idEstimacion'] && !changes['idEstimacion'].firstChange) {
      this.obtenerDatos();
    }
  }

  obtenerDatos() {
    if (!this.idEstimacion) {
      console.warn('No hay ID de estimación proporcionado');
      this.treeData = [];
      return;
    }

    this.generatorsService
      .getGenerators(this.idEstimacion)
      .subscribe(async (generators: any) => {
        console.log('Generators data:', generators);
        
        if (this.viewMode === 'master') {
          // Vista Maestro: Solo mostrar generadores
          this.treeData = generators.map(generator => ({
            ...generator,
            nodeType: 'generator'
          }));
        } else {
          // Vista Detalle: Construir estructura de árbol con items
          await this.buildTreeStructure(generators);
        }

        // Forzar refresh del grid después de cargar datos
        setTimeout(() => {
          if (this.gridApi) {
            this.gridApi.setGridOption('rowData', this.treeData);
            this.gridApi.redrawRows();
          }
        }, 50);
      }, (error) => {
        console.error('Error al cargar generators:', error);
        this.treeData = [];
      });
  }

  loadActivities() {
    if (!this.project) {
      console.warn('No hay proyecto seleccionado');
      return;
    }
    console.log('Cargando actividades para el proyecto:', this.project);
    this.workprogramsService.getActivities(this.project)
      .subscribe((activities: any[]) => {
        this.activitiesOptions = activities;
        console.log('Activities loaded:', activities);
      }, (error) => {
        console.error('Error al cargar actividades:', error);
        this.activitiesOptions = [];
      });
  }

  // Configuración del grid dinámico
  get gridOptions(): any {
    const baseOptions = {
      headerHeight: 30,
      rowHeight: 30,
      animateRows: true,
      onRowSelected: (event) => {
        if (event.node.isSelected()) {
          this.onRowSelected(event);
        }
      },
    };

    if (this.viewMode === 'master') {
      // Vista Maestro: Grid simple sin Tree Data (SIN doble-click)
      return {
        ...baseOptions,
        treeData: false
      };
    } else {
      // Vista Detalle: Grid con Tree Data (SIN doble-click)
      return {
        ...baseOptions,
        treeData: true,
        groupDefaultExpanded: -1,
        getDataPath: (data: any) => data.orgHierarchy,
        autoGroupColumnDef: {
          headerName: 'Items del Generador',
          minWidth: 200,
          cellRendererParams: {
            suppressCount: true,
            innerRenderer: (params: any) => {
              if (params.data) {
                if (params.data.nodeType === 'generator') {
                  return `📁 ${params.data.numero}`;
                } else {
                  // Mostrar el nombre de la actividad en lugar del ID
                  const activity = this.activitiesOptions.find(act => act.id === params.data.idResource);
                  const resourceName = activity ? activity.actandNom : `ID: ${params.data.idResource || 0}`;
                  return `📄 ${resourceName}`;
                }
              }
              return '';
            }
          }
        }
      };
    }
  }

  // Definición de columnas según la vista
  get columnDefs(): ColDef[] {
    if (this.viewMode === 'master') {
      // Vista Maestro: Solo columnas de generadores
      return [
        {
          field: 'numero',
          headerName: 'Número Generador',
          editable: true,
          flex: 1
        },
        {
          field: 'dateStart',
          headerName: 'Fecha Inicio',
          editable: true,
          flex: 1,
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
          headerName: 'Fecha Final',
          editable: true,
          flex: 1,
          cellDataType: 'dateString',
          valueFormatter: (params) => {
            if (params.value) {
              return params.value.split('T')[0];
            }
            return '';
          }
        },
        {
          field: 'aplicaIsometrico',
          headerName: 'Aplica Isométrico',
          editable: true,
          flex: 1,
          cellDataType: 'boolean',
          cellRenderer: 'agCheckboxCellRenderer',
          cellEditor: 'agCheckboxCellEditor'
        }
      ];
    } else {
      // Vista Detalle: Solo columnas de items
      return [
        {
          field: 'idResource',
          headerName: 'Recurso',
          editable: (params) => params.data?.nodeType === 'item',
          flex: 2,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: this.activitiesOptions.map(activity => activity.id),
            valueListGap: 0,
            valueListMaxHeight: 200
          },
          valueFormatter: (params) => {
            // Mostrar el actandNom en lugar del ID
            const activity = this.activitiesOptions.find(act => act.id === params.value);
            return activity ? activity.actandNom : params.value;
          },
          cellStyle: (params) => {
            return params.data?.nodeType === 'generator' ? { display: 'none' } : {};
          }
        },
        {
          field: 'quantity',
          headerName: 'Cantidad',
          editable: (params) => params.data?.nodeType === 'item',
          flex: 1,
          cellDataType: 'number',
          cellStyle: (params) => {
            return params.data?.nodeType === 'generator' ? { display: 'none' } : {};
          }
        },
        {
          field: 'accumulate',
          headerName: 'Acumulado',
          editable: (params) => params.data?.nodeType === 'item',
          flex: 1,
          cellDataType: 'number',
          cellStyle: (params) => {
            return params.data?.nodeType === 'generator' ? { display: 'none' } : {};
          }
        },
        {
          field: 'comment',
          headerName: 'Comentarios',
          editable: true,
          flex: 2
        }
      ];
    }
  }

  // Función para calcular días
  calculateDays(dateStart: string, dateEnd: string): number {
    if (!dateStart || !dateEnd) {
      return 0;
    }
    
    const inicio = new Date(dateStart);
    const final = new Date(dateEnd);
    
    // Calcular la diferencia en milisegundos
    const diffTime = final.getTime() - inicio.getTime();
    
    // Convertir a días y agregar 1 para incluir ambos días (del 1 al 8 son 8 días)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    return diffDays > 0 ? diffDays : 0;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    return dateString.split('T')[0];
  }

  // ==================== FUNCIONES TREE DATA ====================

  async buildTreeStructure(generators: any[]) {
    this.treeData = [];
    
    // En vista detalle, solo procesar el generador seleccionado
    const generatorsToProcess = this.viewMode === 'detail' && this.selectedGeneratorForDetail 
      ? [this.selectedGeneratorForDetail] 
      : generators;
    
    for (const generator of generatorsToProcess) {
      // Nodo padre (generador) - solo en vista detalle
      if (this.viewMode === 'detail') {
        const generatorNode = {
          ...generator,
          nodeType: 'generator',
          orgHierarchy: [generator.numero],
          id: `gen_${generator.id}`,
          originalId: generator.id
        };
        this.treeData.push(generatorNode);
      }

      // Cargar items del generador si no es temporal
      if (!generator.id.toString().startsWith('temp_')) {
        try {
          const items = await lastValueFrom(this.generatorsService.getItemsGeneradores(generator.id));
          
          for (const item of items) {
            const itemNode = {
              ...item,
              nodeType: 'item',
              orgHierarchy: [generator.numero, `Item_${item.id}`],
              id: `item_${item.id}`,
              originalId: item.id,
              parentGeneratorId: generator.id
            };
            this.treeData.push(itemNode);
          }
        } catch (error) {
          console.error(`Error cargando items para generador ${generator.id}:`, error);
        }
      }
    }

    console.log('Tree structure built for', this.viewMode, ':', this.treeData);
  }

  // Manejo unificado de selección de filas
  onRowSelected(event: any) {
    this.selectedRowData = event.data;
    
    if (event.data) {
      this.selectedNodeType = event.data.nodeType || 'generator';
      
      if (this.selectedNodeType === 'generator') {
        this.selectedParentId = event.data.originalId || event.data.id;
      } else if (this.selectedNodeType === 'item') {
        this.selectedParentId = event.data.parentGeneratorId;
      }
    } else {
      this.selectedNodeType = null;
      this.selectedParentId = null;
    }

    console.log('Selected row:', this.selectedNodeType, this.selectedRowData);
  }

  // Función para abrir vista detalle (con botón)
  openDetailView(generatorData: any) {
    this.selectedGeneratorForDetail = generatorData;
    this.viewMode = 'detail';
    this.obtenerDatos(); // Recargar datos en modo detalle
    
    // Forzar refresh completo del grid después de cambiar de vista
    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.treeData);
        this.gridApi.redrawRows();
      }
    }, 200);
  }

  // Función para ver detalle del generador seleccionado
  viewGeneratorDetail() {
    if (!this.selectedRowData) {
      alerts.basicAlert(
        'Ver Detalle',
        'Por favor, seleccione un generador para ver su detalle.',
        'warning'
      );
      return;
    }

    this.openDetailView(this.selectedRowData);
  }

  // Función para volver a vista maestro
  backToMasterView() {
    this.viewMode = 'master';
    this.selectedGeneratorForDetail = null;
    this.obtenerDatos(); // Recargar datos en modo maestro
    
    // Forzar refresh del grid después de volver al maestro
    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.treeData);
        this.gridApi.redrawRows();
      }
    }, 200);
  }

  onTreeNodeSelected(event: any) {
    // Esta función ahora delega a onRowSelected
    this.onRowSelected(event);
  }

  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
    
    // Recalcular días si cambió alguna fecha
    if (event.colDef.field === 'dateStart' || event.colDef.field === 'dateEnd') {
      this.gridApi.refreshCells({
        rowNodes: [event.node],
        columns: ['dias']
      });
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      numero: '',
      idEstimacion: this.idEstimacion,
      dateStart: '',
      dateEnd: '',
      aplicaIsometrico: false,
      active: true,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;

    // Auto-editar primera celda
    setTimeout(() => {
      const newRowIndex = this.rowData.findIndex((row) => row.id === tempId);
      this.gridApi.startEditingCell({
        rowIndex: newRowIndex,
        colKey: 'numero',
      });
    }, 50);
  }

  async saveChanges() {
    // Validar que todos los campos requeridos estén llenos
    const isValid = this.rowData.every((item) => item.numero && item.dateStart && item.dateEnd);
    if (!isValid) {
      alerts.basicAlert(
        'Guardar Cambios',
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
      return this.generatorsService.addGenerator(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.generatorsService.updateGenerator(row.id, cleanedData);
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Los generadores se han guardado correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al guardar los generadores. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  async deleteEntry() {
    const selectedNodes = this.gridApi?.getSelectedNodes();
    if (!selectedNodes || selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    this.generatorsService.deleteGenerator(id).pipe(
      catchError((error) => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Error al eliminar el generador.',
          'error'
        );
        console.error(error);
        return EMPTY;
      })
    )
      .subscribe(
        () => {
          alerts.basicAlert(
            'Eliminar entrada',
            'Generador eliminado satisfactoriamente.',
            'success'
          );
          this.obtenerDatos();
          this.notSavedChanges = false;
          this.selectedRowData = null;
        }
      );
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    delete cleanedData.dias; // Los días se calculan, no se envían al servidor
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

  // ==================== FUNCIONES MAESTRO-DETALLE SEPARADAS ====================

  addGenerator() {
    const tempId = `temp_${this.tempIdCounter++}`;
    
    // Agregar nuevo generador (maestro)
    const newGenerator = {
      id: tempId,
      numero: '',
      idEstimacion: this.idEstimacion,
      dateStart: '',
      dateEnd: '',
      aplicaIsometrico: false,
      active: true,
      nodeType: 'generator',
      orgHierarchy: [`Generador_${tempId}`],
      originalId: tempId,
      __isNew: true,
    };
    
    this.treeData = [newGenerator, ...this.treeData];
    this.notSavedChanges = true;
    
    // Auto-seleccionar y editar el nuevo generador
    setTimeout(() => {
      const newRowIndex = this.treeData.findIndex((row) => row.id === tempId);
      if (newRowIndex >= 0 && this.gridApi) {
        this.gridApi.startEditingCell({
          rowIndex: newRowIndex,
          colKey: 'numero',
        });
      }
    }, 50);
  }

  addItem() {
    if (!this.selectedRowData || this.selectedNodeType !== 'generator') {
      alerts.basicAlert(
        'Agregar Item',
        'Primero debe seleccionar un generador para agregar items.',
        'warning'
      );
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const selectedGenerator = this.selectedRowData;
    
    // Agregar nuevo item al generador seleccionado
    const newItem = {
      id: tempId,
      idType: selectedGenerator.originalId,
      idResource: 0,
      quantity: 1,
      accumulate: 0,
      type: 'GENERADOR',
      comment: '',
      active: true,
      nodeType: 'item',
      orgHierarchy: [selectedGenerator.numero, `Item_${tempId}`],
      originalId: tempId,
      parentGeneratorId: selectedGenerator.originalId,
      __isNew: true,
    };
    
    this.treeData = [...this.treeData, newItem];
    this.notSavedChanges = true;

    // Auto-editar el nuevo item
    setTimeout(() => {
      const newRowIndex = this.treeData.findIndex((row) => row.id === tempId);
      if (newRowIndex >= 0 && this.gridApi) {
        this.gridApi.startEditingCell({
          rowIndex: newRowIndex,
          colKey: 'idResource',
        });
      }
    }, 50);
  }

  deleteGenerator() {
    if (!this.selectedRowData || this.selectedNodeType !== 'generator') {
      alerts.basicAlert(
        'Eliminar Generador',
        'Por favor, seleccione un generador para eliminar.',
        'error'
      );
      return;
    }

    this.deleteTreeNode();
  }

  deleteItem() {
    if (!this.selectedRowData || this.selectedNodeType !== 'item') {
      alerts.basicAlert(
        'Eliminar Item',
        'Por favor, seleccione un item para eliminar.',
        'error'
      );
      return;
    }

    this.deleteTreeNode();
  }

  saveItems() {
    // Guardar solo los items modificados/nuevos
    const items = this.treeData.filter(item => item.nodeType === 'item');
    const itemsToSave = items.filter(item => item.__isNew || item.__modified);
    
    if (itemsToSave.length === 0) {
      alerts.basicAlert(
        'Guardar Items',
        'No hay cambios en items para guardar.',
        'info'
      );
      return;
    }

    this.saveTreeChanges();
  }

  hasItemChanges(): boolean {
    const items = this.treeData.filter(item => item.nodeType === 'item');
    return items.some(item => item.__isNew || item.__modified);
  }

  getSelectedGeneratorName(): string {
    if (this.selectedNodeType === 'generator') {
      return this.selectedRowData?.numero || 'Generador';
    } else if (this.selectedNodeType === 'item') {
      // Buscar el generador padre
      const parentId = this.selectedRowData?.parentGeneratorId;
      const parentGenerator = this.treeData.find(item => 
        item.nodeType === 'generator' && item.originalId === parentId
      );
      return parentGenerator?.numero || 'Generador';
    }
    return '';
  }

  isItemSelected(): boolean {
    return this.selectedNodeType === 'item';
  }

  // ==================== FUNCIONES TREE DATA CRUD (LEGACY) ====================

  addTreeNode() {
    // Esta función ahora delega a las funciones específicas
    if (!this.selectedRowData || this.selectedNodeType === 'generator') {
      this.addGenerator();
    } else if (this.selectedNodeType === 'item') {
      this.addItem();
    }
  }

  async saveTreeChanges() {
    // Validar datos según el tipo de nodo
    const isValid = this.treeData.every((item) => {
      if (item.nodeType === 'generator') {
        return item.numero && item.dateStart && item.dateEnd;
      } else {
        return item.idResource !== undefined && item.quantity !== undefined;
      }
    });
    
    if (!isValid) {
      alerts.basicAlert(
        'Guardar Cambios',
        'Debe llenar todos los campos requeridos antes de guardar.',
        'error'
      );
      return;
    }

    // Separar generadores e items
    const generators = this.treeData.filter(item => item.nodeType === 'generator');
    const items = this.treeData.filter(item => item.nodeType === 'item');

    const newGenerators = generators.filter((row) => row.__isNew);
    const modifiedGenerators = generators.filter((row) => row.__modified && !row.__isNew);
    const newItems = items.filter((row) => row.__isNew);
    const modifiedItems = items.filter((row) => row.__modified && !row.__isNew);

    try {
      // Primero guardar generadores nuevos
      for (const generator of newGenerators) {
        const cleanedData = this.cleanDataForServer(generator);
        const response = await lastValueFrom(this.generatorsService.addGenerator(cleanedData));
        // Actualizar el ID temporal con el real
        generator.id = response.id;
        generator.originalId = response.id;
        generator.__isNew = false;
        
        // Actualizar items que dependan de este generador
        items.forEach(item => {
          if (item.parentGeneratorId === generator.id || item.parentGeneratorId.toString().startsWith('temp_')) {
            item.parentGeneratorId = response.id;
            item.idType = response.id;
          }
        });
      }

      // Actualizar generadores modificados
      for (const generator of modifiedGenerators) {
        const cleanedData = this.cleanDataForServer(generator);
        await lastValueFrom(this.generatorsService.updateGenerator(generator.originalId, cleanedData));
        generator.__modified = false;
      }

      // Guardar items nuevos
      for (const item of newItems) {
        const cleanedData = this.cleanDetailDataForServer(item);
        const response = await lastValueFrom(this.generatorsService.addItemGenerador(cleanedData));
        item.id = response.id;
        item.originalId = response.id;
        item.__isNew = false;
      }

      // Actualizar items modificados
      for (const item of modifiedItems) {
        const cleanedData = this.cleanDetailDataForServer(item);
        await lastValueFrom(this.generatorsService.updateItemGenerador(item.originalId, cleanedData));
        item.__modified = false;
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Los generadores e items se han guardado correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.obtenerDatos(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al guardar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  async deleteTreeNode() {
    if (!this.selectedRowData) {
      alerts.basicAlert(
        'Eliminar nodo',
        'Por favor, seleccione un elemento para eliminar.',
        'error'
      );
      return;
    }

    const nodeId = this.selectedRowData.originalId;
    const nodeType = this.selectedRowData.nodeType;

    // Si es temporal, eliminar solo localmente
    if (nodeId.toString().startsWith('temp_')) {
      if (nodeType === 'generator') {
        // Eliminar también todos los items hijos
        this.treeData = this.treeData.filter(item => 
          !(item.nodeType === 'generator' && item.id === this.selectedRowData.id) &&
          !(item.nodeType === 'item' && item.parentGeneratorId === this.selectedRowData.originalId)
        );
      } else {
        // Eliminar solo el item
        this.treeData = this.treeData.filter(item => item.id !== this.selectedRowData.id);
      }
      
      this.selectedRowData = null;
      this.selectedNodeType = null;
      return;
    }

    try {
      if (nodeType === 'generator') {
        await lastValueFrom(this.generatorsService.deleteGenerator(nodeId));
        alerts.basicAlert(
          'Eliminar generador',
          'Generador y sus items eliminados satisfactoriamente.',
          'success'
        );
      } else {
        await lastValueFrom(this.generatorsService.deleteItemGenerador(nodeId));
        alerts.basicAlert(
          'Eliminar item',
          'Item eliminado satisfactoriamente.',
          'success'
        );
      }
      
      this.obtenerDatos();
      this.notSavedChanges = false;
      this.selectedRowData = null;
      this.selectedNodeType = null;
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        `Error al eliminar el ${nodeType === 'generator' ? 'generador' : 'item'}.`,
        'error'
      );
    }
  }

  getAddButtonTitle(): string {
    if (!this.selectedRowData || this.selectedNodeType === 'generator') {
      return 'Agregar nuevo generador';
    } else if (this.selectedNodeType === 'item') {
      return 'Agregar item al generador padre';
    }
    return 'Agregar elemento';
  }

  // ==================== FUNCIONES MASTER-DETAIL (LEGACY) ====================

  loadDetailData() {
    if (!this.selectedGeneratorId || this.selectedGeneratorId.toString().startsWith('temp_')) {
      this.showDetailGrid = false;
      this.detailRowData = [];
      return;
    }

    this.generatorsService
      .getItemsGeneradores(this.selectedGeneratorId)
      .subscribe((data: any) => {
        this.detailRowData = data;
        this.showDetailGrid = true;
        console.log('Detail data loaded:', data);
      }, (error) => {
        console.error('Error al cargar detalle:', error);
        this.detailRowData = [];
        this.showDetailGrid = false;
      });
  }

  // Definición de columnas para el detalle
  get detailColumnDefs(): ColDef[] {
    return [
      {
        field: 'idResource',
        headerName: 'ID Recurso',
        editable: true,
        flex: 1
      },
      {
        field: 'quantity',
        headerName: 'Cantidad',
        editable: true,
        flex: 1,
        cellDataType: 'number',
        cellEditor: 'agNumberCellEditor'
      },
      {
        field: 'accumulate',
        headerName: 'Acumulado',
        editable: true,
        flex: 1,
        cellDataType: 'number',
        cellEditor: 'agNumberCellEditor'
      },
      {
        field: 'comment',
        headerName: 'Comentarios',
        editable: true,
        flex: 2
      }
    ];
  }

  onDetailGridReady(params: GridReadyEvent) {
    this.detailGridApi = params.api;
  }

  onDetailSelectionChanged(event: any) {
    // Manejar selección en el grid detalle
  }

  onDetailCellValueChanged(event: any) {
    console.log('Detalle cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  // ==================== FUNCIONES CRUD DETALLE ====================

  addDetailRow() {
    if (!this.selectedGeneratorId || this.selectedGeneratorId.toString().startsWith('temp_')) {
      alerts.basicAlert(
        'Agregar Item',
        'Primero debe guardar el generador antes de agregar items.',
        'warning'
      );
      return;
    }

    const tempId = `temp_detail_${this.tempIdCounter++}`;
    const newDetailItem = {
      id: tempId,
      idType: this.selectedGeneratorId,
      idResource: 0,
      quantity: 1,
      accumulate: 0,
      type: 'GENERADOR',
      comment: '',
      active: true,
      __isNew: true,
    };

    this.detailRowData = [newDetailItem, ...this.detailRowData];
    this.notSavedChanges = true;

    // Auto-editar primera celda
    setTimeout(() => {
      if (this.detailGridApi) {
        const newRowIndex = this.detailRowData.findIndex((row) => row.id === tempId);
        this.detailGridApi.startEditingCell({
          rowIndex: newRowIndex,
          colKey: 'idResource',
        });
      }
    }, 50);
  }

  async saveDetailChanges() {
    const newRows = this.detailRowData.filter((row) => row.__isNew);
    const modifiedRows = this.detailRowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDetailDataForServer(row);
      return this.generatorsService.addItemGenerador(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDetailDataForServer(row);
      return this.generatorsService.updateItemGenerador(row.id, cleanedData);
    });

    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Items actualizados',
        'Los items del generador se han guardado correctamente.',
        'success'
      );
      this.loadDetailData(); // Refrescar detalle
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al guardar los items. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  async deleteDetailEntry() {
    const selectedNodes = this.detailGridApi?.getSelectedNodes();
    if (!selectedNodes || selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar Item',
        'Por favor, seleccione un item para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    if (id.toString().startsWith('temp_')) {
      // Eliminar localmente si es temporal
      this.detailRowData = this.detailRowData.filter(item => item.id !== id);
      return;
    }

    this.generatorsService.deleteItemGenerador(id).pipe(
      catchError((error) => {
        alerts.basicAlert(
          'Eliminar Item',
          'Error al eliminar el item del generador.',
          'error'
        );
        console.error(error);
        return EMPTY;
      })
    )
      .subscribe(
        () => {
          alerts.basicAlert(
            'Eliminar Item',
            'Item eliminado satisfactoriamente.',
            'success'
          );
          this.loadDetailData();
        }
      );
  }

  private cleanDetailDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    return cleanedData;
  }

}