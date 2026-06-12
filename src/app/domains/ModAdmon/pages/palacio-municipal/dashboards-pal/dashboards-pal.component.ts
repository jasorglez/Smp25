import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dashboards-pal',
  standalone: true,
  imports: [RouterModule, CommonModule, MatIconModule],
  templateUrl: './dashboards-pal.component.html',
  styleUrl: './dashboards-pal.component.scss',
})
export class DashboardsPalComponent {}
