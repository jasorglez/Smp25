import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbTimepickerModule } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { EmployeesService } from 'app/services/employees.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-employees-clock',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NgbTimepickerModule, NgSelectComponent],
  templateUrl: './employees-clock.component.html',
  styleUrl: './employees-clock.component.scss'
})
export class EmployeesClockComponent {

  private employeesService = inject(EmployeesService);
  private signalsService = inject(SignalsService);

  idEmployee: number = null;
  horario: any = [];
  diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  isNew: boolean = true;
  idBranch: number;
  employees: any[] = [];
  
  ngOnInit() {
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.getEmployees();
    this.initializeWeek();
    this.getEmployeeClock();
  }

  constructor() {
    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.idEmployee = null;
      this.getEmployees();
      this.initializeWeek();
      this.getEmployeeClock();
    });
  }

  getEmployees() {
    this.employeesService.getEmployees(this.idBranch).subscribe(
      (data: any) => {
        this.employees = data;
        console.log('Empleados:', data);
      },
      (error) => {
        console.log(error);
      })
  }

  initializeWeek() {
    this.horario = this.diasSemana.map((day, index) => ({
      id: index + 1,
      day: day,
      enabled: false,
      entry1: null,
      exit1: null,
      entry2: null,
      exit2: null
    }));
  }

  resetDay(index: number) {
    this.horario[index] = {
      ...this.horario[index],
      enabled: false,
      entry1: null,
      exit1: null,
      entry2: null,
      exit2: null
    };
  }

  getEmployeeClock() {
    this.employeesService.getEmployeeClock(this.idEmployee).subscribe(
      (data: any) => {
        if (data && data.length > 0) {
          this.horario = data.map((dia: any) => ({
            ...dia,
            entry1: this.parseHora(dia.entry1),
            exit1: this.parseHora(dia.exit1),
            entry2: this.parseHora(dia.entry2),
            exit2: this.parseHora(dia.exit2)
          }));
          this.isNew = false;
        } else {
          this.initializeWeek();
          this.isNew = true;
        }
        console.log('Estado horario:', this.isNew ? 'Nuevo' : 'Existente');
      },
      (error) => {
        console.log(error);
        this.initializeWeek();
        this.isNew = true;
      }
    );
  }

  private parseHora(horaString: string | null): { hour: number, minute: number } | null {
    if (!horaString) return null;
    const [hours, minutes] = horaString.split(':').map(Number);
    return { hour: hours, minute: minutes };
  }

  guardarHorario() {
    if (this.horario.length !== 7) {
      alert('Debe haber exactamente 7 días configurados');
      return;
    }

    const horarioFormateado = this.horario.map((dia: any) => ({
      idEmployee: this.idEmployee,
      day: dia.day,
      enabled: dia.enabled,
      entry1: this.formatearHora(dia.entry1),
      exit1: this.formatearHora(dia.exit1),
      entry2: this.formatearHora(dia.entry2),
      exit2: this.formatearHora(dia.exit2),
      active: true
    }));

    if (this.isNew) {
      // Lógica para nuevo horario (crear todos los días)
      console.log('Creando nuevo horario...');
      // this.employeesService.addEmployeeClock(this.idEmployee, horarioFormateado).subscribe(...)
    } else {
      // Actualizar días existentes uno por uno
      console.log('Actualizando horario existente...');
      horarioFormateado.forEach(dia => {
        this.employeesService.updateEmployeeClock(this.idEmployee, dia.day, dia)
          .subscribe({
            next: (res) => console.log(`Día ${dia.day} actualizado:`, res),
            error: (err) => console.error(`Error actualizando ${dia.day}:`, err)
          });
      });
    }
    
    // Opcional: Mostrar confirmación al usuario
    alert(`Horario ${this.isNew ? 'creado' : 'actualizado'} correctamente`);
  }

  private formatearHora(hora: any): string | null {
    if (!hora || !hora.hour) return null;
    return `${hora.hour.toString().padStart(2, '0')}:${hora.minute.toString().padStart(2, '0')}:00`;
  }

  applyToAllDays(originIndex: number) {
    const originDay = this.horario[originIndex];
    this.horario = this.horario.map((dia, index) => {
      if (index === originIndex) return dia; // No modificar el día origen
      return {
        ...dia,
        entry1: {...originDay.entry1},
        exit1: {...originDay.exit1},
        entry2: {...originDay.entry2},
        exit2: {...originDay.exit2},
        enabled: originDay.enabled
      };
    });
  }

  onEmployeeChange(): void {
    this.getEmployeeClock();
  }
}
