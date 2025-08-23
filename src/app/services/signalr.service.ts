import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class SignalrService {
  private hubConnection: signalR.HubConnection | null = null;
  private connectionState = new BehaviorSubject<string>('Disconnected');
  
  // Observables para los eventos
  private photoUpdateSubject = new BehaviorSubject<any>(null);
  private textUpdateSubject = new BehaviorSubject<any>(null);
  
  // Exponer observables públicos
  public connectionState$ = this.connectionState.asObservable();
  public photoUpdate$ = this.photoUpdateSubject.asObservable();
  public textUpdate$ = this.textUpdateSubject.asObservable();

  constructor() { }

  // Método para iniciar conexión CON JWT
  public startConnection(): void {
    // Obtener el token JWT
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('❌ No JWT token found');
      this.connectionState.next('Error');
      return;
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.urlSmp}/storageHub`, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => {
        console.log('✅ SignalR Connection started');
        this.connectionState.next('Connected');
        this.setupEventListeners();
      })
      .catch(err => {
        console.error('❌ Error while starting SignalR connection: ', err);
        this.connectionState.next('Error');
      });
  }

  // Configurar listeners de eventos
  private setupEventListeners(): void {
    if (!this.hubConnection) return;

    // Escuchar actualizaciones de fotos
    this.hubConnection.on('ReceivePhotoUpdate', (jsonData: string) => {
      console.log('📸 Photo update received:', jsonData);
      try {
        const photoData = JSON.parse(jsonData);
        this.photoUpdateSubject.next(photoData);
      } catch (error) {
        console.error('Error parsing photo data:', error);
      }
    });

    // Escuchar actualizaciones de texto/reportes
    this.hubConnection.on('ReceiveTextUpdate', (jsonData: string) => {
      console.log('📝 Text update received:', jsonData);
      try {
        const textData = JSON.parse(jsonData);
        this.textUpdateSubject.next(textData);
      } catch (error) {
        console.error('Error parsing text data:', error);
      }
    });

    // Manejar reconexión
    this.hubConnection.onreconnected(() => {
      console.log('🔄 SignalR Reconnected');
      this.connectionState.next('Connected');
    });

    this.hubConnection.onclose(() => {
      console.log('❌ SignalR Connection closed');
      this.connectionState.next('Disconnected');
    });
  }

  // Método para parar conexión
  public stopConnection(): void {
    if (this.hubConnection) {
      this.hubConnection.stop();
      this.connectionState.next('Disconnected');
    }
  }

  // Método de utilidad para verificar conexión
  public isConnected(): boolean {
    return this.hubConnection?.state === signalR.HubConnectionState.Connected;
  }
}
