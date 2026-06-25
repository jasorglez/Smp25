import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import * as signalR from '@microsoft/signalr';
import { environment } from '@env/environment';

interface TelegramLoginEvent {
  displayName: string;
  email: string;
  chatId: string;
  hora: string;
}

@Component({
  selector: 'app-telegram-monitor',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './telegram-monitor.component.html',
})
export class TelegramMonitorComponent implements OnInit, OnDestroy {
  active   = signal(false);
  events   = signal<TelegramLoginEvent[]>([]);

  private hub: signalR.HubConnection | null = null;
  private readonly STORAGE_KEY = 'telegramMonitorActive';
  private readonly HUB_URL = environment.urlChatBot.replace('/api', '') + '/storageHub';

  ngOnInit() {
    if (localStorage.getItem(this.STORAGE_KEY) === 'true') this.start();
  }

  ngOnDestroy() { this.stop(); }

  toggleActive() {
    this.active() ? this.stop() : this.start();
  }

  private start() {
    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(this.HUB_URL)
      .withAutomaticReconnect()
      .build();

    this.hub.on('TelegramLogin', (data: TelegramLoginEvent) => {
      this.events.update(list => [data, ...list].slice(0, 100));
    });

    this.hub.start()
      .then(() => {
        this.active.set(true);
        localStorage.setItem(this.STORAGE_KEY, 'true');
      })
      .catch(err => console.error('SignalR TelegramMonitor error:', err));
  }

  private stop() {
    this.hub?.stop();
    this.hub = null;
    this.active.set(false);
    localStorage.removeItem(this.STORAGE_KEY);
  }

  clearEvents() { this.events.set([]); }
}
