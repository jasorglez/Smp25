import { Component, Input, OnInit, inject, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CotizacionesService, CotizacionConfig, CONFIG_DEFAULT } from 'app/services/cotizaciones.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-config-cotizaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card border-primary shadow-sm mt-2">
      <div class="card-header bg-primary text-white py-2 d-flex align-items-center gap-2">
        <i class="bi bi-gear-fill"></i>
        <span class="fw-semibold">Configuración de Cotizaciones</span>
      </div>

      <div class="card-body">

        <div *ngIf="loading" class="text-center py-4">
          <div class="spinner-border spinner-border-sm text-primary"></div>
          <span class="ms-2 text-muted small">Cargando configuración...</span>
        </div>

        <div *ngIf="!loading" class="row g-3">

          <!-- Consecutivo -->
          <div class="col-md-3">
            <label class="form-label small fw-semibold">Prefijo del folio</label>
            <input class="form-control form-control-sm" [(ngModel)]="config.prefijo"
                   placeholder="Ej: VENTAS-">
          </div>
          <div class="col-md-2">
            <label class="form-label small fw-semibold">Consecutivo actual</label>
            <input type="number" class="form-control form-control-sm" [(ngModel)]="config.consecutivo" min="0">
            <div class="form-text">Próximo folio: <strong>{{ formatFolio() }}</strong></div>
          </div>
          <div class="col-md-3">
            <label class="form-label small fw-semibold">Lugar por defecto</label>
            <input class="form-control form-control-sm" [(ngModel)]="config.lugarDefault"
                   placeholder="Ej: VERACRUZ, VER">
          </div>
          <div class="col-md-4 d-flex align-items-end">
            <div class="alert alert-info py-1 px-2 mb-0 small w-100">
              <i class="bi bi-info-circle me-1"></i>
              Al agregar una nueva cotización el folio se genera automáticamente e incrementa el consecutivo.
            </div>
          </div>

          <hr class="col-12 my-1">

          <!-- Textos principales -->
          <div class="col-12">
            <label class="form-label small fw-semibold">Párrafo de presentación</label>
            <textarea class="form-control form-control-sm" rows="5"
                      [(ngModel)]="config.textoPrincipal"></textarea>
          </div>
          <div class="col-12">
            <label class="form-label small fw-semibold">Párrafo de compromiso</label>
            <textarea class="form-control form-control-sm" rows="3"
                      [(ngModel)]="config.textoCompromiso"></textarea>
          </div>

          <hr class="col-12 my-1">

          <!-- Cláusulas -->
          <div class="col-12">
            <label class="form-label small fw-semibold">Cláusula 1</label>
            <textarea class="form-control form-control-sm" rows="5"
                      [(ngModel)]="config.clausula1"></textarea>
          </div>
          <div class="col-12">
            <label class="form-label small fw-semibold">Cláusula 2</label>
            <textarea class="form-control form-control-sm" rows="5"
                      [(ngModel)]="config.clausula2"></textarea>
          </div>
          <div class="col-12">
            <label class="form-label small fw-semibold">Cláusula 3</label>
            <textarea class="form-control form-control-sm" rows="3"
                      [(ngModel)]="config.clausula3"></textarea>
          </div>

          <hr class="col-12 my-1">

          <!-- Párrafos de cierre -->
          <div class="col-12">
            <label class="form-label small fw-semibold">Párrafo de aclaración</label>
            <textarea class="form-control form-control-sm" rows="4"
                      [(ngModel)]="config.textoAclaracion"></textarea>
          </div>
          <div class="col-12">
            <label class="form-label small fw-semibold">Párrafo de despedida</label>
            <textarea class="form-control form-control-sm" rows="4"
                      [(ngModel)]="config.textoDespedida"></textarea>
          </div>
          <div class="col-12">
            <label class="form-label small fw-semibold">Nota de IVA</label>
            <textarea class="form-control form-control-sm" rows="3"
                      [(ngModel)]="config.textoIva"></textarea>
          </div>

        </div>
      </div>

      <div class="card-footer d-flex justify-content-end gap-2 py-2">
        <button class="btn btn-sm btn-primary" (click)="guardar()" [disabled]="saving || loading">
          <i class="bi bi-floppy me-1"></i>{{ saving ? 'Guardando...' : 'Guardar configuración' }}
        </button>
      </div>
    </div>
  `,
})
export class ConfigCotizacionesComponent implements OnInit {
  private svc = inject(CotizacionesService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() idCompany!: number;

  config: CotizacionConfig = { ...CONFIG_DEFAULT };
  loading = false;
  saving  = false;

  ngOnInit() { this.cargar(); }

  async cargar() {
    this.loading = true;
    this.config  = await this.svc.getConfig(this.idCompany);
    this.loading = false;
  
    this.cdr.detectChanges();}

  formatFolio(): string {
    const next = (this.config.consecutivo ?? 0) + 1;
    return `${this.config.prefijo ?? ''}${String(next).padStart(4, '0')}`;
  }

  async guardar() {
    this.saving = true;
    try {
      await this.svc.saveConfig(this.idCompany, this.config);
      Swal.fire({ icon: 'success', title: 'Configuración guardada', timer: 1400, showConfirmButton: false });
    } catch {
      Swal.fire('Error', 'No se pudo guardar la configuración.', 'error');
    } finally {
      this.saving = false;
    }
  
    this.cdr.detectChanges();}
}
