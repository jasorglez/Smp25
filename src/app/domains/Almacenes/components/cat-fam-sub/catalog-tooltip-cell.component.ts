import { inject, Component, ChangeDetectorRef} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-catalog-tooltip-cell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="catalog-cell-wrapper"
         *ngIf="shouldRender"
         (mouseenter)="onMouseEnter()"
         (mouseleave)="onMouseLeave()"
         (click)="onCellClick($event)">
      <span class="chevron-icon"
            *ngIf="hasChildren"
            [attr.data-action]="'toggle'"
            (mousedown)="onChevronClick($event)">
        {{ isExpanded ? '▼' : '▶' }}
      </span>
      <span *ngIf="!hasChildren && nodeLevel !== 'category'" class="indent-space"></span>
      <span class="cell-text">{{ displayText }}</span>

      <!-- Tooltip personalizado -->
      <div class="custom-tooltip" *ngIf="showTooltip && hasTooltipData">
        <div class="tooltip-arrow"></div>
        <div class="tooltip-content"
             [ngClass]="{
               'tooltip-category': nodeLevel === 'category',
               'tooltip-family': nodeLevel === 'family',
               'tooltip-subfamily': nodeLevel === 'subfamily'
             }">
          <div class="tooltip-header">
            <i class="bi"
               [ngClass]="{
                 'bi-folder': nodeLevel === 'category',
                 'bi-collection': nodeLevel === 'family',
                 'bi-file-earmark': nodeLevel === 'subfamily'
               }"></i>
            <strong>{{ itemName }}</strong>
          </div>
          <div class="tooltip-body">
            <div class="tooltip-row" *ngIf="description && description !== 'NA'">
              <span class="tooltip-label">
                <i class="bi bi-pencil"></i> Descripción:
              </span>
              <span class="tooltip-value">{{ description }}</span>
            </div>
            <div class="tooltip-row" *ngIf="abbreviation && abbreviation !== 'NA'">
              <span class="tooltip-label">
                <i class="bi bi-fonts"></i> Abreviatura:
              </span>
              <span class="tooltip-value">{{ abbreviation }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .catalog-cell-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      height: 100%;
    }

    .indent-space {
      display: inline-block;
      width: 20px;
    }

    .chevron-icon {
      cursor: pointer;
      margin-right: 5px;
      color: #2196f3;
      font-weight: bold;
      user-select: none;
      transition: transform 0.2s ease, color 0.2s ease;
      display: inline-block;
      width: 15px;
      text-align: center;
    }

    .chevron-icon:hover {
      transform: scale(1.3);
      color: #1976d2;
    }

    .cell-text {
      flex: 1;
    }

    .custom-tooltip {
      position: fixed;
      z-index: 10000;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
      pointer-events: none;
      min-width: 280px;
      max-width: 400px;
      animation: tooltipFadeIn 0.3s ease-out forwards;
    }

    .catalog-cell-wrapper:hover .custom-tooltip {
      opacity: 1;
      visibility: visible;
    }

    @keyframes tooltipFadeIn {
      from {
        opacity: 0;
        transform: translateY(-5px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .tooltip-arrow {
      position: absolute;
      top: -8px;
      left: 20px;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 8px solid #1e40af;
    }

    .tooltip-category .tooltip-arrow {
      border-bottom-color: #1e40af;
    }

    .tooltip-family .tooltip-arrow {
      border-bottom-color: #0891b2;
    }

    .tooltip-subfamily .tooltip-arrow {
      border-bottom-color: #475569;
    }

    .tooltip-content {
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .tooltip-category {
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
    }

    .tooltip-family {
      background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
    }

    .tooltip-subfamily {
      background: linear-gradient(135deg, #475569 0%, #64748b 100%);
    }

    .tooltip-header {
      background: rgba(255, 255, 255, 0.15);
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      color: #ffffff;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }

    .tooltip-header i {
      font-size: 16px;
    }

    .tooltip-body {
      padding: 12px 14px;
      color: #e2e8f0;
      font-size: 12px;
    }

    .tooltip-row {
      display: flex;
      align-items: flex-start;
      margin-bottom: 10px;
      gap: 8px;
    }

    .tooltip-row:last-child {
      margin-bottom: 0;
    }

    .tooltip-label {
      color: rgba(255, 255, 255, 0.8);
      font-weight: 600;
      min-width: 100px;
      display: flex;
      align-items: center;
      gap: 5px;
      flex-shrink: 0;
    }

    .tooltip-label i {
      font-size: 12px;
    }

    .tooltip-value {
      color: #ffffff;
      word-break: break-word;
      line-height: 1.4;
    }
  `]
})
export class CatalogTooltipCellComponent implements ICellRendererAngularComp {
  private readonly cdr = inject(ChangeDetectorRef);
  showTooltip = false;
  isExpanded = false;
  hasChildren = false;
  displayText = '';
  itemName = '';
  description = '';
  abbreviation = '';
  hasTooltipData = false;
  shouldRender = false;
  nodeLevel: 'category' | 'family' | 'subfamily' = 'category';
  columnField = '';
  private params: any;

  agInit(params: ICellRendererParams & { childCount?: number }): void {
    this.params = params;

    if (params.data) {
      const data = params.data;
      this.nodeLevel = data.nodeLevel || 'category';
      this.columnField = params.colDef?.field || '';

      // Determinar si debemos renderizar según la columna y el nivel del nodo
      this.shouldRender = this.shouldRenderInColumn();

      if (!this.shouldRender) {
        return;
      }

      this.isExpanded = data.isExpanded || false;
      this.itemName = data.description || '';

      // Extraer descripción y abreviatura
      this.description = data.valueAddition || '';
      this.abbreviation = data.valueAddition2 || '';

      // Determinar si hay datos para mostrar en el tooltip
      this.hasTooltipData = !!(this.description && this.description !== 'NA') ||
                            !!(this.abbreviation && this.abbreviation !== 'NA');

      // Determinar si tiene hijos (para mostrar chevron)
      this.hasChildren = this.nodeLevel === 'category' || this.nodeLevel === 'family';

      // Construir texto de visualización con contador
      const hasCounter = this.itemName.includes('(') && this.itemName.includes(')');

      // Si tiene hijos y se proporcionó childCount, agregar el contador
      if (this.hasChildren && params.childCount !== undefined && !hasCounter) {
        this.displayText = `${this.itemName} (${params.childCount})`;
      } else {
        this.displayText = this.itemName;
      }
    }
  
    this.cdr.detectChanges();}

  private shouldRenderInColumn(): boolean {
    // Categorías solo en columna categoryDisplay
    if (this.nodeLevel === 'category' && this.columnField === 'categoryDisplay') {
      return true;
    }
    // Familias solo en columna familyDisplay
    if (this.nodeLevel === 'family' && this.columnField === 'familyDisplay') {
      return true;
    }
    // Subfamilias solo en columna subfamilyDisplay
    if (this.nodeLevel === 'subfamily' && this.columnField === 'subfamilyDisplay') {
      return true;
    }
    return false;
  }

  onCellClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Verificar si se hizo clic en el chevron
    if (target.classList.contains('chevron-icon') || target.getAttribute('data-action') === 'toggle') {
      this.toggleExpansion();
    }
  }

  onChevronClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.toggleExpansion();
  }

  private toggleExpansion(): void {

    // Llamar directamente a la API del grid usando el context
    if (this.params && this.params.context) {
      const component = this.params.context.componentParent;
      if (component) {
        if (this.nodeLevel === 'category') {
          component.toggleCategoryExpansion(this.params.data);
        } else if (this.nodeLevel === 'family') {
          component.toggleFamilyExpansion(this.params.data);
        }
      } else {
      }
    } else {
    }
  }

  onMouseEnter(): void {
    this.showTooltip = true;

    // Posicionar el tooltip después de que se renderice
    setTimeout(() => {
      this.positionTooltip();
    }, 0);
  }

  onMouseLeave(): void {
    this.showTooltip = false;
  }

  private positionTooltip(): void {
    if (!this.hasTooltipData) return;

    const cellElement = this.params?.eGridCell;
    if (!cellElement) return;

    // Buscar el elemento del tooltip
    const tooltipEl = cellElement.querySelector('.custom-tooltip') as HTMLElement;
    if (!tooltipEl) return;

    const cellRect = cellElement.getBoundingClientRect();

    // Posicionar el tooltip debajo de la celda
    tooltipEl.style.top = `${cellRect.bottom + 8}px`;
    tooltipEl.style.left = `${cellRect.left}px`;
  }

  refresh(params: ICellRendererParams & { childCount?: number }): boolean {
    this.agInit(params);
    return true;
  }
}
