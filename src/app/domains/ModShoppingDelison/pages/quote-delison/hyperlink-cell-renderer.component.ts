import { Component, NgZone } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';

@Component({
  selector: 'app-hyperlink-cell-renderer',
  standalone: true,
  template: `<a href="#" (click)="expand($event)" style="color: blue; text-decoration: none;">{{ value }} <i class="bi bi-folder"></i></a>`,
})
export class HyperlinkCellRendererComponent implements ICellRendererAngularComp {
  value: any;
  private params!: ICellRendererParams;

  constructor(private ngZone: NgZone) {}

  agInit(params: ICellRendererParams): void {
    this.params = params;
    this.value = params.value;
  }

  refresh(params: ICellRendererParams): boolean {
    this.params = params;
    this.value = params.value;
    return true;
  }

  expand(event: Event) {
    event.preventDefault();
    this.params.context.parentComponent.selectedRow = this.params.data;
    this.params.context.parentComponent.detailType = this.params.colDef.headerName === 'Articulos' ? 'items' : 'providers';
    this.params.context.parentComponent.showModal = true;
  }
}