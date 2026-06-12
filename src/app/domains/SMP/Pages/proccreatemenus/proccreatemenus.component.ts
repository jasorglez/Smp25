
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { environment } from '@env/environment';
import { DomainsModule } from 'app/domains/domainsmodule';
import { AuthService } from 'app/services/auth.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-proccreatemenus',
  standalone: true,
  imports: [RouterModule, DomainsModule],
  templateUrl: './proccreatemenus.component.html'
  
})
export class ProccreatemenusComponent {

    private signalsService = inject(SignalsService);
    authService = inject(AuthService);
  
    //comentario soriano
    
  idRoot: number;
  isRoot: boolean = false;
  canSeeBranches: boolean = false;
  canSeeUsers: boolean = false;

  ngOnInit() {
     if (this.signalsService.getemailChoose() === environment.root) {
         this.isRoot = true;
       }
       else {
         this.isRoot = false;
       }
   
       this.canSeeBranches = this.isRoot || this.authService.hasDetailedPermission('setup', 'branches');
       this.canSeeUsers = this.authService.hasDetailedPermission('setup', 'users');
  }

}
