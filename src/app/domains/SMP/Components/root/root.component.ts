import { Component, HostListener, effect, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { ContractsService } from 'app/services/contracts.service';
import { concat, lastValueFrom, toArray } from 'rxjs';
import { CommonModule } from '@angular/common';
import { InegiService } from 'app/services/inegi.service';
import { FormsModule } from '@angular/forms';
import { SignalsService } from 'app/services/signals.service';
import { RootService } from 'app/services/root.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { BranchsService } from 'app/services/branchs.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './root.component.html'
})
export class RootComponent {


  private rootService = inject(RootService);
  private inegiService = inject(InegiService);
  private imageHandlerService = inject(ImageHandlerService);
  private branchesService = inject(BranchsService);

  private signalsService = inject(SignalsService);

  notSavedChanges: boolean = false;
  rowData: any[] = [];
  estados: { [key: string]: string } = {};
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  idUser: number = null;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  ngOnInit() {
    this.idUser = this.signalsService.getIdUSer()();
    this.obtenerDatos();
    this.obtenerEstados();
  }

  obtenerEstados() {
    this.inegiService.getEstados().subscribe({
      next: (response: any) => {
        if (response?.datos) {
          this.estados = response.datos.reduce((acc: any, estado: any) => {
            acc[estado.nom_agee] = estado.nom_agee;
            return acc;
          }, {});
        }
        this.refreshColumnDefs();
      },
      error: (error) => {
        console.error('Error obteniendo estados:', error);
        // Estados de México por defecto si falla el API
        //los Estados de México por defecto si falla el API
        this.estados = {
          'Aguascalientes': 'Aguascalientes',
          'Baja California': 'Baja California',
          'Baja California Sur': 'Baja California Sur',
          'Campeche': 'Campeche',
          'Chiapas': 'Chiapas',
          'Chihuahua': 'Chihuahua',
          'Ciudad de México': 'Ciudad de México',
          'Coahuila': 'Coahuila',
          'Colima': 'Colima',
          'Durango': 'Durango',
          'Estado de México': 'Estado de México',
          'Guanajuato': 'Guanajuato',
          'Guerrero': 'Guerrero',
          'Hidalgo': 'Hidalgo',
          'Jalisco': 'Jalisco',
          'Michoacán': 'Michoacán',
          'Morelos': 'Morelos',
          'Nayarit': 'Nayarit',
          'Nuevo León': 'Nuevo León',
          'Oaxaca': 'Oaxaca',
          'Puebla': 'Puebla',
          'Querétaro': 'Querétaro',
          'Quintana Roo': 'Quintana Roo',
          'San Luis Potosí': 'San Luis Potosí',
          'Sinaloa': 'Sinaloa',
          'Sonora': 'Sonora',
          'Tabasco': 'Tabasco',
          'Tamaulipas': 'Tamaulipas',
          'Tlaxcala': 'Tlaxcala',
          'Veracruz': 'Veracruz',
          'Yucatán': 'Yucatán',
          'Zacatecas': 'Zacatecas'
        };
        this.refreshColumnDefs();
      }
    });
  }

  refreshColumnDefs() {
    this._columnDefs = [];
    if (this.gridApi) {
      this.gridApi.setGridOption('columnDefs', this.columnDefs);
    }
  }
  constructor() {
    effect(() => {
      this.idUser = this.signalsService.getIdUSer()();
      this.obtenerDatos();
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }



  obtenerDatos() {
    this.rootService
      .getRoot()
      .subscribe((data: any) => {
        this.rowData = data;
        //   console.log(data)
      });
  }

  components = {
    autocompleteEditor: AutocompleteEditorComponent
  }

  public defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    minWidth: 100
  };


  // Orden de columnas editables para navegación con Enter
  private editableColumnOrder = [
    'orden', 'name', 'nameSmall', 'rfc', 'personType', 'email', 'phone',
    'address', 'city', 'state', 'cp', 'country', 'web', 'formatRep', 'advanced'
  ];

// Column Definitions: Defines the columns to be displayed.
public gridOptions: any = {
  headerHeight: 30,
  rowHeight: 60,
  stopEditingWhenCellsLoseFocus: true,
  enableBrowserTooltips: true,
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
  }
};

  // Mover a la siguiente celda editable con Enter
  onCellEditingStopped(event: any) {
    if (event.valueChanged || event.oldValue === event.newValue) {
      const currentColId = event.column.getColId();
      const currentIndex = this.editableColumnOrder.indexOf(currentColId);

      if (currentIndex !== -1 && currentIndex < this.editableColumnOrder.length - 1) {
        const nextColId = this.editableColumnOrder[currentIndex + 1];
        setTimeout(() => {
          this.gridApi.startEditingCell({
            rowIndex: event.rowIndex,
            colKey: nextColId
          });
        }, 50);

      }        
    }
  }
  
  private _columnDefs: ColDef[] = [];

  get columnDefs(): ColDef[] {
    if (this._columnDefs.length > 0) {
      return this._columnDefs;
    }

    this._columnDefs = [
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
        field: 'orden',
        headerName: 'Orden',
        editable: true,
        minWidth: 70,
        width: 80,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 0,
          precision: 0
        },
        valueParser: (params) => Number(params.newValue),
        cellStyle: { textAlign: 'center' }
      },
      {
        field: 'name',
        headerName: 'Nombre',
        editable: true,
        flex: 2,
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData.map(e => e.name),
          filterKey: 'name',
          placeholder: 'Nombre...',
          minLength: 1
        },
        valueSetter: (params) => {
          const duplicateExists = this.rowData.some((row, index) =>
            index !== params.node.rowIndex && row.name === params.newValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Código duplicado',
              'Ya existe una empresa con ese nombre.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = params.newValue;
          return true;
        }
      },
      {
        field: 'nameSmall',
        headerName: 'Nombre Corto',
        editable: true,
        flex: 1,
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData.map(e => e.nameSmall),
          filterKey: 'nameSmall',
          placeholder: 'Nombre...',
          minLength: 1
        },
        valueSetter: (params) => {
          if (params.newValue.length > 10) {
            alerts.basicAlert(
              'Error de validación',
              'El nombre corto no puede tener más de 10 caracteres.',
              'error'
            );
            return false;
          }

          const duplicateExists = this.rowData.some((row, index) =>
            index !== params.node.rowIndex && row.nameSmall === params.newValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Código duplicado',
              'Ya existe una empresa con ese nombre',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = params.newValue;
          return true;
        }
      },
      {
        field: 'formatRep',
        headerName: 'Formato de reporte',
        editable: true,
        flex: 1
      },
      {
        field: 'email',
        headerName: 'Email',
        cellEditor: 'agTextCellEditor',
        editable: (params) => params.data.__isNew,
        cellEditorParams: {
          useFormatter: true,
        },
        valueFormatter: (params) => params.value,
        valueSetter: (params) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(params.newValue)) {
            // Verificar si el email ya existe
            const duplicateExists = this.rowData.some((row, index) =>
              index !== params.node.rowIndex && row.email === params.newValue
            );

            if (duplicateExists) {
              alerts.basicAlert(
                'Añadir usuario',
                'Ya existe un usuario con ese correo electrónico.',
                'error'
              );
              return false;
            }

            params.data[params.colDef.field] = params.newValue;
            return true;
          } else {
            alerts.basicAlert(
              'Editar usuario',
              'Correo electrónico no válido.',
              'error'
            );
            return false;
          }
        },
        filter: true,
        flex: 1.5,
        minWidth: 180
      },
      {
        field: 'web',
        headerName: 'Web',
        editable: true,
        flex: 1
      },
      {
        field: 'personType',
        headerName: 'Tipo de persona',
        editable: true,
        flex: 1,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['MORAL', 'FISICA']
        }
      },
      {
        field: 'phone',
        headerName: 'Teléfono',
        editable: true,
        flex: 1
      },
      {
        field: 'address',
        headerName: 'Dirección',
        editable: true,
        flex: 2
      },
      {
        field: 'city',
        headerName: 'Ciudad',
        editable: true,
        flex: 1
      },
      {
        field: 'state',
        headerName: 'Estado',
        editable: true,
        flex: 1,
        minWidth: 150,
        tooltipField: 'state',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: Object.keys(this.estados)
        }
      },
      {
        field: 'country',
        headerName: 'País',
        editable: true,
        flex: 1
      },
      {
        field: 'rfc',
        headerName: 'RFC',
        editable: true,
        flex: 1
      },
      {
        field: 'cp',
        headerName: 'Código Postal',
        editable: true,
        flex: 1
      },
      {
        field: 'advanced',
        headerName: 'Permisos avanzados',
        editable: true,
        cellEditor: 'agSelectCellEditor',
        flex: 1
      },
      {
        field: 'picture',
        headerName: 'Foto Root',
        cellEditor: 'agTextCellEditor',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture'
        },
        editable: false,
        width: 120
      },
      {
        field: 'picture2',
        headerName: 'Header',
        cellEditor: 'agTextCellEditor',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture2'
        },
        editable: false,
        width: 120
      },
      {
        field: 'picture3',
        headerName: 'Footer',
        cellEditor: 'agTextCellEditor',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture3'
        },
        editable: false,
        width: 120
      },
    ];

    return this._columnDefs;
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
    // Autoajustar columnas al ancho del grid
    setTimeout(() => {
      params.api.sizeColumnsToFit();
    }, 100);
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      orden: 0,
      name: '',
      web: '',
      email: '',
      nameSmall: '',
      picture: '',
      picture2: '',
      picture3: '',
      phone: '',
      consortium: 'NO',
      formatRep: '',
      city: '',
      advanced: false,
      state: '',
      country: '',
      rfc: '',
      cp: '',
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

    const addObservables: Promise<any>[] = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return lastValueFrom(this.rootService.addRoot(cleanedData));
    });

    const updateObservables: Promise<any>[] = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      return lastValueFrom(this.rootService.updateRoot(row.id, cleanedData));
    });

    // Using concat to combine observables and lastValueFrom for async/await
    try {
      const responses = await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );

      for (const response of responses) {
        // Verificar si es una nueva creación comparando con los IDs temporales
        const correspondingNewRow = newRows.find(
          (row) => !row.id || row.id.toString().startsWith('temp_')
        );

        if (response.id && correspondingNewRow) {
          //console.log(response)

          try {
            await lastValueFrom(
              this.branchesService.assignPermissionAfterCreation(
                this.idUser, //id user
                response.id,
                'root'
              )
            );
          } catch (permError) {
            console.error('Error asignando permiso:', permError);
            // Opcional: Mostrar alerta pero no interrumpir el flujo principal
            alerts.basicAlert(
              'Advertencia',
              'Se creó la sucursal pero hubo un problema asignando los permisos.',
              'warning'
            );
          }
        }
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      for (const response of responses) {
        // Verificar si es una nueva creación comparando con los IDs temporales
        const correspondingNewRow = newRows.find(row =>
          !row.id || row.id.toString().startsWith('temp_')
        );

        if (response.id && correspondingNewRow) {

          try {
            await lastValueFrom(
              this.branchesService.assignPermissionAfterCreation(
                this.idUser, //id user 
                response.id,
                'company'
              )
            );
          } catch (permError) {
            console.error('Error asignando permiso:', permError);
            // Opcional: Mostrar alerta pero no interrumpir el flujo principal
            alerts.basicAlert(
              'Advertencia',
              'Se creó la sucursal pero hubo un problema asignando los permisos.',
              'warning'
            );
          }
        }
      }
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
