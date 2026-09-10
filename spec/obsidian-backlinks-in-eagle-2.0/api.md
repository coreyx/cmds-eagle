# REST API Reference: Eagle Extra Links IPC

This document is the complete, standalone REST API reference for the **Eagle Extra Links** embedded IPC server.

---

## 1. Overview & Connection Information

### 1.1 Base URL & Default Binding
The embedded IPC server runs directly within the Eagle Extra Links plugin process:
- **Default Base URL**: `http://127.0.0.1:41598`
- **Configurable Host**: Defaults to `127.0.0.1` (loopback). Can be configured to `0.0.0.0` or a specific LAN IP in settings to accept connections from other devices on your local network.
- **Configurable Port**: Defaults to `41598`. Configurable in settings (`1024–65535`).
- **Feature Toggle**: Can be enabled or disabled completely via the plugin's settings interface (`⚙️`).

### 1.2 Access Control & Security
When **Restrict Client Access** is enabled in the plugin settings:
- Every incoming HTTP request is validated against the configured `allowedClients` whitelist.
- Whitelist rules support:
  - `'self'`: Matches loopback addresses (`127.0.0.1`, `::1`, `localhost`, `::ffff:127.0.0.1`).
  - **Exact IP**: (e.g., `192.168.1.50`).
  - **Subnet Wildcards**: (e.g., `192.168.1.x` or `192.168.1.*` matching `192.168.1.0/24`).
  - **Hostnames**: Matched against reverse DNS.
- If a client connection fails the whitelist check, the server immediately returns **HTTP 403 Forbidden** before route parsing:
  ```json
  {
    "status": "error",
    "message": "Forbidden: Client IP 192.168.1.120 is not authorized."
  }
  ```

### 1.3 CORS (Cross-Origin Resource Sharing)
All responses automatically include CORS headers to support calls from Electron webviews, Obsidian plugins, or browser-based tools:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

Preflight `OPTIONS` requests receive an immediate **HTTP 204 No Content**.

---

## 2. Endpoints

### 2.1 Health Check

Verifies that the Eagle Extra Links IPC server is active, returns runtime version, and reports the active Eagle library path.

- **Method**: `GET`
- **Path**: `/health`
- **Headers**: None required

#### Success Response
- **Status Code**: `200 OK`
- **Content-Type**: `application/json; charset=utf-8`
- **Payload**:
  ```json
  {
    "status": "ok",
    "version": "1.0.0",
    "host": "127.0.0.1",
    "port": 41598,
    "library": "I:\\My Drive\\Eagle\\Main.library"
  }
  ```

#### Error Responses
- `403 Forbidden`: Client IP address is blocked by access control rules.

#### Examples
**cURL**:
```bash
curl -s http://127.0.0.1:41598/health
```

**JavaScript / Obsidian**:
```javascript
const res = await requestUrl({ url: 'http://127.0.0.1:41598/health' });
console.log(res.json);
```

---

### 2.2 Get Item Extra Links

Retrieves the list of extra URLs/URIs associated with a specific Eagle content item.

- **Method**: `GET`
- **Path**: `/api/item/:id/links`
- **Path Parameters**:
  - `id` *(string, required)*: The unique Eagle Item ID (e.g., `MTSPUNN17LBUG`).
- **Headers**: None required

#### Success Response
- **Status Code**: `200 OK`
- **Content-Type**: `application/json; charset=utf-8`
- **Payload**:
  ```json
  {
    "status": "success",
    "itemId": "MTSPUNN17LBUG",
    "links": [
      "https://example.com/source",
      "obsidian://adv-uri?vault=Main&filepath=Notes%2FArt.md"
    ]
  }
  ```
  *(Note: If no links are stored, `links` returns an empty array `[]`).*

#### Error Responses
- `404 Not Found`: Item directory `<itemId>.info` does not exist in the active Eagle library.
  ```json
  {
    "status": "error",
    "message": "Item directory not found for ID: NONEXISTENT_ID"
  }
  ```
- `403 Forbidden`: Client IP not authorized.

#### Examples
**cURL**:
```bash
curl -s http://127.0.0.1:41598/api/item/MTSPUNN17LBUG/links
```

**JavaScript / Obsidian**:
```javascript
const res = await requestUrl({
    url: 'http://127.0.0.1:41598/api/item/MTSPUNN17LBUG/links',
    method: 'GET'
});
console.log(res.json.links);
```

---

### 2.3 Append Extra Link(s)

Appends one or more URLs/URIs to the specified Eagle item. If the item is currently open in Eagle's Inspector, the UI updates instantly in real time.

**Idempotent Deduplication**: By default, the endpoint automatically checks for existing links on the item (comparing trimmed strings). If the requested URL is already present, it is not duplicated, no disk write occurs, and the endpoint returns `200 OK` with `addedCount: 0` and `alreadyExists: true`. External tools (such as Obsidian) can safely send requests repeatedly without duplicate link pollution.

- **Method**: `POST`
- **Path**: `/api/item/:id/links`
- **Path Parameters**:
  - `id` *(string, required)*: The unique Eagle Item ID.
- **Headers**:
  - `Content-Type: application/json`

#### Request Body
Accepts either a single URL or an array of URLs, with an optional `allowDuplicates` boolean:

**Single URL (Default Deduplication)**:
```json
{
  "url": "obsidian://adv-uri?vault=Main&filepath=Design%2FInspiration.md",
  "allowDuplicates": false
}
```

**Batch URLs**:
```json
{
  "urls": [
    "https://artstation.com/artwork/ref",
    "obsidian://adv-uri?vault=Main&filepath=Design%2FInspiration.md"
  ],
  "allowDuplicates": false
}
```

#### Success Response
- **Status Code**: `200 OK`
- **Content-Type**: `application/json; charset=utf-8`

**When New Link Is Added**:
```json
{
  "status": "success",
  "itemId": "MTSPUNN17LBUG",
  "links": [
    "https://example.com/source",
    "obsidian://adv-uri?vault=Main&filepath=Design%2FInspiration.md"
  ],
  "addedCount": 1,
  "alreadyExists": false
}
```

**When Duplicate Link Is Detected & Skipped**:
```json
{
  "status": "success",
  "itemId": "MTSPUNN17LBUG",
  "links": [
    "https://example.com/source",
    "obsidian://adv-uri?vault=Main&filepath=Design%2FInspiration.md"
  ],
  "addedCount": 0,
  "alreadyExists": true
}
```

#### Error Responses
- `400 Bad Request`: Missing `"url"` or `"urls"` property in request body.
  ```json
  {
    "status": "error",
    "message": "Missing \"url\" or \"urls\" in request body."
  }
  ```
- `404 Not Found`: Item directory not found.
- `403 Forbidden`: Client IP not authorized.

#### Examples
**cURL**:
```bash
curl -X POST http://127.0.0.1:41598/api/item/MTSPUNN17LBUG/links \
     -H "Content-Type: application/json" \
     -d "{\"url\":\"obsidian://adv-uri?vault=Main&filepath=Design%2FInspiration.md\"}"
```

**JavaScript / Obsidian**:
```javascript
const res = await requestUrl({
    url: 'http://127.0.0.1:41598/api/item/MTSPUNN17LBUG/links',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        url: 'obsidian://adv-uri?vault=Main&filepath=Design%2FInspiration.md'
    })
});
console.log(`Added: ${res.json.addedCount}, Already Existed: ${res.json.alreadyExists}`);
```


---

### 2.4 Replace All Extra Links

Replaces the entire list of extra links for an item with a new array.

- **Method**: `PUT`
- **Path**: `/api/item/:id/links`
- **Path Parameters**:
  - `id` *(string, required)*: The unique Eagle Item ID.
- **Headers**:
  - `Content-Type: application/json`

#### Request Body
```json
{
  "links": [
    "https://artstation.com/artwork/1",
    "https://pinterest.com/pin/2",
    "obsidian://adv-uri?vault=Main&filepath=Project.md"
  ]
}
```

#### Success Response
- **Status Code**: `200 OK`
- **Content-Type**: `application/json; charset=utf-8`
- **Payload**:
  ```json
  {
    "status": "success",
    "itemId": "MTSPUNN17LBUG",
    "links": [
      "https://artstation.com/artwork/1",
      "https://pinterest.com/pin/2",
      "obsidian://adv-uri?vault=Main&filepath=Project.md"
    ]
  }
  ```

#### Error Responses
- `400 Bad Request`: Missing or invalid `"links"` array in body.
- `404 Not Found`: Item directory not found.
- `403 Forbidden`: Client IP not authorized.

#### Examples
**cURL**:
```bash
curl -X PUT http://127.0.0.1:41598/api/item/MTSPUNN17LBUG/links \
     -H "Content-Type: application/json" \
     -d "{\"links\":[\"https://example.com\",\"obsidian://adv-uri?vault=Main\"]}"
```

---

### 2.5 Delete Extra Link(s)

Deletes a specific link by index, by exact URL match, or clears all extra links.

- **Method**: `DELETE`
- **Path**: `/api/item/:id/links`
- **Path Parameters**:
  - `id` *(string, required)*: The unique Eagle Item ID.
- **Headers**:
  - `Content-Type: application/json` *(optional if clearing all)*

#### Request Body Options

**Option A: Delete by Index (0-based)**:
```json
{
  "index": 1
}
```

**Option B: Delete by Matching URL**:
```json
{
  "url": "https://example.com/source"
}
```

**Option C: Clear All Links**:
Empty body `{}` or empty request clears all extra links.

#### Success Response
- **Status Code**: `200 OK`
- **Content-Type**: `application/json; charset=utf-8`
- **Payload**:
  ```json
  {
    "status": "success",
    "itemId": "MTSPUNN17LBUG",
    "links": [
      "obsidian://adv-uri?vault=Main&filepath=RemainingNote.md"
    ]
  }
  ```

#### Error Responses
- `404 Not Found`: Item directory not found.
- `403 Forbidden`: Client IP not authorized.

#### Examples
**cURL**:
```bash
# Delete row at index 0:
curl -X DELETE http://127.0.0.1:41598/api/item/MTSPUNN17LBUG/links \
     -H "Content-Type: application/json" \
     -d "{\"index\": 0}"
```

---

## 3. Real-Time UI Synchronization

When any modifying endpoint (`POST`, `PUT`, `DELETE`) is called:
1. The server updates `extra-links.json` atomically on disk.
2. The server broadcasts an in-memory event `(itemId, links)`.
3. If the user in Eagle currently has `:itemId` selected and visible in the Inspector:
   - The plugin UI updates the input fields immediately without requiring the user to switch items or reload.
   - The status badge transitions to `Saved`.

---

## 4. Summary Table of HTTP Status Codes

| Code | Status | Meaning |
| :--- | :--- | :--- |
| `200` | OK | Request succeeded; returned requested data or updated state. |
| `204` | No Content | CORS preflight (`OPTIONS`) succeeded. |
| `400` | Bad Request | Missing or malformed JSON body. |
| `403` | Forbidden | Access denied by IP whitelist restriction. |
| `404` | Not Found | Item directory or endpoint does not exist. |
| `405` | Method Not Allowed | Method is not supported on this endpoint. |
| `500` | Internal Error | Unhandled disk I/O or server exception. |
