import { Component, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { TrackingService } from 'app/services/tracking.service';
import { Ilog } from 'app/interface/ilog';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';

@Component({
  selector: 'app-kardex',
  standalone: true,
  imports: [AgGridModule,],
  templateUrl: './kardex.component.html',
  styleUrl: './kardex.component.scss'
})
export class KardexComponent {

  log     : Ilog[]     = [];

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    suppressDragLeaveHidesColumns: true,
    rowGroupPanelShow: 'never', // Configuración definitiva
    suppressRowClickSelection: true, // Mejor manejo de selección
  }

      // Column Definitions: Defines the columns to be displayed.
      colLogs: ColDef[] = [
        { field: "number", checkboxSelection: true,
          headerName : '#', width :80,
          },
        { field: "company", filter : true },
        { field: "datetime", filter : true },
        { field: "description", filter : true, width : 400 },
        { field: "origin" },
        { field: "user", filter : true },
        { field: "idn" }
      ];

 
  private gridApi: GridApi;

  constructor(private trackingService : TrackingService) { }

  ngOnInit() {

       this.getdataTracking();

  }


     getdataTracking()
      {

        this.trackingService.getLast500TrackingRecords().subscribe((resp:any)=>{

          /*=============================================
        Integrando respuesta de base de datos con la interfaz
        =============================================*/
          let number = 1;

          this.log = Object.keys(resp).map(a=> ({

            id:a,
            number         :number++,
            company        :resp[a].company,
            datetime       :resp[a].datetime,
            description    :resp[a].description,
            idn             :resp[a].idn,
            origin         :resp[a].origin,
            user           :resp[a].user

          } as Ilog ));

        })

         }

         onSelectionChanged(event: any) {
         
          const selectedNodes = event.api.getSelectedNodes();
          if (selectedNodes.length > 0) {
            this.log = selectedNodes[0].data;
          } else {
            this.log = null;
          }
        }

        onGridReady(params: GridReadyEvent) {
          //   console.log('Grid API inicializada:', params.api);
             this.gridApi = params.api;
           }

        onCellValueChanged(event: any) {
            //console.log('Dato cambiado:', event.data);
            event.data.__modified = true;
          //  this.notSavedChanges = true;
        }
}
