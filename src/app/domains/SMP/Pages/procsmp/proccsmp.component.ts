import { Component } from '@angular/core';
import { TrackingService } from 'app/services/tracking.service';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

@Component({
  selector: 'app-proccsmp',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './proccsmp.component.html',
  styleUrl: './proccsmp.component.scss'
})
export class ProccsmpComponent {


  //inject new way


  
}
