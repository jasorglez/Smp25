import { Component, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { SignalsService } from 'app/services/signals.service';
import { concat, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SteakholderService } from 'app/services/steakholder.service';
import { ImageHandlerService } from 'app/services/image-handler.service';

@Component({
  selector: 'app-stakeholders',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './stakeholders.component.html',
  styleUrl: './stakeholders.component.scss'
})
export class StakeholdersComponent {

  private idProject = 0;
  private fecha : Date = new Date();

  private steakService          = inject(SteakholderService);  
  private signalsService      = inject(SignalsService) ;
  private imageHandlerService = inject(ImageHandlerService);

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

  onDateChange(event: Event) {
    const input = event.target as HTMLInputElement;
    //console.log('Fecha seleccionada:', input.value);
    // Aquí puedes agregar la lógica para manejar el cambio de fecha
    this.fecha = new Date(input.value) ; 
  }

  notSavedChanges: boolean = false;
  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  obtenerDatos() {
    this.idProject = this.signalsService.getProjectSelectedBySidebar()();
    this.steakService.get(this.idProject, this.fecha).subscribe((data: any) => {
        this.rowData = data;
        console.log(data)
      });
  }


  public defaultColDef : ColDef = {
    sortable           : true,
    resizable          : true,
    flex               : 1
  };

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'name',
        headerName: 'Provider',
        editable: true,
        flex: 2
      },
      {
        field: 'name',
        headerName: 'Nombre',
        editable: true,
        flex: 1
      },
      {
        field: 'image1',
        headerName: '1',
        cellEditor: 'agTextCellEditor',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture'
        },
        editable: false,
      },
      {
        field: 'image2',
        headerName: '2',
        cellEditor: 'agTextCellEditor',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture'
        },
        editable: false,
      },
      {
        field: 'image3',
        headerName: '3',
        cellEditor: 'agTextCellEditor',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture2'
        },
        editable: false,
      },
      {
        field: 'image4',
        headerName: '4',
        cellEditor: 'agTextCellEditor',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture3'
        },
        editable: false,
      },
      {
        field: 'image5',
        headerName: '5',
        cellEditor: 'agTextCellEditor',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture3'
        },
        editable: false,
      },
    ];
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
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
      name: '',
      nameSmall: '',
      picture: '',
      picture2: '',
      picture3: '',
      phone: '',
      consortium: 'NO',
      formatRep: '',
      city: '',
      state: '',
      country: '',
      active: 1,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.name && item.nameSmall);
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe llenar los campos Nombre y Nombre Corto antes de guardar.',
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

      return this.steakService.add(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return this.steakService.update(row.id, cleanedData);
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
