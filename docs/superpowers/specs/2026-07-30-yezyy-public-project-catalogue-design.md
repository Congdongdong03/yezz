# YezYY Public Project Catalogue Design

**Date:** 2026-07-30  
**Status:** Approved design, pending written-spec review  
**Scope:** Public project catalogue, project presentation data, and related admin controls

## 1. Goal

Turn the existing YezYY project data into a customer-friendly bilingual catalogue that feels like a creative studio rather than a conventional online shop.

The catalogue must:

- help customers understand the four main DIY categories quickly;
- show representative projects, real AUD prices, and realistic making times;
- preserve all existing project records without exposing an overwhelming flat list;
- keep public visibility separate from booking availability;
- use real YezYY photos when available and clearly labelled licensed inspiration images otherwise;
- continue to keep ordinary booking, party booking, and product ordering closed until their existing capability gates are deliberately enabled.

## 2. Confirmed Business Rules

- Currency is AUD.
- Payment happens in store.
- Online requests require manual staff confirmation when enabled.
- Public ordinary DIY, party, and product request gates remain closed during this work.
- The homepage presents four project categories.
- The full projects page presents representative individual projects within each category.
- Project variants can be selected within a project detail page.
- Project and material availability may vary in store.
- Staff must be able to hide an unavailable public project without deleting it.
- Existing project records are retained.

## 3. Public Information Architecture

### Homepage

The homepage shows four category entrances in this order:

1. Deco Cream DIY / 奶油胶 DIY
2. Plaster Painting / 石膏彩绘
3. Beading / 串珠
4. Melty Beads / 拼豆

Each entrance contains:

- a category name in the active locale;
- a short studio-oriented description;
- one real YezYY image or a disclosed inspiration image;
- a link to the corresponding section on the projects page.

### Projects Page

The projects page is divided into four editorial category sections. It does not render all database records as one undifferentiated grid.

Each section contains:

- a category introduction;
- representative project cards;
- an availability disclaimer;
- an indication that more bases, colours, or materials may be available in store.

The initial public set contains approximately nine primary cards:

- six representative Deco Cream DIY projects;
- one Plaster Painting project with four size variants;
- one Beading project with detailed variants;
- one Melty Beads project.

### Project Detail

Each public project detail includes:

- bilingual name and description;
- AUD price or price range;
- customer-facing estimated making time;
- two or three suggested occasions;
- available variants and their prices where applicable;
- `AUD · Pay in store`;
- a material and style availability notice;
- truthful image provenance;
- the existing contact fallback while requests remain disabled.

When ordinary requests are enabled later, customers may select a specific project or the existing `Decide in store / 到店决定` option.

## 4. Initial Public Catalogue

### Deco Cream DIY / 奶油胶 DIY

The first public cards are:

| Project | Public price | Public time |
| --- | ---: | --- |
| Two Hair Clips / 一对发夹 | A$18 | 15–30 min |
| Mini Drawers / 迷你抽屉 | A$32 | 15–30 min |
| Phone Case / 手机壳 | A$66–A$76 | 30–45 min |
| Lamp / 台灯 | A$43–A$98 | 30–45 min |
| Medium Storage Box / 中号收纳盒 | A$65 | 30–45 min |
| Large Storage Box / 大号收纳盒 | A$98 | 30–45 min |

The category description notes that fridge magnets, mugs, mirrors, notebooks, pencil cases, phone accessories, bags, water bottles, and additional bases may also be available in store.

The public making time is separate from the internal capacity duration. Existing booking allocation may continue reserving a 30- or 60-minute window so the availability engine remains conservative.

### Plaster Painting / 石膏彩绘

One public project detail presents four size variants:

| Variant | Price | Time |
| --- | ---: | --- |
| Mini | A$19.80 | about 1 hour |
| Small | A$27.50 | about 1 hour |
| Medium | A$38.50 | about 1 hour |
| Large | A$54 | about 1 hour |

The customer selects the available figurine design in store. Optional finishing products are not advertised in this phase because their current availability has not been confirmed.

### Beading / 串珠

One public project detail presents:

| Variant | Price |
| --- | ---: |
| Bracelet | A$43 |
| Phone Strap 20cm | A$43 |
| Phone Strap 30cm | A$60.50 |
| Phone Strap 40cm | A$71.50 |
| Bag Chain | A$93.50 |

The card price is `From A$43`. The detail page explains that bead colours, charms, and final material choices depend on in-store availability.

### Melty Beads / 拼豆

One public project detail presents:

- A$49.50 per hour;
- A$16.50 for each additional 30 minutes;
- small and large bead options;
- an explanation that detailed designs can take longer and should be completed in one session.

## 5. Copy and Occasion Tags

YezYY supplies the prices and confirmed operational facts. The implementation supplies concise bilingual customer copy.

Each project receives two or three appropriate occasion tags selected from a controlled bilingual set, such as:

- Date idea / 约会体验
- Family activity / 亲子活动
- Friends day out / 朋友聚会
- Handmade gift / 手作礼物
- Birthday activity / 生日体验
- Relaxing craft / 放松手作

These tags are discovery aids, not eligibility or safety rules.

The ordinary DIY catalogue does not introduce a new minimum-age restriction. The confirmed five-year minimum and parent-supervision rule remains specific to parties unless YezYY establishes a separate ordinary DIY policy.

## 6. Data Model

Public presentation and operational booking state must remain independent.

### Existing operational fields

Existing fields continue to control:

- whether a project is bookable;
- internal capacity duration;
- extra-time billing;
- booking item selection;
- category relationships.

### New presentation fields

Add or formalise fields for:

- public publication status;
- public featured status;
- public sort order;
- bilingual customer-facing duration text;
- bilingual descriptions;
- occasion tags;
- variant display data where existing project-style records are insufficient;
- image provenance metadata.

`bookable` must not be reused as the public visibility flag.

Grouping several operational project records into one public detail must not destroy their distinct identifiers. For example, the four plaster sizes remain distinct booking choices even when presented under one public project story.

## 7. Admin Behaviour

The Chinese admin interface should allow staff to:

- publish or hide a project from the public catalogue;
- mark representative projects as featured;
- edit bilingual names and descriptions;
- set public ordering;
- edit prices, customer-facing duration, and occasion tags;
- manage variants;
- add real project photos;
- see whether an image is a real YezYY image or a licensed inspiration image.

Hiding a public card does not delete it and does not silently change existing bookings.

## 8. Image Policy

Image labels must be truthful:

- owner-provided store or project photos may be presented as YezYY content;
- generic licensed photos must be labelled `DIY inspiration / DIY 灵感图`;
- generic photos must not be described as YezYY customers, staff, or completed YezYY work;
- every licensed image retains its source and licence URL;
- real photos can replace inspiration images without changing project identity or URLs.

No AI-generated or unrelated image is presented as documentary store evidence.

## 9. Request-Gate Safety

This catalogue work changes presentation and catalogue management only.

During implementation and deployment:

- `experience` remains false;
- `party` remains false;
- `product` remains false;
- no card displays an enabled booking or purchase action;
- disabled routes continue to show the existing phone and email fallback.

Tests must verify both the public catalogue output and the absence of request controls while gates are closed.

## 10. Error and Empty States

- A category with no published projects remains visible only if it has useful studio copy; otherwise it is omitted from the projects page.
- A project without a real photo uses an approved disclosed inspiration image or the brand placeholder.
- A project without a valid price is hidden from the representative public set until staff corrects it.
- If the API is unavailable, the existing safe service-unavailable state remains in place.
- Missing optional variant images do not block the parent project detail.

## 11. Validation

Implementation validation must include:

- catalogue mapping unit tests;
- bilingual message tests;
- project grouping and variant tests;
- publication versus bookable-state tests;
- admin form validation tests;
- truthful image-provenance tests;
- 390px mobile checks for the homepage, projects page, and project details;
- desktop visual checks;
- type checking, linting, full web tests, and production build;
- isolated closure tests proving request gates and booking workflows were not changed;
- live post-deployment checks confirming all three public request capabilities remain false.

## 12. Out of Scope

This phase does not:

- enable ordinary DIY requests;
- enable party requests;
- enable product orders or online payment;
- add live stock quantities;
- introduce a new ordinary DIY age policy;
- delete legacy project records;
- claim that inspiration images are real YezYY work.
