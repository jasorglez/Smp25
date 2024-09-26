
import { Component, inject, TemplateRef, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgbModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { Icontract } from '../../../../interface/icontract';

import { DomainsModule } from 'app/domains/domainsmodule';
import { FollowprojectsService } from '../../../../services/followprojects.service';
import { TrackingService } from '../../../../services/tracking.service';

import { ColDef, GridApi, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-enterprise';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { catchError, EMPTY } from 'rxjs';
import { CompanysService } from 'app/services/companys.service';

// Esta funcion valida que dateStar sea siempre menor a dateEnd
export function dateRangeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const dateStar = control.get('dateStar')?.value;
    const dateEnd = control.get('dateEnd')?.value;

    if (dateStar && dateEnd && dateStar > dateEnd) {
      return { dateRangeInvalid: true };
    }

    return null;
  };
}

// Workaorund que corrige la opción por default
export function noDefaultValueValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === 'Seleccione una especialidad' || value === 'Seleccione un proveedor' || value === 'Seleccione un estado') {
      return { noDefaultValue: true };
    }
    return null;
  };
}

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [RouterOutlet, DomainsModule],
  templateUrl: './contracts.component.html',
  styleUrl: './contracts.component.scss'
})
export class ContractsComponent {
  constructor() {
    this.initForm();
  }

  @ViewChild('content') content!: TemplateRef<any>;

  addContract: FormGroup;

  formData: any;
  providers: any;
  selectedRowData: Icontract | null = null;

  isEditing = false;
  isSave = false;
  isCancel = false;
  isDelete = false;
  isPrint = false;

  screenSizeSM = false;
  notSavedChanges: boolean = false;

  // Inject of new way for Angular 18
  private trackingService = inject(TrackingService);
  private followprojectsService = inject(FollowprojectsService);
  private modalService = inject(NgbModal);
  private companysService = inject(CompanysService);

  public contract: Icontract[] = [];
  private gridApi!: GridApi<Icontract>;

  // Define data of Grid
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  // Column Definitions: Defines the columns to be displayed.
  colMaster: ColDef[] = [
    { field: 'numberContract', headerName: 'Contrato', filter: true, width: 30 },
    { field: 'description', headerName: 'Descripcion', width: 285 },
    { field: 'descripSmall', headerName: 'Corta', width: 100 },
    { field: 'resident', headerName: 'Residente', width: 100, filter: true },
    { field: 'name', headerName: 'Compañía', width: 100, filter: true },
    { field: 'supervisor', headerName: 'Supervisor', width: 100, filter: true },
    {
      field: 'amountMx', headerName: 'Monto MX', width: 100,
      valueFormatter: (params) => this.trackingService.formatearMoneda(params.value), filter: true
    },
    {
      field: 'amountDll', headerName: 'Monto DLL2', width: 100,
      valueFormatter: (params) => this.trackingService.formatearMoneda(params.value), filter: true
    }
  ];

  ngOnInit(): void {
    //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
    this.getContracts();
  }

  initForm() {
    this.addContract = new FormGroup({
      id: new FormControl(),
      numberContract: new FormControl('', Validators.required),
      description: new FormControl('', Validators.required),
      descripSmall: new FormControl('', Validators.required),
      resident: new FormControl('', Validators.required),
      supervisor: new FormControl('', Validators.required),
      amountMx: new FormControl('', Validators.required),
      amountDll: new FormControl('', Validators.required),
      speciality: new FormControl('Seleccione una especialidad', [Validators.required, noDefaultValueValidator()]),
      idProvider: new FormControl('Seleccione un proveedor', [Validators.required, noDefaultValueValidator()]),
      dateStar: new FormControl('', Validators.required),
      dateEnd: new FormControl('', Validators.required),
      stateContract: new FormControl('Seleccione un estado', [Validators.required, noDefaultValueValidator()]),
      term: new FormControl(),
      idBussines: new FormControl(1),
      consecutive: new FormControl(0),
    }, { validators: dateRangeValidator() });
  }

  getContracts() {
    this.followprojectsService.getContract(1).subscribe(
      (resp: any) => {
        this.contract = this.mapContract(resp);
      },
      (error) => {
        console.error('Error fetching contracts', error);
      }
    );
  }

  mapContract(data: any[]): Icontract[] {
    return data.map(w => ({
      id: w.idContrato,
      numberContract: w.numberContract,
      description: w.description,
      descripSmall: w.descripSmall,
      amountMx: w.amountMx,
      amountDll: w.amountDll,
      resident: w.resident,
      supervisor: w.supervisor,
      name: w.name,
      speciality: w.speciality,
      idProvider: w.idProvider,
      dateStar: w.dateStar,
      dateEnd: w.dateEnd,
      stateContract: w.stateContract,
      term: w.term,
      idBussines: w.idBussines,
      consecutive: w.consecutive
    } as Icontract));
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

  public defaultColDef : ColDef = {
    sortable           : true,
    filter             : true,
    resizable          : true,
    lockPosition       : false,
    enableRowGroup     : true, // Enable row grouping for all columns
    flex: 1
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
        'Por favor, seleccione un contrato para editar.',
        'warning'
      );
      return;
    }

    this.isEditing = true;
    this.populateForm(this.selectedRowData);
    this.openModal();
  }

  populateForm(data: Icontract) {
    this.addContract.patchValue({
      id: data.id,
      numberContract: data.numberContract,
      description: data.description,
      descripSmall: data.descripSmall,
      resident: data.resident,
      supervisor: data.supervisor,
      amountMx: data.amountMx,
      amountDll: data.amountDll,
      speciality: data.speciality,
      idProvider: data.idProvider,
      dateStar: this.formatDateForInput(data.dateStar),
      dateEnd: this.formatDateForInput(data.dateEnd),
      stateContract: data.stateContract,
      term: data.term,
      idBussines: data.idBussines,
      consecutive: data.consecutive
    });
  }

  formatDateForInput(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  openModal() {
    this.companysService.Companys().subscribe({
      next: (resp) => {
        this.providers = resp;
        const modalOptions: NgbModalOptions = {
          size: 'xl',
          centered: true
        };
        this.modalService.open(this.content, modalOptions);
      },
      error: (error) => {
        console.error('Error fetching providers', error);
      }
    });
  }

  deleteContract() {
    if (!this.selectedRowData) {
      alerts.basicAlert(
        'Eliminar contrato',
        'Por favor, seleccione un contrato para eliminar.',
        'warning'
      );
      return;
    }

    this.followprojectsService.deleteContract(this.selectedRowData.id).pipe(
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
      this.getContracts();
      this.selectedRowData = null;
    });
  }

  onSubmit() {
    if (this.addContract.valid) {
      this.calculateTerm();
      this.formData = this.prepareFormData();

      if (this.isEditing && this.selectedRowData) {
        console.log('Updating contract with data:', this.formData);
        this.followprojectsService.updateContract(this.selectedRowData.id, this.formData).pipe(
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
            'Actualizar contrato',
            'Contrato actualizado exitosamente.',
            'success'
          );
          this.getContracts();
          this.modalService.dismissAll();
          this.resetForm();
        });
      } else {
        this.followprojectsService.addContract(this.formData).pipe(
          catchError((error) => {
            alerts.basicAlert(
              'Añadir contrato',
              'Hubo un error al intentar guardar la información.',
              'error'
            );
            console.error('Error adding contract:', error);
            return EMPTY;
          })
        ).subscribe(() => {
          alerts.basicAlert(
            'Añadir contrato',
            'Contrato añadido exitosamente.',
            'success'
          );
          this.getContracts();
          this.modalService.dismissAll();
          this.resetForm();
        });
      }
    } else {
      alerts.basicAlert(
        this.isEditing ? 'Actualizar contrato' : 'Añadir contrato',
        'Debe completar todos los campos correctamente.',
        'error'
      );
    }
  }

  prepareFormData(): any {
    const formValue = this.addContract.value;
    return {
      ...formValue,
      dateStar: this.formatDateForBackend(formValue.dateStar),
      dateEnd: this.formatDateForBackend(formValue.dateEnd),
      stateContract: formValue.stateContract
    };
  }

  
  formatDateForBackend(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  calculateTerm() {
    const dateStar = this.addContract.get('dateStar')?.value;
    const dateEnd = this.addContract.get('dateEnd')?.value;
    if (dateStar && dateEnd) {
      this.addContract.get('term')?.setValue(this.getTermInDays(dateStar, dateEnd));
    }
  }

  getTermInDays(dateStar: string, dateEnd: string): number {
    const start = new Date(dateStar);
    const end = new Date(dateEnd);
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  resetForm() {
    this.initForm();
    this.isEditing = false;
    this.selectedRowData = null;
  }

}
