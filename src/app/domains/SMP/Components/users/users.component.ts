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

  constructor(private usersService: UsersService) { }

  ngOnInit() {
    this.obtenerDatos();
    this.obtenerDepartamentos();
  }

  entrada: any;
  departamentos: any[];
  rowData: any;
  paginationPageSize = 10; // Tamaño de página
  pagination = true; // Habilitar paginación
  notSavedChanges: boolean = false;
  paginationPageSizeSelector = false;

  obtenerDatos() {
    this.usersService.getDataUsers().subscribe((data: any) => {
      this.rowData = Object.keys(data).map(key => {
        return { id: key, ...data[key] };
      });
    });
  }

  obtenerDepartamentos() {
    this.usersService.getDepartments().subscribe(data => {
      this.departamentos = Object.values(data).map((item: any) => {
        return item.name
      });
    });
  }

  get columnDefs(): ColDef[] {
    return [
      {
        field: 'id', cellRenderer: 'agCheckboxCellRenderer',
        cellEditor: 'agCheckboxCellEditor', editable: true, width: 50
      },
      { field: 'displayName', headerName: 'Nombre', cellEditor: 'agTextCellEditor', editable: true },
      {
        field: 'age', headerName: 'Edad', cellEditor: 'agNumberCellEditor', editable: true,
        cellEditorParams: {
          min: 0,
          max: 200
        },
        width: 100
      },
      {
        field: 'country', headerName: 'País', editable: true, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Mexico', 'USA', 'MEX-USA', 'Colombia', 'Chile', 'Otro'],
          valueListGap: 10
        }
      },
      {
        field: 'emailu', headerName: 'Email', cellEditor: 'agTextCellEditor', editable: true,
        valueSetter: (params: any) => {
          const email = params.newValue;
          const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const isValid = re.test(String(email).toLowerCase());

          if (isValid) {
            params.data.email = email;
            return true;
          } else {
            alerts.basicAlert("Editar usuario", "Correo electrónico no válido.", "error");
            return false;  // Rechaza el valor si no es válido
          }
        }
      },
      {
        headerName: 'Contraseña',
        field: 'password',
        cellRenderer: (params: any) => {
          return `<span>••••••••</span>`;
        },
        editable: true
      },
      {
        field: 'organization', headerName: 'Organización', editable: true, cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: this.departamentos, // Se usa cuando departamentos ya esté disponible
          valueListGap: 10
        }
      },
      { field: 'phone', headerName: 'Teléfono', cellEditor: 'agTextCellEditor', editable: true },
      { field: 'position', headerName: 'Posición', cellEditor: 'agTextCellEditor', editable: true },
      {
        field: 'picture', headerName: 'Imagen de perfil', cellEditor: 'agTextCellEditor',
        cellRenderer: (params: any) => {
          if (params.value) {
            return `<img src="${params.value}" class="text-center" style="height:100%;">`;
          } else {
            return '';
          }
        },
        editable: true
      },
    ];
  }

  selectedRowData: any = null;

  onSelectionChanged(event: any) {
    const selectedNodes = event.api.getSelectedNodes();
    if (selectedNodes.length > 0) {
      this.selectedRowData = selectedNodes[0].data;
    } else {
      this.selectedRowData = null;
    }
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
      password: '',
      age: null,
      organization: '',
      phone: '',
      position: '',
      picture: './assets/img/profile.png'
    };

    this.rowData = [newItem, ...this.rowData];
  }

  generateUniqueId() {
    return 'id-' + Math.random().toString(36).substr(2, 9);
  }

  deleteUser() {
    alerts.basicAlert("Borrar usuarios", "Función no implementada.", "info");
  }

}
