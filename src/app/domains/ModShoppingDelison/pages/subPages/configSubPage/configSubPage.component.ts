import { Component, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { FamilySubFamilyComponent } from 'app/domains/Almacenes/components/FamilySubFamily/FamilySubFamily.component';

@Component({
  selector: 'app-configShoppingDelison',
  standalone: true,
  imports: [FamilySubFamilyComponent],
  templateUrl: './configSubPage.component.html',
})
export class configShoppingDelisonComponent {

  idRoot  : number;
  setup : any[] = [];

  constructor() {}

    ngOnInit() {
      this.signalsService.setCatalogSelected('SHOPPINGDELISON');
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();      
      //this.obtenerDatos();
    }
    private signalsService = inject(SignalsService);
  
    /*obtenerDatos() {
      this.setupService.getWarehouses(this.idRoot).subscribe(
        (data: any) => {
          this.setup = data;                
        },
        (error) => {
          if (error.status == 404) this.setup = [];
          console.error('Error fetching data:', error);
        }
      );
    }*/

}
