import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { LoyaltyService } from 'app/services/loyalty.service';
import { MaterialsService } from 'app/services/materials.service';
import { CustomersService } from 'app/services/customers.service';
import { SignalsService } from 'app/services/signals.service';
import { catchError, EMPTY } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-loyalty',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './loyalty.component.html',
  styleUrl: './loyalty.component.scss',
})
export class LoyaltyComponent implements OnInit {
  private loyaltyService   = inject(LoyaltyService);
  private materialsService = inject(MaterialsService);
  private customersService = inject(CustomersService);
  private signalsService   = inject(SignalsService);

  AG_GRID_LOCALE_ES = AG_GRID_LOCALE_ES;
  activeTab: 'programs' | 'cards' = 'programs';
  idCompany = 0;

  // ── Productos para el combo ────────────────────────────────────────────────
  productos: { id: number; description: string }[] = [];

  // ── Clientes para el combo de sellos ──────────────────────────────────────
  clientes: { id: number; label: string }[] = [];
  clienteSeleccionado: number | null = null;

  // ── Grid options (mismo patrón que prospectos) ────────────────────────────
  gridOptions: any = {
    headerHeight: 35,
    rowHeight: 28,
    suppressDragLeaveHidesColumns: true,
    rowSelection: 'single',
    rowClassRules: {
      'new-row-highlight': (p: any) => !!p.data?.__isNew,
    },
  };

  defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    minWidth: 80,
    suppressKeyboardEvent: (params) => {
      if (params.event.key === 'Enter' && params.editing) {
        setTimeout(() => { if (this.programsGridApi) this.programsGridApi.stopEditing(); }, 0);
        return true;
      }
      return false;
    },
  };

  // ── Programas ────────────────────────────────────────────────────────────
  programsRowData: any[] = [];
  private programsGridApi!: GridApi;
  selectedProgram: any = null;
  private programTempCounter = 0;

  get programsColDefs(): ColDef[] {
    return [
      { field: 'id',   headerName: 'ID', width: 65, editable: false },
      { field: 'name', headerName: 'Programa', flex: 1, editable: true },
      {
        field: 'productDescription',
        headerName: 'Producto',
        width: 230,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({ values: ['Sin producto', ...this.productos.map(p => p.description)] }),
        valueSetter: (params: any) => {
          params.data.productDescription = params.newValue;
          if (params.newValue === 'Sin producto') {
            params.data.idProduct = null;
          } else {
            const found = this.productos.find(p => p.description === params.newValue);
            if (found) params.data.idProduct = found.id;
          }
          return true;
        },
      },
      { field: 'stampsRequired',    headerName: 'Sellos req.', width: 120, editable: true },
      { field: 'rewardDescription', headerName: 'Recompensa',  flex: 2,   editable: true },
      {
        field: 'active', headerName: 'Activo', width: 90, editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: [true, false] },
        cellRenderer: (p: any) => p.value ? '✅ Sí' : '❌ No',
      },
    ];
  }

  // ── Tarjetas ─────────────────────────────────────────────────────────────
  cardsRowData: any[] = [];
  private cardsGridApi!: GridApi;
  selectedProgramForCards: number | null = null;

  cardsColDefs: ColDef[] = [
    { field: 'id',                  headerName: 'ID',          width: 70 },
    { field: 'idCustomer',          headerName: 'ID Cliente',  width: 120 },
    { field: 'currentStamps',       headerName: 'Sellos',      width: 90 },
    { field: 'totalRewardsEarned',  headerName: 'Recompensas', width: 120 },
    {
      field: 'lastStampDate', headerName: 'Último Sello', flex: 1,
      valueFormatter: p => p.value ? new Date(p.value).toLocaleDateString('es-MX') : '',
    },
  ];

  constructor() {
    effect(() => {
      const id = this.signalsService.getRootSelectedBySidebar()();
      if (id) {
        this.idCompany = id;
        this.loadProductos();
        this.loadClientes();
        this.loadPrograms();
      }
    });
  }

  ngOnInit() {
    const id = this.signalsService.getRootSelectedBySidebar()();
    if (id) {
      this.idCompany = id;
      this.loadProductos();
      this.loadClientes();
      this.loadPrograms();
    }
  }

  // ── Clientes (búsqueda por teléfono) ─────────────────────────────────────
  private todosLosClientes: any[] = [];
  telefonoBusqueda  = '';
  clienteEncontrado: { id: number; nombre: string; telefono: string } | null = null;
  clienteNoEncontrado = false;

  loadClientes() {
    this.customersService.getCustomersByCompany(this.idCompany, 'CUSTOMERS').subscribe({
      next: (data: any) => { this.todosLosClientes = data ?? []; },
      error: err => console.error('Error cargando clientes', err),
    });
  }

  buscarClientePorTelefono() {
    const tel = this.telefonoBusqueda.trim();
    if (!tel) return;
    const found = this.todosLosClientes.find(
      c => (c.phone ?? '').replace(/\s/g, '') === tel.replace(/\s/g, '') ||
           (c.mobile ?? '').replace(/\s/g, '') === tel.replace(/\s/g, '')
    );
    if (found) {
      this.clienteEncontrado    = { id: found.id, nombre: found.nameContact ?? found.company ?? '', telefono: tel };
      this.clienteNoEncontrado  = false;
    } else {
      this.clienteEncontrado    = null;
      this.clienteNoEncontrado  = true;
    }
  }

  // ── Productos ─────────────────────────────────────────────────────────────
  loadProductos() {
    this.materialsService.getMaterials2Fields(this.idCompany).subscribe({
      next: (data: any) => {
        this.productos = (data ?? []).map((p: any) => ({
          id: p.id,
          description: p.description ?? p.Description ?? '',
        }));
      },
      error: err => console.error('Error cargando productos', err),
    });
  }

  // ── Programas ────────────────────────────────────────────────────────────
  onProgramsGridReady(e: GridReadyEvent) { this.programsGridApi = e.api; }

  onProgramRowClicked(e: any) { this.selectedProgram = e.data; }

  loadPrograms() {
    if (!this.idCompany) return;
    this.loyaltyService.getPrograms(this.idCompany).subscribe({
      next: data => {
        this.programsRowData = data.map(p => ({
          ...p,
          productDescription: this.productos.find(pr => pr.id === p.idProduct)?.description ?? 'Sin producto',
          __isNew: false,
          __modified: false,
        }));
      },
      error: err => console.error(err),
    });
  }

  addProgram() {
    const temp = `temp_${this.programTempCounter++}`;
    const row: any = {
      id: temp, idCompany: this.idCompany,
      name: '', idProduct: null, productDescription: 'Sin producto',
      stampsRequired: 5, rewardDescription: '', active: true,
      __isNew: true, __modified: false,
    };
    this.programsRowData = [row, ...this.programsRowData];
    this.programsGridApi?.setGridOption('rowData', this.programsRowData);
    setTimeout(() => this.programsGridApi?.startEditingCell({ rowIndex: 0, colKey: 'name' }), 50);
  }

  onProgramCellValueChanged(e: any) {
    if (!e.data.__isNew) e.data.__modified = true;
  }

  async savePrograms() {
    this.programsGridApi?.stopEditing();
    const newRows      = this.programsRowData.filter(r => r.__isNew);
    const modifiedRows = this.programsRowData.filter(r => r.__modified && !r.__isNew);

    if (!newRows.length && !modifiedRows.length) {
      Swal.fire({ icon: 'info', title: 'Sin cambios', timer: 1200, showConfirmButton: false });
      return;
    }

    try {
      for (const row of newRows) {
        const { id, __isNew, __modified, productDescription, ...data } = row;
        await this.loyaltyService.createProgram({ ...data, idCompany: this.idCompany }).toPromise();
      }
      for (const row of modifiedRows) {
        const { __modified, __isNew, productDescription, ...data } = row;
        await this.loyaltyService.updateProgram(row.id, data).toPromise();
      }
      Swal.fire({ icon: 'success', title: 'Guardado', timer: 1200, showConfirmButton: false });
      this.loadPrograms();
    } catch {
      Swal.fire('Error', 'No se pudieron guardar los cambios.', 'error');
    }
  }

  deleteProgram() {
    if (!this.selectedProgram) {
      Swal.fire({ icon: 'warning', title: 'Selecciona un programa', timer: 1500, showConfirmButton: false });
      return;
    }
    const row = this.selectedProgram;
    if (typeof row.id === 'string') {
      this.programsRowData = this.programsRowData.filter(r => r.id !== row.id);
      this.programsGridApi.setGridOption('rowData', this.programsRowData);
      this.selectedProgram = null;
      return;
    }
    Swal.fire({
      title: '¿Eliminar programa?', text: row.name,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar',
    }).then(res => {
      if (!res.isConfirmed) return;
      this.loyaltyService.deleteProgram(row.id).pipe(
        catchError(() => { Swal.fire('Error', 'No se pudo eliminar.', 'error'); return EMPTY; })
      ).subscribe(() => {
        Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1200, showConfirmButton: false });
        this.selectedProgram = null;
        this.loadPrograms();
      });
    });
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
    if (!this.clienteEncontrado || !this.selectedProgramForCards) {
      Swal.fire({ icon: 'warning', title: 'Busca un cliente y selecciona un programa', timer: 1800, showConfirmButton: false });
      return;
    }
    this.loyaltyService.addStamp(this.clienteEncontrado.id, this.selectedProgramForCards!).pipe(
      catchError(() => { Swal.fire('Error', 'No se pudo agregar el sello.', 'error'); return EMPTY; })
    ).subscribe((result: any) => {
      if (result.rewardEarned) {
        Swal.fire('🎉 ¡Recompensa!', result.rewardDescription, 'success');
      } else {
        Swal.fire({ icon: 'success', title: 'Sello agregado', text: `Sellos: ${result.card.currentStamps}`, timer: 1500, showConfirmButton: false });
      }
      this.loadCards();
    });
  }

  get programsForSelector() {
    return this.programsRowData.filter(p => typeof p.id === 'number');
  }
}
