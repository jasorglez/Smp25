import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '@env/environment';

interface MenuItemPublico {
  id: number;
  descripcion: string;
  precio: number;
  categoria: string;
  orden: number;
}

interface CarritoItem {
  idMenuItem: number;
  descripcion: string;
  precio: number;
  cantidad: number;
}

@Component({
  selector: 'app-menu-publico',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './menu-publico.component.html',
  styleUrls: ['./menu-publico.component.scss']
})
export class MenuPublicoComponent implements OnInit {

  readonly idCompany = 1; // ← cambiar al id de Cocina del Barrio

  menu        = signal<MenuItemPublico[]>([]);
  carrito     = signal<CarritoItem[]>([]);
  categorias  = signal<string[]>([]);
  cargando    = signal(true);
  enviando    = signal(false);
  pedidoOk    = signal(false);
  errorMsg    = signal('');

  nombre   = '';
  telefono = '';
  notas    = '';

  readonly hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

  private readonly apiBase = (environment as any).urlChatBot ?? 'https://endpoints.biapp.com.mx/telegram/api';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargarMenu();
  }

  cargarMenu() {
    this.cargando.set(true);
    this.http.get<MenuItemPublico[]>(`${this.apiBase}/restaurant-publico/menu/${this.idCompany}`)
      .subscribe({
        next: items => {
          this.menu.set(items);
          const cats = [...new Set(items.map(i => i.categoria || 'General'))];
          this.categorias.set(cats);
          this.cargando.set(false);
        },
        error: () => {
          this.errorMsg.set('No se pudo cargar el menú. Intenta de nuevo.');
          this.cargando.set(false);
        }
      });
  }

  itemsPorCategoria(cat: string) {
    return this.menu().filter(i => (i.categoria || 'General') === cat);
  }

  cantidadEnCarrito(idMenuItem: number): number {
    return this.carrito().find(c => c.idMenuItem === idMenuItem)?.cantidad ?? 0;
  }

  agregar(item: MenuItemPublico) {
    const carr = [...this.carrito()];
    const idx  = carr.findIndex(c => c.idMenuItem === item.id);
    if (idx >= 0) carr[idx].cantidad++;
    else carr.push({ idMenuItem: item.id, descripcion: item.descripcion, precio: item.precio, cantidad: 1 });
    this.carrito.set(carr);
  }

  quitar(item: MenuItemPublico) {
    const carr = [...this.carrito()];
    const idx  = carr.findIndex(c => c.idMenuItem === item.id);
    if (idx < 0) return;
    if (carr[idx].cantidad > 1) carr[idx].cantidad--;
    else carr.splice(idx, 1);
    this.carrito.set(carr);
  }

  get total(): number {
    return this.carrito().reduce((s, c) => s + c.precio * c.cantidad, 0);
  }

  get carritoVacio(): boolean {
    return this.carrito().length === 0;
  }

  enviarPedido() {
    if (!this.nombre.trim()) { this.errorMsg.set('Escribe tu nombre.'); return; }
    if (this.carritoVacio)   { this.errorMsg.set('Agrega al menos un platillo.'); return; }
    this.errorMsg.set('');
    this.enviando.set(true);

    const body = {
      idCompany:     this.idCompany,
      nombreCliente: this.nombre.trim(),
      telefono:      this.telefono.trim() || null,
      notas:         this.notas.trim() || null,
      items: this.carrito().map(c => ({ idMenuItem: c.idMenuItem, cantidad: c.cantidad }))
    };

    this.http.post(`${this.apiBase}/restaurant-publico/pedido`, body).subscribe({
      next: () => {
        this.enviando.set(false);
        this.pedidoOk.set(true);
        this.carrito.set([]);
      },
      error: () => {
        this.enviando.set(false);
        this.errorMsg.set('Error al enviar el pedido. Intenta de nuevo.');
      }
    });
  }
}
