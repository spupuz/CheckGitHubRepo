## 2024-05-14 - Insecure Deserialization in localStorage
 **Vulnerability:** Dictionaries loaded from `localStorage` using `JSON.parse` inherited `Object.prototype`, reopening prototype pollution vectors, despite being previously initialized with `Object.create(null)`.
 **Learning:** `JSON.parse` implicitly attaches `Object.prototype` to deserialized objects, undoing prototype pollution mitigations.
 **Prevention:** Always wrap `JSON.parse` results for sensitive dictionaries with `Object.assign(Object.create(null), parsedData)` to ensure they do not inherit potentially dangerous native properties.
