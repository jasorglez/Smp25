import { CommonModule } from '@angular/common';
import { Component, computed, effect, HostListener, inject, Injectable, OnDestroy } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { UsersService } from 'app/services/users.service';
import { alerts } from 'app/helpers/alerts';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { catchError, concat, EMPTY, lastValueFrom, toArray, tap, Observable, from, mergeMap, Subscription } from 'rxjs';
import { MatDialogModule } from '@angular/material/dialog';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { RolesService } from 'app/services/roles.service';
import { EmployeesService } from 'app/services/employees.service';
import { ImageHandlerService } from 'app/services/image-handler.service';
import { SignalsService } from 'app/services/signals.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { AuthService } from 'app/services/auth.service';
import { environment } from '@env/environment';
import { PermitionsService } from 'app/services/permitions.service';
import { TrackingService } from 'app/services/tracking.service';
import { DetallePermisosXSucursalesComponent } from './details/detallepermisosxsucursales.component';
import { PermissionsViewByUserComponent } from './details/detail-permissions-user/permissions-view.component';
import { ModalService } from 'app/services/permissions-modal.service';

@Injectable({
  providedIn: 'root',
})

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    MatDialogModule,
    DetallePermisosXSucursalesComponent,
    PermissionsViewByUserComponent,
    ReactiveFormsModule
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnDestroy {

  idRoot: number;
  gridHeight: string = '80vh';
  newlyAddedRows: string[] = [];
  entrada: any;
  departamentos: any[] = [];
  position: any[] = [];
  rowData: any[] = [];
  
  paginationPageSize = 20;
  pagination = true;
  notSavedChanges: boolean = false;
  paginationPageSizeSelector = false;
  id: string;
  userRoot: number = 0;
  authorizedPass: boolean = false;
  dataEmpleado: any = null;
  empleadoCatalgos: any[] = [];
  idUser: number = null;
  isAdvanced: boolean = false;
  invited: boolean = false;

  // --- Modal ---
  showPermissionsModal: boolean = false;
  modalUserName: string = '';
  modalPermissions: { idUser: number, idBranch: number, idRole: number, idPosicion: number } | null = null;
  private modalSubscription: Subscription;

  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private permissionType: string = 'root';

  private editableColumnOrder = ['displayName', 'email', 'password', 'isRoot'];
  private enterPressed: boolean = false;

  private usersService        = inject(UsersService);
  private imageHandlerService = inject(ImageHandlerService);
  private usersxrootService   = inject(UsersxpermissionsService);
  private trackingService     = inject(TrackingService);
  private catalogService      = inject(CatalogsService);
  private signalsService      = inject(SignalsService);
  private rolesService        = inject(RolesService);  
  private employeeService     = inject(EmployeesService);
  private permitionsService   = inject(PermitionsService);
  private modalService        = inject(ModalService);
  authService                 = inject(AuthService);

  profile = computed(() => this.signalsService.profile);

  enviarSignal() {
    const departmentName = this.getDepartmentName(this.selectedRowData.idDepartament);
    this.signalsService.profileSignal(
      this.selectedRowData.id,
      this.selectedRowData.email,
      this.selectedRowData.picture,
      this.selectedRowData.displayName,
      departmentName,
      this.selectedRowData.position
    );
    this.signalsService.nameCompany.set(null);
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  verification(): boolean {
    if (this.userRoot == 1) {
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
      this.invited = this.signalsService.getInvited()();
      if (this.gridApi) {
        const showSecurity = this.isAdvanced || this.idUser === 42 || this.idRoot === 9;
        this.gridApi.setColumnsVisible(['idRol'], showSecurity);
      }
      this.obtenerDatos();
      this.getRoles();
      this.verification();
      this.obtenerEmpleados();
      if (this.signalsService.getRefresSecurity()()) {
        this.obtenerDatos();
        this.signalsService.setRefresSecurity(false);
      }
    });

    // Suscripción al modal service para abrir el modal desde componentes hijos
    this.modalSubscription = this.modalService.openPermissions$.subscribe(data => {
      this.modalPermissions = {
        idUser: data.idUser,
        idBranch: data.idBranch,
        idRole: data.idRole,
        idPosicion: data.idPosicion,
      };
      this.modalUserName = data.userName;
      this.showPermissionsModal = true;
    });
  }

  ngOnDestroy(): void {
    this.modalSubscription?.unsubscribe();
  }

  closePermissionsModal() {
    this.showPermissionsModal = false;
    this.modalPermissions = null;
    this.modalUserName = '';
  }

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
    detailPermissionsRenderer: DetallePermisosXSucursalesComponent
  }

  obtenerEmpleados() {
    return new Promise((resolve) => {
      this.employeeService.getEmployeesVigente(-this.idRoot).subscribe(
        (data: any) => {
          this.empleadoCatalgos = data;
          console.log(this.empleadoCatalgos);
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
          this.rowData = response.data.map((item: any) => {
            return { id: item.id, ...item };
          });
          this.rowData = this.rowData.filter(row => row.active !== 0);
          console.log('RowData USER COMPONENT', this.rowData);
        } else {
          console.error('Respuesta inválida del servidor');
        }
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Get Registro en Usuarios',
          'Menu Recursos Humanos Usuarios',
          this.trackingService.getEmail()
        );
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

  getDepartmentName(idDepartament: number): string {
    const department = this.departamentos.find(dept => dept.id === idDepartament);
    console.log('Department:', department);
    return department ? department.description : 'Departamento no encontrado';
  }

  procesoData(userId: number): Observable<any> {
    console.log('+++++++++++++++++', this.dataEmpleado);
    if (!this.dataEmpleado || !this.dataEmpleado.idBranch) {
      console.warn('No hay datos válidos de empleado o sucursal.');
      return EMPTY;
    }

    const sucursal = {
      idUser: userId,
      idPermission: this.dataEmpleado.idBranch,
      type: 'branch',
      description: null,
      active: 1
    };

    const addBranchPermission$ = this.usersxrootService.addUserxPermission(sucursal);

    const addDetailedPermissions$ = from(this.getCRUD(this.dataEmpleado.idPosition)).pipe(
      mergeMap(rolesDefinidos => {
        if (!rolesDefinidos || rolesDefinidos.length === 0) {
          console.warn('No se encontraron permisos definidos para esta posición.');
          return EMPTY;
        }
        const detailObservables = rolesDefinidos.map(permiso => {
          const detailData = {
            idUser: userId,
            idBranch: this.dataEmpleado.idBranch,
            idRole: this.dataEmpleado.idDepto,
            idPosicion: this.dataEmpleado.idPosition,
            idDetailedPermission: permiso.idDetailedPermission,
            canCreate: permiso.canCreate,
            canRead: permiso.canRead,
            canUpdate: permiso.canUpdate,
            canDelete: permiso.canDelete,
            active: permiso.active
          };
          console.log('Agregando permiso:', detailData);
          return this.permitionsService.addPermitionsDetail(detailData);
        });
        return concat(...detailObservables);
      })
    );

    return concat(addBranchPermission$, addDetailedPermissions$);
  }

  getCRUD(idPosicion: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.rolesService.getCatalogCRUD(idPosicion).subscribe({
        next: (data: any) => {
          console.log(data);
          resolve(data || []);
        },
        error: (error) => {
          if (error.status === 404) {
            resolve([]);
          } else {
            console.error('Error fetching posiciones:', error);
            reject(error);
          }
        }
      });
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('columnDefs', this.columnDefs);
    const showSecurity = this.isAdvanced || this.idUser === 42 || this.idRoot === 9;
    this.gridApi.setColumnsVisible(['idRol'], showSecurity);
  }

  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const currentIndex = this.editableColumnOrder.indexOf(event.column.getColId());
    if (currentIndex !== -1 && currentIndex < this.editableColumnOrder.length - 1) {
      setTimeout(() => {
        this.gridApi.startEditingCell({
          rowIndex: event.rowIndex,
          colKey: this.editableColumnOrder[currentIndex + 1]
        });
      }, 100);
    }
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
    rowHeight: 30,
    masterDetail: true,
    isRowMaster: (dataItem) => {
      return true;
    },
    detailCellRenderer: 'detailPermissionsRenderer',
    detailRowHeight: 1000,
    rowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
    onRowClicked: (event) => {
      event.node.setSelected(true);
    },
    onRowSelected: (event) => {
      if (event.node.isSelected()) {
        this.gridApi.forEachNode((node) => {
          if (node.id !== event.node.id) {
            node.setSelected(false);
          }
        });
      }
    },
  };

  private _columnDefs: ColDef[] = [];

  get columnDefs(): ColDef[] {
    if (this._columnDefs.length > 0) {
      return this._columnDefs;
    }

    this._columnDefs = [
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
          return true;
        },
        filter: true,
        cellEditor: 'autocompleteEditor',
        flex: 1,
        cellEditorParams: (params) => ({
          filterList: this.empleadoCatalgos.map(e => e.name),
          filterKey: 'name',
          placeholder: 'Nombre',
          minLength: 1,
          onEnterPressed: () => { this.enterPressed = true; }
        }),
        valueSetter: (params) => {
          const newValue = params.newValue?.toUpperCase() ?? '';
          const duplicateExists = this.rowData.some((row, index) =>
            index !== params.node.rowIndex && row.displayName === newValue
          );
          if (duplicateExists) {
            alerts.basicAlert('Nombre duplicado', 'Ya existe un usuario con ese nombre.', 'error');
            return false;
          }
          const empleadoInfo = this.empleadoCatalgos?.find(
            (item) => item.name.toUpperCase() === newValue
          );
          if (empleadoInfo) {
            this.dataEmpleado = empleadoInfo;
            params.data.idRol = 1;
          } else {
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
          return true;
        },
        cellEditorParams: {
          useFormatter: true,
        },
        valueFormatter: (params) => params.value,
        valueSetter: (params) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(params.newValue)) {
            const duplicateExists = this.rowData.some((row, index) =>
              index !== params.node.rowIndex && row.email === params.newValue
            );
            if (duplicateExists) {
              alerts.basicAlert('Añadir usuario', 'Ya existe un usuario con ese correo electrónico.', 'error');
              return false;
            }
            params.data[params.colDef.field] = params.newValue;
            return true;
          } else {
            alerts.basicAlert('Editar usuario', 'Correo electrónico no válido.', 'error');
            return false;
          }
        },
        filter: true
      },
      {
        headerName: 'Contraseña *',
        field: 'password',
        flex: 1,
        cellRenderer: (params: any) => {
          return `<span>••••••••</span>`;
        },
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
      },
      {
        field: 'idRol',
        headerName: 'Security',
        hide: !this.isAdvanced && this.idUser !== 42,
        cellStyle: { backgroundColor: '#d4edda' },
        onCellClicked: this.togglePermissions.bind(this)
      },
      {
        field: 'isRoot',
        headerName: 'Root',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true;
        },
        width: 90,
      },
      {
        field: 'picture',
        headerName: 'Imagen de perfil',
        cellRenderer: (params) => {
          const imgSrc = params.value || './assets/img/profile.png';
          return `<img src="${imgSrc}" style="width: 50px; height: 50px; object-fit: cover; cursor: pointer;" title="Clic para cambiar imagen"/>`;
        },
        onCellClicked: (params) => {
          setTimeout(() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/jpeg,image/png,image/gif,image/webp';
            input.style.display = 'none';
            document.body.appendChild(input);
            input.onchange = (event) => {
              const file = (event.target as HTMLInputElement).files?.[0];
              if (file) {
                if (file.size > 5 * 1024 * 1024) {
                  alerts.basicAlert('Archivo muy grande', 'La imagen no puede superar 5MB', 'error');
                  document.body.removeChild(input);
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  params.data.picture = reader.result as string;
                  params.data.__modified = true;
                  this.gridApi.refreshCells({ rowNodes: [params.node] });
                  this.notSavedChanges = true;
                };
                reader.onerror = () => {
                  alerts.basicAlert('Error', 'No se pudo leer la imagen', 'error');
                };
                reader.readAsDataURL(file);
              }
              document.body.removeChild(input);
            };
            input.click();
          }, 0);
        },
        editable: false,
        flex: 1
      },
      {
        field: 'signature',
        headerName: 'Firma',
        cellRenderer: (params) => {
          const imgSrc = params.value || '';
          if (imgSrc) {
            return `<img src="${imgSrc}" style="width: 100px; height: 50px; object-fit: contain; cursor: pointer;" title="Clic para cambiar firma"/>`;
          } else {
            return `<div style="width: 100px; height: 50px; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Clic para agregar firma">Firma</div>`;
          }
        },
        onCellClicked: (params) => {
          setTimeout(() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/jpeg,image/png,image/gif,image/webp';
            input.style.display = 'none';
            document.body.appendChild(input);
            input.onchange = (event) => {
              const file = (event.target as HTMLInputElement).files?.[0];
              if (file) {
                if (file.size > 2 * 1024 * 1024) {
                  alerts.basicAlert('Archivo muy grande', 'La firma no puede superar 2MB', 'error');
                  document.body.removeChild(input);
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  params.data.signature = reader.result as string;
                  params.data.__modified = true;
                  this.gridApi.refreshCells({ rowNodes: [params.node] });
                  this.notSavedChanges = true;
                };
                reader.onerror = () => {
                  alerts.basicAlert('Error', 'No se pudo leer la imagen', 'error');
                };
                reader.readAsDataURL(file);
              }
              document.body.removeChild(input);
            };
            input.click();
          }, 0);
        },
        editable: false,
        flex: 1
      }
    ];

    return this._columnDefs;
  }

  selectedRowData: any = null;

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      if (!this.isAdvanced) {
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
    if (event.colDef.field === 'displayName') {
      const selectedName = event.newValue?.toUpperCase();
      const empleadoInfo = this.empleadoCatalgos?.find(
        (item) => item.name.toUpperCase() === selectedName
      );
      if (empleadoInfo) {
        event.data.idEmployee = empleadoInfo.id;
        event.data.email = empleadoInfo.email;
      } else {
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
      invited: false,
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
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Add Registro en Usuarios',
      'Menu Administracion Usuarios',
      this.trackingService.getEmail()
    );
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
    const newRows = this.rowData.filter(row => row.__isNew);
    const modifiedRows = this.rowData.filter(row => row.__modified && !row.__isNew);

    const invalidNewRows = newRows.filter(item =>
      !item.displayName || !item.email || !item.password
    );

    if (invalidNewRows.length > 0) {
      const invalidRow = invalidNewRows[0];
      let missingFields = [];
      if (!invalidRow.displayName) missingFields.push('Nombre');
      if (!invalidRow.email) missingFields.push('Correo electrónico');
      if (!invalidRow.password) missingFields.push('Contraseña');
      alerts.basicAlert('Validación - Nuevo Usuario', `Faltan campos obligatorios: ${missingFields.join(', ')}`, 'error');
      return;
    }

    const invalidModifiedRows = modifiedRows.filter(item =>
      !item.displayName || !item.email
    );

    if (invalidModifiedRows.length > 0) {
      const invalidRow = invalidModifiedRows[0];
      let missingFields = [];
      if (!invalidRow.displayName) missingFields.push('Nombre');
      if (!invalidRow.email) missingFields.push('Correo electrónico');
      alerts.basicAlert('Validación - Usuario Modificado', `Faltan campos obligatorios: ${missingFields.join(', ')}`, 'error');
      return;
    }

    console.log('=== INICIANDO GUARDADO ===');
    console.log('Nuevos registros:', newRows.length);
    console.log('Registros modificados:', modifiedRows.length);

    try {
      const addUserRequests = newRows.map((row, index) => {
        const cleanedData = this.cleanDataForServer(row);
        console.log(`[${index}] this Add CleanedData:`, cleanedData);
        if (!cleanedData.password || cleanedData.password.trim() === '') {
          console.error(`[${index}] ERROR: El password está vacío o es nulo`);
        }
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Add Registro en Usuarios',
          'Menu Administracion Usuarios',
          this.trackingService.getEmail()
        );
        return this.usersService.addUser(cleanedData).pipe(
          tap(response => {
            console.log(`[${index}] Respuesta directa del addUser:`, response);
            if (response.code !== 200 || !response.data?.id) {
              console.error(`[${index}] ERROR: Respuesta inválida del servidor:`, response);
              throw new Error(`Error del servidor: ${response.message || 'Respuesta inválida'}`);
            }
          })
        );
      });

      const updateUserRequests = modifiedRows.map(row => {
        const cleanedData = this.cleanDataForServer(row);
        console.log('Update CleanedData', cleanedData);
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Update Registro en Usuarios',
          'Menu Administracion Usuarios',
          this.trackingService.getEmail()
        );
        return this.usersService.updateUser(row.id, cleanedData);
      });

      console.log('Ejecutando solicitudes de usuario...');
      const userResponses = await lastValueFrom(
        concat(...addUserRequests, ...updateUserRequests).pipe(toArray())
      );

      console.log('Respuestas de usuario:', userResponses);

      const newUserResponses = userResponses.slice(0, newRows.length);
      console.log('Nuevos usuarios creados:', newUserResponses);

      const permissionRequests = newUserResponses.map((response, index) => {
        const userId = response.data?.id;
        if (!userId) {
          console.warn('No se pudo obtener el ID del usuario para:', response);
          return null;
        }

        const formattedRoot = {
          idUser: userId,
          idPermission: this.signalsService.getRootSelectedBySidebar()(),
          type: 'root',
          description: 'SIN DESCRIPCION',
          active: 1
        };

        const requests = [this.usersxrootService.addUserxPermission(formattedRoot)];

        const branchPermissionFromEmployee = this.procesoData(userId);
        if (branchPermissionFromEmployee && branchPermissionFromEmployee !== EMPTY) {
          requests.push(branchPermissionFromEmployee);
        } else {
          const branchId = this.signalsService.getBranchSelectedBySidebar()();
          if (branchId > 0) {
            const formattedBranch = {
              idUser: userId,
              idPermission: branchId,
              type: 'branch',
              description: 'SIN DESCRIPCION',
              active: 1
            };
            console.log('Datos de permiso branch a guardar:', formattedBranch);
            requests.push(this.usersxrootService.addUserxPermission(formattedBranch));
          }
        }

        console.log('Datos de permiso root a guardar:', formattedRoot);
        return requests;
      }).filter(req => req !== null);

      if (permissionRequests.length > 0) {
        console.log('Ejecutando solicitudes de permisos, cantidad:', permissionRequests.length * 2);
        const permissionResponses = await lastValueFrom(
          concat(...permissionRequests.flat()).pipe(toArray())
        );
        console.log('Respuestas de permisos:', permissionResponses);
      } else {
        console.warn('No se crearon solicitudes de permisos');
      }

      alerts.basicAlert('Datos actualizados', 'Se han actualizado los datos correctamente.', 'success');
      this.notSavedChanges = false;
      this.newlyAddedRows = [];
      setTimeout(() => {
        this.obtenerDatos();
        console.log('=== DATOS REFRESCADOS DESPUÉS DE GUARDAR ===');
      }, 500);

    } catch (error) {
      console.error('Error al guardar usuarios:', error);
      let errorMessage = 'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.';
      if (error?.error?.message) {
        errorMessage = error.error.message;
      } else if (error?.error?.errors) {
        const serverErrors = error.error.errors;
        if (Array.isArray(serverErrors)) {
          errorMessage = 'Errores de validación:\n' + serverErrors.join('\n');
        } else if (typeof serverErrors === 'object') {
          const errorMessages = Object.values(serverErrors).flat();
          errorMessage = 'Errores de validación:\n' + errorMessages.join('\n');
        }
      } else if (error?.status === 400) {
        errorMessage = 'Error de validación: Verifique que todos los campos obligatorios estén completos.';
      } else if (error?.status === 409) {
        errorMessage = 'Conflicto: El correo electrónico ya está en uso.';
      } else if (error?.status === 500) {
        errorMessage = 'Error del servidor: Contacte al administrador.';
      }
      alerts.basicAlert('Error', errorMessage, 'error');
    }
  }

  async deleteUser() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Eliminar entrada', 'Por favor, seleccione una entrada para eliminar.', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    if (selectedData.isRoot === 1 || selectedData.isRoot === true) {
      alerts.basicAlert('Eliminar entrada', 'No se puede eliminar un usuario administrador', 'error');
      return;
    }

    alerts.confirmAlert(
      'Eliminar empleado',
      '¿Está seguro que desea eliminar este usuario?',
      'warning',
      'Sí, eliminar'
    ).then((value) => {
      if (value.isConfirmed) {
        console.log('SelectedData', selectedData);
        selectedData.active = 0;
        console.log('SelectedData', selectedData);
        this.usersService.deleteUser(id, selectedData).pipe(
          catchError((error) => {
            alerts.basicAlert('Eliminar entrada', 'Error al eliminar la entrada.', 'error');
            console.error(error);
            return EMPTY;
          })
        ).subscribe(() => {
          alerts.basicAlert('Eliminar entrada', 'Entrada eliminada satisfactoriamente.', 'success');
          this.obtenerDatos();
          this.trackingService.addLog(
            this.trackingService.getnameComp(),
            'Delete Registro en Usuarios',
            'Menu Administracion Usuarios',
            this.trackingService.getEmail()
          );
          this.notSavedChanges = false;
          this.selectedRowData = null;
        });
      }
    });
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
    this.trackingService.addLog(
      this.trackingService.getnameComp(),
      'Revertir Registro en Usuarios',
      'Menu Administracion Usuarios',
      this.trackingService.getEmail()
    );
  }

  togglePermissions() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Permisos', 'Por favor, seleccione un usuario para ver sus permisos.', 'warning');
      return;
    }

    const selectedNode = selectedNodes[0];
    const selectedData = selectedNode.data;
    const isCurrentlyExpanded = selectedNode.expanded;

    if (isCurrentlyExpanded) {
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
      this.gridApi.forEachNode((node) => {
        if (node.expanded) {
          node.setExpanded(false);
        }
      });
      this.gridApi.setFilterModel(null);
      const filterModel = {
        id: {
          filterType: 'number',
          type: 'equals',
          filter: selectedData.id
        }
      };
      this.gridApi.setFilterModel(filterModel);
      this.gridApi.onFilterChanged();
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
    const colorEmojis = [
      '🔵', '🟢', '🔴', '🟡', '🟣', '🟠', '🟦', '🩷', '⚫', '🟦', '⚪', '🟤'
    ];
    return colorEmojis[roleId % colorEmojis.length];
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    if (!cleanedData.password || cleanedData.password === '') {
      console.warn('El campo password está vacío, esto puede causar el error');
    }
    if (cleanedData.picture && cleanedData.picture.startsWith('data:')) {
      // Ya está en base64, mantenerlo
    } else if (cleanedData.picture === './assets/img/profile.png') {
      delete cleanedData.picture;
    }
    if (cleanedData.signature && cleanedData.signature.startsWith('data:')) {
      // Ya está en base64, mantenerlo
    } else if (!cleanedData.signature) {
      delete cleanedData.signature;
    }
    cleanedData.id_company = Number(cleanedData.id_company) || this.idRoot;
    cleanedData.idRol = Number(cleanedData.idRol) || 0;
    cleanedData.idDepartament = Number(cleanedData.idDepartament) || 1;
    cleanedData.isRoot = Boolean(cleanedData.isRoot);
    cleanedData.active = Number(cleanedData.active) || 1;
    console.log('Cleaned data para servidor:', cleanedData);
    return cleanedData;
  }
}