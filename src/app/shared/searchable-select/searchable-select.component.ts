import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class=" dropdown">
      <input
        #searchInput
        type="text"
        [(ngModel)]="searchText"
        (input)="filterOptions()"
        [placeholder]="params.placeholder || 'Escriba para buscar...'"
        class="form-control"
        autocomplete="off"
      />
      <div class="dropdown-menu show">
        <div
          *ngFor="let option of filteredOptions; let i = index"
          class="form-control dropdown-item"
          [class.active]="i === selectedIndex"
          (click)="selectOption(option)"
          [attr.data-value]="option[params.valueField || 'id']"
        >
          {{option[params.displayField || 'description']}}
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
      width: 500px;
      padding: 0.5rem 1rem;
      background-color: #FFFFFF;
      border: 1px solid var(--bs-input-border);
      border-radius: 0.25rem;
    }
    .dropdown-menu {
      max-height: 200px;
      width: 500px;
      overflow-y: auto;
      overflow-x: hidden;
      margin-top: 0;
      padding: 0;
    }
    .dropdown-item {
      padding: 0.5rem 1rem;
      cursor: pointer;
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

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  handleClick(event: Event) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
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
          this.selectOption(this.filteredOptions[this.selectedIndex]);
        } else if (this.filteredOptions.length > 0) {
          // Si no hay selección, tomar el primero
          this.selectOption(this.filteredOptions[0]);
        } else {
          // Si no hay opciones, solo cerrar
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
    console.log('🎯 SearchableSelect agInit called:', {
      value: params.value,
      options: params.options,
      optionsCount: params.options?.length || 0,
      valueField: params.valueField,
      displayField: params.displayField
    });

    this.params = params;
    this.value = params.value;

    // Check if we have a searchFunction for dynamic search
    if (params.searchFunction) {
      this.allOptions = [];
      this.filteredOptions = [];
      // For dynamic search, we'll load options when user types
    } else {
      // Static options
      this.allOptions = params.options || [];
      this.filteredOptions = [...this.allOptions];

      console.log('📋 SearchableSelect options loaded:', {
        allOptionsCount: this.allOptions.length,
        filteredOptionsCount: this.filteredOptions.length
      });

      // Inicializar el texto de búsqueda con la descripción del valor actual
      const valueField = params.valueField || 'id';
      const displayField = params.displayField || 'description';
      const currentOption = this.allOptions.find(opt => opt[valueField] === this.value);
      if (currentOption) {
        this.searchText = currentOption[displayField];
      }
    }

    // Enfocar el input automáticamente
    setTimeout(() => {
      const input = this.elementRef.nativeElement.querySelector('input');
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  getValue(): any {
    return this.value;
  }

  filterOptions(): void {
    if (this.params.searchFunction && this.searchText.trim().length > 0) {
      // Dynamic search - call the API
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
      // Static filtering - usar displayField dinámicamente
      const displayField = this.params.displayField || 'description';
      this.filteredOptions = this.allOptions.filter(option => {
        const value = option[displayField];
        return value && value.toString().toLowerCase().includes(this.searchText.toLowerCase());
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
    this.value = option[valueField];
    this.searchText = option[displayField];
    // Cerrar inmediatamente sin delay
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
      const selectedElement = this.elementRef.nativeElement.querySelector('.selected');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    });
  }
}
