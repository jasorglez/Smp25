import { Component, inject } from '@angular/core';

import { ColDef, GridApi, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community';
import { TrackingService } from '../../../../services/tracking.service';
import { FormBuilder, Validators } from '@angular/forms';
import { alerts } from '../../../../helpers/alerts';

import { Iwarehouses } from '../../../../interface/iwarehouses';
import { InegiService } from '../../../../services/inegi.service';
import { WarehousesService } from 'app/services/warehouses.service';
import { DomainsModule } from 'app/domains/domainsmodule';



@Component({
  selector: 'app-warehouses',
  standalone: true,
  imports: [DomainsModule],
  templateUrl: './warehouses.component.html',
  styleUrl: './warehouses.component.scss'
})
export class WarehousesComponent {

  estados: any[] = [];
  municipios: any[] = [];
  selectedEstadoId: string = '';
  selectId : number = 0 ;

  isNew = false;
  isEdit = false;
  isSave = false;
  isCancel = false;
  isDelete = false;
  isPrint = false;

  private gridApi!: GridApi<Iwarehouses>;
  public warehouses: Iwarehouses[] = [];

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  selectedRow: Iwarehouses | null = null;

  // Inject of new way for Angular 18
   private trackingService = inject(TrackingService) ;
   private fb = inject(FormBuilder) ;
   private warehouseService= inject(WarehousesService);
   private inegiService= inject(InegiService) ;

  // Column Definitions: Defines the columns to be displayed.
   colMaster: ColDef[] = [
     { field: 'name', headerName: 'Nombre', filter: true, width: 200 },
     { field: 'address', headerName: 'Direccion', width: 285, filter: true },
     { field: 'state', headerName: 'Estado', width: 235 },
     { field: 'city', headerName: 'Ciudad', width: 200 },
     { field: 'place', headerName: 'Lugar', width: 185 },
     { field: 'phone', headerName: 'Telefono', width: 105 },
     { field: 'leader', headerName: 'Lider', width: 285 }
   ];


  public warForm = this.fb.group({
    name:      ['', Validators.required],
    idCompany : '',
    idProject : '',
    address:   ['', Validators.required],
    cp:        ['', Validators.required],
    place:     ['', Validators.required],
    phone:     ['', Validators.required],
    leader:    ['', Validators.required],
    state:     ['', Validators.required],
    city:      ['', Validators.required],
    stateName: [''],
    belongsTo: ['', Validators.required]
  });

  ngOnInit(): void {
    
    this.getWarehouses();
    
    this.inegiService.getEstados().subscribe(
      (data: any) => {
        this.estados = data.datos;
      },
      (error) => {
        console.error('Error fetching states', error);
      }
    );
  }

  onEstadoChange(event: Event): void {
    const estadoId = (event.target as HTMLSelectElement).value;
    const selectedEstado = this.estados.find(estado => estado.cve_agee === estadoId);
    if (selectedEstado) {
      this.warForm.patchValue({
        stateName: selectedEstado.nom_agee
      });
    }
  
    const stateControl = this.warForm.get('state');
    if (stateControl) {
      const estadoId2 = stateControl.value?.toString();
      if (estadoId2) {
        this.inegiService.getMunicipios(estadoId2).subscribe(
          (data: any) => {
            this.municipios = data.datos;
          },
          (error) => {
            console.error('Error fetching municipalities', error);
          }
        );
      }
    }
  }
  
  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    if (this.warehouses && this.warehouses.length > 0) {
      this.gridApi.setGridOption('rowData',this.warehouses);
    }
  }

  onSelectionChanged(event: SelectionChangedEvent): void {
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length > 0) {
      this.selectId = selectedRows[0].id;
      this.fillForm(selectedRows[0]);
    }
  }

    getWarehouses(): void {
      const company = localStorage.getItem('company');
      const project = localStorage.getItem('project');
    
      // Verificamos que company y project no sean null antes de llamarlo
      if (company && project) {
        this.warehouseService.getWarehouses(company, project).subscribe(
          (resp: any) => {
            this.warehouses = this.mapWarehouses(resp);
            this.updateGrid();
          },
          (error) => {
            console.error('Error fetching warehouses', error);
          }
        );
      } else {
        console.error('Company or Project is missing in localStorage');
      }
    }


    
    mapWarehouses(data: any[]): Iwarehouses[] {
      return data.map(w => ({
        id        : w.id,
        name      : w.name,
        idCompany : w.idCompany,
        address   : w.address,
        city      : w.city,
        cp        : w.cp,
        place     : w.place,
        state     : w.state,
        phone     : w.phone,
        leader    : w.leader,
        principal : w.principal
      } as Iwarehouses));
    }
  
    updateGrid() {
      if (this.gridApi && !this.gridApi.isDestroyed()) {
        this.gridApi.setGridOption('rowData', this.warehouses);
    
        if (this.selectId) {
          const selectedWarehouse = this.warehouses.find(w => w.id === this.selectId);
          if (selectedWarehouse) {
            this.fillForm(selectedWarehouse);
          }
        }
      }
    }
  
  
    fillForm(warehouse: any): void {
      this.warForm.patchValue(warehouse);
    }


  new(): void {
    this.isNew = true;
    this.updateButtonStates();
    this.warForm.reset();
  }

  edit(): void {
    this.isEdit = true;
    this.updateButtonStates();
  }

  cancel(): void {
    this.isNew = false;
    this.isEdit = false;
    this.updateButtonStates();
    if (this.selectId !== null) {
      const selectedRow = this.warehouses.find(warehouse => warehouse.id === this.selectId);
      if (selectedRow) {
        this.fillForm(selectedRow);
      }
    }
  }

  
  onSave(): void {
    const formData = this.warForm.value;
    if (this.isNew) {
      formData.idCompany = localStorage.getItem('company');
      formData.idProject = this.trackingService.getProject();
    }

    const saveOperation = this.isNew
      ? this.warehouseService.Post(formData, localStorage.getItem('token'))
      : this.warehouseService.Patch(this.selectId, formData, localStorage.getItem('token'));

    saveOperation?.subscribe(
      () => {
        const message = this.isNew ? 'Warehouse created successfully' : 'Warehouse updated successfully';
        alerts.basicAlert('Success', message, 'success');
        // this.requestWarehouseUpdate();
        this.cancel();
      },
      (error) => {
        console.error(`Error ${this.isNew ? 'creating' : 'updating'} warehouse`, error);
        alerts.basicAlert('Error', `Failed to ${this.isNew ? 'create' : 'update'} warehouse`, 'error');
      }
    );
  }

  
  Delete(): void {
    alerts.confirmAlert('Are you sure?', 'The information Details cannot be recovered!', 'warning', 'Yes, delete it!')
      .then((result) => {
        if (result.isConfirmed) {
          this.warehouseService.Delete(this.selectId, localStorage.getItem('token')).subscribe(
            () => {
              alerts.basicAlert('Success', 'The Item has been deleted', 'success');
              //this.requestWarehouseUpdate();
            },
            (error) => {
              console.error('Error deleting warehouse', error);
              alerts.basicAlert('Error', 'Failed to delete warehouse', 'error');
            }
          );
        }
      });
  }



  updateButtonStates(): void {
    this.isEdit = this.isNew || this.isEdit;
    this.isCancel = this.isNew || this.isEdit;
    this.isSave = this.isNew || this.isEdit;
    this.isDelete = !this.isNew && !this.isEdit;
  }

  ngOnDestroy(): void {
    
  }

  }
