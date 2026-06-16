import { Component, ViewChild, AfterViewInit, OnDestroy, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule, NgSelectComponent } from '@ng-select/ng-select';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { ICellEditorParams } from 'ag-grid-community';
import { Renderer2 } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { CustomersService } from 'app/services/customers.service';
import { ProvidersService } from 'app/services/providers.service';
import { SignalsService } from 'app/services/signals.service';
import { alerts } from 'app/helpers/alerts';

@Component({
  selector: 'app-cr-proveedor-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  template: `
    <div style="width:320px; background:#fff; border-radius:6px; box-shadow:0 4px 16px rgba(0,0,0,.2); padding:4px 0;">
      <ng-select
        #sel
        [items]="providers"
        bindValue="id"
        bindLabel="description"
        [(ngModel)]="selectedId"
        [clearable]="false"
        [searchable]="true"
        placeholder="Buscar proveedor..."
        (ngModelChange)="onSelect($event)"
        [isOpen]="true"
        [dropdownPosition]="'bottom'"
        style="width:100%;">
        <ng-template ng-option-tmp let-item="item">
          <span *ngIf="item.__isHeader"
                style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;
                       width:100%;text-align:center;display:inline-block;color:#6c757d;">
            {{ item.description }}
          </span>
          <ng-container *ngIf="!item.__isHeader">
            <span *ngIf="item.isPrincipal" title="Proveedor principal">⭐ </span>{{ item.description }}
          </ng-container>
        </ng-template>
        <ng-template ng-label-tmp let-item="item">
          <span *ngIf="item.isPrincipal">⭐ </span>{{ item.description }}
        </ng-template>
      </ng-select>
    </div>
  `,
})
export class CrProveedorEditorComponent implements ICellEditorAngularComp, AfterViewInit, OnDestroy {
  @ViewChild('sel') ngSelect!: NgSelectComponent;

  private renderer = inject(Renderer2);
  private elRef = inject(ElementRef);
  private customersService = inject(CustomersService);
  private providersService = inject(ProvidersService);
  private signalsService = inject(SignalsService);
  private dismissListeners: Array<() => void> = [];

  providers: any[] = [];
  selectedId: number | null = null;
  private selectedName: string | null = null;
  private isValidating = false; // bloquea cancelEdit durante validación async (ej. SweetAlert fuera del editor)
  private params!: ICellEditorParams & {
    providers?: any[];
    inactiveProviders?: { id: number; name: string; raw?: any }[];
    onProviderSelected?: (id: number, name: string) => Promise<string | null>;
    onNewProviderCreated?: (name: string) => void;
  };
  inactiveProviders: { id: number; name: string; raw?: any }[] = [];
  private readonly NEW_SENTINEL = -1;

  // Overlay "Nuevo Proveedor" (mismo DOM que la cotización)
  private overlayEl: HTMLElement | null = null;
  private overlayListeners: Array<() => void> = [];
  private newProv = { company: '', nameContact: '', phone: '', email: '' };

  agInit(params: any): void {
    this.params = params;
    this.providers = params.providers ?? [];
    this.inactiveProviders = params.inactiveProviders ?? [];
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.ngSelect?.open(), 50);
    // Cerrar el editor al hacer click fuera o presionar Escape (cancela sin guardar).
    // El delay evita que el mismo click que abrió el editor lo cierre.
    setTimeout(() => {
      this.dismissListeners.push(
        this.renderer.listen('document', 'mousedown', (e: MouseEvent) => this.onOutsideMouseDown(e))
      );
      this.dismissListeners.push(
        this.renderer.listen('document', 'keydown', (e: KeyboardEvent) => {
          if (e.key === 'Escape') this.cancelEdit();
        })
      );
    }, 150);
  }

  ngOnDestroy(): void {
    this.dismissListeners.forEach(fn => { try { fn(); } catch {} });
    this.dismissListeners = [];
    this.closeOverlay();
  }

  private onOutsideMouseDown(e: MouseEvent): void {
    if (this.overlayEl) return;                       // el overlay de nuevo proveedor maneja sus clicks
    if (this.isValidating) return;                    // validación async en curso (SweetAlert fuera del editor): no cancelar
    const target = e.target as Node;
    if (this.elRef.nativeElement.contains(target)) return;  // click dentro del editor/dropdown
    // Evita la condición de carrera con singleClickEdit: si el click es en la misma celda,
    // AG Grid lo maneja (no reabrir). Cualquier otro punto de la pantalla → cerrar.
    const cell = (this.params as any)?.eGridCell as HTMLElement | undefined;
    if (cell && cell.contains(target)) return;
    this.cancelEdit();
  }

  private cancelEdit(): void {
    // Cancela la edición sin commitear (no cambia el proveedor).
    this.selectedName = null;
    this.params.stopEditing(true);
  }

  onSelect(id: number | null): void {
    if (id === this.NEW_SENTINEL) {
      this.selectedId = null;
      this.selectedName = null;
      this.openNewProviderOverlay();
      return;
    }
    const found = this.providers.find(p => p.id === id);
    if (!found) return;
    // Setear selectedName de inmediato para que getValue() devuelva el valor
    // aunque stopEditing() sea llamado por AG Grid antes de que el async complete.
    this.selectedName = found.description ?? '';
    void this.runValidationAndClose(found.id, found.description ?? '');
  }

  private async runValidationAndClose(id: number, name: string): Promise<void> {
    if (this.params.onProviderSelected) {
      // Bloquea cancelEdit mientras la validación (que abre SweetAlerts fuera del editor) está en curso.
      this.isValidating = true;
      let result: string | null;
      try {
        result = await this.params.onProviderSelected(id, name);
      } finally {
        this.isValidating = false;
      }
      if (result === null) {
        // Usuario canceló la validación → revertir selección visual y mantener editor abierto.
        this.selectedId = null;
        this.selectedName = null;  // limpiar para no commitear si stopEditing se llama externamente
        setTimeout(() => this.ngSelect?.open(), 50);
        return;
      }
      this.selectedName = result;
    } else {
      this.selectedName = name;
    }
    this.params.stopEditing();
  }

  getValue(): string | null { return this.selectedName; }
  isPopup(): boolean { return true; }
  getPopupPosition(): 'over' | 'under' { return 'under'; }

  // ── Overlay "Nuevo Proveedor" (misma lógica y estructura que la cotización) ──
  private openNewProviderOverlay(): void {
    this.closeOverlay();
    this.newProv = { company: '', nameContact: '', phone: '', email: '' };

    const backdrop = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(backdrop, 'position', 'fixed');
    this.renderer.setStyle(backdrop, 'inset', '0');
    this.renderer.setStyle(backdrop, 'background', 'rgba(0,0,0,0.55)');
    this.renderer.setStyle(backdrop, 'z-index', '999999');
    this.renderer.setStyle(backdrop, 'display', 'flex');
    this.renderer.setStyle(backdrop, 'align-items', 'center');
    this.renderer.setStyle(backdrop, 'justify-content', 'center');

    const modal = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(modal, 'width', '420px');
    this.renderer.setStyle(modal, 'max-width', '95vw');
    this.renderer.setStyle(modal, 'background', '#fff');
    this.renderer.setStyle(modal, 'border-radius', '10px');
    this.renderer.setStyle(modal, 'box-shadow', '0 18px 55px rgba(0,0,0,0.45)');
    this.renderer.setStyle(modal, 'overflow', 'hidden');

    // Header
    const header = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(header, 'background', '#0d6efd');
    this.renderer.setStyle(header, 'color', '#fff');
    this.renderer.setStyle(header, 'padding', '12px 16px');
    this.renderer.setStyle(header, 'display', 'flex');
    this.renderer.setStyle(header, 'align-items', 'center');
    this.renderer.setStyle(header, 'justify-content', 'space-between');
    const titleEl = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(titleEl, 'font-weight', '700');
    this.renderer.appendChild(titleEl, this.renderer.createText('Nuevo Proveedor'));
    const closeBtn = this.renderer.createElement('button') as HTMLButtonElement;
    this.renderer.setAttribute(closeBtn, 'type', 'button');
    this.renderer.addClass(closeBtn, 'btn-close');
    this.renderer.addClass(closeBtn, 'btn-close-white');
    this.renderer.appendChild(header, titleEl);
    this.renderer.appendChild(header, closeBtn);

    // Body
    const body = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(body, 'padding', '16px');

    const msg = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(msg, 'font-size', '13px');
    this.renderer.setStyle(msg, 'color', '#856404');
    this.renderer.setStyle(msg, 'margin-bottom', '12px');
    this.renderer.setStyle(msg, 'padding', '10px');
    this.renderer.setStyle(msg, 'background', '#fff3cd');
    this.renderer.setStyle(msg, 'border', '1px solid #ffc107');
    this.renderer.setStyle(msg, 'border-radius', '4px');
    this.renderer.setStyle(msg, 'font-weight', '600');
    this.renderer.appendChild(msg, this.renderer.createText('⚠ Ingresa la compañía y/o el contacto principal'));
    body.appendChild(msg);

    const mkField = (label: string, placeholder: string, onChange: (v: string) => void, type = 'text') => {
      const wrap = this.renderer.createElement('div') as HTMLElement;
      this.renderer.setStyle(wrap, 'margin-bottom', '10px');
      const lbl = this.renderer.createElement('label') as HTMLElement;
      this.renderer.setStyle(lbl, 'font-size', '12px');
      this.renderer.setStyle(lbl, 'font-weight', '700');
      this.renderer.setStyle(lbl, 'margin-bottom', '4px');
      this.renderer.setStyle(lbl, 'display', 'block');
      this.renderer.appendChild(lbl, this.renderer.createText(label));
      const input = this.renderer.createElement('input') as HTMLInputElement;
      this.renderer.setAttribute(input, 'type', type);
      this.renderer.addClass(input, 'form-control');
      this.renderer.addClass(input, 'form-control-sm');
      this.renderer.setAttribute(input, 'placeholder', placeholder);
      this.renderer.appendChild(wrap, lbl);
      this.renderer.appendChild(wrap, input);
      this.overlayListeners.push(this.renderer.listen(input, 'input', (e: any) => onChange(String(e?.target?.value ?? ''))));
      return wrap;
    };

    body.appendChild(mkField('Compañía *', 'Nombre de la empresa', v => { this.newProv.company = v; }));
    body.appendChild(mkField('Contacto principal', 'Nombre del contacto', v => { this.newProv.nameContact = v; }));
    body.appendChild(mkField('Teléfono', '10 dígitos', v => { this.newProv.phone = v; }));
    body.appendChild(mkField('Correo', 'correo@ejemplo.com', v => { this.newProv.email = v; }, 'email'));

    // Footer
    const footer = this.renderer.createElement('div') as HTMLElement;
    this.renderer.setStyle(footer, 'padding', '10px 16px');
    this.renderer.setStyle(footer, 'border-top', '1px solid #dee2e6');
    this.renderer.setStyle(footer, 'display', 'flex');
    this.renderer.setStyle(footer, 'justify-content', 'flex-end');
    this.renderer.setStyle(footer, 'gap', '8px');
    const cancelBtn = this.renderer.createElement('button') as HTMLButtonElement;
    this.renderer.setAttribute(cancelBtn, 'type', 'button');
    this.renderer.addClass(cancelBtn, 'btn');
    this.renderer.addClass(cancelBtn, 'btn-sm');
    this.renderer.addClass(cancelBtn, 'btn-secondary');
    this.renderer.appendChild(cancelBtn, this.renderer.createText('Cancelar'));
    const createBtn = this.renderer.createElement('button') as HTMLButtonElement;
    this.renderer.setAttribute(createBtn, 'type', 'button');
    this.renderer.addClass(createBtn, 'btn');
    this.renderer.addClass(createBtn, 'btn-sm');
    this.renderer.addClass(createBtn, 'btn-primary');
    this.renderer.appendChild(createBtn, this.renderer.createText('Crear Proveedor'));
    this.renderer.appendChild(footer, cancelBtn);
    this.renderer.appendChild(footer, createBtn);

    this.overlayListeners.push(this.renderer.listen(closeBtn, 'click', () => this.closeOverlay()));
    this.overlayListeners.push(this.renderer.listen(cancelBtn, 'click', () => this.closeOverlay()));
    this.overlayListeners.push(this.renderer.listen(backdrop, 'click', () => this.closeOverlay()));
    this.overlayListeners.push(this.renderer.listen(modal, 'click', (e: Event) => e.stopPropagation()));
    this.overlayListeners.push(this.renderer.listen(createBtn, 'click', () => void this.confirmNewProvider()));

    this.renderer.appendChild(modal, header);
    this.renderer.appendChild(modal, body);
    this.renderer.appendChild(modal, footer);
    this.renderer.appendChild(backdrop, modal);
    this.renderer.appendChild(document.body, backdrop);
    this.overlayEl = backdrop;
  }

  private closeOverlay(): void {
    this.overlayListeners.forEach(fn => { try { fn(); } catch {} });
    this.overlayListeners = [];
    if (this.overlayEl) {
      try { this.renderer.removeChild(document.body, this.overlayEl); } catch {}
      this.overlayEl = null;
    }
  }

  // Normaliza un nombre para comparar duplicados: trim + mayúsculas + colapsar espacios.
  private normalizeName(s: string): string {
    return String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  private async confirmNewProvider(): Promise<void> {
    const company = this.newProv.company.trim();
    const contact = this.newProv.nameContact.trim();
    if (!company && !contact) {
      alerts.reqErrorToast('Requerido', 'Ingresa la compañía y/o el contacto principal');
      return;
    }

    // Validación de duplicados: bloquear si ya existe un proveedor con el mismo nombre.
    const existentes = new Set(
      this.providers
        .filter(p => !p.__isHeader && p.id !== this.NEW_SENTINEL)
        .map(p => this.normalizeName(p.description))
    );
    const companyN = this.normalizeName(company);
    const contactN = this.normalizeName(contact);
    if ((companyN && existentes.has(companyN)) || (contactN && existentes.has(contactN))) {
      const dup = (companyN && existentes.has(companyN)) ? company : contact;
      alerts.basicAlert(
        'Proveedor duplicado',
        `Ya existe un proveedor registrado como "${dup}". No se puede registrar de nuevo; selecciónalo de la lista.`,
        'warning'
      );
      return;   // mantiene el formulario abierto, no crea nada
    }

    // Duplicado entre INACTIVOS → ofrecer reactivar en vez de crear otro.
    const inactivo = this.inactiveProviders.find(p => {
      const n = this.normalizeName(p.name);
      return (companyN && n === companyN) || (contactN && n === contactN);
    });
    if (inactivo) {
      const res = await alerts.confirmAlert(
        'Proveedor inactivo',
        `El proveedor "${inactivo.name}" ya está registrado pero está inactivo. ¿Te gustaría activarlo?`,
        'question', 'Sí, activar'
      );
      if (!res.isConfirmed) return;   // no crea ni activa
      try {
        // Reactivar PUT con el objeto que ya tenemos (no usar getCustomerById: GET /Customer/{id} da 404).
        await lastValueFrom(this.customersService.updateCustomer(inactivo.id, { ...(inactivo.raw || {}), active: true, vigente: true }));
        if (this.params.onNewProviderCreated) this.params.onNewProviderCreated(inactivo.name);
        this.closeOverlay();
        alerts.reqSuccessToast('Reactivado', `Proveedor "${inactivo.name}" activado`);
        await this.runValidationAndClose(inactivo.id, inactivo.name);
      } catch {
        alerts.reqErrorToast('Error', 'No se pudo activar el proveedor');
      }
      return;
    }

    try {
      const idRoot = this.signalsService.getRootSelectedBySidebar()();
      const payload = {
        idRoot, type: 'PROVIDERS', typeIntOrExt: 'Externo',
        active: true, vigente: true, autorizacion: true, position: 'GERENCIA',
        company: company.toUpperCase(),
        nameContact: contact.toUpperCase(),
        phone: this.newProv.phone.trim(),
        email: this.newProv.email.trim(),
      };
      const created: any = await lastValueFrom(this.customersService.addCustomer(payload));
      const newId = created?.id || created?.ID;
      if (!newId) throw new Error('Sin ID');

      await lastValueFrom(this.providersService.addProviderXTable({
        campo1: 0, campo2: contact || company, campo3: 'GERENCIA',
        campo4: this.newProv.phone.trim(), campo5: this.newProv.email.trim(),
        campo6: 'NA', campo7: true, idTabla: newId, type: 'CONTACT',
      })).catch(() => {});

      const name = company || contact;
      // Notificar al padre para recargar la lista de proveedores.
      if (this.params.onNewProviderCreated) this.params.onNewProviderCreated(name);
      this.closeOverlay();
      alerts.reqSuccessToast('Éxito', `Proveedor "${name}" creado`);
      // Correr las mismas validaciones que al seleccionar un proveedor existente
      // (Sin Código Externo + Sucursal) — igual que cotización llama onProviderChange().
      await this.runValidationAndClose(newId, name);
    } catch {
      alerts.reqErrorToast('Error', 'No se pudo crear el proveedor');
    }
  }
}
