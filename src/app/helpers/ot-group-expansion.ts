/** Conserva la expansión por empresa y ruta de grupo durante la vida de la pantalla. */
export class OtGroupExpansion {
  private readonly states = new Map<string, boolean>();
  private restoring = false;

  private key(node: any, companyId: number): string {
    const path: Array<[string, string | null]> = [];
    for (let parent = node; parent?.group; parent = parent.parent) {
      path.unshift([parent.rowGroupColumn?.getColId() ?? parent.field ?? '', parent.key]);
    }
    return JSON.stringify([companyId, path]);
  }

  remember(node: any, companyId: number): void {
    if (node?.group && !this.restoring) this.states.set(this.key(node, companyId), !!node.expanded);
  }

  isOpen(node: any, companyId: number, selectedProjectId: number): boolean {
    return this.states.get(this.key(node, companyId)) ??
      (node.field === 'idProject' && selectedProjectId > 0 && String(node.key) === String(selectedProjectId));
  }

  restore(api: any, companyId: number): void {
    if (!api || api.isDestroyed?.()) return;
    this.restoring = true;
    try {
      api.forEachNode((node: any) => {
        if (!node.group) return;
        const expanded = this.states.get(this.key(node, companyId));
        if (expanded !== undefined && expanded !== !!node.expanded) api.setRowNodeExpanded(node, expanded);
      });
    } finally {
      this.restoring = false;
    }
  }

  openProject(api: any, companyId: number, projectId: number): void {
    if (!api || !projectId || api.isDestroyed?.()) return;
    api.forEachNode((node: any) => {
      if (node.group && node.field === 'idProject' && String(node.key) === String(projectId) &&
          this.states.get(this.key(node, companyId)) !== false && !node.expanded) {
        api.setRowNodeExpanded(node, true);
      }
    });
  }
}
