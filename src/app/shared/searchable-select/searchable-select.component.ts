import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dropdown" [style.width]="popupWidth">
      <input
        #searchInput
        type="text"
        [(ngModel)]="searchText"
        (input)="filterOptions()"
        [placeholder]="params.placeholder || 'Escriba para buscar...'"
        class="form-control"
        autocomplete="off"
      />
      <div class="dropdown-menu show" [style.width]="popupWidth">
        <div
          *ngFor="let option of filteredOptions; let i = index"
          class="form-control dropdown-item"
          [class.active]="i === selectedIndex"
          (click)="selectOption(option)"
          [attr.data-value]="option[params.valueField || 'id']"
        >
          {{ option[params.displayField || 'description'] }}
        </div>
        <div *ngIf="filteredOptions.length === 0" class="dropdown-item disabled text-center">
          No se encontraron resultados
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dropdown {
      position: relative;
      padding: 0.35rem 0.6rem;
      background-color: #FFFFFF;
      border: 1px solid var(--bs-input-border);
      border-radius: 0.25rem;
      font-size: 0.85rem;
    }
    .dropdown input {
      font-size: 0.85rem;
      line-height: 1.2;
      padding: 0.35rem 0.5rem;
    }
    .dropdown-menu {
      max-height: 200px;
      overflow-y: auto;
      overflow-x: hidden;
      margin-top: 0;
      padding: 0;
      font-size: 0.85rem;
    }
    .dropdown-item {
      padding: 0.35rem 0.6rem;
      cursor: pointer;
      font-size: 0.85rem;
      line-height: 1.2;
    }
    .dropdown-item:hover:not(.disabled) {
      background-color: var(--bs-dropdown-link-hover-bg);
      color: var(--bs-dropdown-link-hover-color);
    }
    .dropdown-item.active {
      background-color: var(--bs-primary);
      color: white;
    }
    .dropdown-item.disabled {
      color: var(--bs-dropdown-link-disabled-color);
      pointer-events: none;
    }
  `]
})
export class SearchableSelectComponent implements ICellEditorAngularComp {
  public params: any;
  public value: any;
  public searchText: string = '';
  public allOptions: any[] = [];
  public filteredOptions: any[] = [];
  public selectedIndex: number = -1;
  public popupWidth: string = '500px';
  private selectedOption: any = null;

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  handleClick(event: Event) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.value = this.selectedOption ? this.value : this.searchText;
      this.params.api.stopEditing();
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredOptions.length - 1);
        this.scrollToSelected();
        break;
      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.scrollToSelected();
        break;
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        if (this.selectedIndex >= 0 && this.filteredOptions.length > 0) {
          const activeOption = this.filteredOptions[this.selectedIndex];
          const displayField = this.params.displayField || 'description';
          const typedValue = this.normalizeText(this.searchText);
          const activeValue = this.normalizeText(activeOption?.[displayField]);

          if (typedValue && typedValue === activeValue) {
            this.selectOption(activeOption);
          } else {
            this.selectedOption = null;
            this.value = this.searchText;
            this.params.api.stopEditing();
          }
        } else {
          this.selectedOption = null;
          this.value = this.searchText;
          this.params.api.stopEditing();
        }
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.params.api.stopEditing();
        break;
    }
  }

  agInit(params: any): void {
    this.params = params;
    this.value = params.value;
    this.searchText = params.value ?? '';
    this.popupWidth = this.resolvePopupWidth(params?.popupWidth);

    if (params.searchFunction) {
      this.allOptions = [];
      this.filteredOptions = [];
    } else {
      this.allOptions = params.options || [];
      this.filteredOptions = [...this.allOptions];

      const valueField = params.valueField || 'id';
      const displayField = params.displayField || 'description';
      const currentOption = this.allOptions.find(opt => opt[valueField] === this.value);
      if (currentOption) {
        this.searchText = currentOption[displayField];
        this.selectedOption = currentOption;
      }
      this.selectedIndex = this.filteredOptions.length > 0 ? 0 : -1;
    }

    setTimeout(() => {
      const input = this.elementRef.nativeElement.querySelector('input');
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  getValue(): any {
    return this.selectedOption ? this.value : this.searchText;
  }

  filterOptions(): void {
    this.selectedOption = null;

    if (this.params.searchFunction && this.searchText.trim().length > 0) {
      this.params.searchFunction(this.searchText.trim()).subscribe({
        next: (data: any[]) => {
          this.allOptions = data || [];
          this.filteredOptions = [...this.allOptions];
          this.selectedIndex = this.filteredOptions.length > 0 ? 0 : -1;
        },
        error: (err) => {
          console.error('Error searching options:', err);
          this.filteredOptions = [];
          this.selectedIndex = -1;
        }
      });
    } else if (this.allOptions.length > 0) {
      const normalizedSearch = this.normalizeText(this.searchText);
      const searchFields = Array.isArray(this.params.searchFields) && this.params.searchFields.length > 0
        ? this.params.searchFields
        : [this.params.displayField || 'description'];

      this.filteredOptions = this.allOptions.filter(option => {
        if (!normalizedSearch) return true;
        return searchFields.some((field: string) => {
          const value = option?.[field];
          return this.normalizeText(value).includes(normalizedSearch);
        });
      });
      this.selectedIndex = this.filteredOptions.length > 0 ? 0 : -1;
    } else {
      this.filteredOptions = [];
      this.selectedIndex = -1;
    }
  }

  selectOption(option: any): void {
    const valueField = this.params.valueField || 'id';
    const displayField = this.params.displayField || 'description';
    this.selectedOption = option;
    this.value = option[valueField];
    this.searchText = option[displayField];
    if (typeof this.params.onOptionSelected === 'function') {
      this.params.onOptionSelected(option, this.params);
    }
    setTimeout(() => {
      this.params.api.stopEditing();
    }, 0);
  }

  getDisplayValue(): string {
    const valueField = this.params?.valueField || 'id';
    const displayField = this.params?.displayField || 'description';
    const option = this.allOptions.find(opt => opt[valueField] === this.value);
    return option ? option[displayField] : 'Seleccione...';
  }

  isPopup(): boolean {
    return true;
  }

  private scrollToSelected() {
    setTimeout(() => {
      const selectedElement = this.elementRef.nativeElement.querySelector('.dropdown-item.active');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  private resolvePopupWidth(width: string | number | undefined): string {
    if (typeof width === 'number' && Number.isFinite(width)) {
      return `${width}px`;
    }
    if (typeof width === 'string' && width.trim().length > 0) {
      return width.trim();
    }
    return '500px';
  }

  private normalizeText(value: any): string {
    return String(value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
