# ModWarehouse — User Flows Documentation

> Complete documentation of all user interactions, UI elements, API calls, and business rules for the ModWarehouse module. Generated from Angular 18 source code.

## Table of Contents
1. [requisitionsdelison](#1-requisitionsdelison)
2. [detalles-requisicion-delison](#2-detalles-requisicion-delison)
3. [purchaseorderdelison](#3-purchaseorderdelison)
4. [ordenesydetallesOc](#4-ordenesydetallesOc)
5. [quote](#5-quote)
6. [materials](#6-materials)
7. [providers](#7-providers)
8. [entrances](#8-entrances)
9. [outings](#9-outings)
10. [Cascada hierarchy](#10-cascada-hierarchy)
11. [Common patterns](#11-common-patterns)

---

## 1. requisitionsdelison

**File:** `components/requisitionsdelison/requisitionsdelison.component.ts`

### Purpose
Master grid for creating, editing, and managing **Requisiciones** (requisitions) linked to branches.

### Grid columns (colDefs)
| Field | Header | Editable | Notes |
|-------|--------|----------|-------|
| `requisitionNumber` | No. Req | No | Auto-generated from PrefixSetup |
| `requestDate` | Fecha Req | Yes (date) | Defaults to today |
| `solicitedBy` | Solicita | Yes (autocomplete) | Current user name |
| `idReference` | Sucursal | Yes (dropdown) | Branch selector |
| `departmentId` | Depto. Solicita | Yes (dropdown) | Loaded from roles per branch |
| `delivery` | Entrega | Yes | Free text, default "NO APLICA" |
| `deliveryTime` | Tiempo Entrega | Yes | Default "1 DAY" |
| `typeOc` | Tipo OC | Yes (dropdown) | Default "INSUMOS" |
| `column8` | Prioridad | Yes | |
| `comments` | Comentarios | Yes | |
| `articlesCount` | # Art. | No | Display count |

### Buttons
- **Agregar** — Adds new row (temp ID `temp_`), sets `__isNew`, moves row to top
- **Guardar** — Saves new + modified items, validates departments against roles, confirms folio in PrefixSetup
- **Deshacer** — Reloads from server, clears `hasUnsavedChanges`
- **Borrar** — Deletes selected row (validates permission combo branch+dept; rejects if articles > 0)
- **PDF** — Generates PDF via `receiptsDelisonService.generateOC(requisitionId, 'open')`
- **Refrescar** — Reloads from server

### Filters
- AG Grid built-in column filters (text, number, date)
- External filter by authorized branches/departments via `externalFilterChanged`

### Key business rules
1. **Permission check** — Row is only editable if user has branch+department combination assigned (`canUserModifyRow`)
2. **Unsaved changes guard** — `CanComponentDeactivate` with `confirmExitIfUnsaved`
3. **Primary department** — Auto-loaded for each branch via `permitionsService.getRolYPosicion`
4. **Consecutives** — Generated server-side by `prefixSetupService.getNextFolio`, confirmed after save

### API calls
- `ocAndReqsService.loadRequisitions()` — Load all
- `ocAndReqsService.addOcAndReq(data)` — Create
- `ocAndReqsService.updateOcAndReq(id, data)` — Update
- `ocAndReqsService.deleteOcAndReq(id)` — Delete
- `prefixSetupService.getNextFolio('branch', idRef, 'req')` — Get next folio
- `prefixSetupService.confirmFolio(setupId, 'req')` — Confirm folio after save
- `rolesService.getRolesByBranchDelison(userId, branchId)` — Load roles
- `permitionsService.getRolYPosicion(userId, branchId)` — Load permissions

---

## 2. detalles-requisicion-delison

**File:** `components/requisitionsdelison/detalles-requisicion-delison.component.ts`

### Purpose
Detail grid for items within a single Requisition. Rendered as master-detail under the parent `requisitionsdelison`.

### Grid columns (colDefs)
| Field | Header | Editable | Notes |
|-------|--------|----------|-------|
| `article` | Artículo | Yes (autocomplete) | Searches materials |
| `numArticle` | # Art. | No | From material or auto-generated |
| `quantity` | Cantidad Requerida | Yes (conditional) | Opens modal for Externo |
| `measure` | Unidad | Yes (dropdown) | From catalogs MEASURE |
| `recurrent` | recurrent | Yes (dropdown) | "Recurrente" or "Nuevo" |
| `intorext` | Tipo | Yes (dropdown) | "Externo" or "Interno" |
| `idProvider` | Proveedor | Yes (autocomplete) | Required if Interno |
| `compraRapida` | Compra Rapida | Yes (checkbox) | |
| `typePriority` | Prioridad | Yes (dropdown) | "Normal", "Urgente" |
| `pedimiento` | Pedimento | Yes (checkbox) | Disabled if Interno or Compra Rapida |
| `pedimentoNumber` | Pedimento # | No | Comma-separated numbers |
| `comment` | Comentario | Yes | |

### Buttons
- **Agregar** — Adds new item row with defaults
- **Guardar** — Saves new/modified items; creates materials if `recurrent === 'Nuevo'`
- **Multiguardar (saveMultiGuardar)** — Creates COTIZ (quotation) from checked pedimento items
- **Deshacer** — Reloads from server
- **Borrar** — Deletes selected item (validates no warehouse entries exist)

### Tabs / Panels
- **Presentaciones panel** (`presentaciones-panel.component`) — Opens when material has `validaPresentaciones` flag
- **Cantidad mínimos panel** (`cantidad-minimos-panel.component`) — Opens for Externo items without presentation flag
- **New article modal** — Opens for creating new materials inline

### Key business rules
1. **Nuevo article flow** — If `recurrent === 'Nuevo'`, auto-creates material via `materialsService.addMaterial` with category "NUEVO"
2. **Pedimento checkboxes** — Multiple items can be checked, then saved as a single COTIZ
3. **Presentation flag** — Material with `validaPresentaciones` uses panel with provider min-buy validation
4. **Min-buy modal** — Externo items without presentation flag validate against provider minimum purchase
5. **Compra Rápida sync** — `ocAndReqsService.syncCompraRapida(requisitionId)` called after save

### API calls
- `ocAndReqsService.getDetailedReq(requisitionId)` — Load parent
- `ocAndReqsService.addReqItem(payload)` — Create item
- `ocAndReqsService.updateReqItem(id, payload)` — Update item
- `ocAndReqsService.deleteReqItem(id)` — Delete item
- `ocAndReqsService.compraRapidaHasEntradas(itemId)` — Check if item has warehouse entries
- `ocAndReqsService.syncCompraRapida(requisitionId)` — Sync compra rápida documents
- `materialsService.addMaterial(data)` — Create new material
- `customersService.getCustomersByCompany(idRoot, 'PROVIDERS')` — Load providers
- `catalogsService.getCatalogs(idRoot, 'MEASURE')` — Load measures
- `itemCommentsService.addComment(data)` — Add item comment
- `itemCommentsService.deleteCommentsByArticle(type, id, numArticle, prefix)` — Delete comments
- `prefixSetupService.getNextFolio('branch', idRef, 'cotiz')` — Get COTIZ folio
- `prefixSetupService.confirmFolio(setupId, 'cotiz')` — Confirm COTIZ folio

---

## 3. purchaseorderdelison

**File:** `components/purchaseorderdelison/purchaseorderdelison.component.ts`

### Purpose
Master grid for **Órdenes de Compra** (purchase orders) grouped by Pedimento.

### Grid columns
| Field | Header | Editable | Notes |
|-------|--------|----------|-------|
| `folio` | Folio OC | No | |
| `datecreate` | Fecha Creación | No | |
| `conditions` | Condiciones | Yes | Payment conditions |
| `providerName` | Proveedor | No | |
| `typeoc` | Tipo OC | No | |
| `totalOc` | Total OC | No | Currency-aware |
| `anticipoOc` | Anticipo OC | Yes (currency) | |

### Buttons
- **Agregar** — New purchase order
- **Guardar** — Save changes
- **Deshacer** — Reload
- **Borrar** — Delete
- **PDF** — Generate PDF
- **Registrar Anticipo** — Marks advance as "EN TRÁMITE" in Captura de Gastos
- **Editar Fecha Anticipo** — Changes advance payment date

### Key business rules
1. **Anticipo flow** — Advance must be registered before it appears in Captura de Gastos
2. **Currency awareness** — Total and anticipo show currency abbreviation based on items
3. **Blocked state** — OC can be locked when all items have been received

### API calls
- `ocAndReqsService.getOcsByPedimento(idPedimento)` — Load OCs by pedimento
- `ocAndReqsService.getReqItems(ocId)` — Load items
- `gastosService.marcarAnticipo(ocId, amount, fecha?)` — Register advance

---

## 4. ordenesydetallesOc

**File:** `components/purchaseorderdelison/ordenesydetallesOc.component.ts`

### Purpose
Three-level hierarchical grid for viewing OC details: OC → Items → Entregas (deliveries).

### Grid levels
1. **Level 1 (OC)** — Purchase order header
2. **Level 2 (Items)** — Articles within the OC
3. **Level 3 (Entregas)** — Delivery schedule per item

### Level 2 columns (Items)
| Field | Header | Notes |
|-------|--------|-------|
| `namearticle` | Artículo | |
| `quantity` | Cantidad | |
| `price` | Precio | Tooltip shows IVA breakdown |
| `conditions` | Cantidad Entregas | Clickable, opens delivery modal |
| `typeoc` | Tipo OC | "COMPRA AUTORIZADA SIN LIMITE", etc. |
| `compraMinima` | Compra Mínima | |
| `itemspdf` | PDFs | Shows document count |

### Level 3 columns (Entregas)
| Field | Header | Notes |
|-------|--------|-------|
| `fechaEntrega` | Fecha Entrega | |
| `cantidadRecibir` | Cantidad Recibir | |
| `notaFactura` | Nota Factura | |
| `totalEntrega` | Total Entrega | Auto-calculated |
| `fechaEntradaAlmacen` | Fecha Entrada | Blocked if entered |

### Buttons
- **Agregar (nivel 2)** — Add item row
- **Guardar (nivel 2)** — Save items
- **Deshacer (nivel 2)** — Revert items
- **Agregar (nivel 3)** — Add delivery row
- **Eliminar (nivel 3)** — Delete last delivery (blocked if closed/entered)
- **Guardar (nivel 3)** — Save deliveries
- **Deshacer (nivel 3)** — Revert deliveries
- **Panel de Reparto** — Opens modal to distribute quantities across deliveries

### Key business rules
1. **Delivery distribution** — `openEntregasModal` calculates max deliveries based on `compraMinima`
2. **Blocked deliveries** — Closed or received deliveries cannot be edited or deleted
3. **EntregasPendingService** — Tracks pending changes across levels; flushes on save
4. **PDF count** — Shows number of attached documents per item via `intandoutDocumentsService`
5. **Tooltip on OC** — Hover shows items with quantities (req vs prov vs deliveries)
6. **Liberar Almacén** — Toggle releases items to warehouse of requesting department

### API calls
- `entregaOcService.getByDetail(idDetail)` — Load deliveries
- `entregaOcService.delete(id)` — Delete delivery
- `entregasPendingService.set/get/flush` — Pending changes service
- `intandoutDocumentsService.getIntandoutDocumentsById(id, type)` — Load documents
- `entradaMoliendaService.getByOcAndMaterial(idOc, idSupplie)` — Check warehouse entries
- `ocAndReqsService.patchLiberarAlmacen(id, value)` — Toggle warehouse release

---

## 5. quote

**File:** `components/quote/quote.component.ts`

### Purpose
Master grid for **Cotizaciones** (quotations) with up to 3 provider slots per quote.

### Grid columns
| Field | Header | Editable | Notes |
|-------|--------|----------|-------|
| `folio` | Folio | Yes | Auto-generated from PrefixSetup |
| `dateCreate` | Fecha | No | |
| `idReq` | Requisición | Yes (dropdown) | Links to requisition |
| `solicit` | Solicita | Yes (autocomplete) | |
| `proveedor1` | Proveedor 1 | Clickable | Opens provider detail |
| `proveedor2` | Proveedor 2 | Clickable | Opens provider detail |
| `proveedor3` | Proveedor 3 | Clickable | Opens provider detail |
| `pedimento` | Pedimento | Clickable | Shows pedimento count |

### Buttons
- **Agregar** — New quote with auto-folio
- **Guardar** — Saves all quotes; checks if requisition should be locked
- **Deshacer** — Revert
- **Borrar** — Soft-delete (sets `active = 0`)
- **PDF** — Generate via `receiptsService.generateOC`

### Provider flow
1. Click provider column → If no COTIZ exists, opens provider selection modal
2. Creates COTIZ record with type `'COTIZ'`
3. Copies all items from REQUIS to COTIZ
4. Opens `ProviderQuoteDetailComponent` as detail renderer
5. Provider can set prices, upload pricing PDFs

### Pedimento flow
1. Click pedimento column → Opens `DetailCellRendererPedimentosComponent`
2. Shows all COTIZ records for the requisition
3. Each pedimento has its own items

### Key business rules
1. **3-provider limit** — Maximum 3 providers per quote
2. **Requisition locking** — After all pedimentos have OCs generated, requisition is locked
3. **Cotiz slots** — Array of `{ cotizId, idProvider, providerName }` per provider number

### API calls
- `quotesService.loadAll()` — Load quotes
- `quotesService.addOcAndReq(data)` — Create quote
- `quotesService.updateOcAndReq(id, data)` — Update quote
- `quotesService.deleteOcAndReq(id)` — Soft delete
- `quotesService.getReqItems(requisitionId)` — Load requisition items
- `quotesService.addReqItem(data)` — Create COTIZ item
- `quotesService.getCotizByReq(idReq, typeRef, idRef)` — Load existing COTIZs
- `quotesService.shouldLockRequisicion(idReq)` — Check if lock needed
- `quotesService.lockRequisition(idReq, lock)` — Lock/unlock
- `prefixSetupService.getNextFolio(type, idRef, 'cotiz')` — Get folio

---

## 6. materials

**File:** `components/materials/materials.component.ts`

### Purpose
Master grid for **Materiales** (materials/products) catalog with tabs for presentations, parameters, and history.

### Grid columns
| Field | Header | Editable | Notes |
|-------|--------|----------|-------|
| `insumo` | No. Material | No | Auto-generated |
| `description` | Descripción | Yes | |
| `idFamilia` | Familia | Yes (dropdown) | |
| `idSubfamilia` | Subfamilia | Yes (dropdown) | |
| `idMedida` | Unidad Medida | Yes (dropdown) | |
| `picture` | Imagen | Yes | |
| `costoFinal` | Costo Final | No | |

### Tabs
- **Presentaciones** — Price presentations per material
- **Parámetros** — Quality parameters (temperature, pH, viscosity, etc.)
- **Histórico** — Cost history with dates and assignments
- **Proveedores por Sucursal** — Providers per branch

### Buttons
- **Agregar** — New material
- **Guardar** — Save
- **Deshacer** — Revert
- **Borrar** — Delete

### Double-click behavior
- Double-click `insumo` → Opens tabs panel for that material
- Double-click `idProveedor` → Opens provider tabs for that branch

### API calls
- `materialsService.getMaterials(idRoot, type)` — Load materials
- `materialsService.addMaterial(data)` — Create
- `materialsService.updateMaterial(id, data)` — Update
- `materialsService.deleteMaterial(id)` — Delete
- `catalogsService.getCatalogs(idRoot, 'MEASURE')` — Measures
- `catalogsService.getFamilyById(idRoot)` — Families
- `catalogsService.getCatalogs(idRoot, 'SUBFAMILY')` — Subfamilies

---

## 7. providers

**File:** `components/providers/providers.component.ts`

### Purpose
Master grid for **Proveedores** (providers/customers) with expandable detail sections.

### Grid columns
| Field | Header | Editable | Notes |
|-------|--------|----------|-------|
| `company` | Compañía | Yes (autocomplete) | |
| `nameContact` | Contacto Principal | Yes | |
| `phone` | Teléfono | Yes | |
| `email` | Email | Yes | Validated regex |
| `rfc` | RFC | Yes | |
| `city` | Ciudad | Yes | |
| `state` | Estado | Yes | |
| `cp` | C.P. | Yes | Auto-fills city/state/coords |
| `vigente` | Vigente | Yes (checkbox) | |
| `autorizacion` | Por Autorizar | No (read-only) | |
| `typeIntOrExt` | Tipo | Yes (dropdown) | "Externo" or "Interno" |
| `fieldContact` | Contactos | Clickable | Expandable detail |
| `fieldBank` | Bancos | Clickable | Expandable detail |
| `fieldCuenta` | Cuentas | Clickable | Expandable detail |
| `fieldMaterial` | Materiales | Clickable | Expandable detail |
| `typeProvider` | Tipo Proveedor | Clickable | Expandable detail |

### Buttons
- **Agregar** — New provider with temp ID
- **Guardar** — Validates company/contact required; email format; saves ProviderXTable changes
- **Deshacer** — Revert
- **Borrar** — Deletes provider and all linked records (contacts, banks, accounts, materials, subfamilies, sucursales)

### Detail sections (click column to expand)
1. **Contactos** — Contact records per provider
2. **Bancos** — Bank accounts with principal bank tracking
3. **Cuentas por Pagar** — Accounts payable
4. **Materiales** — Materials assigned to provider
5. **Tipo Proveedor** — Provider type classification (cascada)

### Key business rules
1. **Delete cascade** — `deleteWarehouseLinksForProvider` removes subfamilies, ProviderXTable, sucursales
2. **CP auto-fill** — `getZipCodeData` fills city, state, coordinates
3. **Detail counts** — `loadDetailCounts` fetches real counts of contacts and materials
4. **Flag sync** — `autorizacion` flag synced between `matprov` and `tracking` tables

### API calls
- `customerService.getProvidersForGrid(idRoot)` — Load providers
- `customerService.addCustomer(data)` — Create
- `customerService.updateCustomer(id, data)` — Update
- `customerService.deleteCustomer(id)` — Delete
- `customerService.getAutorizacionFlagsByIds(ids, idRoot)` — Get authorization flags
- `providersService.addProviderXTable(data)` — Add detail record
- `providersService.deleteProviderXTable(id)` — Delete detail record
- `providersService.getProvidersXTable(providerId, type)` — Load detail records
- `providersService.getSubfamilyxProviderByProvider(id)` — Load subfamilies
- `providersService.deleteSubfamilyxProvider(id)` — Delete subfamily
- `materialsService.getMaterialsByProvider(id)` — Load materials
- `sucursalByMpService.getSucursalByMaterial(id)` — Load sucursales
- `sucursalByMpService.deleteSucursalByMaterial(id)` — Delete sucursal
- `inegiService.getZipCodeData(cp)` — Get address data

---

## 8. entrances

**File:** `components/entrances/entrances.component.ts`

### Purpose
Master-detail grid for **Entradas al Almacén** (warehouse entries).

### Grid structure
- **Master** — Entry headers (OC, date, status)
- **Detail** — Items within each entry

### Buttons
- **Agregar (master)** — New entry
- **Guardar (master)** — Save
- **Deshacer (master)** — Revert
- **Borrar (master)** — Delete
- **Agregar (detail)** — New detail item
- **Guardar (detail)** — Save
- **Deshacer (detail)** — Revert
- **Borrar (detail)** — Delete

### API calls
- `inAndOutService.loadInAndOuts()` — Load entries
- `inAndOutService.addInAndOut(data)` — Create
- `inAndOutService.updateInAndOut(id, data)` — Update
- `inAndOutService.deleteInAndOut(id)` — Delete
- `inAndOutService.loadInAndOutItems(id)` — Load detail items
- `inAndOutService.addInAndOutItem(data)` — Create detail
- `inAndOutService.updateInAndOutItem(id, data)` — Update detail
- `inAndOutService.deleteInAndOutItem(id)` — Delete detail

---

## 9. outings

**File:** `components/outings/outings.component.ts`

### Purpose
Master-detail grid for **Salidas del Almacén** (warehouse exits).

### Grid structure
- **Master** — Exit headers
- **Detail** — Items within each exit

### Buttons
- **Agregar (master)** — New exit
- **Guardar (master)** — Save
- **Deshacer (master)** — Revert
- **Borrar (master)** — Delete
- **Agregar (detail)** — New detail item
- **Guardar (detail)** — Save
- **Deshacer (detail)** — Revert
- **Borrar (detail)** — Delete

### API calls
- `inAndOutService.loadInAndOuts()` — Load exits
- `inAndOutService.addInAndOut(data)` — Create
- `inAndOutService.updateInAndOut(id, data)` — Update
- `inAndOutService.deleteInAndOut(id)` — Delete
- `inAndOutService.loadInAndOutItems(id)` — Load detail items
- `inAndOutService.addInAndOutItem(data)` — Create detail
- `inAndOutService.updateInAndOutItem(id, data)` — Update detail
- `inAndOutService.deleteInAndOutItem(id)` — Delete detail

---

## 10. Cascada hierarchy

The module implements a **3-level cascada** (cascade) for quotations:

```
Requisición (REQUIS)
  └─ Cotización (QUOTE) — up to 3 providers
       └─ Pedimento (COTIZ) — per provider
            └─ Provider Detail — prices, PDFs
```

### Flow
1. **Requisición** created in `requisitionsdelison`
2. **Cotización** created in `quote` linked to requisition via `idReq`
3. Up to **3 providers** assigned via provider selection modal
4. For each provider, a **COTIZ** record created with all items copied from REQUIS
5. Provider sets prices in `ProviderQuoteDetailComponent`
6. After all pedimentos have OCs, requisition is **locked**

### Data flow between components
```
requisitionsdelison → detalles-requisicion-delison → quote → provider-quote-detail
                                                           → detail-cell-renderer-pedimentos
```

---

## 11. Common patterns

### AG Grid Enterprise
- All grids use AG Grid Enterprise with `AG_GRID_LOCALE_ES`
- Master-detail with `detailCellRenderer` for expandable rows
- Custom cell editors: `SelectDepartmentEditorComponent`, `SelectPersonEditorComponent`, autocomplete
- Cell renderers for checkboxes, buttons, tooltips, PDF counts
- Row selection: `'multiple'` or single click
- `singleClickEdit: false` — Double-click to edit (most grids)
- Column state persistence via `localStorage` keyed by user email

### CRUD pattern
```typescript
// Standard add/save/revert/delete pattern
addRow() → temp ID, __isNew flag
saveChanges() → POST for __isNew, PUT for __modified
revertChanges() → reload from server
deleteEntry() → soft delete (active=0) or hard delete
```

### Unsaved changes guard
```typescript
// CanComponentDeactivate
async canDeactivate(): Promise<boolean> {
  return confirmExitIfUnsaved(this.hasUnsavedChanges);
}
```

### Signals
```typescript
// Reactive state from sidebar
this.idBranch = this.signalsService.getBranchSelectedBySidebar()();
this.idRoot = this.signalsService.getRootSelectedBySidebar()();
this.idUser = this.signalsService.getIdUSer()();
```

### SweetAlert2
```typescript
// Confirmations
Swal.fire({ title, icon, showCancelButton, confirmButtonText })
alerts.confirmAlert(title, text, icon, confirmText)
alerts.reqSuccessToast(title, message)
alerts.reqErrorToast(title, message)
alerts.reqWarningToast(title, message)
```

### Services used across components
| Service | Purpose |
|---------|---------|
| `OcAndReqsService` | CRUD for requisitions, orders, items |
| `SignalsService` | Sidebar state (branch, root, user) |
| `MaterialsService` | Materials catalog |
| `ProvidersService` | Provider details (contacts, banks, accounts) |
| `ReceiptsService` | PDF generation |
| `CatalogsService` | Catalogs (measures, families, etc.) |
| `AuthService` | User authentication |
| `BranchsService` | Branches |
| `PrefixSetupService` | Folio generation |
| `DepartmentsService` | Departments |
| `CustomersService` | Providers/Customers |
| `EntregasPendingService` | Pending delivery changes |
| `ConditionsPendingService` | Pending condition changes |
| `EntradaMoliendaService` | Warehouse entry molienda |
| `IntandoutDocumentsService` | Document attachments |
