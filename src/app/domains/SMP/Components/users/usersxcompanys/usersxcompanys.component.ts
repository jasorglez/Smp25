import { Component, computed } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { UsersService } from 'app/services/users.service';
import { CustomSelectComponent } from '../../custom-select/custom-select.component';
import { AgGridModule } from 'ag-grid-angular';
import { CompanysService } from 'app/services/companys.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-usersxcompanys',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './usersxcompanys.component.html',
  styleUrl: './usersxcompanys.component.scss'
})
export class UsersxcompanysComponent {

  ngOnInit() {
    this.obtenerDatos();
    this.obtenerCompanys();
  }

  signalValue = computed(() => this.usersService.emailUser());
  correo: string = this.signalValue() == '' ? 'Seleccione una fila' : this.signalValue();
  notSavedChanges: boolean = false;
  rowData: any;
  companys: { [key: string]: string } = {};
  newlyAddedRows: string[] = [];
  selectedRowData: any = null;
  id: string;
  private gridApi: GridApi;

  components = {
    customSelectEditor: CustomSelectComponent,
  };

  obtenerDatos() {
    this.usersService.getDataUsersxCompanys(this.correo).subscribe((data: any) => {
      this.rowData = Object.keys(data).map((key) => {
        return { id: key, ...data[key] };
      });
    });
  }

  obtenerCompanys() {
    this.companysService.getDataCompanys('').subscribe((data: any) => {
      this.companys = Object.entries(data).reduce((acc, [key, value]: [string, any]) => {
        acc[key] = value.displayName;
        return acc;
      }, {} as { [key: string]: string });
      console.log(this.companys);
    });
  }

  customSelectRenderer(options: { [key: string]: string }) {
    return (params: any) => {
      const value = params.value;
      const optionsArray = Object.entries(options);
      const matchingOption = optionsArray.find(([, optionValue]) => optionValue === value);
      return matchingOption ? matchingOption[0] : value; // Valor por defecto si no se encuentra coincidencia
    };
  }

  get columnDefs(): ColDef[] {
    return [{
      field: 'email',
      headerName: 'Correo',
      flex: 1
    },
    {
      field: 'id_company',
      headerName: 'Compañía',
      cellEditor: 'customSelectEditor',
      cellEditorParams: {
        options: Object.fromEntries(
          Object.entries(this.companys).map(([id, displayName]) => [displayName, id])
        )
      },
      cellRenderer: this.customSelectRenderer(
        Object.fromEntries(
          Object.entries(this.companys).map(([id, displayName]) => [displayName, id])
        )
      ),
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
      // Aquí envío el correo a la signal
      this.usersService.emailSignal(this.selectedRowData.emailu);
    } else {
      this.selectedRowData = null;
    }
  }

  onCellValueChanged(event: any) {
    console.log('Dato cambiado:', event.data);

    // Verificar si el campo modificado es 'id_company'
    if (event.colDef.field === 'id_company') {
      const selectedCompany = this.companys[event.data.id_company];
      if (selectedCompany) {
        event.data.company = selectedCompany;
      }

      // Forzar actualización de la celda de 'company'
      this.gridApi.refreshCells({ rowNodes: [event.node], columns: ['company'], force: true });
    }

    this.notSavedChanges = true;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }


  constructor(private usersService: UsersService, private companysService: CompanysService) { }

  addRow() {
    const newId = this.generateUniqueId();
    const newItem = {
      id: newId,
      company: '',
      id_company: '',
      email: this.correo,
      orden: 1
    };

    this.rowData = [newItem, ...this.rowData];
    // Añadir el ID de la nueva fila a nuestro registro
    this.newlyAddedRows.push(newId);
  }

  async saveChanges() {
    // TODO
  }

  generateUniqueId() {
    return 'new-' + Math.random().toString(36).substr(2, 9);
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
      await this.companysService.deleteUserxCompanys(id).toPromise();

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
}
