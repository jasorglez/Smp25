import { Component, inject } from '@angular/core';
import { SetupRootComponent } from "./setup-root/setup-root.component";
import { SetupBranchComponent } from "./setup-branch/setup-branch.component";
import { CatalogsComponent } from 'app/domains/SMP/Components/catalogs/catalogs.component';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [SetupRootComponent, SetupBranchComponent, CatalogsComponent],
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
