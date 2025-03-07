import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
 
import { AgGridModule } from 'ag-grid-angular';
import { Router } from '@angular/router';
import { CatalogsService } from 'app/services/catalogs.service';
import { SignalsService } from 'app/services/signals.service';
import { DetailsprocessComponent } from "../detailsprocess/detailsprocess.component";

@Component({
  selector: 'app-configwarehouse',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, DetailsprocessComponent],
  templateUrl: './configwarehouse.component.html',
  styleUrl: './configwarehouse.component.scss'
})
export class ConfigwarehouseComponent {

  ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.obtenerDatos();
  }

  notSavedChanges: boolean = false;
  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  depto    : any[] = [];
  proceso  : any[] = [];
  idRoot: number;
  showDetailsTab: boolean = false;

  branches: any;
  id: string;
  private tempIdCounter: number = 0;

  private gridApi: GridApi;

  currentIndex = 0;
  private catalogService = inject(CatalogsService);
  private signalsService = inject(SignalsService);

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];

  obtenerDatos() {
    this.catalogService.getCatalogs(this.idRoot,'PROCESOS').subscribe(
      (data: any) => {
        this.rowData = data;      
        console.log('Proceso:', this.rowData);
      },
      (error) => {
        if (error.status == 404) this.proceso = [];
        console.error('Error fetching data:', error);
      }
    );
  }

  getDeptoandPosition() {
    this.catalogService.getCatalogs(this.idRoot,'DEPARTAMENT').subscribe(
      (data: any) => {
        this.depto = data;      
      },
      (error) => {
        if (error.status == 404) this.depto = [];
        console.error('Error fetching data:', error);
      }
    );

  
  }


  get colMaster(): ColDef[] {
    return [
      { field: 'description', headerName: 'Identificador', editable: true, filter: true, width: 250 },
      
      {
        field: 'parentId', // Field to store selected department IDs
        headerName: 'Departamentoa',
        editable: false,
        width: 169,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.depto.map(depto => depto.description),
          multiple: true // Enable multi-select
        },
        // Custom value formatter to display selected departments as comma-separated list
        valueFormatter: (params) => {
          if (!params.value || !Array.isArray(params.value)) return '';
          return params.value.map(id => {
            const dept = this.depto.find(d => d.id === id);
            return dept ? dept.description : '';
          }).join(', ');
        }
      },
      { field: 'parentId', headerName: 'Cotizacion', editable: true, width: 185 },
  
    ]
  };

  //OPERATIONS DE LOS GRIDS

  onSelectedRow(event: any) {
    console.log('es el evento',event)
    this.id = event.data.id;
  }

  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);
    event.data.__modified = true;
    this.notSavedChanges = true;
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

  onCellDoubleClicked(event: CellDoubleClickedEvent): void {
    const colId = event.column.getColId();
    const selectedRowData = event.data; // Obtener los datos de la fila seleccionada
    const selectedId = selectedRowData.id; // Obtener el ID del registro

     this.showDetailsTab = true;
     console.log('selectedRowData:', selectedRowData);
    // Puedes agregar lógica adicional aquí si necesitas guardar los datos seleccionados
     this.selectedRowData = selectedRowData;
  }

  ///OPERATIONS DE LOS GRABADOS
  addRow() {
  
  }

  saveChanges() {
  
  }

  revert(){

  }

  deleteEntry() {  
  
  }
}
