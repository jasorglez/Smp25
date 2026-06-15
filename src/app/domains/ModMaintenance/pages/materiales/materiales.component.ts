import { Component, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, lastValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SignalsService } from 'app/services/signals.service';
import { TrackingService } from 'app/services/tracking.service';
import { WorkorderService } from 'app/services/workorder.service';
import { WarehousesService } from 'app/services/warehouses.service';
import { MaterialsService } from 'app/services/materials.service';
import { InventarioWarehouseService } from 'app/services/inventario-warehouse.service';
import { UsersxpermissionsService } from 'app/services/usersxpermissions.service';
import { WorkOrderMovementService, WorkOrderMovement, WorkOrderMovementItem } from 'app/services/workorder-movement.service';

interface FormItem {
  tempId: number;
  idMaterial: number;
  materialName: string;
  currentStock: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

@Component({
  selector: 'app-materiales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './materiales.component.html',
  styleUrls: ['./materiales.component.scss']
})
export class MaterialesComponent implements OnInit {
  private signalsService      = inject(SignalsService);
  private trackingService     = inject(TrackingService);
  private workorderService    = inject(WorkorderService);
  private warehousesService   = inject(WarehousesService);
  private materialsService    = inject(MaterialsService);
  private inventarioService   = inject(InventarioWarehouseService);
  private permissionsService  = inject(UsersxpermissionsService);
  private movementService     = inject(WorkOrderMovementService);

  idCompany: number = 0;
  idBranch: number = 0;
  private lastBranchId: number = 0;
  private initialized = false;

  loading = false;
  saving = false;

  // Catálogos
  workOrders: any[] = [];
  warehouses: any[] = [];
  materials: any[] = [];
  inventory: any[] = [];

  // Lista de movimientos
  movements: WorkOrderMovement[] = [];
  selectedMovement: WorkOrderMovement | null = null;
  movementItems: WorkOrderMovementItem[] = [];
  loadingItems = false;

  // Filtros
  filterType: string = '';
  filterOT: string = '';

  // Modal nuevo movimiento
  showForm = false;
  form: WorkOrderMovement = {};
  formItems: FormItem[] = [];
  private tempCounter = 0;

  constructor() {
    effect(() => {
      this.updateContext();
      if (!this.initialized) return;
      if (this.idBranch !== this.lastBranchId) {
        this.lastBranchId = this.idBranch;
        this.loadAll();
      }
    });
  }

  ngOnInit(): void {
    this.updateContext();
    this.lastBranchId = this.idBranch;
    this.initialized = true;
    this.loadAll();
    this.trackingService.addLog(String(this.idCompany), 'Acceso a Materiales Mantenimiento', 'ModMaintenance/Materiales', '');
  }

  // ── Carga inicial ─────────────────────────────────────────────────
  loadAll(): void {
    if (!this.idBranch || !this.idCompany) return;
    this.loading = true;

    const email = localStorage.getItem('mail') || '';

    forkJoin({
      workOrders:  this.workorderService.getAll(String(this.idBranch)).pipe(catchError(() => of([]))),
      materials:   this.materialsService.getMaterials(this.idCompany, 'CONSUMABLE').pipe(catchError(() => of([]))),
      inventory:   this.inventarioService.getInventario(this.idCompany).pipe(catchError(() => of([]))),
      warehouses:  this.warehousesService.getSimpleWarehouses(this.idCompany).pipe(catchError(() => of([]))),
      permissions: this.permissionsService.getUserxPermissionByEmail('warehouse', email).pipe(catchError(() => of([]))),
      movements:   this.movementService.getByBranch(String(this.idBranch)).pipe(catchError(() => of([])))
    }).subscribe({
      next: (r: any) => {
        this.workOrders = (r.workOrders || []).filter((w: any) => w.active !== false);
        const mats = (r.materials || []).filter((m: any) => m.active !== false);
        // Si el filtro CONSUMABLE no retorna nada, cargar todos
        this.materials = mats.length ? mats : (r.materials || []);
        this.inventory  = r.inventory  || [];

        const perms: any[] = r.permissions || [];
        const allWH: any[] = r.warehouses  || [];
        this.warehouses = allWH.filter(w => perms.some((p: any) => p.idPermission === w.id));
        if (!this.warehouses.length) this.warehouses = allWH;

        this.movements = r.movements || [];
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  // ── Filtro de movimientos ─────────────────────────────────────────
  get filteredMovements(): WorkOrderMovement[] {
    return this.movements.filter(m => {
      const matchType = !this.filterType || m.type === this.filterType;
      const matchOT   = !this.filterOT   || String(m.idWorkorder) === this.filterOT;
      return matchType && matchOT;
    });
  }

  // ── Selección de movimiento → carga items ─────────────────────────
  selectMovement(mv: WorkOrderMovement): void {
    this.selectedMovement = mv;
    this.movementItems = [];
    this.loadingItems = true;
    this.movementService.getItems(mv.id!).subscribe({
      next: items => { this.movementItems = items || []; this.loadingItems = false; },
      error: ()    => { this.movementItems = []; this.loadingItems = false; }
    });
  }

  // ── Modal ─────────────────────────────────────────────────────────
  openForm(): void {
    this.form = {
      idBranch:    String(this.idBranch),
      type:        'OUT',
      date:        new Date().toISOString().split('T')[0],
      idWarehouse: this.warehouses[0]?.id ?? undefined,
      idWorkorder: undefined,
      notes:       ''
    };
    this.formItems = [];
    this.addFormItem();
    this.showForm = true;
  }

  closeForm(): void { this.showForm = false; }

  addFormItem(): void {
    this.formItems.push({
      tempId:       this.tempCounter++,
      idMaterial:   0,
      materialName: '',
      currentStock: 0,
      quantity:     1,
      unitCost:     0,
      totalCost:    0
    });
  }

  removeFormItem(tempId: number): void {
    this.formItems = this.formItems.filter(i => i.tempId !== tempId);
  }

  onMaterialSelect(item: FormItem): void {
    const mat = this.materials.find((m: any) => m.id === item.idMaterial || +m.id === +item.idMaterial);
    if (!mat) return;
    item.materialName = mat.description || mat.articulo || '';
    item.unitCost     = mat.costoMN ?? 0;
    item.totalCost    = +(item.unitCost * item.quantity).toFixed(4);

    const inv = this.inventory.find((r: any) => r.id === item.idMaterial || +r.id === +item.idMaterial);
    item.currentStock = inv?.existencia ?? 0;
  }

  onQtyChange(item: FormItem): void {
    item.totalCost = +(item.unitCost * item.quantity).toFixed(4);
  }

  get formTotal(): number {
    return this.formItems.reduce((s, i) => s + i.totalCost, 0);
  }

  otLabel(idWorkorder?: number): string {
    if (!idWorkorder) return '—';
    const wo = this.workOrders.find(w => w.id === idWorkorder);
    return wo ? `${wo.folio || ''} ${wo.title || ''}`.trim() : String(idWorkorder);
  }

  warehouseLabel(id?: number): string {
    const w = this.warehouses.find(wh => wh.id === id);
    return w ? (w.name || w.nombreAlmacen || String(id)) : (id ? String(id) : '—');
  }

  // ── Guardar movimiento ────────────────────────────────────────────
  async saveMovement(): Promise<void> {
    const validItems = this.formItems.filter(i => i.idMaterial && i.quantity > 0);
    if (!this.form.idWorkorder) { alert('Selecciona una Orden de Trabajo'); return; }
    if (!this.form.idWarehouse)  { alert('Selecciona un almacén'); return; }
    if (!validItems.length)      { alert('Agrega al menos un material'); return; }

    // Validar stock para salidas
    if (this.form.type === 'OUT') {
      for (const item of validItems) {
        if (item.quantity > item.currentStock) {
          alert(`Stock insuficiente para "${item.materialName}": disponible ${item.currentStock}, solicitado ${item.quantity}`);
          return;
        }
      }
    }

    this.saving = true;
    try {
      // 1. Crear el movimiento header
      const wo      = this.workOrders.find(w => w.id === +this.form.idWorkorder!);
      const year    = new Date().getFullYear();
      const prefix  = this.form.type === 'IN' ? 'ENT' : 'SAL';
      const folio   = `${prefix}-MNT-${year}-${Date.now().toString().slice(-5)}`;

      const saved = await lastValueFrom(this.movementService.add({
        ...this.form,
        folio,
        idWorkorder: +this.form.idWorkorder!,
        idBranch:    String(this.idBranch)
      }));

      // 2. Guardar items
      const itemOps = validItems.map(i =>
        lastValueFrom(this.movementService.addItem({
          idMovement:   saved.id,
          idMaterial:   i.idMaterial,
          materialName: i.materialName,
          quantity:     i.quantity,
          unitCost:     i.unitCost,
          totalCost:    i.totalCost
        }))
      );
      await Promise.all(itemOps);

      // 3. Actualizar stock via inventario ajuste
      const stockOps = validItems.map(i => {
        const inv   = this.inventory.find((r: any) => +r.id === +i.idMaterial);
        const exist = inv?.existencia ?? 0;
        const newQty = this.form.type === 'OUT'
          ? exist - i.quantity
          : exist + i.quantity;

        return lastValueFrom(this.inventarioService.ajustar({
          idMaterial:     +i.idMaterial,
          idWarehouse:    +this.form.idWarehouse!,
          cantidadFisica: Math.max(0, newQty),
          comentario:     `${prefix}-MNT OT:${wo?.folio || this.form.idWorkorder} ${folio}`,
          idCompany:      this.idCompany
        })).catch(() => null); // no bloquear si falla ajuste
      });
      await Promise.all(stockOps);

      this.saving = false;
      this.showForm = false;
      this.loadAll();
    } catch (err) {
      console.error(err);
      this.saving = false;
      alert('Error al guardar el movimiento');
    }
  }

  // ── Eliminar movimiento ───────────────────────────────────────────
  deleteMovement(mv: WorkOrderMovement, event: Event): void {
    event.stopPropagation();
    if (!confirm(`¿Eliminar movimiento ${mv.folio}?`)) return;
    this.movementService.delete(mv.id!).subscribe({
      next: () => {
        this.movements = this.movements.filter(m => m.id !== mv.id);
        if (this.selectedMovement?.id === mv.id) {
          this.selectedMovement = null;
          this.movementItems = [];
        }
      }
    });
  }

  // ── Contexto ──────────────────────────────────────────────────────
  private updateContext(): void {
    const sig = this.signalsService.getRootSelectedBySidebar()();
    if (sig != null) this.idCompany = +sig;
    else {
      const c = localStorage.getItem('company');
      if (c && !isNaN(+c)) this.idCompany = +c;
    }
    const branch = this.signalsService.getBranchSelectedBySidebar()();
    this.idBranch = branch != null ? +branch : 0;
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);
  }
}
