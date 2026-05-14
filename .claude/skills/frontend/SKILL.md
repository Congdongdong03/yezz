---
name: frontend
description: Frontend development, UI implementation, and client-side architecture. Use when building or modifying web interfaces, components, or client-side logic.
---

# Frontend Skill

## When to Use

- Building or modifying UI components (React, Vue, Angular, Svelte, etc.)
- Implementing responsive designs or CSS layouts
- Adding client-side state management
- Optimizing web performance (bundle size, rendering, loading)
- Implementing accessibility (a11y) features
- Adding animations or interactions
- Working with browser APIs or frontend tooling

## Guidelines

1. **Component Design**:
   - Prefer composition over inheritance.
   - Keep components focused on a single responsibility.
   - Separate presentational components from container components.

2. **State Management**:
   - Lift state up only when necessary.
   - Prefer local state over global state.
   - Use URL state for shareable/page-level state.

3. **Performance**:
   - Lazy load routes and heavy components.
   - Memoize expensive computations and callbacks.
   - Optimize re-renders (React.memo, useMemo, useCallback where measured).

4. **Accessibility**:
   - Use semantic HTML elements.
   - Ensure keyboard navigability.
   - Add appropriate ARIA labels when HTML semantics are insufficient.
   - Maintain color contrast ratios (WCAG 4.5:1 for normal text).

5. **Styling**:
   - Use design tokens for consistency (colors, spacing, typography).
   - Prefer CSS-in-JS, CSS Modules, or utility classes over global CSS.
   - Support dark mode if the product requires it.

6. **Error Handling**:
   - Implement error boundaries for React apps.
   - Show user-friendly error states, not console errors.
   - Handle loading and empty states explicitly.

## Tech Stack Defaults

- **Framework**: React (Next.js for full-stack), Vue (Nuxt), or as specified by the project.
- **Styling**: Tailwind CSS, CSS Modules, or Styled Components.
- **State**: React Context + hooks, Zustand, Redux Toolkit, or Pinia.
- **Testing**: Vitest + React Testing Library, or Playwright for E2E.
