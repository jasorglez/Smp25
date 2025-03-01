import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, inject, Injectable } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { UsersService } from 'app/services/users.service';
import { alerts } from 'app/helpers/alerts';
import { FormsModule } from '@angular/forms';
import { UsersProfileComponent } from "./users-profile.component";
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { MatDialogModule } from '@angular/material/dialog';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { SignalsService } from 'app/services/signals.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';

@Injectable({
  providedIn: 'root',
})

// Ahora el componente principal
@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    UsersProfileComponent,
    MatDialogModule
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent {

  private usersService = inject(UsersService);
  private imageHandlerService = inject(ImageHandlerService);
  private usersxcompanysService = inject(UsersxpermissionsService);
  private signalsService = inject(SignalsService);
  profile = computed(() => this.signalsService.profile);

  enviarSignal() {
    const departmentName = this.getDepartmentName(this.selectedRowData.idDepartament);
    this.signalsService.profileSignal(this.selectedRowData.id, this.selectedRowData.email,
      this.selectedRowData.picture, this.selectedRowData.displayName,
      departmentName, this.selectedRowData.position);
      this.signalsService.nameCompany.set(null);
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  ngOnInit() {
    this.obtenerDepartamentos();
    this.obtenerDatos();
  }

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent
  }

  gridHeight: string = '80vh';
  newlyAddedRows: string[] = [];
  entrada: any;
  departamentos: { [key: string]: string } = {};
  rowData: any[] = [];
  paginationPageSize = 20; // Tamaño de página
  pagination = true; // Habilitar paginación
  notSavedChanges: boolean = false;
  paginationPageSizeSelector = false;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;

  obtenerDatos() {
    this.usersService.getDataUsers().subscribe({
      next: (response: any) => {
        if (response && response.code === 200 && response.data) {
          this.rowData = response.data.map((item: any) => {
            return { id: item.id, ...item };
          });
          this.rowData = this.rowData.filter(row => row.active !== 0);
        } else {
          console.error('Respuesta inválida del servidor');
        }
      },
      error: (error) => {
        console.error('Error al obtener los datos:', error);
      }
    });
  }

  obtenerDepartamentos() {
    this.usersService.getDepartments().subscribe((data: any[]) => {
      this.departamentos = data.reduce((acc, dep) => {
        acc[dep.id] = dep.name; // Cambia la estructura para que solo almacene el nombre
        return acc;
      }, {});
    });
  }

  // Se modifica el getDepartmentName para que devuelva el nombre del departamento
  getDepartmentName(idDepartament: string): string {
    return this.departamentos[idDepartament] || 'Departamento no encontrado';
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

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'active',
        hide: true
      },
      {
        field: 'displayName',
        headerName: 'Nombre',
        editable: true,
        filter: true,
        cellEditor: 'autocompleteEditor',
        cellEditorParams: {
          filterList: this.rowData.map(e => e.displayName),
          filterKey: 'displayName',
          placeholder: 'Nombre',
          minLength: 1
        },
        valueSetter: (params) => {
          const duplicateExists = this.rowData.some((row, index) =>
            index !== params.node.rowIndex && row.displayName === params.newValue
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Nombre duplicado',
              'Ya existe un usuario con ese nombre.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = params.newValue;
          return true;
        }
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
        filter: true
      },
      {
        field: 'age',
        headerName: 'Edad',
        cellEditor: 'agNumberCellEditor',
        editable: true,
        cellEditorParams: {
          min: 0,
          max: 200,
        },
        width: 100,
      },
      {
        field: 'country',
        headerName: 'País',
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: ['México', 'USA', 'MEX-USA', 'Colombia', 'Chile', 'Otro'],
          selectOnPopup: true
        },
      },
      {
        headerName: 'Contraseña',
        field: 'password',
        cellRenderer: (params: any) => {
          return `<span>••••••••</span>`;
        },
        editable: true,
      },
      {
        field: 'idDepartament',
        headerName: 'Departamento',
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: [Object.keys(this.departamentos)],
        },
        valueFormatter: (params) => this.departamentos[params.value] || '',
        valueSetter: (params) => {
          const newValue = params.newValue;
          if (this.departamentos.hasOwnProperty(newValue)) {
            params.data[params.colDef.field] = newValue;
            return true;
          }
          return false;
        },
        valueParser: (params) => params.newValue,
        editable: true,
      },
      {
        field: 'phone',
        headerName: 'Teléfono',
        cellEditor: 'agTextCellEditor',
        editable: true,
      },
      {
        field: 'position',
        headerName: 'Posición',
        cellEditor: 'agTextCellEditor',
        editable: true,
      },
      {
        field: 'picture',
        headerName: 'Imagen de perfil',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture'
        },
        editable: false,
        width: 100
      },
      {
        field: 'signature',
        headerName: 'Firma',
        cellEditor: 'agTextCellEditor',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'signature'
        },
        editable: false,
        width: 100
      }
    ];
  }

  selectedRowData: any = null;

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      // Aquí envío todo a la signal
      this.enviarSignal();
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event) {
    console.log('Dato cambiado:', event.data);
    // Aquí envío todo a la signal
    this.enviarSignal();
    this.notSavedChanges = true;
    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
  }

  async saveChanges() {
    const isValid = this.rowData.every(
      (item) => item.displayName && item.email && item.password
    );

    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe introducir el nombre del usuario, su correo y su contraseña antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter(row => row.__isNew);
    const modifiedRows = this.rowData.filter(row => row.__modified && !row.__isNew);

    const addObservables = newRows.map(row => {
      const cleanedData = this.cleanDataForServer(row);
      return this.usersService.addUser(cleanedData);
    });

    const updateObservables = modifiedRows.map(row => {
      const cleanedData = this.cleanDataForServer(row);
      return this.usersService.updateUser(row.id, cleanedData);
    });

    // Using concat to combine observables and lastValueFrom for async/await
    try {
      const responses = await lastValueFrom(concat(...addObservables, ...updateObservables).pipe(toArray()));
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

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      active: 1,
      displayName: '',
      country: '',
      email: '',
      password: '',
      age: null,
      idDepartament: 1,
      phone: '',
      position: '',
      picture: './assets/img/profile.png',
      signature: '',
      __isNew: true
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async deleteUser() {
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
    this.usersService.deleteUser(id, selectedData).pipe(
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
      )
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