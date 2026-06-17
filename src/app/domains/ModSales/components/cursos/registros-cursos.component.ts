import { Component, OnInit, inject, effect, OnDestroy, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { CursosService, Curso, RegistroCurso } from 'app/services/cursos.service';
import { SignalsService } from 'app/services/signals.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-registros-cursos',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  template: `
    <section class="col-12 mt-2">
      <div class="row">

        <!-- Botonera lateral -->
        <div class="col-auto">
          <div class="d-flex flex-column gap-1">
            <button class="btn btn-outline-success" (click)="exportar()" [disabled]="!rowData.length" title="Exportar CSV">
              <i class="bi bi-file-earmark-excel"></i>
            </button>
          </div>
        </div>

        <!-- Grid + selector -->
        <main class="col">
          <!-- Selector de curso -->
          <div class="d-flex align-items-center gap-2 mb-2">
            <label class="form-label small fw-semibold mb-0">Curso:</label>
            <select class="form-select form-select-sm" style="max-width:320px"
                    [(ngModel)]="cursoIdSeleccionado" (change)="onCursoChange()">
              <option value="">— Selecciona un curso —</option>
              <option *ngFor="let c of cursos" [value]="c.id">
                {{ c.nombre }} ({{ c.cupoUsado }}/{{ c.cupoMax }})
              </option>
            </select>
            <span *ngIf="cursoIdSeleccionado" class="badge bg-secondary small">
              {{ rowData.length }} registrado(s)
            </span>
          </div>

          <div *ngIf="!cursoIdSeleccionado" class="text-center text-muted py-5 small">
            <i class="bi bi-arrow-up-circle me-1"></i> Selecciona un curso arriba
          </div>

          <ag-grid-angular *ngIf="cursoIdSeleccionado"
            class="ag-theme-quartz small-text-ag-grid"
            style="width:100%; height:75vh"
            [rowData]="rowData"
            [columnDefs]="colDefs"
            [defaultColDef]="defaultColDef"
            [gridOptions]="gridOptions"
            [localeText]="AG_GRID_LOCALE_ES"
            (gridReady)="onGridReady($event)">
          </ag-grid-angular>
        </main>

      </div>
    </section>
  `,
})
export class RegistrosCursosComponent implements OnInit, OnDestroy {
  private svc        = inject(CursosService);
  private readonly cdr = inject(ChangeDetectorRef);
  private signalsSvc = inject(SignalsService);

  gridApi!: GridApi;
  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;

  cursos: Curso[]          = [];
  rowData: RegistroCurso[] = [];
  cursoIdSeleccionado      = '';
  private sub?: Subscription;
  private subCursos?: Subscription;
  private root = 0;

  defaultColDef: ColDef = { sortable: true, resizable: true, filter: true, minWidth: 80 };

  colDefs: ColDef[] = [
    { field: 'nombre',   headerName: 'Nombre',   flex: 1 },
    { field: 'correo',   headerName: 'Correo',   flex: 1 },
    { field: 'telefono', headerName: 'Teléfono', width: 120 },
    {
      field: 'comoSeEnteroOpcion', headerName: '¿Cómo se enteró?', width: 160,
      valueGetter: (p) => {
        const op  = p.data?.comoSeEnteroOpcion ?? '';
        const txt = p.data?.comoSeEnteroTexto  ?? '';
        return txt ? `${op} — ${txt}` : op;
      },
    },
    {
      field: 'experienciaOpcion', headerName: 'Experiencia', width: 150,
      valueGetter: (p) => {
        const op  = p.data?.experienciaOpcion ?? '';
        const txt = p.data?.experienciaTexto  ?? '';
        return txt ? `${op} — ${txt}` : op;
      },
    },
    {
      field: 'fechaRegistro', headerName: 'Fecha', width: 130,
      valueFormatter: (p) => this.fmtDate(p.value),
    },
    {
      field: 'pagado', headerName: 'Pagado', width: 90,
      cellRenderer: (p: any) => p.value
        ? '<span class="badge bg-success">Sí</span>'
        : '<span class="badge bg-warning text-dark">Pendiente</span>',
      onCellClicked: (p: any) => this.togglePagado(p.data),
      cellStyle: { cursor: 'pointer' },
    },
  ];

  gridOptions: any = { headerHeight: 35, rowHeight: 28, rowSelection: 'single' };

  constructor() {
    effect(() => {
      this.root = this.signalsSvc.getRootSelectedBySidebar()();
      if (this.root) this.cargarCursos();
    });
  }

  ngOnInit() {}
  ngOnDestroy() { this.sub?.unsubscribe(); this.subCursos?.unsubscribe(); }
  onGridReady(e: GridReadyEvent) { this.gridApi = e.api; }

  cargarCursos() {
    this.subCursos?.unsubscribe();
    this.subCursos = this.svc.getCursos(this.root).subscribe(data => {
      this.cursos = data.sort((a, b) => (b.fechaInicio as any)?.seconds - (a.fechaInicio as any)?.seconds);
    });
  }

  onCursoChange() {
    this.sub?.unsubscribe();
    this.rowData = [];
    if (!this.cursoIdSeleccionado) return;
    this.sub = this.svc.getRegistros(this.cursoIdSeleccionado).subscribe(d => { this.rowData = d; });
  }

  async togglePagado(registro: RegistroCurso) {
    if (!registro.id || !this.cursoIdSeleccionado) return;
    await this.svc.marcarPagado(this.cursoIdSeleccionado, registro.id, !registro.pagado);
  
    this.cdr.detectChanges();}

  exportar() { this.gridApi?.exportDataAsCsv({ fileName: 'registros-curso.csv' }); }

  fmtDate(ts: any): string {
    if (!ts) return '';
    return (ts.toDate ? ts.toDate() : new Date(ts))
      .toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
