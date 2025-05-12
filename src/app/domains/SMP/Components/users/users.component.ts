import { CommonModule } from '@angular/common';
import { Component, computed, effect, HostListener, inject, Injectable } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { UsersService } from 'app/services/users.service';
import { alerts } from 'app/helpers/alerts';
import { FormsModule } from '@angular/forms';
import { UsersProfileComponent } from "./users-profile.component";
import { catchError, concat, EMPTY, lastValueFrom, toArray, tap } from 'rxjs';
import { MatDialogModule } from '@angular/material/dialog';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { RolesService } from 'app/services/roles.service';

import { ImageHandlerService } from 'app/services/image-handler.service';
import { SignalsService } from 'app/services/signals.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { env } from 'echarts';
import { environment } from '@env/environment';

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

  idRoot: number;
  gridHeight: string = '80vh';
  newlyAddedRows: string[] = [];
  entrada: any;
  departamentos: any[] = [];
  position: any[] = [];
  rowData: any[] = [];
  paginationPageSize = 20; // Tamaño de página
  pagination = true; // Habilitar paginación
  notSavedChanges: boolean = false;
  paginationPageSizeSelector = false;
  id: string;
  userRoot: number = 0;
  authorizedPass:boolean = false;

  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private permissionType: string = 'root';

  private usersService        = inject(UsersService);
  private imageHandlerService = inject(ImageHandlerService);
  private usersxrootService   = inject(UsersxpermissionsService);

  private catalogService = inject(CatalogsService);
  private signalsService = inject(SignalsService);
  private rolesService   = inject(RolesService);  

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
    
    
  verification(): boolean {
  //const permissions = this.signalsService.getStoreFromPermissions();
  if(this.userRoot == 1){
    return this.authorizedPass = true;
  }
  return this.authorizedPass = false;
}


constructor() {
    effect(() => {
       this.idRoot = this.signalsService.getRootSelectedBySidebar()();
       this.userRoot = this.signalsService.getUserRoot()();
       this.obtenerDatos();
        this.getRoles();
      this.verification();
    })
}

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent
  }

  
  obtenerDatos() {
    const observer = {
      next: (response: any) => {
        if (response && response.code === 200 && response.data) {
          console.log('Response USER COMPONENT', response.data);

          this.rowData = response.data.map((item: any) => {
            return { id: item.id, ...item };
          });
          this.rowData = this.rowData.filter(row => row.active !== 0);
          console.log('RowData USER COMPONENT', this.rowData);
        } else {
          console.error('Respuesta inválida del servidor');
        }
      },
      error: (error) => {
        console.error('Error al obtener los datos:', error);
      }
    };

    if (this.signalsService.getemailChoose() === environment.root) {
      this.usersService.getAllUsers().subscribe(observer);
    } else {
      this.usersService.getDataUsers(this.idRoot).subscribe(observer);
    }
  }

  getRoles() {
     this.rolesService.getRoles(this.idRoot).subscribe(
      (data: any) => {
        this.departamentos = data.data;
        console.log('Roles:', this.departamentos);
      },
      (error) => {
        if (error.status == 404) this.departamentos = [];
        console.error('Error fetching data:', error);
      }
    );
  }

  // Se modifica el getDepartmentName para que devuelva el nombre del departamento
  getDepartmentName(idDepartament: number): string {
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
        headerName: 'Nombre *',
        editable: true,
        filter: true,
        cellEditor: 'autocompleteEditor',
        flex: 1,
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

          params.data[params.colDef.field] = params.newValue.toUpperCase();
          return true;
        }
      },
      {
        field: 'email',
        headerName: 'Email *',
        cellEditor: 'agTextCellEditor',
        flex: 1,
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
     /*  {
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
      },*/
      {
        headerName: 'Contraseña *',
        field: 'password',
        flex:1,
        cellRenderer: (params: any) => {
          return `<span>••••••••</span>`;
        },
        
        editable: this.authorizedPass,
      },
      {
        field: 'idDepartament',
        headerName: 'Rol de Usuario',
        editable: true,
        suppressMovable: true,
        filter: false,
        flex: 1,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params) => {
          // Ensure depto data is available when creating editor
          return {
            values: this.departamentos ? this.departamentos.map((item) => item.id) : []
          };
        },
        valueFormatter: (params) => {
          // Handle potential null values and properly format the displayed value
          if (!params.value) return '';

          const foundDepto = this.departamentos
            ? this.departamentos.find((item) => item.id === params.value)
            : null;

          return foundDepto ? foundDepto.description : params.value;
        },
      },
     /*  {
        field: 'phone',
        headerName: 'Teléfono',
        cellEditor: 'agTextCellEditor',
        editable: true,
      }, */
      {
        field: 'picture',
        headerName: 'Imagen de perfil',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: {
          clicked: this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService),
          field: 'picture'
        },
        editable: false,
        flex: 1
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
        flex: 1
      },
      /*{
        field: 'isRoot',
        headerName: 'Root',
        cellEditor: 'agTextCellEditor',
        editable: true,
        width: 90
      } */
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
    // console.log('Dato cambiado:', event.data);
    // Aquí envío todo a la signal
    this.enviarSignal();
    this.notSavedChanges = true;
    if (!event.data.__isNew) {
      event.data.__modified = true;
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
      idRol: 0,
      age: 0,
      id_company: this.idRoot,
      idDepartament: 1,
      phone: '',
      id_position: 0,
      picture: './assets/img/profile.png',
      signature: '',
      usersmall: 'SINUSER',
      allowWhatsapp: true,
      isRoot: true,
      __isNew: true
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    setTimeout(() => {
      const firstRowIndex = 0;
  
      this.gridApi.ensureIndexVisible(firstRowIndex);
  
      this.gridApi.startEditingCell({
        rowIndex: firstRowIndex,
        colKey: 'displayName'
      });
    }, 0);
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

    console.log  ('Nuevas filas:', newRows);

    try {
      // Primero creamos/actualizamos los usuarios
      const addUserRequests = newRows.map(row => {
        const cleanedData = this.cleanDataForServer(row);
        console.log('this Add CleanedData', cleanedData);
        return this.usersService.addUser(cleanedData).pipe(
          tap(response => {
            console.log('Respuesta directa del addUser:', {
              posiblesIds: {
                id: response.data?.id
              }
            });
          })
        );
      });

      const updateUserRequests = modifiedRows.map(row => {
        const cleanedData = this.cleanDataForServer(row);
        console.log('Update CleanedData', cleanedData);
        return this.usersService.updateUser(row.id, cleanedData);
      });

      // Ejecutamos primero las operaciones de usuario
      console.log('Ejecutando solicitudes de usuario...');
      const userResponses = await lastValueFrom(
        concat(...addUserRequests, ...updateUserRequests).pipe(toArray())
      );

      console.log('Respuestas de usuario:', userResponses);

      // Para los nuevos usuarios, guardamos sus permisos
      const newUserResponses = userResponses.slice(0, newRows.length);
      console.log('Nuevos usuarios creados:', newUserResponses);

      // Creamos los permisos para los nuevos usuarios
      const permissionRequests = newUserResponses.map((response, index) => {
        const userId = response.data?.id;

        if (!userId) {
          console.warn('No se pudo obtener el ID del usuario para:', response);
          return null;
        }

        const formattedRoot = {
          idUser: userId,
          idPermission: this.signalsService.getRootSelectedBySidebar()(),
          type: "root",
          description: "SIN DESCRIPCION",
          active: 1
        };

        // Array para almacenar las peticiones
        const requests = [this.usersxrootService.addUserxPermission(formattedRoot)];

        // Solo añadir el permiso de branch si el ID es positivo
        const branchId = this.signalsService.getBranchSelectedBySidebar()();
        if (branchId > 0) {
          const formattedBranch = {
            idUser: userId,
            idPermission: branchId,
            type: "branch",
            description: "SIN DESCRIPCION",
            active: 1
          };
          console.log('Datos de permiso branch a guardar:', formattedBranch);
          requests.push(this.usersxrootService.addUserxPermission(formattedBranch));
        }

        console.log('Datos de permiso root a guardar:', formattedRoot);
        return requests;
      }).filter(req => req !== null);

      // Ejecutamos las solicitudes de permisos
      if (permissionRequests.length > 0) {
        console.log('Ejecutando solicitudes de permisos, cantidad:', permissionRequests.length * 2);
        const permissionResponses = await lastValueFrom(
          concat(...permissionRequests.flat()).pipe(toArray())
        );
        console.log('Respuestas de permisos:', permissionResponses);
      } else {
        console.warn('No se crearon solicitudes de permisos');
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );

      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      this.obtenerDatos(); // Refrescar los datos
    } catch (error) {
      console.error('Error al guardar:', error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
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

    if (selectedData.isRoot === 1) {
      alerts.basicAlert(
        'Eliminar entrada',
        'No se puede eliminar un usuario administrador',
        'error'
      );
      return;
    }

    // Mostrar mensaje de confirmación
    alerts.confirmAlert(
      'Eliminar empleado',
      '¿Está seguro que desea eliminar este usuario?',
      'warning',
      'Sí, eliminar'
    ).then((value) => {
      if (value.isConfirmed) {
        // Eliminar el usuario
        console.log('SelectedData', selectedData);
        selectedData.active = 0;
        console.log('SelectedData', selectedData);
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
    });
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
