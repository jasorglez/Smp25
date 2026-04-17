import { Component, effect, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { CommonModule } from '@angular/common';
import { HRService } from 'app/services/hr.service';
import { AuthService } from 'app/services/auth.service';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';


@Component({
  selector: 'app-clock',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './clock.component.html',
})
export class ClockComponent {
  private signalsService = inject(SignalsService);
  private hrService = inject(HRService);
  formBuilder = inject(FormBuilder);
  authService = inject(AuthService);
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
    delay1: [ { value: ''/*, disabled: !this.authService.getCrudPermission('hr', 'setup','','','', 'update') && !this.authService.getCrudPermission('hr', 'setup','','','', 'create')*/ }, [Validators.required, Validators.min(0), Validators.max(60)]],
    delay2: [ { value: ''/*, disabled: !this.authService.getCrudPermission('hr', 'setup','','','', 'update') && !this.authService.getCrudPermission('hr', 'setup','','','', 'create')*/ }, [Validators.required, Validators.min(0), Validators.max(60)]],
    settingToleranceTime: [ { value: ''/*, disabled: !this.authService.getCrudPermission('hr', 'setup','','','', 'update') && !this.authService.getCrudPermission('hr', 'setup','','','', 'create')*/ }, [Validators.required]],
  });

  getData() {
    this.hrService.getHRManagementData(this.idBranch).subscribe({
      next: (data: any) => {
        this.hrData = data[0] || {};
        this.myForm.patchValue({
          delay1: this.hrData.delay1,
          delay2: this.hrData.delay2,
          settingToleranceTime: this.hrData.settingToleranceTime,
          
        });
        this.isNew = false;
      },
      error: (err) => {
        if (err.status === 404) {
          this.myForm.patchValue({
            delay1: null,
            delay2: null,
          });
          this.isNew = true
        } else {
          console.error(err);
        }
      }
    });
  }


  onSubmit() {
    const values = this.myForm.value;
    // Validaciones personalizadas
    if (values.delay1 < 0 || values.delay1 > 60) {
      alerts.basicAlert("Error", "El valor de 'delay1' debe estar entre 0 y 60 minutos.", "error");
      return;
    }
    if (values.delay2 < 0 || values.delay2 > 60) {
      alerts.basicAlert("Error", "El valor de 'delay2' debe estar entre 0 y 60 minutos.", "error");
      return;
    }
    if (this.myForm.invalid) {
      alerts.basicAlert("Error", "Faltan datos por llenar", "error");
      return;
    }

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
    // Insertar nuevos datos
    const payload = {
      active: true,
      startDay: "",
      delay1: values.delay1,
      delay2: values.delay2,
      idBranch: this.idBranch,
      
    };

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
