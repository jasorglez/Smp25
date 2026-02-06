import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';

@Component({
  selector: 'app-autocomplete-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <input #input class='ag-input-field-input ag-text-field-input autocomplete-input-editing'
      [(ngModel)]="value"
      (ngModelChange)="filterValues($event)"
      (keydown)="onKeyDown($event)">

    <div class="suggestions" *ngIf="showSuggestions">
      <div *ngFor="let item of filteredList"
           (click)="selectValue(item)"
           class="suggestion-item">
        {{ item }}
      </div>
    </div>
  `,
  styles: [`
    :host {
      background-color: #fff3cd !important;
      display: block;
    }
    .autocomplete-input-editing {
      background-color: #fff3cd !important;
      border: 2px solid #ffc107 !important;
    }
    .suggestions {
      position: absolute;
      background: white;
      border: 1px solid #ccc;
      z-index: 1000;
      max-height: 200px;
      overflow-y: auto;
    }
    .suggestion-item {
      padding: 5px 10px;
      cursor: pointer;
    }
    .suggestion-item:hover {
      background: #f0f0f0;
    }
  `],
  styleUrl: './autocomplete-editor.component.scss'
})
export class AutocompleteEditorComponent implements ICellEditorAngularComp {
  private params: any;
  public value: any;
  public filteredList: string[] = [];
  public showSuggestions = false;
  private isCanceled = false;

  @ViewChild('input') input: any;

  agInit(params: any): void {
    this.params = params;
    this.value = params.value;
    
    // Debug para ver qué llega
    console.log('🔧 AutocompleteEditor agInit - params:', params);
    console.log('🔧 AutocompleteEditor agInit - filterList:', params.filterList);
  }

  filterValues(searchTerm: string) {
    console.log('🔍 AutocompleteEditor filterValues - searchTerm:', searchTerm);
    console.log('🔍 AutocompleteEditor filterValues - filterList:', this.params.filterList);
    
    if (!this.params.filterList || !Array.isArray(this.params.filterList)) {
      console.log('❌ filterList no es válido, usando array vacío');
      this.filteredList = [];
      this.showSuggestions = false;
      return;
    }
    
    this.filteredList = this.params.filterList.filter((item: string) =>
      item && typeof item === 'string' && item.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    console.log('✅ filteredList resultante:', this.filteredList);
    this.showSuggestions = this.filteredList.length > 0;
  }

  selectValue(value: string) {
    this.value = value;
    this.showSuggestions = false;
  }

  getValue(): any {
    return this.value;
  }

  isPopup(): boolean {
    return true;
  }

  isCancelAfterEnd(): boolean {
    return this.isCanceled;
  }

  afterGuiAttached() {
    this.input.nativeElement.focus();
  }

  onKeyDown(event: any): void {
    if (event.key === 'Escape') {
      this.isCanceled = true;
    }
    if (event.key === 'Enter' && this.showSuggestions) {
      event.preventDefault();
    }
  }
}
