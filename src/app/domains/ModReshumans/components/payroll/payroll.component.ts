import { RouterModule } from '@angular/router';
import { Component, inject } from '@angular/core';

import { DomainsModule } from 'app/domains/domainsmodule';

import { SignalsService } from 'app/services/signals.service';


@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [
    RouterModule,
    DomainsModule
  ],
  templateUrl: './payroll.component.html',
  styleUrl: './payroll.component.scss'
})

export class PayrollComponent {

  signalsService = inject(SignalsService);
}

