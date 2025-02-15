import { Component, HostListener, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';
import { AdministrationService } from 'app/services/administration.service';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { AgGridModule } from 'ag-grid-angular';
import { ModalService } from 'app/services/modal.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { ImageHandlerService } from 'app/services/image-handler.service';


@Component({
  selector: 'app-banks',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, MultiLineEditorComponent],
  templateUrl: './banks.component.html',
  styleUrl: './banks.component.scss'
})
export class BanksComponent {

  ngOnInit() {
    this.obtenerDatos();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  notSavedChanges: boolean = false;
  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  
  branches: any;
  id: string;
  private tempIdCounter: number = 0;

  private gridApi: GridApi;

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  frameworkComponents = {
    multiLineEditor: MultiLineEditorComponent
  };

  // Inject of new way for Angular 18
  private administrationService = inject(AdministrationService);  
  private modalServiceTable = inject(ModalService);  
  private imageHandlerService = inject(ImageHandlerService);

// Column Definitions: Defines the columns to be displayed.

gridOptions = {
  headerHeight: 30,
  rowHeight: 30
}

get colMaster(): ColDef[] {
  return [
    { field: 'name', headerName: 'Nombre', editable: true, filter: true, width: 200 },
    { field: 'branch', headerName: 'Sucursal', editable: false, width: 285, filter: true,
      cellEditor: 'agPopupTextCellEditor',
      cellEditorParams: {
        maxLength: 100,
        cols: 50,
        rows: 3,
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.stopPropagation();
          }
        },
      },
      onCellDoubleClicked: (event: CellDoubleClickedEvent) => {
        if (!event.node.group) {
          this.modalServiceTable.showModal({
            params: event,
            value: event.value,
          });
        }
      },
      cellRenderer: (params: ICellRendererParams) => {
        if (params.node.group) {
          return params.value;
        }
        return params.value;
      }
     },
             
    { field: 'contact', headerName: 'Contacto', editable: true, width: 255 },
        
    { field: 'phone', headerName: 'Telefono', editable: true, width: 169, cellEditorParams: {
        maxLength: 15  }
    },

    {
      field: 'picture',
      headerName: 'Imagen',
      cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
      cellRendererParams: {
        clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
        field: 'picture'
      },
      editable: false,
      width: 130
    },

    { field: 'numBranch', headerName: 'Numero Sucursal', editable: true, width: 140 }, 

    { field: 'code', headerName: 'Codigo', editable: true, width: 105 },
    
  ]
};

  obtenerDatos() {
    this.administrationService.getBanks().subscribe((data: any) => {
      this.rowData = data;
    });
  }

  onSelectedRow(event: any) {
    console.log(event)
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    console.log(event)
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
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
    const isValid = this.rowData.every((item) => item.name && item.branch);
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
      return this.administrationService.addBanks(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.administrationService.updateBanks(row.id, cleanedData);
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

  async deleteEntry() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Por favor, seleccione una entrada para eliminar.',
        'error'
      );
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;
    selectedData.active = 0;
    this.administrationService.deleteBanks(id).pipe(
      catchError((error) => {
        alerts.basicAlert(
          'Eliminar entrada',
          'Error al eliminar la entrada.',
          'error'
        );
        console.error(error);
        return EMPTY;
      })
    )
      .subscribe(
        () => {
          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.obtenerDatos();

          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.notSavedChanges = false;
          this.selectedRowData = null;
        }
      );
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
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

}
