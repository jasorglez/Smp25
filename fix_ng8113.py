#!/usr/bin/env python3
"""
Removes components from Angular decorator imports[] arrays
when they're not used in templates (NG8113 warnings).
Only touches the @Component decorator imports, NOT TypeScript import statements.
Handles files with multiple @Component decorators.
"""

import re
import os

# (file_path, component_name_to_remove)
WARNINGS = [
    # Round 2: remaining warnings after first pass
    ("src/app/domains/Almacenes/components/FamilySubFamily/FamilySubFamily.component.ts", "DetailFamilySubFamilyComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/details/detail-cell-renderer-parametros.component.ts", "SelectWithTooltipEditorV2Component"),
    ("src/app/domains/Almacenes/components/materiales-maestro/details/detalle-asignproveeds-matmaestro.component.ts", "AutocompleteEditorComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/details/detalle-asignproveeds-matmaestro.component.ts", "PrecioMonedaEditorComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/details/detalles-costosxmateriales.component.ts", "FormulaEditorComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/details/detalles-costosxmateriales.component.ts", "CurrencyPipe"),
    ("src/app/domains/Almacenes/components/materiales-maestro/details/detalles-costosxmateriales.component.ts", "DetailCellRendererParametrosComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/materiales-maestro.component.ts", "DetalleAsignProveedsMaestroComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/materiales-maestro.component.ts", "DetailCellRendererFamiliaComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/materiales-maestro.component.ts", "DetailCellRendererSucursalComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/materiales-maestro.component.ts", "DetallesCostosxmaterialesComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/materiales-maestro.component.ts", "DetailCellRendererSubfamiliaComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/materiales-maestro.component.ts", "DetallesSucursalesProveedorComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/materiales-maestro.component.ts", "DetailCellRendererParametrosComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/materiales-maestro.component.ts", "DetailCellRendererCaracteristicasMpComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/materiales-maestro.component.ts", "DetailCellRendererHistoricoComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/materiales-maestro.component.ts", "DetailCellRendererJarabeComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/materiales-maestro.component.ts", "SelectWithTooltipEditorV2Component"),
    ("src/app/domains/Almacenes/components/materiales-maestro/materiales-maestro.component.ts", "ImageCellRendererComponent"),
    ("src/app/domains/Almacenes/components/materiales-maestro/materiales-maestro.component.ts", "AutocompleteEditorComponent"),
    ("src/app/domains/Indicadores/components/ind01/stakeholders/stakeholders.component.ts", "StarCellRendererComponent"),
    ("src/app/domains/Indicadores/components/ind01/stakeholders/stakeholders.component.ts", "CustomSelectEditorComponent"),
    ("src/app/domains/Indicadores/components/ind01/workprograms/distribution/workprogram-distribution.component.ts", "SelectWithTooltipEditorV2Component"),
    ("src/app/domains/ModAdmon/components/income/conceptsincome/conceptsincome.component.ts", "SearchableSelectComponent"),
    ("src/app/domains/ModAdmon/components/income/detalle-ingresos.component.ts", "MultiLineEditorComponent"),
    ("src/app/domains/ModAdmon/components/ingresos-palacio/detail-cell-renderer-income.component.ts", "MultiLineEditorComponent"),
    ("src/app/domains/ModAdmon/components/ingresos-palacio/detail-cell-renderer-income.component.ts", "SearchableSelectComponent"),
    ("src/app/domains/ModAdmon/components/ingresos-palacio/detail-cell-renderer-income.component.ts", "SelectWithTooltipEditorV2Component"),
    ("src/app/domains/ModProduction/Components/catalogos/catalogosproduccion.component.ts", "SelectWithTooltipEditorV2Component"),
    ("src/app/domains/ModProduction/Components/catalogos/catalogosproduccion.component.ts", "ConfiguracionPageComponent"),
    ("src/app/domains/ModProduction/Components/catalogos/catalogosproduccion.component.ts", "MultiSelectActividadEditorComponent"),
    ("src/app/domains/ModProduction/Components/catalogos/catalogosproduccion.component.ts", "HijosDetailRendererComponent"),
    ("src/app/domains/ModProduction/Components/molienda/filtrado/lib-limpieza-bote.component.ts", "SelectWithTooltipEditorV2Component"),
    ("src/app/domains/ModProduction/Components/molienda/filtrado/lib-limpieza-bote.component.ts", "MultiSelectEmployeeEditorComponent"),
    ("src/app/domains/ModProduction/Components/molienda/filtrado/lib-limpieza-bote.component.ts", "MultiSelectActividadEditorComponent"),
    ("src/app/domains/ModProduction/Components/molienda/filtrado/lib-limpieza-bote.component.ts", "TimeEditorComponent"),
    ("src/app/domains/ModProduction/Components/molienda/filtrado/mediciones-bote.component.ts", "ItemCommentsCellRendererComponent"),
    ("src/app/domains/ModProduction/Components/molienda/filtrado/mediciones-bote.component.ts", "MedicionMatPrimaComponent"),
    ("src/app/domains/ModProduction/Components/molienda/filtrado/mediciones-bote.component.ts", "SelectWithTooltipEditorV2Component"),
    ("src/app/domains/ModProduction/Components/molienda/filtrado/mediciones-bote.component.ts", "TimeEditorComponent"),
    ("src/app/domains/ModProduction/Components/molienda/filtrado/vista-botes-filtrado.component.ts", "MedicionesBoteComponent"),
    ("src/app/domains/ModProduction/Components/molienda/filtrado/vista-botes-filtrado.component.ts", "ParamsDetailRendererComponent"),
    ("src/app/domains/ModProduction/Components/molienda/oh-bloque/oh-bloque-detail.component.ts", "OhBloqueProductosComponent"),
    ("src/app/domains/ModProduction/Components/molienda/oh-bloque/oh-bloque.component.ts", "OhBloqueDetailComponent"),
    ("src/app/domains/ModProduction/Components/preparacion1/jarabe/limpieza-jarabe.component.ts", "PartesLimpiezaComponent"),
    ("src/app/domains/ModProjects/components/equipment/equipment-detail-renderer.component.ts", "SelectWithTooltipEditorV2Component"),
    ("src/app/domains/ModProjects/components/mano-obra/mano-obra-detail-renderer.component.ts", "SelectWithTooltipEditorV2Component"),
    ("src/app/domains/ModProjects/components/mano-obra/mano-obra.component.ts", "ManoObraDetailRendererComponent"),
    ("src/app/domains/ModProjects/components/materials/material-detail-renderer.component.ts", "SelectWithTooltipEditorV2Component"),
    ("src/app/domains/ModProjects/components/projects/conventions/conventions.component.ts", "DetalleButtonRendererComponent"),
    ("src/app/domains/ModReshumans/components/employees/personal-data/personal-data.component.ts", "DetailEmployeeDocumentsComponent"),
    ("src/app/domains/ModShoppingDelison/pages/gastos/gastos.component.ts", "CrProveedorEditorComponent"),
    ("src/app/domains/ModShoppingDelison/pages/gastos/gastos.component.ts", "PrecioMonedaEditorComponent"),
    ("src/app/domains/ModShoppingDelison/pages/quote-delison/detalle-pedimentosxproveedor.component.ts", "ButtonCellRendererComponent"),
    ("src/app/domains/ModShoppingDelison/pages/quote-delison/detalle-pedimentosxproveedor.component.ts", "PdfButtonCellRendererPedimentosComponent"),
    ("src/app/domains/ModShoppingDelison/pages/quote-delison/detalle-pedimentosxproveedor.component.ts", "DetalleItemsPedimentosComponent"),
    ("src/app/domains/ModShoppingDelison/pages/quote-delison/detalle-pedimentosxproveedor.component.ts", "DetalleItemsProveedorComponent"),
    ("src/app/domains/ModShoppingDelison/pages/quote-delison/detalle-pedimentosxproveedor.component.ts", "DetailCellRendererPedimentoReportComponent"),
    ("src/app/domains/ModShoppingDelison/pages/quote-delison/detalle-pedimentosxproveedor.component.ts", "DetalleProvidersListComponent"),
    ("src/app/domains/ModShoppingTD/components/fam-subfam/fam-subfam.component.ts", "SubfamilyDetailComponent"),
    ("src/app/domains/ModWarehouse/components/providers/details/detail-cell-renderer-cuentas.component.ts", "DetallesComponentCuentas"),
    ("src/app/domains/ModWarehouse/components/providers/details/detail-cell-renderer-cuentas.component.ts", "DetallesComponentCuentasAbono"),
    ("src/app/domains/ModWarehouse/components/providers/details/detalles-tipos-proveedor.component.ts", "SelectWithTooltipEditorV2Component"),
    ("src/app/domains/ModWarehouse/components/purchaseorderdelison/compra-rapida-detalle.component.ts", "ClasificacionCascadaComponent"),
    ("src/app/domains/SMP/Components/permission/detailedpermissions.component.ts", "SubDetailedPermissionsComponent"),
    ("src/app/domains/SMP/Components/permission/detailedpermissions.component.ts", "IconPickerCellEditorComponent"),
    ("src/app/domains/SMP/Components/permission/subdetailedpermissions.component.ts", "IconPickerCellEditorComponent"),
    ("src/app/domains/SMP/Components/users/details/detalle-empresas-usuario.component.ts", "ProyectosDetailRendererComponent"),
    ("src/app/domains/SMP/Components/users/details/detalle-empresas-usuario.component.ts", "ButtonCellRendererExpenditureComponent"),
    ("src/app/domains/SMP/Components/users/details/detalle-empresas-usuario.component.ts", "ContratosDetailRendererComponent"),
    ("src/app/domains/SMP/Components/users/details/detalle-empresas-usuario.component.ts", "AlmacenesDetailRendererComponent"),
    ("src/app/domains/SMP/Components/users/details/detalle-empresas-usuario.component.ts", "SucursalesDetailRendererComponent"),
    ("src/app/domains/SMP/Components/users/details/detallepermisosxsucursales.component.ts", "DetailPermisosXDeptosComponent"),
    ("src/app/domains/SMP/Components/users/details/detallepermisosxsucursales.component.ts", "DetailBranchesRendererComponent"),
    ("src/app/domains/SMP/Components/users/details/detalles-permisos-x-deptos.component.ts", "DetailPermissionsUserComponent"),
    ("src/app/domains/SMP/Components/users/details/detalles-permisos-x-deptos.component.ts", "PermissionsViewByUserComponent"),
    ("src/app/domains/SMP/Components/users/users.component.ts", "DetallePermisosXSucursalesComponent"),
    ("src/app/domains/SMP/Components/users/users.component.ts", "ButtonCellRendererExpenditureComponent"),
]


def remove_from_all_decorator_imports(content: str, component: str) -> tuple[str, bool]:
    """
    Removes `component` from ALL imports: [...] arrays in @Component decorators in the file.
    Returns (new_content, was_changed).
    """
    changed = False
    search_from = 0

    while True:
        decorator_match = re.search(r'@Component\s*\(', content[search_from:])
        if not decorator_match:
            break

        decorator_start = search_from + decorator_match.start()

        # Find imports: [ ... ] array within this decorator
        imports_match = re.search(r'imports\s*:\s*\[', content[decorator_start:decorator_start + 5000])
        if not imports_match:
            search_from = decorator_start + 1
            continue

        imports_start = decorator_start + imports_match.start()
        bracket_open = decorator_start + imports_match.end() - 1

        # Find matching ']'
        depth = 1
        i = bracket_open + 1
        while i < len(content) and depth > 0:
            if content[i] == '[':
                depth += 1
            elif content[i] == ']':
                depth -= 1
            i += 1
        imports_end = i

        imports_block = content[imports_start:imports_end]

        # Try to remove the component
        pattern1 = re.compile(r',\s*' + re.escape(component) + r'\b\s*', re.MULTILINE)
        pattern2 = re.compile(r'\b' + re.escape(component) + r'\s*,\s*', re.MULTILINE)
        pattern3 = re.compile(r'\b' + re.escape(component) + r'\b', re.MULTILINE)

        new_imports_block = imports_block
        if pattern1.search(imports_block):
            new_imports_block = pattern1.sub('', imports_block, count=1)
        elif pattern2.search(imports_block):
            new_imports_block = pattern2.sub('', imports_block, count=1)
        elif pattern3.search(imports_block):
            new_imports_block = pattern3.sub('', imports_block, count=1)

        if new_imports_block != imports_block:
            # Clean up comma artifacts
            new_imports_block = re.sub(r',\s*(\])', r'\1', new_imports_block)
            new_imports_block = re.sub(r'(\[)\s*,', r'\1', new_imports_block)
            new_imports_block = re.sub(r'\[\s+\]', '[]', new_imports_block)

            content = content[:imports_start] + new_imports_block + content[imports_end:]
            imports_end = imports_start + len(new_imports_block)
            changed = True

        search_from = imports_end

    return content, changed


def process_file(filepath: str, components: list[str]) -> int:
    if not os.path.exists(filepath):
        print(f"  SKIP (not found): {filepath}")
        return 0

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    total_changes = 0
    for comp in components:
        content, changed = remove_from_all_decorator_imports(content, comp)
        if changed:
            total_changes += 1
            print(f"  ✓ Removed {comp}")
        else:
            print(f"  ~ Not found: {comp}")

    if total_changes > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    return total_changes


def main():
    files: dict[str, list[str]] = {}
    for filepath, component in WARNINGS:
        if filepath not in files:
            files[filepath] = []
        if component not in files[filepath]:
            files[filepath].append(component)

    total = 0
    for filepath, components in sorted(files.items()):
        print(f"\n{filepath}")
        count = process_file(filepath, components)
        total += count

    print(f"\n{'='*60}")
    print(f"Total removals: {total}")


if __name__ == '__main__':
    main()
