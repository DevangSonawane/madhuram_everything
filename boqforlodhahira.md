You are working on a React (Vite + shadcn/ui + Tailwind) frontend codebase. The task is purely frontend — no backend or API changes. All files are in `src/`.

---

## CONTEXT

The app is a construction project management tool for **Madhuram Enterprises**. There are two BOQ (Bill of Quantities) client formats:

1. **Lodha** — uses fields: `item_description`, `hsn`, `unit`, `qty`, `rate`, `amount`
2. **Hiranandani** — uses fields: `service_description`, `order_qty`, `uom`, `unit_price`, `value`

The current flow:
- `src/pages/BOQList.jsx` — shows the list of BOQs. Clicking "Add BOQ" opens a dialog to select Lodha or Hiranandani format, then navigates to `/${projectId}/boq/manage?client=lodha` or `?client=hiranandani`.
- `src/pages/BOQ.jsx` — the manage page. It reads `activeClient` from `searchParams.get("client")`. Currently `createBOQ` always calls `POST /api/boq` (the generic endpoint). It needs to call the correct client-specific endpoint instead.

The two new endpoints:
- `POST /api/boq/lodha` — for Lodha items
- `POST /api/boq/hiranandani` — for Hiranandani items

---

## TASK 1 — Add two new API methods in `src/lib/api.js`

Find the existing `createBOQ` function. Add two new methods directly after it:

```js
createBOQLodha: async (data) => {
  const formData = new FormData();
  formData.append('project_id', data.project_id);
  formData.append('item_description', data.item_description || data.description || '');
  if (data.hsn != null && data.hsn !== '') formData.append('hsn', data.hsn);
  if (data.unit != null && data.unit !== '') formData.append('unit', data.unit);
  if (data.qty != null && data.qty !== '') formData.append('qty', String(data.qty));
  if (data.rate != null && data.rate !== '') formData.append('rate', String(data.rate));
  if (data.amount != null && data.amount !== '') formData.append('amount', String(data.amount));
  if (data.project_name) formData.append('project_name', data.project_name);
  if (data.category) formData.append('category', data.category);
  if (data.floor) formData.append('floor', data.floor);
  if (data.boq_file instanceof File) formData.append('boq_file', data.boq_file);
  const response = await fetch(`${BASE_URL}/api/boq/lodha`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  return handleResponse(response);
},

createBOQHiranandani: async (data) => {
  const formData = new FormData();
  formData.append('project_id', data.project_id);
  formData.append('service_description', data.service_description || data.description || '');
  if (data.order_qty != null && data.order_qty !== '') formData.append('order_qty', String(data.order_qty));
  if (data.uom != null && data.uom !== '') formData.append('uom', data.uom);
  if (data.unit_price != null && data.unit_price !== '') formData.append('unit_price', String(data.unit_price));
  if (data.value != null && data.value !== '') formData.append('value', String(data.value));
  if (data.project_name) formData.append('project_name', data.project_name);
  if (data.category) formData.append('category', data.category);
  if (data.floor) formData.append('floor', data.floor);
  if (data.boq_file instanceof File) formData.append('boq_file', data.boq_file);
  const response = await fetch(`${BASE_URL}/api/boq/hiranandani`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  return handleResponse(response);
},
```

---

## TASK 2 — Create `src/lib/boqParser.js` (new file)

This is the most important task. The Lodha and Hiranandani PDFs have complex multi-level section structures. You must parse them correctly.

**Lodha PDF structure** (from `6100023325_-_Amendment_WORK_ORDER.pdf`):
- Top-level sections like `1 SITC of Fire Fighting work at ANJUR CASA`
- Sub-sections like `1.01 FIRE FIGHTING PUMP INSTALLATIONS`, `1.02 FIRE FIGHTING SPRINKLER & HOSE REEL SYSTEM`
- Line items like `1.01.1`, `1.01.2`, `1.01.10`, `1.02.1`, etc. with: description (possibly multi-line), HSN code (6-digit number like `995468`), unit (SET, NOS, RMT, M), qty (decimal), rate, amount
- Extra items at the top level like `2`, `2.1`, `2.2`, `2.3`
- The table columns are: SR.No. | ITEM DESCRIPTION | HSN/SAC Code | UNIT | QTY | RATE | AMOUNT

**Hiranandani PDF structure** (from `Madhuram_Ent__4700156670__Empress_Hill_-_D_Wing_.pdf`):
- Top-level service groups like `1 Plumbing- Sanitary fixtures - D wing`, `2 Plumbing- Cold & hot water supply - D wing`, etc.
- Each group has a lump-sum AU line (e.g. `1 AU 2,498,571.25`)
- Line items numbered `(1)`, `(2)`, ... `(551)` with: Sac code, description, Order Qty, UOM (NOS/M/AU), Unit Price, Value
- Each item also has CGST/SGST sub-lines which should be IGNORED (they are tax rows, not items)
- Format: `(N) Sac : 995462 - [description] [qty] [UOM] [unit_price] [value]`

Create `src/lib/boqParser.js` with these exports:

```js
/**
 * Parse a Lodha BOQ PDF text into structured items.
 * @param {string} rawText - raw text extracted from PDF
 * @returns {{ items: LodhaItem[], sections: string[] }}
 *
 * LodhaItem: {
 *   item_no: string,        // e.g. "1.01.1"
 *   section: string,        // e.g. "FIRE FIGHTING PUMP INSTALLATIONS"
 *   description: string,    // full item description
 *   hsn: string,            // HSN/SAC code e.g. "995468"
 *   unit: string,           // SET, NOS, RMT, M
 *   qty: number,
 *   rate: number,
 *   amount: number,
 * }
 */
export function parseLodhaBoq(rawText) { ... }

/**
 * Parse a Hiranandani BOQ PDF text into structured items.
 * @param {string} rawText - raw text extracted from PDF
 * @returns {{ items: HiranandaniItem[], sections: string[] }}
 *
 * HiranandaniItem: {
 *   item_no: string,         // e.g. "(1)", "(22)"
 *   section: string,         // e.g. "Plumbing- Sanitary fixtures - D wing"
 *   sac_code: string,        // e.g. "995462"
 *   service_description: string,
 *   order_qty: number,
 *   uom: string,             // NOS, M, AU
 *   unit_price: number,
 *   value: number,
 * }
 */
export function parseHiranandaniBoq(rawText) { ... }
```

**Parsing rules for Lodha:**
- Detect section headers: lines matching `/^\d+\.\d+\s+[A-Z]/` (e.g. `1.01 FIRE FIGHTING PUMP`) → update current section
- Detect items: lines starting with `\d+\.\d+\.\d+` (e.g. `1.01.1`, `1.02.10`) or top-level extras like `2.1`, `2.2`
- Description may span multiple lines until the HSN code appears (a standalone 6-digit number like `995468`)
- After the HSN, parse: UNIT (word), QTY (decimal), RATE (decimal with comma), AMOUNT (decimal with comma)
- Strip commas from numbers: `"186,000.00"` → `186000`
- Skip header rows, page footers ("COMPANY N CONTRACTOR"), summary rows ("TOTAL OF AMOUNT", "CONTRACT AMOUNT")

**Parsing rules for Hiranandani:**
- Detect section headers: lines like `1 Plumbing- Sanitary fixtures - D wing` at the top level
- Detect items: lines starting with `(N)` where N is a number, e.g. `(1)`, `(22)`, `(551)`
- Parse SAC code from `Sac : 995462 -` pattern
- Skip CGST/SGST sub-lines (lines containing "CGST" or "SGST")
- Skip AU lump-sum header lines (lines matching `\d+ AU [\d,]+`)
- Strip commas from numbers

---

## TASK 3 — Rewrite `src/pages/BOQ.jsx` — client-aware PDF parsing

The current `BOQ.jsx` sends the PDF to `POST /api/boq/parse-pdf` on the server. We need to **also parse the PDF client-side** (in the browser) using `pdfjs-dist` so we can show the preview without a server round-trip, then call the correct client endpoint when saving.

### 3a — Add client-side PDF text extraction

At the top of `BOQ.jsx`, add:

```js
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
```

Add a helper function inside the component (or as a module-level util):

```js
async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
}
```

### 3b — Update `runExtract` to use client-side parsing

Replace the current `runExtract` function which makes a server call (`api.parseBoqPdf`) with a client-side version:

```js
const runExtract = async (file) => {
  setExtractError(null);
  setExtracting(true);
  try {
    const rawText = await extractTextFromPdf(file);
    let parsed;
    if (activeClient === 'lodha') {
      const { parseLodhaBoq } = await import('@/lib/boqParser');
      parsed = parseLodhaBoq(rawText);
      const mapped = parsed.items.map((it, idx) => ({
        id: idx + 1 + Date.now(),
        category: it.section || 'General',
        code: it.item_no || '',
        item_code: it.item_no || '',
        description: it.description || '',
        unit: it.unit || '',
        quantity: it.qty ? String(it.qty) : '',
        rate: it.rate ? String(it.rate) : '',
        amount: it.amount ? String(it.amount) : '',
        floor: '',
        hsn: it.hsn || '',
      }));
      setExtractedItems(mapped);
    } else if (activeClient === 'hiranandani') {
      const { parseHiranandaniBoq } = await import('@/lib/boqParser');
      parsed = parseHiranandaniBoq(rawText);
      const mapped = parsed.items.map((it, idx) => ({
        id: idx + 1 + Date.now(),
        category: it.section || 'General',
        code: it.item_no || '',
        item_code: it.item_no || '',
        description: it.service_description || '',
        unit: it.uom || '',
        quantity: it.order_qty ? String(it.order_qty) : '',
        rate: it.unit_price ? String(it.unit_price) : '',
        amount: it.value ? String(it.value) : '',
        floor: '',
        sac_code: it.sac_code || '',
      }));
      setExtractedItems(mapped);
    } else {
      // fallback to server-side for unknown clients
      const res = await api.parseBoqPdf({ boq_file: file, project_id: projectId || '', save: false });
      if (res.success && res.data && Array.isArray(res.data.items)) {
        const mapped = res.data.items.map((it, idx) => ({
          id: idx + 1 + Date.now(),
          category: it.section || 'General',
          code: it.item_no || '',
          item_code: it.item_no || '',
          description: it.description || '',
          unit: it.unit || '',
          quantity: it.qty ? String(it.qty) : '',
          rate: '',
          amount: '',
          floor: '',
        }));
        setExtractedItems(mapped);
      } else {
        throw new Error(res.error || 'Failed to parse BOQ PDF from server.');
      }
    }
    setExtractedProjectName('');
    setImportPreviewOpen(true);
  } catch (err) {
    console.error(err);
    setExtractError(err?.message || 'Could not read BOQ PDF.');
    toast({
      title: 'BOQ extraction failed',
      description: "We couldn't parse this PDF. You can still add items manually.",
      variant: 'destructive',
    });
  } finally {
    setExtracting(false);
  }
};
```

### 3c — Update `addExtractedToBOQ` to call the correct endpoint

Replace the current `addExtractedToBOQ` function. When saving, call the correct client-specific API per item:

```js
const addExtractedToBOQ = async () => {
  if (!projectId) {
    // offline mode — just merge into local state
    const maxId = items.length ? Math.max(...items.map((i) => i.id)) : 0;
    const withIds = extractedItems.map((it, i) => ({ ...it, id: maxId + i + 1 }));
    setItems((prev) => [...prev, ...withIds]);
    setImportPreviewOpen(false);
    setBoqFile(null);
    if (boqInputRef.current) boqInputRef.current.value = '';
    toast({ title: 'Added to BOQ', description: `${withIds.length} item(s) added. Select a project to save to server.` });
    return;
  }
  setSaving(true);
  try {
    const saveItem = buildSaveItemFn(activeClient, projectId, boqFile);
    for (const item of extractedItems) {
      await saveItem(item);
    }
    await fetchItems();
    setSearchTerm('');
    setCurrentPage(1);
    setImportPreviewOpen(false);
    setBoqFile(null);
    if (boqInputRef.current) boqInputRef.current.value = '';
    toast({ title: 'BOQ saved', description: 'BOQ imported successfully.' });
  } catch (e) {
    toast({ title: 'Error', description: e?.message || 'Failed to save BOQ.', variant: 'destructive' });
  } finally {
    setSaving(false);
  }
};
```

Add this helper function at the module level (outside the component, near the top of BOQ.jsx):

```js
function buildSaveItemFn(client, projectId, boqFile) {
  return async (item) => {
    if (client === 'lodha') {
      return api.createBOQLodha({
        project_id: projectId,
        item_description: item.description,
        hsn: item.hsn || item.item_code || '',
        unit: item.unit,
        qty: item.quantity,
        rate: item.rate,
        amount: item.amount,
        category: item.category,
        floor: item.floor,
        boq_file: boqFile instanceof File ? boqFile : undefined,
      });
    } else if (client === 'hiranandani') {
      return api.createBOQHiranandani({
        project_id: projectId,
        service_description: item.description,
        order_qty: item.quantity,
        uom: item.unit,
        unit_price: item.rate,
        value: item.amount,
        category: item.category,
        floor: item.floor,
        boq_file: boqFile instanceof File ? boqFile : undefined,
      });
    } else {
      return api.createBOQ({
        ...item,
        project_id: projectId,
        boq_file: boqFile instanceof File ? boqFile : undefined,
      });
    }
  };
}
```

### 3d — Update `handleAddItem` to call correct endpoint

In the existing `handleAddItem` function, replace:
```js
const res = await api.createBOQ(payload);
```
with:
```js
let res;
if (activeClient === 'lodha') {
  res = await api.createBOQLodha({
    ...payload,
    item_description: payload.description,
    hsn: payload.item_code || '',
    qty: payload.quantity,
  });
} else if (activeClient === 'hiranandani') {
  res = await api.createBOQHiranandani({
    ...payload,
    service_description: payload.description,
    order_qty: payload.quantity,
    uom: payload.unit,
    unit_price: payload.rate,
    value: payload.amount,
  });
} else {
  res = await api.createBOQ(payload);
}
```

### 3e — Update the import preview table to show client-specific columns

In the `importPreviewOpen` Dialog's Table, show different columns depending on `activeClient`:

- **Lodha columns:** Section | Item No | Description | HSN | Unit | Qty | Rate | Amount
- **Hiranandani columns:** Section | Item No | Description | SAC Code | UOM | Order Qty | Unit Price | Value
- **Default columns (unchanged):** Section | Code | Description | Unit | Quantity

### 3f — Show the client format label in the page header

At the top of the BOQ manage page, if `activeClient` is set, display a badge next to the page title. E.g.:
- Title: `BOQ — Lodha Format` (blue badge) or `BOQ — Hiranandani Format` (purple badge)
- If no client, just show `BOQ`

### 3g — Add a "Add Item" form that adapts to the client format

When `activeClient === 'lodha'`, the "Add BOQ Item" dialog should show:
- Item Description (required)
- HSN/SAC Code
- Unit, Qty, Rate, Amount (as currently)
- Section (category)

When `activeClient === 'hiranandani'`, the dialog should show:
- Service Description (required)
- SAC Code
- UOM, Order Qty, Unit Price, Value
- Section (category)

When no client, keep the existing generic form unchanged.

---

## TASK 4 — Update the preview table to show better section grouping

In the `importPreviewOpen` Dialog, group the extracted items by their `category`/section. Show the section name as a full-width row header with a light background before each group of items. This makes it easy to visually verify the multi-level structure was parsed correctly.

---

## TASK 5 — Handle the `replaceBOQWithExtracted` function

Apply the same client-aware endpoint logic to `replaceBOQWithExtracted`. It currently:
1. Deletes all scoped items
2. Calls `api.parseBoqPdf` with `save: true`

Change step 2 to instead loop over `extractedItems` and call `buildSaveItemFn` for each, exactly like `addExtractedToBOQ`.

---

## IMPORTANT CONSTRAINTS

1. **Do not change any backend files.** Only modify files inside `src/`.
2. **Do not change `src/pages/BOQList.jsx`** — it already has the correct format selection dialog and navigation logic.
3. **Do not remove any existing functionality** — the generic fallback (no client) must still work.
4. **pdfjs-dist is already in package.json** — do not add it again. If it is not, add `"pdfjs-dist": "^4.0.0"` to dependencies.
5. **All shadcn/ui components already exist** — use `Badge`, `Table`, `Dialog`, `Button`, `Input`, `Label`, `Select` as imported in the existing file.
6. **The `activeClient` variable** is already read from `searchParams.get("client")` in `BOQ.jsx`. Use it everywhere. It will be `"lodha"`, `"hiranandani"`, or `""`.
7. **Number formatting** — always strip commas before `parseFloat`. E.g. `parseFloat("1,86,000.00".replace(/,/g, ''))` → `186000`.
8. **The boqFile** — the PDF file object is stored in `boqFile` state. Pass it on the first item only (or on all items — the backend will deduplicate). Do not send the file on subsequent items if the endpoint doesn't support it.

---

## FILES TO MODIFY

1. `src/lib/api.js` — add `createBOQLodha` and `createBOQHiranandani`
2. `src/lib/boqParser.js` — **new file**, create parsers for both formats
3. `src/pages/BOQ.jsx` — update `runExtract`, `addExtractedToBOQ`, `replaceBOQWithExtracted`, `handleAddItem`, the preview table, the add-item dialog, and the page title badge

---

## VERIFICATION CHECKLIST

After making changes, verify:
- [ ] Selecting "Lodha" on BOQList and clicking Add BOQ navigates to `?client=lodha` ✅ (already works)
- [ ] On the BOQ manage page with `?client=lodha`, uploading the Lodha PDF triggers `parseLodhaBoq` and shows items grouped by section (1.01, 1.02, etc.)
- [ ] On the BOQ manage page with `?client=hiranandani`, uploading the Hiranandani PDF triggers `parseHiranandaniBoq` and shows items grouped by service type (Sanitary fixtures, Cold & hot water, etc.) — CGST/SGST lines are excluded
- [ ] Clicking "Add to BOQ" calls `POST /api/boq/lodha` or `POST /api/boq/hiranandani` per item
- [ ] Clicking "Add Item" manually on the Lodha page calls `POST /api/boq/lodha` with `item_description`
- [ ] Clicking "Add Item" manually on the Hiranandani page calls `POST /api/boq/hiranandani` with `service_description`
- [ ] The generic BOQ path (no `?client=`) still works exactly as before