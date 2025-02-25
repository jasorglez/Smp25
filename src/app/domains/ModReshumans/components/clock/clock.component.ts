import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TimeService } from 'app/services/time.service';
import { interval } from 'rxjs';

@Component({
  selector: 'app-clock',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './clock.component.html',
  styleUrl: './clock.component.scss'
})
export class ClockComponent {

  private timeService = inject(TimeService);

  time: any[] = [];
  formattedDate: string = '';
  formattedTime: string = '';
  private updateInterval!: any;

  ngOnInit() {
    this.setupTimeUpdates();
  }

  private setupTimeUpdates() {
    // Actualización inicial
    this.getTime();
    
    // Actualizar cada segundo
    this.updateInterval = setInterval(() => {
      const now = new Date();
      now.setSeconds(now.getSeconds());
      this.formatDateTime(now.toISOString());
    }, 1000);

    // Sincronizar con servidor cada 10 segundos
    interval(10000).subscribe(() => this.getTime());
  }

  getTime() {
    this.timeService.getTime().subscribe(data => {
      this.formatDateTime(data.localTime);
    });
  }

  private formatDateTime(isoString: string) {
    const date = new Date(isoString);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    
    this.formattedDate = date.toLocaleDateString('es-MX', options)
      .replace(/(^\w)/, m => m.toUpperCase())
      .replace(/,/, '')
      .replace(/(\s\d+)/, ', $1')
      .replace(/\b\w+/g, (m) => m === 'de' ? m : m.charAt(0).toUpperCase() + m.slice(1));

    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    this.formattedTime = date.toLocaleTimeString('es-MX', timeOptions);
  }

  ngOnDestroy() {
    clearInterval(this.updateInterval);
  }

}
