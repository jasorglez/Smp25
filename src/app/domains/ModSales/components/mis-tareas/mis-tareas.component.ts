import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProspectosService, Tarea } from 'app/services/prospectos.service';
import { SignalsService } from 'app/services/signals.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-mis-tareas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mis-tareas.component.html',
})
export class MisTareasComponent {
  private svc        = inject(ProspectosService);
  private signalsSvc = inject(SignalsService);

  tareas: Tarea[] = [];
  loading = false;

  get idVendedor() { return this.signalsSvc.idUser(); }
  get idRoot()     { return this.signalsSvc.getRootSelectedBySidebar()(); }

  constructor() {
    effect(() => {
      const idRoot = this.signalsSvc.getRootSelectedBySidebar()();
      if (idRoot) this.cargar();
    });
  }

  async cargar() {
    if (!this.idVendedor || !this.idRoot) return;
    this.loading = true;
    this.tareas = await this.svc.getTareasByVendedor(this.idVendedor, this.idRoot);
    this.loading = false;
  }

  get vencidas() { return this.tareas.filter(t =>  this.esVencida(t)); }
  get hoy()      { return this.tareas.filter(t => !this.esVencida(t) &&  this.esHoy(t)); }
  get proximas() { return this.tareas.filter(t => !this.esVencida(t) && !this.esHoy(t)); }
  get pendientes(){ return this.vencidas.length + this.hoy.length; }

  esVencida(t: Tarea): boolean {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const f = (t.fechaVencimiento as any)?.toDate?.() ?? new Date(t.fechaVencimiento as any);
    f.setHours(0,0,0,0);
    return f < hoy;
  }

  esHoy(t: Tarea): boolean {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const f = (t.fechaVencimiento as any)?.toDate?.() ?? new Date(t.fechaVencimiento as any);
    f.setHours(0,0,0,0);
    return f.getTime() === hoy.getTime();
  }

  formatFecha(ts: any): string {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async completar(t: Tarea) {
    try {
      await this.svc.completarTarea(t.id!);
      this.tareas = this.tareas.filter(x => x.id !== t.id);
      Swal.fire({ icon: 'success', title: '¡Tarea completada!', timer: 1000, showConfirmButton: false });
    } catch {
      Swal.fire('Error', 'No se pudo completar.', 'error');
    }
  }

  async eliminar(t: Tarea) {
    const res = await Swal.fire({
      title: '¿Eliminar tarea?', text: t.descripcion,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#dc3545', confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar',
    });
    if (!res.isConfirmed) return;
    try {
      await this.svc.eliminarTarea(t.id!);
      this.tareas = this.tareas.filter(x => x.id !== t.id);
    } catch {
      Swal.fire('Error', 'No se pudo eliminar.', 'error');
    }
  }
}
