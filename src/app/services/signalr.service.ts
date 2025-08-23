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
  
  // Observables para los eventos - MANTENIDOS EXACTAMENTE IGUAL
  private photoUpdateSubject = new BehaviorSubject<any>(null);
  private textUpdateSubject = new BehaviorSubject<any>(null);
  
  // Exponer observables públicos - MANTENIDOS EXACTAMENTE IGUAL
  public connectionState$ = this.connectionState.asObservable();
  public photoUpdate$ = this.photoUpdateSubject.asObservable();
  public textUpdate$ = this.textUpdateSubject.asObservable();

  constructor() { }

  // Método para iniciar conexión SIN JWT - MANTENIDO CON MEJORAS MÍNIMAS
  public startConnection(hubEndpoint: string = 'storageHub'): void {
    console.log('🔄 Iniciando conexión SignalR...');
    console.log('📡 URL:', `https://bi2.com.mx/SMP/storageHub`);
    console.log('🔓 Conectando sin token JWT');

    // Construir la conexión con configuraciones específicas para CORS - MEJORADO SOLO PARA CORS
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('https://bi2.com.mx/SMP/storageHub', {
        // Opciones específicas para manejar CORS - MANTENIDAS
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        // Configuración para credenciales - AJUSTADO SOLO ESTO
        withCredentials: false,  // Mantenido como false para evitar CORS
        headers: {
          'Content-Type': 'application/json'
        }
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: retryContext => {
          if (retryContext.previousRetryCount === 0) {
            return 0;
          }
          return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
        }
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Manejar eventos de conexión antes de iniciar - MANTENIDO EXACTAMENTE IGUAL
    this.setupConnectionHandlers();

    this.hubConnection
      .start()
      .then(() => {
        console.log('✅ SignalR Connection establecida exitosamente');
        console.log('🎯 Estado de conexión:', this.hubConnection?.state);
        console.log('🔗 Connection ID:', (this.hubConnection as any)?.connectionId);
        this.connectionState.next('Connected');
        this.setupEventListeners();
      })
      .catch(err => {
        console.error('❌ Error while starting SignalR connection: ', err);
        console.error('📋 Detalles del error:', {
          message: err.message,
          statusCode: err.statusCode,
          url: err.url || 'No URL available'
        });
        this.connectionState.next('Error');
        
        // Diagnóstico adicional - MANTENIDO
        this.diagnosticInfo();
      });
  }

  // Configurar manejadores de conexión - MANTENIDO EXACTAMENTE IGUAL
  private setupConnectionHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.onreconnecting(() => {
      console.log('🔄 SignalR Reconnecting...');
      this.connectionState.next('Reconnecting');
    });

    this.hubConnection.onreconnected((connectionId) => {
      console.log('🔄 SignalR Reconnected with ID:', connectionId);
      this.connectionState.next('Connected');
    });

    this.hubConnection.onclose((error) => {
      console.log('❌ SignalR Connection closed');
      if (error) {
        console.error('⚠️ Connection closed with error:', error);
      }
      this.connectionState.next('Disconnected');
    });
  }

  // Configurar listeners de eventos - MANTENIDO EXACTAMENTE IGUAL
  private setupEventListeners(): void {
    if (!this.hubConnection) {
      console.error('❌ No hub connection available para setup listeners');
      return;
    }

    console.log('🎧 Configurando event listeners de SignalR...');

    // Escuchar actualizaciones de fotos - MANTENIDO EXACTAMENTE IGUAL
    this.hubConnection.on('ReceivePhotoUpdate', (jsonData: string) => {
      console.log('📸 EVENTO RECIBIDO - ReceivePhotoUpdate:', jsonData);
      try {
        const photoData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        console.log('📸 Datos de foto parseados:', photoData);
        this.photoUpdateSubject.next(photoData);
        console.log('📸 Photo update enviado a subscribers');
      } catch (error) {
        console.error('❌ Error parsing photo data:', error);
        // Enviar datos crudos si no se puede parsear
        this.photoUpdateSubject.next(jsonData);
      }
    });

    // Escuchar actualizaciones de texto/reportes - MANTENIDO EXACTAMENTE IGUAL
    this.hubConnection.on('ReceiveTextUpdate', (jsonData: string) => {
      console.log('📝 EVENTO RECIBIDO - ReceiveTextUpdate:', jsonData);
      try {
        const textData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        console.log('📝 Datos de texto parseados:', textData);
        this.textUpdateSubject.next(textData);
        console.log('📝 Text update enviado a subscribers');
      } catch (error) {
        console.error('❌ Error parsing text data:', error);
        // Enviar datos crudos si no se puede parsear
        this.textUpdateSubject.next(jsonData);
      }
    });

    // Listener básico para testing - MANTENIDO EXACTAMENTE IGUAL
    this.hubConnection.on('ReceiveMessage', (user: string, message: string) => {
      console.log('💬 EVENTO BÁSICO RECIBIDO - ReceiveMessage:');
      console.log('👤 Usuario:', user);
      console.log('📄 Mensaje:', message);
    });

    // Listener para errores del servidor - MANTENIDO EXACTAMENTE IGUAL
    this.hubConnection.on('Error', (error: string) => {
      console.error('🚫 Error del servidor SignalR:', error);
    });

    console.log('✅ Event listeners configurados correctamente');
  }

  // Información de diagnóstico - MANTENIDO EXACTAMENTE IGUAL
  private diagnosticInfo(): void {
    console.log('🔍 === INFORMACIÓN DE DIAGNÓSTICO ===');
    console.log('🌐 Environment URL:', environment.urlSmp);
    console.log('🎯 Target URL:', `${environment.urlSmp}/SMP/storageHub`);
    console.log('🔒 Origin:', window.location.origin);
    console.log('📍 Current URL:', window.location.href);
    console.log('🚀 User Agent:', navigator.userAgent);
    
    // Probar conectividad básica
    this.testConnectivity();
  }

  // Probar conectividad básica - MANTENIDO EXACTAMENTE IGUAL
  private async testConnectivity(): Promise<void> {
    try {
      const response = await fetch(`${environment.urlSmp}/SMP/storageHub/negotiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'omit' // No enviar credenciales para evitar CORS issues
      });
      
      if (response.ok) {
        const negotiateResult = await response.json();
        console.log('✅ Negotiate successful:', negotiateResult);
      } else {
        console.error('❌ Negotiate failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Connectivity test failed:', error);
    }
  }

  // Método alternativo con configuración diferente - MANTENIDO EXACTAMENTE IGUAL
  public startConnectionAlternative(): void {
    console.log('🔄 Intentando conexión alternativa...');
    
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.urlSmp}/SMP/storageHub`, {
        transport: signalR.HttpTransportType.LongPolling, // Solo Long Polling
        withCredentials: false,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      })
      .build();

    this.setupConnectionHandlers();
    
    this.hubConnection.start()
      .then(() => {
        console.log('✅ Conexión alternativa exitosa');
        this.connectionState.next('Connected');
        this.setupEventListeners();
      })
      .catch(err => {
        console.error('❌ Conexión alternativa falló:', err);
        this.connectionState.next('Error');
      });
  }

  // Método para parar conexión - MANTENIDO EXACTAMENTE IGUAL
  public stopConnection(): void {
    if (this.hubConnection) {
      console.log('⏹️ Deteniendo conexión SignalR...');
      this.hubConnection.stop();
      this.connectionState.next('Disconnected');
    }
  }

  // Método de utilidad para verificar conexión - MANTENIDO EXACTAMENTE IGUAL
  public isConnected(): boolean {
    return this.hubConnection?.state === signalR.HubConnectionState.Connected;
  }

  // Método para testing - enviar mensaje de prueba - MANTENIDO EXACTAMENTE IGUAL
  public async sendTestMessage(): Promise<void> {
    if (this.hubConnection && this.isConnected()) {
      console.log('🧪 Enviando mensaje de prueba...');
      try {
        await this.hubConnection.invoke('SendMessage', 'TestUser', 'Mensaje de prueba desde Angular');
        console.log('✅ Mensaje de prueba enviado exitosamente');
      } catch (err) {
        console.error('❌ Error enviando mensaje de prueba:', err);
      }
    } else {
      console.error('❌ No hay conexión SignalR activa');
      console.log('📊 Estado actual:', this.hubConnection?.state);
      
      // Intentar reconectar
      if (this.hubConnection?.state === signalR.HubConnectionState.Disconnected) {
        console.log('🔄 Intentando reconectar...');
        this.startConnection();
      }
    }
  }

  // Método para obtener información de estado - MANTENIDO EXACTAMENTE IGUAL
  public getConnectionInfo(): any {
    return {
      isConnected: this.isConnected(),
      state: this.hubConnection?.state,
      connectionId: (this.hubConnection as any)?.connectionId || 'Unknown',
      baseUrl: (this.hubConnection as any)?.baseUrl || 'No connection',
      url: `${environment.urlSmp}/SMP/storageHub`,
      authMode: 'No JWT required',
      transport: 'WebSockets + LongPolling'
    };
  }

  // Método de reinicio completo - MANTENIDO EXACTAMENTE IGUAL
  public restartConnection(): void {
    console.log('🔄 Reiniciando conexión SignalR...');
    this.stopConnection();
    setTimeout(() => {
      this.startConnection();
    }, 1000);
  }
}