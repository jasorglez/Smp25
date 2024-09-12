import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, Injectable } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { UsersService } from 'app/services/users.service';
import { alerts } from 'app/helpers/alerts';
import { FormsModule } from '@angular/forms';
import { AuthService } from 'app/services/auth.service';
import { SweetAlertIcon } from 'sweetalert2';
import { UsersProfileComponent } from "./users-profile/users-profile.component";
import { forkJoin } from 'rxjs';

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
    UsersProfileComponent
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent {


  profile = computed(() => this.usersService.profile);

  enviarSignal() {
    this.usersService.profileSignal(this.selectedRowData.email,
      this.selectedRowData.picture, this.selectedRowData.displayName,
      this.selectedRowData.organization, this.selectedRowData.position);
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  constructor(
    private usersService: UsersService,
    private authService: AuthService
  ) { }

  ngOnInit() {
    this.obtenerDatos();
    this.obtenerDepartamentos();
  }

  newlyAddedRows: string[] = [];
  entrada: any;
  departamentos: any[];
  rowData: any;
  paginationPageSize = 10; // Tamaño de página
  pagination = true; // Habilitar paginación
  notSavedChanges: boolean = false;
  paginationPageSizeSelector = false;
  id: string;
  private gridApi: GridApi;
  opciones = {
    "si": "Sí",
    "no": "No"
  }
  private tempIdCounter: number = 0;

  obtenerDatos() {
    this.usersService.getDataUsers().subscribe((response: any) => {
      if (response && response.code === 200 && response.data) {
        this.rowData = response.data.map((item: any) => {
          return { id: item.id, ...item };
        });
        this.rowData = this.rowData.filter(row => row.active !== 0);
        console.log(this.rowData);
      } else {
        console.error('Respuesta inválida del servidor');
      }
    }, error => {
      console.error('Error al obtener los datos:', error);
    });
  }

  obtenerDepartamentos() {
    this.usersService.getDepartments().subscribe((data) => {
      this.departamentos = Object.values(data).map((item: any) => {
        return item.name;
      });
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'active',
        hide: true
      },
      {
        field: 'displayName',
        headerName: 'Nombre',
        cellEditor: 'agTextCellEditor',
        editable: true,
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
          values: ['Mexico', 'USA', 'MEX-USA', 'Colombia', 'Chile', 'Otro'],
          selectOnPopup: true
        },
      },
      {
        field: 'email',
        headerName: 'Email',
        cellEditor: 'agTextCellEditor',
        editable: true,
        //editable: (params) => params.data.isNew,
        cellEditorParams: {
          useFormatter: true,
        },
        valueFormatter: (params) => params.value,
        valueSetter: (params) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(params.newValue)) {
            params.data[params.colDef.field] = params.newValue;
            return true;
          } else {
            // Mostrar alerta de correo electrónico no válido
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
        headerName: 'Contraseña',
        field: 'password',
        cellRenderer: (params: any) => {
          return `<span>••••••••</span>`;
        },
        editable: true,
      },
      {
        field: 'organization',
        headerName: 'Organización',
        editable: true,
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: this.departamentos, // Se usa cuando departamentos ya esté disponible
        },
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
        cellEditor: 'agTextCellEditor',
        cellRenderer: (params: any) => {
          if (params.value) {
            return `<img src="${params.value}" class="text-center" style="height:100%;">`;
          } else {
            return '';
          }
        },
        editable: true,
      },
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
      console.log(this.selectedRowData.id);
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

    forkJoin([...addObservables, ...updateObservables]).subscribe(
      (responses) => {
        alerts.basicAlert(
          'Datos actualizados',
          'Se han actualizado los datos correctamente.',
          'success'
        );
        this.notSavedChanges = false;
        this.newlyAddedRows = [];
        this.obtenerDatos(); // Refrescar los datos
      },
      (error) => {
        console.error(error);
        alerts.basicAlert(
          'Error',
          'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
          'error'
        );
      }
    );
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
      organization: '',
      phone: '',
      position: '',
      picture: './assets/img/profile.png',
      __isNew: true
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async deleteUser() {
    try {
      const selectedNodes = this.gridApi.getSelectedNodes();
      if (selectedNodes.length === 0) {
        alerts.basicAlert(
          'Eliminar entrada',
          'Por favor, seleccione una entrada para eliminar.',
          'warning'
        );
        return;
      }

      const selectedData = selectedNodes[0].data;
      const id = selectedData.id;
      selectedData.active = 0;

      // Elimina al usuario de la DB
      try{
        console.log(selectedData);
        await this.usersService.deleteUser(id, selectedData).toPromise();
      }
      catch (err) {
        console.error(err);
      }
      
      // Refrescar los datos después de eliminar
      this.obtenerDatos();

      alerts.basicAlert(
        'Eliminar entrada',
        'Entrada eliminada satisfactoriamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.selectedRowData = null;
    } catch (error) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Error al eliminar la entrada.',
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
