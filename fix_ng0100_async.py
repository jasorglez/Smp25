#!/usr/bin/env python3
"""
Fix NG0100 and stuck loading spinners: adds cdr.detectChanges() at the end
of every async method (with await) that doesn't already have it as its last statement.

Fixes from v1:
- Double comma: import already ending with ',' before adding ChangeDetectorRef
- Wrong class:  cdr field is inserted into the SAME class as the method, not the first class found
- Inheritance:  skips adding cdr if parent class already declares it
- String safety: skip_balanced correctly handles '', "", `` with nested ${} expressions
"""

import re
import os
import glob


# ── String-aware scanner ───────────────────────────────────────────────────

def skip_balanced(content: str, pos: int, open_ch: str, close_ch: str) -> int:
    """
    Starting at content[pos] == open_ch, return the matching close_ch position.
    Handles '', "", `` strings (with \\-escapes) and ${...} inside template literals.
    """
    depth = 0
    i = pos
    in_str = None      # None | '"' | "'" | '`'
    in_template_expr = 0  # depth of ${...} inside template literals
    prev = ''

    while i < len(content):
        c = content[i]

        if in_str == '`':
            # Inside template literal
            if c == '\\' and prev != '\\':
                prev = c; i += 1; continue   # skip next char
            if c == '`' and prev != '\\':
                in_str = None
            elif c == '$' and i + 1 < len(content) and content[i+1] == '{':
                # Enter template expression — track depth separately
                in_template_expr += 1
                prev = c; i += 1; continue
            elif in_template_expr > 0:
                if c == '{': in_template_expr += 1
                elif c == '}':
                    in_template_expr -= 1
                    if in_template_expr < 0: in_template_expr = 0
        elif in_str:
            # Inside '' or ""
            if c == '\\' and prev != '\\':
                prev = c; i += 1; continue
            if c == in_str and prev != '\\':
                in_str = None
        else:
            # Not in string — handle comments first
            if c == '/' and i + 1 < len(content):
                if content[i + 1] == '/':
                    # Skip line comment
                    while i < len(content) and content[i] != '\n':
                        i += 1
                    prev = '\n'; continue
                elif content[i + 1] == '*':
                    # Skip block comment
                    i += 2
                    while i < len(content) - 1 and not (content[i] == '*' and content[i + 1] == '/'):
                        i += 1
                    i += 2  # skip '*/'
                    prev = ''; continue
            if c in ('"', "'", '`'):
                in_str = c
            elif c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    return i

        prev = c
        i += 1
    return -1


def find_method_body(content: str, name_end: int):
    """
    Given position just after the method name (name_end), scan for '(' then '{'
    then return (open_brace, close_brace).  Correctly skips generic params, return types.
    """
    i = name_end
    # skip to '('
    while i < len(content) and content[i] in (' ', '\t', '\n', '<'):
        if content[i] == '<':
            close = skip_balanced(content, i, '<', '>')
            if close == -1: return -1, -1
            i = close + 1
        else:
            i += 1
    if i >= len(content) or content[i] != '(':
        return -1, -1
    paren_close = skip_balanced(content, i, '(', ')')
    if paren_close == -1: return -1, -1
    i = paren_close + 1
    # skip to '{'
    while i < len(content):
        c = content[i]
        if c == '{':
            close = skip_balanced(content, i, '{', '}')
            return i, close
        elif c in (' ', '\t', '\n', ':', '|', '&', '(', ')'):
            i += 1
        elif c == '<':
            close = skip_balanced(content, i, '<', '>')
            if close == -1: return -1, -1
            i = close + 1
        elif c == ';':
            return -1, -1  # abstract / interface method
        else:
            i += 1
    return -1, -1


# ── Class span finder ──────────────────────────────────────────────────────

CLASS_DECL_RE = re.compile(
    r'\bclass\s+(\w+)(?:\s*<[^>]*>)?(?:\s+extends\s+([\w.<>, \[\]]+?))?(?:\s+implements\s+[^{]+)?\s*\{'
)

def find_classes(content: str) -> list:
    """
    Returns list of dicts:
      { name, extends, body_start (pos of '{'), body_end (pos of '}') }
    """
    classes = []
    for m in CLASS_DECL_RE.finditer(content):
        brace_open = content.index('{', m.start())
        brace_close = skip_balanced(content, brace_open, '{', '}')
        if brace_close == -1:
            continue
        parent = m.group(2).strip().split('<')[0].strip() if m.group(2) else None
        classes.append({
            'name': m.group(1),
            'extends': parent,
            'body_start': brace_open,
            'body_end': brace_close,
        })
    return classes


def class_for_pos(classes: list, pos: int):
    """Return the innermost class dict that contains pos."""
    result = None
    for cls in classes:
        if cls['body_start'] < pos < cls['body_end']:
            if result is None or cls['body_start'] > result['body_start']:
                result = cls
    return result


# ── cdr detection ─────────────────────────────────────────────────────────

def class_has_cdr(content: str, cls: dict) -> bool:
    body = content[cls['body_start']:cls['body_end']]
    return bool(
        re.search(r'inject\s*\(\s*ChangeDetectorRef\s*\)', body) or
        re.search(r'(?:private|protected|public)\s+(?:readonly\s+)?cdr\s*[=:]', body)
    )


def any_ancestor_has_cdr(content: str, cls: dict, all_classes: list) -> bool:
    """Walk the extends chain and check if any ancestor has cdr in this file."""
    parent_name = cls.get('extends')
    if not parent_name:
        return False
    for c in all_classes:
        if c['name'] == parent_name:
            if class_has_cdr(content, c):
                return True
            return any_ancestor_has_cdr(content, c, all_classes)
    return False


def detect_changes_is_last(body: str) -> bool:
    inner = body[1:-1].rstrip()
    return inner.endswith('this.cdr.detectChanges();') or inner.endswith('this.cdr.detectChanges()')


def get_indent(body: str) -> str:
    for line in body.split('\n')[1:]:
        stripped = line.lstrip()
        if stripped and not stripped.startswith('//') and not stripped.startswith('*'):
            return line[:len(line) - len(stripped)]
    return '    '


# ── import helpers ─────────────────────────────────────────────────────────

CORE_IMPORT_RE = re.compile(
    r"(import\s*\{)(.*?)(\}\s*from\s*['\"]@angular/core['\"])",
    re.DOTALL
)

def ensure_import(content: str, symbol: str) -> str:
    m = CORE_IMPORT_RE.search(content)
    if not m:
        return content
    imports_block = m.group(2)
    if symbol in imports_block:
        return content
    # Strip trailing comma/whitespace, add symbol
    stripped = imports_block.rstrip().rstrip(',')
    new_imports = stripped + ', ' + symbol
    return content[:m.start(2)] + new_imports + content[m.end(2):]


# ── per-class cdr injection ────────────────────────────────────────────────

def inject_cdr_into_class(content: str, cls: dict) -> str:
    """Add `private readonly cdr = inject(ChangeDetectorRef);` into the class body."""
    body_start = cls['body_start']
    body_end   = cls['body_end']
    class_body = content[body_start:body_end]

    # Find first inject() field inside this class body
    inject_m = re.search(
        r'(?:private|protected|public)\s+(?:readonly\s+)?\w+\s*=\s*inject\([^)]+\)\s*;',
        class_body
    )
    if inject_m:
        abs_pos = body_start + inject_m.end()
        line_start = content.rfind('\n', 0, body_start + inject_m.start()) + 1
        indent_m = re.match(r'(\s+)', content[line_start:])
        indent = indent_m.group(1) if indent_m else '  '
        return content[:abs_pos] + f'\n{indent}private readonly cdr = inject(ChangeDetectorRef);' + content[abs_pos:]

    # Fallback: right after the class opening brace
    return content[:body_start + 1] + '\n  private readonly cdr = inject(ChangeDetectorRef);' + content[body_start + 1:]


# ── String/comment position checker ───────────────────────────────────────

def build_code_mask(content: str) -> list[bool]:
    """
    Returns a bool list: True if position is real code, False if inside a
    string literal, template literal, or comment.
    Fast pre-pass so we don't re-scan for every regex match.
    """
    n = len(content)
    mask = [True] * n
    i = 0
    in_str = None
    in_template_expr = 0
    prev = ''

    while i < n:
        c = content[i]

        if in_str == '`':
            mask[i] = False
            if c == '\\' and prev != '\\':
                prev = c; i += 1
                if i < n: mask[i] = False
                i += 1; continue
            if c == '`' and prev != '\\':
                in_str = None; in_template_expr = 0
            elif c == '$' and i + 1 < n and content[i + 1] == '{':
                in_template_expr += 1
                prev = c; i += 1
                mask[i] = False; i += 1; continue
            elif in_template_expr > 0:
                if c == '{': in_template_expr += 1
                elif c == '}':
                    in_template_expr -= 1
                    if in_template_expr < 0: in_template_expr = 0
                    if in_template_expr == 0:
                        # Back in template string context
                        pass
        elif in_str:
            mask[i] = False
            if c == '\\' and prev != '\\':
                prev = c; i += 1
                if i < n: mask[i] = False
                i += 1; continue
            if c == in_str and prev != '\\':
                in_str = None
        else:
            # Line comment
            if c == '/' and i + 1 < n and content[i + 1] == '/':
                mask[i] = False
                i += 1
                while i < n and content[i] != '\n':
                    mask[i] = False
                    i += 1
                prev = ''; continue
            # Block comment
            elif c == '/' and i + 1 < n and content[i + 1] == '*':
                mask[i] = False; i += 1; mask[i] = False; i += 1
                while i < n - 1 and not (content[i] == '*' and content[i + 1] == '/'):
                    mask[i] = False; i += 1
                if i < n: mask[i] = False; i += 1
                if i < n: mask[i] = False; i += 1
                prev = ''; continue
            elif c in ('"', "'", '`'):
                mask[i] = False
                in_str = c
        prev = c
        i += 1
    return mask


# ── Async method regex ─────────────────────────────────────────────────────

# Matches class-level async methods (with optional modifiers)
# DOES NOT match: async arrow functions, anonymous async functions
ASYNC_METHOD_RE = re.compile(
    r'(?:^|(?<=\n))([ \t]*)(?:(?:private|protected|public|override|static)\s+)*async\s+(\w+)\s*[<(]',
)


# ── Main ───────────────────────────────────────────────────────────────────

def fix_file(filepath: str) -> tuple[bool, str]:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'async ' not in content or 'await ' not in content:
        return False, 'no async/await'

    classes = find_classes(content)
    if not classes:
        return False, 'no classes'

    code_mask = build_code_mask(content)

    # Collect (method_pos, method_name, open_brace, close_brace, cls) for methods needing fix
    to_fix = []

    for m in ASYNC_METHOD_RE.finditer(content):
        # Skip if the match is inside a string or comment
        if not code_mask[m.start()]:
            continue
        method_name = m.group(2)
        # find '(' position (after method name)
        name_start = m.start() + m.group(0).index(method_name)
        name_end   = name_start + len(method_name)

        open_brace, close_brace = find_method_body(content, name_end)
        if open_brace == -1 or close_brace == -1:
            continue

        body = content[open_brace:close_brace + 1]
        if 'await ' not in body:
            continue
        if detect_changes_is_last(body):
            continue

        cls = class_for_pos(classes, open_brace)
        if not cls:
            continue

        to_fix.append((name_start, method_name, open_brace, close_brace, cls))

    if not to_fix:
        return False, 'nothing to fix'

    # Apply in reverse order so positions stay valid
    to_fix.sort(key=lambda x: x[0], reverse=True)

    modified = content

    for name_start, method_name, open_brace, close_brace, cls in to_fix:
        # Re-locate close_brace in modified content
        # (modifications before this point shift positions, but we process in reverse order)
        body = modified[open_brace:close_brace + 1]
        if detect_changes_is_last(body):
            continue
        indent = get_indent(body)
        modified = modified[:close_brace] + f'\n{indent}this.cdr.detectChanges();' + modified[close_brace:]

    if modified == content:
        return False, 'no change'

    # Add imports FIRST — before re-parsing classes, so positions are stable.
    # ensure_import inserts text near the top of the file, shifting all positions.
    # Doing it here once (before position-sensitive operations) prevents stale offsets.
    modified = ensure_import(modified, 'inject')
    modified = ensure_import(modified, 'ChangeDetectorRef')

    # Re-parse classes from modified content to get correct positions
    classes2 = find_classes(modified)

    # Add cdr to each class that needs it
    # Process in reverse order of body_start to keep positions valid
    classes_needing_cdr = set()
    for _, method_name, open_brace, close_brace, cls in to_fix:
        classes_needing_cdr.add(cls['name'])

    classes2.sort(key=lambda c: c['body_start'], reverse=True)
    for cls2 in classes2:
        if cls2['name'] not in classes_needing_cdr:
            continue
        if class_has_cdr(modified, cls2):
            continue
        if any_ancestor_has_cdr(modified, cls2, classes2):
            continue
        # Also skip if the class extends something — the parent (in another file)
        # may already have cdr. Only add cdr to classes that don't extend anything,
        # OR whose parent is clearly a framework class (Component, Directive, etc.)
        parent = cls2.get('extends')
        skip_class = False
        if parent and parent not in ('Component', 'Directive', 'Pipe', 'Injectable',
                                      'NgModule', 'CanActivate', 'CanDeactivate'):
            parent_file_ref = re.search(
                rf"import\s*\{{[^}}]*{re.escape(parent)}[^}}]*\}}\s*from\s*['\"]([^'\"]+)['\"]",
                modified
            )
            if parent_file_ref:
                parent_path = parent_file_ref.group(1)
                base_dir = os.path.dirname(filepath)
                for ext in ('.ts', '.component.ts'):
                    candidate = os.path.normpath(os.path.join(base_dir, parent_path + ext))
                    if os.path.exists(candidate):
                        try:
                            parent_content = open(candidate, encoding='utf-8').read()
                            if 'ChangeDetectorRef' in parent_content and 'cdr' in parent_content:
                                skip_class = True
                        except:
                            pass
                        break
        if skip_class:
            continue
        modified = inject_cdr_into_class(modified, cls2)
        # re-parse after injection so subsequent classes have right positions
        classes2 = find_classes(modified)
        classes2.sort(key=lambda c: c['body_start'], reverse=True)

    if modified == content:
        return False, 'no effective change'

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(modified)

    names = list(dict.fromkeys(m[1] for m in to_fix))
    return True, ', '.join(names[:6]) + (f' (+{len(names)-6} more)' if len(names) > 6 else '')


def main():
    # Only components — services/pipes/guards don't have templates and don't need detectChanges()
    files = glob.glob('src/app/**/*.component.ts', recursive=True)
    print(f"Scanning {len(files)} component files...")

    fixed = 0
    errors = []
    for filepath in sorted(files):
        try:
            result, reason = fix_file(filepath)
            if result:
                print(f"  FIXED [{reason}]: {filepath}")
                fixed += 1
        except Exception as e:
            errors.append(f"  ERROR [{e}]: {filepath}")

    print(f"\nDone. Fixed {fixed} files.")
    if errors:
        print("\nErrors:")
        for e in errors[:20]:
            print(e)


if __name__ == '__main__':
    os.chdir('/home/gargadon/Source/Smp25')
    main()
