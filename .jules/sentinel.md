## 2025-02-28 - CSV Injection Mitigation in Client-Side Export
**Vulnerability:** The client-side `exportCSV()` function lacked sanitization for cells starting with `=`, `+`, `-`, or `@`. An attacker could name a GitHub repository maliciously (e.g. `=cmd|' /C calc'!A0`) which, when exported and opened in Excel, could result in formula execution.
**Learning:** Even client-side export functions with data from external APIs (like GitHub repository details) need protection against CSV Injection, as the exported file is typically consumed by spreadsheet software with auto-execution enabled.
**Prevention:** Always check if a CSV value begins with a formula prefix (`=`, `+`, `-`, `@`) and prepend a single quote (`'`) to force the spreadsheet to interpret the value as plain text.
