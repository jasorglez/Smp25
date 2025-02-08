import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { ICellEditorParams } from 'ag-grid-enterprise';

@Component({
  selector: 'app-neighborhoods',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './neighborhoods.component.html',
  styleUrl: './neighborhoods.component.scss'
})
export class NeighborhoodsComponent implements ICellEditorAngularComp, AfterViewInit {

  @ViewChild('input') input: ElementRef;
  @ViewChild('manualInput') manualInput: ElementRef;
  @ViewChild('select') select: ElementRef;

  private params: ICellEditorParams;
  public value: string;
  public neighborhoods: string[] = [];

  agInit(params: ICellEditorParams): void {
    this.params = params;
    this.value = this.params.value;
    
    // Obtener los asentamientos del código postal actual
    const rowData = this.params.node.data;
    if (rowData.cp) {
      // Asumiendo que infoCp está disponible a través de params
      const cpData = this.params.context.componentParent.infoCp;
      if (cpData && cpData.length > 0) {
        this.neighborhoods = cpData[0].asentamientos || [];
      }
    }
  }

  getValue(): string {
    return this.value;
  }

  setValue(value: string): void {
    this.value = value;
  }

  onChange(event: any): void {
    this.value = event;
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.params.stopEditing();
    }
  }

  // Implementation for ICellEditorAngularComp
  isPopup(): boolean {
    return true;
  }

  ngAfterViewInit() {
    // Focus en el input apropiado
    setTimeout(() => {
      if (this.neighborhoods?.length) {
        if (this.select) {
          this.select.nativeElement.focus();
        }
      } else if (this.input) {
        this.input.nativeElement.focus();
      }
    });
  }

  // Requerido para ICellEditorAngularComp
  isCancelBeforeStart(): boolean {
    return false;
  }

  // Requerido para ICellEditorAngularComp
  isCancelAfterEnd(): boolean {
    return false;
  }
}
