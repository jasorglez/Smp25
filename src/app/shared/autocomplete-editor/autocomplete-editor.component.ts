import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';

@Component({
  selector: 'app-autocomplete-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <input #input class='ag-input-field-input ag-text-field-input'
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
  }

  filterValues(searchTerm: string) {
    this.filteredList = this.params.filterList.filter((item: string) =>
      item.toLowerCase().includes(searchTerm.toLowerCase())
    );
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