import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';

@Component({
  selector: 'app-time-editor',
  standalone: false,
  template: `
    <input #input
           type="time"
           step="1"
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
  private params: any;
  value: string;

  ngAfterViewInit() {
    setTimeout(() => {
      this.input.nativeElement.focus();
    });
  }

  agInit(params: any): void {
    this.params = params;
    
    try {
      if (params.value) {
        // Intentar manejar diferentes formatos de entrada
        let timeParts;
        
        if (typeof params.value === 'string') {
          // El valor podría tener formato "HH:MM:SS" o "HH:MM"
          timeParts = params.value.split(':');
        } else {
          // Si no es una cadena, podría ser un objeto Date o timestamp
          const timeDate = new Date(params.value);
          timeParts = [
            String(timeDate.getHours()).padStart(2, '0'),
            String(timeDate.getMinutes()).padStart(2, '0'),
            String(timeDate.getSeconds()).padStart(2, '0')
          ];
        }
        
        // Asegurarse de que siempre tenemos 3 partes (hh:mm:ss)
        this.value = `${timeParts[0] || '00'}:${timeParts[1] || '00'}:${timeParts[2] || '00'}`;
      } else {
        // Valor por defecto si no hay valor
        this.value = '00:00:00';
      }
    } catch (error) {
      console.error('Error en agInit de TimeEditorComponent:', error);
      this.value = '00:00:00';
    }
    
    console.log('TimeEditorComponent initialized with value:', this.value);
  }

  getValue(): string {
    // Asegúrate de que siempre devuelve un formato de hora válido
    if (!this.value) return '00:00:00';
    
    try {
      // Asegurarse de que tenemos un formato válido HH:MM:SS
      const parts = this.value.split(':');
      const hours = parts[0] || '00';
      const minutes = parts[1] || '00';
      const seconds = parts[2] || '00';
      
      return `${hours}:${minutes}:${seconds}`;
    } catch (e) {
      console.error('Error al formatear hora en TimeEditorComponent:', e);
      return this.value;
    }
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
