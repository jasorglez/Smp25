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
        placeholder="Escriba para buscar..."
        class="form-control"
        autocomplete="off"
      />
      <div class="dropdown-menu show">
        <div 
          *ngFor="let option of filteredOptions; let i = index"
          class="form-control dropdown-item"
          [class.active]="i === selectedIndex"
          (click)="selectOption(option)"
          [attr.data-value]="option.id"
        >
          {{option.description}}
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
  private params: any;
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
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredOptions.length - 1);
        this.scrollToSelected();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.scrollToSelected();
        break;
      case 'Enter':
        event.preventDefault();
        if (this.selectedIndex >= 0) {
          this.selectOption(this.filteredOptions[this.selectedIndex]);
        }
        break;
      case 'Escape':
        this.params.api.stopEditing();
        break;
    }
  }

  agInit(params: any): void {
    this.params = params;
    this.value = params.value;
    this.allOptions = params.options || [];
    this.filteredOptions = [...this.allOptions];
    
    // Inicializar el texto de búsqueda con la descripción del valor actual
    const currentOption = this.allOptions.find(opt => opt.id === this.value);
    if (currentOption) {
      this.searchText = currentOption.description;
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
    this.filteredOptions = this.allOptions.filter(option =>
      option.description.toLowerCase().includes(this.searchText.toLowerCase())
    );
    this.selectedIndex = this.filteredOptions.length > 0 ? 0 : -1;
  }

  selectOption(option: any): void {
    this.value = option.id;
    this.searchText = option.description;
    this.params.api.stopEditing();
  }

  getDisplayValue(): string {
    const option = this.allOptions.find(opt => opt.id === this.value);
    return option ? option.description : 'Seleccione...';
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