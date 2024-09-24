
import { Component, inject, TemplateRef, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
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
    if (value === 'Seleccione una especialidad' || value === 'Seleccione un proveedor') {
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
    this.addContract.patchValue({
      speciality: 'Seleccione una especialidad',
      idProvider: 'Seleccione un proveedor'
    });
  }

  @ViewChild('content') content!: TemplateRef<any>;

  addContract = new FormGroup({
    numberContract: new FormControl('', Validators.required),
    description: new FormControl('', Validators.required),
    descripSmall: new FormControl('', Validators.required),
    resident: new FormControl('', Validators.required),
    supervisor: new FormControl('', Validators.required),
    amountMx: new FormControl('', Validators.required),
    amountDll: new FormControl('', Validators.required),
    speciality: new FormControl('', [Validators.required, noDefaultValueValidator()]),
    idProvider: new FormControl('', [Validators.required, noDefaultValueValidator()]),
    dateStar: new FormControl('', Validators.required),
    dateEnd: new FormControl('', Validators.required),
    term: new FormControl(),
    idBussines: new FormControl(1),
    consecutive: new FormControl(0),
  }, { validators: dateRangeValidator() });

  formData: any;
  providers: any;

  isNew = false;
  isEdit = false;
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

  // Define Tables
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

  getContracts() {
    this.followprojectsService.getContract(1).subscribe(
      (resp: any) => {
        this.contract = this.mapContract(resp);
        console.log(resp)
      },
      (error) => {
        console.error('Error fetching warehouses', error);
      }
    );
  }

  mapContract(data: any[]): Icontract[] {
    return data.map(w => ({
      id: w.id,
      numberContract: w.numberContract,
      description: w.description,
      descripSmall: w.descripSmall,
      amountMx: w.amountMx,
      amountDll: w.amountDll,
      resident: w.resident,
      supervisor: w.supervisor
    } as Icontract));
  }

  onSelectionChanged(event: SelectionChangedEvent): void {
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length > 0) {
      //this.selectId = selectedRows[0].id;
      //this.fillForm(selectedRows[0]);
    }
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    if (this.contract && this.contract.length > 0) {
      // this.gridApi.setRowData(this.contract);
    }
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

  async addRow() {

    await this.companysService.Companys().subscribe({
      next: (resp) => {
        this.providers = resp;
        console.log(resp);
      },
      error: (error) => {
        console.error('Error fetching providers', error);
      },
      complete: () => {
        this.modalService.open(this.content);
      }
    });
  }

  editContract(): void {

  }

  deleteContract(): void {

  }

  onSubmit() {
    if (this.addContract.valid) {
      this.calculateTerm();
      this.formData = this.addContract.value;
      console.log('Form data:', this.formData);
      this.followprojectsService.addContract(this.formData)
        .pipe(
          catchError((error) => {
            alerts.basicAlert('Añadir contrato', 'Hubo un error al intentar guardar la información.', 'error');
            console.error(error);
            return EMPTY;
          })
        )
        .subscribe(
          () => {
            alerts.basicAlert('Añadir contrato', 'Contrato añadido exitosamente.', 'success');
            this.getContracts();
          }
        );
    }
    else
      alerts.basicAlert('Añadir contrato', 'Debe completar todos los campos para poder añadir un contrato.', 'error');
  }

  calculateTerm() {
    this.addContract.get('term')?.setValue(
      this.getTermInDays(
        this.addContract.get('dateStar')?.value,
        this.addContract.get('dateEnd')?.value
      )
    );
  }

  getTermInDays(dateStar: string, dateEnd: string): number {
    const start = new Date(dateStar);
    const end = new Date(dateEnd);
    const diffInDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffInDays;
  }

}
