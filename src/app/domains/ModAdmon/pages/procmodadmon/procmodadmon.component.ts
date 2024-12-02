import { Component, ViewEncapsulation } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

@Component({
  selector: 'app-procmodadmon',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procmodadmon.component.html',
  styleUrl: './procmodadmon.component.scss',
  encapsulation: ViewEncapsulation.None // Desactiva la encapsulación
})
export class ProcmodadmonComponent {

}
