import { Component, effect, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { CommonModule } from '@angular/common';
import { NgFor } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [ NgFor, ReactiveFormsModule ],
  templateUrl: './payroll.component.html',
})
export class PayrollComponent {
  idBranch: number;
  private signalsService = inject(SignalsService); 
  formBuilder = inject(FormBuilder);
  diasSemana = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo'
  ];

  constructor() {
      effect(() => {
        this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      });
  }

  myForm: FormGroup = this.formBuilder.group({
    startDay: ['', Validators.required, []],
    Periodo: ['', [Validators.required, Validators.minLength(1)], []],

  })

  onSubmit() {
    if(this.myForm.invalid){
      this.myForm.markAllAsTouched();
    }
    console.log(this.myForm.value)
  }
  revertChanges() {
    //this.getData(); // Refrescar datos
  }
    
}
