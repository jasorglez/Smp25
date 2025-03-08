import { Component, effect, inject } from '@angular/core';
import { ClockService } from 'app/services/clock.service';
import { AgGridModule } from 'ag-grid-angular';

@Component({
  selector: 'app-clock-db',
  standalone: true,
  imports: [AgGridModule],
  templateUrl: './db.component.html',
  styleUrl: './db.component.scss'
})
export class DbComponent {

  private clockService = inject(ClockService);

  data: any;
  idEmployee: number;

  columnDefs = [
    { headerName: 'Nombre Empleado', field: 'name', flex: 2 },
    { 
      headerName: 'Fecha y Hora', 
      field: 'timeStamp',
      flex: 2,
      valueFormatter: (params) => {
        const date = new Date(params.value);
        return date.toLocaleString('es-MX', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }
    },
    { headerName: 'Tipo', field: 'type', flex: 1 },
    { headerName: 'Válido', field: 'valid', flex: 1 },
    {headerName: 'Minutos descontados', field: 'minuteDiscount', flex: 1}
    ];

  ngOnInit()  {
      this.getData();
    }

  getData() {
    this.clockService.getCheckInfo().subscribe(
      data => {
        this.data = data;
        console.log(data);
      },
      error => {
        this.data = null;
        console.error(error)
      });
  }
}

