import { Component, computed, inject } from '@angular/core';
import { environment } from '@env/environment';
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
  environment = environment;

  companyName = computed(()=> this.signalsService.getCompanyName());
  displayName = computed(()=> this.signalsService.getDisplayName());
  
}
