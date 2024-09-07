import { Component, computed, HostListener } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { alerts } from 'app/helpers/alerts';
import { CompanysService } from 'app/services/companys.service';
import { OilfieldService } from 'app/services/oilfield.service';
import { UsersService } from 'app/services/users.service';
import { UsersxoilfieldsService } from 'app/services/usersxoilfields.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { UsersProfileComponent } from '../users-profile/users-profile.component';

@Component({
  selector: 'app-usersxoilfields',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule, UsersProfileComponent],
  templateUrl: './usersxoilfields.component.html',
  styleUrl: './usersxoilfields.component.scss'
})
export class UsersxoilfieldsComponent {

  constructor(private usersService: UsersService, private oilfieldsService: OilfieldService,
    private usersxoilfieldsService: UsersxoilfieldsService, private companysService: CompanysService) { }

  ngOnInit() {
    this.obtenerDatos();
    this.obtenerCompanys();
    this.obtenerOilfields();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue =
        'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  //Signals con correo
  profile = computed(() => this.usersService.profile);
  correo: any = this.profile().emailUser();

  notSavedChanges: boolean = false;
  rowData: any;
  oilfields: { [key: string]: string } = {};
  companys: any;
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;

  obtenerDatos() {
    this.usersxoilfieldsService.getDataUsersxOilfields(this.correo).subscribe((data: any) => {
      this.rowData = Object.keys(data).map((key) => {
        return { id: key, ...data[key] };
      });
    });
  }

  obtenerOilfields() {
    this.oilfieldsService.Oilfield().subscribe((data: any) => {
      this.oilfields = data.reduce((acc, item) => {
        acc[item.id] = item.name;
        return acc;
      }, {} as { [key: number]: string });
    });
  }

  obtenerCompanys() {
    this.usersxoilfieldsService.getCompanys().subscribe((data: any) => {
      this.companys = Object.values(data).map((item: any) => {
        return item.displayName;
      });
    });

  }

   get columnDefs(): ColDef[] {
    return [{
      field: 'email',
      headerName: 'Correo',
      flex: 1
    },
    {
      field: 'id_oil',
      headerName: 'Campo petrolero',
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: {
        values: Object.keys(this.oilfields),
        formatValue: (value) => this.oilfields[value]
      },
      valueFormatter: (params) => this.oilfields[params.value] || '',
      editable: true,
      flex: 2
    },
    {
      field: 'company',
      headerName: 'Compañía',
      editable: true,
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: {
        values: this.companys, // Se usa cuando departamentos ya esté disponible
        selectOnPopup: true
      },
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
      company: '',
      id_oil: '',
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
      (item) => item.company && item.id_oil
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

    this.usersxoilfieldsService.bulkUpdateUsersxOilfields(updatedRows).subscribe(
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
      await this.usersxoilfieldsService.deleteUserxOilfield(id).toPromise();

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
