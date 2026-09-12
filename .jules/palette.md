## 2024-05-19 - Filter input lacks accessible label
**Learning:** Found an accessibility anti-pattern where a form input field (`id="filter"`) relied only on a visual `placeholder` and lacked an explicit `<label>` or `aria-label`. The neighboring select inputs properly used `aria-label`.
**Action:** Always ensure that every input field, especially standard text inputs used for search or filtering, has either a linked `<label>` or an `aria-label` attribute to announce its purpose to screen readers.
