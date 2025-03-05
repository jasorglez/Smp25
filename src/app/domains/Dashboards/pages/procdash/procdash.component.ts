import { Component, inject } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import * as echarts from 'echarts';
import { DashboardService } from 'app/services/dashboard.service';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';


@Component({
  selector: 'app-procdash',
  standalone: true,
  imports: [RouterModule,  CommonModule],
  templateUrl: './procdash.component.html',
  styleUrl: './procdash.component.scss'
})
export class ProcdashComponent {
  activeTab: string = 'mxn'; // Pestaña activa por defecto

}
