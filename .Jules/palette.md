## 2026-09-08 - Accessible Table Headers
**Learning:** Table headers (`<th>`) mapped with JavaScript click listeners for sorting are invisible to keyboard users by default, breaking keyboard accessibility.
**Action:** When adding sorting to table headers, always add `tabindex="0"`, `role="button"`, clear `:focus-visible` styles, and attach a `keydown` listener supporting `Enter` and `Space` keys to trigger the sorting logic.
## 2024-05-24 - Empty States with Filters
**Learning:** When building vanilla HTML/JS applications, empty states triggered by filters should provide a direct CTA to clear those filters, significantly reducing user frustration.
**Action:** When implementing filterable lists, always evaluate the empty state and consider adding a "Clear Filters" action directly within the empty state message.

## 2024-05-24 - Interactive pseudo-elements and keyboard focus
 **Learning:** In this vanilla JS setup, "fake" buttons like `.pill.fail` (for retrying failed API calls) or styled file inputs (`display: none` inner input) break keyboard accessibility since they aren't native interactive elements or are hidden from the focus tree.
 **Action:** For custom styled inputs like file pickers, never use `display: none`. Instead use absolute positioning with 0 dimensions and opacity, and apply focus styles to the parent wrapper using `:has(input:focus-visible)`. For `<span>` or `<div>` elements acting as buttons, always add `role="button"`, `tabindex="0"`, an appropriate `aria-label`, and ensure the keydown event listener handles both `Enter` and `Space` keys.
