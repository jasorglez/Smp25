import { Component, computed, HostListener, inject, effect } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { UsersProfileComponent } from './users-profile.component';
import { catchError, concat, EMPTY, lastValueFrom, toArray, forkJoin } from 'rxjs';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { SignalsService } from 'app/services/signals.service';
import { WarehousesService } from 'app/services/warehouses.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-usersxwarehouses',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, UsersProfileComponent],
  templateUrl: './usersxpermissions.component.html'
})
export class UsersxwarehousesComponent {

  private signalsService = inject(SignalsService);
  private warehousesService = inject(WarehousesService);
  private usersxwarehousesService = inject(UsersxpermissionsService);
  private trackingService = inject(TrackingService);
  ngOnInit() {
    this.cargarDatos();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  // Signals con correo
  profile = computed(() => this.signalsService.profile);
  idUser: any = this.profile().idUser();

  notSavedChanges: boolean = false;
  rowData: any;
  warehouses: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private permissionType: string = 'warehouse';

  /**
   * Getter que implementa la lógica de priorización para obtener el idBranch:
   * 1. Prioriza getBranchFromPermissions() (branch seleccionado en usersxbranches)
   * 2. Si no existe, usa getBranchSelectedBySidebar() (branch del sidebar)
   */
  get idBranch(): number {
    const branchFromPermissions = this.signalsService.getBranchFromPermissions()();
    const branchFromSidebar = this.signalsService.getBranchSelectedBySidebar()();

    if (branchFromPermissions) {
      return branchFromPermissions;
    }

    return branchFromSidebar || 0;
  }

  constructor() {
    effect(() => {
      const branchFromPermissions = this.signalsService.getBranchFromPermissions()();
      const branchFromSidebar = this.signalsService.getBranchSelectedBySidebar()();

      // Solo recargar si hay un usuario seleccionado y un branch válido
      if (this.idUser && (branchFromPermissions || branchFromSidebar)) {
        this.cargarDatos();
      }
    });
  }

  cargarDatos() {
    const currentIdBranch = this.idBranch;

    // Validar que tenemos un idBranch válido (rechazar solo 0 o undefined)
    // -9 es válido y significa "todas las sucursales"
    if (!currentIdBranch || currentIdBranch === 0) {
      console.warn('⚠️ No hay idBranch válido para cargar warehouses. IdBranch:', currentIdBranch);
      this.rowData = [];
      alerts.basicAlert(
        'Sucursal no seleccionada',
        'Por favor, seleccione una sucursal en el panel izquierdo para ver los almacenes.',
        'info'
      );
      return;
    }

    console.log('🔍 Cargando datos con idBranch:', currentIdBranch);

    // Si idBranch es -9 (todas las sucursales), solo cargar permisos sin filtrar por almacenes
    if (currentIdBranch === -9) {
      this.usersxwarehousesService.getDataUsersxPermissions(this.permissionType).subscribe({
        next: (permisos) => {
          console.log('✅ Datos recibidos (todas las sucursales):', { permisos: permisos.length });

          // Filtrar solo por usuario
          this.rowData = Object.values(permisos).filter((row: any) =>
            row.idUser === this.idUser
          );

          console.log('📊 Filas filtradas:', this.rowData.length);
          this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Usuarios por Almacén (todas las sucursales)', 'Menu Administracion Usuarios por Almacén',  this.trackingService.getEmail());
        },
        error: (error) => {
          console.error('❌ Error al cargar permisos:', error);
          alerts.basicAlert(
            'Error',
            'Ocurrió un error al cargar los permisos.',
            'error'
          );
        }
      });
      return;
    }

    // Para sucursales específicas, cargar almacenes y permisos
    forkJoin({
      permisos: this.usersxwarehousesService.getDataUsersxPermissions(this.permissionType),
      almacenes: this.warehousesService.getSimpleWarehouses(currentIdBranch)
    }).subscribe({
      next: ({ permisos, almacenes }) => {
        console.log('✅ Datos recibidos:', { permisos: permisos.length, almacenes: almacenes.length });

        // Guardar almacenes en el formato requerido
        this.warehouses = almacenes.reduce((acc, dep) => {
          acc[dep.id] = dep.name;
          return acc;
        }, {});

        // Filtrar permisos por usuario y sucursal
        this.rowData = Object.values(permisos).filter((row: any) =>
          row.idUser === this.idUser &&
          almacenes.some(almacen => almacen.id === row.idPermission && almacen.idBranch === currentIdBranch)
        );

        console.log('📊 Filas filtradas:', this.rowData.length);
        this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Usuarios por Almacén', 'Menu Administracion Usuarios por Almacén',  this.trackingService.getEmail());
      },
      error: (error) => {
        console.error('❌ Error al cargar los datos:', error);
        console.error('❌ idBranch usado:', currentIdBranch);
        console.error('❌ Detalles del error:', error.message, error.status);

        // Si es 404, probablemente no hay almacenes para esta sucursal
        if (error.status === 404) {
          this.rowData = [];
          alerts.basicAlert(
            'Sin almacenes',
            'No hay almacenes registrados para esta sucursal.',
            'info'
          );
        } else {
          alerts.basicAlert(
            'Error',
            `Ocurrió un error al cargar los datos: ${error.message || 'Desconocido'}`,
            'error'
          );
        }
      }
    });
  }

// Column Definitions: Defines the columns to be displayed.
public gridOptions: any = {
  headerHeight: 30,
  rowHeight: 30,
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
  },
};

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'idUser',
        headerName: 'ID del Usuario',
        hide: true,
      },
      {
        field: 'idPermission',
        headerName: 'Almacénq',
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: Object.keys(this.warehouses).sort((a, b) => this.warehouses[a].localeCompare(this.warehouses[b])),
        },
        valueFormatter: (params) => this.warehouses[params.value] || '',
        valueSetter: (params) => {
          const newValue = params.newValue;
          if (this.warehouses.hasOwnProperty(newValue)) {
            params.data[params.colDef.field] = newValue;
            return true;
          }
          return false;
        },
        valueParser: (params) => params.newValue,
        editable: true,
        flex: 2,
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
    // Verificar si el campo modificado es 'id_company'
    if (event.colDef.field === 'id_company') {
      const selectedCompany = this.warehouses[event.data.id_company];
      if (selectedCompany) {
        event.data.company = selectedCompany;
      }

      // Forzar actualización de la celda de 'company'
      this.gridApi.refreshCells({
        rowNodes: [event.node],
        columns: ['company'],
        force: true,
      });
    }

    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idUser: this.idUser,
      idPermission: 0,
      type: this.permissionType,
      active: 1,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Usuarios por Almacén', 'Menu Administracion Usuarios por Almacén',  this.trackingService.getEmail());
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.idPermission);

    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe seleccionar un almacén antes de guardar.',
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
      this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Usuarios por Almacén', 'Menu Administracion Usuarios por Almacén',  this.trackingService.getEmail());
      return this.usersxwarehousesService.addUserxPermission(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Usuarios por Almacén', 'Menu Administracion Usuarios por Almacén',  this.trackingService.getEmail());
      return this.usersxwarehousesService.updateUserxPermission(row.id, cleanedData);
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
      this.cargarDatos(); // Refrescar los datos
    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  async deleteEntry() {
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
    this.usersxwarehousesService.deleteUserxPermission(id).pipe(
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
          this.cargarDatos();

          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.notSavedChanges = false;
          this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Registro en Usuarios por Almacén', 'Menu Administracion Usuarios por Almacén',  this.trackingService.getEmail());
          this.selectedRowData = null;
        }
      );
  }

  revert() {
    this.cargarDatos();
    this.notSavedChanges = false;
    this.trackingService.addLog(this.trackingService.getnameComp(),'Revert Registro en Usuarios por Almacén', 'Menu Administracion Usuarios por Almacén',  this.trackingService.getEmail());
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
