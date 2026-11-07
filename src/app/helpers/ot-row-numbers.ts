import { GridApi, IRowNode } from 'ag-grid-enterprise';

// Rebuild once when the displayed model changes, rather than scan for every cell.
export class OtRowNumbers {
  private numbers = new WeakMap<IRowNode, number>();

  get(node: IRowNode): number | string {
    return node && !node.group ? this.numbers.get(node) ?? '' : '';
  }

  update(api: GridApi): void {
    const counters = new Map<string, number>();
    api.forEachNodeAfterFilterAndSort(node => {
      if (node.group || !node.data) return;
      const project = String(node.data.idProject ?? node.data.projectId ?? node.data.idProyecto ?? 'sin-proyecto');
      const number = (counters.get(project) || 0) + 1;
      counters.set(project, number);
      this.numbers.set(node, number);
    });
    api.refreshCells({ columns: ['otRowNumber'], force: true });
  }
}
