import { defineType, defineField } from "sanity";

export const cartOrder = defineType({
  name: "cartOrder",
  title: "Cart Order",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Customer Name",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "phone",
      title: "Phone",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "wechat",
      title: "WeChat ID",
      type: "string",
    }),
    defineField({
      name: "message",
      title: "Note",
      type: "text",
    }),
    defineField({
      name: "items",
      title: "Items",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "projectId",
              title: "Project ID",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "projectName",
              title: "Project Name",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "projectType",
              title: "Project Type",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "styleName",
              title: "Style Name",
              type: "string",
            }),
            defineField({
              name: "date",
              title: "Date",
              type: "string",
            }),
            defineField({
              name: "people",
              title: "People",
              type: "number",
            }),
            defineField({
              name: "price",
              title: "Price",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
          ],
        },
      ],
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      initialValue: "new",
      options: {
        list: [
          { title: "New", value: "new" },
          { title: "Contacted", value: "contacted" },
          { title: "Confirmed", value: "confirmed" },
          { title: "Cancelled", value: "cancelled" },
        ],
      },
    }),
    defineField({
      name: "submittedAt",
      title: "Submitted At",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
    }),
  ],
  preview: {
    select: {
      title: "name",
      subtitle: "phone",
    },
  },
});
