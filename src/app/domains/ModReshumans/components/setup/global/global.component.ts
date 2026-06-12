import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HRService } from 'app/services/hr.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-global-config',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './global.component.html',
})
export class GlobalConfigComponent {
  private hrService = inject(HRService);
  private signalsService = inject(SignalsService);

  idRoot: number = 0;
  useServerTime: boolean = false;
  isNew: boolean = false;
  loading: boolean = false;

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      if (this.idRoot > 0) this.getData();
    });
  }

  getData() {
    this.loading = true;
    this.hrService.getGlobalConfig(this.idRoot).subscribe({
      next: (data: any) => {
        this.useServerTime = data.useServerTime ?? false;
        this.isNew = false;
        this.loading = false;
      },
      error: (err: any) => {
        if (err.status === 404) {
          this.useServerTime = false;
          this.isNew = true;
        }
        this.loading = false;
      }
    });
  }

  toggle() {
    this.useServerTime = !this.useServerTime;
    this.save();
  }

  save() {
    const payload = { idRoot: this.idRoot, useServerTime: this.useServerTime, active: true };
    const action$ = this.isNew
      ? this.hrService.createGlobalConfig(payload)
      : this.hrService.updateGlobalConfig(this.idRoot, payload);

    action$.subscribe({
      next: () => {
        this.isNew = false;
        alerts.basicAlert('Guardado', 'Configuración actualizada', 'success');
      },
      error: () => alerts.basicAlert('Error', 'No se pudo guardar la configuración', 'error')
    });
  }
}
