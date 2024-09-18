import { inject, Injectable } from '@angular/core';

import { environment } from '@env/environment';

import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class OilfieldService {
  private http = inject(HttpClient);

  private getAuthToken(): string {
    return localStorage.getItem('token') || '';
  }

  private getHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  getOilfields() {
    return this.http.get(`${environment.urlLinux3}/Oilfield`, { headers: this.getHeaders() });
  }
}
