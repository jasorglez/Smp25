import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { HRService } from 'app/services/hr.service';
import { SignalsService } from 'app/services/signals.service';

interface Bank {
  id: number; 
  name: string;
  active: boolean;
}

@Component({
  selector: 'app-setup-root',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule],
  templateUrl: './setup-root.component.html',
  styleUrl: './setup-root.component.scss'
})

export class SetupRootComponent {
  private signalsService = inject(SignalsService);
  private hrService = inject(HRService);
  isLoading: boolean = false;
  error: string | null = null;
  jsonData: any = null;
  fileName: string = '';
  // Variable para controlar cómo se muestra el JSON
  prettyJson: boolean = false;
  hrData: any = {};
  newData: boolean;
  idRoot: number;
  banks: Bank[] = [];
  selectedBankId: number | null = null;

  async ngOnInit() {
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();
    this.getData();
  }

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.getData();
    });
  }

  

  getData() {
    this.hrService.getHRManagementByRootData(this.idRoot).subscribe({
      next: (data: any) => {
        this.hrData = data[0] || {};
      },
      error: (err) => {
        if (err.status === 404) {
          this.hrData = {};
          this.newData = true;
        } else {
          console.error(err);
        }
      }
    });
  }

  saveChanges() {
    if (this.newData) {
      // Si no hay datos, hacer POST
      this.hrData.idRoot = this.idRoot; // Agregar idRoot al objeto
      this.hrService.addHRManagementByRootData(this.hrData)
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
      this.hrService.updateHRManagementByRootData(this.idRoot, this.hrData)
        .subscribe({
          next: () => {
            alerts.basicAlert("Actualización", "Los datos fueron guardados exitosamente", "success");
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
