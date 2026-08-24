---
name: API codegen Zod compatibility
description: OpenAPI integer schemas may generate unsupported zod.int calls in this workspace's Zod runtime.
---

When adding OpenAPI contracts, prefer numeric schemas with explicit application-level integer semantics unless the generated Zod output is confirmed compatible with the installed Zod version.

**Why:** The current generated validator runtime is Zod 3 while the generator can emit the newer zod.int helper, causing library typecheck failures after otherwise successful codegen.

**How to apply:** After changing OpenAPI numeric fields, run codegen and the library typecheck before implementing routes; if zod.int appears, adjust the contract rather than hand-editing generated files.