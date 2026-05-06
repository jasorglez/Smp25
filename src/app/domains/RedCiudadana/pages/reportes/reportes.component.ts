import { Component } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';

@Component({
  selector: 'app-red-reportes',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './reportes.component.html',
})
export class RedReportesComponent {}
