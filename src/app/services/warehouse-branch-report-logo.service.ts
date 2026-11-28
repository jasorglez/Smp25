import { Injectable, inject } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { BranchsService } from './branchs.service';
import { WarehousesService } from './warehouses.service';

@Injectable({ providedIn: 'root' })
export class WarehouseBranchReportLogoService {
  private branches = inject(BranchsService);
  private warehouses = inject(WarehousesService);

  async getLogo(idRoot: number, idBranch: number, idWarehouse?: number): Promise<string> {
    if (!idRoot) return '';
    try {
      const response: any = await lastValueFrom(this.branches.getBranches(idRoot));
      const branches: any[] = Array.isArray(response) ? response : response?.data || [];
      let branch = branches.find(item => Number(item.id) === Number(idBranch) && Number(idBranch) > 0);
      if (!branch && idWarehouse > 0) {
        const warehouses = await Promise.all(branches.map(item =>
          lastValueFrom(this.warehouses.getWarehouses(Number(item.id))).catch(() => [])
        ));
        const index = warehouses.findIndex((group: any) => (Array.isArray(group) ? group : []).some((warehouse: any) =>
          Number(warehouse.idAlmacen ?? warehouse.idWarehouse ?? warehouse.id) === Number(idWarehouse)
        ));
        if (index >= 0) branch = branches[index];
      }
      if (!branch?.image) return '';
      return await this.toPngDataUrl(branch.image);
    } catch (error) {
      console.warn('No se pudo cargar el logo de la sucursal para el reporte.', error);
      return '';
    }
  }

  private toPngDataUrl(source: string): Promise<string> {
    return new Promise(resolve => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          canvas.getContext('2d')?.drawImage(image, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch { resolve(''); }
      };
      image.onerror = () => resolve('');
      image.src = source;
    });
  }
}
