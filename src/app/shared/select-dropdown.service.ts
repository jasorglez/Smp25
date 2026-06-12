import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';

export interface SelectOption {
  id: number | string;
  description: string;
  valueAddition?: string;
  valueAddition2?: string;
  group?: string;
  label2?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SelectDropdownService {
  private renderer: Renderer2;
  private dropdownElement: HTMLElement | null = null;
  private searchInputElement: HTMLInputElement | null = null;
  private tooltipElement: HTMLElement | null = null; // legacy (ya no se usa; dejamos para compat)
  private infoPanelElement: HTMLElement | null = null;
  private documentClickListener: (() => void) | null = null;
  private onSelectCallback: ((value: any) => void) | null = null;
  private onCancelCallback: (() => void) | null = null;

  private options: SelectOption[] = [];
  private filteredOptions: SelectOption[] = [];
  private selectedValue: any = null;
  private searchText: string = '';
  private showAbbreviation: boolean = true;

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  openDropdown(
    cellRect: DOMRect,
    options: SelectOption[],
    currentValue: any,
    onSelect: (value: any) => void,
    onCancel: () => void,
    showAbbreviation: boolean = true
  ): void {
    // Cerrar dropdown anterior si existe (sin limpiar callbacks)
    if (this.dropdownElement) {
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
    this.showAbbreviation = showAbbreviation;

    // Crear dropdown
    this.createDropdownInBody(cellRect);

    // Configurar listener después de un delay
    setTimeout(() => {
      this.setupDocumentClickListener();
    }, 300);
  }

  closeDropdown(): void {
    this.removeTooltipFromBody();
    this.clearInfoPanel();

    if (this.documentClickListener) {
      this.documentClickListener();
      this.documentClickListener = null;
    }

    if (this.dropdownElement) {
      this.renderer.removeChild(document.body, this.dropdownElement);
      this.dropdownElement = null;
      this.searchInputElement = null;
      this.infoPanelElement = null;
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
    // El wrapper ahora contiene lista (izquierda) + panel de info (derecha)
    this.renderer.setStyle(this.dropdownElement, 'width', `${Math.max(cellRect.width, 200) + 320}px`);
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

    // Contenedor horizontal: opciones + panel de info
    const bodyRow = this.renderer.createElement('div');
    this.renderer.setStyle(bodyRow, 'display', 'flex');
    this.renderer.setStyle(bodyRow, 'flex', '1 1 auto');
    this.renderer.setStyle(bodyRow, 'min-height', '0');

    // Crear contenedor de opciones (izquierda)
    const optionsContainer = this.renderer.createElement('div');
    this.renderer.setStyle(optionsContainer, 'overflow-y', 'auto');
    this.renderer.setStyle(optionsContainer, 'max-height', '250px');
    this.renderer.setStyle(optionsContainer, 'flex', '1 1 auto');
    this.renderer.setStyle(optionsContainer, 'min-width', `${Math.max(cellRect.width, 200)}px`);

    // Panel de info (derecha) — se actualiza al hover
    this.infoPanelElement = this.renderer.createElement('div');
    this.renderer.setStyle(this.infoPanelElement, 'width', '320px');
    this.renderer.setStyle(this.infoPanelElement, 'border-left', '1px solid #e5e7eb');
    this.renderer.setStyle(this.infoPanelElement, 'background', '#ffffff');
    this.renderer.setStyle(this.infoPanelElement, 'padding', '12px 14px');
    this.renderer.setStyle(this.infoPanelElement, 'display', 'flex');
    this.renderer.setStyle(this.infoPanelElement, 'flex-direction', 'column');
    this.renderer.setStyle(this.infoPanelElement, 'gap', '10px');
    this.renderer.setStyle(this.infoPanelElement, 'color', '#111827');
    this.renderer.setStyle(this.infoPanelElement, 'font-size', '12px');
    this.renderer.setStyle(this.infoPanelElement, 'min-height', '0');

    this.renderer.listen(optionsContainer, 'scroll', () => {
      // Nada: ya no usamos tooltip flotante
    });

    this.renderer.appendChild(bodyRow, optionsContainer);
    this.renderer.appendChild(bodyRow, this.infoPanelElement);
    this.renderer.appendChild(this.dropdownElement, bodyRow);

    // Agregar al body
    this.renderer.appendChild(document.body, this.dropdownElement);

    // Renderizar opciones
    this.renderOptions();
    // Estado inicial del panel
    this.clearInfoPanel();

    // Auto-focus
    setTimeout(() => {
      if (this.searchInputElement) {
        this.searchInputElement.focus();
      }
    }, 50);
  }

  private renderOptions(): void {
    if (!this.dropdownElement) return;

    // searchContainer es child(1), bodyRow es child(2) y optionsContainer está dentro
    const optionsContainer = this.dropdownElement.querySelector('div:nth-child(2) > div:nth-child(1)') as HTMLElement;
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
      this.clearInfoPanel();
      return;
    }

    // Renderizar opciones (con headers de grupo si aplica)
    const hasGroups = this.filteredOptions.some(o => o.group);
    let lastGroup: string | undefined = undefined;

    this.filteredOptions.forEach(option => {
      // Insertar header de grupo cuando cambia
      if (hasGroups && option.group && option.group !== lastGroup) {
        lastGroup = option.group;
        const groupHeader = this.renderer.createElement('div');
        this.renderer.setStyle(groupHeader, 'padding', '5px 12px');
        this.renderer.setStyle(groupHeader, 'font-size', '11px');
        this.renderer.setStyle(groupHeader, 'font-weight', '700');
        this.renderer.setStyle(groupHeader, 'text-align', 'center');
        this.renderer.setStyle(groupHeader, 'text-transform', 'uppercase');
        this.renderer.setStyle(groupHeader, 'letter-spacing', '0.5px');
        this.renderer.setStyle(groupHeader, 'color', '#fff');
        this.renderer.setStyle(groupHeader, 'background', option.group === 'Compañía' ? '#1a5a9a' : '#5c6bc0');
        this.renderer.setStyle(groupHeader, 'border-bottom', '1px solid rgba(255,255,255,0.2)');
        const headerText = this.renderer.createText(option.group);
        this.renderer.appendChild(groupHeader, headerText);
        this.renderer.appendChild(optionsContainer, groupHeader);
      }

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

      // Event listeners — selección en mousedown para comprometer el valor
      // antes de que AG Grid detecte el click fuera de la celda y cancele el edit
      this.renderer.listen(optionElement, 'mousedown', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectOption(option);
      });

      this.renderer.listen(optionElement, 'click', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      });

      this.renderer.listen(optionElement, 'mouseenter', () => {
        if (option.id !== this.selectedValue) {
          this.renderer.setStyle(optionElement, 'background-color', '#e3f2fd');
        }

        // Mostrar info a la derecha, dentro del mismo dropdown
        this.updateInfoPanel(option);
      });

      this.renderer.listen(optionElement, 'mouseleave', () => {
        if (option.id !== this.selectedValue) {
          this.renderer.setStyle(optionElement, 'background-color', 'transparent');
        }

        // No limpiamos al salir para evitar parpadeo; se actualiza con el siguiente hover.
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
    this.selectedValue = option.id;

    if (this.onSelectCallback) {
      this.onSelectCallback(option.id);
    }

    this.closeDropdown();
  }

  private setupDocumentClickListener(): void {
    this.documentClickListener = this.renderer.listen('document', 'mousedown', (event: MouseEvent) => {
      if (this.dropdownElement && !this.dropdownElement.contains(event.target as Node)) {
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

  private clearInfoPanel(): void {
    if (!this.infoPanelElement) return;
    while (this.infoPanelElement.firstChild) {
      this.renderer.removeChild(this.infoPanelElement, this.infoPanelElement.firstChild);
    }
    const hint = this.renderer.createElement('div');
    this.renderer.setStyle(hint, 'color', '#6b7280');
    this.renderer.setStyle(hint, 'font-style', 'italic');
    this.renderer.setStyle(hint, 'font-size', '12px');
    this.renderer.appendChild(hint, this.renderer.createText('Pasa el mouse sobre un elemento para ver detalles.'));
    this.renderer.appendChild(this.infoPanelElement, hint);
  }

  private updateInfoPanel(option: SelectOption): void {
    if (!this.infoPanelElement) return;
    while (this.infoPanelElement.firstChild) {
      this.renderer.removeChild(this.infoPanelElement, this.infoPanelElement.firstChild);
    }

    const title = this.renderer.createElement('div');
    this.renderer.setStyle(title, 'font-weight', '700');
    this.renderer.setStyle(title, 'font-size', '13px');
    this.renderer.setStyle(title, 'display', 'flex');
    this.renderer.setStyle(title, 'align-items', 'center');
    this.renderer.setStyle(title, 'gap', '8px');
    const icon = this.renderer.createElement('i');
    this.renderer.addClass(icon, 'bi');
    this.renderer.addClass(icon, 'bi-info-circle');
    this.renderer.setStyle(icon, 'color', '#2563eb');
    this.renderer.appendChild(title, icon);
    this.renderer.appendChild(title, this.renderer.createText(option.description || ''));
    this.renderer.appendChild(this.infoPanelElement, title);

    const mat = option.valueAddition;
    if (mat) {
      const row = this.renderer.createElement('div');
      this.renderer.setStyle(row, 'display', 'flex');
      this.renderer.setStyle(row, 'gap', '8px');
      this.renderer.setStyle(row, 'align-items', 'baseline');
      const label = this.renderer.createElement('div');
      this.renderer.setStyle(label, 'min-width', '110px');
      this.renderer.setStyle(label, 'color', '#374151');
      this.renderer.setStyle(label, 'font-weight', '600');
      this.renderer.appendChild(label, this.renderer.createText('Num. Material:'));
      const value = this.renderer.createElement('div');
      this.renderer.setStyle(value, 'color', '#111827');
      this.renderer.setStyle(value, 'font-family', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace');
      this.renderer.appendChild(value, this.renderer.createText(String(mat)));
      this.renderer.appendChild(row, label);
      this.renderer.appendChild(row, value);
      this.renderer.appendChild(this.infoPanelElement, row);
    }

    const abbr = option.valueAddition2;
    if (abbr && this.showAbbreviation) {
      const row = this.renderer.createElement('div');
      this.renderer.setStyle(row, 'display', 'flex');
      this.renderer.setStyle(row, 'gap', '8px');
      this.renderer.setStyle(row, 'align-items', 'baseline');
      const label = this.renderer.createElement('div');
      this.renderer.setStyle(label, 'min-width', '110px');
      this.renderer.setStyle(label, 'color', '#374151');
      this.renderer.setStyle(label, 'font-weight', '600');
      this.renderer.appendChild(label, this.renderer.createText(option.label2 || 'Abreviatura:'));
      const value = this.renderer.createElement('div');
      this.renderer.setStyle(value, 'color', '#111827');
      this.renderer.appendChild(value, this.renderer.createText(String(abbr)));
      this.renderer.appendChild(row, label);
      this.renderer.appendChild(row, value);
      this.renderer.appendChild(this.infoPanelElement, row);
    }
  }

  private createTooltip(option: SelectOption, optionRect: DOMRect): void {
    // Remover tooltip anterior si existe
    this.removeTooltipFromBody();

    const description = option.valueAddition;
    const abbreviation = option.valueAddition2;

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

    // Agregar descripción solo si tiene valor
    if (description) {
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

      const descLabelText = this.renderer.createText('Num. Material:');
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
    }

    if (abbreviation && this.showAbbreviation) {
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

    const abbrLabelText = this.renderer.createText(option.label2 || 'Abreviatura:');
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
    }

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
