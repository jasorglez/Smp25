import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { CatalogsService } from 'app/services/catalogs.service';
import { SignalsService } from 'app/services/signals.service';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
 
import { AgGridModule } from 'ag-grid-angular';
import { concat, lastValueFrom, toArray } from 'rxjs';

@Component({
  selector: 'app-detailsprocess',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule],
  templateUrl: './detailsprocess.component.html',
  styleUrl: './detailsprocess.component.scss'
})
export class DetailsprocessComponent {

  private catalogService = inject(CatalogsService);
  private signalsService = inject(SignalsService);

  // variables......
  notSavedChanges: boolean = false;
  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  depto    : any[] = [];
  proceso  : any[] = [];
  
  showDetailsTab: boolean = false;

  public rowSelection: 'single' | 'multiple' = 'single';

    gridHeight: string = '80vh';
    id: string;
    private tempIdCounter: number = 0;
  
    private gridApi: GridApi;
    
    constructor() {
       this.getPermission();
    }

   ngOnInit() {
     this.getPermission();
  }

  //OPERATIONS DE LOS GRIDS

  get colMaster(): ColDef[] {
    return [
      { field: 'id', headerName: 'Id', editable: true, width: 185 },
  
      { field: 'description', headerName: 'Descripcion', editable: true, filter: true, width: 250 },
      { field: 'select', headerName: 'Eleccion', editable: true, filter: true, width: 250 },
    ]
  };

  
    onSelectedRow(event: any) {
      console.log('es el evento',event)
      this.id = event.data.id;
    }
  
    
    onCellValueChanged(event: any) {
      console.log('Dato cambiado:', event.data);
      event.data.__modified = true;
      this.notSavedChanges  = true;
    }
  
    onGridReady(params: GridReadyEvent) {
      this.gridApi = params.api;
    }
  
    // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 25,
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
  };
  
    onSelectionChanged(event: any) {
      console.log('Viene del OnSelectionChanged',event)
      const selectedNodes = event.api.getSelectedNodes();
      if (selectedNodes.length > 0) {
        this.selectedRowData = selectedNodes[0].data;
      } else {
        this.selectedRowData = null;
      }
    }


    //OPERATIONS DE La aparicion de los detalles con el Grid

    activateLoansTab() {
      this.showDetailsTab = true;
      this.adjustGridSize();
    }
  
  
    adjustGridSize() {
      this.gridHeight = '40vh'; // Adjust as needed
    }


    ///OPERATIONS DE LOS GRABADOS (CRUD)

    getPermission() {

      this.catalogService.getPermissionxprocess(this.signalsService.getProcces()()).subscribe(
        (data: any) => {
          this.rowData = data;      
          console.log('Data fetched:', this.rowData);
        },
        (error) => {
          if (error.status == 404) this.depto = [];
          console.error('Error fetching data:', error);
        }
      );
  
    }

    private cleanDataForServer(data: any): any {
      const cleanedData = { ...data };
      delete cleanedData.__isNew;
      delete cleanedData.__modified;
      if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
        delete cleanedData.id;
      }
      return cleanedData;
    }

    
    
  // Operacioneas de los botones
    async saveChanges() {
          const isValid = this.rowData.every((item) => item.description);
              if (!isValid) {
                alerts.basicAlert(
                  'Añadir entrada',
                  'Debe llenar todos los campos antes de guardar.',
                  'error'
                );
                return;
              }

             const modifiedRows = this.rowData.filter(
                (row) => row.__modified && !row.__isNew
              );

        
              const updateObservables = modifiedRows.map((row) => {
                const cleanedData = this.cleanDataForServer(row);
                console.log('Clean', cleanedData)
                return this.catalogService.updatePermission(cleanedData);
              });              

              // Using concat to combine observables and lastValueFrom for async/await
              try {
                const responses = await lastValueFrom(
                  concat(...updateObservables).pipe(toArray())
                );
                alerts.basicAlert(
                  'Datos actualizados',
                  'Se han actualizado los datos correctamente.',
                  'success'
                );
                this.notSavedChanges = false;
                this.newlyAddedRows = [];
                this.getPermission(); // Refrescar los datos
              } catch (error) {
                console.error(error);
                alerts.basicAlert(
                  'Error',
                  'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
                  'error'
                );
              }
    }
  

    revert(){
      this.getPermission();
      this.notSavedChanges = false;
    }
  

  }

