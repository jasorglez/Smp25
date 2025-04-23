import { Component, computed, effect, inject, Signal } from '@angular/core';
import { CatalogsService } from 'app/services/catalogs.service';
import { TablesxmodulesService } from 'app/services/tablesxmodules.service';
import { SignalsService } from 'app/services/signals.service';

import { TranslateModule } from '@ngx-translate/core';
import { concat, lastValueFrom } from 'rxjs';
import { toArray } from 'rxjs/operators';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

import { ColDef, GridApi, GridReadyEvent, RowSelectedEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';

import { alerts } from '../../../../helpers/alerts';
import { SharedModule } from 'app/shared/shared.module';

//soriano
@Component({
  selector: 'app-catalogs',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, SharedModule, TranslateModule],
  templateUrl: './catalogs.component.html',
  styleUrl: './catalogs.component.scss'
})
export class CatalogsComponent {

  notSavedChanges: boolean = false;
  rowData: any;

  newlyAddedRows: string[] = [];
  table: any[] = [];
  selectedRowData: any = null;

  idRoot: number;
  selectedCatalog: string; // Variable para almacenar e
  showDetailsTab: boolean = false;
  gridHeight: string = '50vh';
  prefixAndConsecutive: any[] = [];
  private tempIdCounter: number = 0;
  private gridApi: GridApi;


  menuSelect: number;
  showWarehTab: Signal<boolean>;
  showAdmonTab: Signal<boolean>;

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerTables();
      this.obtenerDatos();
    })
  }

  ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.obtenerTables()
    this.obtenerDatos();

  }

  currentIndex = 0;
  private catalogService = inject(CatalogsService);
  private signalsService = inject(SignalsService);
  private tableService = inject(TablesxmodulesService);

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';


  onCatalogChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedCatalog = selectElement.value; // Almacena el valor seleccionado
    //console.log('Catálogo seleccionado:', event.target.any;    
    this.obtenerDatos(); // Vuelve a ejecutar la consulta con el nuevo valor
  }

  obtenerTables() {
    this.tableService.getTablesxmodules(this.signalsService.getCatalogSelected()).subscribe(
      (data: any) => {
        this.table = data;
        console.log('Table:', this.table);
      },
      (error) => {
        if (error.status == 404) this.table = [];
        console.error('Error fetching data:', error);
      }
    );
  }
  

  obtenerDatos() {
    //alert(this.selectedCatalog),   //alert(this.idRoot)
    this.catalogService.getCatalogs(this.idRoot, this.selectedCatalog).subscribe({
      next: (data: any[]) => {
        const nuevoArray = data.map((item) => {
          return {
            ...item,
            valueAddition2: item.valueAddition2 === "true"
          };
        });
        this.rowData = nuevoArray;
        //this.rowData = data;
        console.log("Datos procesados:", this.rowData);
      },
      error: () => {
        this.rowData = [];
        console.error("Error al obtener datos del catálogo BONUS.");
      }
  });
  }


  //OPERACIONES DE LOS GRIDS

  get colMaster(): ColDef[] {
    return [
      { field: 'id', headerName: 'Id', editable: true, filter: false, width: 80 },
      { field: 'description', headerName: 'Descripción', editable: true, filter: true, width: 250 },
      {
        field: 'valueAddition',
        headerName: this.selectedCatalog !== 'BONUS' ? 'Color' : '',
        editable: true,
        width: 100,
        hide: this.selectedCatalog !== 'BONUS' && this.selectedCatalog !== 'TYPECLIENT' // Oculta si no es BONUS
      },
      {
        field: 'valueAddition2',
        headerName: 'Activo',
        editable: true,
        width: 100,

      }
    ];
    
  }

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
      idCompany: this.idRoot,
      description: '',
      valueaddition: 'NA',
      valueAddition2: true,
      type: this.selectedCatalog,
      picture: '',
      select: false,
      parentId: 0,
      election: null,
      active: 1,
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

      cleanedData.valueAddition2 = String(cleanedData.valueAddition2);
      console.log("añadidos", cleanedData.valueAddition2);
      return this, this.catalogService.addCatalog(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      cleanedData.valueAddition2 = String(cleanedData.valueAddition2);
      console.log("añadidos", cleanedData.valueAddition2);
      return this.catalogService.updateCatalog(row.id, cleanedData);

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


  revert() {

  }

  deleteEntry() {

  }

}
