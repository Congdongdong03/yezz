import { defineType, defineField } from "sanity";

export const diyProject = defineType({
  name: "diyProject",
  title: "DIY Project",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "object",
      fields: [
        { name: "en", title: "English", type: "string" },
        { name: "zh", title: "Chinese", type: "string" },
      ],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name.en" },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "reference",
      to: [{ type: "projectCategory" }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "projectType",
      title: "Project Type",
      type: "string",
      options: {
        list: [
          { title: "Experience (book time/people)", value: "experience" },
          { title: "Product (pick a style)", value: "product" },
        ],
      },
      initialValue: "experience",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "styles",
      title: "Styles / Variants",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "name",
              title: "Style Name",
              type: "object",
              fields: [
                { name: "en", title: "English", type: "string" },
                { name: "zh", title: "Chinese", type: "string" },
              ],
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "image",
              title: "Style Image",
              type: "image",
              options: { hotspot: true },
            }),
            defineField({
              name: "price",
              title: "Price",
              type: "string",
              description: "e.g. '¥78'",
            }),
          ],
        },
      ],
      hidden: ({ parent }) => parent?.projectType !== "product",
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "object",
      fields: [
        { name: "en", title: "English", type: "text" },
        { name: "zh", title: "Chinese", type: "text" },
      ],
    }),
    defineField({
      name: "images",
      title: "Images",
      type: "array",
      of: [{ type: "image", options: { hotspot: true } }],
    }),
    defineField({
      name: "priceRange",
      title: "Price Range",
      type: "string",
      description: "e.g., 'From $35'",
    }),
    defineField({
      name: "duration",
      title: "Duration",
      type: "string",
      description: "e.g., '1-2 hours'",
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [{ type: "string" }],
      options: {
        list: [
          { title: "Date", value: "date" },
          { title: "Birthday", value: "birthday" },
          { title: "Kids", value: "kids" },
          { title: "Friends", value: "friends" },
          { title: "Gift", value: "gift" },
        ],
      },
    }),
    defineField({
      name: "order",
      title: "Order",
      type: "number",
      initialValue: 0,
    }),
  ],
  preview: {
    select: {
      title: "name.en",
      subtitle: "name.zh",
      media: "images.0",
    },
  },
});
