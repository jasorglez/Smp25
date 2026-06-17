import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, computed, effect, HostListener, inject, Injectable, ViewChild, ChangeDetectorRef} from '@angular/core';
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

import { ImageHandlerService } from 'app/services/image-handler.service';
import { SignalsService } from 'app/services/signals.service';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { env } from 'echarts';
import { environment } from '@env/environment';
import { RolesDetailedDelisonComponent } from './rolesDelison-detailed/rolesDelison-detailed.component';
import { PosicionDelisonComponent } from './posicionDelison/posicionDelison.component';
import { TrackingService } from 'app/services/tracking.service';
import { AuthService } from 'app/services/auth.service';
import { PosicionesService } from 'app/services/posiciones.service';
import { ModalService, PermissionsModalData } from 'app/services/permissions-modal.service';
import { Subscription } from 'rxjs';
import { PermissionsViewByUserComponent } from '../users/details/detail-permissions-user/permissions-view.component';

@Injectable({
  providedIn: 'root',
})

// Ahora el componente principal
@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    MatDialogModule,
    RolesDetailedDelisonComponent,
    PosicionDelisonComponent,
    PermissionsViewByUserComponent
  ],
  providers: [CurrencyPipe],
  templateUrl: './rolesDelison.component.html',
  styleUrl: './rolesDelison.component.scss',
})
export class RolesDelisonComponent {

  @ViewChild('permissionsViewRef') permissionsViewRef?: PermissionsViewByUserComponent;

  idRoot: number;
  gridHeight: string = '80vh';
  newlyAddedRows: string[] = [];
  departamentos: any[] = [];
  position: any[] = [];
  rowData: any[] = [];
  paginationPageSize = 20; // Tamaño de página
  pagination = true; // Habilitar paginación
  notSavedChanges: boolean = false;
  paginationPageSizeSelector = false;
  id: string;
  idRole: number = null;
  userRoot: number = 0;
  authorizedPass: boolean = false;

  // Agregar esta nueva variable para almacenar el ID de la última fila editada
  private lastEditedRowId: number | string | null = null;

  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private permissionType: string = 'root';

  private usersService = inject(UsersService);
  private readonly cdr = inject(ChangeDetectorRef);

  private catalogService = inject(CatalogsService);
  private signalsService = inject(SignalsService);
  private rolesService = inject(RolesService);
  private trackingService = inject(TrackingService);
  private posicionesService = inject(PosicionesService);
  authService = inject(AuthService);
  private modalService = inject(ModalService);

  // --- Modal host (permiso por posición) ---
  showPermissionsModal: boolean = false;
  modalUserName: string = '';
  modalPermissions: { idUser: number | string; idBranch: number; idRole: number; idPosicion: number; scope?: 'userSystem' | 'position'; seedFromRolePosition?: boolean; roleTemplateOnly?: boolean } | null = null;
  private modalSubscription?: Subscription;

  profile = computed(() => this.signalsService.profile);

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }


  verification(): boolean {
    //const permissions = this.signalsService.getStoreFromPermissions();
    if (this.userRoot == 1) {
      return this.authorizedPass = true;
    }
    return this.authorizedPass = false;
  }


  constructor(private currencyPipe: CurrencyPipe) {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      // Usamos setTimeout para desacoplar la carga de datos del ciclo de renderizado actual.
      // Esto evita el error "cannot get grid to draw rows when it is in the middle of drawing rows".
      setTimeout(() => this.obtenerDatos(), 0);
    })

    this.modalSubscription = this.modalService.openPermissions$.subscribe((data: PermissionsModalData) => {
      this.modalPermissions = {
        idUser: data.idUser,
        idBranch: data.idBranch,
        idRole: data.idRole,
        idPosicion: data.idPosicion,
        scope: data.scope,
        seedFromRolePosition: data.seedFromRolePosition,
        roleTemplateOnly: data.roleTemplateOnly,
      };
      this.modalUserName = data.modalTitleDetail ?? data.userName;
      this.showPermissionsModal = true;
    });
  }

  closePermissionsModal() {
    this.showPermissionsModal = false;
    this.modalPermissions = null;
    this.modalUserName = '';
  }

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
    PosicionDelisonComponent: PosicionDelisonComponent
  }

  private selectRowById(id: number | string) {
    // Dar tiempo al grid para que se actualice
    setTimeout(() => {
      this.gridApi.forEachNode((node) => {
        // Convertir ambos IDs a número para la comparación
        const nodeId =
          typeof node.data.id === 'string'
            ? parseInt(node.data.id)
            : node.data.id;
        const searchId = typeof id === 'string' ? parseInt(id) : id;

        if (nodeId === searchId) {
          node.setSelected(true);
          this.gridApi.ensureNodeVisible(node, 'middle');
        }
      });
    }, 100);
  }


  /** Orden alfabético por nombre de departamento (español, ignora mayúsculas y acentos en la comparación). */
  private sortDepartamentosPorNombre(rows: any[]): any[] {
    if (!Array.isArray(rows)) return [];
    return [...rows].sort((a, b) => {
      if (b.active !== a.active) return b.active ? 1 : -1;
      return String(a?.description ?? '')
        .localeCompare(String(b?.description ?? ''), 'es', { sensitivity: 'base', numeric: true });
    });
  }

  obtenerDatos() {

    this.rolesService.getRoles(this.idRoot).subscribe(
      (data: any) => {
        const raw = data?.data ?? data ?? [];
        this.rowData = this.sortDepartamentosPorNombre(Array.isArray(raw) ? raw : []);
        this.cdr.detectChanges();
      },
      (error) => {
        if (error.status == 404) this.rowData = [];
        this.cdr.detectChanges();
        console.error('Error fetching data:', error);
      }
    );

  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  onFirstDataRendered() {
    if (!this.gridApi) return;
    this.gridApi.autoSizeAllColumns();
    // Las columnas Visualizador se fuerzan angostas para que el header haga wrap en 2 líneas.
    this.gridApi.setColumnWidths([
      { key: 'visualizadorAlmacenMoliendaDepto', newWidth: 160 },
      { key: 'visualizadorMultiguardar', newWidth: 105 },
    ]);
  }
  // Column Definitions: Defines the columns to be displayed.
  public gridOptions: any = {
    rowHeight: 20,
    defaultColDef: {
      resizable: true,
      sortable: true,
      wrapHeaderText: true,
      autoHeaderHeight: true,
    },
    rowBuffer: 20,
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
      // Puedes agregar aquí más lógica si es necesario, por ejemplo, actualizar datos seleccionados o activar pestañas
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
    /*onCellKeyDown: (params) => {
      if (params.event.key === 'Enter') {
        // Obtener todas las columnas editables
        const editableColumns = this.columnDefs.filter((col) => col.editable);
        const currentColIndex = editableColumns.findIndex(
          (col) => col.field === params.column.getColDef().field
        );
  
        if (currentColIndex < editableColumns.length - 1) {
          // Añadir delay de 50ms antes de mover el foco
          requestAnimationFrame(() => {
            // Mover a la siguiente columna editable
            params.api.startEditingCell({
              rowIndex: params.node.rowIndex,
              colKey: editableColumns[currentColIndex + 1].field,
            });
          }); // Retraso para permitir que termine la edición actual
        }
        params.event.preventDefault(); // Prevenir comportamiento por defecto
      }
    },*/
    //onCellClicked: (event) => this.onCellClicked(event),
    masterDetail: true,
    detailCellRendererSelector: (params) => {
      // Decide qué renderizador usar basado en la propiedad 'detailType'
      if (params.data.detailType === 'posiciones') {
        return {
          component: 'PosicionDelisonComponent',
          params: {
            // Aquí puedes pasar parámetros específicos si es necesario
          }
        };
      }
      return undefined; // No mostrar detalle si no hay tipo
    },
    detailRowHeight: 600,
    detailCellRendererParams: { // Parámetros/contexto global para todos los detalles
      context: { rolesService: this.rolesService, trackingService: this.trackingService }
    }
  };

  private _columnDefs: ColDef[] = [];

  get columnDefs(): ColDef[] {
    if (this._columnDefs.length > 0) {
      return this._columnDefs;
    }

    this._columnDefs = [
      {
        field: 'id',
        filter: 'agNumberColumnFilter',
        hide: true
      },
      {
        field: 'active',
        headerName: 'Activo',
        width: 90,
        maxWidth: 90,
        cellRenderer: (params: any) => {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = !!params.value;
          checkbox.style.cursor = 'pointer';
          checkbox.addEventListener('change', () => {
            params.node.setDataValue('active', checkbox.checked);
          });
          return checkbox;
        },
      },
      {
        field: 'description',
        headerName: 'Departamentos *',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },
        filter: true,
        cellEditor: 'autocompleteEditor',
        flex: 1,
        cellEditorParams: {
          filterList: this.rowData.map(e => e.description),
          filterKey: 'description',
          placeholder: 'Nombre',
          minLength: 1,
          toUpperCase: true
        },
        valueSetter: (params) => {
          const normalized = (params.newValue || '').toUpperCase().trim();
          if (!normalized) {
            alerts.basicAlert('Campo requerido', 'El nombre del departamento es obligatorio.', 'error');
            return false;
          }

          const duplicateExists = this.rowData.some((row, index) =>
            index !== params.node.rowIndex && row.description?.toUpperCase() === normalized
          );

          if (duplicateExists) {
            alerts.basicAlert(
              'Nombre duplicado',
              'Ya existe un rol con ese nombre.',
              'error'
            );
            return false;
          }

          params.data[params.colDef.field] = normalized;
          return true;
        }
      },
      {
        field: 'prefijo',
        headerName: 'Prefijo',
        width: 110,
        editable: true,
        cellEditorParams: { maxLength: 4 },
        valueSetter: (params) => {
          const normalized = (params.newValue || '').toUpperCase().trim().slice(0, 4);
          // Vacío permitido; si tiene valor, validar que no se repita entre departamentos.
          if (normalized) {
            const duplicate = this.rowData.some((row, index) =>
              index !== params.node.rowIndex && (row.prefijo || '').toUpperCase().trim() === normalized
            );
            if (duplicate) {
              alerts.basicAlert(
                'Prefijo duplicado',
                `El prefijo "${normalized}" ya está asignado a otro departamento.`,
                'error'
              );
              return false;
            }
          }
          params.data.prefijo = normalized;
          return true;
        }
      },
      {
        field: 'visualizadorAlmacenMoliendaDepto',
        headerName: 'Visualizador\nAlmacen molienda Depto',
        headerTooltip: 'Visualizador Almacen molienda Depto',
        minWidth: 100,
        width: 120,
        wrapHeaderText: true,
        autoHeaderHeight: true,
        cellRenderer: (params: any) => {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = !!params.value;
          checkbox.style.cursor = 'pointer';
          checkbox.addEventListener('change', () => {
            params.node.setDataValue('visualizadorAlmacenMoliendaDepto', checkbox.checked);
          });
          return checkbox;
        },
      },
      {
        field: 'visualizadorMultiguardar',
        headerName: 'Visualizador\nmultiguardar',
        headerTooltip: 'Visualizador multiguardar',
        minWidth: 100,
        width: 120,
        wrapHeaderText: true,
        autoHeaderHeight: true,
        cellRenderer: (params: any) => {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = !!params.value;
          checkbox.style.cursor = 'pointer';
          checkbox.addEventListener('change', () => {
            params.node.setDataValue('visualizadorMultiguardar', checkbox.checked);
          });
          return checkbox;
        },
      },
      {
        field: 'posiciones',
        headerName: 'Posiciones *',
        headerTooltip: 'Posiciones',
        hide: false,
        cellRenderer: this.createDetailToggleCellRenderer('posiciones'),
        minWidth: 140,
        width: 150,
        flex: 0,
        wrapHeaderText: true,
        autoHeaderHeight: true,
        cellStyle: { backgroundColor: '#d4edda' },
      },
    ];

    return this._columnDefs;
  }
  createDetailToggleCellRenderer(detailType: string): (params: any) => HTMLElement {
    return (params: any): HTMLElement => {
      const div = document.createElement('div');
      if (detailType === 'posiciones') {
        div.innerText = 'Ver posiciones';
        div.style.cursor = 'pointer';
        div.style.textDecoration = 'underline';
        div.style.color = '#0d6efd';
      }
      return div;
    };
  }

  selectedRowData: any = null;

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      this.idRole = selectedNodes[0].data.id;
      this.signalsService.setIdRole(selectedNodes[0].data.id);
    } else {
      this.selectedRowData = null;
      this.idRole = null;
    }
  }

  onCellClicked(event: any): void {
    const colId = event.column.getColId();

    // Solo reaccionar al clic en la columna 'posiciones'
    if (colId === 'posiciones') {
      const node = event.node;
      const api = event.api;
      const detailType = 'posiciones';

      if (node.expanded) {
        node.setExpanded(false);
        api.setFilterModel(null);
        api.onFilterChanged();
      } else {
        // Colapsar cualquier otra fila que esté expandida para evitar múltiples detalles abiertos.
        api.forEachNode(otherNode => {
          if (otherNode.expanded && otherNode.id !== node.id) {
            otherNode.setExpanded(false);
          }
        });

        // Si se hace clic en una celda diferente (o la fila está cerrada)...
        // ...se establece el nuevo tipo de detalle y se expande la fila.

        // Aplicar filtro por ID para enfocar la fila actual y ocultar las demás.
        api.setFilterModel({ id: { type: 'equals', filter: event.data.id } });
        api.onFilterChanged();

        // Asignar el tipo de detalle y expandir.
        event.data.detailType = detailType;
        node.setExpanded(true);
      }
    }
  }

  onCellValueChanged(event) {
    // console.log('Dato cambiado:', event.data);
    this.notSavedChanges = true;
    if (!event.data.__isNew) {
      event.data.__modified = true;
    }
  }


  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idCompany: this.idRoot,
      description: '',
      comment: '',
      prefijo: '',
      active: true,
      visualizadorAlmacenMoliendaDepto: false,
      visualizadorMultiguardar: false,
      __isNew: true
    };

    this.rowData = [newItem, ...this.rowData];
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Add Registro en Roles', 'Menu Administracion Roles', this.trackingService.getEmail());

    setTimeout(() => {
      this.gridApi.startEditingCell({
        rowIndex: 0,
        colKey: 'description',
      });
    }, 100);
  }



  async saveChanges() {
    const isValid = this.rowData.every(
      (item) => item.description
    );

    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe introducir el nombre del rol y un comentario antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter(row => row.__isNew);
    const modifiedRows = this.rowData.filter(row => row.__modified && !row.__isNew);


    // Mostrar los datos de las filas nuevas que se van a enviar
    newRows.forEach((row, index) => {
      const cleanedData = this.cleanDataForServer(row);
    });

    // Mostrar los datos de las filas modificadas que se van a enviar
    modifiedRows.forEach((row, index) => {
      const cleanedData = this.cleanDataForServer(row);
    });

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Save Registro en Roles', 'Menu Administracion Roles', this.trackingService.getEmail());
      return this.rolesService.addRoles(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(), 'Update Registro en Roles', 'Menu Administracion Roles', this.trackingService.getEmail());
      return this.rolesService.updateRoles(row.id, cleanedData);
    });

    try {
      await lastValueFrom(
        concat(...addObservables, ...updateObservables).pipe(toArray())
      );

      // Determinar qué ID vamos a seleccionar después de recargar
      if (modifiedRows.length > 0) {
        // Si hay filas modificadas, guardamos el ID de la última modificada
        this.lastEditedRowId = modifiedRows[modifiedRows.length - 1].id;
      } else if (newRows.length > 0) {
        // Si hay filas nuevas, marcaremos que necesitamos seleccionar el ID máximo
        this.lastEditedRowId = 'SELECT_MAX_ID';
      }

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];

      await this.obtenerDatos(); // Esperar a que se actualicen los datos

      // Seleccionar la fila apropiada después de recargar
      if (this.lastEditedRowId) {
        if (this.lastEditedRowId === 'SELECT_MAX_ID') {
          // Encontrar el ID máximo en los datos actuales
          const maxId = Math.max(...this.rowData.map((row) => Number(row.id)));
          this.selectRowById(maxId);
        } else {
          this.selectRowById(this.lastEditedRowId);
        }
        this.lastEditedRowId = null; // Resetear el ID
      }
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  
    this.cdr.detectChanges();}

  async deleteRol() {
    const selectedNodes = this.gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alerts.basicAlert('Eliminar entrada', 'Por favor, seleccione una entrada para eliminar.', 'error');
      return;
    }

    const selectedData = selectedNodes[0].data;
    const id = selectedData.id;

    if (selectedData.isRoot === 1) {
      alerts.basicAlert('Eliminar entrada', 'No se puede eliminar un usuario administrador.', 'error');
      return;
    }

    // Validar que ninguna posición tenga switches de permisos encendidos
    try {
      const posiciones: any = await lastValueFrom(
        this.posicionesService.getPositionsByRole(this.idRoot, id).pipe(catchError(() => []))
      );
      const posicionesArray: any[] = Array.isArray(posiciones) ? posiciones : (posiciones ? [posiciones] : []);

      for (const pos of posicionesArray) {
        const permisos: any = await lastValueFrom(
          this.rolesService.getCatalogCRUD(pos.id).pipe(catchError(() => []))
        );
        const permisosArray: any[] = Array.isArray(permisos) ? permisos : (permisos ? [permisos] : []);
        const tieneActivos = permisosArray.some(p => p.canRead || p.canCreate || p.canUpdate || p.canDelete);
        if (tieneActivos) {
          alerts.basicAlert(
            'No se puede eliminar',
            `El departamento "${selectedData.description}" tiene permisos activos en la posición "${pos.description}". Apague todos los switches antes de eliminar.`,
            'warning'
          );
          return;
        }
      }
    } catch (error) {
      console.error('Error verificando permisos:', error);
    }

    const result = await alerts.confirmAlert(
      'Eliminar departamento',
      `¿Está seguro que desea eliminar "${selectedData.description}"? Esta acción eliminará también sus posiciones y permisos.`,
      'warning',
      'Sí, eliminar'
    );

    if (result.isConfirmed) {
      this.rolesService.deleteRoles(id).pipe(
        catchError((error) => {
          alerts.basicAlert('Error', 'No se pudo eliminar el departamento.', 'error');
          console.error(error);
          return EMPTY;
        })
      ).subscribe(() => {
        alerts.basicAlert('Eliminado', 'Departamento eliminado correctamente.', 'success');
        this.obtenerDatos();
        this.trackingService.addLog(this.trackingService.getnameComp(), 'Delete Registro en Roles', 'Menu Administracion Roles', this.trackingService.getEmail());
        this.notSavedChanges = false;
        this.selectedRowData = null;
      });
    }
  
    this.cdr.detectChanges();}

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
    this.trackingService.addLog(this.trackingService.getnameComp(), 'Cancelar Salvar Registro en Roles', 'Menu Administracion Roles', this.trackingService.getEmail());
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
