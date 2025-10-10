import { Component, computed, effect, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { UsersProfileComponent } from './users-profile.component';
import { catchError, concat, EMPTY, lastValueFrom, toArray } from 'rxjs';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { SignalsService } from 'app/services/signals.service';
import { ProvidersService } from 'app/services/providers.service';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-usersxcompanys',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, UsersProfileComponent],
  templateUrl: './usersxpermissions.component.html'
})
export class UsersxcompanysComponent {

  private providersService = inject(ProvidersService);
  private usersxcompanysService = inject(UsersxpermissionsService);
  private signalsService = inject(SignalsService);
  private trackingService = inject(TrackingService);

  ngOnInit() {
    this.obtenerDatos();
    this.obtenerCompanys();
  }

 constructor() {
  effect(() => {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    console.log('🔄 Effect triggered with idRoot:', this.idRoot);
    
    // Load companies first, then data
    this.obtenerCompanys();
    setTimeout(() => {
      this.obtenerDatos();
    }, 200); // Small delay to ensure companies load first
  })
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
  companys: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  idRoot: number;
  private gridApi: GridApi;
  private tempIdCounter: number = 0;
  private permissionType: string = 'comp-prov';

  obtenerDatos() {
    console.log('📊 Loading user permissions data for user:', this.idUser);
    this.usersxcompanysService
      .getDataUsersxPermissions(this.permissionType)
      .subscribe((data: any) => {
        this.rowData = data.filter((row: any) => row.idUser === this.idUser);
        console.log('✅ User permissions loaded:', this.rowData);
        this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Usuarios por Contratista', 'Menu Administracion Usuarios por Contratista',  this.trackingService.getEmail());
        
        // Force refresh cells after data is loaded to show company names
        setTimeout(() => {
          if (this.gridApi && Object.keys(this.companys).length > 0) {
            console.log('🔄 Refreshing cells to show company names');
            this.gridApi.refreshCells();
          }
        }, 100);
      });
  }

  obtenerCompanys() {
    console.log('🏢 Loading companies for idRoot:', this.idRoot);
    this.providersService.getProviders(this.idRoot).subscribe({
      next: (data: any[]) => {
        console.log('✅ Companies data received:', data);
        this.companys = data.reduce((acc, dep) => {
          acc[dep.id] = dep.name;
          return acc;
        }, {});
        console.log('📊 Companies mapped:', this.companys);
        console.log('🔢 Number of companies:', Object.keys(this.companys).length);
        
        // Force grid refresh after companies are loaded
        if (this.gridApi) {
          this.gridApi.refreshCells();
        }
      },
      error: (error) => {
        console.error('❌ Error loading companies:', error);
        if (error.status === 404) {
          this.companys = {};
          console.log('⚠️ No companies found (404)');
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
        headerName: 'Contratista',
        cellEditor: 'agRichSelectCellEditor',
        cellEditorParams: () => {
          console.log('📋 Companies available for dropdown:', this.companys);
          const companyIds = Object.keys(this.companys);
          console.log('🔢 Company IDs:', companyIds);
          return {
            values: companyIds.sort((a, b) => this.companys[a]?.localeCompare(this.companys[b]) || 0),
          };
        },
        valueFormatter: (params) => {
          const companyName = this.companys[params.value];
          console.log(`🏢 Formatting company ID ${params.value} -> ${companyName}`);
          return companyName || `ID: ${params.value}`;
        },
        valueSetter: (params) => {
          const newValue = params.newValue;
          if (this.companys.hasOwnProperty(newValue)) {
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
      this.enviarCompanyId();
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    console.log('📝 Cell value changed:', {
      field: event.colDef.field,
      oldValue: event.oldValue,
      newValue: event.newValue,
      rowData: event.data
    });
    
    // Only call enviarCompanyId if the idPermission field changed
    if (event.colDef.field === 'idPermission') {
      console.log('🏢 Company selection changed, sending company ID');
      // Don't call enviarCompanyId immediately to avoid triggering side effects
      // this.enviarCompanyId();
    }
    
    event.data.__modified = true;
    this.notSavedChanges = true;
    
    console.log('🔄 Row marked as modified:', event.data);
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const tempId = `temp_${this.tempIdCounter++}`;
    
    console.log('➕ Adding new company row. Available companies:', Object.keys(this.companys).length);
    
    // Get first company ID if available, otherwise 0
    const defaultCompanyId = Object.keys(this.companys).length > 0 ? Object.keys(this.companys)[0] : 0;
    
    console.log('🏢 Default company ID for new row:', defaultCompanyId);
    
    const newItem = {
      id: tempId,
      idUser: this.idUser,
      idPermission: defaultCompanyId,
      type: this.permissionType,
      active: 1,
      __isNew: true,
    };
    
    console.log('📝 New company item created:', newItem);

    this.rowData = [newItem, ...this.rowData];
    this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Usuarios por Contratista', 'Menu Administracion Usuarios por Contratista',  this.trackingService.getEmail());
    this.newlyAddedRows.push(tempId);
    this.notSavedChanges = true;
    
    // Force grid refresh to ensure dropdown works
    setTimeout(() => {
      if (this.gridApi) {
        this.gridApi.refreshCells();
      }
    }, 100);
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.idPermission);

    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe seleccionar una compañía antes de guardar.',
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
      this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Usuarios por Contratista', 'Menu Administracion Usuarios por Contratista',  this.trackingService.getEmail());
      return this.usersxcompanysService.addUserxPermission(cleanedData);
    });

    const updateObservables = modifiedRows.map((row) => {
      const cleanedData = this.cleanDataForServer(row);
      this.trackingService.addLog(this.trackingService.getnameComp(),'Update Registro en Usuarios por Contratista', 'Menu Administracion Usuarios por Contratista',  this.trackingService.getEmail());
      return this.usersxcompanysService.updateUserxPermission(row.id, cleanedData);
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
    const id = selectedData.id;
    selectedData.active = 0;
    this.usersxcompanysService.deleteUserxPermission(id).pipe(
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
          this.signalsService.idCompany.set(null);
          this.signalsService.nameCompany.set(null);
          this.obtenerDatos();

          alerts.basicAlert(
            'Eliminar entrada',
            'Entrada eliminada satisfactoriamente.',
            'success'
          );
          this.notSavedChanges = false;
          this.trackingService.addLog(this.trackingService.getnameComp(),'Delete Registro en Usuarios por Contratista', 'Menu Administracion Usuarios por Contratista',  this.trackingService.getEmail());
          this.selectedRowData = null;
        }
      );
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
    this.trackingService.addLog(this.trackingService.getnameComp(),'Revertir Registro en Usuarios por Contratista', 'Menu Administracion Usuarios por Contratista',  this.trackingService.getEmail());
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

  enviarCompanyId() {
    const companyName = this.getCompanyName(this.selectedRowData.idPermission);
     this.signalsService.companySignal(this.selectedRowData.idPermission, companyName);
  }

  getCompanyName(id: number): string {
    return this.companys[id] || 'Departamento no encontrado';
  }
}
