import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface PendingCondition {
  item: any;
  condicionesPago: number;
}

@Injectable({ providedIn: 'root' })
export class ConditionsPendingService {
  private pending = new Map<number, PendingCondition>();

  private _hasPending = new BehaviorSubject<boolean>(false);
  hasPending$ = this._hasPending.asObservable();

  add(itemId: number, item: any, condicionesPago: number): void {
    this.pending.set(itemId, { item, condicionesPago });
    this._hasPending.next(true);
  }

  getPending(): PendingCondition[] {
    return [...this.pending.values()];
  }

  remove(itemId: number): void {
    this.pending.delete(itemId);
    this._hasPending.next(this.pending.size > 0);
  }

  clear(): void {
    this.pending.clear();
    this._hasPending.next(false);
  }
}
