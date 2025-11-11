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
  private hoveredOption: SelectOption | null = null;
  private tooltipPosition = { top: 0, left: 0 };
  private showTooltip = false;
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
      this.showTooltip = false;
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
      });

      this.renderer.listen(optionElement, 'mouseleave', () => {
        if (option.id !== this.selectedValue) {
          this.renderer.setStyle(optionElement, 'background-color', 'transparent');
        }
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
}