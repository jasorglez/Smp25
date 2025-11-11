import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import {
  CellDoubleClickedEvent,
  ColDef,
  ColGroupDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from '../../../../../helpers/alerts';
import { AgGridModule } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { SignalsService } from 'app/services/signals.service';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ClockService } from 'app/services/clock.service';
import { TimeEditorComponent } from 'app/shared/time-editor/time-editor.component';
import { TimeEditorModule } from 'app/shared/time-editor/time-editor.module';
import { lastValueFrom, concat, toArray, forkJoin } from 'rxjs';
import { RolesService } from 'app/services/roles.service';
import { TimeService } from 'app/services/time.service';
import { TrackingService } from 'app/services/tracking.service';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-roles-detailed',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, TimeEditorModule],
  templateUrl: './rolesDelison-detailed.component.html',
  styleUrl: './rolesDelison-detailed.component.scss'
})
export class RolesDetailedDelisonComponent implements OnInit {
  private rolesService = inject(RolesService);
  private signalsService = inject(SignalsService);
  private clockService = inject(ClockService);
  private timeService = inject(TimeService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private trackingService = inject(TrackingService);
  authService = inject(AuthService);

  ngOnInit() {
    this.idRole = this.signalsService.getIdRole()();
    this.idPosicion = this.signalsService.getIdPosicion()();
    this.idEmpresa = this.signalsService.getRootSelectedBySidebar()();
    this.obtenerDatos(this.idRole, this.idPosicion);
  }

  constructor() {
    effect(() => {
      this.idRole = this.signalsService.getIdRole()();
      this.idPosicion = this.signalsService.getIdPosicion()();
      this.idEmpresa = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerDatos(this.idRole, this.idPosicion);
    });

  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  selectFechas: FormGroup;
  type: string = '';
  gridHeight: string = '55vh';
  showCreditsTab: boolean = false;
  private gridApi: GridApi;
  notSavedChanges: boolean = false;
  selectedRowData: any = null;
  isOpen: boolean = false;
  idEmpresa: number;
  branchs: any[] = [];
  Typecop: any[] = [];
  tempIdCounter: number = 0; // Contador para IDs temporales

  // Agregar esta nueva variable para almacenar el ID de la última fila editada
  private lastEditedRowId: number | string | null = null;

  rowData: any;
  contracts: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];

  id: string;
  idRole: number;
  idPosicion: number;
  selectedTab: string = 'customers-payments';
  idEmployee: number;
  fechaInicio: any;
  fechaFin: any;

  public defaultColDef: ColDef = {
    sortable: true,
    filter: false,
    resizable: true,
    lockPosition: false,
    enableRowGroup: true, // Enable row grouping for all columns
    flex: 1,
  };

  currentIndex = 0;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'never';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'never';
  rowDataPrue = [
    {masterPermissionName: "Recursos Humanos", masterRead: true, detailedPermissionName: "Empleados", detailedRead: true, subdetailedPermissionName:  "Empleados", canRead: true, canCreate: true, canUpdate: true, canDelete: true},
    {masterPermissionName: "Recursos Humanos", masterRead: false, detailedPermissionName: "Empleados", detailedRead: true, subdetailedPermissionName:  "Horarios", canRead: true, canCreate: true, canUpdate: true, canDelete: true},
    {masterPermissionName: "Recursos Humanos", masterRead: false, detailedPermissionName: "Empleados", detailedRead: true, subdetailedPermissionName:  "Historico Préstamos", canRead: true, canCreate: true, canUpdate: true, canDelete: true},
    {masterPermissionName: "Recursos Humanos", masterRead: false, detailedPermissionName: "Empleados", detailedRead: true, subdetailedPermissionName:  "Historico Ahorros", canRead: true, canCreate: true, canUpdate: true, canDelete: true},
    {masterPermissionName: "Recursos Humanos", masterRead: true, detailedPermissionName: "Nómina", detailedRead: true, subdetailedPermissionName:  "Nómina", canRead: true, canCreate: true, canUpdate: true, canDelete: true},
    {masterPermissionName: "Recursos Humanos", masterRead: true, detailedPermissionName: "Nómina", detailedRead: true, subdetailedPermissionName:  "Bonos Historicos", canRead: true, canCreate: true, canUpdate: true, canDelete: true},
    {masterPermissionName: "Recursos Humanos", masterRead: false, detailedPermissionName: "Nómina", detailedRead: true, subdetailedPermissionName:  "Histórico de Nominas Digitales", canRead: true, canCreate: true, canUpdate: true, canDelete: true},
    {masterPermissionName: "Compras delison", masterRead: true, detailedPermissionName: "Proveedores", detailedRead: true, subdetailedPermissionName:  "Proveedores", canRead: true, canCreate: true, canUpdate: true, canDelete: true},
    {masterPermissionName: "Compras delison", masterRead: true, detailedPermissionName: "Requisiciones", detailedRead: true, subdetailedPermissionName:  "Requisiciones", canRead: true, canCreate: true, canUpdate: true, canDelete: true},
  ]
  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
    timeEditor: TimeEditorComponent,
  };

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    groupDefaultExpanded: -1, // -1 significa expandir todos los grupos
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
    getRowClass: (params) => {
      if (params.node.isSelected()) {
        return 'selected-row';
      }
      return '';
    },
  };

  public autoGroupColumnDef: ColDef = {
    headerName: 'Permisos',
    minWidth: 300,
    cellRendererParams: {
      suppressCount: true, // No mostrar el contador de hijos (ej: (3))
      // Usamos un valueGetter para mostrar el valor correcto en la fila de grupo
      valueGetter: params => {
        if (params.node.group) {
          // Para el primer nivel de grupo (masterPermissionName)
          if (params.node.level === 0) {
            const masterReadValue = params.data.masterRead;
            return `Ver: ${masterReadValue ? 'Sí' : 'No'}`;
          }
          // Para el segundo nivel de grupo (detailedPermissionName)
          if (params.node.level === 1) {
            const detailedReadValue = params.data.detailedRead;
            return `Ver: ${detailedReadValue ? 'Sí' : 'No'}`;
          }
        }
        // Para las filas hoja, no mostramos nada extra aquí
        return '';
      },
    },
  };

  get colDetail(): (ColDef | ColGroupDef)[] {
    return [
    {
      field: 'masterPermissionName',
      headerName: 'Permiso Maestro',
      rowGroup: true,
      hide: true
    },
    {
      field: 'detailedPermissionName',
      headerName: 'Permiso Detallado',
      rowGroup: true,
      hide: true
    },
    {
      field: 'subdetailedPermissionName',
      headerName: 'Permiso',
      flex: 7
    },
    
    
      {
        field: 'idDetailedPermission',
        headerName: 'ID Permiso Detallado',
        width: 110,
        hide: true,
      },
      {
        field: 'canRead',
        headerName: 'Ver',
        cellRenderer: 'agCheckboxCellRenderer',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },
        cellRendererParams: {
          disabled: false,
        },
      },
      {
        field: 'canCreate',
        headerName: 'Crear',
        cellRenderer: 'agCheckboxCellRenderer',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },
        cellRendererParams: {
          disabled: false,
        },
      },
      {
        field: 'canUpdate',
        headerName: 'Actualizar',
        cellRenderer: 'agCheckboxCellRenderer',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },
        cellRendererParams: {
          disabled: false,
        },
      },
      {
        field: 'canDelete',
        headerName: 'Borrar',
        cellRenderer: 'agCheckboxCellRenderer',
        editable: (params) => {
          if (params.data.__isNew) {
            return true;
          }
          return true
        },
        cellRendererParams: {
          disabled: false,
        },
      },
    ];
  }

  obtenerDatos(idRole: number, idPosicion: number) {
    this.rolesService.getPermissionsByRoles( this.idEmpresa , idRole, idPosicion)
      .subscribe((data: any) => {
        
          // Obtenemos los masterPermissionName que tienen masterRead = false
          const mastersToFilter = data
            .filter(item => item.masterRead === false)
            .map(item => item.masterPermissionName);

          // Obtenemos los detailedPermissionName que tienen detailedRead = false
          const detailsToFilter = data
            .filter(item => item.detailedRead === false)
            .map(item => item.detailedPermissionName);

          // Filtramos los datos
          const filteredData = data.filter(item => {
            // Si el masterRead del item es false, no lo incluimos
            if (mastersToFilter.includes(item.masterPermissionName)) return false;
            // Si el detailedRead del item es false, no lo incluimos
            if (detailsToFilter.includes(item.detailedPermissionName)) return false;
            return true;
          });
          this.rowData = filteredData;
        console.log(this.rowData)

        // Esperar a que el grid se actualice y luego ajustar las columnas
        setTimeout(() => {
          if (this.gridApi) {
            // Obtener todas las columnas y ajustarlas automáticamente
            const allColumnIds = this.gridApi.getColumns().map(column => column.getColId());
            this.gridApi.autoSizeColumns(allColumnIds);
          }
        }, 100);
      });
  }

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      console.log(selectedNodes[0].data);
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
    this.lastEditedRowId = event.data.id;
    console.log(event.data)
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
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

  async activateCreditsTab() {
    if (!this.isOpen) {
      setTimeout(async () => await this.adjustGridSize(), 0);
      this.showCreditsTab = true;
      this.isOpen = true;
    } else {
      this.resetGridSize();
      this.isOpen = false;
    }
  }

  resetGridSize() {
    this.gridHeight = '80vh'; // Reset to default height
    this.showCreditsTab = false;
    this.gridApi.setFilterModel(null);
    this.gridApi.onFilterChanged();
  }

  adjustGridSize() {
    this.gridHeight = '20vh'; // Adjust as needed
  }

  async saveDetailChanges() {
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified
    );

    const addObservables = [];
    const updateObservables = [];

    for (const row of modifiedRows) {
      const cleanedData = this.cleanDataForServer(row);
      try {
        // Intentar obtener el permiso individual
        await lastValueFrom(
          this.rolesService.getIndividualDetailedPermissionxRol(row.idRole, row.idPosicion, row.idDetailedPermission)
        );
        // Si llegamos aquí, el permiso existe, así que lo agregamos a updateObservables
        const timeResponse = await lastValueFrom(this.timeService.getTime());
        cleanedData.updatedAt = timeResponse.localTime;
        cleanedData.idPosicion = this.idPosicion;
        updateObservables.push(
          this.rolesService.updateDetailedPermissionsxRoles(row.idRole, row.idDetailedPermission, cleanedData)
        );
        this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Detalle de Roles', 'Menu Administracion Detalle de Roles',  this.trackingService.getEmail());
      } catch (error) {
        console.log(error)
        // Si el error es 404, significa que el permiso no existe y debemos crearlo
        if (error.status === 404) {
          const timeResponse = await lastValueFrom(this.timeService.getTime());
          cleanedData.createdAt = timeResponse.localTime;
          cleanedData.idPosicion = this.idPosicion;
          addObservables.push(
            this.rolesService.addDetailedPermissionsxRoles(cleanedData)
          );
          this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Detalle de Roles', 'Menu Administracion Detalle de Roles',  this.trackingService.getEmail());
        } else {
          // Si es otro tipo de error, lo propagamos
          throw error;
        }
      }
    }

    try {
      // Ejecutar todas las operaciones en paralelo
      await lastValueFrom(forkJoin([
        ...addObservables,
        ...updateObservables
      ]));

      alerts.basicAlert(
        'Datos actualizados',
        'Se han actualizado los datos correctamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.newlyAddedRows = [];

      await this.obtenerDatos(this.idRole, this.idPosicion);

    } catch (error) {
      console.error(error);
      alerts.basicAlert(
        'Error',
        'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
        'error'
      );
    }
  }

  revertDetailData() {
    this.obtenerDatos(this.idRole, this.idPosicion);
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.detailedPermissionName;
    delete cleanedData.masterPermissionName;
    delete cleanedData.__modified;
    return cleanedData;
  }
}
