import { Component } from '@angular/core';
import { SetupRootComponent } from "./setup-root/setup-root.component";
import { SetupBranchComponent } from "./setup-branch/setup-branch.component";

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [SetupRootComponent, SetupBranchComponent],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss'
})

export class SetupComponent {
}
