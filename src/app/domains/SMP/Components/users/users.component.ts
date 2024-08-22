import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { object } from '@angular/fire/database';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community';
import { RowSelectedEvent } from 'ag-grid-enterprise';
import { ReceivedataService } from 'app/services/receivedata.service';
import { catchError, finalize, of, tap } from 'rxjs';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})

export class UsersComponent {

  constructor(private getData:ReceivedataService) {}

  ngOnInit() {
    this.obtenerDatos();
  }

  entrada: any;
  rowData: any;
  paginationPageSize = 10; // Tamaño de página
  pagination = true; // Habilitar paginación

  obtenerDatos() {
    this.getData.receiveUsers('https://beapp-501d1-default-rtdb.firebaseio.com/', 'users').pipe(
      tap((data: any[]) => {
        this.entrada = data;
        this.rowData = Object.values(this.entrada);
      }),
      catchError(error => {
        console.error('Error occurred:', error);
        return of(null);
      }),
      finalize(() => {

      })
    ).subscribe();
  }

  columnDefs:ColDef[] = [
    { field: 'displayName', headerName: 'Nombre' },
    { field: 'age', headerName: 'Edad' },
    { field: 'country', headerName: 'País' },
    { field: 'emailu', headerName: 'Email' },
    { field: 'organization', headerName: 'Organización' },
    { field: 'phone', headerName: 'Teléfono' },
    { field: 'position', headerName: 'Posición' }
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

  onGridReady(params: GridReadyEvent) {
    params.api.sizeColumnsToFit();
  }
}
