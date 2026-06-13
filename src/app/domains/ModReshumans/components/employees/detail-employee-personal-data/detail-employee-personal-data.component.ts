import { Component } from '@angular/core';
import { EmployeePersonalDataComponent } from '../personal-data/personal-data.component';

@Component({
  selector: 'app-detail-employee-personal-data',
  standalone: true,
  imports: [EmployeePersonalDataComponent],
  template: `<app-employee-personal-data [employeeData]="employeeData" />`,
})
export class DetailEmployeePersonalDataComponent {
  employeeData: any = null;

  agInit(params: any) {
    this.employeeData = params.data ?? null;
  }
}
