import { Injectable, OnDestroy, inject } from '@angular/core';
import { PosDbService } from './pos-db.service';
import { PosService } from './pos.service';

@Injectable({ providedIn: 'root' })
export class PosSyncService implements OnDestroy {
  private posDb = inject(PosDbService);
  private posService = inject(PosService);
  private syncing = false;

  constructor() {
    window.addEventListener('online', this.onOnline);
    if (navigator.onLine) setTimeout(() => this.syncPending(), 3000);
  }

  ngOnDestroy() {
    window.removeEventListener('online', this.onOnline);
  }

  private onOnline = () => {
    console.log('[POS Sync] Conexión detectada — sincronizando pendientes...');
    this.syncPending();
  };

  async syncPending(): Promise<void> {
    if (this.syncing || !navigator.onLine) return;
    this.syncing = true;
    try {
      const pending = await this.posDb.getPendingSales();
      if (pending.length === 0) return;
      console.log(`[POS Sync] Subiendo ${pending.length} venta(s) pendiente(s)...`);

      for (const sale of pending) {
        const { localId, ...saleData } = sale;
        try {
          const response: any = await this.posService.addSaleXCustomerItem(saleData).toPromise();
          const saleId = response.id;
          const concepts = await this.posDb.getConceptsByLocalSaleId(localId);
          const payloads = concepts.map(({ localId: _cId, localSaleId: _sid, ...c }) => ({
            ...c,
            idSale: saleId,
          }));
          await Promise.all(payloads.map(c => this.posService.addSaleXConceptItem(c).toPromise()));

          // Acumular puntos de fidelidad si la venta tiene celular
          if (sale.phone_number && sale.id_company && saleId) {
            try {
              // Construir desglose por familia usando el caché de productos
              const allProducts = await this.posDb.getProducts();
              const familyMap = new Map<number, { idFamilia: number; amount: number }>();
              for (const c of concepts) {
                const prod = allProducts.find((p: any) => p.id === c.id_product);
                const idFamilia: number = prod?.idFamilia ?? 0;
                const lineAmount: number = (c.quantity ?? 0) * (c.pu ?? 0);
                if (idFamilia && lineAmount > 0) {
                  const existing = familyMap.get(idFamilia);
                  if (existing) existing.amount += lineAmount;
                  else familyMap.set(idFamilia, { idFamilia, amount: lineAmount });
                }
              }
              const lines = Array.from(familyMap.values());

              await this.posService.earnLoyaltyPoints({
                phoneNumber: sale.phone_number,
                idCompany: sale.id_company,
                idSale: saleId,
                amount: sale.amount,
                lines: lines.length > 0 ? lines : undefined
              }).toPromise();
            } catch {
              // No crítico — no bloquear el sync por esto
            }
          }

          await this.posDb.deletePendingSale(localId);
          console.log(`[POS Sync] Venta ${sale.numbernote} sincronizada.`);
        } catch (err) {
          console.warn(`[POS Sync] Falló sincronización de ${sale.numbernote}:`, err);
        }
      }
    } finally {
      this.syncing = false;
    }
  }
}
