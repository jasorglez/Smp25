import { Component, computed, effect, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { ProjectsService } from 'app/services/projects.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { UsersProfileComponent } from './users-profile.component';
import { catchError, concat, EMPTY, forkJoin, lastValueFrom, map, toArray } from 'rxjs';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-usersxprojects',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, UsersProfileComponent],
  templateUrl: './usersxprojects.component.html',
  styleUrl: './usersxprojects.component.scss'
})
export class UsersxprojectsComponent {

  private signalsService = inject(SignalsService);
  private projectsService = inject(ProjectsService);
  private usersxprojectsService = inject(UsersxpermissionsService);
  private trackingService = inject(TrackingService);
  
  ngOnInit() {
    this.filteredData();
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
  idContract = this.signalsService.idContract();
  contractChecked = computed(() => this.signalsService.contractChecked());


  notSavedChanges: boolean = false;
  rowData: any[] = [];
  projects: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private permissionType: string = 'project';
  bulkAssigning: boolean = false;
  searchTerm: string = '';
  profileSectionTitle: string = 'Proyectos';

  get profileItems(): string[] {
    return (Array.isArray(this.rowData) ? this.rowData : [])
      .map((row: any) => this.projects[row.idProject ?? row.idPermission] || row.name || `Proyecto ${row.idProject ?? row.idPermission}`)
      .filter((item: string) => !!item);
  }

  companyName = computed(() => this.signalsService.nameCompany() || 'Empresa seleccionada');
  contractName = computed(() => this.signalsService.nameContract() || 'Contrato seleccionado');

  get availableProjectCount(): number {
    return Object.keys(this.projects).length;
  }

  get assignedProjectCount(): number {
    return new Set(
      this.rowData
        .map(row => Number(row.idProject ?? row.idPermission))
        .filter(id => id > 0)
    ).size;
  }

  get pendingProjectCount(): number {
    const availableIds = new Set(Object.keys(this.projects).map(Number));
    const assignedAvailable = new Set(
      this.rowData
        .map(row => Number(row.idProject ?? row.idPermission))
        .filter(id => availableIds.has(id))
    );
    return Math.max(availableIds.size - assignedAvailable.size, 0);
  }

  constructor() {
    // Effect para detectar cambios en el usuario seleccionado
    effect(() => {
      const selectedUserId = this.profile().idUser();
      this.idContract = this.signalsService.idContract();
      this.signalsService.getRootSelectedBySidebar()();
      
      if (selectedUserId) {
        this.idUser = selectedUserId;
        this.filteredData();
      } else if (!selectedUserId) {
        this.rowData = [];
        this.projects = {};
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
      }
    });
  }

  obtenerDatos() {
    // Validar que tenemos un idUser válido del usuario SELECCIONADO en la tabla
    const currentIdUser = this.profile().idUser();
    if (!currentIdUser) {
      this.rowData = [];
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }
      return;
    }

    // Actualizar idUser por si cambió
    this.idUser = currentIdUser;

    if (this.contractChecked()() === true) {
      const currentIdContract = Number(this.signalsService.idContract() || 0);
      if (!currentIdContract) {
        this.updateGridData([]);
        return;
      }

      this.projectsService.getProjectsByContract(this.idUser, currentIdContract).subscribe((data: any[]) => {
        this.updateGridData(this.asArray(data));
        
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Get Registro en Usuarios por Proyecto',
          'Menu Administracion Usuarios por Proyecto',
          this.trackingService.getEmail()
        );
      }, error => {
        this.updateGridData([]);
      });
    } else {
      const idCompany = Number(this.signalsService.getRootSelectedBySidebar()() || 0);
      if (!idCompany) {
        this.updateGridData([]);
        return;
      }

      forkJoin({
        assignedProjects: this.projectsService.getProjectsByContract(this.idUser),
        companyProjects: this.projectsService.getProjectListByCompany(idCompany)
      }).subscribe(({ assignedProjects, companyProjects }: any) => {
        const companyProjectIds = new Set(
          this.asArray(companyProjects).map((project: any) => Number(project.id))
        );
        const companyAssignments = this.asArray(assignedProjects).filter((assignment: any) =>
          companyProjectIds.has(Number(assignment.idProject ?? assignment.idPermission))
        );
        this.updateGridData(companyAssignments);
        
        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Get Registro en Usuarios por Proyecto',
          'Menu Administracion Usuarios por Proyecto',
          this.trackingService.getEmail()
        );
      }, error => {
        this.updateGridData([]);
      });
    }
  }

  obtenerProjects(contract: number) {
    // Validar que tenemos un idUser válido del usuario SELECCIONADO en la tabla
    const currentIdUser = this.profile().idUser();
    if (!currentIdUser) {
      this.projects = {};
      return;
    }

    // Actualizar idUser por si cambió
    this.idUser = currentIdUser;

    if(this.contractChecked()() == true) {
      if (!contract) {
        this.projects = {};
        return;
      }
      
      this.projectsService.getProjectListByContract(contract).subscribe((data: any[]) => {
        this.projects = data.reduce((acc, dep) => {
          acc[dep.id] = dep.idConsecutivo + ' - ' + dep.name;
          return acc;
        }, {});
      }, error => {
        if (error.status == 404) {
          this.projects = {};
        } else {
          this.projects = {};
        }
      });
    }
    else {
      const idCompany = Number(this.signalsService.getRootSelectedBySidebar()() || 0);
      if (!idCompany) {
        this.projects = {};
        return;
      }
      this.projectsService.getProjectListByCompany(idCompany).subscribe((data: any[]) => {
        this.projects = data.reduce((acc, dep) => {
          acc[dep.id] = (dep.idConsecutivo ? dep.idConsecutivo + ' - ' : '') + dep.name;
          return acc;
        }, {});
      }, error => {
        if (error.status == 404) {
          this.projects = {};
        } else {
          this.projects = {};
        }
      });
    }
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
        field: 'idProject',
        headerName: 'Proyecto',
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: {
          values: Object.keys(this.projects).sort((a, b) => this.projects[a].localeCompare(this.projects[b])),
        },
        valueFormatter: (params) => this.projects[params.value] || '',
        valueSetter: (params) => {
          const newValue = params.newValue;
          if (this.projects.hasOwnProperty(newValue)) {
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
    event.data.__modified = true;
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.gridApi.setGridOption('quickFilterText', this.searchTerm);
  }

  onQuickFilterChanged(value: string): void {
    this.searchTerm = value ?? '';
    this.gridApi?.setGridOption('quickFilterText', this.searchTerm);
  }

  clearSearch(): void {
    this.onQuickFilterChanged('');
  }

  addRow() {
    const currentIdUser = this.profile().idUser();
    if (!currentIdUser) {
      alerts.basicAlert('Proyectos', 'Seleccione un usuario antes de agregar proyectos.', 'info');
      return;
    }
    if (this.availableProjectCount === 0) {
      alerts.basicAlert('Proyectos', 'No hay proyectos disponibles en la selección actual.', 'info');
      return;
    }
    if (this.rowData.some(row => row.__isNew && !Number(row.idProject))) {
      alerts.basicAlert('Proyectos', 'Primero seleccione el proyecto de la fila nueva.', 'info');
      return;
    }

    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idUser: currentIdUser,
      idProject: 0,
      __isNew: true,
    };

    // Asegurar que rowData es un array
    if (!Array.isArray(this.rowData)) {
      this.rowData = [];
    }

    this.rowData = [newItem, ...this.rowData];
    
    // Actualizar ag-grid inmediatamente
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
    
    this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Usuarios por Proyecto', 'Menu Administracion Usuarios por Proyecto',  this.trackingService.getEmail());
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async addAllProjects() {
    if (this.bulkAssigning) {
      return;
    }

    if (this.notSavedChanges) {
      alerts.basicAlert('Proyectos', 'Guarde o deshaga los cambios pendientes antes de agregar todos.', 'info');
      return;
    }

    const currentIdUser = this.profile().idUser();
    const idContract = Number(this.signalsService.idContract() || 0);
    const idCompany = Number(this.signalsService.getRootSelectedBySidebar()() || 0);
    if (!currentIdUser || (!this.contractChecked()() && !idCompany) || (this.contractChecked()() && !idContract)) {
      alerts.basicAlert('Proyectos', 'Seleccione la empresa o el contrato antes de agregar proyectos.', 'info');
      return;
    }

    // No se usa el grid: se consultan de nuevo los proyectos y permisos reales.
    const availableProjects$ = this.contractChecked()()
      ? this.projectsService.getProjectListByContract(idContract)
      : this.projectsService.getProjectListByCompany(idCompany);

    this.bulkAssigning = true;
    forkJoin({
      projects: availableProjects$,
      permissions: this.usersxprojectsService.getUsersxPermissionsGeneral(this.permissionType, currentIdUser)
    }).subscribe({
      next: async ({ projects, permissions }: any) => {
        const projectIds = this.asArray(projects).map(project => Number(project.id));
        const assigned = new Set(this.asArray(permissions)
          .map((permission: any) => Number(permission.idPermission ?? permission.idProject)));
        const missing = projectIds.filter(id => id > 0 && !assigned.has(id));
        if (missing.length === 0) {
          this.bulkAssigning = false;
          alerts.basicAlert('Proyectos', 'El usuario ya tiene asignados todos los proyectos de esta selección.', 'info');
          return;
        }
        try {
          await lastValueFrom(forkJoin(missing.map(idProject => this.usersxprojectsService.addUserxPermission({ idUser: currentIdUser, idPermission: idProject, type: this.permissionType, active: 1 }))));
          alerts.basicAlert('Proyectos', `${missing.length} proyecto(s) asignado(s).`, 'success');
          this.filteredData();
        } catch (error) {
          console.error('Error agregando proyectos:', error);
          alerts.basicAlert('Proyectos', 'No fue posible asignar todos los proyectos.', 'error');
        } finally {
          this.bulkAssigning = false;
        }
      },
      error: () => {
        this.bulkAssigning = false;
        alerts.basicAlert('Proyectos', 'No fue posible consultar los proyectos disponibles.', 'error');
      }
    });
  }

  private asArray(data: any): any[] {
    if (Array.isArray(data)) {
      return data;
    }
    return data && typeof data === 'object' ? Object.values(data) : [];
  }

  private updateGridData(data: any[]): void {
    this.rowData = data;
    this.selectedRowData = null;
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  async saveChanges() {
    const changedRows = this.rowData.filter(row => row.__isNew || row.__modified);
    if (changedRows.length === 0) {
      return;
    }

    const hasEmptyProject = changedRows.some(row => !Number(row.idProject ?? row.idPermission));
    if (hasEmptyProject) {
      alerts.basicAlert(
        'Proyectos',
        'Debe seleccionar un proyecto antes de guardar.',
        'error'
      );
      return;
    }

    const projectIds = this.rowData
      .map(row => Number(row.idProject ?? row.idPermission))
      .filter(id => id > 0);
    if (new Set(projectIds).size !== projectIds.length) {
      alerts.basicAlert('Proyectos', 'No puede asignar dos veces el mismo proyecto al usuario.', 'error');
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Usuarios por Proyecto', 'Menu Administracion Usuarios por Proyecto',  this.trackingService.getEmail());
      return this.usersxprojectsService.addUserxPermission(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Usuarios por Proyecto', 'Menu Administracion Usuarios por Proyecto',  this.trackingService.getEmail());
      return this.usersxprojectsService.updateUserxPermission(row.id, cleanedData);
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
      this.filteredData(); // Refrescar los datos
    } catch (error) {
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

    if (selectedData.__isNew || String(id).startsWith('temp_')) {
      this.rowData = this.rowData.filter(row => row !== selectedData);
      this.newlyAddedRows = this.newlyAddedRows.filter(rowId => rowId !== id);
      this.notSavedChanges = this.rowData.some(row => row.__isNew || row.__modified);
      this.updateGridData(this.rowData);
      return;
    }

    selectedData.active = 0;
    
    this.usersxprojectsService.deleteUserxPermission(id).pipe(
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
        (response) => {
          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.filteredData();

          this.notSavedChanges = false;
          this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Registro en Usuarios por Proyecto', 'Menu Administracion Usuarios por Proyecto',  this.trackingService.getEmail());
          this.selectedRowData = null;
        }
      );
  }

  revert() {
    this.filteredData();
    this.notSavedChanges = false;
    this.trackingService.addLog(this.trackingService.getnameComp(),'Revertir Registro en Usuarios por Proyecto', 'Menu Administracion Usuarios por Proyecto',  this.trackingService.getEmail());
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    
    // Si existe idProject, lo pasamos a idPermission y lo eliminamos
    if (cleanedData.hasOwnProperty('idProject')) {
      cleanedData.idPermission = cleanedData.idProject;
      cleanedData.type = 'project';
      delete cleanedData.idProject;
    }
    
    delete cleanedData.__isNew;
    delete cleanedData.__modified;
    
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    
    return cleanedData;
  }

  onCheckboxChange(event: any) {
    this.signalsService.contractChecked().set(event.target.checked);
    this.filteredData();
  }

  filteredData() {
    // Validar que tenemos un usuario válido antes de proceder (usuario SELECCIONADO)
    const currentIdUser = this.profile().idUser();
    if (!currentIdUser) {
      this.rowData = [];
      this.projects = {};
      if (this.gridApi) {
        this.gridApi.setGridOption('rowData', this.rowData);
      }
      return;
    }

    this.obtenerDatos();
    this.obtenerProjects(this.signalsService.idContract());
  }
}
