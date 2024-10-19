import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';

@Component({
  selector: 'app-time-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <input type="time" [(ngModel)]="displayValue" (blur)="onBlur()" (input)="onInput()">
  `,
  styles: [`
    input {
      width: 100%;
      height: 100%;
      border: none;
      outline: none;
    }
  `]
})
export class TimeEditorComponent implements ICellEditorAngularComp {
    private params: any;
    public displayValue: string;
    private fullValue: string;
  
    agInit(params: any): void {
      this.params = params;
      this.fullValue = params.value;
      this.displayValue = this.fullValue ? this.fullValue.substring(0, 5) : '';
    }
  
    getValue(): any {
      return this.fullValue;
    }
  
    onBlur(): void {
      this.params.stopEditing();
    }
  
    onInput(): void {
      this.fullValue = `${this.displayValue}:00`;
    }
}