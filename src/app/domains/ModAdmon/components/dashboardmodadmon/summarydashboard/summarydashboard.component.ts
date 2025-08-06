import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-summarydashboard',
  standalone: true,
imports: [CommonModule],
  template: `
    <div class="placeholder-card">
      <h2>Dashboard de Totalizados</h2>
      <p>La construcción de esta sección está en progreso...</p>
      <i class="bi bi-clipboard-data placeholder-icon"></i>
    </div>
  `,
  styles: [`
    .placeholder-card {
      background-color: #fff;
      padding: 40px;
      border-radius: 8px;
      text-align: center;
      color: #6c757d;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .placeholder-icon {
      font-size: 3rem;
      margin-top: 20px;
      color: #ced4da;
    }
  `]
})
export class SummarydashboardComponent {

}
