import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';

export interface SelectOption {
  id: number | string;
  description: string;
  valueAddition?: string;
  valueAddition2?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SelectDropdownService {
  private renderer: Renderer2;
  private dropdownElement: HTMLElement | null = null;
  private searchInputElement: HTMLInputElement | null = null;
  private tooltipElement: HTMLElement | null = null;
  private documentClickListener: (() => void) | null = null;
  private onSelectCallback: ((value: any) => void) | null = null;
  private onCancelCallback: (() => void) | null = null;

  private options: SelectOption[] = [];
  private filteredOptions: SelectOption[] = [];
  private selectedValue: any = null;
  private searchText: string = '';

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  openDropdown(
    cellRect: DOMRect,
    options: SelectOption[],
    currentValue: any,
    onSelect: (value: any) => void,
    onCancel: () => void
  ): void {
    console.log('SelectDropdownService: Opening dropdown');

    // Cerrar dropdown anterior si existe (sin limpiar callbacks)
    if (this.dropdownElement) {
      console.log('SelectDropdownService: Closing previous dropdown');
      this.removeTooltipFromBody();

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

    this.options = options;
    this.filteredOptions = [...options];
    this.selectedValue = currentValue;
    this.onSelectCallback = onSelect;
    this.onCancelCallback = onCancel;
    this.searchText = '';

    // Crear dropdown
    this.createDropdownInBody(cellRect);

    // Configurar listener después de un delay
    setTimeout(() => {
      this.setupDocumentClickListener();
    }, 300);
  }

  closeDropdown(): void {
    console.log('SelectDropdownService: Closing dropdown');
    this.removeTooltipFromBody();

    if (this.documentClickListener) {
      this.documentClickListener();
      this.documentClickListener = null;
    }

    if (this.dropdownElement) {
      this.renderer.removeChild(document.body, this.dropdownElement);
      this.dropdownElement = null;
      this.searchInputElement = null;
    }

    this.onSelectCallback = null;
    this.onCancelCallback = null;
  }

  private createDropdownInBody(cellRect: DOMRect): void {
    // Crear contenedor principal
    this.dropdownElement = this.renderer.createElement('div');
    this.renderer.addClass(this.dropdownElement, 'select-editor-wrapper');
    this.renderer.setStyle(this.dropdownElement, 'position', 'fixed');
    this.renderer.setStyle(this.dropdownElement, 'top', `${cellRect.bottom}px`);
    this.renderer.setStyle(this.dropdownElement, 'left', `${cellRect.left}px`);
    this.renderer.setStyle(this.dropdownElement, 'width', `${Math.max(cellRect.width, 200)}px`);
    this.renderer.setStyle(this.dropdownElement, 'z-index', '10000');
    this.renderer.setStyle(this.dropdownElement, 'background', 'white');
    this.renderer.setStyle(this.dropdownElement, 'border', '1px solid #ccc');
    this.renderer.setStyle(this.dropdownElement, 'box-shadow', '0 4px 12px rgba(0, 0, 0, 0.15)');
    this.renderer.setStyle(this.dropdownElement, 'border-radius', '4px');
    this.renderer.setStyle(this.dropdownElement, 'min-width', '200px');
    this.renderer.setStyle(this.dropdownElement, 'max-height', '350px');
    this.renderer.setStyle(this.dropdownElement, 'display', 'flex');
    this.renderer.setStyle(this.dropdownElement, 'flex-direction', 'column');
    this.renderer.setStyle(this.dropdownElement, 'overflow', 'hidden');

    // Prevenir propagación de eventos
    this.renderer.listen(this.dropdownElement, 'mousedown', (e: Event) => e.stopPropagation());
    this.renderer.listen(this.dropdownElement, 'click', (e: Event) => e.stopPropagation());

    // Crear input de búsqueda
    const searchContainer = this.renderer.createElement('div');
    this.renderer.setStyle(searchContainer, 'padding', '8px');
    this.renderer.setStyle(searchContainer, 'border-bottom', '1px solid #e0e0e0');
    this.renderer.setStyle(searchContainer, 'background', '#f9f9f9');
    this.renderer.setStyle(searchContainer, 'flex-shrink', '0');

    this.searchInputElement = this.renderer.createElement('input');
    this.renderer.setAttribute(this.searchInputElement, 'type', 'text');
    this.renderer.setAttribute(this.searchInputElement, 'placeholder', 'Buscar...');
    this.renderer.setStyle(this.searchInputElement, 'width', '100%');
    this.renderer.setStyle(this.searchInputElement, 'padding', '6px 10px');
    this.renderer.setStyle(this.searchInputElement, 'border', '1px solid #ccc');
    this.renderer.setStyle(this.searchInputElement, 'border-radius', '4px');
    this.renderer.setStyle(this.searchInputElement, 'font-size', '13px');
    this.renderer.setStyle(this.searchInputElement, 'outline', 'none');
    this.renderer.setStyle(this.searchInputElement, 'box-sizing', 'border-box');

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
    this.renderer.setStyle(optionsContainer, 'overflow-y', 'auto');
    this.renderer.setStyle(optionsContainer, 'max-height', '250px');
    this.renderer.setStyle(optionsContainer, 'flex-grow', '1');

    this.renderer.listen(optionsContainer, 'scroll', () => {
      this.removeTooltipFromBody();
    });

    this.renderer.appendChild(this.dropdownElement, optionsContainer);

    // Agregar al body
    this.renderer.appendChild(document.body, this.dropdownElement);

    // Renderizar opciones
    this.renderOptions();

    // Auto-focus
    setTimeout(() => {
      if (this.searchInputElement) {
        this.searchInputElement.focus();
      }
    }, 50);
  }

  private renderOptions(): void {
    if (!this.dropdownElement) return;

    const optionsContainer = this.dropdownElement.querySelector('div:nth-child(2)') as HTMLElement;
    if (!optionsContainer) return;

    // Limpiar opciones anteriores
    while (optionsContainer.firstChild) {
      this.renderer.removeChild(optionsContainer, optionsContainer.firstChild);
    }

    // Si no hay resultados
    if (this.filteredOptions.length === 0) {
      const noResults = this.renderer.createElement('div');
      this.renderer.setStyle(noResults, 'padding', '12px');
      this.renderer.setStyle(noResults, 'text-align', 'center');
      this.renderer.setStyle(noResults, 'color', '#999');
      this.renderer.setStyle(noResults, 'font-style', 'italic');
      const text = this.renderer.createText('No se encontraron resultados');
      this.renderer.appendChild(noResults, text);
      this.renderer.appendChild(optionsContainer, noResults);
      return;
    }

    // Renderizar opciones
    this.filteredOptions.forEach(option => {
      const optionElement = this.renderer.createElement('div');
      this.renderer.setStyle(optionElement, 'position', 'relative');
      this.renderer.setStyle(optionElement, 'padding', '8px 12px');
      this.renderer.setStyle(optionElement, 'cursor', 'pointer');
      this.renderer.setStyle(optionElement, 'transition', 'background-color 0.2s ease');
      this.renderer.setStyle(optionElement, 'border-bottom', '1px solid #f0f0f0');
      this.renderer.setStyle(optionElement, 'user-select', 'none');

      if (option.id === this.selectedValue) {
        this.renderer.setStyle(optionElement, 'background-color', '#2196f3');
        this.renderer.setStyle(optionElement, 'color', 'white');
        this.renderer.setStyle(optionElement, 'font-weight', '600');
      }

      const textSpan = this.renderer.createElement('span');
      this.renderer.setStyle(textSpan, 'display', 'block');
      this.renderer.setStyle(textSpan, 'white-space', 'nowrap');
      this.renderer.setStyle(textSpan, 'overflow', 'hidden');
      this.renderer.setStyle(textSpan, 'text-overflow', 'ellipsis');
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

      this.renderer.listen(optionElement, 'mouseenter', () => {
        if (option.id !== this.selectedValue) {
          this.renderer.setStyle(optionElement, 'background-color', '#e3f2fd');
        }

        // Crear y mostrar tooltip
        const rect = optionElement.getBoundingClientRect();
        this.createTooltip(option, rect);
      });

      this.renderer.listen(optionElement, 'mouseleave', () => {
        if (option.id !== this.selectedValue) {
          this.renderer.setStyle(optionElement, 'background-color', 'transparent');
        }

        // Ocultar tooltip
        this.removeTooltipFromBody();
      });

      this.renderer.appendChild(optionsContainer, optionElement);
    });
  }

  private filterOptions(): void {
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

  private selectOption(option: SelectOption): void {
    console.log('SelectDropdownService: Option selected:', option.description);
    this.selectedValue = option.id;

    if (this.onSelectCallback) {
      this.onSelectCallback(option.id);
    }

    this.closeDropdown();
  }

  private setupDocumentClickListener(): void {
    this.documentClickListener = this.renderer.listen('document', 'mousedown', (event: MouseEvent) => {
      if (this.dropdownElement && !this.dropdownElement.contains(event.target as Node)) {
        console.log('SelectDropdownService: Click outside, canceling');
        if (this.onCancelCallback) {
          this.onCancelCallback();
        }
        this.closeDropdown();
      }
    });
  }

  private removeTooltipFromBody(): void {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  private createTooltip(option: SelectOption, optionRect: DOMRect): void {
    // Remover tooltip anterior si existe
    this.removeTooltipFromBody();

    // Siempre mostrar tooltip (incluso si los campos están vacíos o NA)
    const description = option.valueAddition || 'NA';
    const abbreviation = option.valueAddition2 || 'NA';

    // Crear contenedor del tooltip
    this.tooltipElement = this.renderer.createElement('div');
    this.renderer.addClass(this.tooltipElement, 'select-editor-tooltip');
    this.renderer.setStyle(this.tooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipElement, 'z-index', '10001');
    this.renderer.setStyle(this.tooltipElement, 'pointer-events', 'none');
    this.renderer.setStyle(this.tooltipElement, 'min-width', '280px');
    this.renderer.setStyle(this.tooltipElement, 'max-width', '400px');
    this.renderer.setStyle(this.tooltipElement, 'animation', 'tooltipFadeIn 0.3s ease-out forwards');

    // Crear flecha del tooltip (apuntando a la izquierda para posición derecha)
    const arrow = this.renderer.createElement('div');
    this.renderer.addClass(arrow, 'tooltip-arrow');
    this.renderer.setStyle(arrow, 'position', 'absolute');
    this.renderer.setStyle(arrow, 'left', '-8px');
    this.renderer.setStyle(arrow, 'top', '20px');
    this.renderer.setStyle(arrow, 'width', '0');
    this.renderer.setStyle(arrow, 'height', '0');
    this.renderer.setStyle(arrow, 'border-top', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-bottom', '8px solid transparent');
    this.renderer.setStyle(arrow, 'border-right', '8px solid #1e40af');
    this.renderer.appendChild(this.tooltipElement, arrow);

    // Crear contenido del tooltip
    const content = this.renderer.createElement('div');
    this.renderer.addClass(content, 'tooltip-content');
    this.renderer.setStyle(content, 'border-radius', '8px');
    this.renderer.setStyle(content, 'box-shadow', '0 8px 24px rgba(0, 0, 0, 0.4)');
    this.renderer.setStyle(content, 'overflow', 'hidden');
    this.renderer.setStyle(content, 'border', '1px solid rgba(255, 255, 255, 0.1)');
    this.renderer.setStyle(content, 'background', 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)');

    // Crear header
    const header = this.renderer.createElement('div');
    this.renderer.setStyle(header, 'background', 'rgba(255, 255, 255, 0.15)');
    this.renderer.setStyle(header, 'padding', '10px 14px');
    this.renderer.setStyle(header, 'border-bottom', '1px solid rgba(255, 255, 255, 0.2)');
    this.renderer.setStyle(header, 'color', '#ffffff');
    this.renderer.setStyle(header, 'font-size', '13px');
    this.renderer.setStyle(header, 'display', 'flex');
    this.renderer.setStyle(header, 'align-items', 'center');
    this.renderer.setStyle(header, 'gap', '8px');
    this.renderer.setStyle(header, 'font-weight', '600');

    const headerIcon = this.renderer.createElement('i');
    this.renderer.addClass(headerIcon, 'bi');
    this.renderer.addClass(headerIcon, 'bi-info-circle');
    this.renderer.setStyle(headerIcon, 'font-size', '16px');
    this.renderer.appendChild(header, headerIcon);

    const headerText = this.renderer.createElement('strong');
    const headerTextNode = this.renderer.createText(option.description);
    this.renderer.appendChild(headerText, headerTextNode);
    this.renderer.appendChild(header, headerText);

    this.renderer.appendChild(content, header);

    // Crear body
    const body = this.renderer.createElement('div');
    this.renderer.setStyle(body, 'padding', '12px 14px');
    this.renderer.setStyle(body, 'color', '#e2e8f0');
    this.renderer.setStyle(body, 'font-size', '12px');

    // Agregar descripción (siempre)
    const descRow = this.renderer.createElement('div');
    this.renderer.setStyle(descRow, 'display', 'flex');
    this.renderer.setStyle(descRow, 'align-items', 'flex-start');
    this.renderer.setStyle(descRow, 'margin-bottom', '10px');
    this.renderer.setStyle(descRow, 'gap', '8px');

    const descLabel = this.renderer.createElement('span');
    this.renderer.setStyle(descLabel, 'color', 'rgba(255, 255, 255, 0.8)');
    this.renderer.setStyle(descLabel, 'font-weight', '600');
    this.renderer.setStyle(descLabel, 'min-width', '100px');
    this.renderer.setStyle(descLabel, 'display', 'flex');
    this.renderer.setStyle(descLabel, 'align-items', 'center');
    this.renderer.setStyle(descLabel, 'gap', '5px');
    this.renderer.setStyle(descLabel, 'flex-shrink', '0');

    const descIcon = this.renderer.createElement('i');
    this.renderer.addClass(descIcon, 'bi');
    this.renderer.addClass(descIcon, 'bi-pencil');
    this.renderer.setStyle(descIcon, 'font-size', '12px');
    this.renderer.appendChild(descLabel, descIcon);

    const descLabelText = this.renderer.createText('Descripción:');
    this.renderer.appendChild(descLabel, descLabelText);
    this.renderer.appendChild(descRow, descLabel);

    const descValue = this.renderer.createElement('span');
    this.renderer.setStyle(descValue, 'color', '#ffffff');
    this.renderer.setStyle(descValue, 'word-break', 'break-word');
    this.renderer.setStyle(descValue, 'line-height', '1.4');
    const descValueText = this.renderer.createText(description);
    this.renderer.appendChild(descValue, descValueText);
    this.renderer.appendChild(descRow, descValue);

    this.renderer.appendChild(body, descRow);

    // Agregar abreviatura (siempre)
    const abbrRow = this.renderer.createElement('div');
    this.renderer.setStyle(abbrRow, 'display', 'flex');
    this.renderer.setStyle(abbrRow, 'align-items', 'flex-start');
    this.renderer.setStyle(abbrRow, 'margin-bottom', '0');
    this.renderer.setStyle(abbrRow, 'gap', '8px');

    const abbrLabel = this.renderer.createElement('span');
    this.renderer.setStyle(abbrLabel, 'color', 'rgba(255, 255, 255, 0.8)');
    this.renderer.setStyle(abbrLabel, 'font-weight', '600');
    this.renderer.setStyle(abbrLabel, 'min-width', '100px');
    this.renderer.setStyle(abbrLabel, 'display', 'flex');
    this.renderer.setStyle(abbrLabel, 'align-items', 'center');
    this.renderer.setStyle(abbrLabel, 'gap', '5px');
    this.renderer.setStyle(abbrLabel, 'flex-shrink', '0');

    const abbrIcon = this.renderer.createElement('i');
    this.renderer.addClass(abbrIcon, 'bi');
    this.renderer.addClass(abbrIcon, 'bi-fonts');
    this.renderer.setStyle(abbrIcon, 'font-size', '12px');
    this.renderer.appendChild(abbrLabel, abbrIcon);

    const abbrLabelText = this.renderer.createText('Abreviatura:');
    this.renderer.appendChild(abbrLabel, abbrLabelText);
    this.renderer.appendChild(abbrRow, abbrLabel);

    const abbrValue = this.renderer.createElement('span');
    this.renderer.setStyle(abbrValue, 'color', '#ffffff');
    this.renderer.setStyle(abbrValue, 'word-break', 'break-word');
    this.renderer.setStyle(abbrValue, 'line-height', '1.4');
    const abbrValueText = this.renderer.createText(abbreviation);
    this.renderer.appendChild(abbrValue, abbrValueText);
    this.renderer.appendChild(abbrRow, abbrValue);

    this.renderer.appendChild(body, abbrRow);

    this.renderer.appendChild(content, body);
    this.renderer.appendChild(this.tooltipElement, content);

    // Agregar al body
    this.renderer.appendChild(document.body, this.tooltipElement);

    // Posicionar tooltip
    this.positionTooltip(optionRect);

    // Agregar animación de entrada
    this.renderer.setStyle(this.tooltipElement, 'opacity', '0');
    this.renderer.setStyle(this.tooltipElement, 'visibility', 'hidden');
    setTimeout(() => {
      if (this.tooltipElement) {
        this.renderer.setStyle(this.tooltipElement, 'opacity', '1');
        this.renderer.setStyle(this.tooltipElement, 'visibility', 'visible');
        this.renderer.setStyle(this.tooltipElement, 'transition', 'opacity 0.3s ease, visibility 0.3s ease');
      }
    }, 10);
  }

  private positionTooltip(optionRect: DOMRect): void {
    if (!this.tooltipElement) return;

    // Posicionar el tooltip a la derecha de la opción
    const top = optionRect.top;
    const left = optionRect.right + 8;

    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
  }
}