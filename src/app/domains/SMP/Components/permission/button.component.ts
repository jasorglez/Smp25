import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button [ngClass]="['btn', buttonClass]" (click)="onClick()">
      <i [ngClass]="icon" *ngIf="icon"></i> {{ label }}
    </button>
  `,
  styles: [`
    .btn {
      width: 100%;
      margin-bottom: 10px;
      text-align: left;
      padding: 8px 12px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class ButtonComponent {
  @Input() label: string = '';
  @Input() icon: string = '';
  @Input() buttonClass: string = 'btn-secondary';

  @Output() click = new EventEmitter<void>();

  onClick(): void {
    this.click.emit();
  }
}
