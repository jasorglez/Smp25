import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbTimepickerModule } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { EmployeesService } from 'app/services/employees.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';

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
        this.horario.sort((a, b) => this.diasSemana.indexOf(a.day) - this.diasSemana.indexOf(b.day));
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
    // Validación de campos requeridos
    const diasInvalidos = this.horario.filter(dia => 
      dia.enabled && (!dia.entry1?.hour || !dia.exit1?.hour)
    );

    if (diasInvalidos.length > 0) {
      alerts.basicAlert('Error', 'Los días activados deben tener horarios de entrada y salida 1 completos', 'error');
      return;
    }

    if (this.horario.length !== 7) {
      alerts.basicAlert('Días no completos', 'Todos los días deberían ser enviados. Este error no debería ocurrir, por favor contacte al administrador', 'error');
      return;
    }

    // Validación de que entry_1 no puede ser mayor que exit_1
    const diasInvalidos2 = this.horario.filter(dia => 
      dia.enabled && dia.entry1 && dia.exit1 && dia.entry1.hour > dia.exit1.hour
    );

    if (diasInvalidos2.length > 0) {
      alerts.basicAlert('Error', 'Los horarios de entrada no pueden ser mayores que los horarios de salida', 'error');
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
      // Crear nuevos registros para cada día
      console.log('Creando nuevo horario...');
      horarioFormateado.forEach(dia => {
        this.employeesService.addEmployeeClock(dia)
          .subscribe({
            next: (res) => console.log(`Día ${dia.day} creado:`, res),
            error: (err) => console.error(`Error creando ${dia.day}:`, err)
          });
      });
      this.isNew = false;
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
    alerts.basicAlert('Horario guardado', `Horario ${this.isNew ? 'creado' : 'actualizado'} correctamente`, 'success');
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
