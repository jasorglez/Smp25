import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

/*



import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-file-input',
  templateUrl: './file-input.component.html',
  styleUrls: ['./file-input.component.scss'],
  standalone: true, // Marca el componente como standalone
  imports: [CommonModule, FormsModule, ReactiveFormsModule], // Importa los módulos necesarios
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: FileInputComponent,
      multi: true
    }
  ]
})
export class FileInputComponent implements ControlValueAccessor {
  // ... resto del código del componente ...
}


*/

@Component({
  selector: 'app-file-input',
  templateUrl: './file-input.component.html',
  styleUrls: ['./file-input.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule], // Importa los módulos necesarios
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: FileInputComponent,
      multi: true
    }
  ]
})
export class FileInputComponent implements ControlValueAccessor {
  @Input() buttonText = 'Seleccionar archivo';
  @Input() placeholderText = 'Ningún archivo seleccionado';
  @Input() accept = '';
  @Input() id = `file-input-${Math.random().toString(36).substring(2, 11)}`;
  @Input() disabled = false;
  @Input() multiple = false;
  @Input() required = false;
  
  @Output() fileSelected = new EventEmitter<File | File[]>();
  
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  fileName = '';
  files: File[] = [];
  onChange: any = () => {};
  onTouched: any = () => {};
  
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    
    if (input.files && input.files.length) {
      this.files = Array.from(input.files);
      
      if (this.multiple) {
        this.fileName = this.files.map(f => f.name).join(', ');
        this.fileSelected.emit(this.files);
        this.onChange(this.files);
      } else {
        this.fileName = this.files[0].name;
        this.fileSelected.emit(this.files[0]);
        this.onChange(this.files[0]);
      }
      
      this.onTouched();
    } else {
      this.reset();
    }
  }
  
  reset(): void {
    this.fileName = '';
    this.files = [];
    this.onChange(null);
    
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }
  
  // ControlValueAccessor interface implementation
  writeValue(value: any): void {
    // No es posible escribir un valor al input file por seguridad
  }
  
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
  
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
