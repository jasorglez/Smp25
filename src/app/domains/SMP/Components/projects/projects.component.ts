import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridReadyEvent } from 'ag-grid-enterprise';
import { ReceivedataService } from 'app/services/receivedata.service';
import { tap, catchError, of, finalize } from 'rxjs';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss'
})
export class ProjectsComponent {

  constructor(private getData:ReceivedataService) {}

  ngOnInit() {
    this.obtenerDatos();
  }

  entrada: any;
  rowData: any;
  paginationPageSize = 10; // Tamaño de página
  pagination = true; // Habilitar paginación

  obtenerDatos() {
    this.getData.receiveUsers('https://beapp-501d1-default-rtdb.firebaseio.com/', 'projects').pipe(
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
    { field: 'contract', headerName: 'Nombre del contrato' },
    { field: 'description', headerName: 'Descripción' },
    { field: 'ubication', headerName: 'Ubicación' }
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
