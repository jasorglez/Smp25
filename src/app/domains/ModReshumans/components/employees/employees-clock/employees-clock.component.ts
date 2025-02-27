import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { EmployeesService } from 'app/services/employees.service';

@Component({
  selector: 'app-employees-clock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employees-clock.component.html',
  styleUrl: './employees-clock.component.scss'
})
export class EmployeesClockComponent {

  private employeesService = inject(EmployeesService);

  idEmployee: number = 83;
  horario: any = [];
  diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  isNew: boolean = true;
  
  ngOnInit() {
    this.initializeWeek();
    this.getEmployeeClock();
  }

  initializeWeek() {
    // Base structure for 7 days
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
          this.horario = data;
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

  private formatearHora(hora: string | null): string | null {
    if (!hora) return null;
    
    // Asegurar formato HH:MM:SS
    const partes = hora.split(':');
    if (partes.length === 2) return `${hora}:00`;
    if (partes.length === 3) return hora;
    
    return null;
  }
}
