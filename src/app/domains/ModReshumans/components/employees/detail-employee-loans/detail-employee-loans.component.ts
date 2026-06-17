import { inject, Component, input, ChangeDetectorRef} from '@angular/core';
import { EmployeesxLoansComponent } from '../loans/loans.component';

@Component({
  selector: 'app-detail-employee-loans',
  standalone: true,
  imports: [EmployeesxLoansComponent],
  template: `<app-employeesxloans [externalIdEmployee]="idEmployee" />`,
})
export class DetailEmployeeLoansComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  idEmployee: number | null = null;

  agInit(params: any) {
    this.idEmployee = params.data?.id ?? null;
  
    this.cdr.detectChanges();}
}
