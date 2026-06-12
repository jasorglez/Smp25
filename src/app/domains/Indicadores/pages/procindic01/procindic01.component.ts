import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomainsModule } from 'app/domains/domainsmodule';
import { ConventionsComponent } from "../../../ModProjects/components/projects/conventions/conventions.component";
import { AdvancesComponent } from "../../components/ind01/advances/advances.component";
import { IssuesComponent } from '../../components/ind01/issues/issues.component';

@Component({
  selector: 'app-procindic01',
  standalone: true,
  imports: [RouterModule, DomainsModule, ConventionsComponent, AdvancesComponent, IssuesComponent],
  templateUrl: './procindic01.component.html',
  styleUrl: './procindic01.component.scss'
})
export class Procindic01Component {

}
