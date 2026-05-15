import { Injectable } from '@angular/core';
import { confirmExitIfUnsaved } from 'app/helpers/can-deactivate.helper';

@Injectable({ providedIn: 'root' })
export class UnsavedChangesTrackerService {
  private dirtyKeys = new Set<string>();

  setDirty(key: string, dirty: boolean): void {
    if (!key) return;
    if (dirty) this.dirtyKeys.add(key);
    else this.dirtyKeys.delete(key);
  }

  unregister(key: string): void {
    if (!key) return;
    this.dirtyKeys.delete(key);
  }

  hasAnyDirty(): boolean {
    return this.dirtyKeys.size > 0;
  }

  isDirty(key: string): boolean {
    return this.dirtyKeys.has(key);
  }

  confirmExitIfAny(): Promise<boolean> {
    return confirmExitIfUnsaved(this.hasAnyDirty());
  }

  clearAll(): void {
    this.dirtyKeys.clear();
  }
}
