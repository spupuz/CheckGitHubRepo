## 2026-09-08 - Accessible Table Headers
**Learning:** Table headers (`<th>`) mapped with JavaScript click listeners for sorting are invisible to keyboard users by default, breaking keyboard accessibility.
**Action:** When adding sorting to table headers, always add `tabindex="0"`, `role="button"`, clear `:focus-visible` styles, and attach a `keydown` listener supporting `Enter` and `Space` keys to trigger the sorting logic.
## 2024-05-24 - Empty States with Filters
**Learning:** When building vanilla HTML/JS applications, empty states triggered by filters should provide a direct CTA to clear those filters, significantly reducing user frustration.
**Action:** When implementing filterable lists, always evaluate the empty state and consider adding a "Clear Filters" action directly within the empty state message.
