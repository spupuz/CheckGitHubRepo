## 2024-11-20 - Multi-filter Chaining in DOM Search
**Learning:** In a vanilla HTML UI with frequent DOM updates (like a search bar), chained `.filter()` calls on potentially large lists (e.g. GitHub repos) create multiple intermediate arrays and O(k*n) passes. Here, `applyFilters` was running up to 5 passes over the data.
**Action:** When filtering data based on multiple criteria in client-side JS, collapse them into a single `.filter()` loop with early returns. This turns O(5n) with 4 extra array allocations into a strict O(n) pass with minimal memory overhead.

## 2024-11-20 - Set Allocation in Render Loops
**Learning:** Checking if an array contains diverse values using `new Set(arr.map(x => x.prop)).size > 1` creates a new mapped array AND a new Set on every execution. In frequent render loops, this causes unnecessary garbage collection pressure and takes O(n) time and O(n) memory.
**Action:** When determining if a collection has multiple distinct values for a specific property, use an early-return approach like `.some(x => x.prop !== arr[0].prop)`. This drops memory overhead to O(1) and time complexity to best-case O(1) (returns true on the first mismatch).

## 2024-11-20 - Missing IndexedDB/SQLite Indexes on Frequently Queried Fields
**Learning:** In the SQLite history chart queries (`SELECT s.timestamp, r.open_prs FROM repos r JOIN scans s ON r.scan_id=s.id WHERE r.full_name=? ORDER BY s.id ASC`), searching by `full_name` without an index causes O(n) full table scans over potentially thousands of repositories. Similarly for `timestamp` on the `scans` table.
**Action:** When working with client-side databases (like sql.js), always verify that `JOIN` conditions and frequently used `WHERE` clauses (like `full_name` or `timestamp`) are supported by explicit `CREATE INDEX` statements to reduce query time from O(n) to O(log n).

## 2026-09-12 - Lexicographical Date Sorting Optimization
**Learning:** When sorting collections by ISO-8601 date strings, using `Date.parse()` in the sort comparator introduces unnecessary O(N log N) overhead (converting strings to timestamps continuously during the sort passes). Since ISO-8601 strings sort perfectly alphabetically (lexicographically), they can be compared directly as strings.
**Action:** When sorting ISO-8601 strings, use direct string comparison instead of parsing. Handle null/missing dates via short-circuit evaluations (e.g. `|| 'z'` for Infinity or `|| ''` for 0) to maintain O(N log N) time but drastically reduce the constant factor by avoiding timestamp conversion.
