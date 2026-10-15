import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-enterprise';
import { BitacoraBaseComponent, BITACORA_TEMPLATE, BITACORA_STYLES } from './bitacora-base.component';
import { WorkprogramsService } from 'app/services/workprograms.service';
import { SubcontractProgramService } from 'app/services/subcontract-program.service';

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
  readonly editableCols = ['startTime', 'endTime', 'descriptionconcept', 'detail', 'quantity', 'percentage'];
  
  private workprogramsService = inject(WorkprogramsService);
  private subcontractProgramService = inject(SubcontractProgramService);
  private subpartidasMap = new Map<string, { code: string; text: string; id: number }>();
  private subpartidaIdMap = new Map<string, number>();
  private subpartidaIdToCodeMap = new Map<number, string>();
  private conceptBySubpartida = new Map<string, string[]>();
  private directConceptOptions: string[] = [];
  private plannedQuantityByConcept = new Map<string, number>();
  conceptOptions: string[] = [];
  
  readonly requiredFields = [
    { field: 'descriptionconcept', label: 'Concepto' },
    { field: 'quantity', label: 'Cantidad' },
  ];

  override ngOnInit(): void {
    super.ngOnInit();
    const parent = this.context?.componentParent;
    if (parent?.subcontractMode && parent.selectedSubcontractProgramId) {
      this.loadSubcontractItems(parent.selectedSubcontractProgramId);
    } else {
      this.loadSubpartidas();
    }
  }

  private loadSubcontractItems(idProgram: number): void {
    this.subcontractProgramService.getById(Number(idProgram)).subscribe({
      next: (data: any) => {
        this.subpartidasMap.clear(); this.conceptOptions = []; this.conceptBySubpartida.clear();
        for (const item of data?.items || []) {
          const code = String(item.subphase || item.phase || '').trim();
          const text = String(item.concept || '').trim();
          const label = text || code;
          this.conceptOptions.push(label);
          if (code && !this.subpartidasMap.has(code)) {
            this.subpartidasMap.set(code, { code, text: String(item.phase || code), id: Number(item.id) || 0 });
          }
          const list = this.conceptBySubpartida.get(code) || [];
          if (!list.includes(label)) list.push(label);
          this.conceptBySubpartida.set(code, list);
        }
        this.gridApi?.refreshCells({ force: true });
      }, error: () => {}
    });
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
      percentage: 0,
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
    const idProject = this.reportData?.idProject ?? this.reportData?.IdProject;
    if (!idProject) return;
    const idConvention = this.reportData?.idConvention ?? this.reportData?.IdConvention ?? null;
    this.directConceptOptions = [];
    console.log('[REPORTE-CONCEPTOS] Contexto del reporte y solicitudes', {
      report: this.reportData,
      idProject,
      idConvention,
    });

    // Carga también los conceptos marcados directamente en el programa del
    // proyecto. Estos pueden ser conceptos raíz (parent = 0) y conservar su
    // unidad real (PIEZA, METRO, etc.); no necesariamente usan una subpartida.
    this.workprogramsService.getWorkPrograms(idProject, 'Project').subscribe({
      next: (rows: any[]) => {
        const directConcepts = (rows ?? []).filter((row: any) =>
          String(row.typeActivity ?? row.typeactivity ?? row.TypeActivity ?? '').trim().toUpperCase() === 'CONCEPT' &&
          Number(row.idConvention ?? row.id_convention ?? row.IdConvention ?? 0) === Number(idConvention ?? 0)
        );
        console.log('[REPORTE-CONCEPTOS] Respuesta Workprogram/{id}/Project', {
          idProject,
          idConvention,
          dataCruda: rows,
          selectedConcepts: directConcepts.length,
        });
        this.directConceptOptions = directConcepts.map((concept: any) => {
          const label = `${String(concept.activity ?? concept.Activity ?? '').trim()} ${String(concept.text ?? concept.Text ?? '').trim()}`.trim();
          const planned = Number(concept.quantity ?? concept.Quantity ?? concept.amount ?? concept.Amount ?? concept.volume ?? concept.Volume);
          if (label && Number.isFinite(planned) && planned > 0) this.plannedQuantityByConcept.set(label, planned);
          return label;
        }).filter((label: string) => !!label);
        this.mergeDirectConceptOptions();
        this.gridApi?.refreshCells({ force: true });
      },
      error: (error: any) => console.error('[REPORTE-CONCEPTOS] Error Workprogram/{id}/Project', {
        idProject, idConvention, status: error?.status, response: error?.error, message: error?.message,
      }),
    });

    console.log('[REPORTE-CONCEPTOS] Solicitud concepts-hierarchy', { idProject, idConvention });
    this.workprogramsService.getConceptsHierarchy(idProject, idConvention).subscribe({
      next: (data: any[]) => {
        console.log('[REPORTE-CONCEPTOS] Respuesta concepts-hierarchy', {
          idProject,
          idConvention,
          dataCruda: data,
        });
        this.subpartidasMap.clear();
        this.conceptOptions = [];
        this.conceptBySubpartida.clear();

        for (const sistema of data || []) {
          for (const concept of sistema.conceptos || []) {
            const label = `${String(concept.activity ?? concept.Activity ?? '').trim()} ${String(concept.text ?? concept.Text ?? '').trim()}`.trim();
            if (label && !this.conceptOptions.includes(label)) this.conceptOptions.push(label);
            this.registerPlannedQuantity(label, concept);
          }
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
              this.registerPlannedQuantity(label, c);
              this.conceptOptions.push(label);
              conceptos.push(label);
            }
            this.conceptBySubpartida.set(subCode, conceptos);
          }
        }
        this.mergeDirectConceptOptions();
        this.gridApi?.refreshCells({ force: true });
      },
      error: (error: any) => console.error('[Reporte diario][conceptos][concepts-hierarchy] Error', {
        idProject,
        idConvention,
        status: error?.status,
        message: error?.message,
        response: error?.error,
      })
    });
  }

  private mergeDirectConceptOptions(): void {
    for (const label of this.directConceptOptions) {
      if (!this.conceptOptions.includes(label)) this.conceptOptions.push(label);
    }
  }

  private registerPlannedQuantity(label: string, concept: any): void {
    const planned = Number(concept?.quantity ?? concept?.Quantity ?? concept?.amount ?? concept?.Amount ?? concept?.volume ?? concept?.Volume);
    if (label && Number.isFinite(planned) && planned > 0) this.plannedQuantityByConcept.set(label, planned);
  }

  private updatePercentageFromQuantity(row: any): void {
    const planned = this.plannedQuantityByConcept.get(String(row?.descriptionconcept ?? '').trim());
    row.percentage = planned ? Number(((Number(row.quantity) || 0) * 100 / planned).toFixed(2)) : null;
  }

  private updateQuantityFromPercentage(row: any): void {
    const planned = this.plannedQuantityByConcept.get(String(row?.descriptionconcept ?? '').trim());
    if (planned) row.quantity = Number((planned * (Number(row.percentage) || 0) / 100).toFixed(4));
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
          const availableConcepts = [...new Set([...filteredConcepts, ...this.directConceptOptions])];
          return {
            values: availableConcepts,
          };
        },
        valueSetter: (params) => {
          params.data.descriptionconcept = params.newValue;
          const subpartida = params.data.subpartidaCode || '';
          params.data.detail = `${subpartida} ${params.newValue}`.trim();
          this.updatePercentageFromQuantity(params.data);
          return true;
        },
        valueFormatter: (p) => {
          const subpartida = p.data?.subpartidaCode || '';
          const concepto = p.data?.descriptionconcept || '';
          return `${subpartida} ${concepto}`.trim() || p.value || '';
        },
      },
      { field: 'detail', headerName: 'Descripción', editable: true, width: 500 },
      { field: 'quantity', headerName: 'Cantidad', editable: true, width: 100, type: 'numericColumn', valueSetter: p => { p.data.quantity = Number(p.newValue) || 0; this.updatePercentageFromQuantity(p.data); return true; } },
      { field: 'percentage', headerName: '% Avance', editable: true, width: 105, type: 'numericColumn', valueSetter: p => { p.data.percentage = Math.min(100, Math.max(0, Number(p.newValue) || 0)); this.updateQuantityFromPercentage(p.data); return true; }, valueFormatter: p => p.value == null ? '' : `${p.value}%` },
    ];
  }

  protected override remapFromDb(item: any): any {
    const idPadre = item.idPadre || null;
    const subpartidaCode = idPadre ? (this.subpartidaIdToCodeMap.get(idPadre) || String(idPadre)) : '';
    const row = {
      ...item,
      date: item.date || '',
      startTime: item.start || '',
      endTime: item.end || '',
      subpartidaCode: subpartidaCode,
      subpartidaId: idPadre,
      descriptionconcept: item.descriptionconcept || item.description || '',
      detail: item.metadata ?? '',
      percentage: null as number | null,
    };
    const planned = this.plannedQuantityByConcept.get(String(row.descriptionconcept ?? '').trim());
    row.percentage = planned ? Number(((Number(row.quantity) || 0) * 100 / planned).toFixed(2)) : null;
    return row;
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
    
    console.log('buildPayload payload:', JSON.stringify(payload, null, 2));
    
    if (isUpdate && item.id) {
      payload.id = item.id;
    }
    
    return payload;
  }
}
