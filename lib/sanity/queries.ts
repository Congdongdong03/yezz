export const projectsQuery = `*[_type == "diyProject"] | order(order asc) {
  _id,
  name,
  slug,
  "category": category->{_id, name, slug},
  description,
  "imageUrl": images[0].asset->url,
  priceRange,
  duration,
  tags,
  order
}`;

export const categoriesQuery = `*[_type == "projectCategory"] | order(order asc) {
  _id,
  name,
  slug,
  icon,
  order
}`;

export const partiesQuery = `*[_type == "partyPackage"] {
  _id,
  name,
  slug,
  description,
  includes,
  "imageUrl": images[0].asset->url,
  minPeople,
  maxPeople,
  priceIndicator,
  tags
}`;

export const galleryQuery = `*[_type == "galleryImage"] | order(order asc) {
  _id,
  "imageUrl": image.asset->url,
  category,
  caption,
  order
}`;

export const siteSettingsQuery = `*[_type == "siteSettings"][0]`;

export const featuredProjectsQuery = `*[_type == "diyProject"] | order(order asc) [0...4] {
  _id,
  name,
  slug,
  "category": category->name,
  description,
  "imageUrl": images[0].asset->url,
  priceRange,
  duration,
  tags,
  order
}`;

export const featuredPartiesQuery = `*[_type == "partyPackage"] | order(_createdAt asc) [0...2] {
  _id,
  name,
  slug,
  description,
  "imageUrl": images[0].asset->url,
  minPeople,
  maxPeople,
  priceIndicator,
  tags
}`;

export const galleryHighlightQuery = `*[_type == "galleryImage"] | order(order asc) [0...6] {
  _id,
  "imageUrl": image.asset->url,
  category,
  caption,
  order
}`;

export const storeVibesQuery = `*[_type == "galleryImage" && category == "store"] | order(order asc) [0] {
  _id,
  "imageUrl": image.asset->url,
  caption
}`;

export const projectBySlugQuery = `*[_type == "diyProject" && slug.current == $slug][0] {
  _id,
  name,
  slug,
  "category": category->{_id, name, slug},
  description,
  "images": images[].asset->url,
  priceRange,
  duration,
  tags,
  order
}`;

export const partyBySlugQuery = `*[_type == "partyPackage" && slug.current == $slug][0] {
  _id,
  name,
  slug,
  description,
  includes,
  "images": images[].asset->url,
  minPeople,
  maxPeople,
  priceIndicator,
  tags
}`;

export const projectDetailQuery = `*[_type == "diyProject" && slug.current == $slug][0] {
  _id,
  name,
  slug,
  projectType,
  "category": category->{_id, name, slug},
  description,
  "imageUrl": images[0].asset->url,
  "images": images[].asset->url,
  styles[]{
    name,
    "imageUrl": image.asset->url,
    price
  },
  priceRange,
  duration,
  tags,
  order
}`;
