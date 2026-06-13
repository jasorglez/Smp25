import { Component } from '@angular/core';
import { EmployeesxSavingsComponent } from '../savings/savings.component';

@Component({
  selector: 'app-detail-employee-savings',
  standalone: true,
  imports: [EmployeesxSavingsComponent],
  template: `<app-employeesxsavings [externalIdEmployee]="idEmployee" />`,
})
export class DetailEmployeeSavingsComponent {
  idEmployee: number | null = null;

  agInit(params: any) {
    this.idEmployee = params.data?.id ?? null;
  }
}
