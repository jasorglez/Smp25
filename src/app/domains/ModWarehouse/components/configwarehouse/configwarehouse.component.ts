import { Component, inject } from '@angular/core';
import { concat, lastValueFrom } from 'rxjs';
import { toArray, tap } from 'rxjs/operators';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

import { ColDef, GridApi, GridReadyEvent, RowSelectedEvent } from 'ag-grid-enterprise';
import { alerts } from '../../../../helpers/alerts';

import { AgGridModule } from 'ag-grid-angular';
import { Router } from '@angular/router';

import { SignalsService } from 'app/services/signals.service';

import { SetupwarehouseComponent } from "../setupwarehouse/setupwarehouse.component";
import { SetupService } from 'app/services/setup.service';
import { CatalogsComponent } from 'app/domains/SMP/Components/catalogs/catalogs.component';


@Component({
  selector: 'app-configwarehouse',
  standalone: true,
  imports: [RouterModule, DomainsModule, AgGridModule, SetupwarehouseComponent,CatalogsComponent],
  templateUrl: './configwarehouse.component.html',
  styleUrl: './configwarehouse.component.scss'
})
export class ConfigwarehouseComponent {

  idRoot  : number;
  setup : any[] = [];

  constructor() {}

    ngOnInit() {
      this.signalsService.setCatalogSelected('WAREHOUSE');
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.obtenerDatos();
    }

    private setupService = inject(SetupService);
    private signalsService = inject(SignalsService);

    obtenerDatos() {
      this.setupService.getWarehouses(this.idRoot).subscribe(
        (data: any) => {
          this.setup = data;
        },
        (error) => {
          if (error.status == 404) this.setup = [];
          console.error('Error fetching data:', error);
        }
      );
    }

}
