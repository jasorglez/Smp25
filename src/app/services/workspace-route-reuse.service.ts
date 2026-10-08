import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, BaseRouteReuseStrategy, DetachedRouteHandle, destroyDetachedRouteHandle } from '@angular/router';
import { WorkspaceTabsService } from './workspace-tabs.service';

@Injectable()
export class WorkspaceRouteReuseStrategy extends BaseRouteReuseStrategy {
  private tabs = inject(WorkspaceTabsService);
  private handles = new Map<string, DetachedRouteHandle>();
  private identity = '';
  private path(route: ActivatedRouteSnapshot): string {
    return '/' + route.pathFromRoot.flatMap(part => part.url.map(segment => segment.path)).join('/');
  }
  private synchronize(): void {
    let identity = '';
    try { identity = `${localStorage.getItem('mail')}|${localStorage.getItem('company')}`; } catch { return; }
    for (const [key, handle] of this.handles) {
      if (identity !== this.identity || !this.tabs.tabs().some(tab => tab.url.split('?')[0] === key)) {
        destroyDetachedRouteHandle(handle);
        this.handles.delete(key);
      }
    }
    this.identity = identity;
  }
  override shouldDetach(route: ActivatedRouteSnapshot): boolean {
    this.synchronize();
    const path = this.path(route);
    let authenticated = false;
    try { authenticated = !!localStorage.getItem('mail'); } catch { return false; }
    return authenticated && [
      '/procmodadmon/expend', '/procmodadmon/income', '/procmodadmon/palacio-municipal/egresos'
    ].includes(path) && this.tabs.tabs().some(tab => tab.url.split('?')[0] === path);
  }
  override store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = this.path(route);
    if (handle) this.handles.set(key, handle);
    else this.handles.delete(key);
  }
  override shouldAttach(route: ActivatedRouteSnapshot): boolean {
    this.synchronize();
    return this.handles.has(this.path(route));
  }
  override retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    return this.handles.get(this.path(route)) ?? null;
  }
}
