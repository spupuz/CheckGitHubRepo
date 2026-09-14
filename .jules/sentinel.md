## 2025-02-28 - CSV Injection Mitigation in Client-Side Export
**Vulnerability:** The client-side `exportCSV()` function lacked sanitization for cells starting with `=`, `+`, `-`, or `@`. An attacker could name a GitHub repository maliciously (e.g. `=cmd|' /C calc'!A0`) which, when exported and opened in Excel, could result in formula execution.
**Learning:** Even client-side export functions with data from external APIs (like GitHub repository details) need protection against CSV Injection, as the exported file is typically consumed by spreadsheet software with auto-execution enabled.
**Prevention:** Always check if a CSV value begins with a formula prefix (`=`, `+`, `-`, `@`) and prepend a single quote (`'`) to force the spreadsheet to interpret the value as plain text.
## 2026-09-10 - Secure External Subresources & CSP Enhancement
**Vulnerability:** External CDNs for `echarts` and `sql.js` lacked Subresource Integrity (SRI) validation, and the application lacked a Content Security Policy (CSP), leaving it vulnerable to supply-chain attacks and reducing defense-in-depth against XSS.
**Learning:** Even static HTML applications without build pipelines should implement CSP and SRI to prevent third-party script compromise and mitigate potential client-side injection vulnerabilities. Version pinning (e.g. `echarts@5` -> `echarts@5.6.0`) is required for stable SRI hashes.
**Prevention:** Always pin external dependency versions in script tags, generate and include SRI hashes (`integrity` attribute), and define a restrictive CSP meta tag.

## 2024-05-27 - Strict CSP for script-src
**Vulnerability:** The application's Content Security Policy allowed `'unsafe-inline'` in the `script-src` directive, which could be exploited for Cross-Site Scripting (XSS) if unescaped user input were injected into the DOM.
**Learning:** The inline `<script>` tags for the init logic required the use of `'unsafe-inline'`. This created a less secure application by allowing any injected script to run.
**Prevention:** Externalize all inline scripts to `.js` files and completely remove `'unsafe-inline'` from `script-src` in the Content Security Policy to enforce a strict boundary against XSS.
