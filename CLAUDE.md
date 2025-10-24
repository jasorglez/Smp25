# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

**Build and Watch:**
```bash
npm run watch
# or
ng build --watch --configuration nt
```

## Architecture Overview

This is an Angular 18 application (project name: "bi-aug-24") that connects to a C# backend. The application uses a domain-driven architecture with the following structure:

### Domain Architecture
The application is organized into distinct business domains under `src/app/domains/`:

- **Admonapp**: Administrative application functionality
- **Dashboards**: Business intelligence dashboards with components for different data visualizations
- **Indicadores**: KPI and indicators management 
- **ModAdmon**: Administrative module for financial management
- **ModMaintenance**: Maintenance module for equipment and personnel
- **ModProjects**: Project management module with contracts, estimates, and oilfield operations
- **ModReshumans**: Human Resources module with payroll, employees, and time tracking
- **ModSales**: Sales and POS system with inventory management
- **SMP**: System management and permissions
- **Warehouse**: Warehouse and inventory management

### Key Architectural Patterns

**Domain Structure:** Each domain follows a consistent pattern:
- `components/` - Reusable UI components specific to the domain
- `pages/` - Main page components that orchestrate domain functionality
- Components follow Angular naming conventions with `.component.ts|html|scss`

**Shared Architecture:**
- `src/app/shared/` - Contains reusable components, pipes, and modules
- `src/app/services/` - Business logic and API services
- `src/app/interface/` - TypeScript interfaces and data models
- `src/app/guards/` - Route guards for authentication and permissions

### Technology Stack

**Core Framework:** Angular 18 with TypeScript
**UI Framework:** Bootstrap 5, Angular Material, ng-bootstrap
**Data Visualization:** ApexCharts (ng-apexcharts), ECharts, AG Grid Enterprise
**Maps:** Leaflet with TypeScript definitions
**Firebase:** Authentication and backend services
**PDF Generation:** PDFMake
**Excel:** XLSX library
**Internationalization:** Angular i18n with ngx-translate
**Time Management:** Specialized components for clock/time tracking

### Configuration Notes

**TypeScript Configuration:**
- Strict mode disabled (`"strict": false`)
- Base URL configured to `./src` with path aliases
- Environment alias: `@env/*` maps to `environments/*`

**Build Configuration:**
- Production budget: 3MB warning, 7MB error for initial bundle
- Component styles: 64kB warning, 256kB error
- SCSS preprocessing enabled
- Multiple external scripts and CSS libraries integrated

**Testing:**
- Jasmine and Karma configured
- Tests disabled by default in Angular schematics (`"skipTests": true`)

### Development Workflow

The application supports hot reloading in development mode and includes comprehensive build optimization for production. The codebase appears to be a comprehensive business management system with modules for HR, sales, projects, warehousing, and administrative functions.

## CRUD Forms Standard (v2.50.4 - 24 Oct 2025)

**IMPORTANT:** All CRUD forms in the application MUST follow this standard pattern established in `materiales-maestro` component.

### Version Management

**ALWAYS update version in `src/environments/environment.ts` (line 68) when making changes:**
```typescript
version: '2.50.4 (24 Octubre 2025 17:45)'
```
Format: `MAJOR.MINOR.PATCH (DD Month YYYY HH:MM)`

### Color System (Bootstrap 5)

Standard colors for ALL CRUD operations:
```typescript
const CRUD_COLORS = {
  'agregar':  'btn-success',     // Green - Create new
  'guardar':  'btn-primary',     // Blue - Save changes
  'editar':   'btn-warning',     // Yellow - Edit/Modify
  'eliminar': 'btn-danger',      // Red - Delete
  'deshacer': 'btn-warning',     // Yellow - Undo/Revert

  // Dynamic modal colors by entity type
  'subfamilia':   'bg-primary',   // Blue
  'flavor':       'bg-info',      // Cyan
  'presentation': 'bg-secondary'  // Gray
};
```

### Standard Button Bar (4 mandatory buttons)

```html
<div class="d-flex gap-2">
  <!-- 1. Add (Green) -->
  <button class="btn btn-sm btn-success me-2" (click)="add()" [disabled]="!gridApi">
    <i class="bi bi-plus-lg"></i> Agregar
  </button>

  <!-- 2. Save (Blue with red badge when changes exist) -->
  <button class="btn btn-sm btn-primary me-2 position-relative"
          (click)="saveChanges()" [disabled]="!hasUnsavedChanges">
    <i class="bi bi-floppy"></i> Guardar
    <span class="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
          *ngIf="hasUnsavedChanges">
      <span class="visually-hidden">Hay cambios sin guardar</span>
    </span>
  </button>

  <!-- 3. Undo (Yellow) -->
  <button class="btn btn-sm btn-warning me-2" (click)="revertChanges()">
    <i class="bi bi-arrow-clockwise"></i> Deshacer
  </button>

  <!-- 4. Delete (Red) -->
  <button class="btn btn-sm btn-danger" (click)="delete()" [disabled]="!selectedItem">
    <i class="bi bi-trash"></i> Borrar
  </button>
</div>
```

### Modal Architecture

**NEVER place modals inside AG Grid cell renderers** (they won't display correctly). Use service-based architecture:

```
Parent Component (e.g., materiales-maestro.component.html)
  ├── Universal Modal (lines 52-102)
  │   ├── Dynamic color by entity type
  │   ├── Dynamic icon (add/edit)
  │   ├── Dynamic title
  │   └── Single modal for all entity types
  └── Modal backdrop

Intermediary Service (e.g., subfamilia-modal.service.ts)
  ├── modalRequest$ Observable
  ├── saveConfirmed$ Observable
  ├── openModal(data)
  └── confirmSave(data)

Child Cell Renderer (detail-cell-renderer-*.component.ts)
  ├── Grid + Buttons
  ├── Double-click → calls service
  └── Service opens modal in parent
```

### Standard Workflow

1. User performs action (add/edit/double-click)
2. Cell renderer calls modal service
3. Parent component shows modal
4. User fills form → Click "Guardar/Actualizar"
5. Service sends confirmation
6. Cell renderer updates data (marks `__isNew` or `__modified`)
7. "Guardar" button activates (red badge appears)
8. User clicks "Guardar" → Saves all changes to DB
9. Reload from server
10. Grid refreshed

### Required Variables

```typescript
// In component
gridApi!: GridApi;
treeData: any[] = [];
originalTreeData: any[] = []; // For reverting changes
selectedRowData: any = null;
hasUnsavedChanges: boolean = false;
```

### Required Methods

```typescript
async saveChanges() {
  const itemsToSave = this.treeData.filter(item => item.__isNew || item.__modified);
  // Save to DB with catalogsService
  await this.loadCatalogData(); // Reload from server
}

revertChanges() {
  this.treeData = JSON.parse(JSON.stringify(this.originalTreeData));
  this.hasUnsavedChanges = false;
  this.gridApi.setGridOption('rowData', this.flattenTreeData());
}
```

### Event Handling in Columns

**Click vs Double-Click separation:**
```typescript
{
  headerName: 'Column',
  onCellClicked: (event) => {
    // Single click on chevron → expand/collapse
    if (event.event.target.classList.contains('chevron-icon')) {
      this.toggleExpansion(event.data);
      event.event.stopPropagation();
    }
  },
  onCellDoubleClicked: (event) => {
    // Double click on text → open edit modal
    if (!event.event.target.classList.contains('chevron-icon')) {
      this.openEditModal(event.data);
    }
  }
}
```

### Reference Implementation

**Location:** `src/app/domains/Almacenes/components/materiales-maestro/`
- `services/subfamilia-modal.service.ts` - Modal service
- `details/detail-cell-renderer-subfamilia.component.ts` - Cell renderer with buttons and grid
- `materiales-maestro.component.html` (lines 52-102) - Universal modal
- `materiales-maestro.component.ts` (lines 703-779) - Modal logic

**This pattern applies to:**
- ✅ All new CRUD forms
- ✅ All domains (Almacenes, ModSales, ModProjects, ModAdmon, ModReshumans, etc.)
- ✅ Any component with create/read/update/delete operations

## Project Memories

- Hasta aaqui funciona relativamente bien
- hasta aqui todo bien
- Se ha añadido estimados
- Portando app a Angular
- Añadiendo @capacitor/angular al proyecto
- Interfaz para OT añadida, con Capacitor
- Se ha cambiado el formato de la lista de OT en ot/ordenes
- Se ha modificado reportes-estimaciones