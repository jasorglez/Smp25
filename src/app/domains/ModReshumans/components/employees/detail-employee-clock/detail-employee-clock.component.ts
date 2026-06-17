import { inject, Component, ChangeDetectorRef} from '@angular/core';
import { EmployeesClockComponent } from '../employees-clock/employees-clock.component';

@Component({
  selector: 'app-detail-employee-clock',
  standalone: true,
  imports: [EmployeesClockComponent],
  templateUrl: './detail-employee-clock.component.html',
})
export class DetailEmployeeClockComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  idEmployee: number | null = null;

  agInit(params: any) {
    this.idEmployee = params.data?.id ?? null;
  
    this.cdr.detectChanges();}
}
