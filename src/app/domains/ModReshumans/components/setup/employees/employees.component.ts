import { Component, effect, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [  ReactiveFormsModule ],
  templateUrl: './employees.component.html',
})
export class EmployeesComponent {
  idBranch: number;
  private signalsService = inject(SignalsService); 
  formBuilder = inject(FormBuilder);

  constructor() {
      effect(() => {
        this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      });
    }

  myForm: FormGroup = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(3)], []],  
    prefijo: ['', Validators.required, []], 
    phone: ['', [Validators.required, Validators.minLength(10)], []], 
    email: ['', [Validators.required, Validators.email], []],  
    company: ['', [Validators.required, Validators.minLength(3)], []],
    rol: ['', Validators.required, []]
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
