import { Component, inject } from '@angular/core';
import { concat, lastValueFrom } from 'rxjs';
import { toArray, tap } from 'rxjs/operators';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

import { ColDef, GridApi, GridReadyEvent, RowSelectedEvent } from 'ag-grid-enterprise';
 
import { AgGridModule } from 'ag-grid-angular';
import { Router } from '@angular/router';

import { SignalsService } from 'app/services/signals.service';
import { FamilySubFamilyComponent } from 'app/domains/Almacenes/components/FamilySubFamily/FamilySubFamily.component';


@Component({
  selector: 'app-configShoppingDelison',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, FamilySubFamilyComponent],
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