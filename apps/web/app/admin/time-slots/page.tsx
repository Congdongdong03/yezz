"use client";

import { useEffect, useMemo, useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import {
  createAdminTimeSlot,
  deleteAdminTimeSlot,
  getAdminTimeSlots,
  updateAdminTimeSlot,
} from "@/lib/admin/api";
import type { TimeSlot } from "@/lib/admin/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminTimeSlotsPage() {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [single, setSingle] = useState({
    startTime: "10:00",
    endTime: "12:00",
    capacity: "8",
  });

  const [batch, setBatch] = useState({
    startDate: "",
    endDate: "",
    weekdays: "3,6",
    startTime: "10:00",
    endTime: "12:00",
    capacity: "8",
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    date: string;
    startTime: string;
    endTime: string;
    capacity: string;
    notes: string;
  }>({ date: "", startTime: "", endTime: "", capacity: "8", notes: "" });

  const load = () => {
    setLoading(true);
    getAdminTimeSlots()
      .then(setSlots)
      .catch((err) =>
        setMessage({ type: "error", text: err instanceof Error ? err.message : "加载失败" }),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const daySlots = useMemo(
    () => slots.filter((s) => s.date === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [slots, selectedDate],
  );

  const monthDates = useMemo(() => {
    const set = new Set(slots.map((s) => s.date));
    return [...set].sort();
  }, [slots]);

  const handleCreateSingle = async () => {
    try {
      await createAdminTimeSlot({
        date: selectedDate,
        startTime: single.startTime,
        endTime: single.endTime,
        capacity: Number.parseInt(single.capacity, 10),
      });
      setMessage({ type: "success", text: "时段已创建" });
      load();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "创建失败" });
    }
  };

  const handleCreateBatch = async () => {
    try {
      await createAdminTimeSlot({
        startDate: batch.startDate,
        endDate: batch.endDate,
        weekdays: batch.weekdays.split(",").map((d) => Number.parseInt(d.trim(), 10)),
        slots: [
          {
            startTime: batch.startTime,
            endTime: batch.endTime,
            capacity: Number.parseInt(batch.capacity, 10),
          },
        ],
      });
      setMessage({ type: "success", text: "批量时段已创建" });
      load();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "批量创建失败" });
    }
  };

  const startEdit = (slot: TimeSlot) => {
    setEditingId(slot.id);
    setEditForm({
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: String(slot.capacity),
      notes: slot.notes ?? "",
    });
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ date: "", startTime: "", endTime: "", capacity: "8", notes: "" });
  };

  const handleSaveEdit = async (slot: TimeSlot) => {
    const newCapacity = Number.parseInt(editForm.capacity, 10);
    if (Number.isNaN(newCapacity) || newCapacity < 1) {
      setMessage({ type: "error", text: "容量必须大于等于 1" });
      return;
    }
    if (slot.bookedCount > 0 && newCapacity < slot.bookedCount) {
      if (!confirm(`该时段已有 ${slot.bookedCount} 人预约，新容量(${newCapacity})小于已预约人数，是否继续？`)) {
        return;
      }
    }
    try {
      await updateAdminTimeSlot(slot.id, {
        date: editForm.date,
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        capacity: newCapacity,
        notes: editForm.notes.trim() || null,
      });
      setMessage({ type: "success", text: "时段已更新" });
      setEditingId(null);
      load();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "更新失败" });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">档期管理</h1>
        <p className="text-sm text-muted-foreground">设置可预约日期与时段容量</p>
      </div>

      {message && (
        <AlertBanner
          type={message.type}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h2 className="font-medium">单日新增</h2>
          <div>
            <Label htmlFor="selectedDate">日期</Label>
            <Input
              id="selectedDate"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>开始</Label>
              <Input
                value={single.startTime}
                onChange={(e) => setSingle({ ...single, startTime: e.target.value })}
              />
            </div>
            <div>
              <Label>结束</Label>
              <Input
                value={single.endTime}
                onChange={(e) => setSingle({ ...single, endTime: e.target.value })}
              />
            </div>
            <div>
              <Label>容量</Label>
              <Input
                type="number"
                min={1}
                value={single.capacity}
                onChange={(e) => setSingle({ ...single, capacity: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={handleCreateSingle}>添加时段</Button>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h2 className="font-medium">批量创建</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>开始日期</Label>
              <Input
                type="date"
                value={batch.startDate}
                onChange={(e) => setBatch({ ...batch, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label>结束日期</Label>
              <Input
                type="date"
                value={batch.endDate}
                onChange={(e) => setBatch({ ...batch, endDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>星期几（0=周日，如 3,6）</Label>
            <Input
              value={batch.weekdays}
              onChange={(e) => setBatch({ ...batch, weekdays: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input
              value={batch.startTime}
              onChange={(e) => setBatch({ ...batch, startTime: e.target.value })}
            />
            <Input
              value={batch.endTime}
              onChange={(e) => setBatch({ ...batch, endTime: e.target.value })}
            />
            <Input
              type="number"
              value={batch.capacity}
              onChange={(e) => setBatch({ ...batch, capacity: e.target.value })}
            />
          </div>
          <Button variant="outline" onClick={handleCreateBatch}>
            批量生成
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-medium">
          {selectedDate} 的时段 {loading && "（加载中…）"}
        </h2>
        {daySlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">该日暂无时段</p>
        ) : (
          <div className="space-y-2">
            {daySlots.map((slot) => (
              <div key={slot.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span>
                    {slot.startTime} – {slot.endTime} · 已订 {slot.bookedCount}/{slot.capacity}
                    {!slot.isAvailable && (
                      <span className="ml-2 text-red-600">已关闭</span>
                    )}
                    {slot.notes && <span className="ml-2 text-muted-foreground">({slot.notes})</span>}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(slot)}>
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await updateAdminTimeSlot(slot.id, { isAvailable: !slot.isAvailable });
                        load();
                      }}
                    >
                      {slot.isAvailable ? "关闭" : "开启"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (!confirm("确定删除该时段？")) return;
                        await deleteAdminTimeSlot(slot.id);
                        load();
                      }}
                    >
                      删除
                    </Button>
                  </div>
                </div>
                {editingId === slot.id && (
                  <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>日期</Label>
                        <Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
                      </div>
                      <div>
                        <Label>容量</Label>
                        <Input type="number" min={1} value={editForm.capacity} onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>开始时间</Label>
                        <Input value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} />
                      </div>
                      <div>
                        <Label>结束时间</Label>
                        <Input value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>备注</Label>
                      <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="可选" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveEdit(slot)}>保存</Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>取消</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {monthDates.length > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            已有档期日期：{monthDates.slice(0, 8).join("、")}
            {monthDates.length > 8 ? "…" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
