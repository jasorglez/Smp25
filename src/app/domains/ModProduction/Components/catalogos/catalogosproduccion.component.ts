import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { forkJoin, lastValueFrom, of } from 'rxjs';
import { SelectWithTooltipEditorV2Component } from 'app/shared/select-with-tooltip-editor-v2.component';
import { ConfiguracionPageComponent } from '../configuracion/configuracion-page/configuracion-page.component';
import { ExtractionFermentationCatalogItem, ExtractionFermentationCatalogService } from '../../../../services/extraction-fermentation-catalog.service';
import { MaterialsService } from '../../../../services/materials.service';
import { MaterialXModuloService } from '../../../../services/materialxmodulo.service';
import { SignalsService } from '../../../../services/signals.service';
import { CatalogProductionService, CatalogProductionItem } from '../../../../services/catalog-production.service';
import { alerts } from 'app/helpers/alerts';
import { ProductionService } from '../../../../services/production.service';

@Component({
  selector: 'app-catalogosproduccion',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, SelectWithTooltipEditorV2Component, ConfiguracionPageComponent],
  styles: [`
    :host {
      display: block;
    }
    .catalog-shell {
      padding-top: 12px;
    }
    .catalog-tabs {
      margin-bottom: 12px;
    }
    .catalog-frame {
      display: grid;
      grid-template-columns: 250px 52px minmax(0, 1fr);
      gap: 16px;
      align-items: start;
      min-height: 520px;
    }
    .catalog-frame.catalog-frame--hier-toolbar {
      grid-template-columns: 250px 52px minmax(0, 1fr);
    }
    .catalog-sidebar-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      align-self: start;
    }
    .sidebar-hier-help {
      margin-top: 0;
      max-width: none;
    }
    .sidebar-hier-help-inner {
      background: linear-gradient(165deg, rgba(223, 234, 252, 0.65) 0%, rgba(237, 244, 255, 0.9) 100%);
      border: 1px solid #c5d8f0;
      border-radius: 8px;
      padding: 12px 12px 14px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
    }
    .sidebar-hier-help-heading {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 0.84rem;
      font-weight: 600;
      color: #184f97;
      margin: 0 0 11px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(199, 218, 248, 0.85);
    }
    .sidebar-hier-help-heading .bi {
      color: #e8a317;
      font-size: 1.05rem;
      filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.8));
    }
    .sidebar-hier-help-section {
      margin-bottom: 11px;
    }
    .sidebar-hier-help-section:last-child {
      margin-bottom: 0;
    }
    .sidebar-hier-help-label {
      display: block;
      font-size: 0.68rem;
      font-weight: 600;
      color: #5b6572;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 5px;
    }
    .sidebar-hier-help-list {
      margin: 0;
      padding-left: 1rem;
      font-size: 0.78rem;
      color: #3d4a5c;
      line-height: 1.5;
    }
    .sidebar-hier-help-list li {
      margin-bottom: 4px;
      padding-left: 2px;
    }
    .sidebar-hier-help-list li:last-child {
      margin-bottom: 0;
    }
    .sidebar-hier-help-plus {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.15rem;
      height: 1.15rem;
      padding: 0 3px;
      font-size: 0.62rem;
      font-weight: 700;
      border-radius: 4px;
      background: #1f6feb;
      color: #fff;
      vertical-align: middle;
      margin: 0 3px;
      line-height: 1;
    }
    .sidebar-hier-help-foot {
      margin: 0;
      font-size: 0.78rem;
      color: #3d4a5c;
      line-height: 1.45;
    }
    .hier-actions {
      align-items: flex-start;
    }
    .sidebar-hier-selection {
      width: 100%;
      padding: 11px 10px 12px;
      background: #ffffff;
      border: 1px solid #dde8f5;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(15, 44, 86, 0.04);
    }
    .hier-selection {
      max-width: 168px;
      color: #5b6572;
      font-size: 0.84rem;
    }
    .sidebar-hier-selection.hier-selection {
      max-width: none;
    }
    .hier-selection .badge {
      font-weight: 600;
      font-size: 0.75rem;
    }
    .catalog-sidebar {
      background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
      border: 1px solid #cfdcf2;
      border-radius: 10px;
      padding: 10px 12px;
      box-shadow: 0 1px 2px rgba(15, 44, 86, 0.05);
      min-height: 220px;
    }
    .sidebar-title {
      margin: 0 0 10px;
      padding: 2px 8px;
      background: #d4dae2;
      color: #5b6572;
      font-size: 0.95rem;
      line-height: 1.2;
    }
    .sidebar-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .sidebar-item {
      border: 0;
      background: transparent;
      text-align: left;
      padding: 4px 2px;
      color: #20262d;
      font-size: 0.92rem;
      line-height: 1.35;
      text-transform: uppercase;
      cursor: default;
    }
    .sidebar-item.catalog-entry {
      text-transform: none;
      padding-left: 0;
      border-left: 3px solid transparent;
    }
    .sidebar-item.catalog-entry.active {
      border-left-color: #1f6feb;
      color: #184f97;
      font-weight: 600;
    }
    .sidebar-empty {
      color: #7c8796;
      font-size: 0.84rem;
      padding: 6px 2px;
    }
    .catalog-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 2px;
    }
    .action-btn {
      width: 42px;
      height: 42px;
      border: 0;
      border-radius: 6px;
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 2px rgba(15, 44, 86, 0.12);
      position: relative;
    }
    .action-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .action-btn.add {
      background: #1f6feb;
    }
    .action-btn.save {
      background: #1f9254;
    }
    .action-btn.revert {
      background: #fbbc04;
      color: #1b1b1b;
    }
    .action-btn.delete {
      background: #d93025;
    }
    .dirty-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #d93025;
      border: 2px solid #fff;
      position: absolute;
      top: -2px;
      right: -2px;
    }
    .catalog-panel {
      background: #edf4ff;
      border: 1px solid #c7daf8;
      border-radius: 10px;
      min-height: 520px;
      overflow: hidden;
    }
    .panel-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 14px;
      border-bottom: 1px solid #c7daf8;
      background: #dfeafc;
    }
    .panel-title {
      font-size: 0.95rem;
      color: #184f97;
      font-weight: 500;
    }
    .panel-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #184f97;
      font-size: 0.85rem;
    }
    .panel-content {
      padding: 0;
    }
    .panel-empty {
      min-height: 470px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #184f97;
      font-size: 0.95rem;
    }
    .helper-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 14px 0;
    }
    .helper-message {
      padding: 18px 14px;
      color: #6b7280;
    }
    .danger-link {
      border: 0;
      background: transparent;
      color: #bb2d3b;
      font-size: 0.85rem;
      padding: 0;
    }
    .danger-link:disabled {
      opacity: 0.5;
    }
    .panel-select {
      max-width: 240px;
      background-color: #fff;
      border-color: #b8ccec;
    }
    :host ::ng-deep .catalog-grid.ag-theme-quartz {
      --ag-background-color: #edf4ff;
      --ag-header-background-color: #dfeafc;
      --ag-odd-row-background-color: #edf4ff;
      --ag-row-hover-color: #e5efff;
      --ag-selected-row-background-color: #d7e7ff;
      --ag-border-color: #c7daf8;
      --ag-header-foreground-color: #184f97;
      --ag-foreground-color: #16345f;
      border: 0;
      border-radius: 0 0 10px 10px;
    }
    :host ::ng-deep .catalog-grid .ag-root-wrapper {
      border: 0;
      border-radius: 0 0 10px 10px;
    }
    :host ::ng-deep .catalog-grid .ag-header {
      border-bottom: 1px solid #c7daf8;
    }
    :host ::ng-deep .catalog-grid .ag-header-cell-label {
      font-size: 0.88rem;
      font-weight: 500;
    }
    :host ::ng-deep .catalog-grid .ag-cell {
      font-size: 0.88rem;
    }
    .toast-mini {
      display: inline-block;
      background: #198754;
      color: #fff;
      font-size: 0.75rem;
      padding: 3px 10px;
      border-radius: 20px;
      margin-bottom: 6px;
      animation: fadeInOut 1.5s ease forwards;
    }
    @keyframes fadeInOut {
      0%   { opacity: 0; transform: translateY(-4px); }
      15%  { opacity: 1; transform: translateY(0); }
      75%  { opacity: 1; }
      100% { opacity: 0; }
    }
    @media (max-width: 991px) {
      .catalog-frame {
        grid-template-columns: 1fr;
      }
      .catalog-actions {
        flex-direction: row;
        padding-top: 0;
      }
      .catalog-panel {
        min-height: 400px;
      }
    }
  `],
  template: `
    <div class="catalog-shell">
      <div class="catalog-tabs">
        <ul class="nav nav-pills nav-level-2">
          <li class="nav-item" *ngFor="let tab of tabs">
            <a class="nav-link" [class.active]="activeTab === tab.key"
               (click)="activeTab = tab.key" style="cursor:pointer;">
              {{ tab.label }}
            </a>
          </li>
        </ul>
      </div>

      <div class="catalog-frame"
           [class.catalog-frame--hier-toolbar]="activeTab === 'molienda' && showHierarchicalTable">
        <ng-container *ngIf="activeTab === 'molienda'">
          <div class="catalog-sidebar-stack">
            <aside class="catalog-sidebar">
              <p class="sidebar-title">Lista Tablas</p>
              <div class="sidebar-list">
                <div class="sidebar-empty" *ngIf="!catalogSidebarItems.length">Sin categorías</div>
                <!-- Entrada estática Prefijos Fases -->
                <div class="sidebar-item catalog-entry"
                     [class.active]="prefijoFaseMode"
                     (click)="selectPrefijoFase()"
                     style="cursor:pointer; font-style:italic; border-top:1px solid #dee2e6; margin-top:4px; padding-top:6px;">
                  <span><i class="bi bi-tag-fill me-1 text-secondary"></i>Prefijos Fases</span>
                </div>
                <div
                  class="sidebar-item catalog-entry"
                  *ngFor="let item of catalogSidebarItems; trackBy: trackByCatalogItem"
                  [class.active]="selectedCatalogSidebarId === item.id"
                  (click)="onSelectCatalogSidebar(item)"
                  (dblclick)="onDoubleclickCatalogItem(item, $event)"
                  style="cursor: pointer;">
                  <div *ngIf="editingCatalogId !== item.id"
                       style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ item.description }}</span>
                  </div>
                  <div *ngIf="editingCatalogId === item.id" style="display: flex; gap: 4px; align-items: center;">
                    <input
                      type="text"
                      [(ngModel)]="editingCatalogDescription"
                      (keyup.enter)="saveCatalogEdit()"
                      (keyup.escape)="cancelCatalogEdit()"
                      autofocus
                      class="form-control form-control-sm"
                      style="flex: 1; height: 24px; font-size: 0.85rem;">
                    <button class="btn btn-xs btn-success" (click)="saveCatalogEdit()" style="padding: 2px 6px; font-size: 0.75rem;">✓</button>
                    <button class="btn btn-xs btn-secondary" (click)="cancelCatalogEdit()" style="padding: 2px 6px; font-size: 0.75rem;">✕</button>
                  </div>
                </div>
              </div>
            </aside>

            <div class="sidebar-hier-selection hier-selection"
                 *ngIf="showHierarchicalTable && selectedHierarchicalRow">
              <div class="text-center mb-2">
                <i class="bi bi-cursor-fill text-primary"></i>
              </div>
              <div class="badge rounded-pill px-3 py-1"
                   [ngClass]="{
                     'bg-primary': selectedHierarchicalNodeLevel === 'category',
                     'bg-info': selectedHierarchicalNodeLevel === 'family',
                     'bg-secondary': selectedHierarchicalNodeLevel === 'subfamily'
                   }">
                {{ selectedHierarchicalNodeLevel === 'category' ? 'Categoría' :
                   selectedHierarchicalNodeLevel === 'family' ? 'Familia' : 'Subfamilia' }}
              </div>
              <div class="text-truncate mt-2 text-center" style="font-size: 0.75rem; color: #3d4a5c;">
                {{ selectedHierarchicalRow?.description || 'Seleccionado' }}
              </div>
            </div>

            <div class="sidebar-hier-help" *ngIf="showHierarchicalTable">
              <div class="sidebar-hier-help-inner">
                <div class="sidebar-hier-help-heading">
                  <i class="bi bi-lightbulb-fill" aria-hidden="true"></i>
                  <span>Flujo con modales</span>
                </div>
                <div class="sidebar-hier-help-section">
                  <span class="sidebar-hier-help-label">Agregar elemento</span>
                  <ul class="sidebar-hier-help-list">
                    <li>Click columna vacía → Crear hijo</li>
                    <li>Click elemento → Crear hermano</li>
                    <li>Click <span class="sidebar-hier-help-plus">+</span> → Abrir modal</li>
                  </ul>
                </div>
                <div class="sidebar-hier-help-section">
                  <span class="sidebar-hier-help-label">Editar</span>
                  <p class="sidebar-hier-help-foot">Doble-click → Modal</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Botones Prefijos Fases -->
          <div class="catalog-actions" *ngIf="prefijoFaseMode">
            <button class="action-btn add" (click)="addPrefijoFase()"><i class="bi bi-plus-lg"></i></button>
            <button class="action-btn save" (click)="savePrefijoFases()" [disabled]="!prefijoFaseHasChanges">
              <i class="bi bi-floppy"></i>
              <span *ngIf="prefijoFaseHasChanges" class="dirty-dot"></span>
            </button>
            <button class="action-btn revert" (click)="revertPrefijoFases()"><i class="bi bi-arrow-clockwise"></i></button>
            <button class="action-btn delete" (click)="deletePrefijoFase()" [disabled]="!prefijoFaseSelectedRow"><i class="bi bi-trash"></i></button>
          </div>

          <div class="catalog-actions" *ngIf="!showHierarchicalTable && !prefijoFaseMode">
            <button class="action-btn add" (click)="add()" [disabled]="!gridApi || !selectedCatalogSidebarId" title="Selecciona una categoría para agregar">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button class="action-btn save" (click)="saveChanges()" [disabled]="!hasUnsavedChanges || !selectedCatalogSidebarId" title="Selecciona una categoría para guardar">
              <i class="bi bi-floppy"></i>
              <span *ngIf="hasUnsavedChanges" class="dirty-dot"></span>
            </button>
            <button class="action-btn revert" (click)="revertChanges()" title="Deshacer">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
            <button class="action-btn delete" (click)="deleteRow()" [disabled]="!selectedRow || !selectedCatalogSidebarId" title="Borrar fila">
              <i class="bi bi-trash"></i>
            </button>
          </div>

          <div class="catalog-actions hier-actions" *ngIf="showHierarchicalTable">
            <button class="action-btn add" (click)="addHierarchicalCatalogItem()" title="Agregar (según selección y columna)">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button class="action-btn save" (click)="saveHierarchicalChanges()" [disabled]="!hasUnsavedChangesHier" title="Guardar cambios">
              <i class="bi bi-floppy"></i>
              <span *ngIf="hasUnsavedChangesHier" class="dirty-dot"></span>
            </button>
            <button class="action-btn delete" (click)="deleteHierarchicalItem()" [disabled]="!selectedHierarchicalRow" title="Borrar elemento">
              <i class="bi bi-trash"></i>
            </button>
          </div>

          <section class="catalog-panel">
            <div class="helper-row" *ngIf="toastMsg()">
              <div class="toast-mini">{{ toastMsg() }}</div>
            </div>

            <!-- Panel Prefijos Fases -->
            <div class="panel-content" *ngIf="prefijoFaseMode">
              <ag-grid-angular
                class="ag-theme-quartz catalog-grid"
                [rowData]="prefijoFaseRows"
                [columnDefs]="prefijoFaseColDefs"
                [gridOptions]="prefijoFaseGridOptions"
                (gridReady)="onPrefijoFaseGridReady($event)"
                (cellValueChanged)="$any($event).data.__modified = true; prefijoFaseHasChanges = true"
                (rowClicked)="prefijoFaseSelectedRow = $event.data"
                style="height: 470px; width: 100%;">
              </ag-grid-angular>
            </div>

            <div class="panel-content" *ngIf="!showHierarchicalTable && !prefijoFaseMode">
              <ag-grid-angular
                class="ag-theme-quartz catalog-grid"
                [rowData]="rowData()"
                [columnDefs]="isBotesMode ? boteColumnDefs : columnDefs"
                [gridOptions]="isBotesMode ? boteGridOptions : gridOptions"
                (gridReady)="onGridReady($event)"
                (cellValueChanged)="onCellValueChanged($event)"
                (rowClicked)="onRowClicked($event)"
                (cellEditingStopped)="onCellEditingStopped($event)"
                style="height: 470px; width: 100%;">
              </ag-grid-angular>
            </div>

            <div class="panel-content" *ngIf="showHierarchicalTable">
              <ag-grid-angular
                class="ag-theme-quartz catalog-grid"
                [rowData]="hierarchicalVisibleRows"
                [columnDefs]="hierarchicalColumnDefs"
                [gridOptions]="hierarchicalGridOptions"
                rowSelection="single"
                (gridReady)="onHierarchicalGridReady($event)"
                (cellDoubleClicked)="onHierarchicalCellDoubleClicked($event)"
                (cellValueChanged)="onHierarchicalCellValueChanged($event)"
                style="height: 470px; width: 100%;">
              </ag-grid-angular>
            </div>
          </section>
        </ng-container>

        <ng-container *ngIf="activeTab === 'preparacion1'">
          <aside class="catalog-sidebar">
            <p class="sidebar-title">Lista Tablas</p>
            <div class="sidebar-list">
              <div class="sidebar-item" *ngFor="let cat of categorias1">{{ cat.label }}</div>
            </div>
          </aside>

          <div class="catalog-actions">
            <button class="action-btn add" (click)="add1()" [disabled]="!gridApi1 || !selectedType1 || selectedType1 === 'P1_JARABE'" title="Agregar">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button class="action-btn save" (click)="saveChanges1()" [disabled]="!hasUnsavedChanges1 || !selectedType1 || selectedType1 === 'P1_JARABE'" title="Guardar">
              <i class="bi bi-floppy"></i>
              <span *ngIf="hasUnsavedChanges1" class="dirty-dot"></span>
            </button>
            <button class="action-btn revert" (click)="revertChanges1()" [disabled]="!selectedType1 || selectedType1 === 'P1_JARABE'" title="Deshacer">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
          </div>

          <section class="catalog-panel">
            <div class="panel-toolbar">
              <div class="panel-title">Descripción</div>
              <div class="panel-meta">
                <span>Activo</span>
                <button type="button" class="danger-link" (click)="deleteRow1()" [disabled]="!selectedRow1 || !selectedType1 || selectedType1 === 'P1_JARABE'">Borrar</button>
              </div>
            </div>

            <div class="helper-row">
              <select class="form-select form-select-sm panel-select"
                      [(ngModel)]="selectedType1"
                      (ngModelChange)="onTypeChange1($event)">
                <option value="">-- Selecciona categoría --</option>
                <option *ngFor="let cat of categorias1" [value]="cat.key">{{ cat.label }}</option>
              </select>
              <div *ngIf="toastMsg1()" class="toast-mini">{{ toastMsg1() }}</div>
            </div>

            <div class="helper-message" *ngIf="!selectedType1">
              Selecciona una categoría para ver los materiales
            </div>

            <div class="panel-content" *ngIf="selectedType1 === 'P1_JARABE'">
              <app-configuracion-page></app-configuracion-page>
            </div>

            <div class="panel-content" *ngIf="selectedType1 && selectedType1 !== 'P1_JARABE'">
              <ag-grid-angular
                class="ag-theme-quartz catalog-grid"
                [rowData]="rowData1()"
                [columnDefs]="columnDefs1"
                [gridOptions]="gridOptions1"
                (gridReady)="onGridReady1($event)"
                (cellValueChanged)="onCellValueChanged1($event)"
                (rowClicked)="onRowClicked1($event)"
                (cellEditingStopped)="onCellEditingStopped1($event)"
                style="height: 430px; width: 100%;">
              </ag-grid-angular>
            </div>
          </section>
        </ng-container>

        <ng-container *ngIf="activeTab === 'preparacion2' || activeTab === 'cerveza' || activeTab === 'envasado'">
          <aside class="catalog-sidebar">
            <p class="sidebar-title">Lista Tablas</p>
            <div class="sidebar-list">
              <div class="sidebar-item">{{ activeTab }}</div>
            </div>
          </aside>
          <div class="catalog-actions"></div>
          <section class="catalog-panel">
            <div class="panel-toolbar">
              <div class="panel-title">Descripción</div>
              <div class="panel-meta">
                <span>Activo</span>
              </div>
            </div>
            <div class="panel-empty">
              No hay filas para mostrar
            </div>
          </section>
        </ng-container>
      </div>
    </div>

    <!-- Modales Jerárquicos -->
    <div *ngIf="showAddCategoryModal" class="modal d-block" style="background: rgba(0,0,0,0.5); z-index: 9999;">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow-lg">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title">📁 Nueva Categoría</h5>
            <button type="button" class="btn-close btn-close-white" (click)="closeHierarchicalModals()"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label fw-500">Nombre <span class="text-danger">*</span></label>
              <input type="text" class="form-control" [(ngModel)]="modalForm.description" placeholder="Nombre de la categoría" (keyup.enter)="saveNewHierarchicalCategory()">
            </div>
            <div class="mb-3">
              <label class="form-label fw-500">Descripción</label>
              <input type="text" class="form-control" [(ngModel)]="modalForm.valueAddition" placeholder="Descripción">
            </div>
            <div class="mb-3">
              <label class="form-label fw-500">Abreviatura</label>
              <input type="text" class="form-control" [(ngModel)]="modalForm.valueAddition2" placeholder="Abreviatura">
            </div>
            <div class="mb-0">
              <label class="form-check">
                <input type="checkbox" class="form-check-input" [(ngModel)]="modalForm.active">
                <span class="form-check-label">Activo</span>
              </label>
            </div>
          </div>
          <div class="modal-footer bg-light">
            <button type="button" class="btn btn-secondary" (click)="closeHierarchicalModals()">Cancelar</button>
            <button type="button" class="btn btn-primary" (click)="saveNewHierarchicalCategory()">Guardar</button>
          </div>
        </div>
      </div>
    </div>

    <div *ngIf="showAddFamilyModal" class="modal d-block" style="background: rgba(0,0,0,0.5); z-index: 9999;">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow-lg">
          <div class="modal-header bg-info text-white">
            <h5 class="modal-title">📂 Nueva Familia</h5>
            <button type="button" class="btn-close btn-close-white" (click)="closeHierarchicalModals()"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label fw-500">Nombre <span class="text-danger">*</span></label>
              <input type="text" class="form-control" [(ngModel)]="modalForm.description" placeholder="Nombre de la familia" (keyup.enter)="saveNewHierarchicalFamily()">
            </div>
            <div class="mb-3">
              <label class="form-label fw-500">Descripción</label>
              <input type="text" class="form-control" [(ngModel)]="modalForm.valueAddition" placeholder="Descripción">
            </div>
            <div class="mb-3">
              <label class="form-label fw-500">Abreviatura</label>
              <input type="text" class="form-control" [(ngModel)]="modalForm.valueAddition2" placeholder="Abreviatura">
            </div>
            <div class="mb-0">
              <label class="form-check">
                <input type="checkbox" class="form-check-input" [(ngModel)]="modalForm.active">
                <span class="form-check-label">Activo</span>
              </label>
            </div>
          </div>
          <div class="modal-footer bg-light">
            <button type="button" class="btn btn-secondary" (click)="closeHierarchicalModals()">Cancelar</button>
            <button type="button" class="btn btn-info text-white" (click)="saveNewHierarchicalFamily()">Guardar</button>
          </div>
        </div>
      </div>
    </div>

    <div *ngIf="showAddSubfamilyModal" class="modal d-block" style="background: rgba(0,0,0,0.5); z-index: 9999;">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow-lg">
          <div class="modal-header bg-success text-white">
            <h5 class="modal-title">📄 Nueva Subfamilia</h5>
            <button type="button" class="btn-close btn-close-white" (click)="closeHierarchicalModals()"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label fw-500">Nombre <span class="text-danger">*</span></label>
              <input type="text" class="form-control" [(ngModel)]="modalForm.description" placeholder="Nombre de la subfamilia" (keyup.enter)="saveNewHierarchicalSubfamily()">
            </div>
            <div class="mb-3">
              <label class="form-label fw-500">Descripción</label>
              <input type="text" class="form-control" [(ngModel)]="modalForm.valueAddition" placeholder="Descripción">
            </div>
            <div class="mb-3">
              <label class="form-label fw-500">Abreviatura</label>
              <input type="text" class="form-control" [(ngModel)]="modalForm.valueAddition2" placeholder="Abreviatura">
            </div>
            <div class="mb-0">
              <label class="form-check">
                <input type="checkbox" class="form-check-input" [(ngModel)]="modalForm.active">
                <span class="form-check-label">Activo</span>
              </label>
            </div>
          </div>
          <div class="modal-footer bg-light">
            <button type="button" class="btn btn-secondary" (click)="closeHierarchicalModals()">Cancelar</button>
            <button type="button" class="btn btn-success" (click)="saveNewHierarchicalSubfamily()">Guardar</button>
          </div>
        </div>
      </div>
    </div>

    <div *ngIf="showEditModal" class="modal d-block" style="background: rgba(0,0,0,0.5); z-index: 9999;">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow-lg">
          <div class="modal-header bg-warning text-dark">
            <h5 class="modal-title">✏️ Editar {{ editingItem?.description }}</h5>
            <button type="button" class="btn-close" (click)="closeHierarchicalModals()"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label fw-500">Nombre <span class="text-danger">*</span></label>
              <input type="text" class="form-control" [(ngModel)]="modalForm.description" placeholder="Nombre" (keyup.enter)="saveHierarchicalEditChanges()">
            </div>
            <div class="mb-3">
              <label class="form-label fw-500">Descripción</label>
              <input type="text" class="form-control" [(ngModel)]="modalForm.valueAddition" placeholder="Descripción">
            </div>
            <div class="mb-3">
              <label class="form-label fw-500">Abreviatura</label>
              <input type="text" class="form-control" [(ngModel)]="modalForm.valueAddition2" placeholder="Abreviatura">
            </div>
            <div class="mb-0">
              <label class="form-check">
                <input type="checkbox" class="form-check-input" [(ngModel)]="modalForm.active">
                <span class="form-check-label">Activo</span>
              </label>
            </div>
            <div class="mt-3" *ngIf="editingItem?.nodeLevel === 'subfamily'">
              <label class="form-check d-block mb-2">
                <input type="checkbox" class="form-check-input" [(ngModel)]="modalForm.valueAdditionBit">
                <span class="form-check-label">Material Maestro</span>
              </label>
              <label class="form-check d-block">
                <input type="checkbox" class="form-check-input" [(ngModel)]="modalForm.valueAdditionBit2">
                <span class="form-check-label">Requisiciones</span>
              </label>
            </div>
          </div>
          <div class="modal-footer bg-light">
            <button type="button" class="btn btn-secondary" (click)="closeHierarchicalModals()">Cancelar</button>
            <button type="button" class="btn btn-warning text-dark" (click)="saveHierarchicalEditChanges()">Actualizar</button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CatalogosProduccionComponent {
  private materialsService  = inject(MaterialsService);
  private mxmService        = inject(MaterialXModuloService);
  private signalsService    = inject(SignalsService);
  private catalogService    = inject(ExtractionFermentationCatalogService);
  private hierService       = inject(CatalogProductionService);
  private productionService = inject(ProductionService);
  activeTab = 'molienda';
  private idRoot = 0;
  private materiales: any[] = [];
  private materialesIdToDesc = new Map<number, string>();
  private matPrimaOptions: { id: number; description: string; prefijo: string }[] = [];
  catalogSidebarItems: ExtractionFermentationCatalogItem[] = [];
  selectedCatalogSidebarId: number | null = null;
  editingCatalogId: number | null = null;
  editingCatalogDescription = '';

  // ── Molienda ──
  hasUnsavedChanges = false;
  selectedRow: any  = null;
  toastMsg          = signal('');
  rowData           = signal<any[]>([]);
  private originalRowData: any[] = [];
  gridApi!: GridApi;
  private enterPressed = false;
  private editableColumnOrder = ['idArticulo'];
  isBotesMode = false;

  // ── Prefijos Fases ──
  prefijoFaseOptions: { id: number; prefijo: string; nombreFase: string }[] = [];
  prefijoFaseMode = false;
  prefijoFaseRows: any[] = [];
  private prefijoFaseOriginal: any[] = [];
  prefijoFaseHasChanges = false;
  prefijoFaseSelectedRow: any = null;
  prefijoFaseGridApi!: GridApi;

  readonly prefijoFaseColDefs: ColDef[] = [
    {
      field: 'nombreFase', headerName: 'Nombre Fase', editable: true, flex: 1,
      cellEditor: 'agTextCellEditor',
      valueSetter: (p: any) => {
        const val = String(p.newValue ?? '').toUpperCase();
        const dup = this.prefijoFaseRows.some(r => r !== p.data && (r.nombreFase ?? '').toUpperCase() === val);
        if (dup) { this.showToast(`Nombre duplicado: "${val}"`); return false; }
        p.data.nombreFase = val; p.data.__modified = true; this.prefijoFaseHasChanges = true; return true;
      },
    },
    {
      field: 'prefijo', headerName: 'Prefijo Fase', editable: true, width: 160,
      cellEditor: 'agTextCellEditor',
      valueSetter: (p: any) => {
        const val = String(p.newValue ?? '').toUpperCase();
        const dup = this.prefijoFaseRows.some(r => r !== p.data && (r.prefijo ?? '').toUpperCase() === val);
        if (dup) { this.showToast(`Prefijo duplicado: "${val}"`); return false; }
        p.data.prefijo = val; p.data.__modified = true; this.prefijoFaseHasChanges = true; return true;
      },
    },
    {
      field: 'active', headerName: 'Activo', width: 90, editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
      valueSetter: (p: any) => { p.data.active = p.newValue; p.data.__modified = true; this.prefijoFaseHasChanges = true; return true; },
    },
  ];

  readonly prefijoFaseGridOptions: any = {
    getRowId: (p: any) => String(p.data.id ?? p.data.__tempId),
    headerHeight: 25, rowHeight: 22,
    rowSelection: 'single',
    autoSizeStrategy: { type: 'fitCellContents' },
    defaultColDef: { resizable: true },
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
  };

  // ── Tabla Jerárquica (solo «Características de manzana», datos mock en frontend) ──
  showHierarchicalTable = false;
  hierarchicalData: any[] = [];
  hierarchicalVisibleRows: any[] = [];
  hierarchicalGridApi!: GridApi;
  selectedColumnContext: 'category' | 'family' | 'subfamily' | null = null;
  private isDoubleClicking = false;
  private hierarchicalNextTempId = 400000;
  private _hierarchicalColumnDefsCache: ColDef[] | null = null;
  private _hierarchicalGridOptionsCache: any = null;
  hasUnsavedChangesHier = false;

  // Modales jerárquicos
  showAddCategoryModal = false;
  showAddFamilyModal = false;
  showAddSubfamilyModal = false;
  showEditModal = false;

  modalForm = {
    description: '',
    valueAddition: '',
    valueAddition2: '',
    active: true,
    valueAdditionBit: false,
    valueAdditionBit2: false,
  };

  selectedHierarchicalRow: any = null;
  selectedHierarchicalNodeLevel: 'category' | 'family' | 'subfamily' | null = null;
  editingItem: any = null;

  // ── Preparación 1 ──
  readonly categorias1 = [
    { key: 'P1_JARABE',    label: 'Jarabe' },
    { key: 'P1_REFRESCO',  label: 'Refresco' },
    { key: 'P1_SIDRAS',    label: 'Sidras' },
    { key: 'P1_ALCOHOLES', label: 'Alcoholes' },
    { key: 'P1_COCTELES',  label: 'Cocteles' },
    { key: 'P1_VINOS',     label: 'Vinos' },
    { key: 'P1_LICORES',   label: 'Licores' },
  ];

  selectedType1      = '';
  hasUnsavedChanges1 = false;
  selectedRow1: any  = null;
  toastMsg1          = signal('');
  rowData1           = signal<any[]>([]);
  private originalRowData1: any[] = [];
  gridApi1!: GridApi;
  private enterPressed1 = false;
  private editableColumnOrder1 = ['idArticulo'];

  tabs = [
    { key: 'molienda',     label: 'Molienda' },
    { key: 'preparacion1', label: 'Preparacion 1' },
    { key: 'preparacion2', label: 'Preparacion 2' },
    { key: 'cerveza',      label: 'Cerveza' },
    { key: 'envasado',     label: 'Envasado' },
  ];

  // ── Columnas Botes ──
  boteColumnDefs: ColDef[] = [
    {
      headerName: 'Fase',
      field: 'idPrefijoFase',
      width: 160,
      editable: (p: any) => !p.data?.hasUsage,
      cellEditor: SelectWithTooltipEditorV2Component,
      cellEditorParams: () => ({
        options: [
          { id: null, description: '— Sin fase —' },
          ...this.prefijoFaseOptions.map(f => ({ id: f.id, description: `${f.prefijo} - ${f.nombreFase}` })),
        ],
      }),
      valueFormatter: (p: any) => {
        if (p.value == null) return '';
        const f = this.prefijoFaseOptions.find(o => o.id === p.value);
        return f ? `${f.prefijo} - ${f.nombreFase}` : String(p.value);
      },
    },
    {
      headerName: 'Materia Prima',
      field: 'idMatPrima',
      flex: 1,
      minWidth: 160,
      editable: (p: any) => !p.data?.hasUsage,
      cellEditor: SelectWithTooltipEditorV2Component,
      cellEditorParams: () => ({ options: this.matPrimaOptions }),
      valueFormatter: (p: any) => {
        if (p.value == null) return '';
        return this.matPrimaOptions.find(o => o.id === p.value)?.description ?? String(p.value);
      },
    },
    {
      headerName: 'Volumen',
      field: 'cantidad',
      width: 120,
      editable: (p: any) => !p.data?.hasUsage,
      type: 'numericColumn',
      valueParser: (p: any) => {
        const n = parseInt(p.newValue, 10);
        return isNaN(n) ? null : n;
      },
    },
    {
      headerName: 'Código',
      field: 'codigo',
      width: 160,
      editable: false,
      valueGetter: (p: any) => {
        const faseId = p.data?.idPrefijoFase;
        const matId  = p.data?.idMatPrima;
        const fasePrefijo = faseId != null ? (this.prefijoFaseOptions.find(f => f.id === faseId)?.prefijo ?? '') : '';
        const artPrefijo  = matId  != null ? (this.matPrimaOptions.find(m => m.id === matId)?.prefijo ?? '') : '';
        const num = p.data?.prefixNum != null ? p.data.prefixNum : '';
        const vol = p.data?.cantidad  != null ? p.data.cantidad  : '';
        return `${fasePrefijo}${artPrefijo}/${vol}-${num}`;
      },
    },
    {
      headerName: 'Activo',
      field: 'valor',
      width: 90,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
    },
  ];

  boteGridOptions = {
    headerHeight: 25,
    rowHeight: 20,
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
      'locked-row': (p: any) => !!p.data?.hasUsage,
    },
    defaultColDef: {
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed = true;
          setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
          return true;
        }
        return false;
      },
    },
  };

  // ── Columnas Molienda ──
  columnDefs: ColDef[] = [
    {
      headerName: 'Artículo',
      field: 'idArticulo',
      flex: 1,
      minWidth: 150,
      editable: true,
      cellEditor: SelectWithTooltipEditorV2Component,
      cellEditorParams: () => {
        const usados = new Set(this.rowData().map((r: any) => r.idArticulo).filter(Boolean));
        return {
          options: this.materiales
            .filter(m => !usados.has(m.id))
            .map(m => ({ id: m.id, description: m.articulo })),
        };
      },
      valueFormatter: (p: any) => this.materialesIdToDesc.get(p.value) ?? '',
    },
    {
      headerName: 'Prefijo Mat Prima',
      field: 'prefijo',
      width: 150,
      editable: true,
      cellEditor: 'agTextCellEditor',
      valueSetter: (p: any) => { p.data.prefijo = String(p.newValue ?? '').toUpperCase(); p.data.__modified = true; this.hasUnsavedChanges = true; return true; },
    },
    {
      headerName: 'edit col Bultos',
      field: 'editBultos',
      width: 90,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
    },
    {
      headerName: 'Activo',
      field: 'valor',
      width: 90,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
    },
    {
      headerName: 'Molienda',
      field: 'molienda',
      width: 100,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
    },
  ];

  gridOptions = {
    headerHeight: 25,
    rowHeight: 20,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    defaultColDef: {
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed = true;
          setTimeout(() => { if (this.gridApi) this.gridApi.stopEditing(); }, 0);
          return true;
        }
        return false;
      },
    },
  };

  get hierarchicalColumnDefs(): ColDef[] {
    if (!this._hierarchicalColumnDefsCache) {
      this._hierarchicalColumnDefsCache = this.buildHierarchicalColumnDefs();
    }
    return this._hierarchicalColumnDefsCache;
  }

  get hierarchicalGridOptions(): any {
    if (!this._hierarchicalGridOptionsCache) {
      this._hierarchicalGridOptionsCache = {
        headerHeight: 35,
        rowHeight: 28,
        animateRows: false,
        suppressClickEdit: true,
        singleClickEdit: false,
        stopEditingWhenCellsLoseFocus: true,
        suppressScrollOnNewData: true,
        enableBrowserTooltips: true,
        tooltipShowDelay: 500,
        onRowSelected: (event: any) => {
          if (event.node.isSelected()) {
            this.selectedHierarchicalRow = event.data;
            this.selectedHierarchicalNodeLevel = event.data?.nodeLevel ?? null;
          }
        },
      };
    }
    return this._hierarchicalGridOptionsCache;
  }

  // ── Columnas Preparación 1 ──
  columnDefs1: ColDef[] = [
    {
      headerName: 'Articulos1',
      field: 'idArticulo',
      flex: 1,
      minWidth: 150,
      editable: true,
      cellEditor: SelectWithTooltipEditorV2Component,
      cellEditorParams: () => {
        const usados = new Set(this.rowData1().map((r: any) => r.idArticulo).filter(Boolean));
        return {
          options: this.materiales
            .filter(m => !usados.has(m.id))
            .map(m => ({ id: m.id, description: m.articulo })),
        };
      },
      valueFormatter: (p: any) => this.materialesIdToDesc.get(p.value) ?? '',
    },
    {
      headerName: 'Valor',
      field: 'valor',
      width: 140,
      editable: true,
      cellRenderer: 'agCheckboxCellRenderer',
    },
  ];

  gridOptions1 = {
    headerHeight: 25,
    rowHeight: 20,
    rowClassRules: { 'new-row-highlight': (p: any) => !!p.data?.__isNew },
    defaultColDef: {
      suppressKeyboardEvent: (params: any) => {
        if (params.event.key === 'Enter' && params.editing) {
          this.enterPressed1 = true;
          setTimeout(() => { if (this.gridApi1) this.gridApi1.stopEditing(); }, 0);
          return true;
        }
        return false;
      },
    },
  };

  constructor() {
    effect(() => {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      const refreshTick = this.catalogService.getRefreshTrigger()();
      if (!idRoot) {
        this.idRoot = 0;
        this.catalogSidebarItems = [];
        this.selectedCatalogSidebarId = null;
        return;
      }

      this.idRoot = idRoot;
      this.productionService.getMoliendaPrefijos(idRoot).subscribe((pfs: any[]) => {
        this.prefijoFaseOptions = (pfs ?? []).map(p => ({ id: p.id, prefijo: p.prefijo ?? '', nombreFase: p.nombreFase ?? '' }));
      });
      forkJoin({
        mats: this.materialsService.getMaterialsxview(idRoot),
        mxm:  this.mxmService.getByType(idRoot, 'MOLIENDA'),
      }).subscribe(({ mats, mxm }: any) => {
        this.materiales = (mats as any[]) ?? [];
        this.materialesIdToDesc.clear();
        this.materiales.forEach(m => this.materialesIdToDesc.set(m.id, m.articulo));

        // Mapa idArticulo → prefijo del material
        const mxmList: any[] = (mxm as any[]) ?? [];
        const artPrefijoMap = new Map<number, string>();
        mxmList.forEach(m => { if (m.idArticulo != null) artPrefijoMap.set(m.idArticulo, m.prefijo ?? ''); });
        (this as any)._artPrefijoMap = artPrefijoMap;

        this.matPrimaOptions = mxmList
          .filter((m: any) => m.active !== false && m.molienda === true && m.idArticulo != null)
          .map((m: any) => ({
            id: m.idArticulo,
            description: this.materialesIdToDesc.get(m.idArticulo) ?? String(m.idArticulo),
            prefijo: m.prefijo ?? '',
          }))
          .sort((a, b) => a.description.localeCompare(b.description, 'es', { sensitivity: 'base' }));

        this.loadCatalogSidebar();
        this.rowData.set([]);
        this.selectedCatalogSidebarId = null;
      });

      void refreshTick;
    });
  }

  // ──────────────────── Molienda ────────────────────

  onGridReady(params: GridReadyEvent)      { this.gridApi = params.api; }
  onRowClicked(event: any)                 { this.selectedRow = event.data; }
  onCellValueChanged(event: any) {
    if (!event.data.__isNew) { event.data.__modified = true; this.hasUnsavedChanges = true; }
  }
  onCellEditingStopped(event: any) {
    if (!this.enterPressed) return;
    this.enterPressed = false;
    const idx = this.editableColumnOrder.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrder.length - 1) {
      setTimeout(() => this.gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder[idx + 1] }), 100);
    }
  }

  private showToast(msg: string)  { this.toastMsg.set(msg);  setTimeout(() => this.toastMsg.set(''),  1500); }

  loadGridData() {
    this.mxmService.getAll(this.idRoot).subscribe((modulos: any[]) => {
      const rows = (modulos ?? []).map(m => ({ id: m.id, type: m.type, idArticulo: m.idArticulo, valor: m.active }));
      this.originalRowData = JSON.parse(JSON.stringify(rows));
      //console.log('Loaded grid data:', rows);
      this.rowData.set(rows);
    });
  }

  add() {
    if (!this.selectedCatalogSidebarId) {
      this.showToast('Selecciona una categoría primero');
      return;
    }
    if (this.isBotesMode) {
      const nextNum = this.rowData().reduce((max, r) => Math.max(max, r.boteNum ?? 0), 0) + 1;
      this.rowData.set([{
        id: null,
        type: 'MOLIENDA',
        cantidad: null,
        valor: true,
        idCatalog: this.selectedCatalogSidebarId,
        idMatPrima: null,
        idPrefijoFase: null,
        boteNum: nextNum,
        __isNew: true,
      }, ...this.rowData()]);
      this.hasUnsavedChanges = true;
      setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'cantidad' }), 0);
      return;
    }
    this.rowData.set([{
      id: null,
      type: 'MOLIENDA',
      idArticulo: null,
      editBultos: false,
      valor: false,
      molienda: false,
      prefijo: '',
      idCatalog: this.selectedCatalogSidebarId,
      __isNew: true
    }, ...this.rowData()]);
    this.hasUnsavedChanges = true;
    setTimeout(() => this.gridApi.startEditingCell({ rowIndex: 0, colKey: 'idArticulo' }), 0);
  }

  saveChanges() {
    if (!this.selectedCatalogSidebarId) {
      this.showToast('Selecciona una categoría primero');
      return;
    }
    const saves = this.rowData().filter(r => r.__isNew || r.__modified).map(r => {
      const payload = this.isBotesMode
        ? {
            idCompany: this.idRoot,
            idArticulo: null,
            cantidad: r.cantidad ?? 0,
            type: r.type,
            idCatalog: r.idCatalog || this.selectedCatalogSidebarId,
            active: r.valor,
            editBultos: false,
            molienda: false,
            idMatPrima: r.idMatPrima ?? null,
            idPrefijoFase: r.idPrefijoFase ?? null,
          }
        : {
            idCompany: this.idRoot,
            idArticulo: r.idArticulo,
            cantidad: 1,
            type: r.type,
            idCatalog: r.idCatalog || this.selectedCatalogSidebarId,
            active: r.valor,
            editBultos: r.editBultos || false,
            molienda: r.molienda || false,
            prefijo: r.prefijo ?? null,
          };
      return r.__isNew ? this.mxmService.create(payload) : this.mxmService.update(r.id, payload);
    });
    if (!saves.length) return;
    forkJoin(saves).subscribe(() => {
      this.hasUnsavedChanges = false;
      this.showToast('Guardado');
      if (this.selectedCatalogSidebarId) {
        this.loadCatalogData(this.selectedCatalogSidebarId);
      } else {
        this.loadGridData();
      }
    });
  }

  revertChanges() { this.rowData.set(JSON.parse(JSON.stringify(this.originalRowData))); this.hasUnsavedChanges = false; this.selectedRow = null; }

  deleteRow() {
    if (!this.selectedRow) return;
    if (!this.selectedCatalogSidebarId) {
      this.showToast('Selecciona una categoría primero');
      return;
    }
    if (this.isBotesMode && this.selectedRow.hasUsage) {
      this.showToast('Este bote tiene jugo asignado y no puede borrarse');
      return;
    }
    if (this.selectedRow.__isNew) {
      this.rowData.set(this.rowData().filter(r => r !== this.selectedRow)); this.selectedRow = null;
      this.hasUnsavedChanges = this.rowData().some(r => r.__isNew || r.__modified); return;
    }
    this.mxmService.delete(this.selectedRow.id).subscribe(() => {
      this.selectedRow = null;
      this.showToast('Borrado');
      this.loadCatalogData(this.selectedCatalogSidebarId);
    });
  }

  // ──────────────────── Preparación 1 ────────────────────

  onGridReady1(params: GridReadyEvent)      { this.gridApi1 = params.api; }
  onRowClicked1(event: any)                 { this.selectedRow1 = event.data; }
  onCellValueChanged1(event: any) {
    if (!event.data.__isNew) { event.data.__modified = true; this.hasUnsavedChanges1 = true; }
  }
  onCellEditingStopped1(event: any) {
    if (!this.enterPressed1) return;
    this.enterPressed1 = false;
    const idx = this.editableColumnOrder1.indexOf(event.column.getColId());
    if (idx !== -1 && idx < this.editableColumnOrder1.length - 1) {
      setTimeout(() => this.gridApi1.startEditingCell({ rowIndex: event.rowIndex, colKey: this.editableColumnOrder1[idx + 1] }), 100);
    }
  }

  private showToast1(msg: string) { this.toastMsg1.set(msg); setTimeout(() => this.toastMsg1.set(''), 1500); }

  private loadCatalogSidebar() {
    if (!this.idRoot) return;

    this.catalogService.getAll(this.idRoot).subscribe({
      next: (items) => {
        this.catalogSidebarItems = items ?? [];
        if (this.selectedCatalogSidebarId && !this.catalogSidebarItems.some(x => x.id === this.selectedCatalogSidebarId)) {
          this.selectedCatalogSidebarId = null;
        }
      },
      error: () => {
        this.catalogSidebarItems = [];
        this.selectedCatalogSidebarId = null;
      },
    });
  }

  trackByCatalogItem(index: number, item: ExtractionFermentationCatalogItem) {
    return item.id;
  }

  private getFamilyCountForCategory(categoryId: number | string): number {
    return this.hierarchicalData.filter(
      item => item.nodeLevel === 'family' && item.parentCategoryId === categoryId
    ).length;
  }

  private getSubfamilyCountForFamily(familyId: number | string): number {
    return this.hierarchicalData.filter(
      item => item.nodeLevel === 'subfamily' && item.parentFamilyId === familyId
    ).length;
  }

  refreshHierarchicalVisibleRows(): void {
    this.hierarchicalVisibleRows = this.hierarchicalData.filter(item => item.isVisible);
    if (this.hierarchicalGridApi) {
      this.hierarchicalGridApi.setGridOption('rowData', this.hierarchicalVisibleRows);
    }
  }

  private openMaterialsModalFrontMock(subfamilyData: any): void {
    void alerts.basicAlert(
      'Material Maestro',
      `Subfamilia «${subfamilyData.description}». Vista demo (solo frontend).`,
      'info'
    );
  }

  private buildHierarchicalColumnDefs(): ColDef[] {
    const self = this;
    return [
      {
        headerName: 'Categoría',
        field: 'categoryDisplay',
        width: 300,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'category') {
            const isExpanded = params.data.isExpanded || false;
            const chevron = isExpanded ? '▼' : '▶';
            const description = params.data.description;
            const hasCounter = description.includes('(') && description.includes(')');
            const displayText = hasCounter
              ? description
              : `${description} (${self.getFamilyCountForCategory(params.data.originalId)})`;
            return `<span class="chevron-icon" data-action="toggle" style="cursor:pointer;margin-right:5px;color:#2196f3;font-weight:bold;">${chevron}</span> ${displayText}`;
          }
          return '';
        },
        tooltipValueGetter: (params: any) => {
          if (params.data.nodeLevel === 'category') {
            const desc = params.data.valueAddition;
            const abbr = params.data.valueAddition2;
            if (!desc && !abbr) return null;
            let tooltip = `📁 ${params.data.description}\n\n`;
            if (desc) tooltip += `📝 Descripción: ${desc}\n`;
            if (abbr) tooltip += `🔤 Abreviatura: ${abbr}`;
            return tooltip;
          }
          return null;
        },
        onCellClicked: (event: any) => {
          if (self.isDoubleClicking) return;
          self.selectedColumnContext = 'category';
          const target = event.event?.target as HTMLElement;
          if (target?.classList.contains('chevron-icon') || target?.getAttribute?.('data-action') === 'toggle') {
            self.toggleCategoryExpansion(event.data);
          }
        },
      },
      {
        headerName: 'Familia',
        field: 'familyDisplay',
        width: 300,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'family') {
            const childCount = self.getSubfamilyCountForFamily(params.data.originalId);
            const isExpanded = params.data.isExpanded || false;
            const chevron = isExpanded ? '▼' : '▶';
            return `<span class="chevron-icon" data-action="toggle" style="cursor:pointer;margin-right:5px;color:#2196f3;font-weight:bold;">${chevron}</span> ${params.data.description} (${childCount})`;
          }
          return '';
        },
        tooltipValueGetter: (params: any) => {
          if (params.data.nodeLevel === 'family') {
            const desc = params.data.valueAddition;
            const abbr = params.data.valueAddition2;
            if (!desc && !abbr) return null;
            let tooltip = `📂 ${params.data.description}\n\n`;
            if (desc) tooltip += `📝 Descripción: ${desc}\n`;
            if (abbr) tooltip += `🔤 Abreviatura: ${abbr}`;
            return tooltip;
          }
          return null;
        },
        onCellClicked: (event: any) => {
          if (self.isDoubleClicking) return;
          self.selectedColumnContext = 'family';
          const target = event.event?.target as HTMLElement;
          if (target?.classList.contains('chevron-icon') || target?.getAttribute?.('data-action') === 'toggle') {
            self.toggleFamilyExpansion(event.data);
          }
        },
      },
      {
        headerName: 'Sub Familia',
        field: 'subfamilyDisplay',
        hide: true,
        width: 300,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'subfamily') {
            return `<span style="margin-right:15px;"></span> ${params.data.description}`;
          }
          return '';
        },
        tooltipValueGetter: (params: any) => {
          if (params.data.nodeLevel === 'subfamily') {
            const desc = params.data.valueAddition;
            const abbr = params.data.valueAddition2;
            if (!desc && !abbr) return null;
            let tooltip = `📄 ${params.data.description}\n\n`;
            if (desc) tooltip += `📝 Descripción: ${desc}\n`;
            if (abbr) tooltip += `🔤 Abreviatura: ${abbr}`;
            return tooltip;
          }
          return null;
        },
        onCellClicked: () => {
          if (self.isDoubleClicking) return;
          self.selectedColumnContext = 'subfamily';
        },
      },
      {
        headerName: 'Material Maestro',
        field: 'valueAdditionBit',
        hide: true,
        width: 210,
        editable: true,
        onCellClicked: (params: any) => {
          if (params.data.nodeLevel === 'subfamily') {
            self.openMaterialsModalFrontMock(params.data);
          }
        },
      },
      {
        headerName: 'Requisiciones',
        field: 'valueAdditionBit2',
        hide: true,
        width: 120,
        cellRenderer: (params: any) => {
          if (params.data.nodeLevel === 'subfamily') {
            const value = params.data.valueAdditionBit2 || false;
            const checked = value ? 'checked' : '';
            return `<input type="checkbox" ${checked} disabled style="cursor:pointer;">`;
          }
          return '';
        },
      },
      {
        headerName: 'Activo',
        field: 'vigente',
        width: 100,
        editable: true,
        cellRenderer: 'agCheckboxCellRenderer',
      },
    ];
  }

  toggleCategoryExpansion(categoryData: any) {
    const category = this.hierarchicalData.find(item =>
      item.nodeLevel === 'category' && item.originalId === categoryData.originalId
    );

    if (category) {
      category.isExpanded = !category.isExpanded;

      this.hierarchicalData.forEach(item => {
        if (item.nodeLevel === 'family' && item.parentCategoryId === category.originalId) {
          item.isVisible = category.isExpanded;

          if (!category.isExpanded) {
            this.hierarchicalData.forEach(subItem => {
              if (subItem.nodeLevel === 'subfamily' && subItem.parentFamilyId === item.originalId) {
                subItem.isVisible = false;
              }
            });
          } else {
            if (item.isExpanded) {
              this.hierarchicalData.forEach(subItem => {
                if (subItem.nodeLevel === 'subfamily' && subItem.parentFamilyId === item.originalId) {
                  subItem.isVisible = true;
                }
              });
            }
          }
        }
      });

      this.refreshHierarchicalVisibleRows();
    }
  }

  toggleFamilyExpansion(familyData: any) {
    const family = this.hierarchicalData.find(item =>
      item.nodeLevel === 'family' && item.originalId === familyData.originalId
    );

    if (family) {
      family.isExpanded = !family.isExpanded;

      this.hierarchicalData.forEach(item => {
        if (item.nodeLevel === 'subfamily' && item.parentFamilyId === family.originalId) {
          item.isVisible = family.isExpanded;
        }
      });

      this.refreshHierarchicalVisibleRows();
    }
  }

  onHierarchicalGridReady(params: GridReadyEvent) {
    this.hierarchicalGridApi = params.api;
    this.refreshHierarchicalVisibleRows();
  }

  onHierarchicalCellDoubleClicked(event: any) {
    if (event.data) {
      this.isDoubleClicking = true;
      this.openHierarchicalEditModal(event.data);
      setTimeout(() => { this.isDoubleClicking = false; }, 300);
    }
  }

  onHierarchicalCellValueChanged(event: any) {
    if (event.colDef.field === 'valueAdditionBit') {
      const row = this.hierarchicalData.find(n => n.originalId === event.data.originalId);
      if (row) row.valueAdditionBit = !!event.newValue;
      return;
    }

    if (event.colDef.field !== 'vigente') return;

    const newValue = event.newValue;
    const nodeLevel = event.data.nodeLevel;
    const H = this.hierarchicalData;

    if (nodeLevel === 'category' && newValue === false) {
      const categoryId = event.data.originalId;
      H.forEach(node => {
        if (node.nodeLevel === 'family' && node.parentCategoryId === categoryId) {
          node.vigente = false;
          const familyId = node.originalId;
          H.forEach(subNode => {
            if (subNode.nodeLevel === 'subfamily' && subNode.parentFamilyId === familyId) {
              subNode.vigente = false;
            }
          });
        }
      });
    }

    if (nodeLevel === 'family' && newValue === false) {
      const familyId = event.data.originalId;
      H.forEach(node => {
        if (node.nodeLevel === 'subfamily' && node.parentFamilyId === familyId) {
          node.vigente = false;
        }
      });
    }

    if (nodeLevel === 'category' && newValue === true) {
      const categoryId = event.data.originalId;
      H.forEach(node => {
        if (node.nodeLevel === 'family' && node.parentCategoryId === categoryId) {
          node.vigente = true;
          const familyId = node.originalId;
          H.forEach(subNode => {
            if (subNode.nodeLevel === 'subfamily' && subNode.parentFamilyId === familyId) {
              subNode.vigente = true;
            }
          });
        }
      });
    }

    if (nodeLevel === 'family' && newValue === true) {
      const familyId = event.data.originalId;
      const categoryId = event.data.parentCategoryId;
      H.forEach(node => {
        if (node.nodeLevel === 'category' && node.originalId === categoryId) node.vigente = true;
      });
      H.forEach(node => {
        if (node.nodeLevel === 'subfamily' && node.parentFamilyId === familyId) node.vigente = true;
      });
    }

    if (nodeLevel === 'subfamily') {
      const familyId = event.data.parentFamilyId;
      const allSubfamilies = H.filter(
        node => node.nodeLevel === 'subfamily' && node.parentFamilyId === familyId
      );
      const activeCount = allSubfamilies.filter(sf => sf.vigente === true).length;
      const totalCount = allSubfamilies.length;
      const familyNode = H.find(
        node => node.nodeLevel === 'family' && node.originalId === familyId
      );
      if (familyNode) {
        const categoryId = familyNode.parentCategoryId;
        if (activeCount === totalCount && newValue === true) {
          if (!familyNode.vigente) familyNode.vigente = true;
          const allFamilies = H.filter(
            node => node.nodeLevel === 'family' && node.parentCategoryId === categoryId
          );
          const activeFamilies = allFamilies.filter(f => f.vigente === true).length;
          if (activeFamilies === allFamilies.length) {
            H.forEach(node => {
              if (node.nodeLevel === 'category' && node.originalId === categoryId && !node.vigente) {
                node.vigente = true;
              }
            });
          }
        }
        if (activeCount === 0 && newValue === false) {
          if (familyNode.vigente) familyNode.vigente = false;
          const allFamilies = H.filter(
            node => node.nodeLevel === 'family' && node.parentCategoryId === categoryId
          );
          const inactiveFamilies = allFamilies.filter(f => f.vigente === false).length;
          if (inactiveFamilies === allFamilies.length) {
            H.forEach(node => {
              if (node.nodeLevel === 'category' && node.originalId === categoryId && node.vigente) {
                node.vigente = false;
              }
            });
          }
        }
      }
    }

    if (nodeLevel === 'family') {
      const categoryId = event.data.parentCategoryId;
      const allFamilies = H.filter(
        node => node.nodeLevel === 'family' && node.parentCategoryId === categoryId
      );
      const activeCount = allFamilies.filter(f => f.vigente === true).length;
      const totalCount = allFamilies.length;
      if (activeCount === totalCount && newValue === true) {
        H.forEach(node => {
          if (node.nodeLevel === 'category' && node.originalId === categoryId && !node.vigente) {
            node.vigente = true;
          }
        });
      }
      if (activeCount === 0 && newValue === false) {
        H.forEach(node => {
          if (node.nodeLevel === 'category' && node.originalId === categoryId && node.vigente) {
            node.vigente = false;
          }
        });
      }
    }

    // Marcar todas las filas afectadas como modificadas
    this.hierarchicalData.forEach(n => { if (n.__touched) n.__modified = true; });
    event.data.__modified = true;
    this.hasUnsavedChangesHier = true;

    if (this.hierarchicalGridApi) {
      this.hierarchicalGridApi.refreshCells({ force: true });
    }
  }

  async saveHierarchicalChanges() {
    const modified = this.hierarchicalData.filter(n => n.__modified && n.originalId);
    if (modified.length === 0) return;

    try {
      await Promise.all(modified.map(node => {
        const payload: CatalogProductionItem = {
          description: node.description,
          type: node.type,
          parentId: node.parentCategoryId ?? node.parentFamilyId ?? null,
          valueAddition: node.valueAddition ?? null,
          valueAddition2: node.valueAddition2 ?? null,
          valueAdditionBit: node.valueAdditionBit ?? null,
          valueAdditionBit2: node.valueAdditionBit2 ?? null,
          vigente: node.vigente ?? null,
          active: node.active ?? 1,
        };
        return lastValueFrom(this.hierService.update(node.originalId, payload));
      }));

      this.hierarchicalData.forEach(n => { n.__modified = false; });
      this.hasUnsavedChangesHier = false;
      alerts.basicAlert('Éxito', 'Cambios guardados.', 'success');
    } catch (err) {
      console.error('Error guardando cambios jerárquicos:', err);
      alerts.basicAlert('Error', 'No se pudieron guardar los cambios.', 'error');
    }
  }

  addHierarchicalCatalogItem() {
    if (!this.selectedHierarchicalRow) {
      this.openAddCategoryModalHier();
      return;
    }
    if (this.selectedColumnContext === 'family' && this.selectedHierarchicalNodeLevel === 'category') {
      this.openAddFamilyModalHier();
      return;
    }
    if (this.selectedColumnContext === 'subfamily' && this.selectedHierarchicalNodeLevel === 'family') {
      this.openAddSubfamilyModalHier();
      return;
    }
    switch (this.selectedHierarchicalNodeLevel) {
      case 'category':
        this.openAddCategoryModalHier();
        break;
      case 'family':
        this.openAddFamilyModalHier();
        break;
      case 'subfamily':
        this.openAddSubfamilyModalHier();
        break;
      default:
        this.openAddCategoryModalHier();
    }
  }

  // Métodos para modales jerárquicos
  openAddCategoryModalHier() {
    this.resetHierarchicalModalForm();
    this.showAddCategoryModal = true;
  }

  openAddFamilyModalHier() {
    this.resetHierarchicalModalForm();
    this.showAddFamilyModal = true;
  }

  openAddSubfamilyModalHier() {
    this.resetHierarchicalModalForm();
    this.showAddSubfamilyModal = true;
  }

  openHierarchicalEditModal(item: any) {
    this.editingItem = { ...item };
    this.modalForm.description = item.description || '';
    this.modalForm.valueAddition = item.valueAddition || '';
    this.modalForm.valueAddition2 = item.valueAddition2 || '';
    this.modalForm.active = item.active === 1;
    this.modalForm.valueAdditionBit = !!item.valueAdditionBit;
    this.modalForm.valueAdditionBit2 = !!item.valueAdditionBit2;
    this.showEditModal = true;
  }

  closeHierarchicalModals() {
    this.showAddCategoryModal = false;
    this.showAddFamilyModal = false;
    this.showAddSubfamilyModal = false;
    this.showEditModal = false;
    this.resetHierarchicalModalForm();
    this.editingItem = null;
  }

  private resetHierarchicalModalForm() {
    this.modalForm = {
      description: '',
      valueAddition: '',
      valueAddition2: '',
      active: true,
      valueAdditionBit: false,
      valueAdditionBit2: false,
    };
  }

  private deleteHierarchicalNodeLocal(row: any): void {
    const id = row.originalId;
    if (row.nodeLevel === 'category') {
      const famIds = this.hierarchicalData
        .filter(f => f.nodeLevel === 'family' && f.parentCategoryId === id)
        .map(f => f.originalId);
      this.hierarchicalData = this.hierarchicalData.filter(n => {
        if (n.nodeLevel === 'category' && n.originalId === id) return false;
        if (n.nodeLevel === 'family' && n.parentCategoryId === id) return false;
        if (n.nodeLevel === 'subfamily' && famIds.includes(n.parentFamilyId)) return false;
        return true;
      });
    } else if (row.nodeLevel === 'family') {
      this.hierarchicalData = this.hierarchicalData.filter(n => {
        if (n.nodeLevel === 'family' && n.originalId === id) return false;
        if (n.nodeLevel === 'subfamily' && n.parentFamilyId === id) return false;
        return true;
      });
    } else {
      this.hierarchicalData = this.hierarchicalData.filter(
        n => !(n.nodeLevel === 'subfamily' && n.originalId === id)
      );
    }
  }

  async saveNewHierarchicalCategory() {
    if (!this.modalForm.description.trim()) {
      await alerts.basicAlert('Validación', 'El nombre es obligatorio.', 'warning');
      return;
    }
    if (!this.selectedCatalogSidebarId) {
      await alerts.basicAlert('Validación', 'Seleccione un catálogo.', 'warning');
      return;
    }

    const payload: CatalogProductionItem = {
      idCompany: this.idRoot,
      idMasterCatalog: this.selectedCatalogSidebarId,
      description: this.modalForm.description.trim().toUpperCase(),
      type: 'CATEGORY',
      parentId: null,
      subParentId: null,
      valueAddition: (this.modalForm.valueAddition || '').trim() || 'NA',
      valueAddition2: (this.modalForm.valueAddition2 || '').trim() || 'NA',
      valueAdditionBit: false,
      valueAdditionBit2: false,
      vigente: true,
      price: 0,
      active: this.modalForm.active ? 1 : 0,
    };

    try {
      await lastValueFrom(this.hierService.create(payload));
      this.closeHierarchicalModals();
      this.loadHierarchicalData();
      await alerts.basicAlert('Éxito', 'Categoría creada.', 'success');
    } catch (err) {
      console.error('Error creating category:', err);
      await alerts.basicAlert('Error', 'No se pudo crear la categoría.', 'error');
    }
  }

  async saveNewHierarchicalFamily() {
    if (!this.modalForm.description.trim()) {
      await alerts.basicAlert('Validación', 'El nombre es obligatorio.', 'warning');
      return;
    }
    if (!this.selectedCatalogSidebarId) {
      await alerts.basicAlert('Validación', 'Seleccione un catálogo.', 'warning');
      return;
    }

    let parentId: number;
    if (this.selectedHierarchicalNodeLevel === 'category') {
      parentId = this.selectedHierarchicalRow.id || this.selectedHierarchicalRow.originalId;
    } else if (this.selectedHierarchicalNodeLevel === 'family') {
      parentId = this.selectedHierarchicalRow.parentId;
    } else {
      await alerts.basicAlert('Validación', 'Seleccione una categoría o familia en el grid.', 'warning');
      return;
    }

    const payload: CatalogProductionItem = {
      idCompany: this.idRoot,
      idMasterCatalog: this.selectedCatalogSidebarId,
      description: this.modalForm.description.trim().toUpperCase(),
      type: 'FAM-CAT',
      parentId: parentId,
      subParentId: null,
      valueAddition: (this.modalForm.valueAddition || '').trim() || 'NA',
      valueAddition2: (this.modalForm.valueAddition2 || '').trim() || 'NA',
      valueAdditionBit: false,
      valueAdditionBit2: false,
      vigente: true,
      price: 0,
      active: this.modalForm.active ? 1 : 0,
    };

    try {
      await lastValueFrom(this.hierService.create(payload));
      this.closeHierarchicalModals();
      this.loadHierarchicalData();
      await alerts.basicAlert('Éxito', 'Familia creada.', 'success');
    } catch (err) {
      console.error('Error creating family:', err);
      await alerts.basicAlert('Error', 'No se pudo crear la familia.', 'error');
    }
  }

  async saveNewHierarchicalSubfamily() {
    if (!this.modalForm.description.trim()) {
      await alerts.basicAlert('Validación', 'El nombre es obligatorio.', 'warning');
      return;
    }
    if (!this.selectedCatalogSidebarId) {
      await alerts.basicAlert('Validación', 'Seleccione un catálogo.', 'warning');
      return;
    }

    let parentId: number;
    let subParentId: number;

    if (this.selectedHierarchicalNodeLevel === 'family') {
      parentId = this.selectedHierarchicalRow.parentId;
      subParentId = this.selectedHierarchicalRow.id || this.selectedHierarchicalRow.originalId;
    } else if (this.selectedHierarchicalNodeLevel === 'subfamily') {
      parentId = this.selectedHierarchicalRow.parentId;
      subParentId = this.selectedHierarchicalRow.subParentId;
    } else {
      await alerts.basicAlert('Validación', 'Seleccione una familia o subfamilia en el grid.', 'warning');
      return;
    }

    const payload: CatalogProductionItem = {
      idCompany: this.idRoot,
      idMasterCatalog: this.selectedCatalogSidebarId,
      description: this.modalForm.description.trim().toUpperCase(),
      type: 'SUB-FAM',
      parentId: parentId,
      subParentId: subParentId,
      valueAddition: (this.modalForm.valueAddition || '').trim() || 'NA',
      valueAddition2: (this.modalForm.valueAddition2 || '').trim() || 'NA',
      valueAdditionBit: this.modalForm.valueAdditionBit,
      valueAdditionBit2: this.modalForm.valueAdditionBit2,
      vigente: true,
      price: 0,
      active: this.modalForm.active ? 1 : 0,
    };

    try {
      await lastValueFrom(this.hierService.create(payload));
      this.closeHierarchicalModals();
      this.loadHierarchicalData();
      await alerts.basicAlert('Éxito', 'Subfamilia creada.', 'success');
    } catch (err) {
      console.error('Error creating subfamily:', err);
      await alerts.basicAlert('Error', 'No se pudo crear la subfamilia.', 'error');
    }
  }

  async saveHierarchicalEditChanges() {
    if (!this.modalForm.description.trim()) {
      await alerts.basicAlert('Validación', 'El nombre es obligatorio.', 'warning');
      return;
    }

    const payload: CatalogProductionItem = {
      description: this.modalForm.description.trim().toUpperCase(),
      valueAddition: (this.modalForm.valueAddition || '').trim() || 'NA',
      valueAddition2: (this.modalForm.valueAddition2 || '').trim() || 'NA',
      valueAdditionBit: this.modalForm.valueAdditionBit,
      valueAdditionBit2: this.modalForm.valueAdditionBit2,
      active: this.modalForm.active ? 1 : 0,
    };

    const itemId = this.editingItem.id || this.editingItem.originalId;

    const row = this.hierarchicalData.find(n => n.originalId === itemId);
    if (row) {
      row.description = payload.description;
      row.valueAddition = payload.valueAddition;
      row.valueAddition2 = payload.valueAddition2;
      row.valueAdditionBit = payload.valueAdditionBit;
      row.valueAdditionBit2 = payload.valueAdditionBit2;
      row.active = payload.active;
    }

    this.refreshHierarchicalVisibleRows();
    this.closeHierarchicalModals();
    alerts.basicAlert('Éxito', 'Registro actualizado.', 'success');

    this.hierService.update(itemId, payload).subscribe({
      error: (err) => {
        console.error('Error updating item:', err);
        this.loadHierarchicalData();
        alerts.basicAlert('Error', 'No se pudo actualizar el registro.', 'error');
      }
    });
  }

  async deleteHierarchicalItem() {
    if (!this.selectedHierarchicalRow) {
      await alerts.basicAlert('Eliminar', 'Seleccione un elemento en el grid.', 'warning');
      return;
    }

    const r = await alerts.confirmAlert(
      'Confirmar eliminación',
      `¿Eliminar «${this.selectedHierarchicalRow.description}»?`,
      'warning',
      'Sí, eliminar'
    );
    if (!r.isConfirmed) return;

    const itemId = this.selectedHierarchicalRow.id || this.selectedHierarchicalRow.originalId;
    const row = this.selectedHierarchicalRow;

    this.deleteHierarchicalNodeLocal(row);
    this.refreshHierarchicalVisibleRows();
    this.selectedHierarchicalRow = null;
    this.selectedHierarchicalNodeLevel = null;
    alerts.basicAlert('Listo', 'Elemento eliminado.', 'success');

    this.hierService.delete(itemId).subscribe({
      error: (err) => {
        console.error('Error deleting item:', err);
        this.loadHierarchicalData();
        alerts.basicAlert('Error', 'No se pudo eliminar el registro.', 'error');
      }
    });
  }

  // ──────────────────── Prefijos Fases ────────────────────

  selectPrefijoFase() {
    this.selectedCatalogSidebarId = null;
    this.showHierarchicalTable    = false;
    this.isBotesMode              = false;
    this.prefijoFaseMode          = true;
    this.prefijoFaseSelectedRow   = null;
    this.prefijoFaseHasChanges    = false;
    this.loadPrefijoFases();
  }

  private loadPrefijoFases() {
    if (!this.idRoot) return;
    this.productionService.getMoliendaPrefijos(this.idRoot).subscribe((data: any[]) => {
      const rows = (data ?? []).map(p => ({
        id: p.id, nombreFase: p.nombreFase, prefijo: p.prefijo, active: p.active,
        __isNew: false, __modified: false,
      }));
      this.prefijoFaseOriginal = JSON.parse(JSON.stringify(rows));
      this.prefijoFaseRows     = rows;
      if (this.prefijoFaseGridApi && !this.prefijoFaseGridApi.isDestroyed())
        this.prefijoFaseGridApi.setGridOption('rowData', rows);
    });
  }

  onPrefijoFaseGridReady(params: GridReadyEvent) {
    this.prefijoFaseGridApi = params.api;
  }

  addPrefijoFase() {
    const newRow = { id: null, __tempId: `pf_${Date.now()}`, __isNew: true, nombreFase: '', prefijo: '', active: true };
    this.prefijoFaseRows = [newRow, ...this.prefijoFaseRows];
    this.prefijoFaseHasChanges = true;
    if (this.prefijoFaseGridApi && !this.prefijoFaseGridApi.isDestroyed()) {
      this.prefijoFaseGridApi.setGridOption('rowData', this.prefijoFaseRows);
      setTimeout(() => this.prefijoFaseGridApi.startEditingCell({ rowIndex: 0, colKey: 'nombreFase' }), 0);
    }
  }

  async savePrefijoFases() {
    const news  = this.prefijoFaseRows.filter(r => r.__isNew);
    const mods  = this.prefijoFaseRows.filter(r => r.__modified && !r.__isNew);

    try {
      for (const r of news) {
        const created = await lastValueFrom(this.productionService.createMoliendaPrefijo({
          idCompany: this.idRoot, nombreFase: r.nombreFase, prefijo: r.prefijo, active: r.active,
        }));
        r.id = created.id; r.__isNew = false;
      }
      for (const r of mods) {
        await lastValueFrom(this.productionService.updateMoliendaPrefijo(r.id, {
          nombreFase: r.nombreFase, prefijo: r.prefijo, active: r.active,
        }));
        r.__modified = false;
      }
      this.prefijoFaseOriginal   = JSON.parse(JSON.stringify(this.prefijoFaseRows));
      this.prefijoFaseHasChanges = false;
      this.showToast('Guardado');
    } catch { this.showToast('Error al guardar'); }
  }

  revertPrefijoFases() {
    this.prefijoFaseRows       = JSON.parse(JSON.stringify(this.prefijoFaseOriginal));
    this.prefijoFaseHasChanges = false;
    this.prefijoFaseSelectedRow = null;
    if (this.prefijoFaseGridApi && !this.prefijoFaseGridApi.isDestroyed())
      this.prefijoFaseGridApi.setGridOption('rowData', this.prefijoFaseRows);
  }

  async deletePrefijoFase() {
    if (!this.prefijoFaseSelectedRow) return;
    const row = this.prefijoFaseSelectedRow;
    if (row.__isNew) {
      this.prefijoFaseRows = this.prefijoFaseRows.filter(r => r !== row);
      this.prefijoFaseSelectedRow = null;
      this.prefijoFaseHasChanges = this.prefijoFaseRows.some(r => r.__isNew || r.__modified);
      if (this.prefijoFaseGridApi && !this.prefijoFaseGridApi.isDestroyed())
        this.prefijoFaseGridApi.setGridOption('rowData', this.prefijoFaseRows);
      return;
    }
    try {
      await lastValueFrom(this.productionService.deleteMoliendaPrefijo(row.id));
      this.prefijoFaseRows = this.prefijoFaseRows.filter(r => r !== row);
      this.prefijoFaseOriginal = this.prefijoFaseOriginal.filter(r => r.id !== row.id);
      this.prefijoFaseSelectedRow = null;
      if (this.prefijoFaseGridApi && !this.prefijoFaseGridApi.isDestroyed())
        this.prefijoFaseGridApi.setGridOption('rowData', this.prefijoFaseRows);
    } catch { this.showToast('Error al eliminar'); }
  }

  onSelectCatalogSidebar(item: ExtractionFermentationCatalogItem) {
    this.selectedCatalogSidebarId = item.id;
    this.prefijoFaseMode = false;
    if (this.isCaracteristicasManzana(item)) {
      this.showHierarchicalTable = true;
      this.isBotesMode = false;
      this.loadHierarchicalData();
    } else {
      this.showHierarchicalTable = false;
      this.isBotesMode = this.isBotesCatalog(item);
      this.loadCatalogData(item.id);
    }
  }

  private isCaracteristicasManzana(item: ExtractionFermentationCatalogItem): boolean {
    const raw = (item.description || '').trim().toLowerCase();
    const d = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return d.startsWith('caracteristicas de');
  }

  private isBotesCatalog(item: ExtractionFermentationCatalogItem): boolean {
    const raw = (item.description || '').trim().toLowerCase();
    const d = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return d.startsWith('botes');
  }

  onDoubleclickCatalogItem(item: ExtractionFermentationCatalogItem, event: Event) {
    event.stopPropagation();
    this.editingCatalogId = item.id;
    this.editingCatalogDescription = item.description;
  }

  saveCatalogEdit() {
    if (!this.editingCatalogId || !this.editingCatalogDescription.trim()) {
      this.showToast('El nombre no puede estar vacío');
      return;
    }
    this.catalogService.update(this.editingCatalogId, { description: this.editingCatalogDescription }).subscribe(() => {
      this.showToast('Categoría actualizada');
      this.editingCatalogId = null;
      this.editingCatalogDescription = '';
      this.loadCatalogSidebar();
    });
  }

  cancelCatalogEdit() {
    this.editingCatalogId = null;
    this.editingCatalogDescription = '';
  }

  private loadCatalogData(idCatalog: number) {
    if (!this.idRoot) return;
    forkJoin({
      data:  this.mxmService.getByCatalog(this.idRoot, idCatalog),
      usage: this.isBotesMode ? this.productionService.getMoliendaBoteUsage() : of({}),
    }).subscribe(({ data, usage }: any) => {
      const usageMap: Record<number, number> = usage ?? {};
      let rows: any[];
      if (this.isBotesMode) {
        rows = (data ?? []).map((m: any) => ({
          id: m.id,
          type: m.type,
          cantidad: m.cantidad,
          valor: m.active,
          idCatalog: m.idCatalog,
          idMatPrima: m.idMatPrima ?? null,
          idPrefijoFase: m.idPrefijoFase ?? null,
          hasUsage: (usageMap[m.id] ?? 0) > 0,
        }));
        rows.sort((a: any, b: any) => {
          const faseA = this.prefijoFaseOptions.find((f: any) => f.id === a.idPrefijoFase)?.nombreFase ?? '';
          const faseB = this.prefijoFaseOptions.find((f: any) => f.id === b.idPrefijoFase)?.nombreFase ?? '';
          const cmpFase = faseA.localeCompare(faseB, 'es', { sensitivity: 'base' });
          if (cmpFase !== 0) return cmpFase;
          const matA = this.matPrimaOptions.find((m: any) => m.id === a.idMatPrima)?.description ?? '';
          const matB = this.matPrimaOptions.find((m: any) => m.id === b.idMatPrima)?.description ?? '';
          return matA.localeCompare(matB, 'es', { sensitivity: 'base' });
        });
        rows.forEach((r: any, i: number) => { r.boteNum = i + 1; });

        // Calcular prefixNum: numeración secuencial por grupo de prefijo
        const groupCounters = new Map<string, number>();
        rows.forEach((r: any) => {
          const fp = r.idPrefijoFase != null ? (this.prefijoFaseOptions.find((f: any) => f.id === r.idPrefijoFase)?.prefijo ?? '') : '';
          const ap = r.idMatPrima   != null ? (this.matPrimaOptions.find((m: any) => m.id === r.idMatPrima)?.prefijo ?? '') : '';
          const key = `${fp}${ap}`;
          const n = (groupCounters.get(key) ?? 0) + 1;
          groupCounters.set(key, n);
          r.prefixNum = n;
        });
      } else {
        rows = (data ?? []).map(m => ({
          id: m.id,
          type: m.type,
          idArticulo: m.idArticulo,
          valor: m.active,
          idCatalog: m.idCatalog,
          editBultos: m.editBultos,
          molienda: m.molienda ?? false,
          prefijo: m.prefijo ?? '',
        }));
        rows.sort((a: any, b: any) =>
          (this.materialesIdToDesc.get(a.idArticulo) ?? '').localeCompare(
            this.materialesIdToDesc.get(b.idArticulo) ?? '', 'es', { sensitivity: 'base' }));
      }
      this.originalRowData = JSON.parse(JSON.stringify(rows));
      this.rowData.set(rows);
      this.hasUnsavedChanges = false;
      this.selectedRow = null;
    });
  }

  private loadHierarchicalData() {
    if (!this.idRoot) return;
    // console.log(this.selectedCatalogSidebarId);
    this.hierService.getAll(this.idRoot, this.selectedCatalogSidebarId).subscribe({
      next: (items: CatalogProductionItem[]) => {
        const categories = items.filter(i => i.type === 'CATEGORY');
        const families = items.filter(i => i.type === 'FAM-CAT');
        const subfamilies = items.filter(i => i.type === 'SUB-FAM');
        //console.log(items);

        this.buildHierarchicalStructure(categories, families, subfamilies);

        const maxId = this.hierarchicalData.reduce(
          (m, n) => Math.max(m, Number(n.originalId) || 0),
          0
        );
        this.hierarchicalNextTempId = Math.max(this.hierarchicalNextTempId, maxId + 1);
        this.selectedHierarchicalRow = null;
        this.selectedHierarchicalNodeLevel = null;
        this.selectedColumnContext = null;
        this.refreshHierarchicalVisibleRows();
      },
      error: (err) => {
        console.error('Error loading hierarchical data:', err);
        this.hierarchicalData = [];
        this.hierarchicalVisibleRows = [];
      }
    });
  }

  /** Datos demo en frontend (misma forma que API Catalog): categoría → familia → subfamilia */
  private buildAppleCharacteristicsSeed(): { categories: any[]; families: any[]; subfamilies: any[] } {
    const idCo = this.idRoot || 1;
    const specs = [
      { name: 'ACTIVO FIJO', famCount: 6 },
      { name: 'COSTOS DIRECTOS DE FABRICACION', famCount: 1 },
      { name: 'COSTOS INDIRECTOS DE FABRICACION', famCount: 4 },
      { name: 'GASTOS FINANCIEROS', famCount: 3 },
      { name: 'MATERIA PRIMA', famCount: 4 },
    ];
    let cid = 310000;
    let fid = 320000;
    let sid = 330000;
    const categories: any[] = [];
    const families: any[] = [];
    const subfamilies: any[] = [];

    for (const spec of specs) {
      const catId = cid++;
      categories.push({
        id: catId,
        idCompany: idCo,
        description: spec.name,
        type: 'CATEGORY',
        parentId: 0,
        subParentId: 0,
        vigente: true,
        active: 1,
        price: 0,
        valueAddition: '',
        valueAddition2: '',
        valueAdditionBit: false,
        valueAdditionBit2: false,
      });

      for (let i = 0; i < spec.famCount; i++) {
        const famId = fid++;
        families.push({
          id: famId,
          idCompany: idCo,
          description: `GRUPO ${i + 1}`,
          type: 'FAM-CAT',
          parentId: catId,
          subParentId: 0,
          vigente: true,
          active: 1,
          price: 0,
          valueAddition: '',
          valueAddition2: '',
          valueAdditionBit: false,
          valueAdditionBit2: false,
        });

        if (i === 0) {
          subfamilies.push({
            id: sid++,
            idCompany: idCo,
            description: 'DETALLE 1',
            type: 'SUB-FAM',
            parentId: catId,
            subParentId: famId,
            vigente: true,
            active: 1,
            price: 0,
            valueAddition: '',
            valueAddition2: '',
            valueAdditionBit: spec.name === 'MATERIA PRIMA',
            valueAdditionBit2: true,
          });
        }
      }
    }

    return { categories, families, subfamilies };
  }

  private buildHierarchicalStructure(categories: any[], families: any[], subfamilies: any[]) {
    const treeData: any[] = [];
    const nameCollator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
    const byDescription = (a: { description?: string }, b: { description?: string }) =>
      nameCollator.compare(String(a.description ?? ''), String(b.description ?? ''));

    const sortedCategories = [...categories].sort(byDescription);

    sortedCategories.forEach(category => {
      const categoryNode = {
        ...category,
        nodeLevel: 'category',
        originalId: category.id,
        isExpanded: false,
        isVisible: true,
        vigente: category.vigente !== false,
      };
      treeData.push(categoryNode);

      const categoryFamilies = [...families.filter(f => f.parentId === category.id)].sort(byDescription);
      categoryFamilies.forEach(family => {
        const familyNode = {
          ...family,
          nodeLevel: 'family',
          originalId: family.id,
          parentCategoryId: category.id,
          isExpanded: false,
          isVisible: false,
          vigente: family.vigente !== false,
        };
        treeData.push(familyNode);

        const familySubfamilies = [...subfamilies.filter(sf => sf.subParentId === family.id)].sort(byDescription);
        familySubfamilies.forEach(subfamily => {
          const subfamilyNode = {
            ...subfamily,
            nodeLevel: 'subfamily',
            originalId: subfamily.id,
            parentCategoryId: category.id,
            parentFamilyId: family.id,
            isVisible: false,
            vigente: subfamily.vigente !== false,
          };
          treeData.push(subfamilyNode);
        });
      });
    });

    this.hierarchicalData = treeData;
  }

  onTypeChange1(type: string) {
    this.selectedType1 = type; this.hasUnsavedChanges1 = false; this.selectedRow1 = null; this.rowData1.set([]);
    if (!type || !this.idRoot) return;
    this.loadGridData1(type);
  }

  loadGridData1(type: string) {
    this.mxmService.getByType(this.idRoot, type).subscribe((modulos: any[]) => {
      const rows = (modulos ?? []).map(m => ({ id: m.id, idArticulo: m.idArticulo, valor: m.active }));
      this.originalRowData1 = JSON.parse(JSON.stringify(rows));
      this.rowData1.set(rows);
    });
  }

  add1() {
    this.rowData1.set([{ id: null, idArticulo: null, valor: false, __isNew: true }, ...this.rowData1()]);
    this.hasUnsavedChanges1 = true;
    setTimeout(() => this.gridApi1.startEditingCell({ rowIndex: 0, colKey: 'idArticulo' }), 0);
  }

  saveChanges1() {
    const saves = this.rowData1().filter(r => r.__isNew || r.__modified).map(r => {
      const payload = { idCompany: this.idRoot, idArticulo: r.idArticulo, cantidad: 1, type: this.selectedType1, active: r.valor };
      return r.__isNew ? this.mxmService.create(payload) : this.mxmService.update(r.id, payload);
    });
    if (!saves.length) return;
    forkJoin(saves).subscribe(() => { this.hasUnsavedChanges1 = false; this.showToast1('Guardado'); this.loadGridData1(this.selectedType1); });
  }

  revertChanges1() { this.rowData1.set(JSON.parse(JSON.stringify(this.originalRowData1))); this.hasUnsavedChanges1 = false; this.selectedRow1 = null; }

  deleteRow1() {
    if (!this.selectedRow1) return;
    if (this.selectedRow1.__isNew) {
      this.rowData1.set(this.rowData1().filter(r => r !== this.selectedRow1)); this.selectedRow1 = null;
      this.hasUnsavedChanges1 = this.rowData1().some(r => r.__isNew || r.__modified); return;
    }
    this.mxmService.delete(this.selectedRow1.id).subscribe(() => { this.selectedRow1 = null; this.showToast1('Borrado'); this.loadGridData1(this.selectedType1); });
  }
}
