import { Component } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { ICellEditorParams } from 'ag-grid-enterprise';
import { SelectDropdownService, SelectOption } from './select-dropdown.service';

export interface SelectWithTooltipParams extends ICellEditorParams {
  options: SelectOption[];
}

@Component({
  selector: 'app-select-with-tooltip-editor-v2',
  standalone: true,
  template: `<div></div>`,
  styles: []
})
export class SelectWithTooltipEditorV2Component implements ICellEditorAngularComp {
  private params!: SelectWithTooltipParams;
  private selectedValue: any = null;
  private shouldCloseOnDestroy = false;

  constructor(private dropdownService: SelectDropdownService) {}

  agInit(params: SelectWithTooltipParams): void {
    console.log('SelectWithTooltipEditorV2: agInit called');
    this.params = params;
    this.selectedValue = params.value;

    // Abrir dropdown inmediatamente
    if (params.eGridCell) {
      const cellRect = params.eGridCell.getBoundingClientRect();

      this.dropdownService.openDropdown(
        cellRect,
        params.options || [],
        this.selectedValue,
        (value) => {
          // Callback cuando se selecciona una opción
          console.log('SelectWithTooltipEditorV2: Value selected:', value);
          this.selectedValue = value;
          this.shouldCloseOnDestroy = false;

          // Actualizar el valor en AG Grid ANTES de cerrar el editor
          if (this.params.node && this.params.column) {
            this.params.node.setDataValue(this.params.column.getColId(), value);
          }

          if (this.params.stopEditing) {
            this.params.stopEditing();
          }
        },
        () => {
          // Callback cuando se cancela
          console.log('SelectWithTooltipEditorV2: Cancelled');
          this.shouldCloseOnDestroy = false;
          if (this.params.stopEditing) {
            this.params.stopEditing(true);
          }
        }
      );

      // NO cerrar el dropdown en ngOnDestroy porque AG Grid destruye el componente inmediatamente
      // El dropdown se cerrará solo cuando el usuario seleccione una opción o haga click fuera
      this.shouldCloseOnDestroy = false;
    }
  }

  getValue(): any {
    return this.selectedValue;
  }

  isPopup(): boolean {
    return false;
  }

  isCancelBeforeStart(): boolean {
    return false;
  }

  isCancelAfterEnd(): boolean {
    return false;
  }

  ngOnDestroy(): void {
    console.log('SelectWithTooltipEditorV2: ngOnDestroy called, shouldCloseOnDestroy:', this.shouldCloseOnDestroy);
    // NO cerrar el dropdown aquí - AG Grid destruye el componente inmediatamente
    // pero queremos que el dropdown permanezca abierto
    // El dropdown se cerrará solo a través de sus callbacks
  }
}