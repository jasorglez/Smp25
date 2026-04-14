import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrackingService } from 'app/services/tracking.service';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="welcome-wrapper">

      <!-- Partículas flotantes de fondo -->
      <div class="particle p1"></div>
      <div class="particle p2"></div>
      <div class="particle p3"></div>
      <div class="particle p4"></div>
      <div class="particle p5"></div>
      <div class="particle p6"></div>

      <div class="welcome-text">
        <p class="greeting">{{ greeting }},</p>
        <h1 class="username">{{ userName }}</h1>
        <div class="divider"></div>
        <p class="subtitle">Nos alegra tenerte de vuelta. ¿Listo para empezar?</p>
        <div class="badges">
          <span class="badge-item">
            <i class="bi bi-clock"></i> {{ currentTime }}
          </span>
          <span class="badge-item">
            <i class="bi bi-calendar3"></i> {{ currentDate }}
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .welcome-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 88vh;
      overflow: hidden;
      background: linear-gradient(135deg, #f0f4ff 0%, #e8f5ff 40%, #f5f0ff 100%);
    }

    /* ── Partículas de fondo ── */
    .particle {
      position: absolute;
      border-radius: 50%;
      opacity: 0.18;
      animation: float-particle linear infinite;
    }
    .p1 { width: 80px;  height: 80px;  background: #3498db; top: 10%; left: 8%;  animation-duration: 14s; animation-delay: 0s; }
    .p2 { width: 50px;  height: 50px;  background: #9b59b6; top: 65%; left: 4%;  animation-duration: 18s; animation-delay: 2s; }
    .p3 { width: 110px; height: 110px; background: #2ecc71; top: 20%; right: 6%; animation-duration: 20s; animation-delay: 1s; }
    .p4 { width: 60px;  height: 60px;  background: #e74c3c; top: 75%; right: 8%; animation-duration: 15s; animation-delay: 3s; }
    .p5 { width: 40px;  height: 40px;  background: #f39c12; top: 45%; left: 2%;  animation-duration: 12s; animation-delay: 0.5s; }
    .p6 { width: 90px;  height: 90px;  background: #1abc9c; top: 5%;  right: 25%; animation-duration: 22s; animation-delay: 4s; }

    @keyframes float-particle {
      0%   { transform: translateY(0px) rotate(0deg); }
      50%  { transform: translateY(-40px) rotate(180deg); }
      100% { transform: translateY(0px) rotate(360deg); }
    }

    /* ── Texto ── */
    .welcome-text {
      text-align: center;
      z-index: 1;
    }

    .greeting {
      font-size: 2rem;
      color: #7f8c8d;
      margin: 0 0 8px;
      font-weight: 500;
      animation: slide-up 0.6s ease forwards;
      animation-delay: 0.3s;
      opacity: 0;
    }

    .username {
      font-size: 4.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, #2980b9, #8e44ad);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin: 0 0 20px;
      line-height: 1.1;
      animation: slide-up 0.6s ease forwards;
      animation-delay: 0.5s;
      opacity: 0;
    }

    .divider {
      width: 80px;
      height: 5px;
      background: linear-gradient(90deg, #2980b9, #8e44ad);
      border-radius: 3px;
      margin: 0 auto 24px;
      animation: expand-bar 0.8s ease forwards;
      animation-delay: 0.7s;
      transform-origin: left;
      transform: scaleX(0);
    }

    @keyframes expand-bar {
      to { transform: scaleX(1); }
    }

    .subtitle {
      font-size: 1.4rem;
      color: #555;
      margin: 0 0 32px;
      line-height: 1.6;
      animation: slide-up 0.6s ease forwards;
      animation-delay: 0.8s;
      opacity: 0;
    }

    .badges {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      justify-content: center;
      animation: slide-up 0.6s ease forwards;
      animation-delay: 1.0s;
      opacity: 0;
    }

    .badge-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #f0f4ff, #e8f0ff);
      border: 1px solid #d0ddf7;
      color: #2980b9;
      font-size: 1.05rem;
      font-weight: 600;
      padding: 8px 20px;
      border-radius: 24px;
    }

    @keyframes slide-up {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class DashboardHomeComponent implements OnInit {
  private trackingService = inject(TrackingService);

  userName: string = '';
  greeting: string = '';
  currentTime: string = '';
  currentDate: string = '';

  private clockInterval: any;

  ngOnInit(): void {
    this.userName = this.trackingService.getnameUser() || 'Usuario';
    this.updateTime();
    this.clockInterval = setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);
  }

  private updateTime(): void {
    const now = new Date();
    const hour = now.getHours();

    if (hour >= 5 && hour < 12)       this.greeting = 'Buenos días';
    else if (hour >= 12 && hour < 19) this.greeting = 'Buenas tardes';
    else                               this.greeting = 'Buenas noches';

    this.currentTime = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    this.currentDate = now.toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  }
}
