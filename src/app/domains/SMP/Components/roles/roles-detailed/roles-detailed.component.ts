import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import {
  CellDoubleClickedEvent,
  ColDef,
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
import { lastValueFrom, concat, toArray, forkJoin } from 'rxjs';
import { RolesService } from 'app/services/roles.service';
import { TimeService } from 'app/services/time.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-roles-detailed',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, TimeEditorComponent],
  templateUrl: './roles-detailed.component.html',
  styleUrl: './roles-detailed.component.scss'
})
export class RolesDetailedComponent implements OnInit {
  private rolesService = inject(RolesService);
  private signalsService = inject(SignalsService);
  private clockService = inject(ClockService);
  private timeService = inject(TimeService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private trackingService = inject(TrackingService);

  ngOnInit() {
    this.idRole = this.signalsService.getIdRole()();
    this.obtenerDatos(this.idRole);
  }

  constructor() {
    effect(() => {
      this.idRole = this.signalsService.getIdRole()();
      this.obtenerDatos(this.idRole);
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

  components = {
    multiLineEditor: MultiLineEditorComponent,
    autocompleteEditor: AutocompleteEditorComponent,
    timeEditor: TimeEditorComponent,
  };

  public gridOptions: any = {
    headerHeight: 25,
    rowHeight: 20,
    groupDefaultExpanded: -1, // -1 significa expandir todos los grupos
    getRowClass: (params) => {
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

  get colDetail(): ColDef[] {
    return [
      {
        field: 'masterPermissionName',
        headerName: 'Permiso Maestro',
        flex: 4,
        rowGroup: true,
        hide: true
      },
      {
        field: 'detailedPermissionName',
        headerName: 'Permiso Detallado',
        flex: 7
      },
      {
        field: 'idDetailedPermission',
        headerName: 'ID Permiso Detallado',
        width: 110,
        hide: true,
      },
      {
        field: 'canCreate',
        headerName: '¿Puede crear?',
        editable: true
      },
      {
        field: 'canRead',
        headerName: '¿Puede leer?',
        editable: true
      },
      {
        field: 'canUpdate',
        headerName: '¿Puede actualizar?',
        editable: true
      },
      {
        field: 'canDelete',
        headerName: '¿Puede borrar?',
        editable: true
      },
    ];
  }

  obtenerDatos(idRole: number) {
    this.rolesService.getPermissionsByRoles(idRole)
      .subscribe((data: any) => {
        this.rowData = [];
        this.rowData = data;
        // Esperar a que el grid se actualice y luego ajustar las columnas
        setTimeout(() => {
          if (this.gridApi) {
            // Obtener todas las columnas y ajustarlas automáticamente
            const allColumnIds = this.gridApi.getColumns().map(column => column.getColId());
            this.gridApi.autoSizeColumns(allColumnIds);
            // Forzar un redraw del grid para asegurar que los cambios se apliquen
            this.gridApi.redrawRows();
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
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    event.data.__modified = true;
    this.notSavedChanges = true;
    this.lastEditedRowId = event.data.id;
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
          this.rolesService.getIndividualDetailedPermissionxRol(row.idRole, row.idDetailedPermission)
        );
        // Si llegamos aquí, el permiso existe, así que lo agregamos a updateObservables
        const timeResponse = await lastValueFrom(this.timeService.getTime());
        cleanedData.updatedAt = timeResponse.localTime;
        updateObservables.push(
          this.rolesService.updateDetailedPermissionsxRoles(row.idRole, row.idDetailedPermission, cleanedData)
        );
        this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Detalle de Roles', 'Menu Administracion Detalle de Roles',  this.trackingService.getEmail());
      } catch (error) {
        // Si el error es 404, significa que el permiso no existe y debemos crearlo
        if (error.status === 404) {
          const timeResponse = await lastValueFrom(this.timeService.getTime());
          cleanedData.createdAt = timeResponse.localTime;
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

      await this.obtenerDatos(this.idRole);

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
    this.obtenerDatos(this.idRole);
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


