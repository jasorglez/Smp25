import {Component, inject} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {AuthService} from "./services/auth.service";


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class AppComponent {
  title = 'bi-aug-24';

  private authService = inject(AuthService);

  ngOnInit() {
    this.loadPermissions();
  }

  private loadPermissions() {
    const email = localStorage.getItem('mail');
    if (email) {
      this.authService
        .getUserId(email.toString())
        .subscribe((userId) => {
          console.log(userId);
          this.authService.fetchUserPermissions(userId).subscribe(
            (data: any) => {
              console.log(data);
              this.authService.setUserPermissions(data.permissions);
            },
            (error) => {
              console.error('Error fetching user permissions:', error);
            }
          );
        });
    }
  }

}
