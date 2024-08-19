import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Icontract } from '../../../../interface/icontract';

import { DomainsModule } from 'app/domains/domainsmodule';
import { FollowprojectsService } from '../../../../services/followprojects.service';
import { TrackingService } from '../../../../services/tracking.service';

import { ColDef, GridApi, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community';

@Component({
  selector: 'app-contract',
  standalone: true,
  imports: [RouterOutlet, DomainsModule],
  templateUrl: './contracts.component.html',
  styleUrl: './contracts.component.scss'
})
export class ContractsComponent {

  isNew    = false;
  isEdit   = false;
  isSave   = false;
  isCancel = false;
  isDelete = false;
  isPrint  = false;

   // Inject of new way for Angular 18
    private trackingService = inject(TrackingService) ;
    private followprojectsService = inject(FollowprojectsService) ;

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
    { field: 'numberContract', headerName: 'Contrato', filter: true, width: 60 },
    { field: 'description', headerName: 'Descripcion', width: 285 },
    { field: 'descripSmall', headerName: 'Corta', width: 100 },
    { field: 'resident', headerName: 'Residente', width: 100, filter: true },
    { field: 'supervisor', headerName: 'Supervisor', width: 100, filter: true  },
    { field: 'amountMx', headerName: 'Monto MX', width: 100, 
      valueFormatter: (params) => this.trackingService.formatearMoneda(params.value), filter: true  },
    { field: 'amountDll', headerName: 'Monto DLL', width: 100, 
      valueFormatter: (params) => this.trackingService.formatearMoneda(params.value), filter: true  }
  ];
  

  ngOnInit(): void {
    //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
    this.getContracts() ;
  }

  getContracts() {
    this.followprojectsService.getContract(1).subscribe(
      (resp: any) => {
        this.contract = this.mapContract(resp);
        //console.log(this.contract)
      },
      (error) => {
        console.error('Error fetching warehouses', error);
      }
    );
  }

  mapContract(data: any[]): Icontract[] {
    return data.map(w => ({
       id: w.id,
       numberContract : w.numberContract ,
       description    : w.description,
       descripSmall   : w.descripSmall,
       amountMx       : w.amountMx,
       amountDll      : w.amountDll,
       resident       : w.resident,
       supervisor     : w.supervisor
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

  New(): void {

  }

  Edit(): void {

  }

  Save()
  {

  }

  Cancel(): void {

  }

  Delete() {

  }

}
