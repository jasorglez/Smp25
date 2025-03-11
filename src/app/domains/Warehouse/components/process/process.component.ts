import { Component, inject } from '@angular/core';
import { concat, lastValueFrom } from 'rxjs';
import { toArray, tap } from 'rxjs/operators';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

import { ColDef, GridApi, GridReadyEvent, RowSelectedEvent } from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
 
import { AgGridModule } from 'ag-grid-angular';
import { Router } from '@angular/router';
import { CatalogsService } from 'app/services/catalogs.service';
import { SignalsService } from 'app/services/signals.service';
import { DetailsprocessComponent } from "../detailsprocess/detailsprocess.component";


@Component({
  selector: 'app-process',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, DetailsprocessComponent],
  templateUrl: './process.component.html',
  styleUrl: './process.component.scss'
})
export class ProcessComponent {

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
  gridHeight: string = '29vh';  
  prefixAndConsecutive: any[] = [];
  private tempIdCounter: number = 0;
  private gridApi: GridApi;

  currentIndex = 0;
  private catalogService = inject(CatalogsService);
  private signalsService = inject(SignalsService);

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  

  obtenerDatos() {
    this.catalogService.getCatalogs(this.idRoot,'PROCESOS').subscribe(
      (data: any) => {
        this.rowData = data;      
        console.log('Proceso:', this.rowData);
      },
      (error) => {
        if (error.status == 404) this.rowData = [];
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

  
  //OPERATIONS DE LOS GRIDS

  get colMaster(): ColDef[] {
    return [
      { field: 'description', headerName: 'Identificador', editable: true, filter: true, width: 250 },
      { field: 'valueAddition', headerName: 'Prefijo', editable: true, width: 185 },
      { field: 'parentId', headerName: 'Consecutivo', editable: true, width: 185 },
      { field: 'idElection', headerName: 'Select', editable: true, width: 185 },
    ]
  };


  onSelectedRow(event: RowSelectedEvent): void {
    if (event.node && event.node.isSelected()) { // Verificar si la fila está seleccionada
      const selectedRowData = event.data;
      const selectedId = selectedRowData?.id;
  
      if (selectedId) {
        // Actualiza el servicio de señales
        this.signalsService.setProcces(parseInt(selectedId));
  
        // Asigna los datos seleccionados
        this.selectedRowData = selectedRowData;
  
        // Forzar la actualización del componente hijo
        this.showDetailsTab = false;
        setTimeout(() => {
          this.showDetailsTab = true;
        }, 0);
      }
    }
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
  rowHeight: 20,
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
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
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


  ///OPERATIONS DE LOS GRABADOS
  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idBranch  : 1,
      name      : '',
      branch    : '',
      numBranch : '',
      contact   : '',
      phone     : '',
      picture   : '',
      code      : '',
      active: true,
      __isNew: true,
    };
    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }
  

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

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this,this.catalogService.addCatalog(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      console.log('cleanedData', cleanedData)
      return this.catalogService.updateCatalog(cleanedData);
      
    });

    

    // Using concat to combine observables and lastValueFrom for async/await
    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );
      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos(); // Refrescar los datos
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

  }

  deleteEntry() {  
  
  }

}
