## 2026-09-08 - Accessible Table Headers
**Learning:** Table headers (`<th>`) mapped with JavaScript click listeners for sorting are invisible to keyboard users by default, breaking keyboard accessibility.
**Action:** When adding sorting to table headers, always add `tabindex="0"`, `role="button"`, clear `:focus-visible` styles, and attach a `keydown` listener supporting `Enter` and `Space` keys to trigger the sorting logic.
## 2024-05-24 - Empty States with Filters
**Learning:** When building vanilla HTML/JS applications, empty states triggered by filters should provide a direct CTA to clear those filters, significantly reducing user frustration.
**Action:** When implementing filterable lists, always evaluate the empty state and consider adding a "Clear Filters" action directly within the empty state message.

## 2024-05-24 - Interactive pseudo-elements and keyboard focus
 **Learning:** In this vanilla JS setup, "fake" buttons like `.pill.fail` (for retrying failed API calls) or styled file inputs (`display: none` inner input) break keyboard accessibility since they aren't native interactive elements or are hidden from the focus tree.
 **Action:** For custom styled inputs like file pickers, never use `display: none`. Instead use absolute positioning with 0 dimensions and opacity, and apply focus styles to the parent wrapper using `:has(input:focus-visible)`. For `<span>` or `<div>` elements acting as buttons, always add `role="button"`, `tabindex="0"`, an appropriate `aria-label`, and ensure the keydown event listener handles both `Enter` and `Space` keys.

## 2024-05-19 - Filter input lacks accessible label
**Learning:** Found an accessibility anti-pattern where a form input field (`id="filter"`) relied only on a visual `placeholder` and lacked an explicit `<label>` or `aria-label`. The neighboring select inputs properly used `aria-label`.
**Action:** Always ensure that every input field, especially standard text inputs used for search or filtering, has either a linked `<label>` or an `aria-label` attribute to announce its purpose to screen readers.

## 2024-05-24 - Search Input UX for Filters
**Learning:** For simple text-based filter inputs, using `<input type="search">` instead of `type="text"` provides built-in browser features like a native clear ("x") button, instantly improving UX without additional JavaScript.
**Action:** Always prefer `type="search"` over `type="text"` for filter inputs. Ensure you add `aria-label` when a visible `<label>` is missing, and include `input[type=search]` in shared CSS selectors to maintain consistent styling.

## 2026-09-08 - Keyboard Shortcuts for Filtering
**Learning:** In data-heavy tools, power users frequently need to filter lists without taking their hands off the keyboard. A simple visual hint like `( / )` combined with a global shortcut makes the interface significantly more efficient.
**Action:** When implementing searchable data tables or lists, always consider adding a global `/` shortcut to focus the main filter input, and expose this shortcut directly in the input's placeholder to aid discovery.

## 2024-05-25 - Focus management with dynamically removed elements
**Learning:** In vanilla HTML/JS applications, when an element currently holding focus (like a "Clear filters" button in an empty state) is removed from the DOM, focus typically drops to the `body` element. This causes a confusing experience for keyboard and screen reader users, who lose their context in the page.
**Action:** Whenever a button click results in the button's own removal (such as clearing a list filter and dismissing the empty state), explicitly use `.focus()` to shift focus to the next logical interactive element (like the search/filter input itself) to maintain a continuous accessibility experience.

## 2024-05-27 - Focus Management for Custom Modals
**Learning:** When building custom modals in vanilla JS without UI frameworks, keyboard and screen reader users get a degraded experience if focus isn't managed explicitly. If focus stays on the page behind the modal, they might interact with obscured content. If a focused modal element is removed or hidden and focus drops to the `<body>`, context is completely lost.
**Action:** When a custom modal opens, explicitly move focus inside the modal (e.g., to its primary action or the wrapper itself via `setTimeout` to wait for paint). When a modal is dismissed (via overlay click, escape key, or cancel button), always return focus to the trigger element or the next logical step in the UI flow.
