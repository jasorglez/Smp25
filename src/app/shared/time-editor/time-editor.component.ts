import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { ICellEditorParams } from 'ag-grid-community';

@Component({
  selector: 'app-time-editor',
  template: `
    <input #input
           type="time"
           class="ag-input-field-input ag-text-field-input"
           [(ngModel)]="value"
           (keydown)="onKeyDown($event)"
           (blur)="onBlur()">
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    input {
      width: 100%;
      height: 100%;
      padding: 0;
      border: none;
      background: transparent;
    }
  `]
})
export class TimeEditorComponent implements ICellEditorAngularComp, AfterViewInit {
  @ViewChild('input') input: ElementRef;
  private params: ICellEditorParams;
  value: string;

  ngAfterViewInit() {
    setTimeout(() => {
      this.input.nativeElement.focus();
    });
  }

  agInit(params: ICellEditorParams): void {
    this.params = params;
    if (params.value) {
      const timeParts = params.value.split('.')[0].split(':');
      this.value = `${timeParts[0]}:${timeParts[1]}`;
    } else {
      this.value = '';
    }
  }

  getValue(): string {
    return this.value ? `${this.value}:00` : '';
  }

  isPopup(): boolean {
    return false;
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === 'Tab') {
      this.params.stopEditing();
    } else if (event.key === 'Escape') {
      this.params.stopEditing(true);
    }
  }

  onBlur(): void {
    this.params.stopEditing();
  }
} 