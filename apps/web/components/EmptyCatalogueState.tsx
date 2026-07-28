import {
  formatPhoneHref,
  getEmptyCatalogueCopy,
} from "@/lib/site/business";

type CatalogueKind = "projects" | "parties" | "gallery";

export function EmptyCatalogueState({
  locale,
  kind,
  phone,
  email,
}: {
  locale: "en" | "zh";
  kind: CatalogueKind;
  phone: string;
  email: string;
}) {
  const { title, body } = getEmptyCatalogueCopy(locale, kind);

  return (
    <section className="mx-auto my-12 max-w-2xl rounded-2xl border border-warm-grey/15 bg-white p-8 text-center">
      <h2 className="font-serif text-2xl font-semibold text-warm-charcoal">{title}</h2>
      <p className="mt-3 text-warm-grey">{body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a className="text-caramel hover:underline" href={`tel:${formatPhoneHref(phone)}`}>
          {phone}
        </a>
        <a className="text-caramel hover:underline" href={`mailto:${email}`}>
          {email}
        </a>
      </div>
    </section>
  );
}
