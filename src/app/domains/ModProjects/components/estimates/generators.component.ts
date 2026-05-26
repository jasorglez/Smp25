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
import { TrackingService } from 'app/services/tracking.service';
import { lastValueFrom } from 'rxjs';
import { GeneratorDetailRendererComponent } from './generator-detail-renderer.component';

@Component({
  selector: 'app-generators',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, GeneratorDetailRendererComponent],
  templateUrl: './generators.component.html',
  styleUrl: './generators.component.scss'
})
export class GeneratorsComponent implements OnChanges {

  @Input() idEstimacion: number = 0;

  private generatorsService  = inject(GeneratorsService);
  private workprogramsService = inject(WorkprogramsService);
  private signalsService      = inject(SignalsService);
  private employeesService    = inject(EmployeesService);
  private trackingService     = inject(TrackingService);

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  private gridApi!: GridApi;
  private tempIdCounter: number = 0;

  rowData:         any[] = [];
  selectedRowData: any   = null;

  showFaseModal  = false;
  newFaseName    = '';
  private pendingFaseNode: any = null;

  activitiesOptions: any[] = [];
  employees:  any[]        = [];
  fases:      any[]        = [];
  private project = this.signalsService.getProjectSelectedBySidebar()();

  // ── Enter-key navigation ──────────────────────────────────────────────────
  private editableColumnOrder = ['numero', 'dateStart', 'dateEnd', 'creado', 'revisado', 'autorizado', 'fase', 'comment'];
  private enterPressed = false;

  defaultColDef: ColDef = {
    sortable: true, resizable: true, minWidth: 80,
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
        return true;
      }
      return false;
    },
  };

  onCellEditingStopped(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableColumnOrder.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder[idx + 1] });
      }, 100);
    }
  }

  // ── Grid Options ──────────────────────────────────────────────────────────

  gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    animateRows: true,
    rowSelection: 'single',
    masterDetail: true,
    detailRowHeight: 360,
    isRowMaster: () => true,
    detailCellRenderer: GeneratorDetailRendererComponent,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    onRowSelected: (event: any) => {
      if (event.node.isSelected()) this.selectedRowData = event.data;
    },
    onRowDoubleClicked: (event: any) => {
      const node = event.node;
      // Cierra otros abiertos
      this.gridApi?.forEachNode((n: any) => {
        if (n.id !== node.id && n.expanded) n.setExpanded(false);
      });
      // Toggle propio
      node.setExpanded(!node.expanded);
      this.actualizarContextoDetalle();
    },
  };

  // ── Column Defs (solo maestro) ────────────────────────────────────────────

  get columnDefs(): ColDef[] {
    return [
      { field: 'numero', headerName: 'Número Generador', editable: true, flex: 1.5 },
      {
        field: 'dateStart', headerName: 'Fecha Inicio', editable: true, flex: 1.2,
        cellEditor: 'agDateCellEditor',
        valueGetter:   (p) => p.data?.dateStart ? String(p.data.dateStart).substring(0, 10) : '',
        valueSetter:   (p) => { p.data.dateStart = p.newValue; return true; },
        valueFormatter: (p) => {
          if (!p.value) return '';
          const [y, m, d] = String(p.value).split('-');
          return d ? `${d}/${m}/${y}` : p.value;
        },
      },
      {
        field: 'dateEnd', headerName: 'Fecha Final', editable: true, flex: 1.2,
        cellEditor: 'agDateCellEditor',
        valueGetter:   (p) => p.data?.dateEnd ? String(p.data.dateEnd).substring(0, 10) : '',
        valueSetter:   (p) => { p.data.dateEnd = p.newValue; return true; },
        valueFormatter: (p) => {
          if (!p.value) return '';
          const [y, m, d] = String(p.value).split('-');
          return d ? `${d}/${m}/${y}` : p.value;
        },
      },
      {
        field: 'creado', headerName: 'Creado Por', editable: true, flex: 1.5,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.employees.map(e => e.id) }),
        valueFormatter: (p) => this.employees.find(e => e.id === p.value)?.name ?? '',
      },
      {
        field: 'revisado', headerName: 'Revisado Por', editable: true, flex: 1.5,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.employees.map(e => e.id) }),
        valueFormatter: (p) => this.employees.find(e => e.id === p.value)?.name ?? '',
      },
      {
        field: 'autorizado', headerName: 'Autorizado Por', editable: true, flex: 1.5,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: this.employees.map(e => e.id) }),
        valueFormatter: (p) => this.employees.find(e => e.id === p.value)?.name ?? '',
      },
      {
        field: 'fase', headerName: 'Área', editable: true, flex: 1.2,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: [...this.fases.map(f => f.name || f.text || f.fase), '+ Agregar Nuevo'],
        }),
      },
      {
        field: 'aplicaIsometrico', headerName: 'Isométrico', editable: true, flex: 0.8,
        cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor',
      },
      { field: 'comment', headerName: 'Comentarios', editable: true, flex: 2 },
    ];
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  constructor() {}

  ngOnInit() {
    const selectedContract = this.signalsService.getContractSelectedBySidebar()();
    if (!selectedContract || Number(selectedContract) <= 0) {
      alerts.basicAlert('Contrato requerido', 'Hey debes de tener siempre un Contrato para una estimacion', 'warning');
      this.rowData = [];
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

  // ── Data loading ──────────────────────────────────────────────────────────

  obtenerDatos() {
    if (!this.idEstimacion) { this.rowData = []; return; }

    this.generatorsService.getGenerators(this.idEstimacion).subscribe(
      (generators: any[]) => {
        this.rowData = generators.map(g => ({ ...g, nodeType: 'generator', originalId: g.id }));
        if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
      },
      (error) => {
        console.error('Error al cargar generators:', error);
        this.rowData = [];
      }
    );
  }

  loadActivities() {
    if (!this.project) return;
    this.workprogramsService.getActivities(this.project).subscribe(
      (activities: any[]) => {
        this.activitiesOptions = activities;
        this.actualizarContextoDetalle();
      },
      (error) => { console.error('Error al cargar actividades:', error); this.activitiesOptions = []; }
    );
  }

  loadEmployees() {
    const idRoot   = this.signalsService.getRootSelectedBySidebar()();
    const idBranch = -idRoot;
    this.employeesService.getEmployees(idBranch).subscribe({
      next: (response: any) => {
        this.employees = Array.isArray(response) ? response
          : Array.isArray(response?.data) ? response.data : [];
      },
      error: () => { this.employees = []; },
    });
  }

  loadFases() {
    if (!this.project) return;
    this.workprogramsService.getFathers(this.project).subscribe(
      (fases: any[]) => { this.fases = fases; },
      (error) => { console.error('Error al cargar fases:', error); this.fases = []; }
    );
  }

  // ── Grid context ──────────────────────────────────────────────────────────

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.actualizarContextoDetalle();
  }

  private actualizarContextoDetalle() {
    if (!this.gridApi) return;
    this.gridApi.setGridOption('detailCellRendererParams', {
      context: { activitiesOptions: this.activitiesOptions },
    });
  }

  // ── Cell value changed (fase modal) ───────────────────────────────────────

  onCellValueChanged(event: any) {
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
  }

  // ── Fase modal ────────────────────────────────────────────────────────────

  confirmNewFase(): void {
    const name = this.newFaseName.trim();
    if (!name) { alerts.basicAlert('Aviso', 'El nombre del área no puede estar vacío.', 'warning'); return; }
    if (name.length > 20) { alerts.basicAlert('Aviso', 'El nombre no puede superar 20 caracteres.', 'warning'); return; }
    if (!this.fases.find(f => (f.name || f.text || f.fase) === name)) {
      this.fases = [...this.fases, { name }];
    }
    if (this.pendingFaseNode) {
      this.pendingFaseNode.fase = name;
      this.pendingFaseNode.__modified = true;
      this.notSavedChanges = true;
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
    }
    this.closeFaseModal();
  }

  closeFaseModal(): void {
    this.showFaseModal = false;
    this.newFaseName = '';
    this.pendingFaseNode = null;
  }

  // ── CRUD generadores ──────────────────────────────────────────────────────

  addGenerator() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(), 'Agregar Generador',
      'Modulo Proyectos - Generadores', this.trackingService.getEmail()
    );

    const tempId  = `temp_${this.tempIdCounter++}`;
    const today   = new Date();
    const future  = new Date(today); future.setDate(today.getDate() + 7);

    const newGen = {
      id: tempId, numero: '', idEstimacion: this.idEstimacion,
      dateStart: today.toISOString(), dateEnd: future.toISOString(),
      creado: 0, revisado: 0, autorizado: 0, comment: '',
      fase: '', aplicaIsometrico: false, active: true,
      nodeType: 'generator', originalId: tempId, __isNew: true,
    };

    this.rowData = [newGen, ...this.rowData];
    this.notSavedChanges = true;

    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'numero' });
      }
    }, 50);
  }

  async deleteGenerator() {
    if (!this.selectedRowData) {
      alerts.basicAlert('Eliminar Generador', 'Por favor, seleccione un generador para eliminar.', 'error');
      return;
    }

    const result = await alerts.confirmAlert(
      'Confirmar Eliminación',
      `¿Está seguro de que desea eliminar el generador "${this.selectedRowData.numero}" y todos sus ítems? Esta acción no se puede deshacer.`,
      'warning', 'Sí, eliminar'
    );
    if (!result.isConfirmed) return;

    const nodeId = this.selectedRowData.originalId ?? this.selectedRowData.id;
    if (String(nodeId).startsWith('temp_')) {
      this.rowData = this.rowData.filter(g => g.id !== this.selectedRowData.id);
      this.selectedRowData = null;
      this.notSavedChanges = this.rowData.some(g => g.__isNew || g.__modified);
      if (this.gridApi) this.gridApi.setGridOption('rowData', this.rowData);
      return;
    }

    try {
      await lastValueFrom(this.generatorsService.deleteGenerator(nodeId));
      alerts.basicAlert('Eliminado', 'Generador y sus ítems eliminados satisfactoriamente.', 'success');
      this.obtenerDatos();
      this.selectedRowData = null;
    } catch (error) {
      console.error(error);
      alerts.basicAlert('Error', 'Error al eliminar el generador.', 'error');
    }
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  async saveGenerators() {
    this.trackingService.addLog(
      this.trackingService.getnameComp(), 'Guardar Cambios Generadores',
      'Modulo Proyectos - Generadores', this.trackingService.getEmail()
    );

    const newOnes  = this.rowData.filter(g => g.__isNew);
    const modified = this.rowData.filter(g => g.__modified && !g.__isNew);

    if (!newOnes.length && !modified.length) {
      alerts.basicAlert('Sin cambios', 'No hay cambios en generadores para guardar.', 'info');
      return;
    }

    try {
      for (const gen of newOnes) {
        const res: any = await lastValueFrom(this.generatorsService.addGenerator(this.cleanGen(gen)));
        if (res?.id) { gen.id = res.id; gen.originalId = res.id; }
        gen.__isNew = false;
      }
      for (const gen of modified) {
        await lastValueFrom(this.generatorsService.updateGenerator(gen.originalId, this.cleanGen(gen)));
        gen.__modified = false;
      }
      alerts.basicAlert('Guardado', 'Generadores guardados correctamente.', 'success');
      this.notSavedChanges = false;
      this.obtenerDatos();
    } catch (error) {
      console.error('Error al guardar:', error);
      alerts.basicAlert('Error', 'Ocurrió un error al guardar los datos.', 'error');
    }
  }

  private cleanGen(data: any) {
    return {
      numero:           data.numero,
      idEstimacion:     data.idEstimacion,
      dateStart:        data.dateStart,
      dateEnd:          data.dateEnd,
      creado:           data.creado    || 0,
      revisado:         data.revisado  || 0,
      autorizado:       data.autorizado || 0,
      comment:          data.comment   || '',
      fase:             data.fase      || '',
      aplicaIsometrico: data.aplicaIsometrico,
      active:           data.active,
    };
  }
}
