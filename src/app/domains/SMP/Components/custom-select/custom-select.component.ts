// Este custom select mapea las opciones de id con los nombres que se
// mostrará a los usuarios. Por ejemplo: "1" para "Sí" y "0" para "No".

import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <select
      class="form-control"
      [(ngModel)]="value"
      (ngModelChange)="onChange($event)"
    >
      <option *ngFor="let option of options" [ngValue]="option.value">
        {{ option.display }}
      </option>
    </select>
  `
})
export class CustomSelectComponent {

  private params: any;
  public value: any;
  public options: { display: string; value: any }[] = [];

  agInit(params: any): void {
    this.params = params;
    this.value = this.params.value;
    this.options = Object.entries(this.params.options).map(
      ([display, value]) => ({ display, value })
    );
  }

  getValue(): any {
    return this.value;
  }

  onChange(value: any): void {
    this.value = value;
  }
}
