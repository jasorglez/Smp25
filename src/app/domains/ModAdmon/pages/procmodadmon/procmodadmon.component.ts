import { Component, ViewEncapsulation } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { SharedModule } from 'app/shared/shared.module';

@Component({
  selector: 'app-procmodadmon',
  standalone: true,
  imports: [RouterModule, DomainsModule, SharedModule],
  templateUrl: './procmodadmon.component.html',
  styleUrl: './procmodadmon.component.scss',
  encapsulation: ViewEncapsulation.None, // Desactiva la encapsulación
})
export class ProcmodadmonComponent {}
