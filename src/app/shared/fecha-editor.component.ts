import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-fecha-editor',
  standalone: true,
  template: `
    <input
      #inputFecha
      type="text"
      placeholder="DD/MM/YYYY"
      (keydown)="onKeyDown($event)"
      (keyup)="updateFromInput()"
      (blur)="formatInput()"
      style="width: 100%; height: 100%; border: none; padding: 0 4px; font-size: 0.9rem; outline: none;"
    />
  `
})
export class FechaEditorComponent implements AfterViewInit {
  @ViewChild('inputFecha') inputFecha!: ElementRef;

  private dia: number = 1;
  private mes: number = 1;
  private anio: number = new Date().getFullYear();
  private params: any;

  get fechaStr(): string {
    const d = String(this.dia).padStart(2, '0');
    const m = String(this.mes).padStart(2, '0');
    return `${d}/${m}/${this.anio}`;
  }

  agInit(params: any): void {
    this.params = params;
    if (params.value) {
      const date = params.value instanceof Date ? params.value : new Date(params.value);
      if (!isNaN(date.getTime())) {
        this.dia = date.getDate();
        this.mes = date.getMonth() + 1;
        this.anio = date.getFullYear();
      }
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      const input = this.inputFecha.nativeElement;
      input.value = this.fechaStr;
      input.focus();
      input.select();
    }, 0);
  }

  onKeyDown(event: KeyboardEvent): void {
    const input = this.inputFecha.nativeElement;
    const cursorPos = input.selectionStart ?? 0;

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.incrementarFecha(cursorPos);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.decrementarFecha(cursorPos);
    }
  }

  updateFromInput(): void {
    const input = this.inputFecha.nativeElement.value;
    const digits = input.replace(/\D/g, '');

    if (digits.length >= 2) {
      this.dia = Math.min(Math.max(parseInt(digits.substring(0, 2)) || 1, 1), 31);
    }
    if (digits.length >= 4) {
      this.mes = Math.min(Math.max(parseInt(digits.substring(2, 4)) || 1, 1), 12);
    }
    if (digits.length >= 8) {
      this.anio = parseInt(digits.substring(4, 8)) || this.anio;
    }
  }

  formatInput(): void {
    const input = this.inputFecha.nativeElement;
    input.value = this.fechaStr;
  }

  private incrementarFecha(cursorPos: number): void {
    if (cursorPos <= 2) {
      this.dia = this.dia === 31 ? 1 : this.dia + 1;
    } else if (cursorPos <= 5) {
      this.mes = this.mes === 12 ? 1 : this.mes + 1;
    } else {
      this.anio = this.anio === 2099 ? 2000 : this.anio + 1;
    }
    this.actualizarInput();
  }

  private decrementarFecha(cursorPos: number): void {
    if (cursorPos <= 2) {
      this.dia = this.dia === 1 ? 31 : this.dia - 1;
    } else if (cursorPos <= 5) {
      this.mes = this.mes === 1 ? 12 : this.mes - 1;
    } else {
      this.anio = this.anio === 2000 ? 2099 : this.anio - 1;
    }
    this.actualizarInput();
  }

  private actualizarInput(): void {
    const input = this.inputFecha.nativeElement;
    const cursorPos = input.selectionStart ?? 0;
    input.value = this.fechaStr;
    input.setSelectionRange(cursorPos, cursorPos);
  }

  getValue(): Date {
    return new Date(this.anio, this.mes - 1, this.dia);
  }
}
