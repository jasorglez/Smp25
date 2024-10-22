import { Component, inject } from '@angular/core';
import { TrackingService } from 'app/services/tracking.service';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { UsersMenuComponent } from '../../Components/users/users-menu.component';



@Component({
  selector: 'app-proccsmp',
  standalone: true,
  imports: [RouterModule, DomainsModule, UsersMenuComponent ],
  templateUrl: './proccsmp.component.html',
  styleUrl: './proccsmp.component.scss'
})
export class ProccsmpComponent {


  //inject new way
  private trackingService = inject(TrackingService) ;

  
}
