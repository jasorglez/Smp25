import { ChangeDetectorRef, inject } from '@angular/core';

export abstract class AbstractAgGridRenderer {
  protected readonly cdr = inject(ChangeDetectorRef);

  override onAgInit(params: any): void {
    this.onAgInit(params);
    this.cdr.detectChanges();
  }

  refresh(_params: any): boolean { return false; }

  protected abstract onAgInit(params: any): void;
}
