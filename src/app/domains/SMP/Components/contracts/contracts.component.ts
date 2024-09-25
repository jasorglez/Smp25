
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
    this.addContract.patchValue({
      speciality: 'Seleccione una especialidad',
      idProvider: 'Seleccione un proveedor',
      state: 'Seleccione un estado'
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
    state: new FormControl('', Validators.required),
    term: new FormControl(),
    idBussines: new FormControl(1),
    consecutive: new FormControl(0),
  }, { validators: dateRangeValidator() });

  formData: any;
  providers: any;
  selectedRowData: any = null;
  id: null;

  isNew = false;
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

  getContracts() {
    this.followprojectsService.getContract(1).subscribe(
      (resp: any) => {
        this.contract = this.mapContract(resp);
      },
      (error) => {
        console.error('Error fetching warehouses', error);
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
      name: w.name
    } as Icontract));
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.id = selectedNodes[0].data.id;
      //this.selectedRowData = selectedNodes[0].data;
    } else {
      this.id = null;
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

  addRow() {
    this.companysService.Companys().subscribe({
      next: (resp) => {
        this.providers = resp;
      },
      error: (error) => {
        console.error('Error fetching providers', error);
      },
      complete: () => {
        const modalOptions: NgbModalOptions = {
          size: 'xl'
        };
        this.modalService.open(this.content, modalOptions);
      }
    });
  }

  editRow(): void {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Editar contrato',
        'Por favor, seleccione un contrato para editar.',
        'warning'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    this.id = selectedData.id;
    this.isEditing = true;

    // Fetch the full contract data using the id
    this.followprojectsService.getContractById(this.id).subscribe(
      (contract) => {
        this.addContract.patchValue({
          numberContract: contract.numberContract,
          description: contract.description,
          descripSmall: contract.descripSmall,
          resident: contract.resident,
          supervisor: contract.supervisor,
          amountMx: contract.amountMx,
          amountDll: contract.amountDll,
          speciality: contract.speciality,
          idProvider: contract.idProvider,
          dateStar: contract.dateStar,
          dateEnd: contract.dateEnd,
          state: contract.state,
          term: contract.term,
          idBussines: contract.idBussines,
          consecutive: contract.consecutive
        });

        this.companysService.Companys().subscribe({
          next: (resp) => {
            this.providers = resp;
            const modalOptions: NgbModalOptions = {
              size: 'xl'
            };
            this.modalService.open(this.content, modalOptions);
          },
          error: (error) => {
            console.error('Error fetching providers', error);
          }
        });
      },
      (error) => {
        console.error('Error fetching contract details', error);
        alerts.basicAlert(
          'Editar contrato',
          'Error al obtener los detalles del contrato.',
          'error'
        );
      }
    );
  }

  async deleteContract() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'warning'
      );
      return;
    }
    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    // Pone active = 0
    this.followprojectsService.deleteContract(id).pipe(
      catchError((error) => {
        alerts.basicAlert(
          'Eliminar entrada',
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
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.getContracts();
          this.selectedRowData = null;
        }
      )
  }

  onSubmit() {
    if (this.addContract.valid) {
      this.calculateTerm();
      this.formData = this.addContract.value;

      const operation = this.isEditing ?
        this.followprojectsService.updateContract(this.id, this.formData) :
        this.followprojectsService.addContract(this.formData);

      operation.pipe(
        catchError((error) => {
          alerts.basicAlert(
            this.isEditing ? 'Actualizar contrato' : 'Añadir contrato',
            'Hubo un error al intentar guardar la información.',
            'error'
          );
          console.error(error);
          return EMPTY;
        })
      ).subscribe(
        () => {
          alerts.basicAlert(
            this.isEditing ? 'Actualizar contrato' : 'Añadir contrato',
            this.isEditing ? 'Contrato actualizado exitosamente.' : 'Contrato añadido exitosamente.',
            'success'
          );
          this.getContracts();
          this.modalService.dismissAll();
          this.resetForm();
        }
      );
    } else {
      alerts.basicAlert(
        this.isEditing ? 'Actualizar contrato' : 'Añadir contrato',
        'Debe completar todos los campos correctamente.',
        'error'
      );
    }
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

  resetForm() {
    this.addContract.reset({
      speciality: 'Seleccione una especialidad',
      idProvider: 'Seleccione un proveedor',
      state: 'Seleccione un estado'
    });
    this.isEditing = false;
    this.id = null;
  }

}
