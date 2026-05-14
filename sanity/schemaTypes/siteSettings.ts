import { defineType, defineField } from "sanity";

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  fields: [
    defineField({
      name: "storeName",
      title: "Store Name",
      type: "string",
      initialValue: "YEZZ DIY Studio",
    }),
    defineField({
      name: "address",
      title: "Address",
      type: "text",
    }),
    defineField({
      name: "businessHours",
      title: "Business Hours",
      type: "string",
    }),
    defineField({
      name: "phone",
      title: "Phone",
      type: "string",
    }),
    defineField({
      name: "email",
      title: "Email",
      type: "string",
    }),
    defineField({
      name: "wechatQrCode",
      title: "WeChat QR Code",
      type: "image",
    }),
    defineField({
      name: "instagram",
      title: "Instagram URL",
      type: "url",
    }),
    defineField({
      name: "xiaohongshu",
      title: "Xiaohongshu URL",
      type: "url",
    }),
    defineField({
      name: "googleMapUrl",
      title: "Google Map URL",
      type: "url",
    }),
    defineField({
      name: "seoTitle",
      title: "SEO Title",
      type: "string",
    }),
    defineField({
      name: "seoDescription",
      title: "SEO Description",
      type: "text",
    }),
  ],
});
