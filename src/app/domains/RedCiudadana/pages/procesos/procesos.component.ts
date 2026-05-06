import { Component } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';

@Component({
  selector: 'app-red-procesos',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './procesos.component.html',
})
export class RedProcesosComponent {}
