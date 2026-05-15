# Project Detail Page & Cart Design

## Overview

Add project detail pages and a lightweight "pre-selection cart" so customers can browse project styles/variants, add multiple items, and submit a single booking/order to the store owner.

**Customer flow:**
1. Browse projects on Home or `/projects`
2. Tap a project card → enter detail page (`/projects/[slug]`)
3. View images, description, price; select style/date if applicable
4. Tap "Add to Cart" → item added to pre-selection cart
5. Open cart sidebar (top-right icon) → review items
6. Tap "Submit Booking" → go to `/cart` page
7. Fill name/phone/wechat once → submit
8. Owner receives a single email with all selected items

---

## Data Model (Sanity Schema Changes)

### `diyProject` document additions

| Field | Type | Description |
|-------|------|-------------|
| `projectType` | `string` | `"experience"` or `"product"`. Experience = book time/people only. Product = pick a specific style/variant. |
| `styles` | `array` of objects | Optional. Each object: `name` (localized en/zh), `image` (image asset), `price` (string, e.g. "¥78"). Only used when `projectType == "product"`. |

### New `cartOrder` document

Stores submitted pre-selection orders in Sanity so the owner can view them in the Studio.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Customer name |
| `phone` | `string` | Customer phone |
| `wechat` | `string` | Customer WeChat ID |
| `message` | `text` | Optional note |
| `items` | `array` of objects | Each item: `projectId`, `projectName`, `projectType`, `styleName` (optional), `date` (optional), `people` (optional), `price` |
| `status` | `string` | `new`, `contacted`, `confirmed`, `cancelled` |
| `submittedAt` | `datetime` | Auto-set |

---

## Page Structure & Routes

### New routes

| Route | Purpose |
|-------|---------|
| `/projects/[slug]` | Project detail page. Shows gallery, info, style selector (if product), "Add to Cart" button. |
| `/cart` | Cart checkout page. Lists all cart items + customer form + submit button. |

### Existing page changes

| Page | Change |
|------|--------|
| Home (`/`) | `FeaturedProjects` cards now link to `/projects/[slug]`. |
| Projects (`/projects`) | `ProjectCard` now links to `/projects/[slug]`. |
| Layout | Add cart icon (with item count badge) in the navbar top-right. |

### Project detail page (`/projects/[slug]`) layout

1. **Image gallery** — main image + style/reference images. Swipeable/carousel on mobile.
2. **Info section** — localized name, description, tags, price range, duration.
3. **Action area** (below info):
   - *Product type*: style selector (radio or thumbnail grid), then "Add to Cart".
   - *Experience type*: optional date picker + people count, then "Add to Cart".
   - Shortcut: "Book Now" jumps directly to `/cart` with this item pre-added.

---

## Cart Interaction Design

### State management

- React Context (`CartProvider`) + `localStorage`.
- Cart persists across page refreshes.
- Actions: `addItem`, `removeItem`, `clearCart`.

### Cart item shape

```ts
interface CartItem {
  projectId: string;
  projectSlug: string;
  projectName: { en: string; zh: string };
  projectType: "experience" | "product";
  imageUrl?: string;
  styleName?: { en: string; zh: string };   // for product
  date?: string;                             // for experience
  people?: number;                           // for experience
  price?: string;
}
```

### Sidebar drawer (right-side slide-out)

- Triggered by cart icon in navbar.
- Header: "My Pre-selection" + close button.
- Body: list of cart items. Each row shows thumbnail, name, selected style/date, price, and a remove button.
- Empty state: illustration + text prompting user to browse projects.
- Footer (sticky):
  - Total price line (informational only; payment is offline).
  - "Submit Booking" button → navigates to `/cart`.

### `/cart` checkout page

- Full page, not inside drawer, so the form has enough space.
- Top half: review all cart items (same list as drawer, larger).
- Bottom half: customer form.
    - Name (required)
    - Phone (required)
    - WeChat (optional)
    - Note (optional, e.g. "Will pick up Saturday afternoon")
- "Confirm Submit" button.
- If customer info was previously saved to `localStorage`, pre-fill the form.
- Success state: thank-you message + clear cart.

---

## Submission Flow & Email Notification

### `submitCart` Server Action

Located at `lib/actions/cart.ts` (new file, separate from existing `submitBooking`).

1. Validate customer fields with Zod.
2. Read cart items from the submitted payload.
3. Create a `cartOrder` document in Sanity.
4. Send email via Resend to `OWNER_EMAIL`.
5. Return `{ success: true, orderId }` or `{ success: false, errors }`.

### Email template (HTML)

```
Subject: New Order from {name}

Customer:
- Name: {name}
- Phone: {phone}
- WeChat: {wechat || "N/A"}
- Note: {message || "N/A"}

Items:
1. {projectName} — {styleName || date/people info} — {price}
2. ...
```

### Existing booking page (`/book`)

Kept as-is for direct/quick bookings. `submitBooking` action and `booking` Sanity type remain unchanged. Cart orders and direct bookings are separate record types.

---

## Mock Data Examples

### Product-type projects with styles

**Labubu Doll Clothes**
- Type: `product`
- Price range: ¥78 – ¥128
- Styles:
  - Pink Dress — ¥78
  - Blue Overalls — ¥88
  - Holiday Limited Set — ¥128

**Paint by Numbers**
- Type: `product`
- Price range: ¥68 – ¥98
- Styles:
  - Starry Night — ¥88
  - Cherry Blossom Street — ¥98
  - Cute Pets — ¥68

### Experience-type projects

**Cream Glue Phone Case**
- Type: `experience`
- Price range: ¥68 – ¥128
- Duration: 1 – 1.5 hours

**Beaded Phone Strap**
- Type: `experience`
- Price range: ¥48 – ¥98
- Duration: 1 – 1.5 hours

### Sample cart + submission

Customer: Xiao Li, phone 13800138000, WeChat: xiaoli123
Cart:
1. Labubu Doll Clothes — Pink Dress — ¥78
2. Paint by Numbers — Starry Night — ¥88
3. Cream Glue Phone Case — May 20, 2 people

Note: "Will pick up Saturday afternoon"

---

## Error Handling

- **Cart submission fails**: show inline error, keep cart and form data so user can retry.
- **Sanity unavailable during detail page fetch**: fall back to mock data (existing pattern).
- **Resend email fails**: still save `cartOrder` to Sanity so the owner can see it in Studio; surface a warning to the user that email delivery may be delayed.

## i18n

All new UI strings added to `lib/i18n/messages/en.json` and `zh.json`:
- Cart drawer title, empty state, remove button
- "Add to Cart", "Book Now"
- Checkout page labels (name, phone, wechat, note, submit)
- Success message

---

## Sanity Schema Files to Modify / Create

- `sanity/schemaTypes/diyProject.ts` — add `projectType` and `styles` fields
- `sanity/schemaTypes/cartOrder.ts` — new document type
- `sanity/schemaTypes/index.ts` — export `cartOrder`
