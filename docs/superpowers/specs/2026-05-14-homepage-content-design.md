# YEZZ Homepage Content Enrichment Design

## Overview

Enrich the YEZZ homepage with 6 new content sections to complete the brand storytelling and conversion funnel. The homepage currently only has Hero + WhyDIY; this design adds scene entries, featured projects, party previews, gallery highlights, store vibes, and a WeChat CTA.

## Goals

1. Let visitors understand YEZZ's 3 core scenes (date, birthday, DIY) within 10 seconds of scrolling
2. Showcase actual projects and party packages to build trust
3. Surface gallery works to inspire visitors
4. Provide multiple conversion paths (Book Now, Add WeChat, View Projects, View Parties)

## Page Structure

```
Hero (existing)
SceneEntry (new)
FeaturedProjects (new)
WhyDIY (existing)
PartyPackagesPreview (new)
GalleryHighlight (new)
StoreVibes (new)
WeChatCTA (new)
Footer (existing)
```

## Section Specifications

### 1. SceneEntry

- **Purpose**: Help visitors self-identify their use case
- **Layout**: 3-column grid (responsive: 1 col mobile, 3 col desktop)
- **Content**:
  - Date Night (icon: Heart) → links to `/projects` with date tag filter
  - Birthday Party (icon: Cake) → links to `/parties`
  - DIY Experience (icon: Palette) → links to `/projects`
- **Animation**: framer-motion `whileInView` fade-up, stagger 0.1s
- **Data**: Hard-coded content, i18n via next-intl

### 2. FeaturedProjects

- **Purpose**: Surface popular DIY projects to inspire booking
- **Layout**: Section title + "View All" link, 3-column grid of project cards
- **Content**: Reuse existing `ProjectCard` component
- **Data**: Sanity `diyProject`, limited to 4 items, ordered by `order` field
- **Fallback**: If no projects, show "Coming Soon" placeholder

### 3. PartyPackagesPreview

- **Purpose**: Surface party packages for high-value customers
- **Layout**: 2-column cards with image, name, description, price indicator, people range, CTA
- **Data**: Sanity `partyPackage`, limited to 2 items
- **Fallback**: If no packages, show "Coming Soon" placeholder

### 4. GalleryHighlight

- **Purpose**: Showcase real customer works to build trust and inspire
- **Layout**: 3×2 image grid with hover overlay showing category
- **Data**: Sanity `galleryImage`, limited to 6 items, mixed categories
- **Fallback**: If no images, show placeholder grid

### 5. StoreVibes

- **Purpose**: Show the physical space to set expectations
- **Layout**: 2-column (image left 60%, text right 40%)
- **Content**: Store photo + short description + "Visit Us" CTA to `/contact`
- **Data**: Sanity `galleryImage` with `category == "store"`, limited to 1
- **Fallback**: If no store image, section is hidden

### 6. WeChatCTA

- **Purpose**: Final conversion push before footer
- **Layout**: Centered text block with 2 buttons side-by-side
- **Buttons**:
  - "Add WeChat" (secondary style, opens QR code modal or copies ID)
  - "Book Now" (primary style, links to `/book`)
- **Data**: Hard-coded, i18n via next-intl

## Data Queries

```groq
// Featured projects (limit 4)
*[_type == "diyProject"] | order(order asc) [0...4] {
  _id, name, slug, "imageUrl": images[0].asset->url,
  priceRange, duration, tags
}

// Featured party packages (limit 2)
*[_type == "partyPackage"] | order(_createdAt asc) [0...2] {
  _id, name, slug, description,
  "imageUrl": images[0].asset->url,
  minPeople, maxPeople, priceIndicator
}

// Gallery highlights (limit 6)
*[_type == "galleryImage"] | order(order asc) [0...6] {
  _id, "imageUrl": image.asset->url, category, caption
}

// Store vibe image (limit 1)
*[_type == "galleryImage" && category == "store"] | order(order asc) [0] {
  _id, "imageUrl": image.asset->url, caption
}
```

## Architecture

- `app/[locale]/page.tsx`: Server Component, parallel data fetching via `Promise.all`, passes data as props to sections
- Section components: `components/sections/*.tsx`, Client Components for framer-motion animations
- i18n: All hard-coded UI text uses `useTranslations`; Sanity content uses locale-aware field selection (`name[locale]`)

## Error Handling

- Any Sanity query failure returns empty array, section renders "Coming Soon" or is hidden
- Missing images use consistent placeholder (bg-muted + text)

## Styling

- Follow existing Tailwind design system (warm palette, rounded-2xl, shadow-sm)
- Consistent section spacing: `py-20` between sections
- Container: `mx-auto max-w-7xl px-4`

## i18n Keys to Add

- `home.sceneEntry.title`, `home.sceneEntry.subtitle`
- `home.sceneEntry.date.title`, `home.sceneEntry.date.desc`
- `home.sceneEntry.birthday.title`, `home.sceneEntry.birthday.desc`
- `home.sceneEntry.diy.title`, `home.sceneEntry.diy.desc`
- `home.featuredProjects.title`, `home.featuredProjects.viewAll`
- `home.partyPackages.title`, `home.partyPackages.viewAll`
- `home.gallery.title`, `home.gallery.viewAll`
- `home.storeVibes.title`, `home.storeVibes.desc`, `home.storeVibes.cta`
- `home.wechatCta.title`, `home.wechatCta.subtitle`, `home.wechatCta.wechat`, `home.wechatCta.book`
