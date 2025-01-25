import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { alerts } from 'app/helpers/alerts';
import { CatalogsService } from 'app/services/catalogs.service';
import { MaterialsService } from 'app/services/materials.service';
import { PosService } from 'app/services/pos.service';
import { SignalsService } from 'app/services/signals.service';
import { dataTool } from 'echarts';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pos-setup',
  standalone: true,
  imports: [NgSelectModule, CommonModule, FormsModule],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss'
})
export class PosSetupComponent {


  // Inyección de servicios
  private posService = inject(PosService);
  private signalsService = inject(SignalsService);
  private catalogsService = inject(CatalogsService);
  private router = inject(Router);

  // Variables de identificación
  idCustomer: number = null;
  idBranch: number = null;
  isNew: boolean = false;

  // Arrays para almacenar datos
  customers: any[] = [];          // Lista de clientes
  documentType: any[] = [];      // Lista de tipos de documento
  options: any = {};          // Lista de opciones de configuración

  ngOnInit() {
    this.getCustomers();
    this.getDocumentType();
  }

  constructor() {
    effect(() => {
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.idCustomer = null; // Resetear el customere seleccionado
      this.getCustomers();
    });
  }

  onCustomerChange(event: any) {
    this.idCustomer = event.id;
    this.getOptions();
  }

  // Método para obtener customeres de la sucursal seleccionada
  getCustomers() {
    this.posService.getClients(this.idBranch).subscribe(
      (data: any) => {
        this.customers = data;
        console.log(data);
      },
      (error) => console.error('Error fetching customers:', error)
    );
  }

  getDocumentType() {
    this.catalogsService.getDocumentTypes().subscribe(
      (data: any) => {
        this.documentType = data;
        console.log(data);
      },
      (error) => console.error('Error fetching customers:', error)
    );
  }

  getOptions() {
    this.posService.getPosSetup(this.idBranch, this.idCustomer).subscribe(
      (data: any) => {
        this.options = data.length > 0 ? data[0] : { printScreen: true, salesExistence: true, consecutive: 0 };
        this.isNew = data.length === 0;
        console.log(data);
      },
      (error) => console.error('Error fetching pos setup:', error)
    )
  }

  saveOptions() {
    // Añadir los valores requeridos al objeto options
    this.options.idBranch = this.idBranch;
    this.options.idCustomer = this.idCustomer;

    // Validar que los campos prefix y consecutive no estén vacíos
    if (!this.options.prefix || this.options.consecutive === null) {
        alerts.basicAlert('Error', 'Los campos Prefijo Ticket y Consecutivo no pueden estar vacíos', 'error');
        return; // Salir del método si la validación falla
    }

    if(this.isNew) {
      this.posService.addPosSetup(this.options).subscribe(
        (data: any) => {
          console.log(data);
          alerts.basicAlert('Éxito', 'Configuración guardada correctamente','success');
          this.isNew = false;
        },
        (error) => console.error('Error saving pos setup:', error)
      );
    }
    else {
      this.posService.updatePosSetup(this.idBranch, this.idCustomer, this.options).subscribe(
        (data: any) => {
          console.log(data);
          alerts.basicAlert('Éxito', 'Configuración actualizada correctamente', 'success');
        },
        (error) => {
          console.error('Error updating pos setup:', error);
          alerts.basicAlert('Error', 'Error al actualizar la configuración', 'error');
        }
      )
    }
  }

  cancel() {
    this.router.navigate(['/procsales/pos']);
  }
}
