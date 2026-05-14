import { defineType, defineField } from "sanity";

export const booking = defineType({
  name: "booking",
  title: "Booking",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
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
      name: "email",
      title: "Email",
      type: "string",
    }),
    defineField({
      name: "preferredDate",
      title: "Preferred Date",
      type: "date",
    }),
    defineField({
      name: "numberOfPeople",
      title: "Number of People",
      type: "number",
    }),
    defineField({
      name: "activityType",
      title: "Activity Type",
      type: "string",
      options: {
        list: [
          { title: "Date", value: "date" },
          { title: "Birthday", value: "birthday" },
          { title: "Friends", value: "friends" },
          { title: "Kids", value: "kids" },
          { title: "Mobile", value: "mobile" },
        ],
      },
    }),
    defineField({
      name: "interestedProject",
      title: "Interested Project",
      type: "string",
    }),
    defineField({
      name: "message",
      title: "Message",
      type: "text",
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
      subtitle: "activityType",
    },
  },
});
