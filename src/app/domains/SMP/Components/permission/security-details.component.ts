import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-enterprise';

@Component({
  selector: 'app-security-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sec-detail">
      <div class="sec-detail__header">
        <div class="sec-detail__title">Detalles</div>
        <div class="sec-detail__meta">
          <span class="sec-detail__pill" *ngIf="row?.nombreSeccion">{{ row.nombreSeccion }}</span>
          <span class="sec-detail__muted">Solo frontend</span>
        </div>
      </div>

      <textarea
        class="sec-detail__textarea"
        [(ngModel)]="row.detalles"
        (ngModelChange)="onDetallesChange()"
        placeholder="Escribe los detalles aquí..."
        rows="6"
      ></textarea>
    </div>
  `,
  styles: [`
    .sec-detail{
      height: 100%;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid #e8ecf1;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
      animation: secDetailIn .18s ease-out;
    }
    @keyframes secDetailIn{
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .sec-detail__header{
      display:flex;
      align-items:center;
      justify-content:space-between;
      margin-bottom: 10px;
      gap: 12px;
    }
    .sec-detail__title{
      font-weight: 600;
      color: #0f172a;
      letter-spacing: .2px;
    }
    .sec-detail__meta{
      display:flex;
      align-items:center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .sec-detail__pill{
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #334155;
      max-width: 280px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sec-detail__muted{
      font-size: 12px;
      color: #64748b;
    }
    .sec-detail__textarea{
      width: 100%;
      height: calc(100% - 34px);
      resize: none;
      border-radius: 10px;
      border: 1px solid #e5e7eb;
      background: #fbfdff;
      padding: 10px 12px;
      font-size: 13px;
      line-height: 1.4;
      outline: none;
      transition: border-color .15s ease, box-shadow .15s ease;
    }
    .sec-detail__textarea:focus{
      border-color: #93c5fd;
      box-shadow: 0 0 0 4px rgba(59,130,246,.12);
      background: #ffffff;
    }
  `],
})
export class SecurityDetailsComponent implements ICellRendererAngularComp {
  row: any;
  private parent: any;

  agInit(params: ICellRendererParams): void {
    this.row = params.data;
    this.parent = (params as any)?.context?.componentParent;
  }

  refresh(): boolean {
    return false;
  }

  onDetallesChange(): void {
    // Notificar cambios al padre (solo memoria)
    if (this.parent?.markChangesFromDetail) {
      this.parent.markChangesFromDetail();
    }
  }
}

