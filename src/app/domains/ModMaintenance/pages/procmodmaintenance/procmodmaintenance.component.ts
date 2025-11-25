import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';

@Component({
  selector: 'app-procmodmaintenance',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './procmodmaintenance.component.html',
  styleUrl: './procmodmaintenance.component.scss'
})
export class ProcmodmaintenanceComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

  getCurrentDate(): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date().toLocaleDateString('es-ES', options);
  }
}
