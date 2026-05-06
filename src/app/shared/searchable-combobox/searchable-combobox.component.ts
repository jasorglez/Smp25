import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, forwardRef, HostListener, Input, Output } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

type ComboboxOption = string | Record<string, any>;

@Component({
  selector: 'app-searchable-combobox',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableComboboxComponent),
      multi: true,
    },
  ],
  template: `
    <div class="dropdown" [style.width]="popupWidth">
      <input
        type="text"
        class="form-control"
        [id]="inputId"
        [name]="inputName"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [ngModel]="searchText"
        (ngModelChange)="onInputChange($event)"
        (focus)="open = true; filterOptions()"
        autocomplete="off"
      />

      <div class="dropdown-menu show" *ngIf="open" [style.width]="popupWidth">
        <div
          *ngFor="let option of filteredOptions; let i = index"
          class="form-control dropdown-item"
          [class.active]="i === selectedIndex"
          (click)="selectOption(option)"
        >
          {{ getOptionDisplay(option) }}
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
  `],
})
export class SearchableComboboxComponent implements ControlValueAccessor {
  @Input() options: ComboboxOption[] = [];
  @Input() displayField: string = 'description';
  @Input() placeholder: string = 'Escriba para buscar...';
  @Input() popupWidth: string = '100%';
  @Input() inputId?: string;
  @Input() inputName?: string;
  @Input() uppercase: boolean = false;
  @Input() searchFields: string[] = [];

  @Output() optionSelected = new EventEmitter<ComboboxOption>();

  disabled = false;
  open = false;
  searchText = '';
  filteredOptions: ComboboxOption[] = [];
  selectedIndex = -1;

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private elementRef: ElementRef) {}

  writeValue(value: any): void {
    this.searchText = value ?? '';
    this.filterOptions();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.open = false;
      this.onTouched();
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (!this.open) return;

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
          this.selectOption(this.filteredOptions[this.selectedIndex]);
        } else {
          // Aceptar texto libre tal cual
          this.open = false;
          this.onTouched();
        }
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.open = false;
        this.onTouched();
        break;
    }
  }

  onInputChange(value: string) {
    const next = this.uppercase ? String(value ?? '').toUpperCase() : String(value ?? '');
    this.searchText = next;
    this.open = true;
    this.filterOptions();
    this.onChange(this.searchText);
  }

  filterOptions(): void {
    const normalizedSearch = this.normalizeText(this.searchText);
    const fields = this.searchFields.length > 0 ? this.searchFields : [this.displayField];

    this.filteredOptions = (this.options || []).filter((opt) => {
      if (!normalizedSearch) return true;
      return fields.some((f) => this.normalizeText(this.getOptionField(opt, f)).includes(normalizedSearch));
    });
    this.selectedIndex = this.filteredOptions.length > 0 ? 0 : -1;
  }

  selectOption(option: ComboboxOption): void {
    const display = this.getOptionDisplay(option);
    this.searchText = this.uppercase ? display.toUpperCase() : display;
    this.onChange(this.searchText);
    this.optionSelected.emit(option);
    this.open = false;
    this.onTouched();
  }

  getOptionDisplay(option: ComboboxOption): string {
    if (typeof option === 'string') return option;
    return String(option?.[this.displayField] ?? '').trim();
  }

  private getOptionField(option: ComboboxOption, field: string): any {
    if (typeof option === 'string') return option;
    return option?.[field];
  }

  private normalizeText(value: any): string {
    return String(value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private scrollToSelected() {
    setTimeout(() => {
      const selectedElement = this.elementRef.nativeElement.querySelector('.dropdown-item.active');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    });
  }
}

