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

    // **NUEVO: Observable para nuevos reportes diarios**
  private newDailyReportSubject = new BehaviorSubject<any>(null);
  
  // Exponer observables públicos - MANTENIDOS EXACTAMENTE IGUAL
  public connectionState$ = this.connectionState.asObservable();
  public photoUpdate$ = this.photoUpdateSubject.asObservable();
  public textUpdate$ = this.textUpdateSubject.asObservable();

    // **NUEVO: Observable público para nuevos reportes**
  public newDailyReport$ = this.newDailyReportSubject.asObservable();

  constructor() { }

  // Método para iniciar conexión SIN JWT - CORREGIDA LA URL ESPECÍFICA
public startConnection(hubEndpoint: string = 'storageHub', token?: string): void {

  const hubUrl = `https://bi2.com.mx/smp/${hubEndpoint}`;

 // Construir la conexión con token
 this.hubConnection = new signalR.HubConnectionBuilder()
   .withUrl(hubUrl, {
     accessTokenFactory: () => token || '', // 👈 AQUÍ PASA EL TOKEN
     skipNegotiation: false,
     transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
     withCredentials: false
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

 // Manejar eventos de conexión antes de iniciar
 this.setupConnectionHandlers();

 this.hubConnection
   .start()
   .then(() => {
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
     
     // Diagnóstico adicional
     this.diagnosticInfo();
   });
}

  // Configurar manejadores de conexión - MANTENIDO EXACTAMENTE IGUAL
  private setupConnectionHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.onreconnecting(() => {
      this.connectionState.next('Reconnecting');
    });

    this.hubConnection.onreconnected((connectionId) => {
      this.connectionState.next('Connected');
    });

    this.hubConnection.onclose((error) => {
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

    // Escuchar actualizaciones de fotos - MANTENIDO EXACTAMENTE IGUAL
    this.hubConnection.on('ReceivePhotoUpdate', (jsonData: string) => {
      try {
        const photoData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        this.photoUpdateSubject.next(photoData);
      } catch (error) {
        console.error('❌ Error parsing photo data:', error);
        // Enviar datos crudos si no se puede parsear
        this.photoUpdateSubject.next(jsonData);
      }
    });

    // Escuchar actualizaciones de texto/reportes - MANTENIDO EXACTAMENTE IGUAL
    this.hubConnection.on('ReceiveTextUpdate', (jsonData: string) => {
      try {
        const textData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        this.textUpdateSubject.next(textData);
      } catch (error) {
        console.error('❌ Error parsing text data:', error);
        // Enviar datos crudos si no se puede parsear
        this.textUpdateSubject.next(jsonData);
      }
    });

     // **NUEVO: Listener para nuevos reportes diarios**
  this.hubConnection.on('ReceiveNewDailyReport', (reportData: any) => {
    try {
      const parsedData = typeof reportData === 'string' ? JSON.parse(reportData) : reportData;
      this.newDailyReportSubject.next(parsedData);
    } catch (error) {
      console.error('❌ Error parsing daily report data:', error);
      this.newDailyReportSubject.next(reportData);
    }
  });

    // Listener básico para testing - MANTENIDO EXACTAMENTE IGUAL
    this.hubConnection.on('ReceiveMessage', (user: string, message: string) => {
    });

    // Listener para errores del servidor - MANTENIDO EXACTAMENTE IGUAL
    this.hubConnection.on('Error', (error: string) => {
      console.error('🚫 Error del servidor SignalR:', error);
    });

  }

  // Información de diagnóstico - CORREGIDA LA URL ESPECÍFICA
  private diagnosticInfo(): void {
    
    // Probar conectividad básica
    this.testConnectivity();
  }

  // Probar conectividad básica - CORREGIDA LA URL ESPECÍFICA
  private async testConnectivity(): Promise<void> {
    try {
      const hubUrl = 'https://bi2.com.mx/storageHub';
      
      const response = await fetch(`${hubUrl}/negotiate?negotiateVersion=1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'omit' // No enviar credenciales para evitar CORS issues
      });
      
      if (response.ok) {
        const negotiateResult = await response.json();
      } else {
        console.error('❌ Negotiate failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Connectivity test failed:', error);
    }
  }

  // Método alternativo con configuración diferente - MANTENIDO EXACTAMENTE IGUAL
  public startConnectionAlternative(): void {
    
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
      try {
        await this.hubConnection.invoke('SendMessage', 'TestUser', 'Mensaje de prueba desde Angular');
      } catch (err) {
        console.error('❌ Error enviando mensaje de prueba:', err);
      }
    } else {
      console.error('❌ No hay conexión SignalR activa');
      
      // Intentar reconectar
      if (this.hubConnection?.state === signalR.HubConnectionState.Disconnected) {
        this.startConnection();
      }
    }
  }

  // Método para obtener información de estado - CORREGIDA LA URL ESPECÍFICA
  public getConnectionInfo(): any {
    return {
      isConnected: this.isConnected(),
      state: this.hubConnection?.state,
      connectionId: (this.hubConnection as any)?.connectionId || 'Unknown',
      baseUrl: (this.hubConnection as any)?.baseUrl || 'No connection',
      url: 'https://bi2.com.mx/storageHub',
      authMode: 'No JWT required',
      transport: 'WebSockets + LongPolling'
    };
  }

  // Método de reinicio completo - MANTENIDO EXACTAMENTE IGUAL
  public restartConnection(): void {
    this.stopConnection();
    setTimeout(() => {
      this.startConnection();
    }, 1000);
  }
}
