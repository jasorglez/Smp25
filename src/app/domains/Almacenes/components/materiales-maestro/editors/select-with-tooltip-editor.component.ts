import { Component, AfterViewInit, Renderer2, OnDestroy } from '@angular/core';
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
    <!-- Placeholder vacío - el dropdown se renderiza en el body -->
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
  options: SelectOption[] = [];
  selectedValue: any = null;
  hoveredOptionId: any = null;
  hoveredOption: SelectOption | null = null;
  tooltipPosition = { top: 0, left: 0 };
  dropdownPosition = { top: 0, left: 0 };
  showTooltip = false;
  private currentHoveredElement: HTMLElement | null = null;
  private params!: SelectWithTooltipParams;
  private tooltipElement: HTMLElement | null = null;
  private dropdownElement: HTMLElement | null = null;

  constructor(private renderer: Renderer2) {}

  agInit(params: SelectWithTooltipParams): void {
    this.params = params;
    this.options = params.options || [];
    this.selectedValue = params.value;
  }

  ngAfterViewInit(): void {
    // Crear el dropdown en el body
    setTimeout(() => {
      this.createDropdownInBody();
    }, 0);
  }

  private createDropdownInBody(): void {
    if (!this.params || !this.params.eGridCell) return;

    // Obtener posición de la celda
    const cellRect = this.params.eGridCell.getBoundingClientRect();

    // Crear contenedor del dropdown
    this.dropdownElement = this.renderer.createElement('div');
    this.renderer.addClass(this.dropdownElement, 'custom-select-dropdown-container');

    // Estilos del contenedor
    this.renderer.setStyle(this.dropdownElement, 'position', 'fixed');
    this.renderer.setStyle(this.dropdownElement, 'z-index', '10000');
    this.renderer.setStyle(this.dropdownElement, 'background', 'white');
    this.renderer.setStyle(this.dropdownElement, 'border', '1px solid #ccc');
    this.renderer.setStyle(this.dropdownElement, 'box-shadow', '0 4px 12px rgba(0, 0, 0, 0.15)');
    this.renderer.setStyle(this.dropdownElement, 'max-height', '300px');
    this.renderer.setStyle(this.dropdownElement, 'overflow-y', 'auto');
    this.renderer.setStyle(this.dropdownElement, 'border-radius', '4px');
    this.renderer.setStyle(this.dropdownElement, 'min-width', '200px');
    this.renderer.setStyle(this.dropdownElement, 'top', `${cellRect.bottom}px`);
    this.renderer.setStyle(this.dropdownElement, 'left', `${cellRect.left}px`);
    this.renderer.setStyle(this.dropdownElement, 'width', `${Math.max(cellRect.width, 200)}px`);

    // Crear opciones
    this.options.forEach((option) => {
      const optionElement = this.renderer.createElement('div');
      this.renderer.addClass(optionElement, 'custom-select-option');

      // Estilos de la opción
      this.renderer.setStyle(optionElement, 'padding', '8px 12px');
      this.renderer.setStyle(optionElement, 'cursor', 'pointer');
      this.renderer.setStyle(optionElement, 'transition', 'background-color 0.2s ease');
      this.renderer.setStyle(optionElement, 'border-bottom', '1px solid #f0f0f0');
      this.renderer.setStyle(optionElement, 'user-select', 'none');
      this.renderer.setStyle(optionElement, 'position', 'relative');
      this.renderer.setStyle(optionElement, 'z-index', '1');

      if (option.id === this.selectedValue) {
        this.renderer.setStyle(optionElement, 'background-color', '#2196f3');
        this.renderer.setStyle(optionElement, 'color', 'white');
        this.renderer.setStyle(optionElement, 'font-weight', '600');
      }

      // Texto de la opción
      const textElement = this.renderer.createElement('span');
      const text = this.renderer.createText(option.description);
      this.renderer.appendChild(textElement, text);
      this.renderer.setStyle(textElement, 'display', 'block');
      this.renderer.setStyle(textElement, 'white-space', 'nowrap');
      this.renderer.setStyle(textElement, 'overflow', 'hidden');
      this.renderer.setStyle(textElement, 'text-overflow', 'ellipsis');
      this.renderer.appendChild(optionElement, textElement);

      // Event listeners - Click primero con prioridad
      this.renderer.listen(optionElement, 'mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.selectOption(option);
      });
      this.renderer.listen(optionElement, 'click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.selectOption(option);
      });
      this.renderer.listen(optionElement, 'mouseenter', () => {
        this.hoveredOptionId = option.id;
        this.renderer.setStyle(optionElement, 'background-color', '#e3f2fd');
        this.onOptionHover(option, optionElement);
      });
      this.renderer.listen(optionElement, 'mouseleave', () => {
        if (option.id !== this.selectedValue) {
          this.renderer.setStyle(optionElement, 'background-color', 'transparent');
        }
        this.onOptionLeave();
      });
      this.renderer.listen(optionElement, 'mousemove', () => {
        this.onOptionMove(optionElement);
      });

      this.renderer.appendChild(this.dropdownElement, optionElement);
    });

    // Event listener para scroll
    this.renderer.listen(this.dropdownElement, 'scroll', () => this.onScroll());

    // Agregar al body
    this.renderer.appendChild(document.body, this.dropdownElement);
  }

  private removeDropdownFromBody(): void {
    if (this.dropdownElement) {
      this.renderer.removeChild(document.body, this.dropdownElement);
      this.dropdownElement = null;
    }
  }

  getValue(): any {
    return this.selectedValue;
  }

  isPopup(): boolean {
    return true;
  }

  selectOption(option: SelectOption): void {
    console.log('Opción seleccionada:', option.description, 'ID:', option.id);
    this.selectedValue = option.id;

    // Limpiar inmediatamente
    this.showTooltip = false;
    this.hoveredOptionId = null;
    this.hoveredOption = null;
    this.currentHoveredElement = null;

    // Remover elementos del DOM
    this.removeTooltipFromBody();
    this.removeDropdownFromBody();

    // Detener edición
    if (this.params && this.params.stopEditing) {
      this.params.stopEditing();
    }
  }

  onOptionHover(option: SelectOption, element: HTMLElement): void {
    this.hoveredOptionId = option.id;
    this.hoveredOption = option;
    this.currentHoveredElement = element;
    this.showTooltip = true;

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

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const tooltipWidth = 300;
    const tooltipHeight = 150;
    const gap = 10; // Espacio entre la opción y el tooltip

    // Por defecto, mostrar a la derecha de la opción
    let left = optionRect.right + gap;
    let top = optionRect.top;

    // Si no cabe a la derecha, mostrar a la izquierda
    if (left + tooltipWidth > windowWidth) {
      left = optionRect.left - tooltipWidth - gap;
    }

    // Si aún no cabe a la izquierda, forzar al lado derecho pero ajustado
    if (left < 0) {
      left = optionRect.right + gap;
      // Si se sale por la derecha, limitarlo
      if (left + tooltipWidth > windowWidth) {
        left = windowWidth - tooltipWidth - gap;
      }
    }

    // Ajustar verticalmente para que esté alineado con la opción
    // Si no cabe abajo, ajustar hacia arriba
    if (top + tooltipHeight > windowHeight) {
      top = windowHeight - tooltipHeight - gap;
    }

    // Si está muy arriba, ajustar hacia abajo
    if (top < gap) {
      top = gap;
    }

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
  }

  private removeTooltipFromBody(): void {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  ngOnDestroy(): void {
    this.removeDropdownFromBody();
    this.removeTooltipFromBody();
  }
}
