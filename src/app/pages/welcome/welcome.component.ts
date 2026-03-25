import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent {
  private signalsService = inject(SignalsService);

  displayName = this.signalsService.getDisplayName();
  greeting    = this.getGreeting();
  currentDate = new Date();

  private getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }
}
