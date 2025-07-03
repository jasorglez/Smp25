import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbTimepickerModule } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { EmployeesService } from 'app/services/employees.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { TrackingService } from 'app/services/tracking.service';

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
  private trackingService = inject(TrackingService);
  

  idEmployee: number = null;
  horario: any = [];
  diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  isNew   : boolean = true;
  idBranch: number;
  employees: any= [];
  totalHoras: number = 0;

  baseHours: string;

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
          console.log(this.horario*8)
          this.isNew = false;
        } else {
          this.initializeWeek();
          this.isNew = true;
        }
        console.log('Estado horario:', this.isNew ? 'Nuevo' : 'Existente');
        this.trackingService.addLog(this.trackingService.getnameComp(),'Get Registro en Horario de Empleado', 'Menu Recursos Humanos Horario de Empleado',  this.trackingService.getEmail());
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
            next: (res) => {
              console.log(`Día ${dia.day} creado:`, res);
            },
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
    
    // Activar si se requiere modificar horas base
    //this.setBaseHours(this.idEmployee, this.totalHoras);

    // Opcional: Mostrar confirmación al usuario
    alerts.basicAlert('Horario guardado', `Horario ${this.isNew ? 'creado' : 'actualizado'} correctamente`, 'success');
    this.guardarHoras();
    this.trackingService.addLog(this.trackingService.getnameComp(),'Modificando Horario de Empleado', 'Menu Recursos Humanos Horario de Empleado',  this.trackingService.getEmail());
  }

  guardarHoras() {
    const index = this.employees.findIndex(emp => emp.id === this.idEmployee);
    if (index !== -1) {
      this.employees[index].baseHours = this.baseHours;
  
      this.employeesService.updateEmployee(this.idEmployee, this.employees[index])
        .subscribe({
          next: () => {
            console.log("Las horas base fueron actualizadas", "success");
            this.trackingService.addLog(this.trackingService.getnameComp(),'Modificando Horario de Empleado', 'Menu Recursos Humanos Horario de Empleado',  this.trackingService.getEmail());
          },
          error: (err) => {
            console.log("No se pudo actualizar el empleado", "error");
            console.error(err);
          }
        });
    } else {
      console.log("Empleado no encontrado", "error");
    }
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
        entry1: { ...originDay.entry1 },
        exit1: { ...originDay.exit1 },
        entry2: { ...originDay.entry2 },
        exit2: { ...originDay.exit2 },
        enabled: originDay.enabled
      };
    });
  }

  onEmployeeChange(): void {
    this.getEmployeeClock();
  }

  calcularTotalHoras(): string {
    let totalMinutos = 0;

    this.horario.forEach(dia => {
      if (dia.enabled) {
        // Suma del primer turno (entry1 y exit1)
        if (dia.entry1 && dia.exit1) {
          const minutosEntry1 = dia.entry1.hour * 60 + dia.entry1.minute;
          const minutosExit1 = dia.exit1.hour * 60 + dia.exit1.minute;
          if (minutosExit1 >= minutosEntry1) {
            totalMinutos += minutosExit1 - minutosEntry1;
          }
        }

        // Suma del segundo turno (entry2 y exit2)
        if (dia.entry2 && dia.exit2) {
          const minutosEntry2 = dia.entry2.hour * 60 + dia.entry2.minute;
          const minutosExit2 = dia.exit2.hour * 60 + dia.exit2.minute;
          if (minutosExit2 >= minutosEntry2) {
            totalMinutos += minutosExit2 - minutosEntry2;
          }
        }
      }
    });

    // Convertir minutos totales a formato HH:MM
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    this.totalHoras = totalMinutos / 60;
    const cover = minutos * 100 /6
    this.baseHours = `${horas}.${cover}`
    const horaBase = `${horas}h ${minutos}m`
    return horaBase;
  }
  

  setBaseHours(idEmployee: number, totalHoras: number) {
    this.employeesService.getEmployeeById(idEmployee).subscribe(
      (data: any) => {
        data[0].baseHours = totalHoras;
        this.employeesService.updateEmployee(idEmployee, data[0]).subscribe(
          (res) => {
            console.log('Empleado actualizado:', res);
          },
          (error) => {
            console.log(error);
          }
        );
      },
      (error) => {
        console.log(error);
      }
    );
  }
}
