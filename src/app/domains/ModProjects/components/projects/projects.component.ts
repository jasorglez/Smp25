
import { Component, effect, inject, TemplateRef, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { DomainsModule } from 'app/domains/domainsmodule';
import { FollowprojectsService } from '../../../../services/followprojects.service';
import { ColDef, GridApi, GridReadyEvent, CellDoubleClickedEvent} from 'ag-grid-enterprise';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { catchError, EMPTY, forkJoin } from 'rxjs';
import { DetailPersonalByProyectComponent } from './personal/detail-personal-by-proyect.component';
import { Iproject } from 'app/interface/iproject';
import { ProjectsService } from 'app/services/projects.service';
import { OilfieldService } from 'app/services/oilfield.service';
import { SignalsService } from 'app/services/signals.service';
import { PersonalByProyectService } from 'app/services/personalByProyect.service';
import { TrackingService } from 'app/services/tracking.service';
import { WorkprogramsService } from 'app/services/workprograms.service';


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
      this.getProjects();
    })
  }

  @ViewChild('content') content!: TemplateRef<any>;

  addProject: FormGroup;

  formData: any;
  providers: any;
  contracts: any;
  oilfields: any;
  cantidadPersonal: any;
  selectedRowData: Iproject | null = null;

  isEditing = false;
  isSave = false;
  isCancel = false;
  isDelete = false;
  isPrint = false;
  idCompany: number = null;

  screenSizeSM = false;
  notSavedChanges: boolean = false;
  showBudgetDashboard = false;
  budgetDashboard: any = null;
  specialtyDraft = 'Civil';
  resourceTypeFilter = 'Todos';
  resourceSearch = '';
  resourceDraft: any = { tipo: 'Material', descripcion: '', unidad: 'pieza', cantPlan: 1, costoUnitPlan: 0 };

  // Inject of new way for Angular 18
  private modalService = inject(NgbModal);
  private projectsService = inject(ProjectsService);
  private followprojectsService = inject(FollowprojectsService);
  private oilfieldsService = inject(OilfieldService);
  private signalsService = inject(SignalsService);
  private personalByProyectService = inject(PersonalByProyectService);
  private workprogramsService = inject(WorkprogramsService);

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
    this.addProject = new FormGroup({
      id: new FormControl(),
      idConsecutivo: new FormControl(null, Validators.required),
      description: new FormControl('', Validators.required),
      name: new FormControl('', Validators.required),
      number: new FormControl('S/N'),
      priority: new FormControl(0, Validators.required),
      programStart: new FormControl('', Validators.required),
      programEnd: new FormControl('', Validators.required),
      realPronosticLPO: new FormControl('', Validators.required),
      realPronosticTTT: new FormControl('', Validators.required),
      state: new FormControl('Ejecucion', [Validators.required]),
      typeConstruction: new FormControl('Seleccione un tipo de construcción', [Validators.required, noDefaultValueValidator()]),
      classification: new FormControl('Seleccione una clasificación', [Validators.required, noDefaultValueValidator()]),
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
    this.projectsService.getProjectListByCompany(this.idCompany).subscribe(
      (resp: any) => {
        this.project = this.mapProject(resp);
        console.log('Projects loaded:', this.project);
      },
      (error) => {
        console.error('Error fetching projects', error);
      }
    );
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
    if (!this.selectedRowData?.id) return;
    const project: any = this.selectedRowData;
    const contract: any = (this.contracts ?? []).find((c: any) =>
      Number(c.idContrato ?? c.id) === Number(project.idContrato)
    ) ?? await new Promise(resolve => this.followprojectsService.getContractById(Number(project.idContrato)).subscribe({ next: resolve, error: () => resolve(null) }));
    const [program, resources] = await Promise.all([
      new Promise<any[]>(resolve => this.workprogramsService.getWorkPrograms(Number(project.id), 'Project').subscribe({ next: v => resolve(v ?? []), error: () => resolve([]) })),
      new Promise<any[]>(resolve => this.projectsService.getPmoRecursosByProject(Number(project.id)).subscribe({ next: v => resolve(Array.isArray(v) ? v : []), error: () => resolve([]) }))
    ]);
    const byType: any = {};
    for (const r of resources) {
      const especialidad = String(r.especialidad ?? r.specialty ?? 'General').trim() || 'General';
      const tipo = String(r.tipo ?? r.type ?? 'Otros').trim() || 'Otros';
      const planned = Number(r.cantPlan ?? r.quantity ?? 0) * Number(r.costoUnitPlan ?? r.unitCost ?? 0);
      const key = `${especialidad} · ${tipo}`;
      byType[key] = (byType[key] ?? 0) + planned;
    }
    const programCost = program.reduce((sum, row) => sum + Number(row.quantity ?? 0) * Number(row.costMX ?? 0), 0);
    const contractLimit = Number(contract?.amountMx ?? contract?.amountMX ?? contract?.amount ?? 0);
    const projectLimit = Number(project.budgetManagement ?? project.budget ?? project.amount ?? 0) || (contractLimit / Math.max(1, (this.project ?? []).filter(p => Number(p.idContrato) === Number(project.idContrato)).length));
    const resourceCost = Object.values(byType).reduce((sum: number, v: any) => sum + Number(v), 0);
    const specialtyGroups: any[] = [];
    const specialtyMap = new Map<string, any>();
    for (const resource of resources) {
      const specialty = String(resource.especialidad ?? resource.specialty ?? 'General').trim() || 'General';
      const type = String(resource.tipo ?? resource.type ?? 'Otros').trim() || 'Otros';
      let group = specialtyMap.get(specialty);
      if (!group) { group = { name: specialty, sections: [] }; specialtyMap.set(specialty, group); specialtyGroups.push(group); }
      let section = group.sections.find((s: any) => s.name.toLowerCase() === type.toLowerCase());
      if (!section) { section = { name: type, rows: [] }; group.sections.push(section); }
      section.rows.push(resource);
    }
    this.budgetDashboard = { project, contract, contractLimit, projectLimit, programCost, resourceCost, total: programCost + resourceCost, byType, resources, specialtyGroups };
    this.showBudgetDashboard = true;
  }

  async addBudgetResource(): Promise<void> {
    if (!this.selectedRowData?.id || !this.resourceDraft.descripcion?.trim()) return;
    const resource = {
      idProject: Number(this.selectedRowData.id), idCompany: Number(this.idCompany), idActivity: null,
      tipo: this.resourceDraft.tipo, especialidad: this.specialtyDraft || 'General',
      descripcion: this.resourceDraft.descripcion.trim(), unidad: this.resourceDraft.unidad || 'pieza', periodo: '',
      cantPlan: Number(this.resourceDraft.cantPlan) || 0, cantReal: 0,
      costoUnitPlan: Number(this.resourceDraft.costoUnitPlan) || 0, costoUnitReal: 0, active: 1
    };
    await new Promise<void>(resolve => this.projectsService.savePmoRecursosBatch([resource]).subscribe({ next: () => resolve(), error: e => { console.error('Error guardando recurso PMO', e); resolve(); } }));
    this.resourceDraft = { tipo: this.resourceDraft.tipo, descripcion: '', unidad: this.resourceDraft.unidad, cantPlan: 1, costoUnitPlan: 0 };
    await this.openBudgetDashboard();
  }

  resourceMatches(key: string | number | symbol): boolean {
    return this.resourceTypeFilter === 'Todos' || String(key).endsWith(`· ${this.resourceTypeFilter}`);
  }

  resourceRowMatches(row: any): boolean {
    const typeOk = this.resourceTypeFilter === 'Todos' || String(row?.tipo ?? row?.type ?? '').toLowerCase() === this.resourceTypeFilter.toLowerCase();
    const query = this.resourceSearch.trim().toLowerCase();
    const text = `${row?.descripcion ?? ''} ${row?.especialidad ?? ''} ${row?.tipo ?? ''}`.toLowerCase();
    return typeOk && (!query || text.includes(query));
  }

  sectionHasRows(section: any): boolean {
    return section?.rows?.some((row: any) => this.resourceRowMatches(row));
  }

  specialtyHasRows(specialty: any): boolean {
    return specialty?.sections?.some((section: any) => this.sectionHasRows(section));
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
      oilfields: this.oilfieldsService.getOilfields()
    }).pipe(
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

        const modalOptions: NgbModalOptions = {
          size: 'xl',
          centered: true
        };
        this.modalService.open(this.content, modalOptions);
      },
      error: (error) => {
        console.error('Error in subscription:', error);
      }
    });
  }

  deleteProject() {
    if (!this.selectedRowData) {
      alerts.basicAlert(
        'Eliminar contrato',
        'Por favor, seleccione un proyecto para eliminar.',
        'warning'
      );
      return;
    }

    this.projectsService.deleteProject(this.selectedRowData.id).pipe(
      catchError((error) => {
        alerts.basicAlert(
          'Eliminar contrato',
          'Error al eliminar el contrato.',
          'error'
        );
        console.error(error);
        return EMPTY;
      })
    ).subscribe(() => {
      alerts.basicAlert(
        'Eliminar contrato',
        'Contrato eliminado satisfactoriamente.',
        'success'
      );
      this.getProjects();
      this.selectedRowData = null;
    });
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
