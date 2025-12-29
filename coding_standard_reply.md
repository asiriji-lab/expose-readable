# Coding Standards & Guidelines

This document outlines the coding standards for our engineering team. It focuses on readability, maintainability, and scalability.

## 1. Universal Clean Code Principles

### KISS (Keep It Simple, Stupid)
Avoid clever or convoluted solutions. A simple approach is easier to maintain and debug.

**Incorrect (Over-engineering):**
```typescript
function getDayName(dayIndex: number): string {
    const days: { [key: number]: string } = {
        0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
        4: 'Thursday', 5: 'Friday', 6: 'Saturday'
    };
    return days[dayIndex] ? days[dayIndex] : 'Unknown';
}
```

**Correct (Simple):**
```typescript
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDayName(dayIndex: number): string {
    return DAYS[dayIndex] || 'Unknown';
}
```

### DRY (Don’t Repeat Yourself)
Consolidate repeated logic into reusable functions or components.

**Incorrect (Repetition):**
```typescript
// Component A
const taxA = price * 0.07;
const totalA = price + taxA;

// Component B
const taxB = price * 0.07;
const totalB = price + taxB;
```

**Correct (Reusable Function):**
```typescript
// utils/price.ts
export const calculateTotalWithTax = (price: number, taxRate: number = 0.07) => {
    return price * (1 + taxRate);
}
```

### YAGNI (You Ain’t Gonna Need It)
Only build what is required for today’s problems.

**Incorrect (Future-proofing):**
```typescript
// Adding an unused 'theme' parameter just in case we need it later
const Button = ({ onClick, theme = 'dark' }: ButtonProps) => { ... } // 'theme' is never used
```

**Correct:**
```typescript
const Button = ({ onClick }: ButtonProps) => { ... }
```

---

## 2. Naming Conventions

Names should be meaningful and searchable.

### Variables & Constants
Use purpose-based nouns.

**Incorrect:**
```typescript
const d = 5;
const list = ['User1', 'User2'];
```

**Correct:**
```typescript
const retryDelaySeconds = 5;
const activeUserNames = ['User1', 'User2'];
```

### Functions
Use action-oriented verbs.

**Incorrect:**
```typescript
function data(id: string) { ... }
function handle() { ... }
```

**Correct:**
```typescript
function fetchUserData(id: string) { ... }
function handleSubmit() { ... }
```

### Booleans
Use interrogative prefixes like `is`, `has`, or `should`.

**Incorrect:**
```typescript
const valid = true;
const open = false;
```

**Correct:**
```typescript
const isValid = true;
const isOpen = false;
```

---

## 3. Architectural Standards

We recognize two main architectural patterns: **Feature-Sliced Design (FSD)** for large-scale apps and **Atomic Design** for component libraries.

### Feature-Sliced Design (FSD)
Organize code by business domain (slices) and technical purpose (layers).

**Structure Example:**
```
src/
  app/          # Global setup (providers, styles, router)
  pages/        # Routing components
  features/     # Reusable business logic (e.g., auth, cart)
  entities/     # Business models (e.g., user, product)
  shared/       # Generic utilities and UI kit (no business logic)
```

### Atomic Design
Use this for UI-specific components.

**Structure Example:**
```
src/components/
  atoms/        # Button, Input, Icon
  molecules/    # SearchBar (Input + Button)
  organisms/    # Header (Logo + Nav + SearchBar)
```

**Rule:** Dependencies only flow **downwards**. `features` can import `entities` and `shared`, but `shared` cannot import `features`.

---

## 4. Component Design

### Single Responsibility Principle (SRP)
Components should do one thing well.

**Incorrect (God Component):**
```tsx
const UserProfile = () => {
    // Fetches data
    // Validates form
    // Renders UI
    // Handles redirects
    return <div>...</div>
}
```

**Correct (Separation):**
```tsx
const UserProfile = () => {
    const { user, isLoading } = useUser(); // Logic in hook

    if (isLoading) return <Spinner />;
    
    return <UserDisplay user={user} />; // UI-only component
};
```

### Guard Clauses
Flatten logic by returning early.

**Incorrect (Deep Nesting):**
```tsx
const DataView = ({ data, loading, error }) => {
    if (!loading) {
        if (!error) {
            if (data) {
                return <div>{data.title}</div>
            }
        }
    }
    return <div>Fallback</div>
}
```

**Correct (Early Return):**
```tsx
const DataView = ({ data, loading, error }) => {
    if (loading) return <Spinner />;
    if (error) return <ErrorMessage />;
    if (!data) return <EmptyState />;

    return <div>{data.title}</div>
}
```

---

## 5. TypeScript & State Management

### Discriminated Unions
Avoid "boolean soup" for state.

**Incorrect:**
```typescript
interface State {
    data: User | null;
    isLoading: boolean;
    isError: boolean;
    errorMsg: string;
}
```

**Correct:**
```typescript
type State = 
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: User }
    | { status: 'error'; error: string };
```

### Explicit Typing
Avoid `any`.

**Incorrect:**
```typescript
const handleData = (data: any) => { console.log(data.id); }
```

**Correct:**
```typescript
interface UserData {
    id: string;
    name: string;
}

const handleData = (data: UserData) => { console.log(data.id); }
```

---

## 6. Tooling & Governance

### Linting & Formatting
- **ESLint**: Catches logic errors.
- **Prettier**: Enforces consistent style (indentation, quotes).

### Git Hooks (Husky)
Runs checks before commit.
- `pre-commit`: Runs `lint-staged` (linting + formatting).
- `pre-push`: Runs unit tests.

### Pull Requests
- Keep PRs small (< 200 lines).
- Descriptive titles and summaries.
- One feature/fix per PR.
