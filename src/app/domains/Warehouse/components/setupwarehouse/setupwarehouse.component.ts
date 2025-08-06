import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { alerts } from 'app/helpers/alerts';
import { SetupService } from 'app/services/setup.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-setupwarehouse',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setupwarehouse.component.html',
  styleUrl: './setupwarehouse.component.scss'
})
export class SetupwarehouseComponent {
  private setupService = inject(SetupService);
  private signalsService = inject(SignalsService);

  idCompany: number;
  warehouseSetup: any = { projectOrBranch: null };
  newData: boolean = false;

  ngOnInit() {
    this.idCompany = this.signalsService.getRootSelectedBySidebar()();
    this.getData();
  }

  constructor() {
    effect(() => {
      this.idCompany = this.signalsService.getRootSelectedBySidebar()();
      this.getData();
    }
    );
  }

  getData() {
    this.setupService.getWarehouseSetup(this.idCompany).subscribe({
      next: (data: any) => {
        this.warehouseSetup = data[0];
        console.log(this.warehouseSetup);
      },
      error: (err) => {
        if (err.status === 404) {
          this.warehouseSetup = {};
          this.newData = true;
        } else {
          console.error(err);
        }
      }
    });
  }

  saveData() {
    if (this.newData) {
      this.warehouseSetup.idCompany = this.idCompany;
      this.setupService.addWarehouseSetup(this.warehouseSetup).subscribe(
        {
          next: () => {
            alerts.basicAlert("Actualización", "La configuración se ha guardado correctamente", "success");
            this.getData();
            this.newData = false;
          },
          error: (err) => {
            alerts.basicAlert("Error", "Ha ocurrido un error al guardar la configuración", "error");
          }
        }
      );
    }
    else {
      this.setupService.updateWarehouseSetup(this.idCompany, this.warehouseSetup).subscribe(
        {
          next: () => {
            alerts.basicAlert("Actualización", "La configuración se ha guardado correctamente", "success");
            this.getData();
          },
          error: (err) => {
            alerts.basicAlert("Error", "Ha ocurrido un error al guardar la configuración", "error");
          }
        }
      );
    }

  }

  revertChanges() {
    this.getData();
  }


}
