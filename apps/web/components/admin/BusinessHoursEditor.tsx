"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  createStudioClosure,
  deleteStudioClosure,
  saveSpecialHours,
  updateRequestSwitches,
  updateWeeklyHours,
} from "@/lib/admin/api";
import { ApiClientError } from "@/lib/api/base";
import type { AdminSchedule, WeeklyHours } from "@/lib/admin/types";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export default function BusinessHoursEditor({
  schedule,
  onChanged,
}: {
  schedule: AdminSchedule;
  onChanged: () => void | Promise<void>;
}) {
  const [weekly, setWeekly] = useState(schedule.weekly);
  const [weeklyAcknowledged, setWeeklyAcknowledged] = useState(false);
  const [weeklyConflictFingerprint, setWeeklyConflictFingerprint] = useState<
    string | null
  >(null);
  const [special, setSpecial] = useState({
    date: "",
    opensAt: "09:30",
    closesAt: "17:00",
    isClosed: false,
    note: "",
    acknowledged: false,
    conflictFingerprint: null as string | null,
  });
  const [closure, setClosure] = useState({
    date: "",
    startTime: "12:00",
    endTime: "12:30",
    note: "",
    acknowledged: false,
    conflictFingerprint: null as string | null,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (
    action: () => Promise<unknown>,
    success: string,
    onScheduleConflict?: (fingerprint: string | null) => void,
  ) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await onChanged();
      setMessage(success);
    } catch (error) {
      const conflictFingerprint =
        error instanceof ApiClientError && error.code === "SCHEDULE_CONFLICT"
          ? (error.details?.conflictFingerprint as string | undefined) ?? null
          : null;
      if (conflictFingerprint !== null ||
        (error instanceof ApiClientError && error.code === "SCHEDULE_CONFLICT")) {
        onScheduleConflict?.(conflictFingerprint);
      }
      setMessage(
        error instanceof ApiClientError && error.code === "SCHEDULE_CONFLICT"
          ? `与现有预约冲突：${(
              error.details?.affectedBookingNumbers as string[] | undefined
            )?.join("、") ?? "请先检查预约"}`
          : "营业安排保存失败，请稍后重试",
      );
    } finally {
      setBusy(false);
    }
  };

  const patchDay = (weekday: number, patch: Partial<WeeklyHours>) => {
    setWeeklyAcknowledged(false);
    setWeeklyConflictFingerprint(null);
    setWeekly((current) =>
      current.map((day) =>
        day.weekday === weekday ? { ...day, ...patch } : day,
      ),
    );
  };

  const patchSpecial = (
    patch: Partial<typeof special>,
  ) => {
    setSpecial((value) => ({
      ...value,
      ...patch,
      acknowledged: false,
      conflictFingerprint: null,
    }));
  };

  const patchClosure = (
    patch: Partial<typeof closure>,
  ) => {
    setClosure((value) => ({
      ...value,
      ...patch,
      acknowledged: false,
      conflictFingerprint: null,
    }));
  };

  return (
    <div className="space-y-7">
      {message && (
        <p
          className="border-l-2 border-[#D96F9E] bg-[#F5F3F2] px-3 py-2 text-sm"
          role="status"
        >
          {message}
        </p>
      )}

      <section aria-labelledby="weekly-title">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="weekly-title" className="text-lg font-semibold">
              每周营业时间
            </h2>
            <p className="text-sm text-[#6E6968]">Australia/Melbourne</p>
          </div>
          <Button
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  updateWeeklyHours(
                    weekly,
                    weeklyAcknowledged && weeklyConflictFingerprint
                      ? { fingerprint: weeklyConflictFingerprint }
                      : undefined,
                  ),
                "每周营业时间已保存",
                (fingerprint) => {
                  setWeeklyAcknowledged(false);
                  setWeeklyConflictFingerprint(fingerprint);
                },
              )
            }
            size="sm"
          >
            保存每周时间
          </Button>
        </div>
        <div className="mt-3 divide-y rounded-lg border bg-white">
          {weekly
            .slice()
            .sort((a, b) => a.weekday - b.weekday)
            .map((day) => (
              <div
                className="grid items-center gap-3 p-3 sm:grid-cols-[4rem_1fr_1fr_auto]"
                data-weekday-row
                key={day.weekday}
              >
                <span className="font-medium">{WEEKDAYS[day.weekday]}</span>
                <input
                  aria-label={`${WEEKDAYS[day.weekday]}开门`}
                  className="h-9 rounded-md border px-2 font-sans"
                  disabled={day.isClosed}
                  onChange={(event) =>
                    patchDay(day.weekday, { opensAt: event.target.value })
                  }
                  type="time"
                  value={day.opensAt}
                />
                <input
                  aria-label={`${WEEKDAYS[day.weekday]}关门`}
                  className="h-9 rounded-md border px-2 font-sans"
                  disabled={day.isClosed}
                  onChange={(event) =>
                    patchDay(day.weekday, { closesAt: event.target.value })
                  }
                  type="time"
                  value={day.closesAt}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    checked={day.isClosed}
                    onChange={(event) =>
                      patchDay(day.weekday, { isClosed: event.target.checked })
                    }
                    type="checkbox"
                  />
                  闭店
                </label>
              </div>
            ))}
        </div>
        <label className="mt-3 flex gap-2 text-sm text-[#6E6968]">
          <input
            aria-label="已核对未来预约"
            checked={weeklyAcknowledged}
            disabled={!weeklyConflictFingerprint}
            onChange={(event) =>
              setWeeklyAcknowledged(event.target.checked)
            }
            type="checkbox"
          />
          看到冲突预约后重新核对并确认保存（不会修改预约）
        </label>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <form
          className="rounded-lg border bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () =>
                saveSpecialHours({
                  date: special.date,
                  opensAt: special.isClosed ? null : special.opensAt,
                  closesAt: special.isClosed ? null : special.closesAt,
                  isClosed: special.isClosed,
                  note: special.note || null,
                  acknowledgement:
                    special.acknowledged && special.conflictFingerprint
                      ? { fingerprint: special.conflictFingerprint }
                      : undefined,
                }),
              special.isClosed ? "全天特别闭店已保存" : "特别营业时间已保存",
              (fingerprint) =>
                setSpecial((value) => ({
                  ...value,
                  acknowledged: false,
                  conflictFingerprint: fingerprint,
                })),
            );
          }}
        >
          <h2 className="text-lg font-semibold">特别营业时间 / 全天特别闭店</h2>
          <div className="mt-3 grid gap-3">
            <input
              aria-label="特别安排日期"
              className="h-9 rounded-md border px-2"
              onChange={(event) => patchSpecial({ date: event.target.value })}
              required
              type="date"
              value={special.date}
            />
            <label className="flex gap-2 text-sm">
              <input
                checked={special.isClosed}
                onChange={(event) => patchSpecial({ isClosed: event.target.checked })}
                type="checkbox"
              />
              全天特别闭店
            </label>
            {!special.isClosed && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label="特别开门"
                  className="h-9 rounded-md border px-2"
                  onChange={(event) => patchSpecial({ opensAt: event.target.value })}
                  type="time"
                  value={special.opensAt}
                />
                <input
                  aria-label="特别关门"
                  className="h-9 rounded-md border px-2"
                  onChange={(event) => patchSpecial({ closesAt: event.target.value })}
                  type="time"
                  value={special.closesAt}
                />
              </div>
            )}
            <label className="flex gap-2 text-sm text-[#6E6968]">
              <input
                checked={special.acknowledged}
                disabled={!special.conflictFingerprint}
                onChange={(event) =>
                  setSpecial((value) => ({
                    ...value,
                    acknowledged: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              看到冲突预约后重新核对并确认保存（不会修改预约）
            </label>
            <Button disabled={busy} size="sm" type="submit">
              保存特别安排
            </Button>
          </div>
        </form>

        <form
          className="rounded-lg border bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () =>
                createStudioClosure({
                  date: closure.date,
                  startTime: closure.startTime,
                  endTime: closure.endTime,
                  note: closure.note || null,
                  acknowledgement:
                    closure.acknowledged && closure.conflictFingerprint
                      ? { fingerprint: closure.conflictFingerprint }
                      : undefined,
                }),
              "部分时段闭店已保存",
              (fingerprint) =>
                setClosure((value) => ({
                  ...value,
                  acknowledged: false,
                  conflictFingerprint: fingerprint,
                })),
            );
          }}
        >
          <h2 className="text-lg font-semibold">部分时段闭店</h2>
          <div className="mt-3 grid gap-3">
            <input
              aria-label="部分闭店日期"
              className="h-9 rounded-md border px-2"
              onChange={(event) => patchClosure({ date: event.target.value })}
              required
              type="date"
              value={closure.date}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                aria-label="部分闭店开始"
                className="h-9 rounded-md border px-2"
                  onChange={(event) => patchClosure({ startTime: event.target.value })}
                type="time"
                value={closure.startTime}
              />
              <input
                aria-label="部分闭店结束"
                className="h-9 rounded-md border px-2"
                  onChange={(event) => patchClosure({ endTime: event.target.value })}
                type="time"
                value={closure.endTime}
              />
            </div>
            <label className="flex gap-2 text-sm text-[#6E6968]">
              <input
                checked={closure.acknowledged}
                disabled={!closure.conflictFingerprint}
                onChange={(event) =>
                  setClosure((value) => ({
                    ...value,
                    acknowledged: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              看到冲突预约后重新核对并确认保存（不会修改预约）
            </label>
            <Button disabled={busy} size="sm" type="submit">
              添加闭店时段
            </Button>
          </div>
        </form>
      </section>

      {schedule.closures.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">已登记闭店时段</h2>
          <ul className="mt-2 divide-y rounded-lg border bg-white">
            {schedule.closures.map((item) => (
              <li className="flex items-center justify-between gap-3 p-3" key={item.id}>
                <span className="font-sans text-sm">
                  {item.date} · {item.startTime ?? "全天"}{item.endTime ? `–${item.endTime}` : ""}
                </span>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => deleteStudioClosure(item.id),
                      "闭店时段已删除",
                    )
                  }
                  size="sm"
                  variant="outline"
                >
                  删除
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">公开申请开关</h2>
        <p className="mt-1 text-sm text-[#6E6968]">
          实际可用必须同时满足数据库开关与部署硬门；产品销售本阶段保持关闭。
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-[#F5F3F2] text-[#6E6968]">
              <tr>
                <th className="px-3 py-2">申请类型</th>
                <th className="px-3 py-2">数据库开关</th>
                <th className="px-3 py-2">部署硬门</th>
                <th className="px-3 py-2">实际可用</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(["experience", "party", "product"] as const).map((key) => (
                <tr key={key}>
                  <th className="px-3 py-2 font-medium">
                    {key === "experience"
                      ? "普通体验"
                      : key === "party"
                        ? "派对"
                        : "产品销售"}
                  </th>
                  <td className="px-3 py-2">
                    <input
                      checked={schedule.requestSwitches.database[key]}
                      disabled={busy || key === "product"}
                      name={`switch-${key}`}
                      onChange={(event) =>
                        void run(
                          () =>
                            updateRequestSwitches({
                              [key]: event.target.checked,
                            }),
                          "数据库开关已更新",
                        )
                      }
                      type="checkbox"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {schedule.requestSwitches.deploymentHardGate[key]
                      ? "已打开"
                      : "已关闭"}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {schedule.requestSwitches.effective[key]
                      ? "可用"
                      : "不可用"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
