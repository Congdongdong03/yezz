"use client";

import { useEffect, useState } from "react";
import PartyForm from "@/components/admin/PartyForm";
import { getAdminParty } from "@/lib/admin/api";
import type { PartyPackage } from "@/lib/admin/types";

export default function EditPartyPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [party, setParty] = useState<PartyPackage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    getAdminParty(id)
      .then(setParty)
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"));
  }, [id]);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">编辑派对套餐</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && !party && <p className="text-sm text-muted-foreground">加载中…</p>}
      {party && <PartyForm party={party} />}
    </div>
  );
}
