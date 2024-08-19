import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NavBarComponent } from "../../shared/nav-bar/nav-bar.component";
import { SideBarComponent } from "../../shared/side-bar/side-bar.component";
import { FooterComponent } from "../../shared/footer/footer.component";

@Component({
  selector: 'app-main-page',
  standalone : true,
  imports: [RouterModule, NavBarComponent, SideBarComponent, FooterComponent],
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.scss']
})
export class MainPageComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
