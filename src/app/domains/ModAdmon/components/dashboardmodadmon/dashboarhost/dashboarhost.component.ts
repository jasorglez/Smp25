import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SalesdashboardComponent } from '../salesdashboard/salesdashboard.component';
import { ExpensedashboardComponent } from '../expensedashboard/expensedashboard.component';
import { SummarydashboardComponent } from '../summarydashboard/summarydashboard.component';

@Component({
  selector: 'app-dashboarhost',
  standalone: true,
  imports: [CommonModule,
    SalesdashboardComponent, ExpensedashboardComponent, SummarydashboardComponent],
  templateUrl: './dashboarhost.component.html',
  styleUrl: './dashboarhost.component.scss'
})
export class DashboarhostComponent {

  // La única responsabilidad de este componente es saber qué pestaña está activa.
  public activeTab: string = 'ventas'; // 'ventas', 'egresos', 'totalizados'

  /**
   * Cambia la pestaña activa.
   * 
   * @param tabName El nombre de la pestaña a activar.
   */
  setActiveTab(tabName: string): void {
    this.activeTab = tabName;
  }

}
