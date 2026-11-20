/** Moves Enter between editable cells in the same row, in displayed column order. */
export function navigateEditableCellOnEnter(event: any): void {
  const keyboardEvent: KeyboardEvent | undefined = event?.event;
  if (keyboardEvent?.key !== 'Enter' || keyboardEvent.isComposing) return;

  const api = event.api;
  const currentColumnId = event.column?.getColId();
  const editableColumns = api?.getAllDisplayedColumns?.().filter((column: any) => {
    const colDef = column.getColDef();
    const editable = colDef.editable;
    return typeof editable === 'function'
      ? Boolean(editable({ ...event, colDef, column }))
      : editable === true;
  }) || [];
  const currentIndex = editableColumns.findIndex(
    (column: any) => column.getColId() === currentColumnId
  );

  // Leave Enter's normal behavior alone outside editable cells.
  if (currentIndex < 0) return;

  keyboardEvent.preventDefault();
  keyboardEvent.stopPropagation();
  api.stopEditing();
  if (editableColumns.length < 2) return;

  const direction = keyboardEvent.shiftKey ? -1 : 1;
  const nextIndex = (currentIndex + direction + editableColumns.length) % editableColumns.length;
  const nextColumnId = editableColumns[nextIndex].getColId();
  const node = event.node;

  setTimeout(() => {
    const rowIndex = node?.rowIndex;
    if (rowIndex === null || rowIndex === undefined) return;
    api.ensureIndexVisible(rowIndex);
    api.ensureColumnVisible(nextColumnId);
    api.setFocusedCell(rowIndex, nextColumnId);
    api.startEditingCell({ rowIndex, colKey: nextColumnId });
  });
}
