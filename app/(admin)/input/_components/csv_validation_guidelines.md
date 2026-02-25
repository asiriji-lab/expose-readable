# CSV Validation & Editor Implementation Guidelines

This document outlines how to implement the CSV validation system with real-time feedback, custom error tooltips, and prevent infinite loops in the editor.

## 1. Define Validation Rules

Create a `validationUtils.ts` (or similar) to export your rules.
**Key Structure**: `Record<column_index, { pattern: RegExp; message: string }>`

```typescript
// validationUtils.ts
export const MY_PAGE_VALIDATION_RULES: Record<number, { pattern: RegExp; message: string }> = {
    0: { 
        pattern: /^[A-Z]{3}$/, 
        message: "Code must be exactly 3 uppercase letters (e.g., ABC)" 
    },
    2: { 
        pattern: /^\d+$/, 
        message: "Quantity must be a number" 
    }
};
```

## 2. Global Styling (Tooltips)

Ensure `globals.css` has the following overrides to style the FortuneSheet tooltips (rounded corners, word wrap).

```css
/* globals.css */
.luckysheet-postil-show-main {
    word-break: break-word !important;
    white-space: normal !important;
    border-radius: 8px !important;
    padding: 12px !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
    font-family: inherit !important;
    line-height: 1.5 !important;
    background-color: #ffffff !important;
    color: #1f2937 !important;
}

.luckysheet-postil-show {
    border-radius: 8px !important;
    border: 1px solid #e5e7eb !important;
    overflow: hidden !important;
}
```

## 3. CsvEditor Component Integration

When using the `CsvEditor` (or `Workbook`), you need to handle the `onOp` event carefully to avoid infinite loops when setting cell styles.

### A. Props Interface
Update your editor component to accept rules:
```typescript
interface CsvEditorProps {
    // ... other props
    validationRules?: Record<number, { pattern: RegExp; message: string }>;
}
```

### B. The `validateValue` Helper
```typescript
const validateValue = useCallback((colIndex: number, value: any): string | null => {
    // 1. Allow empty/null values (valid by default, or customize if required)
    if (value === null || value === undefined || String(value).trim() === '') return null;

    // 2. Check if rule exists for this column
    const rules = rulesRef.current;
    if (!rules || !rules[colIndex]) return null;

    // 3. Test pattern
    const isValid = rules[colIndex].pattern.test(String(value));
    return isValid ? null : rules[colIndex].message;
}, []);
```

### C. Handling Operations (`onOp`) & Preventing Loops
**CRITICAL**: You must use a flag (e.g., `isInternalChange`) to ignore operations triggered by your own `setCellFormat` calls.

```typescript
const isInternalChange = useRef(false);

const handleOp = useCallback((op: any) => {
    if (!workbookRef.current) return;
    
    // STOP INFINITE LOOP: Ignore changes we made ourselves
    if (isInternalChange.current) return;

    const ops = Array.isArray(op) ? op : [op];

    ops.forEach((o: any) => {
        // We only care about 'replace', 'add', 'remove' on 'data' path
        if ((o.op === 'replace' || o.op === 'add' || o.op === 'remove') && o.path) {
            const path = o.path; // ["data", r, c, prop]
            
            // Ensure it's a cell update
            if (path[0] === 'data' && typeof path[1] === 'number' && typeof path[2] === 'number') {
                const r = path[1];
                const c = path[2];
                const prop = path[3];

                // Ignore style updates (bg, ps) to prevent loops
                if (prop === 'bg' || prop === 'ps') return;
                
                // Ignore non-value updates (unless it's a whole cell replace)
                if (prop && prop !== 'v') return;

                // Extract new value
                let newValue;
                if (path.length === 3) { 
                    // Whole cell replace: check if 'v' exists
                    if (o.value && typeof o.value === 'object' && !('v' in o.value)) return; 
                    newValue = o.value?.v;
                } else if (prop === 'v') {
                    newValue = o.value;
                }

                // Ignore replace with null/undefined (often happens during clear)
                if (o.op === 'replace' && (newValue === null || newValue === undefined)) return;

                // VALIDATE
                const errorMsg = validateValue(c, newValue);
                const isValid = errorMsg === null;
                
                // Define Styles
                const bg = isValid ? "#ffffff" : "#ffcccc";
                // Tooltip (ps): Set size to prevent clipping
                const ps = isValid ? null : { 
                    value: errorMsg, 
                    isshow: false, 
                    width: 250, 
                    height: 120 
                };

                // APPLY UPDATES (Wrapped in flag)
                isInternalChange.current = true;
                setTimeout(() => {
                    workbookRef.current.setCellFormat(r, c, "bg", bg);
                    workbookRef.current.setCellFormat(r, c, "ps", ps);
                    
                    // Reset flag after short delay
                    setTimeout(() => { isInternalChange.current = false; }, 50);
                }, 0);
            }
        }
    });
}, [validateValue]);
```

## 4. Initial Load Validation
Don't forget to validate data when the file is first loaded/parsed!

```typescript
// Inside your processData function
rows.forEach((row, r) => {
    row.forEach((cell, c) => {
        // ...
        const errorMsg = validateValue(c, cell);
        if (errorMsg) {
            bg = "#ffcccc";
            ps = { value: errorMsg, isshow: false, width: 250, height: 120 };
        }
        // ... push to celldata
    });
});
```
