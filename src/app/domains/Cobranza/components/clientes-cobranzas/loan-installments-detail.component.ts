import { Component, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ICellRendererAngularComp } from 'ag-grid-angular';

/** Renders the parent's schedule template without owning forms or modals. */
@Component({
  selector: 'app-loan-installments-detail',
  standalone: true,
  imports: [NgTemplateOutlet],
  styles: [':host { display: block; width: 100%; }'],
  template: '<ng-container *ngTemplateOutlet="template; context: context"></ng-container>'
})
export class LoanInstallmentsDetailComponent implements ICellRendererAngularComp {
  template!: TemplateRef<any>;
  context: { $implicit: any } = { $implicit: null };
  agInit(params: any): void {
    this.template = params.template;
    this.context.$implicit = params.data;
  }
  refresh(params: any): boolean {
    this.context.$implicit = params.data;
    return true;
  }
}
