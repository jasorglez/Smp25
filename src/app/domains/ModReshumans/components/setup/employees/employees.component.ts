import { Component, effect, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { HRService } from 'app/services/hr.service';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [  ReactiveFormsModule ],
  templateUrl: './employees.component.html',
})
export class EmployeesComponent {
  
  private signalsService = inject(SignalsService); 
  private hrService = inject(HRService);

  formBuilder = inject(FormBuilder);
  idBranch: number;
  hrData: any = {};
  newData: boolean;
  isNew: boolean = false;

  constructor() {
      effect(() => {
        this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
        this.getData();
      });
    }

  myForm: FormGroup = this.formBuilder.group({
    vigency: ['', [Validators.required, Validators.minLength(1)], []],  
  })

  getData() {
    this.hrService.getHRManagementData(this.idBranch).subscribe({
      next: (data: any) => {
        this.hrData = data[0] || {};
        this.myForm.patchValue({
          vigency: this.hrData.vigency,
        });
      },
      error: (err) => {
        if (err.status === 404) {
          this.myForm.patchValue({
            vigency: null,
          });
          this.isNew = true
        } else {
          console.error(err);
        }
      }
    });
  }


    onSubmit() {
      if (this.myForm.invalid) {
        alerts.basicAlert("Error", "Faltan datos por llenar", "error");
        return;
      }
    
      const values = this.myForm.value;
    
      this.hrData = {
        ...this.hrData, // conserva id u otros campos
        ...values       // actualiza con valores nuevos
      };
    
      if (!this.isNew) {
        // Actualizar datos existentes
        this.hrService.updateHRManagementData(this.idBranch, this.hrData).subscribe({
          next: () => {
            alerts.basicAlert("Actualización", "Los datos fueron guardados exitosamente", "success");
            this.getData(); // Refrescar datos
          },
          error: () => {
            alerts.basicAlert("Error", "Error al actualizar los datos.", "error");
          }
        });
        return;
      }
    console.log(values)
      // Insertar nuevos datos
      const payload = {
        active: true,
        startDay: "",
        vigency: values.vigency,
        idBranch: this.idBranch,
        discount1: true,
        discount2: true
      };
      console.log(payload)
    
      this.hrService.addHRManagementData(payload).subscribe({
        next: () => {
          alerts.basicAlert("Registro", "Los datos fueron guardados exitosamente", "success");
          this.getData(); // Refrescar datos
        },
        error: () => {
          alerts.basicAlert("Error", "Error al añadir los datos.", "error");
        }
      });
    
      this.isNew = false;
    }


    revertChanges() {
      this.getData(); // Refrescar datos
    }

}
