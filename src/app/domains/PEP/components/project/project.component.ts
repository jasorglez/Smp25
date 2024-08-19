import { Component, inject } from '@angular/core';

import { DomainsModule } from 'app/domains/domainsmodule';
import { ColDef, GridApi, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community';
import { TrackingService } from '../../../../services/tracking.service';


@Component({
  selector: 'app-project',
  standalone: true,
  imports: [DomainsModule],
  templateUrl: './project.component.html',
  styleUrl: './project.component.scss'
})
export class ProjectComponent {

  isNew    = false;
  isEdit   = false;
  isSave   = false;
  isCancel = false;
  isDelete = false;
  isPrint  = false;

  // Inject of new way for Angular 18
   private trackingService = inject(TrackingService) ;


 // Define Tables
  public project: any[] = [];
  private gridApi!: GridApi<any>;

 // Define data of Grid
  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

 // Column Definitions: Defines the columns to be displayed.
colMaster: ColDef[] = [
  { field: 'numberContract', headerName: 'Proyecto', filter: true, width: 60 },
  { field: 'description', headerName: 'Descripcion', width: 285, filter: true },
  { field: 'descripSmall', headerName: 'Corta', width: 100 }
];


onGridReady(params: GridReadyEvent): void {
  this.gridApi = params.api;
  if (this.project && this.project.length > 0) {
   // this.gridApi.setRowData(this.contract);
  }
}

onSelectionChanged(event: SelectionChangedEvent): void {
  const selectedRows = this.gridApi.getSelectedRows();
  if (selectedRows.length > 0) {
    //this.selectId = selectedRows[0].id;
    //this.fillForm(selectedRows[0]);
  }
}

  defaultColDef = {
    flex: 1,
  };


  New() {

  }

  Edit() {

  }

  Save() {

  }

  Cancel(): void {

  }

  Delete() {

  }

}
