import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PedimentoModificationService {
  readonly pedimentoModified$ = new Subject<number>();
}
