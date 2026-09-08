## 2026-09-08 - Accessible Table Headers
**Learning:** Table headers (`<th>`) mapped with JavaScript click listeners for sorting are invisible to keyboard users by default, breaking keyboard accessibility.
**Action:** When adding sorting to table headers, always add `tabindex="0"`, `role="button"`, clear `:focus-visible` styles, and attach a `keydown` listener supporting `Enter` and `Space` keys to trigger the sorting logic.
