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
      const newIdRoot = companyId || rootId;
      
      console.log('🏢 Company ID from permissions:', companyId);
      console.log('🏠 Root ID from sidebar:', rootId);
      console.log('✅ Selected idRoot for branches:', newIdRoot);

      if (this.idRoot !== newIdRoot) {
        this.idRoot = newIdRoot;
        
        if (!this.idRoot) {
          this.rowData = [];
          this.branchs = [];
          alerts.basicAlert('Sucursales', 'Debe elegir una empresa primero para poder ver sus sucursales.', 'error');
        } else {
          console.log('🔄 idRoot changed, reloading data...');
          // Load branches FIRST, then data
          this.getBranches(); // ✅ IMPORTANTE: Recargar branches cuando cambie la empresa
          setTimeout(() => {
            this.obtenerDatos();
          }, 300); // Delay to ensure branches load first
        }
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
    // Load branches FIRST, then data
    this.getBranches();
    setTimeout(() => {
      this.obtenerDatos();
    }, 300); // Delay to ensure branches load first
    
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }


  obtenerDatos() {
    console.log('📊 Loading user branches data for user:', this.idUser, 'company:', this.idRoot);
    this.branchesService.getBranchesByUserAndCompany(this.idUser, this.idRoot).subscribe(
      (data: any) => {
        const sourceRows = Array.isArray(data?.project) ? data.project : [];
        this.rowData = sourceRows.map((row: any) => {
          let resolvedIdPermission = Number(row.idPermission ?? row.idBranch ?? row.branchId ?? 0);

          if (!resolvedIdPermission && row.name && Array.isArray(this.branchs)) {
            const foundByName = this.branchs.find((branch) => branch.name === row.name);
            resolvedIdPermission = foundByName ? Number(foundByName.id) : 0;
          }

          return {
            ...row,
            idPermission: resolvedIdPermission
          };
        });
        console.log('✅ User branches data loaded:', this.rowData);
        console.log('📊 Branches available for formatting:', this.branchs.length);
        this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Usuarios por Sucursal', 'Menu Administracion Usuarios por Sucursal',  this.trackingService.getEmail());
        
        // Force refresh cells after data is loaded to show branch names
        setTimeout(() => {
          if (this.gridApi && this.branchs.length > 0) {
            console.log('🔄 Refreshing cells to show branch names');
            this.gridApi.refreshCells();
          }
        }, 100);
      },
      (error) => {
        if (error.status == 404) this.rowData = [];
        console.error('Error fetching branches data:', error);
      }
    );
  }

  getBranches(){
    console.log('🔄 Loading branches for idRoot (company):', this.idRoot);
    this.branchesService.getBranches(this.idRoot).subscribe(
      (data: any) => {
        this.branchs = data;
        console.log('✅ Branches loaded successfully:', this.branchs);
        console.log('📊 Number of branches:', this.branchs.length);
        if (this.branchs.length > 0) {
          console.log('🏢 Available branches:', this.branchs.map(b => `${b.id}: ${b.name}`));
        }
      },
      (error) => {
        if (error.status == 404) {
          this.branchs = [];
          console.log('⚠️ No branches found for company (404)');
        }
        console.error('❌ Error fetching branches:', error);
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
          console.log('🏢 Branches available for dropdown:', this.branchs);
          // En agSelectCellEditor, values debe contener los nombres que se mostrarán
          return {
            values: this.branchs ? this.branchs.map((item) => item.name) : []
          };
        },
        valueFormatter: (params) => {
          console.log('🏢 Branch data for formatting:', {
            value: params.value,
            fullData: params.data,
            hasName: !!params.data?.name,
            hasIdPermission: !!params.data?.idPermission
          });
          
          // Si ya viene el name en los datos, usarlo directamente
          if (params.data?.name) {
            console.log(`✅ Using existing name: ${params.data.name}`);
            return params.data.name;
          }
          
          // Si no, buscar por idPermission en la lista de branches
          if (params.data?.idPermission) {
            const foundBranch = this.branchs.find((item) => item.id === params.data.idPermission);
            const branchName = foundBranch ? foundBranch.name : `ID: ${params.data.idPermission}`;
            console.log(`🔍 Found branch by idPermission ${params.data.idPermission} -> ${branchName}`);
            return branchName;
          }
          
          console.log('⚠️ No branch name found');
          return params.value || '';
        },
        valueSetter: (params) => {
          console.log('🔄 Setting branch value:', params.newValue);
          // Cuando se selecciona un nombre del dropdown, buscar la branch por nombre
          if (params.newValue && this.branchs) {
            const selectedBranch = this.branchs.find(b => b.name === params.newValue);
            if (selectedBranch) {
              const duplicateExists = this.rowData.some((row, index) =>
                index !== params.node.rowIndex && Number(row.idPermission) === Number(selectedBranch.id)
              );
              if (duplicateExists) {
                alerts.basicAlert('Sucursal duplicada', 'Esa sucursal ya está asignada al usuario.', 'error');
                return false;
              }

              // Solo actualizar idPermission (que es lo que soporta el endpoint)
              // El name se mostrará via valueFormatter
              params.data.idPermission = selectedBranch.id;
              params.data[params.colDef.field] = params.newValue; // Establecer el name para mostrar
              console.log(`✅ Set branch: ${selectedBranch.name} (ID: ${selectedBranch.id})`);
              return true;
            }
          }
          return false;
        },
      },
    ];
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

  onSelectedRow(event: any) {
    this.id = event.data.id;
  }

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
      const branchId = this.selectedRowData.id;
      
      if (branchId) {
        this.signalsService.setBranchFromPermissions(branchId);
      }
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {    
      console.log('📝 Cell value changed:', event.data);
      console.log('🔄 Field changed:', event.colDef.field, 'New value:', event.newValue);
      
      // When the name field (which contains the branch selection) changes
      if (event.colDef.field === 'name') {
        // The valueSetter already handled setting both name and idPermission
        console.log('🏢 Branch name changed to:', event.newValue);
        console.log('🆔 Corresponding idPermission:', event.data.idPermission);
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
    
    console.log('➕ Adding new row. Available branches:', this.branchs.length);
    console.log('🏢 New row will start without selected branch');
    
    const newItem = {
      id: tempId,
      idUser: this.idUser,
      idPermission: 0,
      name: '',
      type: this.permissionType,
      active: 1,
      __isNew: true,
    };
    
    console.log('📝 New item created:', newItem);

    this.rowData = [newItem, ...this.rowData];
    this.trackingService.addLog(this.trackingService.getnameComp(),'Add Registro en Usuarios por Sucursal', 'Menu Administracion Usuarios por Sucursal',  this.trackingService.getEmail());
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
    const isValid = this.rowData.every((item) => Number(item.idPermission) > 0);

    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe seleccionar una sucursal antes de guardar.',
        'error'
      );
      return;
    }

    const selectedBranchIds = this.rowData
      .map((item) => Number(item.idPermission))
      .filter((id) => id > 0);
    const hasDuplicates = new Set(selectedBranchIds).size !== selectedBranchIds.length;

    if (hasDuplicates) {
      alerts.basicAlert(
        'Sucursales duplicadas',
        'Hay sucursales repetidas en la tabla. Corrija antes de guardar.',
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
    // Eliminar el campo name ya que el endpoint no lo soporta
    delete cleanedData.name;
    if (cleanedData.id && cleanedData.id.toString().startsWith('temp_')) {
      delete cleanedData.id;
    }
    console.log('🧹 Cleaned data for server:', cleanedData);
    return cleanedData;
  }
}
