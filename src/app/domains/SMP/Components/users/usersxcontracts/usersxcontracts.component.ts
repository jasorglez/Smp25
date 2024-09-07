import { Component, computed, HostListener } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { UsersService } from 'app/services/users.service';
import { ContractsService } from 'app/services/contracts.service';
import { UsersxcontractsService } from 'app/services/usersxcontracts.service';
import { CompanysService } from 'app/services/companys.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { UsersProfileComponent } from '../users-profile/users-profile.component';

@Component({
  selector: 'app-usersxcontracts',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, UsersProfileComponent],
  templateUrl: './usersxcontracts.component.html',
  styleUrl: './usersxcontracts.component.scss'
})
export class UsersxcontractsComponent {
  constructor(private usersService: UsersService, private contractsService: ContractsService,
    private usersxcontractsService: UsersxcontractsService,
    private companysService: CompanysService) { }

    @HostListener('window:beforeunload', ['$event'])
    unloadNotification($event: any): void {
      if (this.notSavedChanges) {
        $event.returnValue =
          'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
      }
    }

  ngOnInit() {
    this.obtenerDatos();
    this.obtenercontracts();
  }

  //Signals con correo
  profile = computed(()=> this.usersService.profile);
  correo: any = this.profile().emailUser();
  notSavedChanges: boolean = false;
  rowData: any;
  contracts: { [key: string]: string } = {};
  companys: any;
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;

  obtenerDatos() {
    this.usersxcontractsService.getDataUsersxContracts(this.correo).subscribe((data: any) => {
      this.rowData = Object.keys(data).map((key) => {
        return { id: key, ...data[key] };
      });
    });
  }

  obtenercontracts() {
    this.contractsService.getContracts().subscribe((data: any) => {
      this.contracts = data.reduce((acc, item) => {
        acc[item.id] = item.descripSmall;
        return acc;
      }, {} as { [key: number]: string });
    });
  }

  get columnDefs(): ColDef[] {
    return [{
      field: 'email',
      headerName: 'Correo',
      flex: 1
    },
    {
      field: 'id_contract',
      headerName: 'Contrato',
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: {
        values: Object.keys(this.contracts),
        formatValue: (value) => this.contracts[value]
      },
      valueFormatter: (params) => this.contracts[params.value] || '',
      editable: true,
      flex: 2
    },
    {
      field: 'orden',
      headerName: 'Orden',
      sortable: true,
      width: 50,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: {
        min: 1
      },
      editable: true
    }
    ]
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
    this.notSavedChanges = true;
    event.data.__modified = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  addRow() {
    const newId = this.generateUniqueId();
    const newItem = {
      id: newId,
      id_contract: '',
      email: this.correo,
      orden: 1
    };

    this.rowData = [newItem, ...this.rowData];
    // Añadir el ID de la nueva fila a nuestro registro
    this.newlyAddedRows.push(newId);
  }

  generateUniqueId() {
    return 'new-' + Math.random().toString(36).substr(2, 9);
  }

  saveChanges() {
    const isValid = this.rowData.every(
      (item) => item.orden && item.id_contract
    );
  
    if (!isValid) {
      alerts.basicAlert(
        'Añadir entrada',
        'Debe seleccionar un proyecto y un branch antes de guardar.',
        'error'
      );
      return;
    }
  
     // Filtrar solo las filas que han sido modificadas o son nuevas
     const updatedRows = this.rowData.filter(row => 
      this.newlyAddedRows.includes(row.id) || row.__modified
    );

    // Eliminar la propiedad __modified antes de enviar los datos
    updatedRows.forEach(row => {
      delete row.__modified;
    });

    this.usersxcontractsService.bulkUpdateUsersxContracts(updatedRows).subscribe(
      (response) => {
        alerts.basicAlert(
          'Datos actualizados',
          'Se han actualizado los datos correctamente.',
          'success'
        );
        this.notSavedChanges = false;
        this.newlyAddedRows = [];
        this.obtenerDatos(); // Refrescar los datos
      },
      (error) => {
        alerts.basicAlert(
          'Error',
          'Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.',
          'error'
        );
      }
    );
  }

  async deleteEntry() {
    try {
      const selectedNodes = this.gridApi.getSelectedNodes();
      if (selectedNodes.length === 0) {
        alerts.basicAlert(
          'Eliminar entrada',
          'Por favor, seleccione una entrada para eliminar.',
          'warning'
        );
        return;
      }

      const selectedData = selectedNodes[0].data;
      const id = selectedData.id;

      // Elimina al usuario de la DB de Firebase
      await this.usersxcontractsService.deleteUserxContract(id).toPromise();

      // Refrescar los datos después de eliminar
      this.obtenerDatos();

      alerts.basicAlert(
        'Eliminar entrada',
        'Entrada eliminada satisfactoriamente.',
        'success'
      );
      this.notSavedChanges = false;
      this.selectedRowData = null;
    } catch (error) {
      alerts.basicAlert(
        'Eliminar entrada',
        'Error al eliminar la entrada.',
        'error'
      );
    }
  }
  revert() {
    this.obtenerDatos();
    this.notSavedChanges = false;
  }

}
