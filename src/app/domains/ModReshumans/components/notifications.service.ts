import { Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {

   // Creamos un signal vacío (null significa: no hay notificación al inicio)
  private notificacionSignal: WritableSignal<string | null> = signal(null);

  // Método para emitir una notificación
  enviarNotificacion(mensaje: string) {
    this.notificacionSignal.set(mensaje);
  }

  // Exponemos el signal para los componentes
  obtenerNotificacion() {
    return this.notificacionSignal;
  }

  // También podemos hacer un reset después de que alguien consuma la notificación
  limpiarNotificacion() {
    this.notificacionSignal.set(null);
  }
  constructor() { }

}
