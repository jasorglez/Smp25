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
  templateUrl: './usersxprojects.component.html'
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
  rootSelected = computed(() => this.signalsService.getRootSelectedBySidebar());


  notSavedChanges: boolean = false;
  idRoot: number;
  rowData: any[] = [];
  projects: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private permissionType: string = 'project';

  constructor() {
    // Effect para detectar cambios en el usuario seleccionado
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      const selectedUserId = this.profile().idUser();
      
      if (selectedUserId && selectedUserId !== this.idUser) {
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

    // Siempre obtener los permisos de proyecto del usuario usando el servicio correcto
    this.usersxprojectsService.getUsersxPermissionsGeneral(this.permissionType, this.idUser).subscribe({
      next: (data: any[]) => {
        // Transformar idPermission a idProject para el grid
        this.rowData = Array.isArray(data) ? data.map(item => ({
          ...item,
          idProject: item.idPermission || item.idProject
        })) : [];

        // Forzar actualización de ag-grid si existe
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }

        this.trackingService.addLog(
          this.trackingService.getnameComp(),
          'Get Registro en Usuarios por Proyecto',
          'Menu Administracion Usuarios por Proyecto',
          this.trackingService.getEmail()
        );
      },
      error: (error) => {
        if (error.status == 404) {
          this.rowData = [];
        } else {
          this.rowData = [];
        }
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
        }
      }
    });
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
      this.projectsService.getProjectListByCompany(this.rootSelected()()).subscribe((data: any[]) => {
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
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    const newItem = {
      id: tempId,
      idUser: this.idUser,
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

  async saveChanges() {
/*     const isValid = this.rowData.every((item) => item.idPermission);

    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe seleccionar un proyecto antes de guardar.',
        'error'
      );
      return;
    } */

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
