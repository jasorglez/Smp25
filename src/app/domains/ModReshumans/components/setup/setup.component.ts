import { Component, inject } from '@angular/core';
import { SetupRootComponent } from "./setup-root/setup-root.component";
import { RouterModule } from '@angular/router';
import { SetupEmployeesComponent } from "../payroll/setup/setup.component";
import { CatalogsComponent } from 'app/domains/SMP/Components/catalogs/catalogs.component';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [ RouterModule],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss'
})

export class SetupComponent {

  idRoot  : number;

  private signalsService = inject(SignalsService);

  ngOnInit() {
    this.signalsService.setCatalogSelected('RESOURCEHUMAN');
    this.idRoot = this.signalsService.getRootSelectedBySidebar()();      
   
  }

}
