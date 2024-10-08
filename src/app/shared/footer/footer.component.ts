import { Component, computed, inject } from '@angular/core';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {

  private signalsService = inject(SignalsService);

  companyName = computed(()=> this.signalsService.companyName());
 
}
