1. Universal Clean Code Principles
This section defines the mindset of your engineering team. It should emphasize:
• KISS (Keep It Simple, Stupid): Avoid clever or convoluted solutions; a simple approach is easier to maintain.
• DRY (Don’t Repeat Yourself): Consolidate repeated logic into reusable functions or components, but avoid "premature abstraction" that makes code harder to follow.
• YAGNI (You Ain’t Gonna Need It): Only build what is required for today’s problems; don't "future-proof" with unused features.
2. Naming Conventions and Semantics
Names should be meaningful and searchable, revealing their intent without requiring comments.
• Variables: Use purpose-based nouns (e.g., userList or filteredOrders).
• Functions: Use action-oriented verbs (e.g., validateEmail or fetchUser instead of handle or getStuff).
• Booleans: Use interrogative prefixes like is, has, or should (e.g., isAuthenticated).
• Formatting: Standardize on camelCase for variables/functions and PascalCase for components, classes, and interfaces.
3. Architectural Standards
Your document should specify a clear hierarchy for where code "lives."
• Feature-Sliced Design (FSD): Organize code by business domain (slices) and technical purpose (layers like App, Pages, Features, Entities, and Shared).
• Atomic Design: Use this for UI-specific components, breaking them into Atoms (buttons), Molecules (search bars), and Organisms (headers).
• Layer Boundaries: Enforce a strict top-down dependency rule where modules can only import from layers strictly below them to prevent circular dependencies.
4. Component Design and Logic
• Small and Focused: Components should have a Single Responsibility (SRP). If a component handles fetching, transforming, and rendering, it should be split.
• Separation of Concerns: Keep UI components focused on rendering. Move business logic and side effects into custom hooks (for React) or services (for Angular).
• Avoid Deep Nesting: Use guard clauses (early returns) to flatten logic and make the "happy path" easier to read.
5. TypeScript and State Management
• Discriminated Unions: Avoid "boolean soup" (multiple flags like isLoading and isError) by modeling UI states as distinct modes in a single union object.
• Explicit Typing: Always define interfaces for data objects and props rather than using any.
• Immutability: Use const for variables that should not change and readonly for properties initialized by the framework.
6. Tooling and Governance
Automated tools are the "first line of defense" to ensure these standards are followed.
• Linting & Formatting: Use ESLint to catch logic errors and Prettier to handle code style automatically.
• Git Hooks: Use Husky to run linters and tests before every commit, preventing "broken" or messy code from entering the repository.
• Pull Request Hygiene: Limit PRs to roughly 200 lines and never mix file moves with code changes in the same PR