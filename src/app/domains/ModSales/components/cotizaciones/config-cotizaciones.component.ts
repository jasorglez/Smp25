import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CotizacionesService, CotizacionConfig, CONFIG_DEFAULT } from 'app/services/cotizaciones.service';
import { MaterialsService } from 'app/services/materials.service';
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

          <!-- ══ Filtro de familias ══════════════════════════════════════════ -->
          <div class="col-12">
            <label class="form-label small fw-semibold">
              <i class="bi bi-tags me-1 text-primary"></i>
              Familias de materiales disponibles en cotizaciones
              <span class="text-muted fw-normal ms-1">(sin selección = todas)</span>
            </label>

            <div *ngIf="loadingFamilias" class="text-muted small mb-2">
              <span class="spinner-border spinner-border-sm me-1"></span> Cargando familias...
            </div>

            <div *ngIf="!loadingFamilias && !familiasDisponibles.length" class="text-muted small mb-2">
              <i class="bi bi-exclamation-circle me-1"></i>No se encontraron familias en el catálogo de materiales.
            </div>

            <!-- Chips de familias disponibles -->
            <div *ngIf="!loadingFamilias && familiasDisponibles.length" class="d-flex flex-wrap gap-2 mb-2">
              <span *ngFor="let f of familiasDisponibles"
                    class="badge rounded-pill border"
                    [class.bg-primary]="esFamiliaSeleccionada(f)"
                    [class.text-white]="esFamiliaSeleccionada(f)"
                    [class.bg-light]="!esFamiliaSeleccionada(f)"
                    [class.text-secondary]="!esFamiliaSeleccionada(f)"
                    style="cursor:pointer; font-size:.8rem; padding:.4rem .8rem;"
                    (click)="toggleFamilia(f)">
                <i class="bi me-1" [class.bi-check-circle-fill]="esFamiliaSeleccionada(f)"
                   [class.bi-circle]="!esFamiliaSeleccionada(f)"></i>
                {{ f }}
              </span>
            </div>

            <!-- Agregar familia manual (por si el nombre no aparece en el catálogo) -->
            <div class="input-group input-group-sm" style="max-width:380px">
              <input class="form-control form-control-sm" [(ngModel)]="nuevaFamilia"
                     placeholder="Agregar familia manualmente..."
                     (keyup.enter)="agregarFamiliaManual()">
              <button class="btn btn-outline-primary btn-sm" (click)="agregarFamiliaManual()"
                      [disabled]="!nuevaFamilia.trim()">
                <i class="bi bi-plus-lg"></i> Agregar
              </button>
            </div>

            <!-- Estado actual del filtro -->
            <div class="form-text mt-1">
              <span *ngIf="!config.familias?.length" class="text-muted">
                <i class="bi bi-infinity me-1"></i>Sin filtro — se mostrarán materiales de <strong>todas</strong> las familias al cotizar.
              </span>
              <span *ngIf="config.familias?.length" class="text-success fw-semibold">
                <i class="bi bi-funnel-fill me-1"></i>Filtro activo:
                <span *ngFor="let f of config.familias; let last=last">
                  <span class="badge bg-success rounded-pill">{{ f }}</span>{{ !last ? ' ' : '' }}
                </span>
              </span>
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
  private svc    = inject(CotizacionesService);
  private matSvc = inject(MaterialsService);

  @Input() idCompany!: number;

  config: CotizacionConfig = { ...CONFIG_DEFAULT };
  loading         = false;
  saving          = false;
  loadingFamilias = false;
  familiasDisponibles: string[] = [];
  nuevaFamilia    = '';

  ngOnInit() { this.cargar(); }

  async cargar() {
    this.loading = true;
    this.config  = await this.svc.getConfig(this.idCompany);
    if (!this.config.familias) this.config.familias = [];
    this.loading = false;
    this.cargarFamilias();
  }

  cargarFamilias() {
    if (!this.idCompany) return;
    this.loadingFamilias = true;
    this.matSvc.getMaterialsForApu(this.idCompany).subscribe({
      next: (data: any[]) => {
        const set = new Set<string>();
        data.forEach(m => { if (m.familia) set.add(m.familia); });
        this.familiasDisponibles = Array.from(set).sort();
        this.loadingFamilias = false;
      },
      error: () => { this.loadingFamilias = false; },
    });
  }

  esFamiliaSeleccionada(familia: string): boolean {
    return (this.config.familias ?? []).includes(familia);
  }

  toggleFamilia(familia: string) {
    if (!this.config.familias) this.config.familias = [];
    const idx = this.config.familias.indexOf(familia);
    if (idx >= 0) {
      this.config.familias = this.config.familias.filter(f => f !== familia);
    } else {
      this.config.familias = [...this.config.familias, familia];
    }
  }

  agregarFamiliaManual() {
    const nombre = this.nuevaFamilia.trim();
    if (!nombre) return;
    if (!this.config.familias) this.config.familias = [];
    if (!this.config.familias.includes(nombre)) {
      this.config.familias = [...this.config.familias, nombre];
      // También añadir a las disponibles si no está
      if (!this.familiasDisponibles.includes(nombre)) {
        this.familiasDisponibles = [...this.familiasDisponibles, nombre].sort();
      }
    }
    this.nuevaFamilia = '';
  }

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
  }
}
