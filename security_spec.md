# Security Specification - Planner da Jângal

## Data Invariants
1. User configuration must only be accessible (read/write) by the owner (userId matches auth.uid).
2. Data must strictly follow the schema defined in the blueprint.
3. Timestamps (`updatedAt`) must be validated against `request.time`.
4. Document IDs must be valid (specifically the 'main' document).

## The Dirty Dozen Payloads

### 1. Identity Spoofing (Foreign Owner)
Attempt to write to user B's config as user A.
```json
{
  "path": "/users/user_B/config/main",
  "method": "set",
  "auth": { "uid": "user_A" },
  "data": { ... }
}
```
**Expected**: PERMISSION_DENIED

### 2. Schema Violation (Missing Required Field)
Missing `velhosLobos`.
```json
{
  "path": "/users/user_A/config/main",
  "method": "set",
  "auth": { "uid": "user_A" },
  "data": {
    "adjustmentTerms": [],
    "libraryData": [],
    "updatedAt": "server_timestamp"
  }
}
```
**Expected**: PERMISSION_DENIED

### 3. Type Poisoning (Invalid Type)
`velhosLobos` as string instead of array.
```json
{
  "path": "/users/user_A/config/main",
  "method": "set",
  "auth": { "uid": "user_A" },
  "data": {
    "velhosLobos": "Akelá",
    "adjustmentTerms": [],
    "libraryData": [],
    "updatedAt": "server_timestamp"
  }
}
```
**Expected**: PERMISSION_DENIED

### 4. Timestamp Fraud
Providing a client-side date instead of server timestamp.
```json
{
  "path": "/users/user_A/config/main",
  "method": "set",
  "auth": { "uid": "user_A" },
  "data": {
    "velhosLobos": [],
    "adjustmentTerms": [],
    "libraryData": [],
    "updatedAt": "2023-01-01T00:00:00Z"
  }
}
```
**Expected**: PERMISSION_DENIED

### 5. Ghost Field Injection
Adding unrequested field `isAdmin: true`.
```json
{
  "path": "/users/user_A/config/main",
  "method": "set",
  "auth": { "uid": "user_A" },
  "data": {
    "velhosLobos": [],
    "adjustmentTerms": [],
    "libraryData": [],
    "updatedAt": "server_timestamp",
    "isAdmin": true
  }
}
```
**Expected**: PERMISSION_DENIED

### 6. Path Poisoning
Attempting to create a document with an extremely long ID.
```json
{
  "path": "/users/user_A/config/very_long_poisonous_id_...",
  "method": "set",
  "auth": { "uid": "user_A" },
  "data": { ... }
}
```
**Expected**: PERMISSION_DENIED (Mainly because we only allow 'main')

### 7. Unauthenticated Read
Reading config without being logged in.
```json
{
  "path": "/users/user_A/config/main",
  "method": "get",
  "auth": null
}
```
**Expected**: PERMISSION_DENIED

### 8. PII Leakage (Self) - Not Applicable
(Users only see their own data)

### 9. Orphaned Configuration
Writing to a path that doesn't follow the `/users/{userId}/config/main` structure.
```json
{
  "path": "/global/config",
  "method": "set",
  "auth": { "uid": "user_A" },
  "data": { ... }
}
```
**Expected**: PERMISSION_DENIED

### 10. Massive Array Injection
Injecting an array with 10,000 items to cause resource exhaustion.
```json
{
  "path": "/users/user_A/config/main",
  "method": "set",
  "auth": { "uid": "user_A" },
  "data": {
    "velhosLobos": ["massive_data_..."],
    "adjustmentTerms": [],
    "libraryData": [],
    "updatedAt": "server_timestamp"
  }
}
```
**Expected**: PERMISSION_DENIED (via size limits)

### 11. Malformed Library Item
Missing `name` in library items.
```json
{
  "path": "/users/user_A/config/main",
  "method": "set",
  "auth": { "uid": "user_A" },
  "data": {
    "velhosLobos": [],
    "adjustmentTerms": [],
    "libraryData": [{"category": "Geral", "items": [{}]}],
    "updatedAt": "server_timestamp"
  }
}
```
**Expected**: PERMISSION_DENIED

### 12. Cross-User List Query
Attempting to list all user configs.
```json
{
  "path": "/users/user_B/config",
  "method": "list",
  "auth": { "uid": "user_A" }
}
```
**Expected**: PERMISSION_DENIED
