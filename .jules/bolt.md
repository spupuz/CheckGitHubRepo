## 2024-11-20 - Multi-filter Chaining in DOM Search
**Learning:** In a vanilla HTML UI with frequent DOM updates (like a search bar), chained `.filter()` calls on potentially large lists (e.g. GitHub repos) create multiple intermediate arrays and O(k*n) passes. Here, `applyFilters` was running up to 5 passes over the data.
**Action:** When filtering data based on multiple criteria in client-side JS, collapse them into a single `.filter()` loop with early returns. This turns O(5n) with 4 extra array allocations into a strict O(n) pass with minimal memory overhead.
