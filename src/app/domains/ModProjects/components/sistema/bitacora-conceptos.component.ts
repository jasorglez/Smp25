import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_TEMPLATE, BITACORA_STYLES } from './bitacora-base.component';
import { WorkprogramsService } from 'app/services/workprograms.service';

@Component({
  selector: 'app-bitacora-conceptos',
  standalone: true,
  imports: [CommonModule, AgGridModule],
  template: BITACORA_TEMPLATE,
  styles: BITACORA_STYLES,
})
export class BitacoraConceptosComponent extends BitacoraBaseComponent {
  readonly bitacoraType = 'conceptos';
  readonly typeNoteValue = 'CONCEPTO';
  readonly editableCols = ['startTime', 'endTime', 'descriptionconcept', 'detail', 'quantity'];
  
  private workprogramsService = inject(WorkprogramsService);
  private subpartidasMap = new Map<string, { code: string; text: string; id: number }>();
  private subpartidaIdMap = new Map<string, number>();
  private subpartidaIdToCodeMap = new Map<number, string>();
  private conceptBySubpartida = new Map<string, string[]>();
  conceptOptions: string[] = [];
  
  readonly requiredFields = [
    { field: 'descriptionconcept', label: 'Concepto' },
    { field: 'quantity', label: 'Cantidad' },
  ];

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadSubpartidas();
  }

  override addRow(): void {
    const newRow = {
      id: `temp_${this.tempIdCounter++}`,
      idReporte: this.reportData?.id,
      date: this.reportData?.date ? String(this.reportData.date).substring(0, 10) : new Date().toISOString().split('T')[0],
      startTime: '08:00:00',
      endTime: '17:00:00',
      subpartidaId: 0,
      subpartidaCode: '',
      descriptionconcept: '',
      quantity: 0,
      detail: '',
      active: true,
      __isNew: true,
      __modified: false,
    };
    this.rowData = [newRow, ...this.rowData];
    this.hasUnsavedChanges = true;
    setTimeout(() => {
      this.gridApi?.setGridOption('rowData', this.rowData);
      this.gridApi?.startEditingCell({ rowIndex: 0, colKey: this.editableCols[0] });
    }, 50);
  }

  private loadSubpartidas(): void {
    const idProject = this.reportData?.idProject;
    if (!idProject) return;
    const idConvention = this.reportData?.idConvention ?? null;

    this.workprogramsService.getConceptsHierarchy(idProject, idConvention).subscribe({
      next: (data: any[]) => {
        this.subpartidasMap.clear();
        this.conceptOptions = [];
        this.conceptBySubpartida.clear();

        for (const sistema of data || []) {
          const subpartidas = sistema.subpartidas || [];
          for (const sub of subpartidas) {
            const subCode = String(sub.activity ?? '').trim();
            const subText = String(sub.text ?? '').trim();
            const subId = sub.id ?? 0;
            this.subpartidasMap.set(subCode, { code: subCode, text: subText, id: subId });
            this.subpartidaIdMap.set(subCode, subId);
            if (subId) this.subpartidaIdToCodeMap.set(subId, subCode);
            
            const conceptos: string[] = [];
            const conceptosData = sub.conceptos || [];
            for (const c of conceptosData) {
              const conceptCode = String(c.activity ?? '').trim();
              const conceptText = String(c.text ?? '').trim();
              const label = `${conceptCode} ${conceptText}`.trim();
              this.conceptOptions.push(label);
              conceptos.push(label);
            }
            this.conceptBySubpartida.set(subCode, conceptos);
          }
        }
        
        this.gridApi?.refreshCells({ force: true });
      },
      error: () => {}
    });
  }

  get colDefs(): ColDef[] {
    return [
      { headerName: '#', width: 45, valueGetter: (p) => p.node!.rowIndex! + 1, pinned: 'left', editable: false },
      { field: 'startTime', headerName: 'Inicio', editable: true, width: 100 },
      { field: 'endTime', headerName: 'Término', editable: true, width: 100 },
      {
        field: 'subpartidaCode',
        headerName: 'Subpartida',
        editable: true,
        width: 150,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: () => ({
          values: Array.from(this.subpartidasMap.keys()),
        }),
        valueSetter: (params) => {
          const subData = this.subpartidasMap.get(params.newValue);
          if (subData) {
            params.data.subpartidaCode = subData.code;
            params.data.subpartidaText = subData.text;
            params.data.subpartidaId = subData.id;
            const concepto = params.data.descriptionconcept || '';
            params.data.detail = `${subData.code} ${concepto}`.trim();
          }
          return true;
        },
        valueFormatter: (p) => p.value || '',
      },
      {
        field: 'descriptionconcept',
        headerName: 'Concepto',
        editable: true,
        width: 350,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: (params: any) => {
          const subpartidaCode = params.data?.subpartidaCode;
          const filteredConcepts = subpartidaCode 
            ? (this.conceptBySubpartida.get(subpartidaCode) || [])
            : this.conceptOptions;
          return {
            values: filteredConcepts.length > 0 ? filteredConcepts : [],
          };
        },
        valueSetter: (params) => {
          params.data.descriptionconcept = params.newValue;
          const subpartida = params.data.subpartidaCode || '';
          params.data.detail = `${subpartida} ${params.newValue}`.trim();
          return true;
        },
        valueFormatter: (p) => {
          const subpartida = p.data?.subpartidaCode || '';
          const concepto = p.data?.descriptionconcept || '';
          return `${subpartida} ${concepto}`.trim() || p.value || '';
        },
      },
      { field: 'detail', headerName: 'Descripción', editable: true, width: 500 },
      { field: 'quantity', headerName: 'Cantidad', editable: true, width: 90, type: 'numericColumn' },
    ];
  }

  protected override remapFromDb(item: any): any {
    const idPadre = item.idPadre || null;
    const subpartidaCode = idPadre ? (this.subpartidaIdToCodeMap.get(idPadre) || String(idPadre)) : '';
    return {
      ...item,
      date: item.date || '',
      startTime: item.start || '',
      endTime: item.end || '',
      subpartidaCode: subpartidaCode,
      subpartidaId: idPadre,
      descriptionconcept: item.descriptionconcept || item.description || '',
      detail: item.metadata ?? '',
    };
  }

  private formatTime(value: string | null): string | null {
    if (!value) return null;
    // Ensure HH:mm format
    if (value.includes(':') && value.length >= 5) {
      return value.substring(0, 5);
    }
    return value;
  }

  buildPayload(item: any, isUpdate: boolean = false): any {
    let idPadre: number | null = null;
    
    if (item.subpartidaId && item.subpartidaId !== 0) {
      idPadre = Number(item.subpartidaId) || null;
    } else if (item.subpartidaCode) {
      idPadre = Number(this.subpartidaIdMap.get(item.subpartidaCode)) || null;
    }
    
    idPadre = idPadre || 0;
    
    const formatTime = (time: string | null): string | null => {
      if (!time) return null;
      if (time.length === 5) return time + ':00'; // 17:34 -> 17:34:00
      return time;
    };

    const payload: any = {
      idReporte: this.reportData?.id ?? null,
      idProject: this.reportData?.idProject ?? null,
      idPadre: idPadre,
      typeNote: this.typeNoteValue,
      date: item.date || this.reportData?.date || null,
      start: formatTime(item.startTime),
      end: formatTime(item.endTime),
      quantity: item.quantity ?? 0,
      descriptionconcept: item.descriptionconcept || null,
      description: item.detail || null,
      metadata: item.detail?.trim() || null,
      active: 1,
    };
    
    
    if (isUpdate && item.id) {
      payload.id = item.id;
    }
    
    return payload;
  }
}
