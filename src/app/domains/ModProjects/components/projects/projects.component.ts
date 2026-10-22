
import { Component, effect, inject, TemplateRef, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { DomainsModule } from 'app/domains/domainsmodule';
import { FollowprojectsService } from '../../../../services/followprojects.service';
import { ColDef, GridApi, GridReadyEvent, CellDoubleClickedEvent} from 'ag-grid-enterprise';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { catchError, EMPTY, forkJoin, lastValueFrom, map, Observable, of, switchMap } from 'rxjs';
import { DetailPersonalByProyectComponent } from './personal/detail-personal-by-proyect.component';
import { Iproject } from 'app/interface/iproject';
import { ProjectsService } from 'app/services/projects.service';
import { OilfieldService } from 'app/services/oilfield.service';
import { SignalsService } from 'app/services/signals.service';
import { PersonalByProyectService } from 'app/services/personalByProyect.service';
import { TrackingService } from 'app/services/tracking.service';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { WorkprogramApuService } from 'app/services/workprogram-apu.service';
import { WorkprogramApuCuadrillaService } from 'app/services/workprogram-apu-cuadrilla.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { DailyReportService } from 'app/services/daily-report.service';
import Swal from 'sweetalert2';


// Esta funcion valida que programStart sea siempre menor a programEnd
export function dateRangeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const programStart = control.get('programStart')?.value;
    const programEnd = control.get('programEnd')?.value;
    const realPronosticLPO = control.get('realPronosticLPO')?.value;
    const realPronosticTTT = control.get('realPronosticTTT')?.value;

    const programDatesInvalid = programStart && programEnd && programStart > programEnd;
    const pronosticDatesInvalid = realPronosticLPO && realPronosticTTT && realPronosticLPO > realPronosticTTT;

    if (programDatesInvalid || pronosticDatesInvalid) {
      return { dateRangeInvalid: true };
    }

    return null;
  };
}

// Workaorund que corrige la opción por default
export function noDefaultValueValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === 'Seleccione un tipo de construcción' ||
      value === 'Seleccione un contrato' ||
      value === 'Seleccione Ubicacion' ||
      value === 'Seleccione una clasificación') {
      return { noDefaultValue: true };
    }
    return null;
  };
}

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [DomainsModule, FormsModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss'
})
export class ProjectsComponent {
  private trackingService = inject(TrackingService);
  constructor() {

    this.initForm();

    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.signalsService.getBranchSelectedBySidebar()();
      this.signalsService.getProjectSelectedBySidebar()();
      this.idConvention = this.signalsService.getConventionVigente()()?.id ?? null;
      if (this.idCompany && Number(this.idCompany) > 0) this.getProjects();
    })
  }

  @ViewChild('content') content!: TemplateRef<any>;

  addProject: FormGroup;

  formData: any;
  providers: any;
  contracts: any;
  oilfields: any;
  oilfieldCatalog: any[] = [];
  locations: any[] = [];
  cantidadPersonal: any;
  selectedRowData: Iproject | null = null;

  isEditing = false;
  isSave = false;
  isCancel = false;
  isDelete = false;
  isPrint = false;
  idCompany: number = null;
  idConvention: number = null;

  screenSizeSM = false;
  notSavedChanges: boolean = false;
  showBudgetDashboard = false;
  budgetDashboard: any = null;
  isBudgetLoading = false;
  isCopyingActivities = false;
  contractActivitySearch = '';
  activeProgramTab: 'contract' | 'project' = 'contract';
  selectedContractActivityIds = new Set<number>();
  addingContractActivityId: number | null = null;
  editingProjectActivityId: number | null = null;
  projectActivityQuantityDraft = 0;
  removingProjectActivityId: number | null = null;

  // Inject of new way for Angular 18
  private modalService = inject(NgbModal);
  private projectsService = inject(ProjectsService);
  private followprojectsService = inject(FollowprojectsService);
  private oilfieldsService = inject(OilfieldService);
  private signalsService = inject(SignalsService);
  private personalByProyectService = inject(PersonalByProyectService);
  private workprogramsService = inject(WorkprogramsService);
  private workprogramApuService = inject(WorkprogramApuService);
  private workprogramApuCuadrillaService = inject(WorkprogramApuCuadrillaService);
  private catalogsService = inject(CatalogsService);
  private dailyReportService = inject(DailyReportService);
  isDeletingProject = false;

  public project: Iproject[] = [];
  private gridApi!: GridApi<Iproject>;

  // Define data of Grid
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public groupDefaultExpanded = 0;
  private collapseTimer: any = null;

  components = {
        detailPersonalByProyect: DetailPersonalByProyectComponent
    };
  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
  headerHeight: 30,
  rowHeight: 30,
  masterDetail: true,
  detailCellRenderer: 'detailPersonalByProyect',

  // Altura por defecto del detalle
  detailRowHeight: 400,

  detailCellRendererParams: {
    detailGridOptions: {
      columnDefs: [
        {
          field: 'id',
          headerName: 'ID',
          width: 80,
          hide: true
        },
        {
          field: 'name',
          headerName: 'Nombre',
          flex: 2
        },
        {
          field: 'role',
          headerName: 'Rol/Puesto',
          flex: 2
        },
        {
          field: 'email',
          headerName: 'Email',
          flex: 2
        },
        {
          field: 'phone',
          headerName: 'Teléfono',
          flex: 1
        },
        {
          field: 'active',
          headerName: 'Activo',
          cellRenderer: 'agCheckboxCellRenderer',
          width: 80
        }
      ],
      defaultColDef: {
        sortable: true,
        filter: true,
        resizable: true,
        flex: 1
      },
      onFirstDataRendered: (params) => {
        const allColumnIds: string[] = [];
        params.api.getColumns()?.forEach((column: any) => {
          allColumnIds.push(column.getId());
        });
        params.api.autoSizeColumns(allColumnIds, false);
      }
    },
    getDetailRowData: (params) => {
      // Load personal data for the project
      this.personalByProyectService.getPersonalByProyect(params.data.id).subscribe(
        (data: any) => {
          params.successCallback(data);
        },
        (error) => {
          console.error('Error fetching personal data:', error);
          params.successCallback([]);
        }
      );
    }
  },

  getRowClass: (params) => {
    return params.node.isSelected() ? 'selected-row' : '';
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


  colMaster: ColDef[] = [
    { field: 'id', headerName: 'id', flex: 1 , hide: true, filter: 'agNumberColumnFilter', // Filtro para números (si el ID es numérico)
        filterParams: {
          filterOptions: ['equals'], // Opciones de filtro
        }},
    {
      colId: 'projectDataPresence',
      headerName: 'Datos',
      width: 132,
      minWidth: 116,
      maxWidth: 145,
      sortable: true,
      filter: true,
      valueGetter: (params) => [
        params.data?.hasDailyReports && 'Reportes diarios',
        params.data?.hasRequisitions && 'Requisiciones',
        params.data?.hasPurchaseOrders && 'Órdenes de compra',
        params.data?.hasEntries && 'Entradas',
        params.data?.hasExits && 'Salidas'
      ].filter(Boolean).join(', '),
      cellRenderer: (params) => {
        const data = params.data;
        if (!data) return '';
        const icons = [
          { active: data.hasDailyReports, icon: 'bi-journal-text', label: 'Reportes diarios', color: '#198754' },
          { active: data.hasRequisitions, icon: 'bi-clipboard-check', label: 'Requisiciones', color: '#2563eb' },
          { active: data.hasPurchaseOrders, icon: 'bi-receipt', label: 'Órdenes de compra', color: '#7c3aed' },
          { active: data.hasEntries, icon: 'bi-box-arrow-in-down', label: 'Entradas', color: '#059669' },
          { active: data.hasExits, icon: 'bi-box-arrow-up-right', label: 'Salidas', color: '#d97706' }
        ].filter(item => item.active);
        return icons.length
          ? `<span style="display:inline-flex;align-items:center;gap:8px">${icons.map(item => `<i class="bi ${item.icon}" style="color:${item.color}" title="${item.label}" aria-label="${item.label}"></i>`).join('')}</span>`
          : '';
      },
      tooltipValueGetter: (params) => params.value || ''
    },
    { field: 'idConsecutivo', headerName: 'Id Obra', flex: 1 },
    { field: 'number', headerName: 'Formato Reporte', width: 150, flex: 2 },
    { field: 'name', headerName: 'Nombre Proyecto', width: 100, filter: true, flex: 2 },
    
    { field: 'year', headerName: 'Año', flex: 1 },
    {
      headerName: 'Ubicación',
      flex: 2,
      valueGetter: (params: any) => {
        if (!params.data?.idOilfield || !this.oilfields?.length) return '';
        const oil = this.oilfields.find((o: any) => o.id === params.data.idOilfield);
        return oil ? oil.name : '';
      }
    },
    { field: 'description', headerName: 'Descripcion', flex: 4 },
    {
      field: 'personal',
      headerName: 'Personal',
      flex: 1.5,
      cellRenderer: (params) => {
        const cantidadList = params.context.componentParent.cantidadPersonal;
        const found = cantidadList.find(x => x.idProyect === params.data.id);
      
        const count = found ? found.count : 0;
      
        return `
          <span style="display:flex; align-items:center; gap:6px;">
            <i class="fa fa-users" style="color:#1976d2;"></i>
            <span>${count}</span>
          </span>
        `;
      }
    },
    { field: 'state', headerName: 'Estado', flex: 1 },
    { field: 'classification', headerName: 'Clasificación', width: 100, filter: true, flex: 2 }
  ];

  ngOnInit(): void {
    //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
    this.getProjects();
    this.obtenerCantidadEmpleados();
    this.oilfieldsService.getOilfields().subscribe({
      next: (data: any) => { this.oilfields = data; },
      error: () => { this.oilfields = []; }
    });
  }
  obtenerCantidadEmpleados(): void {
    this.personalByProyectService.getCantidadPersonal().subscribe(
      (data: any) => {
        this.cantidadPersonal = data;
        console.log('Personal data loaded:', this.cantidadPersonal);
      },
      (error) => {
        console.error('Error fetching personal data:', error);
        this.cantidadPersonal = [];
      }
    );
  }

  initForm() {
    const now = new Date();
    const monthStart = this.formatDateInputLocal(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = this.formatDateInputLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const yearEnd = this.formatDateInputLocal(new Date(now.getFullYear(), 11, 31));
    this.addProject = new FormGroup({
      id: new FormControl(),
      idConsecutivo: new FormControl(null, Validators.required),
      description: new FormControl('', Validators.required),
      name: new FormControl('', Validators.required),
      number: new FormControl('S/N'),
      priority: new FormControl(0, Validators.required),
      programStart: new FormControl(monthStart, Validators.required),
      programEnd: new FormControl(monthEnd, Validators.required),
      realPronosticLPO: new FormControl(monthStart, Validators.required),
      realPronosticTTT: new FormControl(yearEnd, Validators.required),
      state: new FormControl('Ejecucion', [Validators.required]),
      typeConstruction: new FormControl('Seleccione un tipo de construcción', [Validators.required, noDefaultValueValidator()]),
      classification: new FormControl('Terrestre', [Validators.required, noDefaultValueValidator()]),
      active: new FormControl(1),
      idActive: new FormControl(1),
      comment: new FormControl(''),
      request: new FormControl(''),
      supplyPipe: new FormControl('NO'),
      dateDelivery: new FormControl(null),
      receivedEngineering: new FormControl('NO'),
      government: new FormControl('NO'),
      lineRight: new FormControl('NO'),
      budgetManagement: new FormControl('NO'),
      idContrato: new FormControl('Seleccione un contrato', [Validators.required, noDefaultValueValidator()]),
      idOilfield: new FormControl('Seleccione Ubicacion', [Validators.required, noDefaultValueValidator()]),
      year: new FormControl('2024'),
      diameter: new FormControl('0'),
    }, { validators: dateRangeValidator() });
  }

  getProjects() {
    if (!this.idCompany || Number(this.idCompany) <= 0) {
      this.project = [];
      return;
    }
    this.projectsService.getProjectListByCompany(this.idCompany).subscribe(
      (resp: any) => {
        this.project = this.mapProject(resp);
        this.loadWarehousePresence(this.project);
        const sidebarProjectId = Number(this.signalsService.getProjectSelectedBySidebar()() || 0);
        if (sidebarProjectId > 0) {
          this.selectedRowData = this.project.find(p => Number(p.id) === sidebarProjectId) ?? null;
        }
        console.log('Projects loaded:', this.project);
      },
      (error) => {
        console.error('Error fetching projects', error);
      }
    );
  }

  private loadWarehousePresence(projects: Iproject[]): void {
    if (!projects.length) return;
    this.projectsService.getProjectDependencies(projects.map(project => Number(project.id))).subscribe({
      next: dependencies => {
        const byProject = new Map(dependencies.map(item => [Number(item.idProject), item]));
        projects.forEach(project => {
          const presence = byProject.get(Number(project.id));
          project.hasRequisitions = presence?.hasRequisitions === true;
          project.hasPurchaseOrders = presence?.hasPurchaseOrders === true;
          project.hasEntries = presence?.hasEntries === true;
          project.hasExits = presence?.hasExits === true;
        });
        this.gridApi?.refreshCells({ force: true, columns: ['projectDataPresence'] });
      },
      error: error => {
        console.error('Error loading project dependencies:', error);
        alerts.basicAlert('Indicadores no disponibles', 'No se pudieron cargar las requisiciones y movimientos de los proyectos.', 'warning');
      }
    });
  }

  mapProject(data: any[]): Iproject[] {
    return data.map(w => ({
      id: w.id,
      idConsecutivo: w.idConsecutivo,
      number: w.number,
      name: w.name,
      priority: w.priority,
      description: w.description,
      programStart: w.programStart,
      programEnd: w.programEnd,
      realPronosticLPO: w.realPronosticLPO,
      realPronosticTTT: w.realPronosticTTT,
      idContrato: w.idContrato,
      idOilfield: w.idOilfield,
      company: w.company,
      year: w.year,
      diameter: w.diameter,
      active: w.active,
      hasDailyReports: w.hasDailyReports === true,
      length: w.length,
      budgetManagement: w.budgetManagement,
      lineRight: w.lineRight,
      receivedEngineering: w.receivedEngineering,
      government: w.government,
      classification: w.classification,
      typeConstruction: w.typeConstruction,
      state: w.state,
      request: w.request,
      idActive: w.idActive
    } as Iproject));
  }

  onSelectionChanged(event: any) {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      this.showBudgetDashboard = false;
      this.budgetDashboard = null;
      this.openBudgetDashboard();
    } else {
      this.selectedRowData = null;
    }
  }

  async openBudgetDashboard(): Promise<void> {
    if (!this.selectedRowData?.id || !this.idConvention) {
      alerts.basicAlert('Selecciona un convenio', 'Selecciona el convenio vigente en el sidebar para consultar y distribuir el programa.', 'warning');
      return;
    }
    this.isBudgetLoading = true;
    this.showBudgetDashboard = true;
    this.selectedContractActivityIds.clear();
    this.activeProgramTab = 'contract';
    const project: any = this.selectedRowData;
    const idContract = Number(project.idContrato || 0);
    try {
      const contract = await lastValueFrom(
        this.followprojectsService.getContractById(idContract).pipe(catchError(() => of(null)))
      );
      const [contractProgram, projectProgram, phaseCatalog] = await Promise.all([
        lastValueFrom(this.workprogramsService.getWorkPrograms(idContract, 'Contract').pipe(catchError(() => of([])))),
        lastValueFrom(this.workprogramsService.getWorkPrograms(Number(project.id), 'Project').pipe(catchError(() => of([])))),
        lastValueFrom(this.catalogsService.getPhases(Number(this.idCompany)).pipe(catchError(() => of([]))))
      ]);
      const contractProjects = (this.project ?? []).filter(p => Number(p.idContrato) === idContract);
      const allProjectPrograms = await Promise.all(contractProjects.map(p =>
        lastValueFrom(this.workprogramsService.getWorkPrograms(Number(p.id), 'Project').pipe(catchError(() => of([]))))
      ));
      const belongsToConvention = (row: any) => Number(row?.idConvention || 0) === Number(this.idConvention);
      const linkedSourceIds = new Set(projectProgram
        .filter(belongsToConvention)
        .map((row: any) => Number(row.idSourceWorkprogram || 0))
        .filter((id: number) => id > 0));
      const contractActivities = contractProgram.filter((row: any) => belongsToConvention(row) && this.isProgramActivity(row));
      const projectActivities = projectProgram.filter((row: any) => belongsToConvention(row) && this.isProgramActivity(row));
      const apuRows = (await Promise.all(projectActivities.map(async (activity: any) => {
        const [resources, crews] = await Promise.all([
          lastValueFrom(this.workprogramApuService.getByWorkprogram(Number(activity.id)).pipe(catchError(() => of([])))),
          lastValueFrom(this.workprogramApuCuadrillaService.getByWorkprogram(Number(activity.id)).pipe(catchError(() => of([]))))
        ]);
        activity.resources = resources;
        activity.crews = crews;
        return resources;
      }))).flat();
      const resourceSummary = ['MATERIAL', 'PERSONAL', 'EQUIPO', 'HERRAMIENTA', 'AUXILIAR'].map(type => ({
        type,
        count: apuRows.filter((row: any) => String(row.type || '').toUpperCase() === type).length,
        total: apuRows
          .filter((row: any) => String(row.type || '').toUpperCase() === type)
          .reduce((sum: number, row: any) => sum + Number(row.total ?? (Number(row.quantity || 0) * Number(row.unitCost || 0))), 0)
      }));
      const crewCount = projectActivities.reduce((sum: number, row: any) => sum + (row.crews?.length || 0), 0);
      const contractLimit = Number(contract?.amountMx ?? contract?.amountMX ?? contract?.amount ?? 0);
      const contractProgramCost = this.programCost(contractActivities);
      const projectProgramCost = this.programCost(projectActivities);
      const configuredPhases = (phaseCatalog ?? [])
        .map((phase: any) => String(phase.description ?? '').trim())
        .filter((phase: string) => !!phase);
      const contractPhaseResult = this.groupByConfiguredPhase(contractActivities, configuredPhases);
      const projectPhaseResult = this.groupByConfiguredPhase(projectActivities, configuredPhases);
      const allocatedCost = allProjectPrograms.reduce((sum, rows) =>
        sum + this.programCost((rows ?? []).filter((row: any) => belongsToConvention(row) && this.isProgramActivity(row))), 0);
      this.budgetDashboard = {
        project, contract, contractLimit, contractProgramCost, projectProgramCost,
        allocatedCost, availableCost: contractLimit - allocatedCost,
        contractActivities, projectActivities, linkedSourceIds,
        configuredPhases,
        contractPhases: contractPhaseResult.groups,
        projectPhases: projectPhaseResult.groups,
        contractActivitiesWithoutValidPhase: contractPhaseResult.unmatched,
        projectActivitiesWithoutValidPhase: projectPhaseResult.unmatched,
        resourceSummary, crewCount
      };
    } finally {
      this.isBudgetLoading = false;
    }
  }

  private isProgramActivity(row: any): boolean {
    return Number(row?.active ?? 1) === 1 && !!String(row?.text ?? row?.activity ?? '').trim();
  }

  private programCost(rows: any[]): number {
    return (rows ?? []).reduce((sum, row) => sum + Number(row.total ?? (Number(row.quantity || 0) * Number(row.costMX || 0))), 0);
  }

  private groupByConfiguredPhase(rows: any[], configuredPhases: string[]): { groups: any[]; unmatched: any[] } {
    const normalized = (value: any) => String(value ?? '').trim().toLocaleLowerCase('es');
    const phaseNames = configuredPhases;
    const validNames = new Set(phaseNames.map(normalized));
    return {
      groups: phaseNames.map(name => ({
        name,
        activities: (rows ?? []).filter(row => normalized(row.phase) === normalized(name))
      })),
      unmatched: (rows ?? []).filter(row => !validNames.has(normalized(row.phase)))
    };
  }

  contractActivityMatches(activity: any): boolean {
    const query = this.contractActivitySearch.trim().toLocaleLowerCase('es');
    return !query || `${activity.activity ?? ''} ${activity.text ?? ''} ${activity.phase ?? ''}`
      .toLocaleLowerCase('es').includes(query);
  }

  toggleContractActivity(activity: any): void {
    const id = Number(activity.id);
    if (!id || this.budgetDashboard?.linkedSourceIds?.has(id)) return;
    if (this.selectedContractActivityIds.has(id)) this.selectedContractActivityIds.delete(id);
    else this.selectedContractActivityIds.add(id);
  }

  async copySelectedContractActivities(): Promise<void> {
    if (!this.selectedRowData?.id || !this.selectedContractActivityIds.size) return;
    this.isCopyingActivities = true;
    try {
      const response = await lastValueFrom(this.workprogramsService.copyContractActivitiesToProject(
        Number(this.selectedRowData.idContrato),
        Number(this.selectedRowData.id),
        Array.from(this.selectedContractActivityIds),
        this.idConvention
      ));
      alerts.basicAlert('Programa del proyecto', response.message, 'success');
      await this.openBudgetDashboard();
    } catch (error: any) {
      console.error('Error copiando actividades del contrato', error);
      alerts.basicAlert('Programa del proyecto', this.apiErrorMessage(error), 'error');
    } finally {
      this.isCopyingActivities = false;
    }
  }

  async addContractActivity(activity: any): Promise<void> {
    if (!this.selectedRowData?.id || !activity?.id || this.addingContractActivityId) return;
    this.addingContractActivityId = Number(activity.id);
    try {
      const response = await lastValueFrom(this.workprogramsService.copyContractActivitiesToProject(
        Number(this.selectedRowData.idContrato),
        Number(this.selectedRowData.id),
        [Number(activity.id)],
        this.idConvention
      ));
      if (response.copied <= 0) {
        alerts.basicAlert('Programa del proyecto', 'La actividad ya estaba asignada al proyecto.', 'info');
      } else {
        alerts.basicAlert('Programa del proyecto', 'Actividad agregada correctamente.', 'success');
      }
      await this.openBudgetDashboard();
      this.activeProgramTab = 'project';
    } catch (error: any) {
      console.error('Error agregando actividad al proyecto', error);
      alerts.basicAlert('Programa del proyecto', this.apiErrorMessage(error), 'error');
    } finally {
      this.addingContractActivityId = null;
    }
  }

  startProjectQuantityEdit(activity: any): void {
    this.editingProjectActivityId = Number(activity.id);
    this.projectActivityQuantityDraft = Number(activity.quantity || 0);
  }

  cancelProjectQuantityEdit(): void {
    this.editingProjectActivityId = null;
  }

  async saveProjectQuantity(activity: any): Promise<void> {
    const quantity = Number(this.projectActivityQuantityDraft);
    if (!Number.isFinite(quantity) || quantity < 0) {
      alerts.basicAlert('Cantidad', 'Captura una cantidad válida mayor o igual a cero.', 'warning');
      return;
    }
    try {
      await lastValueFrom(this.workprogramsService.updateWorkProgram(Number(activity.id), {
        ...activity,
        quantity,
        idSourceWorkprogram: activity.idSourceWorkprogram ?? null
      }));
      this.editingProjectActivityId = null;
      alerts.basicAlert('Programa del proyecto', 'Cantidad actualizada.', 'success');
      await this.openBudgetDashboard();
      this.activeProgramTab = 'project';
    } catch (error: any) {
      console.error('Error actualizando cantidad del proyecto', error);
      alerts.basicAlert('Programa del proyecto', this.apiErrorMessage(error), 'error');
    }
  }

  async removeProjectActivity(activity: any): Promise<void> {
    if (!activity?.id || this.removingProjectActivityId) return;
    this.removingProjectActivityId = Number(activity.id);
    try {
      await lastValueFrom(this.workprogramsService.deleteWorkProgram(Number(activity.id)));
      alerts.basicAlert('Programa del proyecto', 'Actividad quitada del proyecto. El contrato no fue modificado.', 'success');
      await this.openBudgetDashboard();
      this.activeProgramTab = 'project';
    } catch (error: any) {
      console.error('Error quitando actividad del proyecto', error);
      alerts.basicAlert('Programa del proyecto', this.apiErrorMessage(error), 'error');
    } finally {
      this.removingProjectActivityId = null;
    }
  }

  private apiErrorMessage(error: any): string {
    if (typeof error?.error === 'string' && error.error.trim()) return error.error;
    return error?.error?.message || error?.message || 'No fue posible completar la operación.';
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
  }

  statusBar = {
    statusPanels: [
      {
        statusPanel: 'agTotalAndFilteredRowCountComponent',
        align: 'left',
      }
    ]
  };

  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true, // Enable row grouping for all columns
    flex: 1
  };

  addRow() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo projects', 'Proyectos', this.trackingService.getEmail());
    this.isEditing = false;
    this.initForm();
    this.openModal();
  }

  editRow(): void {
    if (!this.selectedRowData) {
      alerts.basicAlert(
        'Editar contrato',
        'Por favor, seleccione un proyecto para editar.',
        'warning'
      );
      return;
    }

    this.isEditing = true;
    this.populateForm(this.selectedRowData);
    this.openModal();
  }

  populateForm(data: Iproject) {
    this.addProject.patchValue({
      id: data.id,
      idConsecutivo: data.idConsecutivo,
      number: data.number,
      name: data.name,
      priority: data.priority,
      description: data.description,
      programStart: this.formatDateForInput(data.programStart),
      programEnd: this.formatDateForInput(data.programEnd),
      realPronosticLPO: this.formatDateForInput(data.realPronosticLPO),
      realPronosticTTT: this.formatDateForInput(data.realPronosticTTT),
      idContrato: data.idContrato,
      idOilfield: data.idOilfield,
      company: data.company,
      year: data.year,
      diameter: data.diameter,
      active: data.active,
      length: data.length,
      budgetManagement: data.budgetManagement,
      lineRight: data.lineRight,
      receivedEngineering: data.receivedEngineering,
      government: data.government,
      classification: data.classification,
      typeConstruction: data.typeConstruction,
      state: data.state,
      request: data.request,
      idActive: data.idActive
    });
  }

  formatDateForInput(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  private formatDateInputLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
      // Verificar que event.data esté disponible antes de acceder a sus propiedades
      if (!event.data) {
        console.warn('No hay datos en la fila seleccionada');
        return;
      }

      const colId = event.column.getColId();
      const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
      const selectedId = selectedRowData.id; // Obtener el ID del registro

      this.notSavedChanges = true;
      this.selectedRowData = selectedRowData;

      //console.log(`Doble clic en la columna: ${colId}, ID del proyecto: ${selectedId}`);
      if (colId === 'personal') {
        // Check current filter state
        const currentFilterModel = this.gridApi.getFilterModel();
        const isCurrentlyFiltered = currentFilterModel && currentFilterModel['id'] && currentFilterModel['id'].filter === selectedId;

        if (isCurrentlyFiltered) {
          // If already filtered to this project, clear filter and collapse
          this.gridApi.setFilterModel(null);
          this.gridApi.onFilterChanged();
          event.node.setExpanded(false);
        } else {
          // Apply filter to show only the selected project and expand
          const filterModel = {
            id: {
              type: 'equals',
              filter: selectedId,
            },
          };
          this.gridApi.setFilterModel(filterModel);
          this.gridApi.onFilterChanged();
          event.node.setExpanded(true);
        }
      }
   }

  openModal() {
    forkJoin({
      contracts: this.followprojectsService.getContract(-this.idCompany), // en negativo para aprovechar que ya tenemos u servicio que hace lo que necesitamos con el id negativo
      oilfields: this.oilfieldsService.getOilfields(),
      oilfieldCatalog: this.catalogsService.getTypeEquipment(Number(this.idCompany), 'ESTADOS'),
      locations: this.catalogsService.getTypeEquipment(Number(this.idCompany), 'UBICACION').pipe(catchError(() => of([])))
    }).pipe(
      switchMap(result => this.ensureOilfieldsInCatalog((result.oilfields ?? []) as any[], (result.oilfieldCatalog ?? []) as any[]).pipe(
        map(oilfieldCatalog => ({ ...result, oilfieldCatalog }))
      )),
      catchError(error => {
        console.error('Error fetching data:', error);
        alerts.basicAlert(
          'Error',
          'Hubo un problema al cargar los datos. Por favor, inténtelo de nuevo.',
          'error'
        );
        return [];
      })
    ).subscribe({
      next: (result) => {
        this.contracts = result.contracts;
        this.oilfields = result.oilfields;
        this.oilfieldCatalog = this.sortLocations(result.oilfieldCatalog ?? []);
        this.locations = this.sortLocations(result.locations ?? []);

        const modalOptions: NgbModalOptions = {
          size: 'xl',
          centered: true,
          scrollable: true,
          windowClass: 'project-editor-modal'
        };
        this.modalService.open(this.content, modalOptions);
      },
      error: (error) => {
        console.error('Error in subscription:', error);
      }
    });
  }

  private ensureOilfieldsInCatalog(oilfields: any[], catalog: any[]): Observable<any[]> {
    const knownIds = new Set(catalog.map(item => Number(item?.valueAddition ?? item?.ValueAddition)).filter(Number.isFinite));
    const missing = oilfields.filter(item => item?.id != null && !knownIds.has(Number(item.id)));
    if (!missing.length) return of(catalog);

    return forkJoin(missing.map(oilfield => this.catalogsService.addCatalogToSmp({
      idCompany: Number(this.idCompany),
      description: String(oilfield.name ?? oilfield.Name ?? `Ubicación ${oilfield.id}`),
      valueAddition: String(oilfield.id),
      type: 'ESTADOS',
      active: 1,
    }))).pipe(
      map((saved: any[]) => [...catalog, ...missing.map((oilfield, index) => ({
        ...(saved[index] ?? {}),
        description: saved[index]?.description ?? saved[index]?.Description ?? oilfield.name ?? oilfield.Name,
        valueAddition: String(oilfield.id),
        type: 'ESTADOS',
        active: 1,
      }))])
    );
  }

  addState(): void {
    Swal.fire({
      title: 'Agregar estado',
      text: 'Se guardará en el catálogo de la empresa.',
      input: 'text',
      inputLabel: 'Estado de la República Mexicana',
      inputPlaceholder: 'Escribe el nombre del estado',
      inputAttributes: { maxlength: '100', autocapitalize: 'words', autocomplete: 'off' },
      showCancelButton: true,
      confirmButtonText: 'Agregar estado',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0d6efd',
      inputValidator: value => {
        const name = String(value ?? '').trim();
        if (!name) return 'Escribe el nombre del estado';
        if (this.oilfieldCatalog.some(item => String(item?.description ?? item?.Description ?? '').trim().toLowerCase() === name.toLowerCase())) {
          return 'Ese estado ya está registrado';
        }
        return null;
      },
    }).then(result => {
      if (!result.isConfirmed || !String(result.value ?? '').trim()) return;

      const name = String(result.value).trim();
      this.oilfieldsService.addOilfield({
        name,
        nameState: name,
        direccion: name,
        coordinates: '',
        contractId: 1,
        active: 1,
      }).pipe(
        switchMap(() => this.oilfieldsService.getOilfields().pipe(
          switchMap((records: any) => {
            const createdOilfield = (Array.isArray(records) ? records : []).find((item: any) =>
              String(item?.name ?? item?.Name ?? '').trim().toLowerCase() === name.toLowerCase()
            );
            const oilfieldId = Number(createdOilfield?.id ?? createdOilfield?.Id ?? createdOilfield?.idOilfield ?? createdOilfield?.idOilField);
            if (!Number.isFinite(oilfieldId) || oilfieldId <= 0) {
              throw new Error('No se encontró el ID del estado recién creado.');
            }
            return this.catalogsService.addCatalogToSmp({
              idCompany: Number(this.idCompany),
              description: name,
              valueAddition: String(oilfieldId),
              type: 'ESTADOS',
              active: 1,
            }).pipe(map((savedCatalog: any) => ({
              ...(savedCatalog ?? {}),
              description: savedCatalog?.description ?? savedCatalog?.Description ?? name,
              valueAddition: String(oilfieldId),
              type: 'ESTADOS',
              active: 1,
            })));
          })
        ))
      ).subscribe({
        next: created => {
          this.oilfields = [...(this.oilfields ?? []), { id: Number(created.valueAddition), name }];
          this.oilfieldCatalog = this.sortLocations([...this.oilfieldCatalog, created]);
          this.addProject.get('idOilfield')?.setValue(String(created.valueAddition));
          alerts.basicAlert('Estado agregado', `${name} quedó disponible en el catálogo.`, 'success');
        },
        error: error => {
          console.error('Error agregando estado al catálogo:', error);
          alerts.basicAlert('Error', 'No se pudo agregar el estado. Verifica que el registro de ubicación y el catálogo se hayan guardado.', 'error');
        },
      });
    });
  }

  addLocation(): void {
    Swal.fire({
      title: 'Nueva ubicación',
      text: 'Se agregará al catálogo de ubicaciones de esta empresa.',
      input: 'text',
      inputLabel: 'Nombre',
      inputPlaceholder: 'Ej. Planta Norte',
      inputAttributes: { maxlength: '25', autocapitalize: 'words', autocomplete: 'off' },
      showCancelButton: true,
      confirmButtonText: '<i class="bi bi-plus-lg"></i> Guardar ubicación',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0d6efd',
      focusConfirm: false,
      inputValidator: (value) => {
        const description = String(value ?? '').trim();
        if (!description) return 'Escribe el nombre de la ubicación';
        if (description.length > 25) return 'El nombre debe tener máximo 25 caracteres';
        if (this.locations.some(item => this.locationValue(item).toLowerCase() === description.toLowerCase())) {
          return 'Esa ubicación ya está registrada';
        }
        return null;
      },
    }).then(result => {
      if (!result.isConfirmed || !String(result.value ?? '').trim()) return;

      const description = String(result.value).trim();
      this.catalogsService.addCatalogToSmp({
        idCompany: Number(this.idCompany),
        description,
        valueAddition: description,
        type: 'UBICACION',
        active: 1,
      }).subscribe({
        next: (saved: any) => {
          const created = saved?.id || saved?.Id
            ? saved
            : { id: saved?.id ?? saved?.Id, description, valueAddition: description, type: 'UBICACION', active: 1 };
          this.locations = this.sortLocations([...this.locations, created]);
          this.addProject.get('typeConstruction')?.setValue(this.locationValue(created));
          alerts.basicAlert('Ubicación agregada', `${description} quedó disponible en el catálogo.`, 'success');
        },
        error: (error) => {
          console.error('Error agregando ubicación al catálogo:', error);
          alerts.basicAlert('Error', 'No se pudo guardar la ubicación en el catálogo.', 'error');
        },
      });
    });
  }

  private locationValue(location: any): string {
    return String(location?.valueAddition ?? location?.ValueAddition ?? location?.description ?? location?.Description ?? '');
  }

  private sortLocations(locations: any[]): any[] {
    return [...locations].sort((a, b) =>
      String(a?.description ?? a?.Description ?? '').localeCompare(String(b?.description ?? b?.Description ?? ''), 'es')
    );
  }

  async deleteProject() {
    if (!this.selectedRowData) {
      alerts.basicAlert(
        'Eliminar proyecto',
        'Por favor, seleccione un proyecto para eliminar.',
        'warning'
      );
      return;
    }

    if (this.isDeletingProject) return;
    this.isDeletingProject = true;
    const projectId = Number(this.selectedRowData.id);
    try {
      const [dailyResponse, warehouseResponse] = await Promise.all([
        lastValueFrom(this.dailyReportService.getDailyReportsByProject(projectId)),
        lastValueFrom(this.projectsService.getProjectDependencies([projectId]))
      ]);
      const reports = Array.isArray(dailyResponse) ? dailyResponse : dailyResponse?.data ?? [];
      const warehouse = warehouseResponse[0];
      if (!warehouse) throw new Error('No se pudo comprobar el uso del proyecto en almacén.');
      const dependencies = [
        Array.isArray(reports) && reports.some((report: any) => report.active !== false && Number(report.active) !== 0) ? 'reportes diarios' : null,
        warehouse.hasRequisitions ? 'requisiciones' : null,
        warehouse.hasPurchaseOrders ? 'órdenes de compra' : null,
        warehouse.hasEntries ? 'entradas' : null,
        warehouse.hasExits ? 'salidas' : null
      ].filter(Boolean);
      if (dependencies.length) {
        alerts.basicAlert('No se puede eliminar el proyecto', `Ya tiene ${dependencies.join(', ')}.`, 'warning');
        this.getProjects();
        return;
      }

      await lastValueFrom(this.projectsService.deleteProject(projectId));
      alerts.basicAlert('Eliminar proyecto', 'Proyecto eliminado satisfactoriamente.', 'success');
      this.selectedRowData = null;
      this.getProjects();
    } catch (error: any) {
      console.error('Error checking or deleting project:', error);
      alerts.basicAlert('Eliminar proyecto', error?.error?.message || 'No se pudo comprobar o eliminar el proyecto. Intenta de nuevo.', 'error');
    } finally {
      this.isDeletingProject = false;
    }
  }

  onSubmit() {
    if (this.addProject.valid) {
      this.formData = this.prepareFormData();
      if (this.isEditing && this.selectedRowData) {
        console.log('Updating contract with data:', this.selectedRowData);
        this.projectsService.updateProject(this.selectedRowData.id, this.formData).pipe(
          catchError((error) => {
            alerts.basicAlert(
              'Actualizar contrato',
              'Hubo un error al intentar actualizar la información.',
              'error'
            );
            console.error('Error updating contract:', error);
            return EMPTY;
          })
        ).subscribe(() => {
          alerts.basicAlert(
            'Actualizar proyecto',
            'Proyecto actualizado exitosamente.',
            'success'
          );
          this.getProjects();
          this.modalService.dismissAll();
          this.resetForm();
        });
      } else {
        console.log('Adding contract with data:', this.formData);
        this.projectsService.addProject(this.formData).pipe(
          catchError((error) => {
            alerts.basicAlert(
              'Añadir proyecto',
              'Hubo un error al intentar guardar la información.',
              'error'
            );
            console.error('Error adding contract:', error);
            return EMPTY;
          })
        ).subscribe(() => {
          alerts.basicAlert(
            'Añadir proyecto',
            'Proyecto añadido exitosamente.',
            'success'
          );
          this.getProjects();
          this.modalService.dismissAll();
          this.resetForm();
        });
      }
    } else {
      alerts.basicAlert(
        this.isEditing ? 'Actualizar proyecto' : 'Añadir proyecto',
        'Debe completar todos los campos correctamente.',
        'error'
      );
    }
  }

  prepareFormData(): any {
    const formValue = this.addProject.value;
    const preparedData = {
      ...formValue,
      programStart: this.formatDateForBackend(formValue.programStart),
      programEnd: this.formatDateForBackend(formValue.programEnd),
      realPronosticLPO: this.formatDateForBackend(formValue.realPronosticLPO),
      realPronosticTTT: this.formatDateForBackend(formValue.realPronosticTTT),
      state: formValue.state,
      // Convertir idContrato e idOilfield a números si no son las opciones por defecto
      idContrato: formValue.idContrato !== 'Seleccione un contrato' ? Number(formValue.idContrato) : null,
      idOilfield: formValue.idOilfield !== 'Seleccione Ubicacion' ? Number(formValue.idOilfield) : null,
      priority: Number(formValue.priority)
    };

    // Si no estamos editando (es una entrada nueva), eliminamos el campo id
    if (!this.isEditing) {
      delete preparedData.id;
    }

    return preparedData;
  }

  formatDateForBackend(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  resetForm() {
    this.initForm();
    this.isEditing = false;
    this.selectedRowData = null;
  }

}
