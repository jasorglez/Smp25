import { CommonModule } from '@angular/common';
import { Component, HostListener, Injectable } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { UsersService } from 'app/services/users.service';
import { alerts } from 'app/helpers/alerts';
import { FormsModule } from '@angular/forms';
import { AuthService } from 'app/services/auth.service';
import { SweetAlertIcon } from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
// Componente del editor de celda personalizado
@Component({
  selector: 'app-custom-select-editor',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <select
      class="form-control"
      [(ngModel)]="value"
      (ngModelChange)="onChange($event)"
    >
      <option *ngFor="let option of options" [ngValue]="option.value">
        {{ option.display }}
      </option>
    </select>
  `,
})
export class CustomSelectEditorComponent {
  private params: any;
  public value: any;
  public options: { display: string; value: any }[] = [];

  agInit(params: any): void {
    this.params = params;
    this.value = this.params.value;
    this.options = Object.entries(this.params.options).map(
      ([display, value]) => ({ display, value })
    );
  }

  getValue(): any {
    return this.value;
  }

  onChange(value: any): void {
    this.value = value;
  }
}

// Ahora el componente principal
@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    CustomSelectEditorComponent,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent {
  components = {
    customSelectEditor: CustomSelectEditorComponent,
  };

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
  ) {}

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

  obtenerDatos() {
    this.usersService.getDataUsers().subscribe((data: any) => {
      this.rowData = Object.keys(data).map((key) => {
        return { id: key, ...data[key] };
      });
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
        field: 'displayName',
        headerName: 'Nombre',
        cellEditor: 'agTextCellEditor',
        editable: true,
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
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Mexico', 'USA', 'MEX-USA', 'Colombia', 'Chile', 'Otro'],
          valueListGap: 10,
        },
      },
      {
        field: 'emailu',
        headerName: 'Email',
        cellEditor: 'agTextCellEditor',
        editable: (params) => params.data.isNew,
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
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.departamentos, // Se usa cuando departamentos ya esté disponible
          valueListGap: 10,
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
        field: 'platform',
        headerName: 'Plataforma',
        cellEditor: 'customSelectEditor',
        cellEditorParams: {
          options: {
            Sí: 'si',
            No: 'no',
          },
        },
        cellRenderer: this.customSelectRenderer({ Sí: 'si', No: 'no' }),
        editable: true,
      },
      {
        field: 'project',
        headerName: 'Proyecto',
        cellEditor: 'customSelectEditor',
        cellEditorParams: {
          options: {
            Sí: 'si',
            No: 'no',
          },
        },
        cellRenderer: this.customSelectRenderer({ Sí: 'si', No: 'no' }),
        editable: true,
      },
      {
        field: 'branch',
        headerName: 'Branch',
        cellEditor: 'customSelectEditor',
        cellEditorParams: {
          options: {
            Sí: 'si',
            No: 'no',
          },
        },
        cellRenderer: this.customSelectRenderer({ Sí: 'si', No: 'no' }),
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
      // Aquí envío el correo a la signal
      this.usersService.emailSignal(this.selectedRowData.emailu);
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event) {
    console.log('Dato cambiado:', event.data);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every(
      (item) => item.displayName && item.emailu && item.password
    );

    if (!isValid) {
      alerts.basicAlert(
        'Añadir usuario',
        'Debe introducir un nombre de usuario, correo electrónico y contraseña.',
        'error'
      );
      return;
    }

    // Filtrar las filas nuevas usando nuestro registro de nuevas filas
    const newItems = this.rowData.filter((item) =>
      this.newlyAddedRows.includes(item.id)
    );

    let successfullyAdded = [];
    let failedToAdd = [];

    // Procesar nuevos usuarios primero
    if (newItems.length > 0) {
      for (const item of newItems) {
        // Enviamos los datos a FirebaseAuth y a la base de datos
        try {
          await this.enviarDatos(item.emailu, item.password);
          successfullyAdded.push(item);
        } catch (error) {
          if (error.code === 'auth/email-already-in-use') {
            failedToAdd.push(item);
            // Remover el item de rowData si el email ya está en uso
            this.rowData = this.rowData.filter((row) => row.id !== item.id);
            this.newlyAddedRows = this.newlyAddedRows.filter(
              (id) => id !== item.id
            );
          } else {
            // Para otros errores, detener el proceso
            alerts.basicAlert(
              'Error de registro',
              'Ocurrió un error al registrar nuevos usuarios. Por favor, intente nuevamente.',
              'error'
            );
            return;
          }
        }
      }
    }

    const sanitizedData = this.rowData.map(({ isNew, ...item }) => item);
    // Ahora actualizamos la base de datos con los datos filtrados
    const updates = sanitizedData.reduce((acc, item) => {
      const { id, ...data } = item;
      acc[id] = data;
      return acc;
    }, {});

    this.usersService.updateDataUsers(updates).subscribe((response) => {
      let updatedExistingUsers = false;

      // Verificar si se hicieron cambios en usuarios existentes
      if (newItems.length === 0 && Object.keys(updates).length > 0) {
        updatedExistingUsers = true;
      }

      this.showResultAlert(
        successfullyAdded,
        failedToAdd,
        updatedExistingUsers
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = []; // Limpiar el registro de nuevas filas después de guardar
      this.obtenerDatos(); // Refrescar los datos
    });
  }

  showResultAlert(
    successfullyAdded: any[],
    failedToAdd: any[],
    updatedExistingUsers: boolean
  ) {
    let message = '';
    if (successfullyAdded.length > 0) {
      message += `${successfullyAdded.length} usuario(s) añadido(s) correctamente. `;
    }
    if (failedToAdd.length > 0) {
      message += `${failedToAdd.length} usuario(s) no pudo(pudieron) ser añadido(s) debido a correos electrónicos duplicados.`;
    }
    if (updatedExistingUsers) {
      message += 'Cambios en usuarios existentes guardados correctamente.';
    }
    if (
      !updatedExistingUsers &&
      successfullyAdded.length === 0 &&
      failedToAdd.length === 0
    ) {
      message = 'No se realizaron cambios en los usuarios.';
    }

    let alertType: SweetAlertIcon = 'info';
    if (successfullyAdded.length > 0 && failedToAdd.length === 0) {
      alertType = 'success';
    } else if (failedToAdd.length > 0 || updatedExistingUsers) {
      alertType = 'warning';
    }

    alerts.basicAlert('Actualización de usuarios', message, alertType);
  }

  addRow() {
    const newId = this.generateUniqueId();
    const newItem = {
      id: newId,
      displayName: '',
      country: '',
      emailu: '',
      password: '',
      age: null,
      organization: '',
      phone: '',
      position: '',
      branch: 'no',
      project: 'no',
      platform: 'no',
      picture: './assets/img/profile.png',
      isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    // Añadir el ID de la nueva fila a nuestro registro
    this.newlyAddedRows.push(newId);
  }

  generateUniqueId() {
    return 'new-' + Math.random().toString(36).substr(2, 9);
  }

  async deleteUser() {
    try {
      const selectedNodes = this.gridApi.getSelectedNodes();
      if (selectedNodes.length === 0) {
        alerts.basicAlert(
          'Eliminar usuario',
          'Por favor, seleccione un usuario para eliminar.',
          'warning'
        );
        return;
      }

      const selectedData = selectedNodes[0].data;
      const id = selectedData.id;
      const email = selectedData.emailu;

      // Elimina al usuario de la DB de Firebase
      await this.usersService.deleteUsers(id).toPromise();
      // Elimina al usuario de Firebase Auth
      await this.authService.removeUserByEmail(email, selectedData.password);

      // Refrescar los datos después de eliminar
      this.obtenerDatos();

      alerts.basicAlert(
        'Eliminar usuario',
        'Usuario eliminado satisfactoriamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.selectedRowData = null;
    } catch (error) {
      alerts.basicAlert(
        'Eliminar usuario',
        'Error al eliminar el usuario.',
        'error'
      );
    }
  }

  // Aqui vamos a crear custom cell renders y editors para el select
  customSelectRenderer(options: { [key: string]: any }) {
    return (params: any) => {
      const value = params.value;
      for (const [display, optionValue] of Object.entries(options)) {
        if (value === optionValue) {
          return display;
        }
      }
      return value; // Valor por defecto si no se encuentra coincidencia
    };
  }

  // Y aquí llamamos a Firebase
  async enviarDatos(email: string, password: string): Promise<void> {
    console.log('Intentando registrar nuevo usuario:', email);
    try {
      const user = await this.authService.register(email, password);
      if (user) {
        console.log('Nuevo usuario registrado exitosamente:', email);
      } else {
        throw new Error('No se pudo registrar el usuario');
      }
    } catch (error) {
      console.error('Error al registrar nuevo usuario:', error);
      if (error.code === 'auth/email-already-in-use') {
        console.log('El correo electrónico ya está en uso:', email);
      } else {
        alerts.basicAlert(
          'Error de registro',
          'No se pudo registrar el nuevo usuario en el sistema de autenticación.',
          'error'
        );
      }
      throw error; // Re-throw the error to be caught in saveChanges
    }
  }
}
