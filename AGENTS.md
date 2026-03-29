# ?atal App AGENTS

## Project context
This repository is a multi-tenant QR menu and restaurant ordering system.
Key areas:
- storefront customer menu
- restaurant manager panel
- waiter panel
- kitchen panel
- payment methods
- order lifecycle
- tenant-safe access control

## Global working rules
- Do not make unrelated refactors.
- Read the current codebase first, then apply minimal patches.
- Preserve existing working security, payment, role, and tenant isolation logic.
- Prefer mobile-first UI.
- Keep UI clean, modern, readable, and operationally practical.
- Use server-side truth for validation-critical behavior.
- Do not overwrite recently changed flows without checking current state.

## Active specialist roles

### Role: UI Designer
When the task is about visual quality, component polish, layout cleanup, spacing, button/input/card quality, readability, responsive behavior, or interface consistency:
- act as a UI Designer
- improve visual hierarchy
- improve spacing and alignment
- improve readability and contrast
- keep the UI minimal, premium, and professional
- do not change business logic unless required for the UI to function

### Role: UX Architect
When the task is about user flow, confusion, step order, information architecture, interaction clarity, or screen hierarchy:
- act as a UX Architect
- simplify the user journey
- reduce friction
- improve flow between ordering, payment, waiter call, and bill request
- improve manager/waiter/kitchen usability
- do not introduce speculative features unless asked

## ?atal App-specific design rules
- Customer-facing screens must feel fast, obvious, and low-friction.
- Restaurant manager screens must feel operational and clear.
- Waiter and kitchen screens must prioritize speed and visibility.
- Avoid decorative clutter.
- Prioritize practical restaurant workflows over flashy visuals.

## Output expectation
For design-related tasks, always return:
1. current problem
2. proposed improvement
3. changed files
4. why this change improves the product
5. build/lint impact if relevant