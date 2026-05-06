import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SideBarComponent } from 'app/shared/side-bar/side-bar.component';
import { FooterComponent } from 'app/shared/footer/footer.component';
import { SignalsService } from '../../services/signals.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-main-page',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MatIconModule, SideBarComponent, FooterComponent],
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.scss'],
})
export class MainPageComponent implements OnInit {
  private signalsService = inject(SignalsService);
  auth = inject(AuthService);


  ngOnInit(): void { }
}
