import { Component, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';
import { SharedModule } from 'app/shared/shared.module';

@Component({
  selector: 'app-procot',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './procot.component.html',
  styleUrl: './procot.component.scss'
})
export class ProcotComponent {

    public signalsService = inject(SignalsService);

}