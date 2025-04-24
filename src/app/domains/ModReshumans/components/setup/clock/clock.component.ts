import { Component, effect, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';


@Component({
  selector: 'app-clock',
  standalone: true,
  imports: [ ReactiveFormsModule ],
  templateUrl: './clock.component.html',
})
export class ClockComponent {
  idBranch: number;
  private signalsService = inject(SignalsService); 
  formBuilder = inject(FormBuilder);

  constructor() {
      effect(() => {
        this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      });
    }

  myForm: FormGroup = this.formBuilder.group({
    Vigencia: ['', [Validators.required, Validators.minLength(1)], []],
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
