import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, HostListener, Injectable } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { UsersService } from 'app/services/users.service';
import { alerts } from 'app/helpers/alerts';

@Injectable({
  providedIn: 'root'
})

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})

export class UsersComponent {

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.notSavedChanges) {
      $event.returnValue = 'Tienes cambios sin guardar. ¿Seguro que deseas salir?';
    }
  }

  constructor(private usersService: UsersService, private http: HttpClient) { }

  ngOnInit() {
    this.obtenerDatos();
  }

  entrada: any;
  rowData: any;
  paginationPageSize = 10; // Tamaño de página
  pagination = true; // Habilitar paginación
  notSavedChanges: boolean = false;

  obtenerDatos() {
    this.usersService.getDataUsers().subscribe((data: any) => {
      this.rowData = Object.keys(data).map(key => {
        return { id: key, ...data[key] };
      });
    });
  }

  columnDefs: ColDef[] = [
    { field: 'displayName', headerName: 'Nombre', cellEditor: 'agTextCellEditor', editable: true },
    {
      field: 'age', headerName: 'Edad', cellEditor: 'agNumberCellEditor', editable: true,
      cellEditorParams: {
        min: 0,
        max: 200
      }
    },
    { field: 'country', headerName: 'País', cellEditor: 'agTextCellEditor', editable: true },
    { field: 'emailu', headerName: 'Email', cellEditor: 'agTextCellEditor', editable: true },
    { field: 'organization', headerName: 'Organización', cellEditor: 'agTextCellEditor', editable: true },
    { field: 'phone', headerName: 'Teléfono', cellEditor: 'agTextCellEditor', editable: true },
    { field: 'position', headerName: 'Posición', cellEditor: 'agTextCellEditor', editable: true }
  ];

  selectedRowData: any = null;

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
  }

  onGridReady(params: any) {
    const allColumnIds: string[] = [];
    params.columnApi.getAllColumns().forEach((column: any) => {
      allColumnIds.push(column.getId());
    });
    params.columnApi.autoSizeColumns(allColumnIds);
  }

  onCellValueChanged(event) {
    console.log('Dato cambiado:', event.data);
    this.notSavedChanges = true;
  }

  saveChanges() {
    const isValid = this.rowData.every(item => item.displayName && item.emailu);

    if (!isValid) {
      alerts.basicAlert("Añadir usuario", "Debe introducir un nombre de usuario y un correo electrónico.", "error");
      return;
    }

    const existingItems = this.rowData.filter(item => item.id.startsWith('-')); // IDs que ya existían en Firebase
    const newItems = this.rowData.filter(item => !item.id.startsWith('-')); // Nuevas filas agregadas

    const orderedData = [...existingItems, ...newItems];

    const updates = orderedData.reduce((acc, item) => {
      const { id, ...data } = item;
      acc[id] = data;
      return acc;
    }, {});

    this.usersService.updateDataUsers(updates).subscribe(response => {
      alerts.basicAlert("Editar usuario", "Datos actualizados correctamente.", "success");
      this.notSavedChanges = false;
    });
  }

  addRow() {
    const newItem = {
      id: this.generateUniqueId(), // Genera un ID único
      displayName: '',
      country: '',
      emailu: '',
      age: null,
      organization: '',
      phone: '',
      position: ''
    };

    this.rowData = [newItem, ...this.rowData];
  }

  generateUniqueId() {
    return 'id-' + Math.random().toString(36).substr(2, 9);
  }


}
