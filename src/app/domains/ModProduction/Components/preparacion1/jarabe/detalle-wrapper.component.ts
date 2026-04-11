import { Component, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DetalleJarabeComponent } from './detalle-jarabe.component';
import { HistorialJarabeComponent } from './historial-jarabe.component';

@Component({
  selector: 'app-detalle-wrapper',
  standalone: true,
  imports: [CommonModule, DetalleJarabeComponent, HistorialJarabeComponent],
  template: `
    <div style="height: 100%; overflow: hidden;">
      <app-detalle-jarabe 
        *ngIf="detailType === 'preparacion'" 
        [params]="params">
      </app-detalle-jarabe>
      <app-historial-jarabe 
        *ngIf="detailType === 'historial'" 
        [params]="params">
      </app-historial-jarabe>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class DetalleWrapperComponent implements OnInit, OnChanges {
  params: any;
  detailType: string = '';

  ngOnInit() {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['params']) {
      this.detailType = this.params?.data?.detailType || '';
    }
  }

  agInit(params: any): void {
    this.params = params;
    this.detailType = params.data?.detailType || '';
  }
}
