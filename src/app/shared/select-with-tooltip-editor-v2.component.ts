import { Component } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { SelectDropdownService, SelectOption } from './select-dropdown.service';

export interface SelectWithTooltipParams {
  options: SelectOption[];
}

@Component({
  selector: 'app-select-with-tooltip-editor-v2',
  standalone: true,
  template: `<div></div>`,
  styles: []
})
export class SelectWithTooltipEditorV2Component implements ICellEditorAngularComp {
  private params: any;
  private selectedValue: any = null;
  private shouldCloseOnDestroy = false;

  constructor(private dropdownService: SelectDropdownService) {}

  agInit(params: any): void {
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
          // Verificar si hay un callback personalizado para valores especiales
          if (params.onSpecialValue && params.specialValues?.includes(value)) {
            this.shouldCloseOnDestroy = false;
            if (this.params.stopEditing) {
              this.params.stopEditing(true); // Cancelar sin guardar
            }
            // Llamar callback personalizado
            params.onSpecialValue(value, this.params);
            return;
          }

          this.selectedValue = value;
          this.shouldCloseOnDestroy = false;

          if (this.params.stopEditing) {
            this.params.stopEditing();
          }
        },
        () => {
          // Callback cuando se cancela
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
    // NO cerrar el dropdown aquí - AG Grid destruye el componente inmediatamente
    // pero queremos que el dropdown permanezca abierto
    // El dropdown se cerrará solo a través de sus callbacks
  }
}
