import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SignalsService } from 'app/services/signals.service';
import { FamilySubFamilyComponent } from 'app/domains/Almacenes/components/FamilySubFamily/FamilySubFamily.component';
import { SetupwarehouseComponent } from 'app/domains/ModWarehouse/components/setupwarehouse/setupwarehouse.component';
import { SetupOcService } from 'app/services/setup-oc.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-configShoppingDelison',
  standalone: true,
  imports: [CommonModule, FormsModule, FamilySubFamilyComponent, SetupwarehouseComponent],
  templateUrl: './configSubPage.component.html',
})
export class configShoppingDelisonComponent {

  idRoot: number = 0;
  selectedBranch: number | null = null;
  limiteMin: number = 1;
  limiteMax: number | null = null;
  setupOcId: number | null = null;
  savingOc: boolean = false;

  private signalsService = inject(SignalsService);
  private setupOcService = inject(SetupOcService);

  constructor() {
    effect(() => {
      this.idRoot        = this.signalsService.getRootSelectedBySidebar()();
      this.selectedBranch = this.signalsService.getBranchSelectedBySidebar()();
      if (this.selectedBranch && this.selectedBranch > 0) this.loadSetupOc();
      else { this.setupOcId = null; this.limiteMax = null; }
    });
  }

  get branchIsValid(): boolean {
    return this.selectedBranch !== null && this.selectedBranch > 0;
  }

  get limiteInvalido(): boolean {
    return this.limiteMax !== null && this.limiteMax <= 1;
  }

  ngOnInit() {
    this.signalsService.setCatalogSelected('SHOPPINGDELISON');
  }

  private loadSetupOc(): void {
    if (!this.selectedBranch) return;
    this.setupOcService.getByBranch(this.selectedBranch).subscribe({
      next: (data) => {
        if (data) {
          this.setupOcId = data.id ?? null;
          this.limiteMax = data.entregaMax;
        } else {
          this.setupOcId = null;
          this.limiteMax = null;
        }
      },
      error: () => {
        this.setupOcId = null;
        this.limiteMax = null;
      }
    });
  }

  saveOc(): void {
    if (this.limiteInvalido || this.savingOc || !this.selectedBranch) return;
    this.savingOc = true;
    this.setupOcService.saveByBranch(this.selectedBranch, {
      idCompany:  this.idRoot,
      idBranch:   this.selectedBranch,
      entregaMin: 1,
      entregaMax: this.limiteMax
    }).subscribe({
      next: (data) => {
        this.setupOcId = data.id ?? null;
        this.savingOc  = false;
        alerts.reqSuccessToast('Guardado', 'Configuración de OC actualizada.');
      },
      error: () => {
        this.savingOc = false;
        alerts.reqErrorToast('Error', 'No se pudo guardar la configuración.');
      }
    });
  }

  cancelOc(): void {
    this.loadSetupOc();
  }

}
