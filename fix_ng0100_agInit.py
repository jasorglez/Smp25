#!/usr/bin/env python3
"""
Fix NG0100 errors in Angular AG Grid cell renderers.
Adds ChangeDetectorRef injection and cdr.detectChanges() at the end
of every agInit() method that doesn't already have it.
"""

import re
import os
import glob


def skip_balanced(content: str, pos: int, open_char: str, close_char: str) -> int:
    """
    Given that content[pos] == open_char, return the index of the matching close_char.
    Handles nested structures and ignores content inside strings.
    """
    depth = 0
    i = pos
    in_string = None
    prev_char = ''

    while i < len(content):
        c = content[i]
        if in_string:
            if c == in_string and prev_char != '\\':
                in_string = None
        elif c in ('"', "'", '`'):
            in_string = c
        elif c == open_char:
            depth += 1
        elif c == close_char:
            depth -= 1
            if depth == 0:
                return i
        prev_char = c
        i += 1
    return -1


def find_method_body_brace(content: str, agInit_keyword_pos: int):
    """
    Starting from agInit keyword position, find:
    1. The opening '(' of the parameter list
    2. Skip to the matching ')'
    3. Skip optional return type annotation ': SomeType'
    4. Find the '{' that opens the method body
    Returns (brace_open_pos, brace_close_pos) or (-1, -1) on failure.
    """
    i = agInit_keyword_pos
    # Advance past 'agInit'
    while i < len(content) and content[i] not in ('(', '\n'):
        i += 1

    if i >= len(content) or content[i] != '(':
        return -1, -1

    # Skip the parameter list
    paren_close = skip_balanced(content, i, '(', ')')
    if paren_close == -1:
        return -1, -1

    i = paren_close + 1

    # Skip whitespace and optional return type
    # The return type can be complex, but it ends at '{'
    # We'll scan forward looking for '{', skipping over '<', '(', '[' balanced pairs
    # and ignoring ':' which begins the return type annotation
    while i < len(content):
        c = content[i]
        if c == '{':
            # This is the method body opening brace
            brace_close = skip_balanced(content, i, '{', '}')
            return i, brace_close
        elif c == '<':
            # Skip generic type parameter
            close = skip_balanced(content, i, '<', '>')
            if close == -1:
                return -1, -1
            i = close + 1
        elif c == '(':
            # Skip nested parens in return type
            close = skip_balanced(content, i, '(', ')')
            if close == -1:
                return -1, -1
            i = close + 1
        elif c in (';', '\n\n'):
            # Hit end of line without finding '{' - method might be abstract or just declared
            return -1, -1
        else:
            i += 1

    return -1, -1


def already_has_cdr_detect(method_body: str) -> bool:
    return 'cdr.detectChanges()' in method_body


def has_any_cdr(content: str) -> bool:
    return bool(
        re.search(r'inject\s*\(\s*ChangeDetectorRef\s*\)', content) or
        re.search(r'(?:private|protected|public)\s+(?:readonly\s+)?cdr\s*:', content) or
        'readonly cdr =' in content
    )


def fix_file(filepath: str) -> tuple[bool, str]:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find agInit keyword (as a method, not as a call like this.agInit())
    # Match agInit as a method definition: agInit followed by '('
    agInit_match = re.search(r'(?<!\.)(?<!\s)\bagInit\b(?=\s*\()', content)
    if not agInit_match:
        # Also try with leading spaces/newlines (method in class body)
        agInit_match = re.search(r'(?:^|\n)\s+agInit\s*\(', content)
        if not agInit_match:
            return False, "no agInit method found"

    # Use the position of 'agInit' keyword
    keyword_pos = content.index('agInit', agInit_match.start())

    brace_open, brace_close = find_method_body_brace(content, keyword_pos)
    if brace_open == -1 or brace_close == -1:
        return False, f"could not find method body braces"

    method_body = content[brace_open:brace_close + 1]

    if already_has_cdr_detect(method_body):
        return False, "already has detectChanges"

    modified = content

    # Step 1: Add ChangeDetectorRef to @angular/core import if not present
    if 'ChangeDetectorRef' not in modified:
        core_import_match = re.search(
            r"(import\s*\{)([^}]*?)(\}\s*from\s*['\"]@angular/core['\"])",
            modified,
            re.DOTALL
        )
        if core_import_match:
            old_imports = core_import_match.group(2)
            new_imports = old_imports.rstrip() + ', ChangeDetectorRef'
            modified = (
                modified[:core_import_match.start(2)] +
                new_imports +
                modified[core_import_match.end(2):]
            )
        else:
            return False, "no @angular/core import found"

    # Step 2: Ensure 'inject' is in the @angular/core import (needed for field injection)
    if not has_any_cdr(modified):
        core_import_match = re.search(
            r"(import\s*\{)([^}]*?)(\}\s*from\s*['\"]@angular/core['\"])",
            modified,
            re.DOTALL
        )
        if core_import_match and 'inject' not in core_import_match.group(2):
            old_imports = core_import_match.group(2)
            new_imports = ' inject,' + old_imports
            modified = (
                modified[:core_import_match.start(2)] +
                new_imports +
                modified[core_import_match.end(2):]
            )

    # Step 3: Add cdr field if not present
    if not has_any_cdr(modified):
        # Find a good insertion point: after the first inject() field in class body
        inject_field_match = re.search(
            r'((?:private|protected|public)\s+(?:readonly\s+)?\w+\s*=\s*inject\([^)]+\)\s*;)',
            modified
        )
        if inject_field_match:
            insert_pos = inject_field_match.end()
            # Figure out indentation
            line_start = modified.rfind('\n', 0, inject_field_match.start()) + 1
            indent_match = re.match(r'(\s+)', modified[line_start:])
            indent = indent_match.group(1) if indent_match else '  '
            modified = (
                modified[:insert_pos] +
                f'\n{indent}private readonly cdr = inject(ChangeDetectorRef);' +
                modified[insert_pos:]
            )
        else:
            # No inject() fields — find the class body opening brace and insert after it
            class_match = re.search(r'\bclass\s+\w[\w<>, ]*(?:implements[^{]*)?\{', modified)
            if class_match:
                class_brace = class_match.end()
                modified = (
                    modified[:class_brace] +
                    '\n  private readonly cdr = inject(ChangeDetectorRef);' +
                    modified[class_brace:]
                )
            else:
                return False, "could not find injection point"

    # Step 4: Re-find agInit method body after modifications
    keyword_pos2 = modified.index('agInit', modified.index('agInit'))
    brace_open2, brace_close2 = find_method_body_brace(modified, keyword_pos2)
    if brace_open2 == -1 or brace_close2 == -1:
        return False, "could not re-find method body after modifications"

    # Determine indentation from inside the method
    # Find the first non-whitespace line inside the method
    method_content = modified[brace_open2 + 1:brace_close2]
    inner_indent = '    '  # default: 4 spaces
    for line in method_content.split('\n'):
        stripped = line.lstrip()
        if stripped and not stripped.startswith('//'):
            inner_indent = line[:len(line) - len(stripped)]
            break

    # Insert before closing brace
    modified = (
        modified[:brace_close2] +
        f'\n{inner_indent}this.cdr.detectChanges();' +
        modified[brace_close2:]
    )

    if modified == content:
        return False, "no change made"

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(modified)

    return True, "ok"


def main():
    files = glob.glob('src/app/**/*.ts', recursive=True)
    files_with_agInit = []
    for f in files:
        try:
            txt = open(f, encoding='utf-8').read()
            if 'agInit' in txt:
                files_with_agInit.append(f)
        except:
            pass

    print(f"Found {len(files_with_agInit)} files with agInit")

    fixed = 0
    skipped = 0
    errors = []

    for filepath in sorted(files_with_agInit):
        try:
            result, reason = fix_file(filepath)
            if result:
                print(f"  FIXED: {filepath}")
                fixed += 1
            else:
                skipped += 1
                if reason not in ('already has detectChanges', 'no agInit method found'):
                    errors.append(f"  SKIP [{reason}]: {filepath}")
        except Exception as e:
            errors.append(f"  ERROR [{e}]: {filepath}")

    print(f"\nDone. Fixed: {fixed}, Skipped: {skipped}")
    if errors:
        print("\nIssues:")
        for e in errors:
            print(e)


if __name__ == '__main__':
    os.chdir('/home/gargadon/Source/Smp25')
    main()
