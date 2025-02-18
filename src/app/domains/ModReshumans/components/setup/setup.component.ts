import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { HRService } from 'app/services/hr.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss'
})
export class SetupComponent {
  private signalsService = inject(SignalsService);
  private hrService = inject(HRService);

  ngOnInit() {
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.getData();
  }

  constructor() {
    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.getData();
    }
    );
  }

  hrData: any = {};
  newData: boolean;
  idBranch: number;

  getData() {
    this.hrService.getHRManagementData(this.idBranch).subscribe({
      next: (data: any) => {
        this.hrData = data[0] || {};
        console.log(data);
      },
      error: (err) => {
        if (err.status === 404) {
          this.hrData = {};
          this.newData = true;
        } else {
          console.error(err);
        }
      }
    }
    );
  }

  saveChanges() {
    if (this.newData) {
      // Si no hay datos, hacer POST
      this.hrData.idBranch = this.idBranch; // Agregar idBranch al objeto
      console.log('Datos enviados a addBillingManagementInfo:', this.hrData);
      this.hrService.addHRManagementData(this.hrData)
        .subscribe({
          next: () => {
            alerts.basicAlert("Actualización", "Los datos fueron guardados exitosamente.", "success");
            this.getData(); // Refrescar datos
            this.newData = false;
          },
          error: (err) => {
            alerts.basicAlert("Error", "Error al actualizar los datos.", "error");
          }
        });
    } else {
      // Si hay datos, hacer PUT
      this.hrService.updateHRManagementData(this.idBranch, this.hrData)
        .subscribe({
          next: () => {
            alerts.basicAlert("Actualización", "Los datos fueron guardados exitosamente.", "success");
            this.getData(); // Refrescar datos
          },
          error: (err) => {
            alerts.basicAlert("Error", "Error al actualizar los datos.", "error");
          }
        });
    }
  }

  revertChanges() {
    this.getData(); // Refrescar datos
  }

}
