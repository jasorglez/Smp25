import { Component, computed, effect, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { UsersProfileComponent } from './users-profile.component';
import { catchError, concat, EMPTY, lastValueFrom, toArray, forkJoin } from 'rxjs';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { SignalsService } from 'app/services/signals.service';
import { BranchsService } from 'app/services/branchs.service';
import { environment } from '@env/environment';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-usersxbranches',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, UsersProfileComponent],
  templateUrl: './usersxpermissions.component.html'
})
export class UsersxbranchesComponent {

  private signalsService = inject(SignalsService);
  private branchesService = inject(BranchsService);
  private usersxbranchesService = inject(UsersxpermissionsService);
  private trackingService = inject(TrackingService);

    // Signals con correo
    profile = computed(() => this.signalsService.profile);

    idUser: any = this.profile().idUser();
  
    notSavedChanges        : boolean = false;
    rowData                : any [] = [];;
    branchs                : any [] = [];
    newlyAddedRows         : string[] = [];
    selectedRowData        : any = null;
    id                     : string;
    idRoot                 : number;
    private gridApi        : GridApi;
    private tempIdCounter  : number = 0;
    private permissionType : string = 'branch';

  constructor() {
    effect(async () => {
      const companyId = await this.signalsService.getCompanyFromPermissions()();
      const rootId = await this.signalsService.getRootSelectedBySidebar()();

      // Priorizar companyId si existe, de lo contrario usar rootId
      this.idRoot = companyId || rootId;

      if (!this.idRoot) {
        this.rowData = [];
        this.branchs = [];
        alerts.basicAlert('Sucursales', 'Debe elegir una empresa primero para poder ver sus sucursales.', 'error');
      } else {
        this.obtenerDatos();
      }
    });
  }

  ngOnInit() {
    if (this.signalsService.getemailChoose() === environment.root) {
       this.idRoot = this.signalsService.getCompanyFromPermissions()();    
    }
    
    if (this.signalsService.getemailChoose() !== environment.root) {
       this.idRoot = this.signalsService.getRootSelectedBySidebar()()
    }
    //alert('id Root ' + this.idRoot);   
    this.obtenerDatos();
    this.getBranches();
    
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }


  obtenerDatos() {        
    this.branchesService.getBranchesByUserAndCompany(this.idUser, this.idRoot).subscribe(
      (data: any) => {
        this.rowData = data.project; // Extract the array from the response     
        console.log(data);
        this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Usuarios por Sucursal', 'Menu Administracion Usuarios por Sucursal',  this.trackingService.getEmail());
      },
      (error) => {
        if (error.status == 404) this.rowData = [];
        console.error('Error fetching data:', error);
      }
    );
  }

  getBranches(){
     //  alert('id User ' + this.idUser);
     //  alert('id Root ' + this.idRoot);
    this.usersxbranchesService.getDataUsersxPermissionsbranch(this.idRoot, this.idUser).subscribe(
      (data: any) => {
        this.id      = data.id ;
        console.log('this.id', this.id)  
        this.branchs = data 
        console.log(this.branchs)     
      },
      (error) => {
        if (error.status == 404) this.branchs = [];
        console.error('Error fetching data:', error);
      }
    );

  }


  get columnDefs(): ColDef[] {
    return [
      {
        field: 'idUser',
        headerName: 'ID del Usuario',
        hide: true,
      },
      {
        field: 'name',
        headerName: 'Sucursal',
        editable: true,
        suppressMovable: true,
        filter: false,
        width: 330,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => {
          return {
            values: this.branchs ? this.branchs.map((item) => item.id) : []
          };
        },
        valueFormatter: (params) => {
          if (!params.value) return '';
          const foundBranch = this.branchs.find((item) => item.id === params.value);
          return foundBranch ? foundBranch.name : params.value;
        },
      },
    ];
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

  onSelectedRow(event: any) {
    this.id = event.data.id;
    console.log('this.id', this.id)
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      this.signalsService.setBranchFromPermissions(this.selectedRowData.idPermission);
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {    
      console.log('Dato cambiado:', event.data);
      
      // When the name field (which contains the branch selection) changes
      if (event.colDef.field === 'name') {
        // The event.newValue contains the selected branch ID from the dropdown
        event.data.idPermission = event.newValue;                     
      }
            
      event.data.__modified = true;
      this.notSavedChanges = true;          

    // Verificar si el campo modificado es 'id_company'
    if (event.colDef.field === 'id_company') {
      const selectedCompany = this.branchs[event.data.idCompany];
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
    // Get first branch ID if available, otherwise empty
    const defaultBranchId = this.branchs.length > 0 ? this.branchs[0].id : 0;
    const newItem = {
      id: tempId,
      idUser: this.idUser,
      idPermission: defaultBranchId,
      type: this.permissionType,
      active: 1,
      __isNew: true,
    };

    this.rowData = [newItem, ...this.rowData];
    this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Usuarios por Sucursal', 'Menu Administracion Usuarios por Sucursal',  this.trackingService.getEmail());
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.id);

    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe seleccionar una sucursal antes de guardar.',
        'error'
      );
      return;
    }

    const newRows = this.rowData.filter((row) => row.__isNew);
    console.log('newRows', newRows)
    const modifiedRows = this.rowData.filter(
      (row) => row.__modified && !row.__isNew
    );

    const addObservables = newRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Usuarios por Sucursal', 'Menu Administracion Usuarios por Sucursal',  this.trackingService.getEmail());
      return this.usersxbranchesService.addUserxPermission(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Usuarios por Sucursal', 'Menu Administracion Usuarios por Sucursal',  this.trackingService.getEmail());
      return this.usersxbranchesService.updateUserxPermission(row.id, cleanedData);
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
      this.obtenerDatos(); // Refrescar los datos
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
    const id = selectedData.internalId;
    this.usersxbranchesService.deleteUserxPermission(id).pipe(
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
          this.obtenerDatos();
          this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Registro en Usuarios por Sucursal', 'Menu Administracion Usuarios por Sucursal',  this.trackingService.getEmail());
          this.notSavedChanges = false;
          this.selectedRowData = null;
        }
      );
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
    this.trackingService.addLog(this.trackingService.getnameComp(),'Revertir Registro en Usuarios por Sucursal', 'Menu Administracion Usuarios por Sucursal',  this.trackingService.getEmail());
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
