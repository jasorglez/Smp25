# AGENTS.md

This file provides guidance to agentic coding agents working with this Angular 18 business management application.

## Development Commands

**Start Development Server:**
```bash
npm start
# or
ng serve
```

**Build for Production:**
```bash
npm run build
# or 
ng build --configuration production
```

**Run Tests:**
```bash
npm test
# or
ng test
```

**Run Single Test:**
```bash
ng test --include="**/specific-component.spec.ts"
```

**Build and Watch:**
```bash
npm run watch
# or
ng build --watch --configuration nt
```

## Project Architecture

This is an Angular 18 application (project name: "Delison") with domain-driven architecture. The application connects to a C# backend and uses Firebase for authentication.

### Domain Structure
- `src/app/domains/` - Business domains (ModSales, ModProjects, ModAdmon, etc.)
- `src/app/shared/` - Reusable components and utilities
- `src/app/services/` - Business logic and API services
- `src/app/interface/` - TypeScript interfaces
- `src/app/guards/` - Route guards

### Technology Stack
- **Framework:** Angular 18 with TypeScript
- **UI:** Bootstrap 5, Angular Material, ng-bootstrap
- **Data Grid:** AG Grid Enterprise
- **Charts:** ApexCharts, ECharts
- **Maps:** Leaflet
- **Firebase:** Authentication and backend
- **i18n:** ngx-translate (Spanish default)

## Code Style Guidelines

### Import Organization
```typescript
// 1. Angular core imports
import { Component, OnInit, inject } from '@angular/core';

// 2. Third-party libraries
import { ColDef, GridApi } from 'ag-grid-enterprise';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

// 3. Application imports (absolute paths)
import { StoresService } from 'app/services/stores.service';
import { alerts } from 'app/helpers/alerts';
import { MaterialsResponse } from 'app/interface/materials.interface';
```

### Component Structure
```typescript
@Component({
  selector: 'app-component-name',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridModule],
  templateUrl: './component-name.component.html',
  styleUrl: './component-name.component.scss'
})
export class ComponentNameComponent implements OnInit {
  private service = inject(ServiceName);
  
  // Properties
  rowData: any[] = [];
  selectedRowData: any = null;
  hasUnsavedChanges: boolean = false;
  
  // Lifecycle hooks
  ngOnInit() {
    this.loadData();
  }
  
  // Methods
  private loadData() {
    // Implementation
  }
}
```

### Naming Conventions
- **Components:** PascalCase (e.g., `StoresComponent`)
- **Files:** kebab-case (e.g., `stores.component.ts`)
- **Variables:** camelCase (e.g., `selectedRowData`)
- **Methods:** camelCase with descriptive verbs (e.g., `loadData()`, `saveChanges()`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `CRUD_COLORS`)

### TypeScript Configuration
- Strict mode disabled (`"strict": false`)
- Base URL: `"./src"` with path aliases
- Environment alias: `@env/*` maps to `environments/*`

### CRUD Forms Standard (v2.50.4+)

All CRUD forms MUST follow the established pattern from `materiales-maestro` component:

**Standard Button Bar:**
```html
<div class="d-flex gap-2">
  <button class="btn btn-sm btn-success" (click)="add()">
    <i class="bi bi-plus-lg"></i> Agregar
  </button>
  <button class="btn btn-sm btn-primary position-relative" 
          (click)="saveChanges()" [disabled]="!hasUnsavedChanges">
    <i class="bi bi-floppy"></i> Guardar
    <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
          *ngIf="hasUnsavedChanges"></span>
  </button>
  <button class="btn btn-sm btn-warning" (click)="revertChanges()">
    <i class="bi bi-arrow-clockwise"></i> Deshacer
  </button>
  <button class="btn btn-sm btn-danger" (click)="delete()">
    <i class="bi bi-trash"></i> Borrar
  </button>
</div>
```

**Modal Architecture:**
- NEVER place modals inside AG Grid cell renderers
- Use service-based architecture with Observable patterns
- Universal modal in parent component for all entity types

### AG Grid Implementation
```typescript
public defaultColDef: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  flex: 1
};

public columnDefs: ColDef[] = [
  {
    field: 'name',
    headerName: 'Name',
    editable: true,
    onCellValueChanged: (event) => {
      event.data.__modified = true;
      this.hasUnsavedChanges = true;
    }
  }
];
```

### Error Handling
```typescript
// Use alerts helper for user notifications
import { alerts } from 'app/helpers/alerts';

// Service calls with error handling
this.service.getData().subscribe({
  next: (data) => this.rowData = data,
  error: (error) => {
    console.error('Error loading data:', error);
    alerts.basicAlert('Error', 'Failed to load data', 'error');
  }
});
```

### Signals and Reactive Patterns
```typescript
// Use signals for reactive state management
private signalsService = inject(SignalsService);

constructor() {
  effect(() => {
    this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
    this.loadData();
  });
}
```

### Version Management
Always update version in `src/environments/environment.ts`:
```typescript
version: '2.50.4 (24 Octubre 2025 17:45)'
```

## Testing
- Tests disabled by default (`"skipTests": true`)
- Jasmine and Karma configured
- Single test execution supported with `--include` flag

## Build Configuration
- Production budget: 3MB warning, 7MB error
- Component styles: 64kB warning, 256kB error
- SCSS preprocessing enabled

## Development Notes
- Spanish language interface (default)
- Hot reloading supported in development
- Comprehensive build optimization for production
- Domain-specific modules for business functionality
