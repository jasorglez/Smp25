import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root'
})
export class SignalrService {
  private readonly receivedReportEvents = new Set<string>();
  private hubConnection: signalR.HubConnection | null = null;
  private connectionState = new BehaviorSubject<string>('Disconnected');

  // Observables para los eventos - MANTENIDOS EXACTAMENTE IGUAL
  private photoUpdateSubject = new Subject<any>();
  private textUpdateSubject = new BehaviorSubject<any>(null);

  // **NUEVO: Observable para nuevos reportes diarios**
  private newDailyReportSubject = new BehaviorSubject<any>(null);

  // **NUEVO: Observable para egresos guardados desde el bot**
  private egresoUpdateSubject = new BehaviorSubject<any>(null);

  // TelegramHub — conexión al bot de Telegram para recibir eventos en tiempo real
  private telegramHubConnection: signalR.HubConnection | null = null;
  private telegramRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private cobranzaHubConnection: signalR.HubConnection | null = null;
  private cobranzaCompanyId: number | null = null;
  private cobranzaPaymentSubject = new Subject<any>();
  public cobranzaPayment$ = this.cobranzaPaymentSubject.asObservable();
  private cobranzaUpcomingPaymentsSubject = new Subject<any>();
  public cobranzaUpcomingPayments$ = this.cobranzaUpcomingPaymentsSubject.asObservable();

  // AdmonHub — conexión independiente para actualizaciones de ingresos/egresos
  private admonHubConnection: signalR.HubConnection | null = null;
  private admonUpdateSubject = new BehaviorSubject<any>(null);
  public admonUpdate$ = this.admonUpdateSubject.asObservable();

  // SessionHub (Security) — avisa en tiempo real cuando un nuevo login desplaza la sesión actual
  private sessionHubConnection: signalR.HubConnection | null = null;
  private sessionReplacedSubject = new Subject<any>();
  public sessionReplaced$ = this.sessionReplacedSubject.asObservable();

  // Exponer observables públicos - MANTENIDOS EXACTAMENTE IGUAL
  public connectionState$ = this.connectionState.asObservable();
  public photoUpdate$ = this.photoUpdateSubject.asObservable();
  public textUpdate$ = this.textUpdateSubject.asObservable();

  // **NUEVO: Observable público para nuevos reportes**
  public newDailyReport$ = this.newDailyReportSubject.asObservable();

  // **NUEVO: Observable público para egresos del bot**
  public egresoUpdate$ = this.egresoUpdateSubject.asObservable();

  constructor() { }

  // Método para iniciar conexión SIN JWT - CORREGIDA LA URL ESPECÍFICA
public startConnection(hubEndpoint: string = 'storageHub', token?: string): void {

  this.startTelegramConnection();
  if (this.hubConnection && this.hubConnection.state !== signalR.HubConnectionState.Disconnected) return;

  const hubUrl = `https://endpoints.biapp.com.mx/smp/${hubEndpoint}`;
 console.log('🔄 Iniciando conexión SignalR...');
 console.log('📡 URL:', hubUrl);

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
     
     // Diagnóstico adicional
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

     // **NUEVO: Listener para nuevos reportes diarios**
  this.hubConnection.on('ReceiveNewDailyReport', (reportData: any) => {
    console.log('📊 EVENTO RECIBIDO - ReceiveNewDailyReport:', reportData);
    try {
      const parsedData = typeof reportData === 'string' ? JSON.parse(reportData) : reportData;
      console.log('📊 Datos de nuevo reporte parseados:', parsedData);
      this.newDailyReportSubject.next(parsedData);
      console.log('📊 New daily report enviado a subscribers');
    } catch (error) {
      console.error('❌ Error parsing daily report data:', error);
      this.newDailyReportSubject.next(reportData);
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

  // Información de diagnóstico - CORREGIDA LA URL ESPECÍFICA
  private diagnosticInfo(): void {
    console.log('🔍 === INFORMACIÓN DE DIAGNÓSTICO ===');
    console.log('🌐 Environment URL:', environment.urlSmp);
    console.log('🎯 Target URL (hardcoded):', 'https://endpoints.biapp.com.mx/storageHub');
    console.log('🔒 Origin:', window.location.origin);
    console.log('📍 Current URL:', window.location.href);
    console.log('🚀 User Agent:', navigator.userAgent);
    
    // Probar conectividad básica
    this.testConnectivity();
  }

  // Probar conectividad básica - CORREGIDA LA URL ESPECÍFICA
  private async testConnectivity(): Promise<void> {
    try {
      const hubUrl = 'https://endpoints.biapp.com.mx/storageHub';
      console.log('🧪 Testing connectivity to:', hubUrl);
      
      const response = await fetch(`${hubUrl}/negotiate?negotiateVersion=1`, {
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

  // Conexión al hub del bot Telegram — emite ReceivePhotoUpdate, ReceiveTextUpdate, ReceiveNewDailyReport
  public startTelegramConnection(): void {
    if (this.telegramRetryTimer) clearTimeout(this.telegramRetryTimer);
    if (this.telegramHubConnection?.state === signalR.HubConnectionState.Connected ||
        this.telegramHubConnection?.state === signalR.HubConnectionState.Reconnecting ||
        this.telegramHubConnection?.state === signalR.HubConnectionState.Connecting) {
      return;
    }

    const hubUrl = 'https://endpoints.biapp.com.mx/telegram/storageHub';
    console.log('🤖 Iniciando conexión Telegram SignalR:', hubUrl);

    this.telegramHubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        withCredentials: false,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: retryContext =>
          Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000)
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.telegramHubConnection.on('ReceiveReportEvent', (event: any) => {
      try {
        const envelope = typeof event === 'string' ? JSON.parse(event) : event;
        if (!envelope?.eventId || this.receivedReportEvents.has(envelope.eventId)) return;
        const subjects = {
          ReceivePhotoUpdate: this.photoUpdateSubject,
          ReceiveTextUpdate: this.textUpdateSubject,
          ReceiveNewDailyReport: this.newDailyReportSubject
        };
        const subject = subjects[envelope.eventName];
        if (!subject || !envelope.payload || typeof envelope.payload !== 'object') return;
        this.receivedReportEvents.add(envelope.eventId);
        if (this.receivedReportEvents.size > 1000) {
          this.receivedReportEvents.delete(this.receivedReportEvents.values().next().value!);
        }
        subject.next(envelope.payload);
      } catch (error) {
        console.error('Aviso de reporte inválido:', error);
      }
    });

    // Reutiliza los mismos subjects para que los componentes no necesiten cambiar
    this.telegramHubConnection.on('ReceivePhotoUpdate', (data: any) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      console.log('📸 [TelegramHub] ReceivePhotoUpdate:', parsed);
      this.photoUpdateSubject.next(parsed);
    });

    this.telegramHubConnection.on('ReceiveTextUpdate', (data: any) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      console.log('📝 [TelegramHub] ReceiveTextUpdate:', parsed);
      this.textUpdateSubject.next(parsed);
    });

    this.telegramHubConnection.on('ReceiveNewDailyReport', (data: any) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      console.log('📊 [TelegramHub] ReceiveNewDailyReport:', parsed);
      this.newDailyReportSubject.next(parsed);
    });

    this.telegramHubConnection.on('ReceiveEgresoUpdate', (data: any) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      console.log('💸 [TelegramHub] ReceiveEgresoUpdate:', parsed);
      this.egresoUpdateSubject.next(parsed);
    });

    this.telegramHubConnection
      .start()
      .then(() => console.log('✅ TelegramHub conectado'))
      .catch(err => {
        console.error('❌ TelegramHub error:', err);
        if (this.telegramHubConnection) {
          this.telegramRetryTimer = setTimeout(() => this.startTelegramConnection(), 5000);
        }
      });
  }

  public startCobranzaConnection(companyId: number): void {
    if (!companyId || companyId <= 0) return;
    const previousCompanyId = this.cobranzaCompanyId;
    this.cobranzaCompanyId = companyId;
    if (this.cobranzaHubConnection?.state === signalR.HubConnectionState.Connected) {
      const switchCompany = previousCompanyId && previousCompanyId !== companyId
        ? this.cobranzaHubConnection.invoke('LeaveCompany', previousCompanyId)
        : Promise.resolve();
      void switchCompany.then(() => this.cobranzaHubConnection?.invoke('JoinCompany', companyId)).catch(err =>
        console.error('No se pudo unir a las notificaciones de Cobranza:', err));
      return;
    }
    if (this.cobranzaHubConnection?.state === signalR.HubConnectionState.Connecting ||
        this.cobranzaHubConnection?.state === signalR.HubConnectionState.Reconnecting) return;

    this.cobranzaHubConnection = new signalR.HubConnectionBuilder()
      .withUrl('https://endpoints.biapp.com.mx/telegram/cobranzaHub', {
        accessTokenFactory: () => localStorage.getItem('token') || '',
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        withCredentials: false,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.cobranzaHubConnection.on('ReceiveCobranzaPayment', (data: any) => {
      this.cobranzaPaymentSubject.next(typeof data === 'string' ? JSON.parse(data) : data);
    });
    this.cobranzaHubConnection.on('ReceiveCobranzaUpcomingPayments', (data: any) => {
      this.cobranzaUpcomingPaymentsSubject.next(typeof data === 'string' ? JSON.parse(data) : data);
    });
    this.cobranzaHubConnection.onreconnected(() => {
      if (this.cobranzaCompanyId) void this.cobranzaHubConnection?.invoke('JoinCompany', this.cobranzaCompanyId);
    });
    void this.cobranzaHubConnection.start()
      .then(() => this.cobranzaCompanyId && this.cobranzaHubConnection?.invoke('JoinCompany', this.cobranzaCompanyId))
      .catch(err => console.error('No se pudo conectar a las notificaciones de Cobranza:', err));
  }

  public stopCobranzaConnection(): void {
    this.cobranzaCompanyId = null;
    void this.cobranzaHubConnection?.stop();
    this.cobranzaHubConnection = null;
  }

  public stopTelegramConnection(): void {
    if (this.telegramRetryTimer) clearTimeout(this.telegramRetryTimer);
    this.telegramRetryTimer = null;
    if (this.telegramHubConnection) {
      this.telegramHubConnection.stop();
      this.telegramHubConnection = null;
    }
  }

  public isTelegramConnected(): boolean {
    return this.telegramHubConnection?.state === signalR.HubConnectionState.Connected;
  }

  // Conexión al AdmonHub del microservicio Administration para actualizaciones en tiempo real
  public startAdmonConnection(token?: string): void {
    if (this.admonHubConnection?.state === signalR.HubConnectionState.Connected ||
        this.admonHubConnection?.state === signalR.HubConnectionState.Connecting) {
      return;
    }

    const hubUrl = 'https://endpoints.biapp.com.mx/administration/admonHub';

    this.admonHubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token || '',
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        withCredentials: false
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: retryContext =>
          Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000)
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.admonHubConnection.on('ReceiveAdmonUpdate', (data: any) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      this.admonUpdateSubject.next(parsed);
    });

    this.admonHubConnection.start()
      .then(() => console.log('✅ AdmonHub conectado'))
      .catch(err => console.error('❌ AdmonHub error:', err));
  }

  public stopAdmonConnection(): void {
    if (this.admonHubConnection) {
      this.admonHubConnection.stop();
      this.admonHubConnection = null;
    }
  }

  // Conexión al SessionHub del microservicio Security — control de sesión única por usuario.
  public startSessionConnection(token: string, sessionId: string): void {
    if (!sessionId) return;
    if (this.sessionHubConnection?.state === signalR.HubConnectionState.Connected ||
        this.sessionHubConnection?.state === signalR.HubConnectionState.Connecting) {
      return;
    }

    const hubUrl = 'https://endpoints.biapp.com.mx/sessionHub';

    this.sessionHubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token || '',
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
        withCredentials: false
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: retryContext =>
          Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000)
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.sessionHubConnection.on('SessionReplaced', (data: any) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      this.sessionReplacedSubject.next(parsed);
    });

    this.sessionHubConnection.onreconnected(() => {
      void this.sessionHubConnection?.invoke('JoinSession', sessionId);
    });

    this.sessionHubConnection.start()
      .then(() => this.sessionHubConnection?.invoke('JoinSession', sessionId))
      .catch(err => console.error('❌ SessionHub error:', err));
  }

  public stopSessionConnection(): void {
    if (this.sessionHubConnection) {
      this.sessionHubConnection.stop();
      this.sessionHubConnection = null;
    }
  }

  public notifyAdmonUpdate(type: string, idRoot: number): void {
    if (this.admonHubConnection?.state === signalR.HubConnectionState.Connected) {
      this.admonHubConnection.invoke('NotifyAdmonUpdate', type, idRoot).catch(() => {});
    }
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

  // Método para obtener información de estado - CORREGIDA LA URL ESPECÍFICA
  public getConnectionInfo(): any {
    return {
      isConnected: this.isConnected(),
      state: this.hubConnection?.state,
      connectionId: (this.hubConnection as any)?.connectionId || 'Unknown',
      baseUrl: (this.hubConnection as any)?.baseUrl || 'No connection',
      url: 'https://endpoints.biapp.com.mx/storageHub',
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
