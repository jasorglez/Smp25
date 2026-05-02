import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExtractionFermentationCatalogItem, ExtractionFermentationCatalogService } from 'app/services/extraction-fermentation-catalog.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-configuracion-prod',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host {
      display: block;
    }
    .config-shell {
      padding: 12px 0 0;
    }
    .config-card {
      background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
      border: 1px solid #d7e4f5;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 18px 40px rgba(31, 59, 92, 0.08);
    }
    .config-body {
      padding: 18px;
    }
    .config-placeholder {
      padding: 18px;
      color: #6b7280;
    }
    .mini-board {
      display: block;
    }
    .panel {
      background: rgba(255, 255, 255, 0.84);
      border: 1px solid #dbe7f6;
      border-radius: 16px;
      padding: 14px;
      backdrop-filter: blur(6px);
    }
    .panel-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }
    .eyebrow {
      margin: 0 0 4px;
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #5d7ea6;
      font-weight: 700;
    }
    .panel-title {
      margin: 0;
      font-size: 1.05rem;
      color: #17324f;
      font-weight: 700;
    }
    .panel-copy {
      margin: 4px 0 0;
      color: #6d7a8a;
      font-size: 0.86rem;
    }
    .summary-pill {
      padding: 8px 12px;
      border-radius: 999px;
      background: #eef5ff;
      color: #2a5b95;
      font-size: 0.78rem;
      white-space: nowrap;
    }
    .summary-pill.loading {
      opacity: 0.7;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .group {
      border: 1px solid #dbe7f6;
      border-radius: 14px;
      overflow: hidden;
      background: #fbfdff;
      transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
    }
    .group:hover {
      border-color: #bdd2ef;
      box-shadow: 0 10px 24px rgba(52, 93, 146, 0.08);
      transform: translateY(-1px);
    }
    .group-toggle {
      width: 100%;
      border: 0;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      text-align: left;
    }
    .group-name {
      margin: 0;
      color: #163251;
      font-size: 0.95rem;
      font-weight: 700;
    }
    .group-subtitle {
      margin: 3px 0 0;
      color: #7b8898;
      font-size: 0.8rem;
    }
    .group-meta {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #6f8197;
      font-size: 0.8rem;
    }
    .chevron {
      display: inline-flex;
      transition: transform 180ms ease;
    }
    .chevron.open {
      transform: rotate(180deg);
    }
    .group-body {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 220ms ease;
    }
    .group-body.open {
      grid-template-rows: 1fr;
    }
    .group-body-inner {
      overflow: hidden;
    }
    .group-content {
      padding: 0 14px 14px;
    }
    .chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 999px;
      background: #edf4ff;
      color: #214d82;
      font-size: 0.82rem;
      animation: chipIn 220ms ease;
    }
    .chip button {
      border: 0;
      background: transparent;
      color: #7c90ab;
      padding: 0;
      line-height: 1;
      font-size: 0.9rem;
    }
    .chip.editing {
      padding: 6px 8px;
      background: #f0f6ff;
      border: 1px solid #4a90e2;
    }
    .empty-state {
      padding: 10px 12px;
      border: 1px dashed #cfe0f6;
      border-radius: 12px;
      color: #7c8796;
      font-size: 0.82rem;
      margin-bottom: 12px;
      background: #fcfdff;
    }
    .inline-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
    }
    .minimal-input {
      border: 1px solid #d4e0f0;
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 0.88rem;
      background: #fff;
      color: #17324f;
      transition: border-color 160ms ease, box-shadow 160ms ease;
    }
    .minimal-input:focus {
      outline: 0;
      border-color: #86aee3;
      box-shadow: 0 0 0 4px rgba(110, 159, 223, 0.15);
    }
    .minimal-btn {
      border: 0;
      border-radius: 12px;
      padding: 10px 14px;
      background: #1e6fe8;
      color: #fff;
      font-size: 0.84rem;
      font-weight: 600;
      transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
    }
    .minimal-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 18px rgba(30, 111, 232, 0.18);
    }
    .minimal-btn:disabled {
      opacity: 0.6;
      box-shadow: none;
      transform: none;
    }
    .status-row {
      margin-bottom: 10px;
      color: #6480a3;
      font-size: 0.8rem;
    }
    @keyframes chipIn {
      from {
        opacity: 0;
        transform: translateY(4px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `],
  template: `
    <div class="config-shell">
      <div class="config-card">
        <div class="card-header p-2">
          <ul class="nav nav-pills nav-level-2">
            <li class="nav-item" *ngFor="let tab of tabs">
              <a class="nav-link" [class.active]="activeTab === tab.key" (click)="activeTab = tab.key" style="cursor:pointer;">
                {{ tab.label }}
              </a>
            </li>
          </ul>
        </div>

        <div class="config-body" *ngIf="activeTab === 'molienda'">
          <div class="mini-board">
            <section class="panel">
              <div class="panel-head">
                <div>
                  <p class="eyebrow">Configuración</p>
                  <h3 class="panel-title">Extraccion y fermentacion - Catalogo</h3>
                </div>
                <div class="summary-pill" [class.loading]="isLoading" *ngIf="idBranch && idBranch > 0">
                  {{ isLoading ? 'Cargando...' : totalCategorias + ' categorías' }}
                </div>
              </div>

              <div class="stack" *ngIf="!idBranch || idBranch < 0">
                <div style="padding: 20px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 12px; color: #856404; text-align: center;">
                  <p style="margin: 0; font-weight: 600;">⚠️ No puedes acceder a este apartado hasta que selecciones una sucursal</p>
                </div>
              </div>

              <div class="stack" *ngIf="idBranch && idBranch > 0">
                <article class="group">
                  <button type="button" class="group-toggle" (click)="toggleSection('catalogo')">
                    <div>
                      <p class="group-name">Catálogo general</p>
                      <p class="group-subtitle">Agrupa aquí tus categorías de extracción y fermentación.</p>
                    </div>
                    <div class="group-meta">
                      <span>{{ catalogoCategorias.length }}</span>
                      <span class="chevron" [class.open]="openSection === 'catalogo'">⌄</span>
                    </div>
                  </button>

                  <div class="group-body" [class.open]="openSection === 'catalogo'">
                    <div class="group-body-inner">
                      <div class="group-content">
                        <div class="status-row" *ngIf="!idRoot">
                          Selecciona una empresa para cargar el catálogo.
                        </div>
                        <div class="status-row" *ngIf="idRoot && isSaving">
                          Guardando cambios...
                        </div>
                        <div class="chip-list" *ngIf="catalogoCategorias.length">
                          <span class="chip" *ngFor="let item of catalogoCategorias" [class.editing]="editingCategoriaId === item.id">
                            <ng-container *ngIf="editingCategoriaId !== item.id">
                              <span (dblclick)="startEditCategoria(item, $event)" style="cursor: pointer; flex: 1;">
                                {{ item.description }}
                              </span>
                              <button type="button" (click)="removeCategoria(item)" [disabled]="isSaving">×</button>
                            </ng-container>
                            <ng-container *ngIf="editingCategoriaId === item.id">
                              <input
                                type="text"
                                [(ngModel)]="editingCategoriaText"
                                (keyup.enter)="saveEditCategoria()"
                                (keyup.escape)="cancelEditCategoria()"
                                autofocus
                                style="flex: 1; padding: 2px 6px; border: 1px solid #4a90e2; border-radius: 4px; font-size: 0.9rem;">
                              <button type="button" (click)="saveEditCategoria()" [disabled]="isSaving" style="padding: 2px 6px; background: #4a90e2; color: white; border: 0; border-radius: 3px; cursor: pointer; font-size: 0.85rem;">✓</button>
                              <button type="button" (click)="cancelEditCategoria()" [disabled]="isSaving" style="padding: 2px 6px; background: #999; color: white; border: 0; border-radius: 3px; cursor: pointer; margin-left: 4px; font-size: 0.85rem;">✕</button>
                            </ng-container>
                          </span>
                        </div>
                        <div class="empty-state" *ngIf="idRoot && !isLoading && !catalogoCategorias.length">
                          Aún no agregas categorías para este catálogo.
                        </div>
                        <div class="inline-form">
                          <input
                            class="minimal-input"
                            type="text"
                            placeholder="Nueva categoría"
                            [(ngModel)]="newCategoria"
                            (keydown.enter)="addCategoria()"
                            [disabled]="!idRoot || !idBranch || idBranch < 0 || isSaving">
                          <button class="minimal-btn" type="button" (click)="addCategoria()" [disabled]="!idRoot || !idBranch || idBranch < 0 || !newCategoria.trim() || isSaving">
                            Agregar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </div>

        <div class="config-placeholder" *ngIf="activeTab === 'preparacion1'">Preparacion 1 — en construcción</div>
        <div class="config-placeholder" *ngIf="activeTab === 'preparacion2'">Preparacion 2 — en construcción</div>
        <div class="config-placeholder" *ngIf="activeTab === 'cerveza'">Cerveza — en construcción</div>
        <div class="config-placeholder" *ngIf="activeTab === 'envasado'">Envasado — en construcción</div>
      </div>
    </div>
  `,
})
export class ConfiguracionProdComponent {
  private catalogService = inject(ExtractionFermentationCatalogService);
  private signalsService = inject(SignalsService);

  activeTab = 'molienda';
  openSection: 'catalogo' = 'catalogo';
  idRoot = 0;
  idBranch: number | null = null;
  isLoading = false;
  isSaving = false;

  newCategoria = '';
  editingCategoriaId: number | null = null;
  editingCategoriaText = '';

  catalogoCategorias: ExtractionFermentationCatalogItem[] = [];

  tabs = [
    { key: 'molienda', label: 'Extraccion y fermentacion' },
    { key: 'preparacion1', label: 'Preparacion 1' },
    { key: 'preparacion2', label: 'Preparacion 2' },
    { key: 'cerveza', label: 'Cerveza' },
    { key: 'envasado', label: 'Envasado' },
  ];

  constructor() {
    effect(() => {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      const idBranch = this.signalsService.getBranchSelectedBySidebar()();
      this.idBranch = idBranch;

      if (!idRoot) {
        this.idRoot = 0;
        this.catalogoCategorias = [];
        return;
      }

      this.idRoot = idRoot;
      if (idBranch && idBranch > 0) {
        this.loadCatalogo();
      } else {
        this.catalogoCategorias = [];
      }
    });
  }

  get totalCategorias(): number {
    return this.catalogoCategorias.length;
  }

  toggleSection(section: 'catalogo') {
    this.openSection = this.openSection === section ? section : section;
  }

  addCategoria() {
    const value = this.newCategoria.trim();
    if (!value || !this.idRoot || !this.idBranch || this.idBranch < 0 || this.isSaving) return;

    this.isSaving = true;
    this.catalogService.create({
      idCompany: this.idRoot,
      idBranch: this.idBranch,
      description: value,
      active: true,
    }).subscribe({
      next: (created) => {
        this.catalogoCategorias = [...this.catalogoCategorias, created]
          .sort((a, b) => a.description.localeCompare(b.description));
        this.newCategoria = '';
        this.openSection = 'catalogo';
        this.catalogService.bumpRefreshTrigger();
        this.isSaving = false;
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  removeCategoria(item: ExtractionFermentationCatalogItem) {
    if (this.isSaving) return;

    this.isSaving = true;
    this.catalogService.delete(item.id).subscribe({
      next: () => {
        this.catalogoCategorias = this.catalogoCategorias.filter(x => x.id !== item.id);
        this.catalogService.bumpRefreshTrigger();
        this.isSaving = false;
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  startEditCategoria(item: ExtractionFermentationCatalogItem, event: Event) {
    event.stopPropagation();
    this.editingCategoriaId = item.id;
    this.editingCategoriaText = item.description;
  }

  saveEditCategoria() {
    if (!this.editingCategoriaId || !this.editingCategoriaText.trim() || this.isSaving) return;

    this.isSaving = true;
    this.catalogService.update(this.editingCategoriaId, { description: this.editingCategoriaText }).subscribe({
      next: () => {
        const idx = this.catalogoCategorias.findIndex(x => x.id === this.editingCategoriaId);
        if (idx !== -1) {
          this.catalogoCategorias[idx].description = this.editingCategoriaText;
          this.catalogoCategorias = [...this.catalogoCategorias]
            .sort((a, b) => a.description.localeCompare(b.description));
        }
        this.editingCategoriaId = null;
        this.editingCategoriaText = '';
        this.catalogService.bumpRefreshTrigger();
        this.isSaving = false;
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  cancelEditCategoria() {
    this.editingCategoriaId = null;
    this.editingCategoriaText = '';
  }

  private loadCatalogo() {
    if (!this.idRoot || !this.idBranch || this.idBranch < 0) return;

    this.isLoading = true;
    this.catalogService.getAllByBranch(this.idRoot, this.idBranch).subscribe({
      next: (items) => {
        this.catalogoCategorias = items ?? [];
        this.isLoading = false;
      },
      error: () => {
        this.catalogoCategorias = [];
        this.isLoading = false;
      },
    });
  }
}
