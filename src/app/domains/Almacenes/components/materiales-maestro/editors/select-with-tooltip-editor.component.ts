import { Component, ViewChild, AfterViewInit, ViewContainerRef, Renderer2, OnDestroy } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { ICellEditorParams } from 'ag-grid-enterprise';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface SelectOption {
  id: number | string;
  description: string;
  valueAddition?: string;
  valueAddition2?: string;
}

export interface SelectWithTooltipParams extends ICellEditorParams {
  options: SelectOption[];
}

@Component({
  selector: 'app-select-with-tooltip-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="select-editor-container" #container (scroll)="onScroll()">
      <div class="select-dropdown">
        <div class="select-option"
             #optionElement
             *ngFor="let option of options"
             [class.selected]="option.id === selectedValue"
             [class.hovered]="hoveredOptionId === option.id"
             (click)="selectOption(option)"
             (mouseenter)="onOptionHover(option, optionElement)"
             (mouseleave)="onOptionLeave()"
             (mousemove)="onOptionMove(optionElement)">
          <span class="option-text">{{ option.description }}</span>
        </div>
      </div>
    </div>

    <!-- Tooltip separado, fuera del dropdown -->
    <div class="option-tooltip"
         *ngIf="showTooltip && hoveredOption && hasTooltipData(hoveredOption)"
         [style.top.px]="tooltipPosition.top"
         [style.left.px]="tooltipPosition.left">
      <div class="tooltip-arrow"></div>
      <div class="tooltip-content">
        <div class="tooltip-header">
          <i class="bi bi-info-circle"></i>
          <strong>{{ hoveredOption.description }}</strong>
        </div>
        <div class="tooltip-body">
          <div class="tooltip-row" *ngIf="hoveredOption.valueAddition">
            <span class="tooltip-label">
              <i class="bi bi-pencil"></i> Descripción:
            </span>
            <span class="tooltip-value">{{ hoveredOption.valueAddition }}</span>
          </div>
          <div class="tooltip-row" *ngIf="hoveredOption.valueAddition2">
            <span class="tooltip-label">
              <i class="bi bi-fonts"></i> Abreviatura:
            </span>
            <span class="tooltip-value">{{ hoveredOption.valueAddition2 }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .select-editor-container {
      position: fixed;
      z-index: 10000;
      background: white;
      border: 1px solid #ccc;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      max-height: 300px;
      overflow-y: auto;
      border-radius: 4px;
    }

    .select-dropdown {
      min-width: 200px;
    }

    .select-option {
      position: relative;
      padding: 8px 12px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      border-bottom: 1px solid #f0f0f0;
    }

    .select-option:last-child {
      border-bottom: none;
    }

    .select-option.hovered {
      background-color: #e3f2fd;
    }

    .select-option.selected {
      background-color: #2196f3;
      color: white;
      font-weight: 600;
    }

    .select-option:hover {
      background-color: #e3f2fd;
    }

    .select-option.selected:hover {
      background-color: #1976d2;
    }

    .option-text {
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .option-tooltip {
      position: fixed;
      z-index: 999999 !important;
      pointer-events: none;
      animation: tooltipFadeIn 0.2s ease-out;
    }

    /* Asegurar que el tooltip aparezca encima de TODO */
    :host ::ng-deep .option-tooltip {
      z-index: 999999 !important;
    }

    @keyframes tooltipFadeIn {
      from {
        opacity: 0;
        transform: translateX(-10px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .tooltip-arrow {
      position: absolute;
      left: -8px;
      top: 12px;
      width: 0;
      height: 0;
      border-top: 8px solid transparent;
      border-bottom: 8px solid transparent;
      border-right: 8px solid #1e40af;
    }

    .tooltip-content {
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%) !important;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8) !important;
      overflow: visible !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      min-width: 280px;
      max-width: 400px;
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

    /* Scrollbar personalizado */
    .select-editor-container::-webkit-scrollbar {
      width: 8px;
    }

    .select-editor-container::-webkit-scrollbar-track {
      background: #f1f1f1;
    }

    .select-editor-container::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 4px;
    }

    .select-editor-container::-webkit-scrollbar-thumb:hover {
      background: #555;
    }
  `]
})
export class SelectWithTooltipEditorComponent implements ICellEditorAngularComp, AfterViewInit, OnDestroy {
  @ViewChild('container', { read: ViewContainerRef }) container!: ViewContainerRef;

  options: SelectOption[] = [];
  selectedValue: any = null;
  hoveredOptionId: any = null;
  hoveredOption: SelectOption | null = null;
  tooltipPosition = { top: 0, left: 0 };
  showTooltip = false;
  private currentHoveredElement: HTMLElement | null = null;
  private params!: SelectWithTooltipParams;
  private tooltipElement: HTMLElement | null = null;

  constructor(private renderer: Renderer2) {}

  agInit(params: SelectWithTooltipParams): void {
    this.params = params;
    this.options = params.options || [];
    this.selectedValue = params.value;
  }

  ngAfterViewInit(): void {
    // Posicionar el dropdown cerca de la celda
    setTimeout(() => {
      this.positionDropdown();
    }, 0);
  }

  private positionDropdown(): void {
    if (!this.params || !this.params.eGridCell) return;

    const containerElement = this.container?.element?.nativeElement?.parentElement;
    if (!containerElement) return;

    const cellRect = this.params.eGridCell.getBoundingClientRect();

    // Posicionar debajo de la celda
    containerElement.style.top = `${cellRect.bottom}px`;
    containerElement.style.left = `${cellRect.left}px`;
    containerElement.style.width = `${Math.max(cellRect.width, 200)}px`;
  }

  getValue(): any {
    return this.selectedValue;
  }

  isPopup(): boolean {
    return true;
  }

  selectOption(option: SelectOption): void {
    this.selectedValue = option.id;
    this.params.stopEditing();
  }

  onOptionHover(option: SelectOption, element: HTMLElement): void {
    console.log('onOptionHover called for:', option.description);
    console.log('Has tooltip data?', this.hasTooltipData(option));

    this.hoveredOptionId = option.id;
    this.hoveredOption = option;
    this.currentHoveredElement = element;
    this.showTooltip = true;

    console.log('showTooltip set to:', this.showTooltip);

    // Calcular posición del tooltip
    this.updateTooltipPosition(element);

    // Crear tooltip en el body
    this.createTooltipInBody();
  }

  onOptionMove(element: HTMLElement): void {
    // Actualizar posición si el elemento se mueve (por scroll)
    if (this.showTooltip && this.currentHoveredElement === element) {
      this.updateTooltipPosition(element);
      // Actualizar posición del tooltip en el body
      if (this.tooltipElement) {
        this.renderer.setStyle(this.tooltipElement, 'top', `${this.tooltipPosition.top}px`);
        this.renderer.setStyle(this.tooltipElement, 'left', `${this.tooltipPosition.left}px`);
      }
    }
  }

  onOptionLeave(): void {
    this.showTooltip = false;
    this.hoveredOptionId = null;
    this.hoveredOption = null;
    this.currentHoveredElement = null;
    // Eliminar tooltip del body
    this.removeTooltipFromBody();
  }

  onScroll(): void {
    // Ocultar tooltip durante el scroll
    this.showTooltip = false;
    this.removeTooltipFromBody();
  }

  private updateTooltipPosition(element: HTMLElement): void {
    // Obtener la posición de la opción relativamente al viewport
    const optionRect = element.getBoundingClientRect();

    console.log('=== DEBUG TOOLTIP POSITION ===');
    console.log('Option rect:', {
      top: optionRect.top,
      left: optionRect.left,
      right: optionRect.right,
      bottom: optionRect.bottom,
      width: optionRect.width,
      height: optionRect.height
    });

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    console.log('Window size:', { width: windowWidth, height: windowHeight });

    const tooltipWidth = 300;
    const tooltipHeight = 150;
    const gap = 10; // Espacio entre la opción y el tooltip

    // Por defecto, mostrar a la derecha de la opción
    let left = optionRect.right + gap;
    let top = optionRect.top;
    console.log('Initial position (right side):', { top, left });

    // Si no cabe a la derecha, mostrar a la izquierda
    if (left + tooltipWidth > windowWidth) {
      left = optionRect.left - tooltipWidth - gap;
      console.log('Moved to left side:', left);
    }

    // Si aún no cabe a la izquierda, forzar al lado derecho pero ajustado
    if (left < 0) {
      left = optionRect.right + gap;
      console.log('Moved back to right side (left was negative):', left);
      // Si se sale por la derecha, limitarlo
      if (left + tooltipWidth > windowWidth) {
        left = windowWidth - tooltipWidth - gap;
        console.log('Adjusted to fit window:', left);
      }
    }

    // Ajustar verticalmente para que esté alineado con la opción
    // Si no cabe abajo, ajustar hacia arriba
    if (top + tooltipHeight > windowHeight) {
      top = windowHeight - tooltipHeight - gap;
      console.log('Adjusted top (bottom overflow):', top);
    }

    // Si está muy arriba, ajustar hacia abajo
    if (top < gap) {
      top = gap;
      console.log('Adjusted top (too high):', top);
    }

    console.log('Final position:', { top, left });
    console.log('==============================');

    this.tooltipPosition = {
      top: top,
      left: left
    };
  }

  hasTooltipData(option: SelectOption): boolean {
    return !!(option.valueAddition || option.valueAddition2);
  }

  private createTooltipInBody(): void {
    if (!this.hoveredOption || !this.hasTooltipData(this.hoveredOption)) {
      return;
    }

    // Eliminar tooltip anterior si existe
    this.removeTooltipFromBody();

    // Crear nuevo tooltip
    this.tooltipElement = this.renderer.createElement('div');
    this.renderer.addClass(this.tooltipElement, 'custom-select-tooltip');

    // Estilos inline para asegurar visibilidad
    this.renderer.setStyle(this.tooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipElement, 'z-index', '999999');
    this.renderer.setStyle(this.tooltipElement, 'pointer-events', 'none');
    this.renderer.setStyle(this.tooltipElement, 'background', 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)');
    this.renderer.setStyle(this.tooltipElement, 'border-radius', '8px');
    this.renderer.setStyle(this.tooltipElement, 'box-shadow', '0 8px 24px rgba(0, 0, 0, 0.8)');
    this.renderer.setStyle(this.tooltipElement, 'border', '1px solid rgba(255, 255, 255, 0.2)');
    this.renderer.setStyle(this.tooltipElement, 'min-width', '280px');
    this.renderer.setStyle(this.tooltipElement, 'max-width', '400px');
    this.renderer.setStyle(this.tooltipElement, 'color', '#ffffff');
    this.renderer.setStyle(this.tooltipElement, 'top', `${this.tooltipPosition.top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${this.tooltipPosition.left}px`);

    // Contenido del tooltip
    let content = `
      <div style="background: rgba(255, 255, 255, 0.15); padding: 10px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.2); font-size: 13px; display: flex; align-items: center; gap: 8px; font-weight: 600;">
        <i class="bi bi-info-circle" style="font-size: 16px;"></i>
        <strong>${this.hoveredOption.description}</strong>
      </div>
      <div style="padding: 12px 14px;">
    `;

    if (this.hoveredOption.valueAddition) {
      content += `
        <div style="margin-bottom: 8px; display: flex; align-items: flex-start; gap: 8px;">
          <span style="opacity: 0.9; font-size: 12px; min-width: 100px;">
            <i class="bi bi-pencil"></i> Descripción:
          </span>
          <span style="font-size: 12px; font-weight: 500;">${this.hoveredOption.valueAddition}</span>
        </div>
      `;
    }

    if (this.hoveredOption.valueAddition2) {
      content += `
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <span style="opacity: 0.9; font-size: 12px; min-width: 100px;">
            <i class="bi bi-fonts"></i> Abreviatura:
          </span>
          <span style="font-size: 12px; font-weight: 500;">${this.hoveredOption.valueAddition2}</span>
        </div>
      `;
    }

    content += `</div>`;

    this.tooltipElement.innerHTML = content;

    // Agregar al body
    this.renderer.appendChild(document.body, this.tooltipElement);

    console.log('✅ Tooltip created in body at position:', this.tooltipPosition);
  }

  private removeTooltipFromBody(): void {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
      console.log('🗑️ Tooltip removed from body');
    }
  }

  ngOnDestroy(): void {
    this.removeTooltipFromBody();
  }
}
