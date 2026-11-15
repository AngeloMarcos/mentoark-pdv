# Architecture rules
- Keep authentication screens within the scoped `auth-surface` theme so access-page styling does not alter operational screens.
- Use the existing auth context for recovery requests and display translated failures without claiming inbox delivery.