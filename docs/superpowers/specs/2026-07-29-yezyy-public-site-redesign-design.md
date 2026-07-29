# YezYY Public Site Redesign

**Date:** 2026-07-29
**Status:** Approved design direction and HTML visual concept; implementation
requires a separate plan
**Public brand:** `YezYY`
**Reference principle:** combine the photographic rhythm and generous pacing of
UnicDIY with the information clarity and conversion discipline of a mature DIY
studio. The result must remain an original YezYY design using YezYY content,
copy, business rules, and photography.

## 1. Purpose

The current public site contains useful sections and working business flows,
but its visual hierarchy gives too many sections equal weight. Colour panels,
cards, and copy compete with one another while real YezYY photography does not
consistently lead the experience. The result can feel like a generic template
rather than an established, operating studio.

The redesign makes YezYY immediately understandable as a bookable DIY studio in
Glen Waverley. Retail products remain a supporting in-store attraction. The
site serves young customers, friends, couples, families, and children without
splitting into two competing visual identities.

This is a public presentation refactor, not a full application rewrite. It
preserves the existing database, APIs, booking and party workflows, customer
action tokens, email notifications, business rules, bilingual content model,
and Chinese operational admin.

## 2. Goals and Success Criteria

A first-time visitor should be able to answer these questions within 30
seconds:

1. What is YezYY? A real DIY experience studio with an in-store retail range.
2. Where is it? Glen Waverley, Melbourne.
3. What can I make? The featured activities and complete project catalogue.
4. How long does it take and what does it cost? Duration and current AUD price
   appear beside each activity.
5. How do I attend? Request a session or party, wait for manual confirmation,
   and pay in store.

The finished public experience must:

- let real photography occupy the dominant visual area;
- make one primary action obvious at each stage;
- show price, duration, age, attendance, and request status truthfully;
- remain usable in English and Simplified Chinese;
- preserve all existing server-authoritative validation and gated states;
- work from 320px mobile widths through large desktop screens;
- meet keyboard, focus, contrast, labelling, reduced-motion, and semantic HTML
  requirements;
- contain no fictional projects, placeholder reviews, stock customer work, or
  AI-generated imagery presented as YezYY content.

## 3. Approved Direction

### 3.1 Brand position

YezYY is presented first as a **DIY experience studio**. In-store products are
shown later as an additional reason to visit, not as an online shop and not as
the homepage's primary identity.

The personality is refined, cute, and welcoming without becoming childish.
The same design serves young customers and families. Audience differences are
handled through photography and content paths, not separate colour systems.

### 3.2 Visual system

The public palette is deliberately smaller than the current cream, caramel,
sage, lavender, and pink mix:

- warm canvas: `#FBF8F6`;
- paper surface: `#FFFFFF`;
- soft blush: `#F8E8EE`;
- rose paper: `#F2DFE6`;
- footer rose: `#E5C8D3`;
- YezYY pink: `#D96F9E`;
- warm ink: `#44393D`;
- muted text: `#75666B`;
- quiet border: `#E8DEDF`;
- destructive/error red remains functional and is never decorative.

Pink marks brand emphasis, selected states, and the primary public action.
Large coloured section backgrounds, decorative gradients, and one accent
colour per card are removed. Photography and whitespace create rhythm. Near
black such as `#2D2D2F` is not used as a large public surface: the three-step
process uses rose paper with warm ink, and the footer uses the slightly deeper
footer rose with warm ink. Dark values remain only where readable text,
outlines, or functional contrast require them.

The existing Inter and Noto Serif SC font loading remains. Inter is used for
navigation, body copy, form controls, price, time, and operational facts. Noto
Serif SC is used selectively for major headings and editorial moments. Headings
are short and sentence case. Numeric facts use tabular figures where alignment
matters.

Surfaces use restrained corners and borders. Repeated content does not become
a stack of floating rounded cards. Image-led project tiles, split editorial
sections, flat trust strips, and simple dividers replace generic dashboard-like
card collections.

### 3.3 Motion

The homepage hero supports one to three verified YezYY images. With three
images, it advances every seven seconds and provides previous, next, slide
position, and pause controls. The headline and primary actions remain fixed so
the visitor never has to chase changing controls.

Autoplay pauses when the hero receives hover or keyboard focus. Under
`prefers-reduced-motion`, the first image remains static and no automatic
transition runs. With only one publishable image the hero becomes a static
hero; images are never duplicated to simulate a carousel.

Other motion is limited to short focus, hover, disclosure, and form feedback.
Meaning never depends on animation.

### 3.4 Approved HTML concept

The owner reviewed and approved the responsive Codex HTML homepage concept
after one palette revision. The accepted concept uses a split photographic
hero, a flat four-fact confidence strip, an asymmetrical three-project grid, a
rose-paper three-step section, an editorial party split, paired in-store and
Visit sections, and a footer-rose information area. This approved HTML is a
visual benchmark, not production code; implementation must rebuild the design
through the project's React, data, locale, capability, and accessibility
boundaries rather than embedding or copying the prototype wholesale.

## 4. Information Architecture

The public navigation is:

1. `DIY Projects`
2. `Parties`
3. `Gallery`
4. `Visit`
5. locale switch
6. one primary `Book a session` action when the experience flow is enabled

The existing `/[locale]/contact` route remains the destination for the
navigation label `Visit`; no route migration is required. Existing routes for
projects, parties, gallery, booking, and secure booking management remain.

Product and cart links do not appear in public navigation while the product
capability is disabled. Existing historical product/cart code is not deleted
as part of this redesign.

The principal routes are:

- `/[locale]`
- `/[locale]/projects`
- `/[locale]/projects/[slug]`
- `/[locale]/parties`
- `/[locale]/gallery`
- `/[locale]/contact`, labelled `Visit`
- `/[locale]/book`
- `/[locale]/manage-booking/[token]`
- `/[locale]/privacy`
- `/[locale]/terms`
- `/[locale]/booking-policy`

## 5. Homepage Design

The homepage sequence is intentionally shorter and more varied than the
current equal-weight module stack.

### 5.1 Header

The header uses the exact text brand `YezYY` until a verified digital logo is
provided. It is transparent or quiet over the top of the hero and becomes a
solid readable surface when the page scrolls. Mobile uses a conventional
labelled menu button and exposes the primary action without hiding locale
selection.

### 5.2 Hero

The hero uses a three-image target set:

1. the real studio or DIY workspace;
2. hands making an activity or three featured finished projects;
3. a real friends, family, or party scene with documented permission.

Until all three types exist, the hero uses only verified available images and
falls back to a static composition. The fixed copy communicates:

- a short creative promise;
- Glen Waverley location;
- beginner-friendly positioning;
- `Explore DIY projects`;
- `Plan a party` when the party flow is enabled.

When a request capability is disabled, its mutation CTA is replaced by a
truthful contact or browse action. A disabled public gate is never bypassed for
visual completeness.

### 5.3 Confidence strip

A flat strip immediately below the hero states four operational truths:

- beginner friendly;
- materials included where the selected project specifies them;
- manually confirmed;
- pay in store.

The strip is concise and does not become four marketing cards.

### 5.4 Three featured activities

The homepage shows exactly three image-led signature activities:

1. air-dry cream piping / decoden;
2. paint clay figurine;
3. melty bead craft.

Selection is keyed by canonical project slug rather than translated title.
Each tile shows a verified image when available, bilingual name, current
starting price, duration, age guidance, and one link to the project detail.
The permanent page does not advertise the photographed temporary melty-bead
discount. A single `View all DIY projects` link follows the three activities.

### 5.5 How it works

The process is expressed in three short steps:

1. choose a project and preferred time;
2. receive manual confirmation;
3. make it in store and pay on arrival.

This section explains the real workflow rather than using abstract values or
generic promotional claims.

### 5.6 Inside YezYY

A wide real studio image alternates with short copy about the materials,
beginner support, and experience. This is the homepage's principal trust
section. It must not use empty decorative illustration in place of the real
space.

### 5.7 Parties

The party section uses a real space or party image, a concise invitation, and
the load-bearing facts:

- four to eight participants;
- one or two accompanying parents;
- $95 for 1.5 guest hours or $145 for 2.5 guest hours;
- minimum DIY spend per participant;
- request-only timing, manual confirmation, and in-store venue-fee payment.

The homepage does not reproduce the complete policy or render two equal SaaS
pricing cards. It links to the party page for all rules and the request flow.

### 5.8 Discover in store

`Discover in store` is a small editorial section after parties. It can show
real shelves, gifts, or accessories and invites the customer to browse during
a visit. It has no cart, checkout, online price grid, or coming-soon online
shop promise.

Third-party character merchandise may appear incidentally in truthful store
photography, but it is not used as the YezYY hero identity or presented in a
way that implies brand affiliation.

### 5.9 Visit and footer

The final conversion section includes the canonical address, current weekly
hours, phone, operational email, map link, Xiaohongshu ID, and future verified
social links.

The user-supplied portrait storefront photo `IMG_8981.jpg` is assigned to this
section because its full-height crop preserves the `Yez YY` sign and physical
entrance. It should not be forced into a shallow landscape hero crop.

The footer contains concise navigation, contact information, locale access,
and owner-reviewed Privacy, Terms, and Booking Policy links. Instagram and
other accounts are added only after the owner provides their verified URLs.

## 6. Public Page Designs

### 6.1 DIY projects index

The index begins with a short explanation, then exposes real project
categories and a responsive image-led grid. Category controls remain visible
without becoming a large tab dashboard.

Every card carries the facts needed to choose:

- name;
- current AUD starting price;
- expected duration;
- minimum age or supervision guidance;
- `Decide in store` availability where applicable;
- detail link.

Filters and category navigation are URL-stable and keyboard operable. Empty
categories are not rendered. The page never invents cover art for catalogue
rows that have no publishable image.

### 6.2 Project detail

The detail page gives the gallery visual priority, followed by name, verified
price, duration, included materials, age guidance, and concise instructions.
The action area remains visible near the facts but does not obscure images on
mobile.

If experience requests are enabled, the CTA enters the existing booking flow
with the project preselected. If disabled, it offers phone/email contact and
does not submit a hidden request.

### 6.3 Parties

The parties page has one photographic introduction, the two real packages,
what is included, BYO food/cake information, supervision, minimum spend,
payment, 48-hour refund policy, and request-only timing. The existing party
form and server workflow remain authoritative.

Policy facts use readable sections and a summary table where comparison helps.
The page must not imply that selecting a time confirms the event.

### 6.4 Gallery

The gallery contains only approved YezYY store, material, process, event, and
finished-work images. It supports meaningful alternative text and preserves
image aspect ratios. Captions distinguish a store space, a product example,
and customer work.

No empty gallery shell, fake social feed, stock craft image, or AI-generated
example is published. When there are too few images, the page uses a smaller
honest collection.

### 6.5 Visit

The existing contact route is redesigned as `Visit YezYY`. The storefront
photo anchors a two-column desktop layout with address, hours, contact
methods, directions, accessibility notes when known, and current social
accounts. Mobile presents the image, open-hours facts, and tap targets without
an embedded map blocking scrolling.

### 6.6 Booking and secure management

The existing ordinary, waitlist, party, and secure customer-action flows are
not rebuilt. Their presentation is aligned with the new public system:
consistent fields, error summaries, progress language, price and policy
context, and mobile spacing.

Server responses remain authoritative. Client components do not reproduce
capacity, lead-time, horizon, payment, refund, or transition rules in a way
that can diverge from the API. Secure management pages remain `noindex`, do
not expose internal identifiers, and preserve generic invalid-token errors.

### 6.7 Policy pages

Privacy, Terms, and Booking Policy receive plain-language English and
Simplified Chinese drafts based on confirmed YezYY workflows. They identify
manual confirmation, in-store payment, customer contact use, cancellation and
rescheduling, party refund timing, and secure booking links.

They are operational drafts, not presented as external legal advice. The owner
must review the text and provide the registered business name before the legal
pages are enabled in production navigation.

## 7. Component and Data Boundaries

The redesign uses focused public components:

- `PublicHeader` and `PublicFooter`;
- `HeroCarousel`;
- `ConfidenceStrip`;
- `FeaturedActivityGrid`;
- `HowItWorks`;
- `StudioStory`;
- `PartyStory`;
- `InStoreDiscovery`;
- `VisitPanel`;
- shared `ProjectFacts`;
- shared gated `RequestAction`.

Each component has one presentation job and receives already-normalised,
locale-aware data. Business rules remain in the existing services and API
layer. The homepage continues to use the established site-data boundary and
business profile rather than importing database code into React components.

Optional homepage datasets fail independently where practical. Missing
gallery, party, store, or social content removes that optional section or
shows an honest contact fallback; it does not manufacture content. Failure to
load a critical request capability must show the existing service-unavailable
or contact-safe state and must not enable a mutation.

The Chinese admin keeps its separate operational design. Public typography or
homepage changes must not restyle or destabilise the admin workbench.

## 8. Media Rules

Implementation may ingest owner-provided originals into an explicit public
media location only after confirming the file is intended for publication.
Files are preserved at useful source resolution and rendered through
responsive image optimisation. Public pages supply width and size hints to
avoid layout shift and oversized mobile downloads.

The initial media policy is:

- use empty-store, workspace, material, and finished-project images;
- do not publish identifiable adult customers without consent;
- do not publish identifiable children without explicit guardian consent;
- do not use temporary messenger thumbnails as permanent production masters;
- do not use another studio's photography;
- do not generate fake YezYY work;
- do not duplicate one image to create an artificial gallery.

The target future shoot list is a landscape studio view, a hands-making scene,
the three featured finished projects, an adult/friends experience, a
family/child experience with consent, a party setup, and the storefront.

## 9. Responsive and Accessibility Behaviour

- Mobile navigation uses native buttons, labelled expanded state, focus
  management, and scroll locking without trapping users.
- Hero text remains legible over every supplied photo through per-image focal
  positioning and a restrained readability layer.
- Project facts reflow without horizontal clipping.
- Tap targets meet a minimum 44px interactive area.
- Form errors are summarised and associated with fields.
- All controls retain visible focus.
- Colour is not the only state indicator.
- Carousel, dialogs, filters, and locale switching are keyboard accessible.
- Reduced-motion preferences disable autoplay and non-essential transitions.
- Images have content-specific alternative text; decorative images use empty
  alternative text.
- Heading order describes the page rather than visual size.

## 10. Search, Trust, and Analytics

Metadata continues to use canonical locale-aware titles and descriptions.
Public business details remain consistent across visible copy and structured
data. Project and party pages receive truthful descriptions based on their
actual catalogue records.

No placeholder testimonials are rendered. A review section is added only when
YezYY has real attributable reviews and permission to display them.

Existing analytics may record page views and high-level CTA interactions, but
must not capture secure booking tokens, form message contents, customer
details, or admin activity. Consent and privacy copy must remain consistent
with any analytics enabled in production.

## 11. Gating and Rollout

The redesign is built and verified behind the existing capability model.
Initial production values remain:

```text
REQUEST_FLOW_EXPERIENCE_ENABLED=false
REQUEST_FLOW_PARTY_ENABLED=false
REQUEST_FLOW_PRODUCT_ENABLED=false
```

The environment hard gate and database switch both remain required for an
experience or party request. Product remains disabled. Visual redesign work
must not alter these values, create an alternate mutation path, or expose
disabled forms through client-only state.

Implementation proceeds incrementally:

1. public tokens, header, footer, and shared primitives;
2. homepage;
3. project index and detail;
4. parties, gallery, and Visit;
5. visual alignment of booking and secure management;
6. bilingual policy drafts and verified media;
7. responsive, accessibility, performance, and complete regression checks.

Every step preserves working routes and can be tested independently. The old
public component is removed only after its replacement has covering tests and
is wired into the same data contract.

## 12. Testing and Acceptance

The implementation plan must include:

- component tests for header, hero controls, featured activities, gated
  request actions, project facts, and Visit content;
- route/page tests for enabled, disabled, empty-data, service-failure, and both
  locale states;
- accessibility assertions for labels, headings, focus, dialog behaviour, and
  carousel pause controls;
- responsive visual checks at 320px, a modern phone width, tablet, and desktop;
- image checks for missing source, wrong aspect crop, alternative text, and
  layout shift;
- existing booking, party, secure-action, admin, API, and database suites as
  regression gates;
- production configuration verification proving all public gates remain false;
- a final walkthrough of browse project, disabled-request fallback, party
  information, Visit, locale switching, and secure customer management.

Acceptance requires no new fictional content, no inactive primary button that
pretends to book, no placeholder reviews, no public product entry, no Chinese
admin regression, and no change to server-authoritative booking rules.
