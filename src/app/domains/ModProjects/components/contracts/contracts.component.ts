import { Component, effect, inject, TemplateRef, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgbModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { Icontract } from '../../../../interface/icontract';

import { DomainsModule } from 'app/domains/domainsmodule';
import { FollowprojectsService } from '../../../../services/followprojects.service';
import { TrackingService } from '../../../../services/tracking.service';

import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { catchError, EMPTY } from 'rxjs';
import { CompanysService } from 'app/services/companys.service';
import { SignalsService } from 'app/services/signals.service';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { ContractDetailsComponent } from './contract-details/contract-details.component';
import { ProvidersService } from 'app/services/providers.service';

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
    if (value === 'Seleccione una especialidad' || value === 'Seleccione un contratista' || value === 'Seleccione un estado') {
      return { noDefaultValue: true };
    }
    return null;
  };
}

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [DomainsModule, ContractDetailsComponent],
  templateUrl: './contracts.component.html',
  styleUrl: './contracts.component.scss'
})
export class ContractsComponent {
  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.getContracts();
    });
    this.initForm();
  }

  @ViewChild('content') content!: TemplateRef<any>;
  @ViewChild(ContractDetailsComponent) contractDetails!: ContractDetailsComponent;

  addContract: FormGroup;

  formData: any;
  providers: any;
  public AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  selectedRowData: Icontract | null = null;

  isEditing = false;
  isSave = false;
  isCancel = false;
  isDelete = false;
  isPrint = false;
  private isOpen: boolean = false;
  showDetailsTab: boolean = false;
  idContract: number | null = null;

  idBranch: number;
  idRoot: number;

  screenSizeSM = false;
  notSavedChanges: boolean = false;
  private doubleClicked = false;

  // Declare the missing properties
  gridHeight: string = '80vh';

  // Inject of new way for Angular 18
  private trackingService = inject(TrackingService);
  private followprojectsService = inject(FollowprojectsService);
  private modalService = inject(NgbModal);
  private companysService = inject(CompanysService);
  private signalsService = inject(SignalsService);
  private providersService = inject(ProvidersService);


  public contract: Icontract[] = [];
  private gridApi!: GridApi<Icontract>;

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    rowBuffer: 20,
    getRowClass: (params) => {
      // Verificar si la fila está seleccionada
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      // Seleccionar la fila al hacer clic en cualquier celda
      event.node.setSelected(true);
      // Activar la pestaña de detalles con delay para evitar conflicto con doble click
      setTimeout(async () => {
        if (!this.doubleClicked) {
          this.selectedRowData = event.data;
          this.idContract = event.data.id;
          this.signalsService.setIdContract(event.data.id);
          this.notSavedChanges = true;
          try {
            await this.activateDetailsTab();
          } catch (error) {
            console.error('Error activando la pestaña de detalles:', error);
          }
        }
        this.doubleClicked = false;
      }, 300);
    },
    onRowSelected: (event) => {
      // Deseleccionar otras filas cuando se selecciona una nueva
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
    onCellKeyDown: (params) => {
      if (params.event.key === 'Enter') {
        // Obtener todas las columnas editables
        const editableColumns = this.colMaster.filter((col) => col.editable);
        const currentColIndex = editableColumns.findIndex(
          (col) => col.field === params.column.getColDef().field
        );
  
        if (currentColIndex < editableColumns.length - 1) {
          // Añadir delay de 50ms antes de mover el foco
          requestAnimationFrame(() => {
            // Mover a la siguiente columna editable
            params.api.startEditingCell({
              rowIndex: params.node.rowIndex,
              colKey: editableColumns[currentColIndex + 1].field,
            });
          }); // Retraso para permitir que termine la edición actual
        }
        params.event.preventDefault(); // Prevenir comportamiento por defecto
      }
    },
    onCellDoubleClicked: this.onCellDoubleClicked.bind(this),
  };

  async onCellDoubleClicked(event: CellDoubleClickedEvent): Promise<void> {
    // Verificar que event.data esté disponible antes de acceder a sus propiedades
    if (!event.data) {
      console.warn('No hay datos en la fila seleccionada');
      return;
    }

    this.doubleClicked = true;
    this.selectedRowData = event.data;
    this.editRow();
  }

  async activateDetailsTab() {
    if (!this.isOpen) {
      await this.adjustGridSize();
      this.showDetailsTab = true;
      this.isOpen = true;
    } else {
      await this.resetGridSize();
      this.isOpen = false;
    }
  }

  async adjustGridSize() {
    this.gridHeight = '20vh'; // Adjust as needed
  }

  resetGridSize() {
    this.gridHeight = '80vh'; // Reset to default height
    this.idContract = null;
    this.showDetailsTab = false;
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }
  }

  // Define data of Grid
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];


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
      idBranch: new FormControl(this.idBranch),
      numberContract: new FormControl('', Validators.required),
      description: new FormControl('', Validators.required),
      descripSmall: new FormControl('', Validators.required),
      resident: new FormControl(''),
      supervisor: new FormControl(''),
      amountMx: new FormControl(0),
      amountDll: new FormControl(0),
      speciality: new FormControl('Seleccione una especialidad'),
      idProvider: new FormControl('Seleccione un contratista'),
      dateStar: new FormControl('', Validators.required),
      dateEnd: new FormControl('', Validators.required),
      stateContract: new FormControl('Seleccione un estado'),
      term: new FormControl(),
      idBussines: new FormControl(1),
      consecutive: new FormControl(0),
      active: new FormControl(1)
    }, { validators: dateRangeValidator() });
  }

  getContracts() {
    this.followprojectsService.getContract(this.idBranch).subscribe(
      (resp: any) => {
        this.contract = this.mapContract(resp);
      },
      (error) => {
        this.contract = [];
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
      idBranch: w.idBranch,
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

  public defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true, // Enable row grouping for all columns
    flex: 1
  };

  addRow() {
    if (this.idBranch < 0) {
      alerts.basicAlert(
        'Crear contrato',
        'Debe seleccionar una sucursal para crear un contrato.',
        'warning'
      );
      return;
    }
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
      idBranch: data.idBranch,
      consecutive: data.consecutive
    });
  }

  formatDateForInput(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  openModal() {
    // Abrir el modal independientemente de si hay proveedores
    const modalOptions: NgbModalOptions = {
      size: 'xl',
      centered: true
    };
    
    // Intentar cargar proveedores
    this.providersService.getProviders(this.idRoot).subscribe({
      next: (resp) => {
        this.providers = resp;
      },
      error: (error) => {
        console.error('Error fetching providers', error);
        this.providers = []; // Lista vacía si no hay proveedores
        // Opcional: mostrar alerta informativa
        alerts.basicAlert(
          'Proveedores',
          'No se pudieron cargar los proveedores. Podrá continuar pero deberá seleccionar un contratista manualmente.',
          'warning'
        );
      }
    });
    
    // Abrir el modal siempre
    this.modalService.open(this.content, modalOptions);
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
        console.log('🔄 UPDATING CONTRACT');
        console.log('📋 Contract ID:', this.selectedRowData.id);
        console.log('📦 Data being sent to UPDATE endpoint:', this.formData);
        console.log('🔗 Full object structure:', JSON.stringify(this.formData, null, 2));
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
        console.log('➕ ADDING NEW CONTRACT');
        console.log('📦 Data being sent to ADD endpoint:', this.formData);
        console.log('🔗 Full object structure:', JSON.stringify(this.formData, null, 2));
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
    console.log('🛠️ PREPARING FORM DATA');
    console.log('📝 Raw form values:', formValue);
    
    const preparedData = {
      ...formValue,
      dateStar: this.formatDateForBackend(formValue.dateStar),
      dateEnd: this.formatDateForBackend(formValue.dateEnd),
      stateContract: formValue.stateContract
    };
    
    console.log('✅ Prepared data for API:', preparedData);
    return preparedData;
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

  revertChanges() {
    // Recargar los contratos desde el servidor
    this.getContracts();

    // Limpiar la selección actual
    this.selectedRowData = null;

    // Limpiar filtros del grid si existe
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();
    }

    // Cerrar la pestaña de detalles si está abierta
    if (this.showDetailsTab) {
      this.resetGridSize();
    }

    alerts.basicAlert(
      'Cambios Revertidos',
      'Los datos han sido recargados desde el servidor',
      'success'
    );
  }

  saveChanges() {
    if (this.contractDetails) {
      this.contractDetails.saveMasterChanges();
    }
  }

}
