import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { AG_GRID_LOCALE_ES } from 'assets/i18n/ag-grid.locale.es';
import { SignalsService } from 'app/services/signals.service';
import { MaterialsService } from 'app/services/materials.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-prep1-principal',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: `
  `
})
export class Prep1PrincipalComponent implements OnInit {

  constructor() { }

  ngOnInit() { }

}
