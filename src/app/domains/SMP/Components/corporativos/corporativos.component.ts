import { Component, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { concat, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RootService } from 'app/services/root.service';
import { ImageHandlerService } from 'app/services/image-handler.service';

@Component({
  selector: 'app-corporativos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './corporativos.component.html',
  styleUrls: ['./corporativos.component.css']
})
export class CorporativosComponent {

  private rootService = inject(RootService);
  private imageHandlerService = inject(ImageHandlerService);

  notSavedChanges: boolean = false;
  rowData: any[] = [];
  selectedRowData: any = null;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  ngOnInit() {
    this.obtenerDatos();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  obtenerDatos() {
    this.rootService.getCorporativos().subscribe({
      next: (data: any) => {
        this.rowData = data || [];
      },
      error: (error) => {
        console.error('Error obteniendo corporativos:', error);
        this.rowData = [];
      }
    });
  }

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    minWidth: 100
  };

  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 60,
    stopEditingWhenCellsLoseFocus: true,
    enableBrowserTooltips: true,
  };

  columnDefs: ColDef[] = [
    {
      headerName: '#',
      valueGetter: (params) => {
        if (params.node && params.node.rowIndex !== null) {
          return params.node.rowIndex + 1;
        }
        return '';
      },
      editable: false,
      flex: 0.5,
      maxWidth: 70,
      pinned: 'left',
      cellStyle: {
        fontWeight: 'bold',
        textAlign: 'center',
        backgroundColor: '#f8f9fa'
      }
    },
    {
      field: 'name',
      headerName: 'Nombre',
      editable: true,
      flex: 2,
      minWidth: 200
    },
    {
      field: 'partner1',
      headerName: 'Socio 1',
      editable: true,
      flex: 1.5,
      minWidth: 150
    },
    {
      field: 'partner2',
      headerName: 'Socio 2',
      editable: true,
      flex: 1.5,
      minWidth: 150
    },
    {
      field: 'image',
      headerName: 'Imagen',
      cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
      cellRendererParams: {
        clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
        field: 'image'
      },
      editable: false,
      width: 120
    },
    {
      field: 'comment',
      headerName: 'Comentario',
      editable: true,
      flex: 1.5,
      minWidth: 150
    },
    {
      field: 'active',
      headerName: 'Activo',
      editable: true,
      flex: 0.7,
      maxWidth: 100,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: [true, false]
      },
      valueFormatter: (params) => params.value ? 'Si' : 'No',
      cellStyle: (params) => ({
        textAlign: 'center',
        color: params.value ? 'green' : 'red',
        fontWeight: 'bold'
      })
    }
  ];

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    setTimeout(() => {
      params.api.sizeColumnsToFit();
    }, 100);
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;

    const newItem = {
      id: tempId,
      name: '',
      partner1: '',
      partner2: '',
      image: '',
      comment: '',
      active: true,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.notSavedChanges = true;

    setTimeout(() => {
      this.gridApi.setGridOption('rowData', this.rowData);
      setTimeout(() => {
        this.gridApi.startEditingCell({
          rowIndex: 0,
          colKey: 'name'
        });
      }, 100);
    }, 50);
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.name);
    if (!isValid) {
      alerts.basicAlert(
        'Validación',
        'El campo Nombre es obligatorio.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables: Promise<any>[] = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return lastValueFrom(this.rootService.addCorporativo(cleanedData));
    });

    const updateObservables: Promise<any>[] = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return lastValueFrom(this.rootService.updateCorporativo(row.id, cleanedData));
    });

    try {
      await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.obtenerDatos();
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
