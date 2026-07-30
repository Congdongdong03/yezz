import { Link } from "@/i18n/routing";

type RequestActionProps = {
  enabled: boolean;
  enabledHref: "/book";
  disabledHref: "/projects";
  enabledLabel: string;
  disabledLabel: string;
  className?: string;
};

export default function RequestAction({
  enabled,
  enabledHref,
  disabledHref,
  enabledLabel,
  disabledLabel,
  className,
}: RequestActionProps) {
  return (
    <Link className={className} href={enabled ? enabledHref : disabledHref}>
      {enabled ? enabledLabel : disabledLabel}
    </Link>
  );
}
