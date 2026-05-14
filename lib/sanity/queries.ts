export const projectsQuery = `*[_type == "diyProject"] | order(order asc) {
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

export const categoriesQuery = `*[_type == "projectCategory"] | order(order asc) {
  _id,
  name,
  slug,
  icon
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
