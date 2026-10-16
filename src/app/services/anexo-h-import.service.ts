import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuxiliarService } from './auxiliar.service';
import { AuxiliarItemsService } from './auxiliar-items.service';
import { WorkprogramApuFactorService } from './workprogram-apu-factor.service';
import { ApuConfigService, ApuConfig } from './apu-config.service';

export interface AnexoHApuPackage {
  source: string;
  count: number;
  apus: any[];
  validation: Record<string, any>;
}

export interface AnexoHApuPlan {
  source: any;
  payload: any;
  itemRows: any[];
  crews: any[];
  auxiliaryFlattened: number;
  roundedQuantityRows: number;
  roundedMoneyRows: number;
  roundedMoneyByApu: Array<{ key: number; difference: number }>;
  tooLongCrewNames: number;
  tooLongWorkerDescriptions: number;
  tooLongItemDescriptions: number;
}

export interface AnexoHImportPreview {
  records: AnexoHApuPlan[];
  count: number;
  directTotal: number;
  priceTotal: number;
  componentCounts: { material: number; equipo: number; herramienta: number; personal: number; auxiliar: number };
  auxiliaryFlattened: number;
  roundedQuantityRows: number;
  roundedMoneyRows: number;
  roundedMoneyByApu: Array<{ key: number; difference: number }>;
  longCrewNames: number;
  longWorkerDescriptions: number;
  longItemDescriptions: number;
  factorExceptionCount: number;
  canPersist: boolean;
}

@Injectable({ providedIn: 'root' })
export class AnexoHImportService {
  private http = inject(HttpClient);
  private auxiliarService = inject(AuxiliarService);
  private detailService = inject(AuxiliarItemsService);
  private factorService = inject(WorkprogramApuFactorService);
  private configService = inject(ApuConfigService);

  readonly companyId = 10;
  readonly contractId = 178;
  readonly projectId = 799;
  readonly contractCode = 'CONTRATO-1003';
  readonly projectName = 'MONTES PRUEBA PMO';

  async loadPackage(): Promise<AnexoHApuPackage> {
    const data = await firstValueFrom(this.http.get<AnexoHApuPackage>('assets/data/anexo-h-apus.json'));
    if (data?.count !== 97 || !Array.isArray(data.apus) || data.apus.length !== 97) {
      throw new Error('El paquete Anexo H está incompleto; se esperaban 97 análisis.');
    }
    const expectedKeys = Array.from({ length: 97 }, (_, index) => index + 1);
    if (data.apus.some((apu, index) => Number(apu.key) !== expectedKeys[index] || !String(apu.description ?? '').trim())) {
      throw new Error('El paquete Anexo H no contiene las 97 claves consecutivas y sus descripciones.');
    }
    return data;
  }

  prepare(data: AnexoHApuPackage): AnexoHImportPreview {
    const roundedMoneyByApu: Array<{ key: number; difference: number }> = [];
    const componentCounts: AnexoHImportPreview['componentCounts'] = { material: 0, equipo: 0, herramienta: 0, personal: 0, auxiliar: 0 };
    let roundedQuantityRows = 0;
    let roundedMoneyRows = 0;
    let auxiliaryFlattened = 0;
    let longCrewNames = 0;
    let longWorkerDescriptions = 0;
    let longItemDescriptions = 0;
    const records = data.apus.map((apu) => {
      const itemRows: any[] = [];
      const crews = (apu.crews ?? []).map((crew: any, index: number) => {
        if (String(crew.name ?? '').length > 100) longCrewNames++;
        const rawCrewQuantity = Number(crew.quantity ?? 1) || 1;
        const roundedCrew = this.roundQuantity(rawCrewQuantity);
        const crewQuantity = rawCrewQuantity;
        if (roundedCrew.changed) roundedQuantityRows++;
        const crewSubtotal = Number(crew.subtotal) || 0;
        const crewMoneyDifference = this.money(crewSubtotal * roundedCrew.value) - this.money(crewSubtotal * rawCrewQuantity);
        if (crewMoneyDifference !== 0) roundedMoneyRows++;
        const workers = (crew.workers ?? []).map((worker: any) => {
          if (String(worker.description ?? '').length > 180) longWorkerDescriptions++;
          const row = this.resourceRow(worker, 'PERSONAL');
          componentCounts['personal']++;
          if (row.roundedQuantity) roundedQuantityRows++;
          if (row.roundedMoneyDifference !== 0) roundedMoneyRows++;
          itemRows.push({ ...row, type: 'PERSONAL', crewIndex: index });
          return row;
        });
        return { name: String(crew.name ?? `Cuadrilla ${index + 1}`), quantity: crewQuantity, sourceQuantity: rawCrewQuantity,
          roundedMoneyDifference: crewMoneyDifference, sortOrder: index + 1, workers };
      });

      for (const [section, type] of [['material', 'MATERIAL'], ['equipo', 'EQUIPO'], ['herramienta', 'HERR']] as const) {
        for (const resource of apu.components?.[section] ?? []) {
          if (String(resource.description ?? '').length > 500) longItemDescriptions++;
          const row = this.resourceRow(resource, type);
          componentCounts[section === 'herramienta' ? 'herramienta' : section]++;
          if (row.roundedQuantity) roundedQuantityRows++;
          if (row.roundedMoneyDifference !== 0) roundedMoneyRows++;
          itemRows.push(row);
        }
      }

      let apuMoneyDifference = 0;
      for (const group of apu.components?.auxiliares ?? []) {
        auxiliaryFlattened++;
        componentCounts['auxiliar']++;
        const childTotal = (group.items ?? []).reduce((sum: number, child: any) => sum + this.money(Number(child.amount) || Number(child.quantity) * Number(child.unit_price) || 0), 0);
        const quantity = Number(group.quantity) > 0 ? Number(group.quantity) : 1;
        const amount = Number(group.amount) >= 0 ? Number(group.amount) : childTotal;
        const unitCost = Number(group.unit_amount) > 0
          ? Number(group.unit_amount)
          : Number(group.amount) >= 0 && group.amount !== undefined && Number(group.quantity) > 0
            ? amount / quantity
            : Number(group.unit_price) || amount;
        const rounded = this.roundQuantity(quantity);
        const moneyDifference = this.money(rounded.value * unitCost) - this.money(quantity * unitCost);
        apuMoneyDifference += moneyDifference;
        if (rounded.changed) roundedQuantityRows++;
        if (moneyDifference !== 0) roundedMoneyRows++;
        itemRows.push({ type: 'AUXILIAR', idReference: null, description: String(group.description ?? ''),
          unit: String(group.unit ?? ''), quantity, unitCost, sourceQuantity: quantity,
          roundedQuantity: rounded.changed, roundedMoneyDifference: moneyDifference, sourceRef: group.source_ref ?? null });
      }

      const allResourceRows = [...itemRows.filter((row) => row.type !== 'PERSONAL'), ...itemRows.filter((row) => row.type === 'PERSONAL')];
      const crewsPayload = crews.map((crew) => ({ ...crew, workers: crew.workers.map((worker: any) => worker) }));
      return {
        source: apu,
        payload: {
          idCompany: this.companyId,
          idContract: this.contractId,
          clave: String(apu.key),
          claveUsuario: String(apu.user_key ?? ''),
          description: String(apu.description ?? ''),
          unit: String(apu.unit ?? ''),
          costMN: Number(apu.direct_cost),
          precioUnitario: Number(apu.unit_price),
          hasPersonal: crews.length > 0,
          hasMaterial: (apu.components?.material ?? []).length > 0,
          hasHerramienta: (apu.components?.herramienta ?? []).length > 0,
          hasEquipo: (apu.components?.equipo ?? []).length > 0,
          active: true,
        },
        itemRows: allResourceRows,
        crews: crewsPayload,
        auxiliaryFlattened: (apu.components?.auxiliares ?? []).length,
        roundedQuantityRows,
        roundedMoneyRows,
        roundedMoneyByApu: [],
        tooLongCrewNames: (apu.crews ?? []).filter((crew: any) => String(crew.name ?? '').length > 100).length,
        tooLongWorkerDescriptions: (apu.crews ?? []).flatMap((crew: any) => crew.workers ?? []).filter((worker: any) => String(worker.description ?? '').length > 180).length,
        tooLongItemDescriptions: itemRows.filter((row) => row.type !== 'PERSONAL' && row.description.length > 500).length,
      } satisfies AnexoHApuPlan;
    });

    records.forEach((record) => {
      const diff = record.itemRows.reduce((sum, row) => sum + (row.roundedMoneyDifference ?? 0), 0)
        + record.crews.reduce((sum, crew) => sum + (crew.roundedMoneyDifference ?? 0), 0);
      if (Math.abs(diff) >= 0.005) roundedMoneyByApu.push({ key: Number(record.source.key), difference: this.money(diff) });
    });
    return {
      records,
      count: records.length,
      directTotal: this.money(records.reduce((sum, record) => sum + Number(record.source.direct_cost || 0), 0)),
      priceTotal: this.money(records.reduce((sum, record) => sum + Number(record.source.unit_price || 0), 0)),
      componentCounts,
      auxiliaryFlattened,
      roundedQuantityRows,
      roundedMoneyRows,
      roundedMoneyByApu,
      longCrewNames,
      longWorkerDescriptions,
      longItemDescriptions,
      canPersist: roundedQuantityRows === 0 && longCrewNames === 0 && longWorkerDescriptions === 0 && longItemDescriptions === 0,
      factorExceptionCount: data.validation?.['factor_formula_exceptions']?.length ?? 0,
    };
  }

  async importSequentially(preview: AnexoHImportPreview, onProgress: (done: number, total: number, label: string) => void): Promise<void> {
    if (!preview.canPersist) {
      throw new Error('El esquema de base de datos actual no admite sin pérdida las cantidades o descripciones del paquete. La carga está bloqueada hasta aplicar la migración de precisión y longitudes.');
    }
    const total = preview.count * 2 + 2;
    let done = 0;
    const step = (label: string) => onProgress(++done, total, label);

    await this.ensureFactors();
    step('Factores de indirectos, financiamiento, utilidad y cargos adicionales');
    await this.ensureReportConfig();
    step('Encabezado del reporte');

    const idByUserKey = new Map<string, number>();
    const response: any = await firstValueFrom(this.auxiliarService.getByContract(this.contractId, this.companyId));
    const currentRows = [...(response ?? [])];
    for (const record of preview.records) {
      const matches = currentRows.filter((row: any) => String(row.claveUsuario ?? row.clave_usuario ?? '') === String(record.payload.claveUsuario));
      if (matches.length > 1) throw new Error(`La clave ${record.payload.claveUsuario} está duplicada en el contrato; se detuvo la carga.`);
      let saved = matches[0];
      if (saved) {
        await firstValueFrom(this.auxiliarService.update(Number(saved.id ?? saved.Id), record.payload));
      } else {
        saved = await firstValueFrom(this.auxiliarService.add(record.payload));
        currentRows.push(saved?.auxiliar ?? saved);
      }
      const id = Number(saved?.id ?? saved?.Id ?? matches[0]?.id ?? matches[0]?.Id);
      if (!id) throw new Error(`No se recibió el ID guardado para ${record.payload.claveUsuario}; vuelve a ejecutar para reanudar.`);
      idByUserKey.set(String(record.payload.claveUsuario), id);
      step(`APU ${record.payload.claveUsuario}`);
    }

    for (const record of preview.records) {
      const id = idByUserKey.get(String(record.payload.claveUsuario));
      const detail: any = await firstValueFrom(this.detailService.getDetalle(id));
      await this.syncDetail(record, id, detail, idByUserKey);
      step(`Componentes de ${record.payload.claveUsuario}`);
    }
  }

  private async syncDetail(record: AnexoHApuPlan, idAuxiliar: number, detail: any, idByUserKey: Map<string, number>): Promise<void> {
    const existingItems = detail?.items ?? detail?.Items ?? [];
    const existingCrews = detail?.cuadrillas ?? detail?.Cuadrillas ?? [];
    const itemOccurrences = new Map<string, number>();
    for (const row of record.itemRows.filter((item) => item.type !== 'PERSONAL')) {
      const idReference = row.type === 'AUXILIAR'
        ? this.findAuxiliaryReference(row.sourceRef, idByUserKey)
        : null;
      const payload = { idAuxiliar, type: row.type, idReference, description: row.description,
        unit: row.unit || null, quantity: row.quantity, unitCost: row.unitCost, active: true };
      const identity = `${row.type}|${this.normalize(row.description)}|${this.normalize(row.unit)}`;
      const occurrence = itemOccurrences.get(identity) ?? 0;
      itemOccurrences.set(identity, occurrence + 1);
      const matches = existingItems.filter((item: any) => String(item.type ?? item.Type) === row.type
        && this.normalize(item.description ?? item.Description) === this.normalize(row.description)
        && this.normalize(item.unit ?? item.Unit) === this.normalize(row.unit));
      const current = matches[occurrence];
      if (!current) {
        const saved: any = await firstValueFrom(this.detailService.saveItem(payload));
        existingItems.push({ ...payload, id: saved?.id ?? saved?.Id });
      } else if (!this.sameNumber(current.quantity ?? current.Quantity, row.quantity)
          || !this.sameNumber(current.unitCost ?? current.UnitCost, row.unitCost)
          || Number(current.idReference ?? current.IdReference ?? 0) !== Number(idReference ?? 0)) {
        await firstValueFrom(this.detailService.updateItem(Number(current.id ?? current.Id), payload));
      }
    }

    const crewOccurrences = new Map<string, number>();
    for (const [index, crew] of record.crews.entries()) {
      const crewName = crew.name;
      const crewIdentity = this.normalize(crewName);
      const crewOccurrence = crewOccurrences.get(crewIdentity) ?? 0;
      crewOccurrences.set(crewIdentity, crewOccurrence + 1);
      const matches = existingCrews.filter((item: any) => this.normalize(item.name ?? item.Name) === this.normalize(crewName));
      let current = matches[crewOccurrence];
      const crewPayload = { idAuxiliar, idCompany: this.companyId, name: crewName, cantidad: crew.quantity,
        sortOrder: index + 1, active: true };
      if (!current) {
        current = await firstValueFrom(this.detailService.saveCuadrilla(crewPayload));
        existingCrews.push({ ...current, ...crewPayload, items: [] });
      } else if (!this.sameNumber(current.cantidad ?? current.Cantidad, crewPayload.cantidad)) {
        await firstValueFrom(this.detailService.updateCuadrilla(Number(current.id ?? current.Id), crewPayload));
      }
      const crewId = Number(current.id ?? current.Id);
      const existingWorkers = current.items ?? current.Items ?? [];
      const workerOccurrences = new Map<string, number>();
      for (const worker of crew.workers) {
        const description = String(worker.description);
        const workerIdentity = `${this.normalize(description)}|${this.normalize(worker.unit)}`;
        const workerOccurrence = workerOccurrences.get(workerIdentity) ?? 0;
        workerOccurrences.set(workerIdentity, workerOccurrence + 1);
        const workerPayload = { idCuadrilla: crewId, idReference: null, description, unit: worker.unit || null,
          quantity: worker.quantity, unitCost: worker.unitCost, active: true };
        const workerMatches = existingWorkers.filter((item: any) => this.normalize(item.description ?? item.Description) === this.normalize(description)
          && this.normalize(item.unit ?? item.Unit) === this.normalize(worker.unit));
        const existingWorker = workerMatches[workerOccurrence];
        if (!existingWorker) {
          const saved: any = await firstValueFrom(this.detailService.saveCuadrillaItem(workerPayload));
          existingWorkers.push({ ...workerPayload, id: saved?.id ?? saved?.Id });
        } else if (!this.sameNumber(existingWorker.quantity ?? existingWorker.Quantity, worker.quantity)
            || !this.sameNumber(existingWorker.unitCost ?? existingWorker.UnitCost, worker.unitCost)) {
          await firstValueFrom(this.detailService.updateCuadrillaItem(Number(existingWorker.id ?? existingWorker.Id), workerPayload));
        }
      }
    }
  }

  private async ensureFactors(): Promise<void> {
    const expected = [
      { name: 'Indirectos', percentage: 22.73, sortOrder: 10 },
      { name: 'Financiamiento', percentage: 1.58, sortOrder: 20 },
      { name: 'Utilidad', percentage: 10, sortOrder: 30 },
      { name: 'Cargos Adicionales', percentage: 0.96, sortOrder: 40 },
    ];
    const existing = await firstValueFrom(this.factorService.getByContract(this.contractId, this.companyId));
    const extras = (existing ?? []).filter((factor: any) => !expected.some((item) => this.normalize(item.name) === this.normalize(factor.name)));
    if (extras.length) throw new Error('El contrato tiene factores adicionales. Se detuvo para no cambiar precios de otros análisis.');
    for (const factor of expected) {
      const current = (existing ?? []).find((item: any) => this.normalize(item.name) === this.normalize(factor.name));
      const payload = { ...factor, id_company: this.companyId, id_contract: this.contractId, active: true };
      if (!current) await firstValueFrom(this.factorService.add(payload));
      else if (!this.sameNumber(current.percentage, factor.percentage))
        await firstValueFrom(this.factorService.update(Number(current.id ?? current.Id), payload));
    }
  }

  private async ensureReportConfig(): Promise<void> {
    const config: ApuConfig = { idCompany: this.companyId, idContract: this.contractId,
      companyName: 'PEMEX EXPLORACION Y PRODUCCION',
      subdirection: 'SUBDIRECCION DE LA COORDINACION DE SERVICIOS MARINOS',
      anexoLabel: 'ANEXO "H"', analysisTitle: 'ANALISIS DE PRECIOS UNITARIOS',
      licitacionNo: '18575108-002-07', projectTitle: this.projectName, active: true };
    await firstValueFrom(this.configService.save(config));
  }

  private resourceRow(source: any, type: string): any {
    const sourceQuantity = Number(source.quantity) || 0;
    const rounded = this.roundQuantity(sourceQuantity);
    const unitCost = Number(source.unit_price) || 0;
    return { type, idReference: null, description: String(source.description ?? ''), unit: String(source.unit ?? ''),
      quantity: sourceQuantity, sourceQuantity, unitCost, roundedQuantity: rounded.changed,
      roundedMoneyDifference: this.money(rounded.value * unitCost) - this.money(sourceQuantity * unitCost) };
  }

  private findAuxiliaryReference(sourceRef: any, idByUserKey: Map<string, number>): number | null {
    const referenceKey = sourceRef?.user_key ?? sourceRef?.key ?? sourceRef?.clave_usuario;
    return referenceKey == null ? null : idByUserKey.get(String(referenceKey)) ?? null;
  }

  private roundQuantity(value: number): { value: number; changed: boolean } {
    const rounded = Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 10000) / 10000;
    return { value: rounded, changed: Math.abs(value - rounded) > 1e-9 };
  }

  private money(value: number): number { return Math.sign(value) * Math.round((Math.abs(value) + 1e-8) * 100) / 100; }
  private sameNumber(a: any, b: any): boolean { return Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.000005; }
  private normalize(value: any): string { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase(); }
}
