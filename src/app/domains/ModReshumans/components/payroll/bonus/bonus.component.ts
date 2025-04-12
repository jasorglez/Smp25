import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CellDoubleClickedEvent, ColDef, GridApi, GridReadyEvent, ICellRendererParams } from 'ag-grid-enterprise';
import { AgGridModule } from 'ag-grid-angular';
import { FormsModule, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import * as bootstrap from 'bootstrap';
import { SignalsService } from 'app/services/signals.service';
import { CatalogsService } from 'app/services/catalogs.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-bonus',
  standalone: true,
  imports: [AgGridModule, FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './bonus.component.html',
})
export class BonusComponent{ 

  private signalsService = inject(SignalsService);
  private catalogsService = inject(CatalogsService);

  rowData: any;
  bonusForm!: FormGroup;
  fechasForm!: FormGroup;
  idEmployee: number;
  nameEmployee: string;
  bonoEmployee: number;
  idBranch: number;
  bonusCatalogos: any[] = [];

 

  ngOnInit(){
  this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
  this.obtenerDatosCatalogos();
  this.bonusForm = this.fb1.group({
    nuevoBonus: ['', [Validators.required, Validators.min(0)]],
    motivo: ['', Validators.required],
    fechaSelect: ['', Validators.required]
  });
  this.fechasForm = this.fb2.group({
    fechaInicio: ['', Validators.required],
    fechaFin: ['', Validators.required]
  });

  this.fechasForm.get('fechaInicio')?.valueChanges.subscribe(fecha => {
    console.log('Fecha inicio:', fecha);
  });
  this.fechasForm.get('fechaFin')?.valueChanges.subscribe(fecha => {
    console.log('Fecha fin:', fecha);
  });
  }  
  constructor(private fb1: FormBuilder,  private fb2: FormBuilder){
    this.rowData= [{id: 10, name: "Victor Blanco Reyes", bono: 500}];
  }

  obtenerDatosCatalogos() {
    this.catalogsService.getCatalogs(this.idBranch, "BONUS").subscribe((data) => {
            this.bonusCatalogos = data;
            console.log("Log res",this.bonusCatalogos)
          },
          (error) => console.error('Error fetching measures:', error)
        );
  }
  
  
  obtenerDatosEmpleados(){
  }  
  get colMaster(): ColDef[] {
    return[
    {
      field: 'id',
      headerName: 'Id empleado',
      editable: true,
      filter: true,
      width: 200,
    },
    {
      field: 'name',
      headerName: 'Nombre',
      editable: true,
      filter: true,
      width: 200,
    },
    {
      field: 'bono',
      headerName: 'Bono',
      editable: true,
      filter: true,
      width: 150,
    }
  ]}

  saveChanges(){

  }
  revert(){

  }

  onRowDoubleClicked(event: any) {
    console.log("log:" , this.bonusCatalogos)
    this.bonusForm.reset({
      nuevoBonus: '',
      motivo: ''
    });
    this.idEmployee = event.data.id;
    this.nameEmployee = event.data.name;
    this.bonoEmployee = event.data.bono;

    const modal = new bootstrap.Modal(document.getElementById('searchModal')!);
    modal.show();
  }
  guardarBonus(){
    if (this.bonusForm.valid) {
      const datos = this.bonusForm.value;
      console.log('Bonus actualizado:', {
        id: this.idEmployee,
        nombre: this.nameEmployee,
        bonusAnterior: this.bonoEmployee,
        nuevoBonus: datos.nuevoBonus,
        motivo: datos.motivo,
        fecha: datos.fechaSelect
      });
    }
  }

}
