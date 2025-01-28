import { Component, computed, effect, HostListener, inject } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { UsersProfileComponent } from './users-profile.component';
import { SignalsService } from 'app/services/signals.service';
import { MasterPermissionsService } from 'app/services/master-permissions.service';

@Component({
  selector: 'app-usersxmasterpermissions',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, UsersProfileComponent],
  templateUrl: './usersxmasterpermissions.component.html'
})
export class UsersxMasterPermissionsComponent {

  private signalsService = inject(SignalsService);
  private masterPermissionsService = inject(MasterPermissionsService);

  profile = computed(() => this.signalsService.profile);

  id: string;
  idUser: number = null;
  rowData: any;
  selectedRowData: any = null;
  notSavedChanges: boolean = false;
  private gridApi: GridApi;
  newData: boolean = false;

  constructor() {
    effect(() => {
      this.idUser = Number(this.signalsService.profile.idUser());
      this.obtenerDatos();
    });
  }

  obtenerDatos() {
    this.masterPermissionsService
      .getMasterPermissionByUser(this.idUser)
      .subscribe({
        next: (data: any) => {
          this.rowData = data.filter((row: any) => row.idUser === this.idUser);
          this.newData = false;
        },
        error: (error) => {
          if (error.status === 404) {
            this.rowData = [{
              idUser: this.idUser,
              indicators: false,
              administration: false,
              warehouses: false,
              maintenance: false,
              hr: false,
              sales: false,
              setup: false,
              active: true
            }];
            this.newData = true;
          }
        }
      });
  }

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'idUser',
        headerName: 'ID Usuario',
        hide: true
      },
      {
        field: 'indicators',
        headerName: '¿Indicadores?',
        editable: true,
        cellDataType: 'boolean',
        width: 150,
        autoHeaderHeight: true
      },
      {
        field: 'administration',
        headerName: '¿Administración?',
        editable: true,
        cellDataType: 'boolean',
        width: 150,
        autoHeaderHeight: true
      },
      {
        field: 'warehouses',
        headerName: '¿Almacenes?',
        editable: true,
        cellDataType: 'boolean',
        width: 150,
        autoHeaderHeight: true
      },
      {
        field: 'maintenance',
        headerName: '¿Mantenimiento?',
        editable: true,
        cellDataType: 'boolean',
        width: 150,
        autoHeaderHeight: true
      },
      {
        field: 'hr',
        headerName: '¿Recursos Humanos?',
        editable: true,
        cellDataType: 'boolean',
        width: 150,
        autoHeaderHeight: true
      },
      {
        field: 'sales',
        headerName: '¿Ventas?',
        editable: true,
        cellDataType: 'boolean',
        width: 150,
        autoHeaderHeight: true
      },
      {
        field: 'setup',
        headerName: '¿Setup?',
        editable: true,
        cellDataType: 'boolean',
        width: 150,
        autoHeaderHeight: true
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
    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  async saveChanges() {
    const isValid = this.rowData.every((item) => item.idUser);

    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe seleccionar una sucursal antes de guardar.',
        'error'
      );
      return;
    }

    const dataToSave = this.rowData[0];
    delete dataToSave.__new;

    if (this.newData) {
      this.masterPermissionsService.addMasterPermission(dataToSave)
        .subscribe({
          next: () => {
            alerts.basicAlert('Éxito', 'Permisos creados correctamente', 'success');
            this.newData = false;
            this.notSavedChanges = false;
            this.obtenerDatos();
          },
          error: (error) => {
            alerts.basicAlert('Error', 'No se pudieron crear los permisos', 'error');
          }
        });
    } else {
      this.masterPermissionsService.updateMasterPermission(this.idUser, dataToSave)
        .subscribe({
          next: () => {
            alerts.basicAlert('Éxito', 'Permisos actualizados correctamente', 'success');
            this.notSavedChanges = false;
            this.obtenerDatos();
          },
          error: (error) => {
            alerts.basicAlert('Error', 'No se pudieron actualizar los permisos', 'error');
          }
        });
    }
  }

  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }
}
