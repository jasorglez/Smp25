import { Component, computed, inject } from '@angular/core';
import { AuthService } from 'app/services/auth.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {

  private authService = inject(AuthService);
  companyName = computed(()=> this.authService.companyName());

}
