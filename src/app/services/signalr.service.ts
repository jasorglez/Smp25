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
  public startConnection(hubEndpoint: string = 'storageHub'): void {
    // Obtener el token JWT
    const token = localStorage.getItem('token');
    
    console.log('🔄 Iniciando conexión SignalR...');
    console.log('📡 URL:', `${environment.urlSmp}/${hubEndpoint}`);
    console.log('🔑 Token presente:', !!token);
    
    if (!token) {
      console.error('❌ No JWT token found en localStorage');
      this.connectionState.next('Error');
      return;
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.urlSmp}/${hubEndpoint}`, {
        accessTokenFactory: () => {
          console.log('🔑 Proporcionando token para autenticación');
          return token;
        }
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => {
        console.log('✅ SignalR Connection establecida exitosamente');
        console.log('🎯 Estado de conexión:', this.hubConnection?.state);
        this.connectionState.next('Connected');
        this.setupEventListeners();
      })
      .catch(err => {
        console.error('❌ Error while starting SignalR connection: ', err);
        console.error('📋 Detalles del error:', err.message || err);
        this.connectionState.next('Error');
      });
  }

  // Configurar listeners de eventos
  private setupEventListeners(): void {
    if (!this.hubConnection) {
      console.error('❌ No hub connection available para setup listeners');
      return;
    }

    console.log('🎧 Configurando event listeners de SignalR...');

    // Escuchar actualizaciones de fotos
    this.hubConnection.on('ReceivePhotoUpdate', (jsonData: string) => {
      console.log('📸 EVENTO RECIBIDO - ReceivePhotoUpdate:', jsonData);
      try {
        const photoData = JSON.parse(jsonData);
        console.log('📸 Datos de foto parseados:', photoData);
        this.photoUpdateSubject.next(photoData);
        console.log('📸 Photo update enviado a subscribers');
      } catch (error) {
        console.error('❌ Error parsing photo data:', error);
      }
    });

    // Escuchar actualizaciones de texto/reportes
    this.hubConnection.on('ReceiveTextUpdate', (jsonData: string) => {
      console.log('📝 EVENTO RECIBIDO - ReceiveTextUpdate:', jsonData);
      try {
        const textData = JSON.parse(jsonData);
        console.log('📝 Datos de texto parseados:', textData);
        this.textUpdateSubject.next(textData);
        console.log('📝 Text update enviado a subscribers');
      } catch (error) {
        console.error('❌ Error parsing text data:', error);
      }
    });

    // Listener básico para testing
    this.hubConnection.on('ReceiveMessage', (user: string, message: string) => {
      console.log('💬 EVENTO BÁSICO RECIBIDO - ReceiveMessage:');
      console.log('👤 Usuario:', user);
      console.log('📄 Mensaje:', message);
    });

    console.log('✅ Event listeners configurados correctamente');

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

  // Método para testing - enviar mensaje de prueba
  public sendTestMessage(): void {
    if (this.hubConnection && this.isConnected()) {
      console.log('🧪 Enviando mensaje de prueba...');
      this.hubConnection.invoke('SendMessage', 'TestUser', 'Mensaje de prueba desde Angular')
        .then(() => {
          console.log('✅ Mensaje de prueba enviado exitosamente');
        })
        .catch(err => {
          console.error('❌ Error enviando mensaje de prueba:', err);
        });
    } else {
      console.error('❌ No hay conexión SignalR activa para enviar mensaje de prueba');
      console.log('📊 Estado actual:', this.hubConnection?.state);
    }
  }

  // Método para obtener información de estado
  public getConnectionInfo(): any {
    return {
      isConnected: this.isConnected(),
      state: this.hubConnection?.state,
      url: this.hubConnection?.baseUrl || 'No connection',
      hasToken: !!localStorage.getItem('token')
    };
  }

  // Método para probar diferentes endpoints
  public testHubEndpoints(): void {
    const commonEndpoints = [
      'storageHub',
      'storage', 
      'hub',
      'hub/storage',
      'signalr',
      'signalr/storage'
    ];

    console.log('🔍 Probando endpoints comunes de SignalR...');
    console.log('Base URL:', environment.urlSmp);
    
    commonEndpoints.forEach(endpoint => {
      console.log(`🧪 Endpoint a probar: ${environment.urlSmp}/${endpoint}`);
    });

    console.log('💡 Para probar manualmente, usa:');
    console.log('signalrService.tryEndpoint("storage")');
  }

  // Método para probar un endpoint específico
  public tryEndpoint(endpoint: string): void {
    console.log(`🔄 Intentando conectar a: ${environment.urlSmp}/${endpoint}`);
    
    // Cerrar conexión actual si existe
    if (this.hubConnection) {
      this.hubConnection.stop();
    }
    
    this.startConnection(endpoint);
  }
}
