import { CommonModule } from '@angular/common';
import { Component, computed, effect, HostListener, inject, Injectable } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { UsersService } from 'app/services/users.service';
import { alerts } from 'app/helpers/alerts';
import { FormsModule } from '@angular/forms';
import { catchError, concat, EMPTY, lastValueFrom, toArray, tap } from 'rxjs';
import { MatDialogModule } from '@angular/material/dialog';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { RolesService } from 'app/services/roles.service';
import { EmployeesService } from 'app/services/employees.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { SignalsService } from 'app/services/signals.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { env } from 'echarts';
import { AuthService } from 'app/services/auth.service';
import { environment } from '@env/environment';
import { TrackingService } from 'app/services/tracking.service';
import { DetailPermissionsRendererComponent } from './details/detail-permissions-renderer.component';

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
    MatDialogModule,
    DetailPermissionsRendererComponent
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
  isAdvanced: boolean = false;
  paginationPageSize = 20; // Tamaño de página
  pagination = true; // Habilitar paginación
  notSavedChanges: boolean = false;
  paginationPageSizeSelector = false;
  id: string;
  userRoot: number = 0;
  authorizedPass:boolean = false;
  dataEmpleado: any = null;
  empleadoCatalgos: any[] = [];
  idUser: number = null;

  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private permissionType: string = 'root';

  private usersService        = inject(UsersService);
  private imageHandlerService = inject(ImageHandlerService);
  private usersxrootService   = inject(UsersxpermissionsService);
  private trackingService = inject(TrackingService);
  private catalogService = inject(CatalogsService);
  private signalsService = inject(SignalsService);
  private rolesService   = inject(RolesService);  
  private employeeService = inject(EmployeesService);
  authService = inject(AuthService);

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
       this.idUser = this.signalsService.getIdUSer()();
       this.userRoot = this.signalsService.getUserRoot()();
       this.isAdvanced = this.signalsService.getIsAdvanced();
       this.obtenerDatos();
        this.getRoles();
      this.verification();
      this.obtenerEmpleados();
      if(this.signalsService.getRefresSecurity()()){  
        this.obtenerDatos();
        this.signalsService.setRefresSecurity(false);
      }
    })
}

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
    detailPermissionsRenderer: DetailPermissionsRendererComponent
  }
  obtenerEmpleados() {
    return new Promise((resolve) => {
      this.employeeService.getEmployeesVigente(-this.idRoot).subscribe(
        (data: any) => {
          this.empleadoCatalgos = data;
          console.log(this.empleadoCatalgos)
         // console.log('Datos obtenidos del servidor:', this.empleadoCatalgos);

          // Actualizar el grid y esperar a que termine
          this.gridApi.setGridOption('rowData', this.rowData);

          // Dar tiempo al grid para actualizar los datos
          setTimeout(() => {
            resolve(true);
          }, 100);
        },
        (error) => {
          console.error('Error fetching data:', error);
          resolve(false);
        }
      );
    });
  }
  
  obtenerDatos() {
    const observer = {
      next: (response: any) => {
        if (response && response.code === 200 && response.data) {
          console.log('Response USER COMPONENT', response.data);
          if(this.authService.getCrudPermission('setup', 'users', 'read')){
          this.rowData = response.data.map((item: any) => {
            return { id: item.id, ...item };
          });
          this.rowData = this.rowData.filter(row => row.active !== 0);
          }
          console.log('RowData USER COMPONENT', this.rowData);
        } else {
          console.error('Respuesta inválida del servidor');
        }
        this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Usuarios', 'Menu Recursos Humanos Usuarios',  this.trackingService.getEmail());
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
    const department = this.departamentos.find(dept => dept.id === idDepartament);
    console.log('Department:', department);
    return department ? department.description : 'Departamento no encontrado';
  }
  procesoData(userId: number){
    if (this.dataEmpleado && this.dataEmpleado.idBranch) {
      const sucursal =
      {
        "idUser": userId,
        "idPermission": this.dataEmpleado.idBranch,
        "type": "branch",
        "description": null,
        "active": 1
      }
      console.log('Adding branch permission from employee data:', sucursal);
      return this.usersxrootService.addUserxPermission(sucursal);
    }
    return null; // No hay datos de empleado o sucursal para procesar
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    headerHeight: 30,
    rowHeight: 30,
    masterDetail: true,
    isRowMaster: (dataItem) => {
      return true; // Todas las filas pueden tener detalles de permisos
    },
    detailCellRenderer: 'detailPermissionsRenderer',
    detailRowHeight: 600,
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
        field: 'id',
        headerName: 'ID',
        hide: true,
        filter: 'agNumberColumnFilter',
        width: 80
      },
      {
        field: 'active',
        hide: true
      },
      {
        field: 'displayName',
        headerName: 'Nombre *',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('setup', 'users', 'update');
        },
        filter: true,
        cellEditor: 'autocompleteEditor',
        flex: 1,
        cellEditorParams: {
          filterList: this.empleadoCatalgos.map(e => e.name),
          filterKey: 'name',
          placeholder: 'Nombre',
          minLength: 1
        },
        valueSetter: (params) => {
          const newValue = params.newValue?.toUpperCase() ?? '';
        
          const duplicateExists = this.rowData.some((row, index) =>
            index !== params.node.rowIndex && row.displayName === newValue
          );
        
          if (duplicateExists) {
            alerts.basicAlert(
              'Nombre duplicado',
              'Ya existe un usuario con ese nombre.',
              'error'
            );
            return false;
          }
          const empleadoInfo = this.empleadoCatalgos?.find(
            (item) => item.name.toUpperCase() === newValue
          );
          if (empleadoInfo) {
            this.dataEmpleado = empleadoInfo;
            params.data.idRol = 1;
          }else{
            this.dataEmpleado = null;
            params.data.idRol = 0;
          }
          console.log('Empleado encontrado:', this.dataEmpleado);
          params.data[params.colDef.field] = newValue;
          return true;
        }
        
      },
      {
        field: 'email',
        headerName: 'Email *',
        cellEditor: 'agTextCellEditor',
        flex: 1,
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('setup', 'users', 'update');
        },
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
        
        //editable: this.authorizedPass,
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('setup', 'users', 'update');
        },
      },
      /*{
        field: 'idDepartament',
        headerName: 'Security',
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
        // Tooltip personalizado que muestra todos los roles con colores
        tooltipValueGetter: (params: any) => {
          if (!this.departamentos || this.departamentos.length === 0) {
            return 'No hay roles disponibles';
          }
          
          let tooltip = 'Roles Disponibles:\n\n';
          this.departamentos.forEach((role, index) => {
            const colorEmoji = this.getRoleColorEmoji(role.id);
            tooltip += `${colorEmoji} ${role.description}\n`;
          });
          
          const currentRole = this.departamentos.find((item) => item.id === params.value);
          if (currentRole) {
            const currentEmoji = this.getRoleColorEmoji(currentRole.id);
            tooltip += `\nRol actual: ${currentEmoji} ${currentRole.description}`;
          } else {
            tooltip += '\nRol actual: Sin asignar';
          }
          
          return tooltip;
        },
        // Asignacion de permisos por usuario es en roles
        valueFormatter: (params) => {
          // Handle potential null values and properly format the displayed value
          if (!params.value) return '';

          const foundDepto = this.departamentos
            ? this.departamentos.find((item) => item.id === params.value)
            : null;

          return foundDepto ? foundDepto.description : params.value;
        },
      },*/
      {
        field: 'idRol',
        headerName: 'Security',
        hide: !this.isAdvanced && this.idUser !== 42,
        //cellRenderer: () => 'Ver Permisos', // Opcional: Mostrar texto en la celda
        cellStyle: { backgroundColor: '#d4edda' },
        onCellClicked: this.togglePermissions.bind(this)

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
        cellRendererParams: (params) => {
          const canEditImage = params.data.__isNew || this.authService.getCrudPermission('setup', 'users', 'update');
          return {
          clicked: canEditImage ? this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService) : null,
          field: 'picture'
          };
        },
        editable: false,
        flex: 1
      },
      {
        field: 'signature',
        headerName: 'Firma',
        cellRenderer: this.imageHandlerService.imageCellRenderer.bind(this.imageHandlerService),
        cellRendererParams: (params) => {
          const canEditImage = params.data.__isNew || this.authService.getCrudPermission('setup', 'users', 'update');
          return {
            clicked: canEditImage ? this.imageHandlerService.onImageCellClicked.bind(this.imageHandlerService) : null,
            field: 'signature'
          };
        },
        editable: false,
        flex: 1
      },
      {
        field: 'isRoot',
        headerName: 'Root',
        //cellEditor: 'agTextCellEditor',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return this.authService.getCrudPermission('setup', 'users', 'update');
        },
        width: 90,
        hide: !this.authorizedPass
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
      if(!this.isAdvanced){
        this.enviarSignal();
      }
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    if (!event.node.isSelected()) {
      event.node.setSelected(true);
    }
    
    this.notSavedChanges = true;

    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
  
    // Solo actuar si se cambió el nombre
    if (event.colDef.field === 'displayName') {
      const selectedName = event.newValue?.toUpperCase();
  
      const empleadoInfo = this.empleadoCatalgos?.find(
        (item) => item.name.toUpperCase() === selectedName
      );
  
      if (empleadoInfo) {
        // Rellenar datos relacionados
        event.data.idEmployee = empleadoInfo.id;
        event.data.email = empleadoInfo.email;
      } else {
        // Si el nombre ya no está en catálogo, limpia
        event.data.idEmployee = null;
        event.data.idBranch = null;
      }
      if (this.selectedRowData) {
        this.enviarSignal();
      }
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
      isRoot: false,
      __isNew: true
    };

    this.rowData = [newItem, ...this.rowData];
    this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Usuarios', 'Menu Administracion Usuarios',  this.trackingService.getEmail());
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
        this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Usuarios', 'Menu Administracion Usuarios',  this.trackingService.getEmail());
        
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
        this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Usuarios', 'Menu Administracion Usuarios',  this.trackingService.getEmail());
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

        // Añadir permiso de branch desde datos de empleado si existe
        const branchPermissionFromEmployee = this.procesoData(userId);
        if (branchPermissionFromEmployee) {
          requests.push(branchPermissionFromEmployee);
        } else { // Si no, añadir desde el sidebar si el ID es positivo
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

    if (selectedData.isRoot === 1 || selectedData.isRoot === true) {
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
              this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Registro en Usuarios', 'Menu Administracion Usuarios',  this.trackingService.getEmail());
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
    this.trackingService.addLog(this.trackingService.getnameComp(),'Revertir Registro en Usuarios', 'Menu Administracion Usuarios',  this.trackingService.getEmail());
  }

  togglePermissions() {
    const selectedNodes = this.gridApi.getSelectedNodes();

    if (selectedNodes.length === 0) {
      alerts.basicAlert(
        'Permisos',
        'Por favor, seleccione un usuario para ver sus permisos.',
        'warning'
      );
      return;
    }

    const selectedNode = selectedNodes[0];
    const selectedData = selectedNode.data;
    const isCurrentlyExpanded = selectedNode.expanded;

    if (isCurrentlyExpanded) {
      // Si está expandido, colapsar y limpiar el filtro
      selectedNode.setExpanded(false);
      this.gridApi.setFilterModel(null);
      this.gridApi.onFilterChanged();

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Ocultar Permisos',
        'Menu Administracion Usuarios',
        this.trackingService.getEmail()
      );
    } else {
      // Si no está expandido, colapsar otros, aplicar filtro y expandir

      // Colapsar todas las demás filas
      this.gridApi.forEachNode((node) => {
        if (node.expanded) {
          node.setExpanded(false);
        }
      });

      // Limpiar filtro previo
      this.gridApi.setFilterModel(null);

      // Aplicar filtro para mostrar solo el usuario seleccionado
      const filterModel = {
        id: {
          filterType: 'number',
          type: 'equals',
          filter: selectedData.id
        }
      };

      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();

      // Expandir después de aplicar el filtro
      setTimeout(() => {
        selectedNode.setExpanded(true);
      }, 50);

      this.trackingService.addLog(
        this.trackingService.getnameComp(),
        'Mostrar Permisos',
        'Menu Administracion Usuarios',
        this.trackingService.getEmail()
      );
    }
  }

  getRoleColorEmoji(roleId: number): string {
    // Asignar emojis de colores consistentes basados en el ID del rol
    const colorEmojis = [
      '🔵', // Azul
      '🟢', // Verde
      '🔴', // Rojo
      '🟡', // Amarillo
      '🟣', // Púrpura
      '🟠', // Naranja
      '🟦', // Turquesa
      '🩷', // Rosa
      '⚫', // Gris/Negro
      '🟦', // Cian
      '⚪', // Claro
      '🟤'  // Marrón
    ];
    
    // Usar el ID del rol para seleccionar un emoji de forma consistente
    return colorEmojis[roleId % colorEmojis.length];
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
