import { Component, inject, HostListener, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { GeneratorsService } from 'app/services/generators.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { SignalsService } from 'app/services/signals.service';
import { EmployeesService } from 'app/services/employees.service';
import { DailyReportService } from 'app/services/daily-report.service';
import { TrackingService } from 'app/services/tracking.service';
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
  private employeesService = inject(EmployeesService);
  private dailyReportService = inject(DailyReportService);
  private trackingService = inject(TrackingService);

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  treeData: any[] = [];
  selectedRowData: any = null;
  selectedNodeType: 'generator' | 'item' | null = null;

  showFaseModal  = false;
  newFaseName    = '';
  private pendingFaseNode: any = null;
  
  viewMode: 'master' | 'detail' = 'master';
  selectedGeneratorForDetail: any = null;
  
  activitiesOptions: any[] = [];
  employees: any[] = [];
  fases: any[] = [];
  private project = this.signalsService.getProjectSelectedBySidebar()();

  constructor() { }

  ngOnInit() {
    const selectedContract = this.signalsService.getContractSelectedBySidebar()();
    if (!selectedContract || Number(selectedContract) <= 0) {
      alerts.basicAlert(
        'Contrato requerido',
        'Hey debes de tener siempre un Contrato para una estimacion',
        'warning'
      );
      this.treeData = [];
      return;
    }

    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Acceso a Generadores',
      'Modulo Proyectos - Generadores',
      this.trackingService.getEmail()
    );
    
    this.obtenerDatos();
    this.loadActivities();
    this.loadEmployees();
    this.loadFases();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['idEstimacion'] && !changes['idEstimacion'].firstChange) {
      this.obtenerDatos();
    }
  }

  obtenerDatos() {
    if (!this.idEstimacion) {
      this.treeData = [];
      return;
    }

    this.generatorsService.getGenerators(this.idEstimacion).subscribe(async (generators: any) => {
        if (this.viewMode === 'master') {
          this.treeData = generators.map(generator => ({
            ...generator,
            nodeType: 'generator',
            originalId: generator.id 
          }));
        } else {
          await this.buildTreeStructure(generators);
        }
        if (this.gridApi) {
            this.gridApi.setGridOption('rowData', this.treeData);
        }
      }, (error) => {
        console.error('Error al cargar generators:', error);
        this.treeData = []; // Limpia los datos si hay un error (ej. 404 Not Found)
      });
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

  loadEmployees() {
    const idRoot = this.signalsService.getRootSelectedBySidebar()();
    const idBranch = -idRoot; // Convertir a negativo como se solicita

    this.employeesService.getEmployees(idBranch).subscribe({
      next: (response: any) => {
        if (response && Array.isArray(response)) {
          // El endpoint devuelve directamente un array de empleados
          this.employees = response;
        } else if (response && response.data && Array.isArray(response.data)) {
          // Por si acaso viene encapsulado en un objeto con propiedad data
          this.employees = response.data;
        } else {
          this.employees = [];
        }
      },
      error: (error) => {
        console.error('Error al cargar empleados:', error);
        this.employees = [];
      }
    });
  }

  loadFases() {
    if (!this.project) return;
    this.workprogramsService.getFathers(this.project)
      .subscribe((fases: any[]) => {
        this.fases = fases;
      }, (error) => {
        console.error('Error al cargar fases:', error);
        this.fases = [];
      });
  }

  get gridOptions(): any {
    const baseOptions = {
      headerHeight: 30, rowHeight: 30, animateRows: true,
      onRowSelected: (event: any) => { if (event.node.isSelected()) this.onRowSelected(event); },
    };
    if (this.viewMode === 'master') {
      return { ...baseOptions, treeData: false };
    } else {
      return {
        ...baseOptions, treeData: true, groupDefaultExpanded: -1,
        getDataPath: (data: any) => data.orgHierarchy,
        autoGroupColumnDef: {
          headerName: 'Items del Generador', minWidth: 200,
          cellRendererParams: {
            suppressCount: true,
            innerRenderer: (params: any) => {
              if (params.data) {
                if (params.data.nodeType === 'generator') return `📁 ${params.data.numero}`;
                const activity = this.activitiesOptions.find(act => act.id === params.data.idResource);
                return `📄 ${activity ? activity.actandNom : ''}`;
              }
              return '';
            }
          }
        }
      };
    }
  }

  get columnDefs(): ColDef[] {
    if (this.viewMode === 'master') {
      return [
        { field: 'numero', headerName: 'Número Generador', editable: true, flex: 1.5 },
        { 
          field: 'dateStart', headerName: 'Fecha Inicio', editable: true, flex: 1.5,
          cellDataType: 'dateString',
          valueFormatter: (params) => {
            if (params.value) {
              const date = new Date(params.value);
              return date.toLocaleDateString('es-ES');
            }
            return '';
          }
        },
        { 
          field: 'dateEnd', headerName: 'Fecha Final', editable: true, flex: 1.5,
          cellDataType: 'dateString',
          valueFormatter: (params) => {
            if (params.value) {
              const date = new Date(params.value);
              return date.toLocaleDateString('es-ES');
            }
            return '';
          }
        },
        {
          field: 'creado', headerName: 'Creado Por', editable: true, flex: 2,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: this.employees.map(emp => emp.id)
          },
          valueFormatter: (params) => {
            const employee = this.employees.find(emp => emp.id === params.value);
            return employee ? employee.name : '';
          }
        },
        {
          field: 'revisado', headerName: 'Revisado Por', editable: true, flex: 2,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: this.employees.map(emp => emp.id)
          },
          valueFormatter: (params) => {
            const employee = this.employees.find(emp => emp.id === params.value);
            return employee ? employee.name : '';
          }
        },
        {
          field: 'autorizado', headerName: 'Autorizado Por', editable: true, flex: 2,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: {
            values: this.employees.map(emp => emp.id)
          },
          valueFormatter: (params) => {
            const employee = this.employees.find(emp => emp.id === params.value);
            return employee ? employee.name : '';
          }
        },
        {
          field: 'fase', headerName: 'Area', editable: true, flex: 1.5,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: () => ({
            values: [...this.fases.map(fase => fase.name || fase.text || fase.fase), '+ Agregar Nuevo']
          })
        },
        { field: 'aplicaIsometrico', headerName: 'Aplica Isométrico', editable: true, flex: 1, cellRenderer: 'agCheckboxCellRenderer', cellEditor: 'agCheckboxCellEditor' },
        { field: 'comment', headerName: 'Comentarios', editable: true, flex: 2 },
      ];
    } else {
      return [
        { field: 'idResource', headerName: 'Recurso', editable: (p) => p.data?.nodeType === 'item', flex: 2,
          cellEditor: 'agSelectCellEditor', cellEditorParams: { values: this.activitiesOptions.map(a => a.id) },
          valueFormatter: (p) => this.activitiesOptions.find(a => a.id === p.value)?.actandNom || '',
          cellStyle: (p) => p.data?.nodeType === 'generator' ? { display: 'none' } : {}
        },
        { field: 'quantity', headerName: 'Cantidad', editable: (p) => p.data?.nodeType === 'item', flex: 1, cellDataType: 'number', cellStyle: (p) => p.data?.nodeType === 'generator' ? { display: 'none' } : {} },
        { field: 'accumulate', headerName: 'Acumulado', editable: (p) => p.data?.nodeType === 'item', flex: 1, cellDataType: 'number', cellStyle: (p) => p.data?.nodeType === 'generator' ? { display: 'none' } : {} },
        { field: 'comment', headerName: 'Comentarios', editable: true, flex: 2 }
      ];
    }
  }

  async buildTreeStructure(generators: any[]) {
    this.treeData = [];
    const generatorsToProcess = this.viewMode === 'detail' && this.selectedGeneratorForDetail 
      ? [this.selectedGeneratorForDetail] 
      : generators;
    for (const generator of generatorsToProcess) {
      if (this.viewMode === 'detail') {
        this.treeData.push({ ...generator, nodeType: 'generator', orgHierarchy: [generator.numero], id: `gen_${generator.id}`, originalId: generator.id });
      }
      if (!generator.id.toString().startsWith('temp_')) {
        try {
          const items = await lastValueFrom(this.generatorsService.getItemsGeneradores(generator.id));
          for (const item of items) {
            this.treeData.push({ ...item, nodeType: 'item', orgHierarchy: [generator.numero, `Item_${item.id}`], id: `item_${item.id}`, originalId: item.id, parentGeneratorId: generator.id });
          }
        } catch (error) { console.error(`Error cargando items para generador ${generator.id}:`, error); }
      }
    }
  }

  onRowSelected(event: any) {
    this.selectedRowData = event.data;
    if (event.data) {
      this.selectedNodeType = event.data.nodeType || 'generator';
    } else {
      this.selectedNodeType = null;
    }
  }

  viewGeneratorDetail() {
    if (!this.selectedRowData) { alerts.basicAlert('Ver Detalle', 'Por favor, seleccione un generador.', 'warning'); return; }
    this.selectedGeneratorForDetail = this.selectedRowData;
    this.viewMode = 'detail';
    this.obtenerDatos();
  }

  backToMasterView() {
    this.viewMode = 'master';
    this.selectedGeneratorForDetail = null;
    this.obtenerDatos();
  }

  onCellValueChanged(event: any) {
    // Detectar selección de "Agregar Nuevo" en el combo de Area
    if (event.colDef.field === 'fase' && event.newValue === '+ Agregar Nuevo') {
      event.data.fase = event.oldValue ?? '';
      this.pendingFaseNode = event.data;
      this.newFaseName = '';
      this.showFaseModal = true;
      if (this.gridApi) {
        this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['fase'], force: true });
      }
      return;
    }

    event.data.__modified = true;
    this.notSavedChanges = true;

    // Calcular acumulado cuando se selecciona un recurso en items
    if (event.colDef.field === 'idResource' && event.data.nodeType === 'item') {
      this.calculateAccumulate(event);
    }
  }

  confirmNewFase(): void {
    const name = this.newFaseName.trim();
    if (!name) {
      alerts.basicAlert('Aviso', 'El nombre del área no puede estar vacío.', 'warning');
      return;
    }
    if (name.length > 20) {
      alerts.basicAlert('Aviso', 'El nombre no puede superar 20 caracteres.', 'warning');
      return;
    }
    // Agregar al catálogo local si no existe
    if (!this.fases.find(f => (f.name || f.text || f.fase) === name)) {
      this.fases = [...this.fases, { name }];
    }
    // Asignar valor a la fila pendiente
    if (this.pendingFaseNode) {
      this.pendingFaseNode.fase = name;
      this.pendingFaseNode.__modified = true;
      this.notSavedChanges = true;
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.treeData);
      }
    }
    this.closeFaseModal();
  }

  closeFaseModal(): void {
    this.showFaseModal = false;
    this.newFaseName = '';
    this.pendingFaseNode = null;
  }

  private calculateAccumulate(event: any) {
    const item = event.data;
    const selectedResourceId = event.newValue;
    
    // Validar que se haya seleccionado un recurso válido
    if (!selectedResourceId || selectedResourceId === 0) {
      item.accumulate = 0;
      return;
    }
    
    // Encontrar el generador padre para obtener las fechas
    const parentGenerator = this.findParentGenerator(item);
    if (!parentGenerator || !parentGenerator.dateStart || !parentGenerator.dateEnd) {
      console.warn('No se encontró generador padre o fechas válidas');
      item.accumulate = 0;
      return;
    }
    
    // Convertir fechas a formato YYYY-MM-DD
    const startDate = this.formatDateForApi(parentGenerator.dateStart);
    const endDate = this.formatDateForApi(parentGenerator.dateEnd);
    
    if (!startDate || !endDate) {
      console.warn('Fechas inválidas en el generador padre');
      item.accumulate = 0;
      return;
    }
    
    // Llamar al servicio para obtener el acumulado
    
    this.dailyReportService.SumaReporte(selectedResourceId, startDate, endDate)
      .subscribe({
        next: (result) => {
          item.accumulate = result.Total || 0;
          
          // Actualizar el grid para mostrar el nuevo valor
          if (this.gridApi) {
            this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['accumulate'] });
          }
        },
        error: (error) => {
          console.error('Error al calcular acumulado:', error);
          item.accumulate = 0;
          
          // Actualizar el grid para mostrar 0
          if (this.gridApi) {
            this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['accumulate'] });
          }
        }
      });
  }
  
  private findParentGenerator(item: any): any {
    if (this.viewMode === 'detail' && this.selectedGeneratorForDetail) {
      return this.selectedGeneratorForDetail;
    }
    
    // Buscar en treeData el generador padre
    const parentId = item.parentGeneratorId;
    return this.treeData.find(node => 
      node.nodeType === 'generator' && 
      (node.originalId === parentId || node.id === parentId)
    );
  }
  
  private formatDateForApi(dateString: string): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      // Formato YYYY-MM-DD
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error al formatear fecha:', error);
      return '';
    }
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  addGenerator() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Agregar Generador',
      'Modulo Proyectos - Generadores',
      this.trackingService.getEmail()
    );
    
    const tempId = `temp_${this.tempIdCounter++}`;
    
    // Calcular fechas: hoy y hoy + 7 días adicionales
    const today = new Date();
    const dateStart = today.toISOString();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 7); // 7 días adicionales
    const dateEnd = futureDate.toISOString();
    
    const newGenerator = {
      id: tempId, 
      numero: '', 
      idEstimacion: this.idEstimacion, 
      dateStart: dateStart, 
      dateEnd: dateEnd,
      creado: 0,
      revisado: 0,
      autorizado: 0,
      comment: '',
      fase: '',
      aplicaIsometrico: false, 
      active: true, 
      nodeType: 'generator',
      orgHierarchy: [`Generador_${tempId}`], 
      originalId: tempId, 
      __isNew: true,
    };
    
    this.treeData = [newGenerator, ...this.treeData];
    this.notSavedChanges = true;
    
    // Auto-seleccionar y editar campo número
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
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Agregar Item Generador',
      'Modulo Proyectos - Items Generadores',
      this.trackingService.getEmail()
    );
    
    if (!this.selectedRowData || this.selectedNodeType !== 'generator') {
      alerts.basicAlert('Agregar Item', 'Primero debe seleccionar un generador.', 'warning');
      return;
    }
    const tempId = `temp_${this.tempIdCounter++}`;
    const parent = this.selectedRowData;
    this.treeData = [...this.treeData, {
      id: tempId, idType: parent.originalId, idResource: 0, quantity: 0, accumulate: 0, type: 'GENERADOR',
      comment: '', active: true, nodeType: 'item', orgHierarchy: [parent.numero, `Item_${tempId}`],
      originalId: tempId, parentGeneratorId: parent.originalId, __isNew: true,
    }];
    this.notSavedChanges = true;
  }

  saveItems() {
    if (!this.hasItemChanges()) {
      alerts.basicAlert('Guardar Items', 'No hay cambios en items para guardar.', 'info');
      return;
    }
    this.saveTreeChanges();
  }

  hasItemChanges = () => this.treeData.some(item => item.nodeType === 'item' && (item.__isNew || item.__modified));
  isItemSelected = () => this.selectedNodeType === 'item';

  async saveTreeChanges() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Guardar Cambios Generadores',
      'Modulo Proyectos - Generadores',
      this.trackingService.getEmail()
    );
    
    const isValid = this.treeData.every(item => 
      (item.nodeType === 'generator' && item.numero && item.dateStart && item.dateEnd) ||
      (item.nodeType === 'item' && item.idResource !== undefined && item.quantity !== undefined)
    );
    if (!isValid) { alerts.basicAlert('Guardar Cambios', 'Debe llenar todos los campos requeridos.', 'error'); return; }

    const newGenerators = this.treeData.filter(i => i.nodeType === 'generator' && i.__isNew);
    const modifiedGenerators = this.treeData.filter(i => i.nodeType === 'generator' && i.__modified && !i.__isNew);
    const newItems = this.treeData.filter(i => i.nodeType === 'item' && i.__isNew);
    const modifiedItems = this.treeData.filter(i => i.nodeType === 'item' && i.__modified && !i.__isNew);

    try {
      // Guardar Generadores Nuevos
      for (const generator of newGenerators) {
        const tempId = generator.originalId;
        const response = await lastValueFrom(this.generatorsService.addGenerator(this.cleanDataForServer(generator)));
        
        // CORRECCIÓN: Manejar respuesta nula
        if (response && response.id) {
          const newId = response.id;
          generator.id = newId; 
          generator.originalId = newId;
          this.treeData.forEach(item => { if (item.parentGeneratorId === tempId) { item.parentGeneratorId = newId; item.idType = newId; } });
        }
        generator.__isNew = false;
      }

      // Guardar Generadores Modificados
      for (const generator of modifiedGenerators) {
        await lastValueFrom(this.generatorsService.updateGenerator(generator.originalId, this.cleanDataForServer(generator)));
        generator.__modified = false;
      }

      // Guardar Items Nuevos
      for (const item of newItems) {
        const response = await lastValueFrom(this.generatorsService.addItemGenerador(this.cleanDetailDataForServer(item)));
        if (response && response.id) { item.id = response.id; item.originalId = response.id; }
        item.__isNew = false;
      }

      // Guardar Items Modificados
      for (const item of modifiedItems) {
        await lastValueFrom(this.generatorsService.updateItemGenerador(item.originalId, this.cleanDetailDataForServer(item)));
        item.__modified = false;
      }

      alerts.basicAlert('Datos actualizados', 'Los cambios se han guardado correctamente.', 'success');
      this.notSavedChanges = false;
      this.obtenerDatos();
    } catch (error) {
      console.error('Error al guardar:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al guardar los datos.', 'error');
    }
  }

  private cleanDataForServer = (data: any) => ({
    numero: data.numero, 
    idEstimacion: data.idEstimacion, 
    dateStart: data.dateStart,
    dateEnd: data.dateEnd, 
    creado: data.creado || 0,
    revisado: data.revisado || 0,
    autorizado: data.autorizado || 0,
    comment: data.comment || '',
    fase: data.fase || '',
    aplicaIsometrico: data.aplicaIsometrico, 
    active: data.active
  });

  private cleanDetailDataForServer = (data: any) => ({
    idType: data.parentGeneratorId || data.idType, idResource: data.idResource, quantity: data.quantity,
    accumulate: data.accumulate, type: data.type || 'GENERADOR', comment: data.comment, active: data.active
  });
  
  // ======================================================================
  // ===== SECCIÓN DE ELIMINACIÓN CORREGIDA Y FUNCIONAL ===================
  // ======================================================================

  private async confirmAction(title: string, message: string): Promise<boolean> {
    const result = await alerts.confirmAlert(title, message, 'warning', 'Sí, eliminar');
    return result.isConfirmed;
  }

  deleteGenerator() {
    if (!this.selectedRowData || this.selectedNodeType !== 'generator') {
      alerts.basicAlert('Eliminar Generador', 'Por favor, seleccione un generador para eliminar.', 'error');
      return;
    }
    this.deleteTreeNode();
  }

  deleteItem() {
    if (!this.selectedRowData || this.selectedNodeType !== 'item') {
      alerts.basicAlert('Eliminar Item', 'Por favor, seleccione un item para eliminar.', 'error');
      return;
    }
    this.deleteTreeNode();
  }

  async deleteTreeNode() {
    if (!this.selectedRowData) {
      alerts.basicAlert('Eliminar', 'Por favor, seleccione un elemento para eliminar.', 'error');
      return;
    }

    const nodeType = this.selectedRowData.nodeType;
    const nodeName = nodeType === 'generator'
      ? `el generador "${this.selectedRowData.numero}" y todos sus items asociados`
      : `el item seleccionado`;

    const confirmed = await this.confirmAction(
      'Confirmar Eliminación',
      `¿Está seguro de que desea eliminar ${nodeName}? Esta acción no se puede deshacer.`
    );

    if (!confirmed) {
      return;
    }

    const nodeId = this.selectedRowData.originalId;

    if (nodeId.toString().startsWith('temp_')) {
      if (nodeType === 'generator') {
        this.treeData = this.treeData.filter(item =>
          !(item.nodeType === 'generator' && item.id === this.selectedRowData.id) &&
          !(item.nodeType === 'item' && item.parentGeneratorId === this.selectedRowData.originalId)
        );
      } else {
        this.treeData = this.treeData.filter(item => item.id !== this.selectedRowData.id);
      }
      this.selectedRowData = null;
      this.selectedNodeType = null;
      return;
    }

    try {
      if (nodeType === 'generator') {
        await lastValueFrom(this.generatorsService.deleteGenerator(nodeId));
        alerts.basicAlert('Eliminado', 'Generador y sus items eliminados satisfactoriamente.', 'success');
      } else {
        await lastValueFrom(this.generatorsService.deleteItemGenerador(nodeId));
        alerts.basicAlert('Eliminado', 'Item eliminado satisfactoriamente.', 'success');
      }

      this.obtenerDatos();
      this.notSavedChanges = false;
      this.selectedRowData = null;
      this.selectedNodeType = null;
    } catch (error) {
      console.error(error);
      alerts.basicAlert('Error', `Error al eliminar el ${nodeType === 'generator' ? 'generador' : 'item'}.`, 'error');
    }
  }
}
