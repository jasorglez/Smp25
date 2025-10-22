import { Component, HostListener, inject } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import {
  CellDoubleClickedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
} from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { AgGridModule, ICellRendererAngularComp } from 'ag-grid-angular';
import { MultiLineEditorComponent } from 'app/shared/multi-line/multi-line-editor.component';
import { AutocompleteEditorComponent } from 'app/shared/autocomplete-editor/autocomplete-editor.component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ClockService } from 'app/services/clock.service';
import { TimeEditorComponent } from 'app/shared/time-editor/time-editor.component';
import { TimeEditorModule } from 'app/shared/time-editor/time-editor.module';
import { lastValueFrom, concat, toArray, forkJoin } from 'rxjs';
import { RolesService } from 'app/services/roles.service';
import { TimeService } from 'app/services/time.service';
import { TrackingService } from 'app/services/tracking.service';
import { PermitionsService } from 'app/services/permitions.service';

@Component({
  selector: 'app-detail-permissions-user',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, TimeEditorModule],
  templateUrl: './detail-permissions-user.component.html',
})
export class DetailPermissionsUserComponent implements ICellRendererAngularComp {
  private rolesService = inject(RolesService);
  private clockService = inject(ClockService);
  private timeService = inject(TimeService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private trackingService = inject(TrackingService);
  private permitionsService = inject(PermitionsService);

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
  idUser: number;
  idBranch: number;
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
    onFirstDataRendered: (params) => {
      // Una vez que los datos se han renderizado por primera vez,
      // ajustamos el tamaño de las columnas.
      // Esto evita el conflicto de renderizado.
      const allColumnIds = params.api.getColumns().map(column => column.getColId());
      params.api.autoSizeColumns(allColumnIds);
    }
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
        field: 'canRead',
        headerName: 'Ver',
        editable: true
      },
      {
        field: 'canCreate',
        headerName: 'Crear',
        editable: true
      },
      {
        field: 'canUpdate',
        headerName: 'Actualizar',
        editable: true
      },
      {
        field: 'canDelete',
        headerName: 'Borrar',
        editable: true
      },
    ];
  }

  agInit(params: ICellRendererParams & { idUser: number,idBranch: number, idRole: number, idPosicion: number }): void {
    //this.rowData = params.data; // Los datos de los permisosa
    this.idUser = params.idUser; // El ID del usuario de la fila maestra
    this.idBranch = params.idBranch; // El ID de la sucursal de la fila maestra 
    this.idRole = params.idRole; // El ID del rol de la fila maestra
    this.idPosicion = params.idPosicion; // El ID de la posición de la fila maestra
    this.obtenerDatos(this.idUser,this.idBranch,this.idRole, this.idPosicion);
  }

  refresh(params: ICellRendererParams): boolean {
    return false;
  }

  obtenerDatos(idUser: number, idBranch: number,Role: number, idPosicion: number) {
    this.permitionsService.getPermitionsDetail(idUser, idBranch, Role, idPosicion)
      .subscribe((data: any) => {
        this.rowData = [];
        this.rowData = data;
        console.log("algo aqui", this.rowData)
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
      // Asignar los IDs necesarios para la creación
      

      try {
        await lastValueFrom(
          this.permitionsService.getPermitionsByDetailedPermission(this.idUser,this.idBranch,this.idRole, this.idPosicion, row.idDetailedPermission)
        );
        const timeResponse = await lastValueFrom(this.timeService.getTime());
        cleanedData.updatedAt = timeResponse.localTime;
        cleanedData.idDetailedPermission = row.idDetailedPermission;
        console.log(cleanedData)
        updateObservables.push(
          this.permitionsService.updatePermitionsDetail(this.idUser,this.idBranch,this.idRole, this.idPosicion, row.idDetailedPermission, cleanedData)
        );
        this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Detalle de Roles', 'Menu Administracion Detalle de Roles',  this.trackingService.getEmail());
        
      } catch (error:any) {
        console.log(error)
         // Si la actualización falla con 404, significa que el permiso no existe y debemos CREARLO.
        if (error.status === 404 || error.message?.includes('No se encontró')) {
          const timeResponse = await lastValueFrom(this.timeService.getTime());
          cleanedData.createdAt = timeResponse.localTime;
          cleanedData.idDetailedPermission = row.idDetailedPermission;
          cleanedData.idUser = this.idUser;
          cleanedData.idBranch = this.idBranch;
          cleanedData.idRole = this.idRole;
          cleanedData.idPosicion = this.idPosicion;
          delete cleanedData.id;

          addObservables.push(
            this.permitionsService.addPermitions(cleanedData)
          );
          this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Detalle de Roles', 'Menu Administracion Detalle de Roles',  this.trackingService.getEmail());
        } else {
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

      // Recargamos los datos
      this.obtenerDatos(this.idUser, this.idBranch, this.idRole, this.idPosicion);

      // Forzamos el reajuste de columnas en el siguiente ciclo, después de que los datos se hayan actualizado.
      // Esto evita el conflicto de renderizado.
      setTimeout(() => this.gridApi.autoSizeAllColumns(), 0);

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
    this.obtenerDatos(this.idUser,this.idBranch,this.idRole, this.idPosicion);
    this.notSavedChanges = false;
  }

  private cleanDataForServer(data: any): any {
    const cleanedData = { ...data };
    delete cleanedData.detailedPermissionName;
    delete cleanedData.masterPermissionName;
    cleanedData.idUser = this.idUser;
      cleanedData.idBranch = this.idBranch;
      cleanedData.idRole = this.idRole;
      cleanedData.idPosicion = this.idPosicion;
    return cleanedData;
  }
}
