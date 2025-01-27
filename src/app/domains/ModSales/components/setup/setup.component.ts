import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { alerts } from 'app/helpers/alerts';
import { CatalogsService } from 'app/services/catalogs.service';
import { PosService } from 'app/services/pos.service';
import { SignalsService } from 'app/services/signals.service';
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
  nameBranch: string = null;
  isNew: boolean = false;

  // Arrays para almacenar datos
  customers: any[] = [];          // Lista de clientes
  documentType: any[] = [];      // Lista de tipos de documento
  options: any = {};          // Lista de opciones de configuración

  ngOnInit() {
    this.idCustomer = this.signalsService.getIdCustomerFromPOS()();
    this.getCustomers();
    this.getDocumentType();
    
    if (this.idCustomer === null) {
      this.getCustomers();
    }
  }

  constructor() {
    effect(() => {
      this.nameBranch = this.signalsService.getBranchNameSelectedBySidebar()();
      this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.idCustomer = this.signalsService.getIdCustomerFromPOS()();
      console.log(this.idCustomer);
      this.getCustomers();
      this.getDocumentType();
    });
  }

  onCustomerChange(event: any) {
    this.idCustomer = event.id;
    this.signalsService.setIdCustomerFromPOS(this.idCustomer);
    this.getOptions();
  }

  // Método para obtener customeres de la sucursal seleccionada
  getCustomers() {
    this.posService.getClients(this.idBranch).subscribe(
      (data: any) => {
        this.customers = data;
        // Seleccionar el primer cliente si idCustomer es null
        if (this.idCustomer === null && this.customers.length > 0) {
          this.idCustomer = this.customers[0].id; // Seleccionar el primer cliente
          this.signalsService.setIdCustomerFromPOS(this.idCustomer); // Enviar a la signal
        }
        this.getOptions(); // Cargar la configuración del cliente seleccionado
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
