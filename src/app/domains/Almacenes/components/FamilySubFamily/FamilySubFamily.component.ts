import { Component, effect, HostListener, inject } from '@angular/core';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-enterprise';
import { CommonModule } from '@angular/common';
import { FamilySubFamily } from 'app/services/familySubFamily.service';
import { SignalsService } from 'app/services/signals.service';

@Component({
  selector: 'app-family-sub-family',
  standalone: true,
  imports: [AgGridModule, CommonModule ],
  templateUrl: './FamilySubFamily.component.html',
})
export class FamilySubFamilyComponent { 

  private familySubFamily = inject(FamilySubFamily);
  private signalsService = inject(SignalsService);

  idRoot: number;
  rowData: any[];

  constructor() {
    effect(() => {
      this.idRoot = this.signalsService.getRootSelectedBySidebar()();
      this.loadCatalogData();
    });
  }
  onRowGroupOpened = (event) => {
  const openedKey = event.node.key;
  const isExpanded = event.node.expanded;

  if (!isExpanded) return; // solo actuamos cuando se expande

  event.api.forEachNode((node) => {
    if (node.group && node.key !== openedKey) {
      node.setExpanded(false); // cerramos los otros
    }
  });
};


  loadCatalogData(){
    this.familySubFamily.getCatalogsFamilySubFamily(this.idRoot).subscribe(
      (data: any) => {
        this.rowData = data;
        console.log(data)
      },
      (error) => console.error('Error fetching data:', error)
    );
  }

  revert(){
    this.loadCatalogData();
  }
  get columnDefs(): ColDef[] {
      return [
        {
          headerName: 'Familia',
          field: 'familia',
          rowGroup: true,
          hide: true,
        },
        {
          headerName: 'SubFamilia',
          field: 'subfamilia',
        },
        {
          headerName: 'Activo',
          editable: true,
          field: 'status',
        }
      ]
    }
}
