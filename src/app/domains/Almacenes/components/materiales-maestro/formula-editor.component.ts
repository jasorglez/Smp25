import { inject, AfterViewInit, Component, ViewChild, ElementRef, signal, WritableSignal, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { ICellEditorParams } from 'ag-grid-community';
import { Parser } from 'expr-eval';

@Component({
  selector: 'app-formula-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="formula-editor-container">
      <input #input class="formula-input" [value]="value()" (input)="onValueChange($event)" />
      <div *ngIf="errorMessage" class="error-message">
        <i class="bi bi-exclamation-triangle-fill"></i> {{ errorMessage }}
      </div>
    </div>
  `,
  styles: [`
    .formula-editor-container {
      position: relative;
      width: 100%;
      height: 100%;
    }
    .formula-input {
      width: 100%;
      height: 100%;
      border: 2px solid #007bff;
      border-radius: 3px;
      padding: 2px 5px;
      box-sizing: border-box;
      outline: none;
    }
    .error-message {
      position: absolute;
      bottom: 100%;
      left: 0;
      background-color: #dc3545;
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 0.8em;
      margin-bottom: 4px;
      white-space: nowrap;
      z-index: 10;
    }
  `]
})
export class FormulaEditorComponent implements ICellEditorAngularComp, AfterViewInit {
  private readonly cdr = inject(ChangeDetectorRef);
  @ViewChild('input') input!: ElementRef;

  private params!: ICellEditorParams;
  public value: WritableSignal<string> = signal('');
  public errorMessage: string | null = null;

  agInit(params: ICellEditorParams): void {
    this.params = params;
    const formulaField = (params as any).formulaField || 'formulaCol9';
    // Si ya existe una fórmula, la mostramos. Si es un valor, lo mostramos como texto.
    this.value.set(params.data[formulaField] || params.value);
  
    this.cdr.detectChanges();}

  ngAfterViewInit() {
    // Enfocar el input al iniciar
    setTimeout(() => this.input.nativeElement.focus(), 0);
  }

  getValue() {
    // Devolvemos el valor del input para que el valueSetter de la columna lo procese
    return this.value();
  }

  onValueChange(event: Event) {
    const inputValue = (event.target as HTMLInputElement).value;
    this.value.set(inputValue);
    this.errorMessage = null;
    if (inputValue.startsWith('=')) {
      try {
        const expression = inputValue.substring(1);
        // Usamos evaluate con un contexto de prueba para validar también las variables.
        const parser = new Parser();
        // Crear un contexto con posibles referencias de celdas A1, B1, etc.
        const context: any = {};
        for (let r = 1; r <= 10; r++) { // Asumir hasta 10 filas
          for (let c = 0; c < 11; c++) {
            const colLetter = String.fromCharCode(65 + c);
            const key = colLetter + r;
            context[key] = 1; // Dummy value
          }
        }
        parser.evaluate(expression, context);
      } catch (e: any) {
        this.errorMessage = e.message;
      }
    }
  }
}
