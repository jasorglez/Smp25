import { Component, inject, OnInit } from '@angular/core';
import { DomainsModule } from 'app/domains/domainsmodule';
import { ChangeDetectorRef } from '@angular/core';
import { ColDef, GridApi, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community';

import { CompanysService } from 'app/services/companys.service';
import { OilfieldService } from 'app/services/oilfield.service';
import { ProjectsService } from 'app/services/projects.service';
import { LogbookService } from 'app/services/logbook.service';
import { TrackingService } from 'app/services/tracking.service';

import { Ibooklog } from 'app/interface/ibooklog';
import { Iproject } from 'app/interface/iproject';
import { RowHeightParams } from 'ag-grid-enterprise';
import { HttpClient } from '@angular/common/http';
import { SearchComponent } from "./search/search.component";
import { CarouselComponent } from './carousel/carousel.component';
import { ReportTableComponent } from './report-table/report-table.component';
import { CreatePdfComponent } from "./create-pdf/create-pdf.component";
import { CreatePdfDisabledComponent } from './create-pdf-disabled/create-pdf-disabled.component';
import { alerts } from 'app/helpers/alerts';
import { MultiLineEditorComponent } from "./report-table/multi-line-editor.component";

@Component({
  selector: 'app-logbook',
  standalone: true,
  imports: [DomainsModule, SearchComponent, CarouselComponent, ReportTableComponent, CreatePdfComponent, CreatePdfDisabledComponent, MultiLineEditorComponent],
  templateUrl: './logbook.component.html',
  styleUrls: ['./logbook.component.scss']
})
export class LogbookComponent implements OnInit {
  // Propiedades del carrusel
  images: string[] = [];
  currentIndex = 0;
  translateX = 0;

  // Propiedades de AG Grid
  private gridApi!  : GridApi<Iproject>;
  private gridApi3! : GridApi<Iproject>;

  private gridApi2!: GridApi<Ibooklog>;
  
  public project1 : Iproject[] = [];
  public project0 : Iproject[] = [];
  public lb       : Ibooklog[] = [];

  companyData    : any[]      = [] ;
  oilfieldData   : any[]      = [] ;

  public rowSelection: 'single' | 'multiple' = 'single';
  public rowGroupPanelShow: 'always' | 'onlyWhenGrouping' | 'never' = 'always';
  public pivotPanelShow: 'always' | 'onlyWhenPivoting' | 'never' = 'always';
  public paginationPageSize = 15;
  public paginationPageSizeSelector: number[] | boolean = [15, 50, 100];
  public groupDefaultExpanded = -1;
  public autoGroupColumnDef2: ColDef = {
    headerName: 'Tipo Notas',
    field: 'typeNote',
    width: 275,
    cellRenderer: 'agGroupCellRenderer',
    cellRendererParams: {}
  };

  // Otras propiedades
  selectedDate  : string = '';
  id            : number = 0;
  selectId      : number = 0;
  pri           : number = 0;
  Campo         : string = '';
  Contrato      :  string = '';
  Ot            : string = '';
  descr         : string = '';

  selectedCompn : number = 0 ;
  selectedComps : string = '' ;

  selectidoiln   : number = 0 ;
  selectidoils   : string = '' ;

  // Definiciones de columnas
  colProject: ColDef[] = [
   // { field: 'idConsecutivo', headerName: 'Id', width: 50, filter: true },
    { field: 'name', headerName: 'Descripcion Corta', width: 150, filter : true }
  ];

  colBook: ColDef[] = [
      { 
      field: 'description', 
      headerName: 'Comentario', 
      width: 545, 
      wrapText: true, 
      autoHeight: true,
      cellStyle: { 'white-space': 'normal', 'line-height': '20px' } 
    }
    
  ];

  // Inyección de dependencias
  // la nueva manera
  private trackingService = inject(TrackingService);
  private companyService  = inject(CompanysService) ;
  private oilfieldService = inject(OilfieldService) ;
  private projectservice  = inject(ProjectsService);
  private lbservice = inject(LogbookService);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);

  ngOnInit(): void {
    this.FillCombox() ;
    this.selectedDate = this.formatDate(new Date());
  }

  FillCombox() {
         this.companyService.Companys().subscribe((data) => {
         this.companyData = Object.values(data);
         //console.log("cProcessData", this.companyData)
          if (this.companyData.length > 0) {
             this.selectedCompn = this.companyData[0].id ;
             //this.trackingService.setCp(this.selectedCProcessId) ;
          }
         else
          {
           // alert(this.trackingService.getaplat())
           alerts.basicAlert("Error", "No existen Companys para este usuario.", "error");
          }
        });
      
        this.oilfieldService.Oilfield().subscribe((data) => {
          this.oilfieldData = Object.values(data);
          //console.log("cProcessData", this.oilfieldData)
           if (this.oilfieldData.length > 0) {
              this.selectidoiln = this.oilfieldData[0].id ;
              //this.trackingService.setCp(this.selectedCProcessId) ;
           }
          else
           {
            // alert(this.trackingService.getaplat())
            alerts.basicAlert("Error", "No existen Oilfields para este usuario.", "error");
           }
         });

    }

  
  onCompanysSelected(event: Event): void {

     const target = event.target as HTMLSelectElement;

     this.trackingService.setCompany(target.value) ;

     this.selectedComps = target.value;
     //   this.getProject(1, this.selectedComps);
     this.Projectxcompany(1, Number(this.selectedComps)) ;
     this.Projectxcompany2(0, Number(this.selectedComps)) ;
  }

  onOilfieldSelected(event: Event): void {
    const target = event.target as HTMLSelectElement;

    this.trackingService.setCompany(target.value) ;

    this.selectidoils = target.value;

    this.Projectxoil(1, Number(this.selectidoils))
    this.Projectxoil2(0, Number(this.selectidoils))
  }



  Projectxoil(id:number, idoil: number ): void {
      // alert(idoil)
   // const project = localStorage.getItem('project');
    if (idoil) {
      this.projectservice.getProjectxOil(id, idoil).subscribe(
        (resp: any) => {
          this.project1 = this.mapProject(resp);
        //  console.log('this.project1',this.project1)
        },
        (error) => {
          console.error('Error fetching Project', error);
        }
      );
    } else {
      console.error('Company or Project is missing in localStorage');
    }
  }


  Projectxoil2(id2:number, idoil: number ): void {
    //alert(id2)
    //const project = localStorage.getItem('project');
    if (idoil) {
      this.projectservice.getProjectxOil(id2, idoil).subscribe(
        (resp: any) => {
          this.project0 = this.mapProject(resp);
        },
        (error) => {
          console.error('Error fetching Project', error);
        }
      );
    } else {
      console.error('Company or Project is missing in localStorage');
    }
  }


  Projectxcompany(id:number, idcomp: number ): void {
    //const project = localStorage.getItem('project');
    if (idcomp) {
      this.companyService.getProjectxCompany(id, idcomp).subscribe(
        (resp: any) => {
          this.project1 = this.mapProject(resp);
        },
        (error) => {
          console.error('Error fetching Project', error);
        }
      );
    } else {
      console.error('Company or Project is missing in localStorage');
    }
  }


  Projectxcompany2(id:number, idcomp: number ): void {
    //const project = localStorage.getItem('project');
    if (idcomp) {
      this.companyService.getProjectxCompany(id, idcomp).subscribe(
        (resp: any) => {
          this.project0 = this.mapProject(resp);
        },
        (error) => {
          console.error('Error fetching Project', error);
        }
      );
    } else {
      console.error('Company or Project is missing in localStorage');
    }
  }



  getRowHeight(params: RowHeightParams): number | undefined {
    const baseHeight = 28;
    const descriptionContent = params.data.description;
    if (descriptionContent) {
      const lineHeight = 20;
      const lineCount = Math.floor(descriptionContent.length / 50) + 1;
      return Math.max(baseHeight, lineCount * lineHeight);
    }
    return baseHeight;
  }

  formatDate(date: Date): string {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    params.api.sizeColumnsToFit();
    if (this.project1 && this.project1.length > 0) {
      this.gridApi.setGridOption('rowData', this.project1);
    }
  }


  onGridReady3(params: GridReadyEvent): void {
    this.gridApi3 = params.api;
    params.api.sizeColumnsToFit();
    if (this.project0 && this.project0.length > 0) {
      this.gridApi3.setGridOption('rowData', this.project0);
    }
  }


  onGridReady2(params: GridReadyEvent): void {
    this.gridApi2 = params.api;
    if (this.lb && this.lb.length > 0) {
      this.gridApi2.setGridOption('rowData', this.lb);
    }
  }

  onSelectionChanged(event: SelectionChangedEvent): void {
    const selectedRows = this.gridApi.getSelectedRows();
    if (selectedRows.length > 0) {
      this.selectId  = selectedRows[0].id;
      this.Campo     = selectedRows[0].campo ?? '';
      this.id        = selectedRows[0].idConsecutivo;
      this.pri       = selectedRows[0].priority;
      this.Contrato  = selectedRows[0].contrato ?? '';
      this.Ot        = selectedRows[0].number ?? '';
      this.descr     = selectedRows[0].description ?? '';
     
      this.getlbxDate(this.selectedDate);
      this.resetScreen();
    }
  }

  onSelectionChanged3(event: SelectionChangedEvent): void {
    const selectedRows3 = this.gridApi3.getSelectedRows();
    if (selectedRows3.length > 0) {
      this.selectId = selectedRows3[0].id;
      this.Campo    = selectedRows3[0].campo ?? '';
      this.id       = selectedRows3[0].idConsecutivo;
      this.pri      = selectedRows3[0].priority;
      this.Contrato = selectedRows3[0].contrato ?? '';
      this.Ot       = selectedRows3[0].number ?? '';
      this.descr    = selectedRows3[0].description ?? '';
     // alert(this.id);
      this.getlbxDate(this.selectedDate);
      this.resetScreen();
    }
  }



  async getlbxDate(dater: string) {
    this.lbservice.getLB(dater, this.id).subscribe(
      (resp: any) => {
        this.lb = this.mapLb(resp);
        if (this.gridApi2) {
          this.gridApi2.setGridOption('rowData', this.lb);
          this.gridApi2.resetRowHeights();
        }
        this.cdr.detectChanges();
      },
      (error) => {
        console.error('Error fetching Logbook', error);
      }
    );
  }

  mapLb(data: any[]): Ibooklog[] {
    return data.map(w => ({
      date: w.date,
      typeNote: w.typeNote,
      timexnote: w.timexnote,
      description: w.description,
      supervisor: w.supervisor      
    } as Ibooklog));
  }

  mapProject(data: any[]): Iproject[] {
    return data.map(p => ({
      id            : p.id,
      idConsecutivo : p.idConsecutivo,
      campo         : p.campo,
      number        : p.number,
      priority      : p.priority,
      contrato      : p.contrato,
      name          : p.name,
      company       : p.company
    } as Iproject));
  }

  onDateChange(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    const selectedDate = inputElement.value;
    const dateObject = new Date(selectedDate);
    const formattedDate = dateObject.toISOString().split('T')[0];
    this.selectedDate = formattedDate;
    this.getlbxDate(this.selectedDate);
  }



  next() {
    if (this.currentIndex < this.images.length - 1) {
      this.currentIndex++;
      this.updateTranslateX();
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateTranslateX();
    }
  }

  updateTranslateX() {
    this.translateX = -this.currentIndex * 310; // 300px de ancho de imagen + 10px de margen
  }

  // Para pasar variables de componente padre a hijo
receivedData!: { id: number; date: string; };
  showChild2 = false;
  
  handleData(data: { id: number, date: string }) {
    this.showChild2 = false;
    this.receivedData = data;
    this.showChild2 = true;
  }

  resetScreen() { // Para limpiar la pantalla
    this.showChild2 = false;
  }
}