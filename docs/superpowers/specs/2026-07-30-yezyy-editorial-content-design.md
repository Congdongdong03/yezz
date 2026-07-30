# YezYY Editorial Content and Photography Design

**Date:** 2026-07-30  
**Status:** Approved direction; awaiting written-spec review  
**Scope:** the public visual second pass only

## 1. Purpose

The first public redesign established a safe shared visual system and preserved
the booking, party, customer-management, and Chinese admin workflows. This
second pass makes the public experience feel like a real, established DIY
studio rather than a collection of consistently styled application pages.

YezYY should feel refined, creative, cute, and welcoming. It should not look
like a generic children's activity template or a dark luxury editorial site.
The visitor should understand the real studio first, then discover projects,
parties, and practical visit information without losing the visual thread.

This is an additive presentation phase. It does not change database models,
request eligibility, pricing, attendance policy, staff workflows, or the
three public capability gates.

## 2. Approved Direction

Use a **brand-editorial studio** approach:

- real YezYY store and workspace imagery establishes authenticity;
- properly licensed generic DIY imagery supplements process and material
  moments where YezYY imagery is unavailable;
- white, warm canvas, and rose-paper surfaces provide structure while images
  carry the emotional weight;
- public pages read as a single visit to the studio: arrive, choose a project,
  make something, plan a party, and visit the shop;
- operational facts remain visually calm but easy to find.

The design preserves the existing public palette:

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#FBF8F6` | page background |
| Paper | `#FFFFFF` | primary content surface |
| Soft blush | `#F8E8EE` | quiet emphasis |
| Rose paper | `#F2DFE6` | sequential/process sections |
| Footer rose | `#E5C8D3` | footer and grounded close |
| YezYY pink | `#D96F9E` | actions, selected states, highlights |
| Warm ink | `#44393D` | headings and strong copy |
| Muted | `#75666B` | supporting copy |

Large black panels, gradients, repetitive pastel cards, decorative stickers,
and generic "activity app" visual devices are out of scope.

## 3. Image Truth and Attribution Rules

### 3.1 Real YezYY images

The supplied storefront and studio photos can be used as real YezYY imagery.
They may be used in the hero, Visit route, gallery, and contextual page
sections. Copy may truthfully call these images the YezYY studio in Glen
Waverley.

### 3.2 Licensed generic images

Generic images may show activities such as cream piping, jewellery beading,
paintable figurines, and melty-bead making. They must be sourced from a
license that permits public website use and must not contain another studio's
brand, recognisable staff, proprietary classes, or customer claims.

They are described as **DIY inspiration** or **project inspiration** where
context could otherwise make a visitor believe they are YezYY customer work.
They are never used for testimonial, attendance, event, or customer-result
claims.

### 3.3 Future customer imagery

Customer work, party scenes, and identifiable people are omitted until YezYY
has a suitable image and the required permission. The design has explicit,
non-deceptive empty states for this rather than filling the page with stock
customer images.

## 4. Route Design

### 4.1 Home

The home page follows a deliberate visit narrative:

1. **Arrival** — storefront/workspace-led hero, location, and one truthful
   browse action while requests are closed.
2. **Choose a project** — three signature activities arranged as an
   asymmetrical image-led editorial cluster, not equal cards.
3. **Make it yours** — short material/process section using rose paper and
   generic inspiration imagery where permitted.
4. **Celebrate together** — party split section with clear 4–8 participant
   facts, manual confirmation, and pay-in-store language.
5. **Visit the studio** — real store imagery, address, and opening-hours cue.

The existing trustworthy facts strip remains compact below the hero.

### 4.2 Projects and project detail

Project browsing receives a magazine-like visual hierarchy: one featured
project, distinct image ratios, and a quiet category control. Project detail
uses a strong hero image, concise fact rail (price, duration, age guidance),
and a clearly separated inspiration note when its hero uses generic imagery.
No booking mutation is exposed while its capability is closed.

### 4.3 Gallery

The gallery becomes a responsive editorial mosaic with three visible groups:

- **At YezYY** for verified store imagery;
- **DIY inspiration** for licensed generic project imagery;
- **Community moments** for future permission-cleared customer work.

The third group provides an honest empty state until real, consented material
is available.

### 4.4 Visit

The contact route is presented publicly as **Visit**. It gives the studio an
actual sense of place: a real wide photo, exact address, opening hours,
contact routes, accessibility/arrival guidance where already known, and a
small map treatment. It does not fabricate transport or parking claims.

### 4.5 Parties, booking, and customer booking management

These retain their operational layouts, but use the shared editorial tokens:
more controlled type hierarchy, factual panels, calmer borders, and clearer
closed-flow messaging. Policies, prices, manual confirmation, and pay-in-store
terms remain unchanged.

### 4.6 Admin and products

The Chinese admin remains function-first and is not changed in this phase.
Product/cart capability remains closed; no ecommerce flow is introduced.

## 5. Responsive and Accessible Behaviour

- Desktop uses asymmetry and larger image crops; mobile becomes a deliberate
  single-column story rather than a squeezed desktop mosaic.
- Text overlays always have sufficient contrast and an unambiguous background.
- Image alt text describes verified images truthfully and calls generic assets
  inspiration where relevant.
- Decorative imagery uses empty alt text; content imagery gets concise,
  meaningful text.
- Motion is limited to optional, short reveal/hover feedback and respects
  `prefers-reduced-motion`.
- Keyboard focus, label semantics, error states, and request-gate fallbacks
  remain accessible and unchanged in meaning.

## 6. Implementation Boundaries

Implementation may add reusable public components for image provenance,
editorial section shells, and responsive gallery layout. It must not:

- enable any public booking, party, or product capability;
- alter server-side availability or booking validation;
- weaken secure customer-management actions;
- change Chinese admin data or staff operation flows;
- add third-party images without recording source/license metadata;
- claim generic imagery was created at, purchased from, or attended at YezYY.

## 7. Verification

The implementation plan must include:

1. focused component tests for provenance labels and closed-gate actions;
2. typecheck, lint, existing web tests, and release verification;
3. visual checks for English and Chinese at desktop and actual narrow mobile
   viewport dimensions;
4. production smoke checks showing all three capabilities remain false;
5. manual review of image attribution text and all visual copy claims.

## 8. Success Criteria

The second pass succeeds when a visitor sees a recognisable real studio with a
clear making experience, quickly finds what can be made and how to visit, and
never confuses generic inspiration for YezYY customer work. The visual system
must feel coherent across all public routes while operational flows remain
intact and closed until the business elects to open them.
