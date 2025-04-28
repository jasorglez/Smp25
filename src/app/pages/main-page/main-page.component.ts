import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SideBarComponent } from '../../shared/side-bar/side-bar.component';
import { FooterComponent } from '../../shared/footer/footer.component';

@Component({
  selector: 'app-main-page',
  standalone: true,
  imports: [RouterModule, SideBarComponent, FooterComponent],
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.scss'],
})
export class MainPageComponent {}
