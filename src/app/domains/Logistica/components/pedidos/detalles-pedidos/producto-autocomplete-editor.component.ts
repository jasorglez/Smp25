import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  ChangeDetectorRef,
  NgZone,
  inject,
  OnDestroy,
  Renderer2,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { ICellEditorParams } from 'ag-grid-community';

/**
 * Editor de texto con sugerencias. La lista se renderiza en document.body con position:fixed
 * para que no la recorte overflow:hidden del grid (master-detail, viewport ag-grid).
 */
@Component({
  selector: 'app-producto-autocomplete-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="position: relative; width: 250px;">
      <input
        #inputRef
        type="text"
        [(ngModel)]="value"
        (input)="onInput()"
        (keydown)="onKeyDown($event)"
        (blur)="onInputBlur($event)"
        class="ag-input-field-input"
        style="width: 100%; height: 28px; border: 1px solid #2196f3; outline: none; padding: 0 4px; font-size: 11px; box-sizing: border-box;"
      />
    </div>
  `,
})
export class ProductoAutocompleteEditorComponent
  implements ICellEditorAngularComp, AfterViewInit, OnDestroy
{
  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private renderer = inject(Renderer2);

  value: string = '';
  suggestions: string[] = [];
  filtered: string[] = [];
  showDropdown: boolean = false;
  activeIndex: number = -1;

  private overlayRoot: HTMLElement | null = null;
  private scrollOrResize = (): void => {
    if (this.overlayRoot && this.showDropdown) {
      this.positionOverlay();
    }
  };

  agInit(params: ICellEditorParams & { suggestions: string[] }): void {
    this.value = params.value || '';
    this.suggestions = params.suggestions || [];
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.inputRef?.nativeElement?.focus();
      this.inputRef?.nativeElement?.select();
    }, 0);
    window.addEventListener('scroll', this.scrollOrResize, true);
    window.addEventListener('resize', this.scrollOrResize);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.scrollOrResize, true);
    window.removeEventListener('resize', this.scrollOrResize);
    this.removeOverlay();
  }

  getValue(): string {
    return this.value;
  }

  isPopup(): boolean {
    return true;
  }

  onInputBlur(event: FocusEvent): void {
    const next = event.relatedTarget as HTMLElement | null;
    if (next && this.overlayRoot?.contains(next)) {
      return;
    }
    setTimeout(() => {
      if (!this.overlayRoot?.contains(document.activeElement)) {
        this.zone.run(() => {
          this.showDropdown = false;
          this.removeOverlay();
          this.cdr.markForCheck();
        });
      }
    }, 150);
  }

  onInput(): void {
    this.zone.run(() => {
      const q = this.value.toLowerCase().trim();
      if (q.length === 0) {
        this.filtered = [];
        this.showDropdown = false;
        this.removeOverlay();
        return;
      }
      this.filtered = this.suggestions
        .filter((s) => s.toLowerCase().includes(q))
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .slice(0, 10);
      this.showDropdown = this.filtered.length > 0;
      this.activeIndex = -1;
      if (this.showDropdown) {
        this.renderOrUpdateOverlay();
      } else {
        this.removeOverlay();
      }
    });
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.showDropdown || !this.overlayRoot) return;

    if (event.key === 'ArrowDown') {
      this.activeIndex = Math.min(this.activeIndex + 1, this.filtered.length - 1);
      this.highlightActiveInOverlay();
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      this.activeIndex = Math.max(this.activeIndex - 1, -1);
      this.highlightActiveInOverlay();
      event.preventDefault();
    } else if (event.key === 'Enter' && this.activeIndex >= 0) {
      this.selectItem(this.filtered[this.activeIndex]);
      event.stopPropagation();
    } else if (event.key === 'Escape') {
      this.zone.run(() => {
        this.showDropdown = false;
        this.removeOverlay();
      });
    }
  }

  selectItem(item: string): void {
    this.zone.run(() => {
      this.value = item;
      this.showDropdown = false;
      this.filtered = [];
      this.removeOverlay();
    });
  }

  private renderOrUpdateOverlay(): void {
    this.removeOverlay();
    const input = this.inputRef?.nativeElement;
    if (!input || !this.filtered.length) return;

    const root = this.renderer.createElement('div');
    this.renderer.setStyle(root, 'position', 'fixed');
    this.renderer.setStyle(root, 'z-index', '20050');
    this.renderer.setStyle(root, 'background', 'white');
    this.renderer.setStyle(root, 'border', '1px solid #ccc');
    this.renderer.setStyle(root, 'box-shadow', '0 4px 12px rgba(0,0,0,0.25)');
    this.renderer.setStyle(root, 'max-height', '220px');
    this.renderer.setStyle(root, 'overflow-y', 'auto');
    this.renderer.setStyle(root, 'min-width', '250px');
    this.renderer.setStyle(root, 'font-size', '11px');
    this.renderer.setAttribute(root, 'class', 'producto-autocomplete-overlay');

    this.filtered.forEach((item, i) => {
      const row = this.renderer.createElement('div');
      this.renderer.setStyle(row, 'padding', '6px 10px');
      this.renderer.setStyle(row, 'cursor', 'pointer');
      this.renderer.setStyle(row, 'white-space', 'nowrap');
      this.renderer.listen(row, 'mousedown', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectItem(item);
      });
      const text = this.renderer.createText(item);
      this.renderer.appendChild(row, text);
      this.renderer.appendChild(root, row);
    });

    this.renderer.appendChild(document.body, root);
    this.overlayRoot = root;
    this.positionOverlay();
    this.highlightActiveInOverlay();
  }

  private positionOverlay(): void {
    const input = this.inputRef?.nativeElement;
    if (!input || !this.overlayRoot) return;
    const r = input.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const estimated = Math.min(220, this.filtered.length * 28 + 8);
    let top = r.bottom;
    if (spaceBelow < estimated && r.top > estimated) {
      top = r.top - estimated;
    }
    this.renderer.setStyle(this.overlayRoot, 'left', `${r.left}px`);
    this.renderer.setStyle(this.overlayRoot, 'top', `${top}px`);
    this.renderer.setStyle(this.overlayRoot, 'width', `${Math.max(r.width, 250)}px`);
  }

  private highlightActiveInOverlay(): void {
    if (!this.overlayRoot) return;
    const children = this.overlayRoot.children;
    for (let i = 0; i < children.length; i++) {
      const el = children[i] as HTMLElement;
      this.renderer.setStyle(el, 'background', i === this.activeIndex ? '#e3f2fd' : 'white');
    }
  }

  private removeOverlay(): void {
    if (this.overlayRoot) {
      try {
        this.renderer.removeChild(document.body, this.overlayRoot);
      } catch {
        /* ya removido */
      }
      this.overlayRoot = null;
    }
  }
}
