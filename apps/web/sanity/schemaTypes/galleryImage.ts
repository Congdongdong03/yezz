import { defineType, defineField } from "sanity";

export const galleryImage = defineType({
  name: "galleryImage",
  title: "Gallery Image",
  type: "document",
  fields: [
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: { hotspot: true },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "string",
      options: {
        list: [
          { title: "Couple", value: "couple" },
          { title: "Birthday", value: "birthday" },
          { title: "Kids", value: "kids" },
          { title: "Gift", value: "gift" },
          { title: "Store", value: "store" },
          { title: "Works", value: "works" },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "caption",
      title: "Caption",
      type: "object",
      fields: [
        { name: "en", title: "English", type: "string" },
        { name: "zh", title: "Chinese", type: "string" },
      ],
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
      title: "caption.en",
      media: "image",
    },
  },
});
