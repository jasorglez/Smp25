import { Component } from "@angular/core";
import { ICellEditorAngularComp, ICellRendererAngularComp } from "ag-grid-angular";

  // Componente para mostrar los puntos
  @Component({
    selector: 'password-renderer',
    standalone: true,
    template: `<span>••••••••</span>`
  })
  export class PasswordRenderer implements ICellRendererAngularComp {
    agInit(params: any): void {}
    refresh(params: any): boolean {
      return false;
    }
  }