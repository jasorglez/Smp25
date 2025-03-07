import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { CatalogsService } from 'app/services/catalogs.service';
import { SignalsService } from 'app/services/signals.service';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
 
import { AgGridModule } from 'ag-grid-angular';

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
  idRoot: number;
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

    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
     this.getPermission();
  }

  //OPERATIONS DE LOS GRIDS

  get colMaster(): ColDef[] {
    return [
      { field: 'id', headerName: 'Id', editable: true, width: 185 },
  
      { field: 'description', headerName: 'Descripcion', editable: true, filter: true, width: 250 },
      { field: 'idElection', headerName: 'Eleccion', editable: true, filter: true, width: 250 },
    ]
  };

  
    onSelectedRow(event: any) {
      console.log('es el evento',event)
      this.id = event.data.id;
    }
  
    onCellValueChanged(event: any) {
      console.log('Dato cambiado:', event.data);
      event.data.__modified = true;
    }
  
    onGridReady(params: GridReadyEvent) {
      this.gridApi = params.api;
    }
  
    // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    rowClass: (params) => {
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
      this.catalogService.getCatalogs(this.idRoot,'DEPARTAMENT').subscribe(
        (data: any) => {
          this.rowData = data;      
          console.log('Data fetched:', this.depto);
        },
        (error) => {
          if (error.status == 404) this.depto = [];
          console.error('Error fetching data:', error);
        }
      );
  
    }

    addRow() {
  
    }
  
    saveChanges() {
    
    }
  
    revert(){
  
    }
  
    deleteEntry() {  
    
    }
  }

