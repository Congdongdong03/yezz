import { defineType, defineField } from "sanity";

export const partyPackage = defineType({
  name: "partyPackage",
  title: "Party Package",
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
      name: "description",
      title: "Description",
      type: "object",
      fields: [
        { name: "en", title: "English", type: "text" },
        { name: "zh", title: "Chinese", type: "text" },
      ],
    }),
    defineField({
      name: "includes",
      title: "Includes",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "en", title: "English", type: "string" },
            { name: "zh", title: "Chinese", type: "string" },
          ],
        },
      ],
    }),
    defineField({
      name: "images",
      title: "Images",
      type: "array",
      of: [{ type: "image", options: { hotspot: true } }],
    }),
    defineField({
      name: "minPeople",
      title: "Min People",
      type: "number",
      initialValue: 2,
    }),
    defineField({
      name: "maxPeople",
      title: "Max People",
      type: "number",
      initialValue: 20,
    }),
    defineField({
      name: "priceIndicator",
      title: "Price Indicator",
      type: "string",
      description: "e.g., 'From $45/person'",
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
          { title: "Mobile", value: "mobile" },
        ],
      },
    }),
  ],
  preview: {
    select: {
      title: "name.en",
      subtitle: "name.zh",
    },
  },
});
