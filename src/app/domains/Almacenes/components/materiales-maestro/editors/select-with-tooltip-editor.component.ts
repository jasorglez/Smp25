import { Component, OnDestroy, AfterViewInit, Renderer2 } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { ICellEditorParams } from 'ag-grid-enterprise';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface SelectOption {
  id: number | string;
  description: string;
  valueAddition?: string;
  valueAddition2?: string;
  label2?: string; // Label personalizado para valueAddition2
}

export interface SelectWithTooltipParams extends ICellEditorParams {
  options: SelectOption[];
}

@Component({
  selector: 'app-select-with-tooltip-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="width: 1px; height: 1px; visibility: hidden;"></div>
  `,
  styles: [`
    .select-editor-wrapper {
      background: white;
      border: 1px solid #ccc;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border-radius: 4px;
      min-width: 200px;
      max-height: 350px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .search-container {
      padding: 8px;
      border-bottom: 1px solid #e0e0e0;
      background: #f9f9f9;
      flex-shrink: 0;
    }

    .search-input {
      width: 100%;
      padding: 6px 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
    }

    .search-input:focus {
      border-color: #2196f3;
      box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
    }

    .options-container {
      overflow-y: auto;
      max-height: 250px;
      flex-grow: 1;
    }

    .no-results {
      padding: 12px;
      text-align: center;
      color: #999;
      font-style: italic;
    }

    .select-option {
      position: relative;
      padding: 8px 12px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      border-bottom: 1px solid #f0f0f0;
      user-select: none;
    }

    .select-option:last-child {
      border-bottom: none;
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
      z-index: 999999;
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
    .options-container::-webkit-scrollbar {
      width: 8px;
    }

    .options-container::-webkit-scrollbar-track {
      background: #f1f1f1;
    }

    .options-container::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 4px;
    }

    .options-container::-webkit-scrollbar-thumb:hover {
      background: #555;
    }
  `]
})
export class SelectWithTooltipEditorComponent implements ICellEditorAngularComp, AfterViewInit, OnDestroy {
  options: SelectOption[] = [];
  filteredOptions: SelectOption[] = [];
  selectedValue: any = null;
  hoveredOption: SelectOption | null = null;
  tooltipPosition = { top: 0, left: 0 };
  showTooltip = false;
  searchText: string = '';
  private params!: SelectWithTooltipParams;
  private dropdownElement: HTMLElement | null = null;
  private searchInputElement: HTMLInputElement | null = null;
  private tooltipElement: HTMLElement | null = null;
  private documentClickListener: (() => void) | null = null;

  constructor(private renderer: Renderer2) {}

  agInit(params: SelectWithTooltipParams): void {
    console.log('SelectWithTooltipEditor: agInit called');
    this.params = params;
    this.options = params.options || [];
    this.filteredOptions = [...this.options];
    this.selectedValue = params.value;

    // Crear el dropdown inmediatamente en agInit
    setTimeout(() => {
      console.log('SelectWithTooltipEditor: Creating dropdown in agInit');
      this.createDropdownInBody();

      // Configurar listener después de un delay
      setTimeout(() => {
        console.log('SelectWithTooltipEditor: Setting up document click listener');
        this.setupDocumentClickListener();
      }, 300);
    }, 0);
  }

  ngAfterViewInit(): void {
    console.log('SelectWithTooltipEditor: ngAfterViewInit called');
  }

  afterGuiAttached?(): void {
    console.log('SelectWithTooltipEditor: afterGuiAttached called');
  }

  private setupDocumentClickListener(): void {
    // Agregar listener para clicks fuera del dropdown
    this.documentClickListener = this.renderer.listen('document', 'mousedown', (event: MouseEvent) => {
      if (this.dropdownElement && !this.dropdownElement.contains(event.target as Node)) {
        // Click fuera del dropdown - cerrar sin guardar
        this.removeDropdownFromBody();
        if (this.params && this.params.stopEditing) {
          this.params.stopEditing(true); // true = cancelar
        }
      }
    });
  }

  getValue(): any {
    return this.selectedValue;
  }

  isPopup(): boolean {
    // Retornar false para que AG Grid no intente manejar el popup
    return false;
  }

  isCancelBeforeStart(): boolean {
    return false;
  }

  isCancelAfterEnd(): boolean {
    return false;
  }

  onWrapperMouseDown(event: MouseEvent): void {
    event.stopPropagation();
  }

  onOptionMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  selectOption(option: SelectOption): void {
    console.log('Opción seleccionada:', option.description, 'ID:', option.id);
    this.selectedValue = option.id;
    this.showTooltip = false;
    this.hoveredOption = null;

    // Limpiar dropdown antes de cerrar
    this.removeDropdownFromBody();

    // Detener edición
    if (this.params && this.params.stopEditing) {
      this.params.stopEditing();
    }
  }

  filterOptions(): void {
    const searchLower = this.searchText.toLowerCase().trim();

    if (!searchLower) {
      this.filteredOptions = [...this.options];
    } else {
      this.filteredOptions = this.options.filter(option =>
        option.description.toLowerCase().includes(searchLower) ||
        option.valueAddition?.toLowerCase().includes(searchLower) ||
        option.valueAddition2?.toLowerCase().includes(searchLower)
      );
    }
  }

  onOptionHover(option: SelectOption, event: MouseEvent): void {
    this.hoveredOption = option;
    this.showTooltip = true;
    this.updateTooltipPosition(event);
    this.createTooltipInBody();
  }

  onOptionMove(event: MouseEvent): void {
    if (this.showTooltip) {
      this.updateTooltipPosition(event);
    }
  }

  onOptionLeave(): void {
    this.showTooltip = false;
    this.hoveredOption = null;
  }

  onScroll(): void {
    this.showTooltip = false;
  }

  private updateTooltipPosition(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (!target) return;

    const optionRect = target.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const tooltipWidth = 300;
    const tooltipHeight = 150;
    const gap = 10;

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
      if (left + tooltipWidth > windowWidth) {
        left = windowWidth - tooltipWidth - gap;
      }
    }

    // Ajustar verticalmente
    if (top + tooltipHeight > windowHeight) {
      top = windowHeight - tooltipHeight - gap;
    }

    if (top < gap) {
      top = gap;
    }

    this.tooltipPosition = { top, left };
  }

  hasTooltipData(option: SelectOption): boolean {
    return !!(option.valueAddition || option.valueAddition2);
  }

  private createDropdownInBody(): void {
    if (!this.params || !this.params.eGridCell) return;

    const cellRect = this.params.eGridCell.getBoundingClientRect();

    // Crear contenedor principal
    this.dropdownElement = this.renderer.createElement('div');
    this.renderer.addClass(this.dropdownElement, 'select-editor-wrapper');
    this.renderer.setStyle(this.dropdownElement, 'position', 'fixed');
    this.renderer.setStyle(this.dropdownElement, 'top', `${cellRect.bottom}px`);
    this.renderer.setStyle(this.dropdownElement, 'left', `${cellRect.left}px`);
    this.renderer.setStyle(this.dropdownElement, 'width', `${Math.max(cellRect.width, 200)}px`);
    this.renderer.setStyle(this.dropdownElement, 'z-index', '10000');

    // Prevenir propagación de eventos en el contenedor
    this.renderer.listen(this.dropdownElement, 'mousedown', (e: Event) => e.stopPropagation());
    this.renderer.listen(this.dropdownElement, 'click', (e: Event) => e.stopPropagation());

    // Crear contenedor de búsqueda
    const searchContainer = this.renderer.createElement('div');
    this.renderer.addClass(searchContainer, 'search-container');

    // Crear input de búsqueda
    this.searchInputElement = this.renderer.createElement('input');
    this.renderer.addClass(this.searchInputElement, 'search-input');
    this.renderer.setAttribute(this.searchInputElement, 'type', 'text');
    this.renderer.setAttribute(this.searchInputElement, 'placeholder', 'Buscar...');
    this.renderer.setProperty(this.searchInputElement, 'value', this.searchText);

    // Event listeners del input
    this.renderer.listen(this.searchInputElement, 'input', (e: any) => {
      this.searchText = e.target.value;
      this.filterOptions();
      this.renderOptions();
    });

    this.renderer.listen(this.searchInputElement, 'mousedown', (e: Event) => e.stopPropagation());
    this.renderer.listen(this.searchInputElement, 'click', (e: Event) => e.stopPropagation());

    this.renderer.appendChild(searchContainer, this.searchInputElement);
    this.renderer.appendChild(this.dropdownElement, searchContainer);

    // Crear contenedor de opciones
    const optionsContainer = this.renderer.createElement('div');
    this.renderer.addClass(optionsContainer, 'options-container');
    this.renderer.listen(optionsContainer, 'scroll', () => {
      this.showTooltip = false;
      this.removeTooltipFromBody();
    });

    this.renderer.appendChild(this.dropdownElement, optionsContainer);

    // Agregar al body
    this.renderer.appendChild(document.body, this.dropdownElement);

    // Renderizar opciones iniciales
    this.renderOptions();

    // Auto-focus en el input
    setTimeout(() => {
      if (this.searchInputElement) {
        this.searchInputElement.focus();
      }
    }, 50);
  }

  private renderOptions(): void {
    if (!this.dropdownElement) return;

    const optionsContainer = this.dropdownElement.querySelector('.options-container');
    if (!optionsContainer) return;

    // Limpiar opciones anteriores
    while (optionsContainer.firstChild) {
      this.renderer.removeChild(optionsContainer, optionsContainer.firstChild);
    }

    // Si no hay resultados
    if (this.filteredOptions.length === 0) {
      const noResults = this.renderer.createElement('div');
      this.renderer.addClass(noResults, 'no-results');
      const text = this.renderer.createText('No se encontraron resultados');
      this.renderer.appendChild(noResults, text);
      this.renderer.appendChild(optionsContainer, noResults);
      return;
    }

    // Renderizar opciones
    this.filteredOptions.forEach(option => {
      const optionElement = this.renderer.createElement('div');
      this.renderer.addClass(optionElement, 'select-option');

      if (option.id === this.selectedValue) {
        this.renderer.addClass(optionElement, 'selected');
      }

      const textSpan = this.renderer.createElement('span');
      this.renderer.addClass(textSpan, 'option-text');
      const text = this.renderer.createText(option.description);
      this.renderer.appendChild(textSpan, text);
      this.renderer.appendChild(optionElement, textSpan);

      // Event listeners
      this.renderer.listen(optionElement, 'mousedown', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      });

      this.renderer.listen(optionElement, 'click', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectOption(option);
      });

      this.renderer.listen(optionElement, 'mouseenter', (e: MouseEvent) => {
        this.onOptionHover(option, e);
      });

      this.renderer.listen(optionElement, 'mouseleave', () => {
        this.onOptionLeave();
      });

      this.renderer.listen(optionElement, 'mousemove', (e: MouseEvent) => {
        this.onOptionMove(e);
      });

      this.renderer.appendChild(optionsContainer, optionElement);
    });
  }

  private createTooltipInBody(): void {
    if (!this.hoveredOption || !this.hasTooltipData(this.hoveredOption)) {
      return;
    }

    // Eliminar tooltip anterior
    this.removeTooltipFromBody();

    // Crear nuevo tooltip
    this.tooltipElement = this.renderer.createElement('div');
    this.renderer.addClass(this.tooltipElement, 'option-tooltip');
    this.renderer.setStyle(this.tooltipElement, 'top', `${this.tooltipPosition.top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${this.tooltipPosition.left}px`);

    // Crear contenido del tooltip
    const tooltipContent = this.renderer.createElement('div');
    this.renderer.addClass(tooltipContent, 'tooltip-content');

    // Header
    const tooltipHeader = this.renderer.createElement('div');
    this.renderer.addClass(tooltipHeader, 'tooltip-header');

    const icon = this.renderer.createElement('i');
    this.renderer.addClass(icon, 'bi');
    this.renderer.addClass(icon, 'bi-info-circle');
    this.renderer.appendChild(tooltipHeader, icon);

    const title = this.renderer.createElement('strong');
    const titleText = this.renderer.createText(this.hoveredOption.description);
    this.renderer.appendChild(title, titleText);
    this.renderer.appendChild(tooltipHeader, title);

    this.renderer.appendChild(tooltipContent, tooltipHeader);

    // Body
    const tooltipBody = this.renderer.createElement('div');
    this.renderer.addClass(tooltipBody, 'tooltip-body');

    if (this.hoveredOption.valueAddition) {
      const row1 = this.renderer.createElement('div');
      this.renderer.addClass(row1, 'tooltip-row');

      const label1 = this.renderer.createElement('span');
      this.renderer.addClass(label1, 'tooltip-label');
      label1.innerHTML = '<i class="bi bi-pencil"></i> Descripción:';
      this.renderer.appendChild(row1, label1);

      const value1 = this.renderer.createElement('span');
      this.renderer.addClass(value1, 'tooltip-value');
      const valueText1 = this.renderer.createText(this.hoveredOption.valueAddition);
      this.renderer.appendChild(value1, valueText1);
      this.renderer.appendChild(row1, value1);

      this.renderer.appendChild(tooltipBody, row1);
    }

    if (this.hoveredOption.valueAddition2) {
      const row2 = this.renderer.createElement('div');
      this.renderer.addClass(row2, 'tooltip-row');

      const label2 = this.renderer.createElement('span');
      this.renderer.addClass(label2, 'tooltip-label');
      const labelText = this.hoveredOption.label2 || 'Abreviatura:';
      const icon = this.hoveredOption.label2 ? 'bi-building' : 'bi-fonts';
      label2.innerHTML = `<i class="bi ${icon}"></i> ${labelText}`;
      this.renderer.appendChild(row2, label2);

      const value2 = this.renderer.createElement('span');
      this.renderer.addClass(value2, 'tooltip-value');
      const valueText2 = this.renderer.createText(this.hoveredOption.valueAddition2);
      this.renderer.appendChild(value2, valueText2);
      this.renderer.appendChild(row2, value2);

      this.renderer.appendChild(tooltipBody, row2);
    }

    this.renderer.appendChild(tooltipContent, tooltipBody);
    this.renderer.appendChild(this.tooltipElement, tooltipContent);

    // Arrow
    const arrow = this.renderer.createElement('div');
    this.renderer.addClass(arrow, 'tooltip-arrow');
    this.renderer.appendChild(this.tooltipElement, arrow);

    // Agregar al body
    this.renderer.appendChild(document.body, this.tooltipElement);
  }

  private removeTooltipFromBody(): void {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  private removeDropdownFromBody(): void {
    this.removeTooltipFromBody();

    // Remover listener global
    if (this.documentClickListener) {
      this.documentClickListener();
      this.documentClickListener = null;
    }

    if (this.dropdownElement) {
      this.renderer.removeChild(document.body, this.dropdownElement);
      this.dropdownElement = null;
      this.searchInputElement = null;
    }
  }

  ngOnDestroy(): void {
    console.log('SelectWithTooltipEditor: ngOnDestroy called');
    this.removeDropdownFromBody();
  }
}
