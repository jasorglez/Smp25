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