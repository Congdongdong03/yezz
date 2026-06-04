import GalleryForm from "@/components/admin/GalleryForm";

export default function NewGalleryPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">添加画廊图片</h1>
      <GalleryForm />
    </div>
  );
}
