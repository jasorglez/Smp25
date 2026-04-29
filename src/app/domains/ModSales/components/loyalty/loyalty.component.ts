import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, CellDoubleClickedEvent } from 'ag-grid-enterprise';
import { LoyaltyService } from 'app/services/loyalty.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';
import { catchError, EMPTY } from 'rxjs';

@Component({
  selector: 'app-loyalty',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './loyalty.component.html',
  styleUrl: './loyalty.component.scss',
})
export class LoyaltyComponent implements OnInit {
  private loyaltyService  = inject(LoyaltyService);
  private signalsService  = inject(SignalsService);

  activeTab: 'programs' | 'cards' = 'programs';
  idCompany = 0;

  // ── Programas ────────────────────────────────────────────────────────────
  programsRowData: any[] = [];
  private programsGridApi: GridApi;
  selectedProgram: any = null;
  private programTempCounter = 0;

  programsColDefs: ColDef[] = [
    { field: 'id',                 headerName: 'ID',           width: 70, editable: false },
    { field: 'name',               headerName: 'Programa',     flex: 1,   editable: true },
    { field: 'idProduct',          headerName: 'ID Producto',  width: 120, editable: true },
    { field: 'stampsRequired',     headerName: 'Sellos Req.',  width: 120, editable: true },
    { field: 'rewardDescription',  headerName: 'Recompensa',   flex: 2,   editable: true },
    { field: 'active',             headerName: 'Activo',       width: 90,  editable: true },
  ];

  // ── Tarjetas ─────────────────────────────────────────────────────────────
  cardsRowData: any[] = [];
  private cardsGridApi: GridApi;
  selectedProgramForCards: number | null = null;

  cardsColDefs: ColDef[] = [
    { field: 'id',                  headerName: 'ID',          width: 70 },
    { field: 'idCustomer',          headerName: 'ID Cliente',  width: 110 },
    { field: 'currentStamps',       headerName: 'Sellos',      width: 90 },
    { field: 'totalRewardsEarned',  headerName: 'Recompensas', width: 110 },
    { field: 'lastStampDate',       headerName: 'Último Sello', flex: 1,
      valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('es-MX') : '' },
  ];

  public defaultColDef: ColDef = {
    sortable: true, filter: true, resizable: true, flex: 1,
  };

  constructor() {
    effect(() => {
      const id = this.signalsService.getRootSelectedBySidebar()();
      if (id) {
        this.idCompany = id;
        this.loadPrograms();
      }
    });
  }

  ngOnInit() {
    const id = this.signalsService.getRootSelectedBySidebar()();
    if (id) {
      this.idCompany = id;
      this.loadPrograms();
    }
  }

  // ── Programas ────────────────────────────────────────────────────────────
  onProgramsGridReady(e: GridReadyEvent) { this.programsGridApi = e.api; }

  onProgramSelected(e: CellDoubleClickedEvent) {
    this.selectedProgram = e.data;
  }

  loadPrograms() {
    if (!this.idCompany) return;
    this.loyaltyService.getPrograms(this.idCompany).subscribe({
      next: d => this.programsRowData = d,
      error: err => console.error(err),
    });
  }

  addProgram() {
    const temp = `temp_${this.programTempCounter++}`;
    const row = {
      id: temp, idCompany: this.idCompany,
      name: '', idProduct: null, stampsRequired: 5,
      rewardDescription: '', active: true, __isNew: true,
    };
    this.programsRowData = [...this.programsRowData, row];
    this.programsGridApi?.setGridOption('rowData', this.programsRowData);
  }

  async savePrograms() {
    const newRows      = this.programsRowData.filter(r => r.__isNew);
    const modifiedRows = this.programsRowData.filter(r => r.__modified && !r.__isNew);

    if (!newRows.length && !modifiedRows.length) {
      alerts.basicAlert('Sin cambios', 'No hay cambios pendientes.', 'info');
      return;
    }

    try {
      for (const row of newRows) {
        const { id, __isNew, __modified, ...data } = row;
        await this.loyaltyService.createProgram(data).toPromise();
      }
      for (const row of modifiedRows) {
        const { __modified, ...data } = row;
        await this.loyaltyService.updateProgram(row.id, data).toPromise();
      }
      alerts.basicAlert('Guardado', 'Cambios guardados correctamente.', 'success');
      this.loadPrograms();
    } catch {
      alerts.basicAlert('Error', 'No se pudieron guardar los cambios.', 'error');
    }
  }

  deleteProgram() {
    const nodes = this.programsGridApi?.getSelectedNodes();
    if (!nodes?.length) {
      alerts.basicAlert('Eliminar', 'Seleccione un programa.', 'warning');
      return;
    }
    const row = nodes[0].data;
    if (typeof row.id === 'string') {
      this.programsRowData = this.programsRowData.filter(r => r.id !== row.id);
      this.programsGridApi.setGridOption('rowData', this.programsRowData);
      return;
    }
    this.loyaltyService.deleteProgram(row.id).pipe(
      catchError(() => {
        alerts.basicAlert('Error', 'No se pudo eliminar el programa.', 'error');
        return EMPTY;
      })
    ).subscribe(() => {
      alerts.basicAlert('Eliminado', 'Programa eliminado.', 'success');
      this.loadPrograms();
    });
  }

  onProgramCellValueChanged(e: any) {
    if (!e.data.__isNew) e.data.__modified = true;
  }

  // ── Tarjetas ─────────────────────────────────────────────────────────────
  onCardsGridReady(e: GridReadyEvent) { this.cardsGridApi = e.api; }

  loadCards() {
    if (!this.selectedProgramForCards) return;
    this.loyaltyService.getCardsByProgram(this.selectedProgramForCards).subscribe({
      next: d => this.cardsRowData = d,
      error: err => console.error(err),
    });
  }

  addStamp() {
    const nodes = this.cardsGridApi?.getSelectedNodes();
    if (!nodes?.length) {
      alerts.basicAlert('Agregar sello', 'Seleccione una tarjeta.', 'warning');
      return;
    }
    const card = nodes[0].data;
    this.loyaltyService.addStamp(card.idCustomer, this.selectedProgramForCards!).pipe(
      catchError(() => {
        alerts.basicAlert('Error', 'No se pudo agregar el sello.', 'error');
        return EMPTY;
      })
    ).subscribe((result: any) => {
      if (result.rewardEarned) {
        alerts.basicAlert('¡Recompensa!', `El cliente ganó: ${result.rewardDescription}`, 'success');
      } else {
        alerts.basicAlert('Sello agregado', `Sellos actuales: ${result.card.currentStamps}`, 'success');
      }
      this.loadCards();
    });
  }
}
