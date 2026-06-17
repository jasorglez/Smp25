import { inject, Component, Input, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IHeaderAngularComp } from 'ag-grid-angular';
import { IHeaderParams } from 'ag-grid-community';

@Component({
  selector: 'app-roles-tooltip-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="d-flex align-items-center">
      <span>{{ displayName }}</span>
      <button 
        type="button" 
        class="btn btn-link p-0 ms-1 info-button"
        (mouseenter)="showTooltip = true"
        (mouseleave)="showTooltip = false"
        style="border: none; background: none; color: #6c757d; font-size: 0.875rem;">
        <i class="bi bi-info-circle"></i>
      </button>
      
      <!-- Tooltip -->
      <div 
        class="roles-tooltip" 
        [class.show]="showTooltip"
        *ngIf="showTooltip">
        <div class="tooltip-header">
          <strong>Roles Disponibles</strong>
        </div>
        <div class="tooltip-content">
          <div 
            class="role-item" 
            *ngFor="let role of roles"
            [style.border-left]="'4px solid ' + getRoleColor(role.id)">
            <span class="role-name">{{ role.description }}</span>
            <div 
              class="role-color-indicator" 
              [style.background-color]="getRoleColor(role.id)">
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .info-button {
      transition: color 0.2s ease;
    }
    
    .info-button:hover {
      color: #007bff !important;
    }
    
    .roles-tooltip {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      min-width: 200px;
      max-width: 300px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
      margin-top: 5px;
    }
    
    .roles-tooltip.show {
      opacity: 1;
      visibility: visible;
    }
    
    .tooltip-header {
      padding: 8px 12px;
      background: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
      border-radius: 8px 8px 0 0;
      font-size: 0.875rem;
      color: #495057;
    }
    
    .tooltip-content {
      padding: 8px 0;
      max-height: 250px;
      overflow-y: auto;
    }
    
    .role-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      transition: background-color 0.2s ease;
    }
    
    .role-item:hover {
      background-color: #f8f9fa;
    }
    
    .role-name {
      font-size: 0.875rem;
      color: #495057;
      font-weight: 500;
    }
    
    .role-color-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-left: 8px;
    }
    
    /* Tooltip arrow */
    .roles-tooltip::before {
      content: '';
      position: absolute;
      top: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 8px solid #dee2e6;
    }
    
    .roles-tooltip::after {
      content: '';
      position: absolute;
      top: -7px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 8px solid white;
    }
    
    /* Scrollbar styling */
    .tooltip-content::-webkit-scrollbar {
      width: 4px;
    }
    
    .tooltip-content::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 2px;
    }
    
    .tooltip-content::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 2px;
    }
    
    .tooltip-content::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }
  `]
})
export class RolesTooltipHeaderComponent implements IHeaderAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  @Input() roles: any[] = [];
  
  showTooltip = false;
  displayName = '';
  
  agInit(params: IHeaderParams): void {
    this.displayName = params.displayName || '';
    // Obtener los roles del componente padre
    if (params.context && params.context.roles) {
      this.roles = params.context.roles;
    }
  
    this.cdr.detectChanges();}
  
  refresh(params: IHeaderParams): boolean {
    // Actualizar los roles cuando se refrescan los headers
    if (params.context && params.context.roles) {
      this.roles = params.context.roles;
    }
    return true;
  }
  
  getRoleColor(roleId: number): string {
    // Generar colores consistentes basados en el ID del rol
    const colors = [
      '#007bff', // Azul
      '#28a745', // Verde
      '#dc3545', // Rojo
      '#ffc107', // Amarillo
      '#6f42c1', // Púrpura
      '#fd7e14', // Naranja
      '#20c997', // Turquesa
      '#e83e8c', // Rosa
      '#6c757d', // Gris
      '#17a2b8', // Cian
      '#343a40', // Oscuro
      '#f8f9fa'  // Claro
    ];
    
    // Usar el ID del rol para seleccionar un color de forma consistente
    return colors[roleId % colors.length];
  }
}
