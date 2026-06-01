import { Component, inject, effect, ViewChild, ChangeDetectorRef, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
export class configShoppingDelisonComponent implements AfterViewInit {

  // Instancia hija de setupwarehouse (pestaña Requisiciones). Sigue siendo dueña del
  // registro PrefixSetup; aquí solo referenciamos sus props prefixOc/consecutiveOcProveedor
  // para editarlas desde la pestaña Órdenes de Compra y guardarlas con su lógica existente.
  @ViewChild(SetupwarehouseComponent) setupwarehouseRef?: SetupwarehouseComponent;

  idRoot: number = 0;
  selectedBranch: number | null = null;
  limiteMin: number = 1;
  limiteMax: number | null = null;
  setupOcId: number | null = null;
  savingOc: boolean = false;

  private signalsService = inject(SignalsService);
  private setupOcService = inject(SetupOcService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private el = inject(ElementRef);

  ngAfterViewInit(): void {
    // Resuelve el @ViewChild dentro del mismo ciclo de CD para que la pestaña OC
    // pueda enlazar a setupwarehouseRef sin ExpressionChangedAfterItHasBeenCheckedError.
    this.cdr.detectChanges();

    // Redirección desde almacén molienda (?tab=ordenes-compra): activar esa pestaña.
    if (this.route.snapshot.queryParamMap.get('tab') === 'ordenes-compra') {
      setTimeout(() => {
        try {
          const link = this.el.nativeElement.querySelector('a[href="#ordenes-compra"]') as HTMLElement | null;
          link?.click();
        } catch { /* si falla, queda en la pestaña por defecto */ }
      }, 0);
    }
  }

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

    // Validaciones de los prefijos OC (trasladadas desde la pestaña Requisiciones).
    const ref = this.setupwarehouseRef;
    if (ref) {
      if (!ref.prefixOc?.trim()) {
        alerts.basicAlert('Atención', 'El prefijo de Órdenes de Compra es obligatorio', 'warning');
        return;
      }
      const iniciales = Number(ref.consecutiveOcProveedor);
      if (!iniciales || iniciales < 1 || iniciales > 5) {
        alerts.basicAlert('Atención', 'Iniciales del proveedor debe ser un número entre 1 y 5', 'warning');
        return;
      }
    }

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
        // Persistir los prefijos OC con la lógica existente de setupwarehouse (mismo registro
        // PrefixSetup). savePrefixData muestra su propio aviso de éxito.
        if (ref) {
          ref.savePrefixData();
        } else {
          alerts.reqSuccessToast('Guardado', 'Configuración de OC actualizada.');
        }
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
