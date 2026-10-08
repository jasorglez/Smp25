import { Directive, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, inject } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi } from 'ag-grid-community';
import { Subscription } from 'rxjs';
import { alerts } from 'app/helpers/alerts';
import { businessRow, changedOnServer, GridDraft, WorkspaceDraftsService } from 'app/services/workspace-drafts.service';

@Directive({ selector: 'ag-grid-angular[workspaceDraft]', standalone: true })
export class WorkspaceDraftDirective implements OnInit, OnChanges, OnDestroy {
  @Input() workspaceDraft = '';
  @Input() draftOwner: any;
  @Input() draftRows = 'incomes';
  @Input() draftDirty = 'notSavedChanges';
  @Input() draftReady = false;
  private grid = inject(AgGridAngular);
  private store = inject(WorkspaceDraftsService);
  private api?: GridApi;
  private subscriptions = new Subscription();
  private originals = new Map<string, any>();
  private restoring = false;
  private timer: any;
  private key = '';
  private snapshot?: GridDraft;
  private restoredKey = '';
  private warned = false;
  private pageHide = () => this.capture(true);

  ngOnInit(): void {
    this.subscriptions.add(this.grid.gridReady.subscribe(event => {
      this.api = event.api;
      this.api.addEventListener('rowDataUpdated', this.restore);
      this.api.addEventListener('stateUpdated', this.schedule);
      this.api.addEventListener('cellValueChanged', this.schedule);
      this.api.addEventListener('rowGroupOpened', this.schedule);
      this.api.addEventListener('gridPreDestroyed', this.pageHide);
      this.restore();
    }));
    window.addEventListener('pagehide', this.pageHide);
    window.addEventListener('beforeunload', this.pageHide);
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.draftReady) this.restore();
  }

  private syncKey(): void {
    const next = this.store.key(this.workspaceDraft);
    if (next === this.key) return;
    this.key = next;
    this.originals.clear();
    this.snapshot = this.store.read<GridDraft>(next) ?? undefined;
  }

  private restore = (): void => {
    if (this.restoring || !this.api || this.api.isDestroyed() || !this.draftReady) return;
    this.syncKey();
    if (!this.key) return;
    if (this.restoredKey === this.key) { this.schedule(); return; }
    const rows = this.draftOwner?.[this.draftRows] || [];
    for (const row of rows) {
      if (!row.__isNew && !row.__modified) this.originals.set(String(row.id), businessRow(row));
    }
    const saved = this.snapshot;
    this.restoredKey = this.key;
    if (!saved) { this.schedule(); return; }
    this.restoring = true;
    const merged = [...rows];
    for (const draft of saved.rows || []) {
      const index = merged.findIndex(row => String(row.id) === String(draft.row.id));
      if (index >= 0) merged[index] = { ...merged[index], ...draft.row };
      else merged.push({ ...draft.row });
      if (draft.original) this.originals.set(String(draft.row.id), draft.original);
    }
    if (saved.rows?.length) {
      // Restore Date objects expected by AG Grid's date editor.
      merged.forEach(row => { if (typeof row.date === 'string') row.date = new Date(row.date); });
      this.draftOwner[this.draftRows] = merged;
      this.draftOwner[this.draftDirty] = true;
      // Temporary IDs must not collide with restored new records.
      const tempIds = merged.map(row => Number(String(row.id).replace(/^temp_/, ''))).filter(Number.isFinite);
      if ('tempIdCounter' in this.draftOwner) this.draftOwner.tempIdCounter = Math.max(this.draftOwner.tempIdCounter || 0, ...tempIds, 0) + 1;
      this.api.setGridOption('rowData', merged);
      this.draftOwner.calculateTotals?.();
    }
    setTimeout(() => {
      if (!this.api || this.api.isDestroyed()) return;
      if (saved.state) this.restoreGridState(saved.state);
      this.api.forEachNode(node => {
        const expanded = saved.expanded?.find(item => item.id === String(node.data?.id));
        if (expanded) { node.data.detailType = expanded.type; node.setExpanded(true); }
      });
      this.restoring = false;
    });
  };

  private restoreGridState(state: any): void {
    if (!this.api) return;
    const columnState = (state.columnOrder?.orderedColIds || []).map((colId: string) => {
      const sizing = state.columnSizing?.columnSizingModel?.find((item: any) => item.colId === colId);
      return {
        colId,
        hide: state.columnVisibility?.hiddenColIds?.includes(colId),
        pinned: state.columnPinning?.leftColIds?.includes(colId) ? 'left'
          : state.columnPinning?.rightColIds?.includes(colId) ? 'right' : null,
        width: sizing?.width,
        flex: sizing?.flex,
        sort: state.sort?.sortModel?.find((item: any) => item.colId === colId)?.sort,
        sortIndex: state.sort?.sortModel?.findIndex((item: any) => item.colId === colId)
      };
    });
    if (columnState.length) this.api.applyColumnState({ state: columnState, applyOrder: true });
    if (state.filter?.filterModel) this.api.setFilterModel(state.filter.filterModel);
    if (state.pagination?.page != null) this.api.paginationGoToPage(state.pagination.page);
    if (Array.isArray(state.rowSelection)) {
      this.api.forEachNode(node => node.setSelected(state.rowSelection.includes(node.id || '')));
    }
    if (state.focusedCell) this.api.setFocusedCell(state.focusedCell.rowIndex, state.focusedCell.colId, state.focusedCell.rowPinned);
    if (state.scroll?.top > 0) this.api.ensureIndexVisible(Math.floor(state.scroll.top / 30), 'top');
  }

  private schedule = (): void => {
    if (this.restoring) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.capture(), 200);
  };

  capture(finishEditing = false): void {
    if (this.restoring || !this.api || this.api.isDestroyed() || !this.draftReady) return;
    if (finishEditing) this.api.stopEditing();
    this.syncKey();
    if (!this.key) return;
    const rows = this.draftOwner?.[this.draftRows] || [];
    const expanded: GridDraft['expanded'] = [];
    this.api.forEachNode(node => {
      if (node.expanded && node.data) expanded.push({ id: String(node.data.id), type: node.data.detailType });
    });
    this.snapshot = {
      rows: rows.filter(row => row.__isNew || row.__modified).map(row => ({ row: { ...row, detailData: undefined }, original: this.originals.get(String(row.id)) })),
      state: this.api.getState(), expanded, savedAt: Date.now()
    };
    if (!this.store.write(this.key, this.snapshot) && !this.warned && this.snapshot.rows.length) {
      this.warned = true;
      alerts.toastAlert('El navegador no permitió guardar el borrador. Conserva esta ventana abierta.', 'warning');
    }
  }

  clear(): void {
    clearTimeout(this.timer);
    this.syncKey();
    this.snapshot = { rows: [], state: this.api?.getState(), expanded: [], savedAt: Date.now() };
    this.store.write(this.key, this.snapshot);
    // Saved/discarded rows must not be captured again before the server reload completes.
    for (const row of this.draftOwner?.[this.draftRows] || []) { row.__modified = false; row.__isNew = false; }
  }

  async canSave(load: () => Promise<any[]>): Promise<boolean> {
    this.capture(true);
    const edits = this.snapshot?.rows.filter(draft => !draft.row.__isNew) || [];
    if (!edits.length) return true;
    try {
      const fresh = await load();
      const conflict = edits.some(draft => {
        const serverRow = fresh.find(row => String(row.id) === String(draft.row.id));
        return !serverRow || changedOnServer(draft.original, businessRow(serverRow), businessRow(draft.row));
      });
      if (!conflict) return true;
      alerts.basicAlert('El registro cambió', 'Hay cambios en el servidor posteriores a tu edición. Tu borrador se conserva. Revisa los datos; usa Deshacer para cargar la versión actual antes de volver a editar.', 'warning');
    } catch {
      alerts.basicAlert('No se pudo verificar', 'No se guardaron cambios. Tu borrador se conserva; vuelve a intentar cuando haya conexión.', 'warning');
    }
    return false;
  }

  ngOnDestroy(): void {
    this.capture(true);
    clearTimeout(this.timer);
    this.subscriptions.unsubscribe();
    window.removeEventListener('pagehide', this.pageHide);
    window.removeEventListener('beforeunload', this.pageHide);
    if (this.api && !this.api.isDestroyed()) {
      this.api.removeEventListener('rowDataUpdated', this.restore);
      this.api.removeEventListener('stateUpdated', this.schedule);
      this.api.removeEventListener('cellValueChanged', this.schedule);
      this.api.removeEventListener('rowGroupOpened', this.schedule);
      this.api.removeEventListener('gridPreDestroyed', this.pageHide);
    }
  }
}
