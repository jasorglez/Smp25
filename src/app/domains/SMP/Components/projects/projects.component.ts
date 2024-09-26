
import { Component, inject, TemplateRef, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgbModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { DomainsModule } from 'app/domains/domainsmodule';
import { FollowprojectsService } from '../../../../services/followprojects.service';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { catchError, EMPTY, forkJoin } from 'rxjs';
import { Iproject } from 'app/interface/iproject';
import { ProjectsService } from 'app/services/projects.service';
import { OilfieldService } from 'app/services/oilfield.service';

// Esta funcion valida que programStart sea siempre menor a programEnd
export function dateRangeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const programStart = control.get('programStart')?.value;
    const programEnd = control.get('programEnd')?.value;
    const realPronosticLPO = control.get('realPronosticLPO')?.value;
    const realPronosticTTT = control.get('realPronosticTTT')?.value;
    if (programStart && programEnd
      && programStart > programEnd
      && realPronosticLPO && realPronosticTTT
      && realPronosticLPO > realPronosticTTT) {
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
      value === 'Seleccione un campo petrolero' ||
      value === 'Seleccione una clasificación') {
      return { noDefaultValue: true };
    }
    return null;
  };
}

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [RouterOutlet, DomainsModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss'
})
export class ProjectsComponent {
  constructor() {
    this.initForm();
  }

  @ViewChild('content') content!: TemplateRef<any>;

  addProject: FormGroup;

  formData: any;
  providers: any;
  contracts: any;
  oilfields: any;
  selectedRowData: Iproject | null = null;

  isEditing = false;
  isSave = false;
  isCancel = false;
  isDelete = false;
  isPrint = false;

  screenSizeSM = false;
  notSavedChanges: boolean = false;

  // Inject of new way for Angular 18
  private modalService = inject(NgbModal);
  private projectsService = inject(ProjectsService);
  private followprojectsService = inject(FollowprojectsService);
  private oilfieldsService = inject(OilfieldService);

  public project: Iproject[] = [];
  private gridApi!: GridApi<Iproject>;

  // Define data of Grid
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  // Column Definitions: Defines the columns to be displayed.
  colMaster: ColDef[] = [
    { field: 'idConsecutivo', headerName: 'ID PEMEX' },
    { field: 'description', headerName: 'Descripcion' },
    { field: 'name', headerName: 'Nombre', width: 100, filter: true },
    { field: 'classification', headerName: 'Clasificación', width: 100, filter: true }
  ];

  ngOnInit(): void {
    //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
    this.getProjects();
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
      idOilfield: new FormControl('Seleccione un campo petrolero', [Validators.required, noDefaultValueValidator()]),
      year: new FormControl('2024'),
      diameter: new FormControl('0'),
    }, { validators: dateRangeValidator() });
  }

  getProjects() {
    this.projectsService.getProjects().subscribe(
      (resp: any) => {
        this.project = this.mapProject(resp);
      },
      (error) => {
        console.error('Error fetching contracts', error);
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
    } else {
      this.selectedRowData = null;
    }
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

  defaultColDef = {
    flex: 1,
  };

  addRow() {
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

  openModal() {
    forkJoin({
      contracts: this.followprojectsService.getContract(1),
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
          size: 'xl'
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
      idOilfield: formValue.idOilfield !== 'Seleccione un campo petrolero' ? Number(formValue.idOilfield) : null,
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
