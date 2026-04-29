import { Component } from '@angular/core';
import { EmployeesClockComponent } from '../employees-clock/employees-clock.component';

@Component({
  selector: 'app-detail-employee-clock',
  standalone: true,
  imports: [EmployeesClockComponent],
  templateUrl: './detail-employee-clock.component.html',
})
export class DetailEmployeeClockComponent {
  idEmployee: number | null = null;

  agInit(params: any) {
    this.idEmployee = params.data?.id ?? null;
  }
}
