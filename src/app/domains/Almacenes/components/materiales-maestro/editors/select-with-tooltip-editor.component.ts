import { Component, ViewChild, AfterViewInit, ViewContainerRef } from '@angular/core';
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
      z-index: 99999;
      pointer-events: none;
      animation: tooltipFadeIn 0.2s ease-out;
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
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
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
export class SelectWithTooltipEditorComponent implements ICellEditorAngularComp, AfterViewInit {
  @ViewChild('container', { read: ViewContainerRef }) container!: ViewContainerRef;

  options: SelectOption[] = [];
  selectedValue: any = null;
  hoveredOptionId: any = null;
  hoveredOption: SelectOption | null = null;
  tooltipPosition = { top: 0, left: 0 };
  showTooltip = false;
  private currentHoveredElement: HTMLElement | null = null;
  private params!: SelectWithTooltipParams;

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
    this.hoveredOptionId = option.id;
    this.hoveredOption = option;
    this.currentHoveredElement = element;
    this.showTooltip = true;

    // Calcular posición del tooltip
    this.updateTooltipPosition(element);
  }

  onOptionMove(element: HTMLElement): void {
    // Actualizar posición si el elemento se mueve (por scroll)
    if (this.showTooltip && this.currentHoveredElement === element) {
      this.updateTooltipPosition(element);
    }
  }

  onOptionLeave(): void {
    this.showTooltip = false;
    // No limpiar inmediatamente para que el tooltip no parpadee
    setTimeout(() => {
      if (!this.showTooltip) {
        this.hoveredOptionId = null;
        this.hoveredOption = null;
        this.currentHoveredElement = null;
      }
    }, 100);
  }

  onScroll(): void {
    // Ocultar tooltip durante el scroll
    this.showTooltip = false;
  }

  private updateTooltipPosition(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    this.tooltipPosition = {
      top: rect.top,
      left: rect.right + 10
    };
  }

  hasTooltipData(option: SelectOption): boolean {
    return !!(option.valueAddition || option.valueAddition2);
  }
}
