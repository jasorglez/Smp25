import { Component, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { lastValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RootService } from 'app/services/root.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-corporativos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './corporativos.component.html',
  styleUrls: ['./corporativos.component.css']
})
export class CorporativosComponent {
  private trackingService = inject(TrackingService);

  private rootService = inject(RootService);
  private imageHandlerService = inject(ImageHandlerService);

  notSavedChanges: boolean = false;
  rowData: any[] = [];
  selectedRowData: any = null;
  private gridApi?: GridApi;
  private tempIdCounter: number = 0;

  private editableColumnOrder = [
    'name', 'partner1', 'partner2', 'partner3', 'partner4', 'partner5', 'comment', 'active'
  ];
  private enterPressed: boolean = false;

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
        this.rowData = Array.isArray(data) ? data : data?.Data || data?.data || [];
        this.refreshGridData();
      },
      error: (error) => {
        console.error('Error obteniendo corporativos:', error);
        this.rowData = [];
        this.refreshGridData();
      }
    });
  }

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    minWidth: 100,
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        this.enterPressed = true;
        setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
        return true;
      }
      return false;
    }
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
      minWidth: 140
    },
    {
      field: 'partner2',
      headerName: 'Socio 2',
      editable: true,
      flex: 1.5,
      minWidth: 140
    },

      {
      field: 'partner3',
      headerName: 'Socio 3',
      editable: true,
      flex: 1.5,
      minWidth: 140
    },
    {
      field: 'partner4',
      headerName: 'Socio 4',
      editable: true,
      flex: 1.5,
      minWidth: 140
    },
{
      field: 'partner5',
      headerName: 'Socio 5',
      editable: true,
      flex: 1.5,
      minWidth: 140
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
    this.refreshGridData();
    setTimeout(() => {
      params.api.sizeColumnsToFit();
    }, 100);
  }

  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const currentColId = event.column.getColId();
    const currentIndex = this.editableColumnOrder.indexOf(currentColId);
    if (currentIndex !== -1 && currentIndex < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({
          rowIndex: event.rowIndex,
          colKey: this.editableColumnOrder[currentIndex + 1]
        });
      }, 100);
    }
  }

  addRow() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Agregó nuevo corporativos', 'Sistema', this.trackingService.getEmail());
    const tempId = `temp_${this.tempIdCounter++}`;

    const newItem = {
      id: tempId,
      name: '',
      partner1: '',
      partner2: '',
      partner3: '',
      partner4: '',
      partner5: '',
      image: '',
      comment: '',
      active: true,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.notSavedChanges = true;
    this.refreshGridData();

    setTimeout(() => {
      this.refreshGridData();
      setTimeout(() => {
        this.gridApi?.startEditingCell({
          rowIndex: 0,
          colKey: 'name'
        });
      }, 100);
    }, 50);
  }

  async saveChanges() {
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Guardó cambios en corporativos', 'Sistema', this.trackingService.getEmail());
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

    const addRequests: Promise<any>[] = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return lastValueFrom(this.rootService.addCorporativo(cleanedData));
    });

    const updateRequests: Promise<any>[] = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return lastValueFrom(this.rootService.updateCorporativo(row.id, cleanedData));
    });

    try {
      await Promise.all([...addRequests, ...updateRequests]);

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
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Deshizo cambios en corporativos', 'Sistema', this.trackingService.getEmail());
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

  private refreshGridData(): void {
    if (!this.gridApi) return;
    this.gridApi.setGridOption('rowData', this.rowData);
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
