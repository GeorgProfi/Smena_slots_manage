"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, ArrowRightLeft, CheckCircle, Link as LinkIcon, Copy, X, AlertCircle, Check, Trash2 } from "lucide-react";
import VolunteerOpenShifts from "@/components/VolunteerOpenShifts";

type AvailableShift = {
  id: string;
  eventTitle: string;
  eventId: string;
  role: string;
  date: string;
  startTime: string;
  endTime: string;
  startISO: string;
  endISO: string;
  location?: string;
  spotsFilled: number;
  capacity: number;
  available: number;
};

type EventGroup = {
  id: string;
  title: string;
  location?: string;
  start_time?: string;
  end_time?: string;
  subShifts: AvailableShift[];
};

type MyShift = {
  id: string;
  assignmentId: string;
  eventId: string;
  eventTitle: string;
  role: string;
  date: string;
  startTime: string;
  endTime: string;
  startISO: string;
  endISO: string;
  location?: string;
  status: "confirmed" | "pending_swap";
};

type SwapRequest = {
  id: string;
  status: "open" | "accepted";
  created_at: string;
  share_token: string;
  event_id?: string;
  requester_id?: string;
  is_mine?: boolean;
  role_name: string;
  start_time: string;
  end_time: string;
  event_title: string;
  event_location: string | null;
  share_link: string;
};

type VolunteerShiftListProps = {
  activeTab: "my-shifts" | "open-shifts";
};

export default function VolunteerShiftList({ activeTab }: VolunteerShiftListProps) {
  const [availableByEvent, setAvailableByEvent] = useState<EventGroup[]>([]);
  const [myShifts, setMyShifts] = useState<MyShift[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSwap, setCopiedSwap] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [takingSlots, setTakingSlots] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsRes, assignmentsRes, swapsRes] = await Promise.all([
        fetch("/api/events"),
        fetch("/api/volunteer/assignments"),
        fetch("/api/volunteer/swap-requests"),
      ]);
        // Build available shifts from events and group by event
        let shifts: AvailableShift[] = [];
        let grouped: Record<string, EventGroup> = {};
        if (eventsRes.ok) {
          const data = await eventsRes.json();
          data.forEach((evt: any) => {
            (evt.sub_shifts ?? []).forEach((s: any, idx: number) => {
              const start = s.start_time ?? evt.start_time;
              const end = s.end_time ?? evt.end_time;
              shifts.push({
                id: s.id || `${evt.id}-${idx}`,
                eventId: evt.id,
                eventTitle: evt.title,
                role: s.role_name,
                date: start?.slice(0, 10),
                startTime: start?.slice(11, 16),
                endTime: end?.slice(11, 16),
                startISO: start,
                endISO: end,
                location: evt.location,
                spotsFilled: s.filled ?? 0,
                capacity: s.capacity ?? 0,
                available: Math.max((s.available ?? ((s.capacity ?? 0) - (s.filled ?? 0))), 0),
              });
            });
          });
        }

        // Map my assignments and filter available shifts to hide already accepted sub_shifts
        if (assignmentsRes.ok) {
          const my = await assignmentsRes.json();
          const mapped: MyShift[] = my.map((row: any) => {
            // API returns flat fields; fallback to nested if present
            const sub = row.sub_shifts;
            const evtNested = Array.isArray(sub?.events) ? sub.events[0] : sub?.events;
            const start = row.start_time ?? sub?.start_time ?? evtNested?.start_time;
            const end = row.end_time ?? sub?.end_time ?? evtNested?.end_time;
            const eventId = row.event_id ?? sub?.event_id ?? evtNested?.id;
            const eventTitle = row.event_title ?? evtNested?.title;
            const eventLocation = row.event_location ?? evtNested?.location;
            const roleName = row.role_name ?? sub?.role_name;

            return {
              id: row.sub_shift_id ?? row.id,
              assignmentId: row.id,
              eventId,
              eventTitle,
              role: roleName,
              date: start?.slice(0, 10),
              startTime: start?.slice(11, 16),
              endTime: end?.slice(11, 16),
              startISO: start,
              endISO: end,
              location: eventLocation,
              status: row.status,
            };
          });
          setMyShifts(mapped);
          const mySubShiftIds = new Set(mapped.map((m) => m.id));
          const filtered = shifts.filter((s) => s.available > 0 && !mySubShiftIds.has(s.id));

          // regroup filtered shifts by event
          const groupedEvents: Record<string, EventGroup> = {};
          filtered.forEach((s) => {
            if (!groupedEvents[s.eventId]) {
              groupedEvents[s.eventId] = {
                id: s.eventId,
                title: s.eventTitle,
                location: s.location,
                start_time: s.startISO,
                end_time: s.endISO,
                subShifts: [],
              };
            }
            groupedEvents[s.eventId].subShifts.push(s);
          });

          // sort subshifts by start time, then by end time
          Object.values(groupedEvents).forEach((g) => {
            g.subShifts.sort((a, b) => {
              const aStart = a.startISO || "";
              const bStart = b.startISO || "";
              const startCompare = aStart.localeCompare(bStart);
              if (startCompare !== 0) return startCompare;
              const aEnd = a.endISO || "";
              const bEnd = b.endISO || "";
              return aEnd.localeCompare(bEnd);
            });
          });

          setAvailableByEvent(Object.values(groupedEvents));
        } else {
          // Fallback: if assignments failed to load, just set computed available shifts
          const filtered = shifts.filter((s) => s.available > 0);
          const groupedEvents: Record<string, EventGroup> = {};
          filtered.forEach((s) => {
            if (!groupedEvents[s.eventId]) {
              groupedEvents[s.eventId] = {
                id: s.eventId,
                title: s.eventTitle,
                location: s.location,
                start_time: s.startISO,
                end_time: s.endISO,
                subShifts: [],
              };
            }
            groupedEvents[s.eventId].subShifts.push(s);
          });
          Object.values(groupedEvents).forEach((g) => {
            g.subShifts.sort((a, b) => {
              const aStart = a.startISO || "";
              const bStart = b.startISO || "";
              const startCompare = aStart.localeCompare(bStart);
              if (startCompare !== 0) return startCompare;
              const aEnd = a.endISO || "";
              const bEnd = b.endISO || "";
              return aEnd.localeCompare(bEnd);
            });
          });
          setAvailableByEvent(Object.values(groupedEvents));
        }

        if (swapsRes.ok) {
          const swaps = await swapsRes.json();
          setSwapRequests(swaps);
        }
    } finally {
      setLoading(false);
    }
  };

  // Determine if an available shift overlaps with any of the user's current shifts
  const isOverlapping = (shift: AvailableShift) => {
    const aStart = shift.startISO ? new Date(shift.startISO).getTime() : NaN;
    const aEnd = shift.endISO ? new Date(shift.endISO).getTime() : NaN;
    if (!Number.isFinite(aStart) || !Number.isFinite(aEnd)) return false;
    return myShifts.some((ms) => {
      if (ms.status !== "confirmed" && ms.status !== "pending_swap") return false;
      const bStart = ms.startISO ? new Date(ms.startISO).getTime() : NaN;
      const bEnd = ms.endISO ? new Date(ms.endISO).getTime() : NaN;
      if (!Number.isFinite(bStart) || !Number.isFinite(bEnd)) return false;
      // Overlap if times intersect
      return aStart < bEnd && bStart < aEnd;
    });
  };

  const showFeedback = (message: string, type: "success" | "error") => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleTakeSlots = async (shiftIds: string[]) => {
    if (!shiftIds.length || takingSlots) return;
    setTakingSlots(true);
    try {
      for (const shiftId of shiftIds) {
        const res = await fetch("/api/volunteer/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sub_shift_id: shiftId }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "Не удалось записаться" }));
          showFeedback(error ?? "Не удалось записаться на одну из смен.", "error");
          await loadData();
          return;
        }
      }
      await loadData();
      showFeedback(
        shiftIds.length === 1
          ? "Вы записаны на выбранную смену."
          : `Записано смен: ${shiftIds.length}.`,
        "success"
      );
    } finally {
      setTakingSlots(false);
    }
  };

  const handleSwapRequest = async (assignmentId: string) => {
    try {
      const res = await fetch("/api/volunteer/swap-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignmentId }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Не удалось создать заявку" }));
        showFeedback(error ?? "Не удалось создать заявку на замену", "error");
        return;
      }

      const { share_link } = await res.json();

      // Reload data to get updated status from server
      await loadData();

      showFeedback("Заявка создана. Скопируйте ссылку и отправьте её.", "success");
    } catch (e) {
      showFeedback("Не удалось создать заявку на замену", "error");
    }
  };

  const copySwapLink = (link: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}${link}`);
    setCopiedSwap(id);
    setTimeout(() => setCopiedSwap(null), 2000);
  };

  const cancelSwapRequest = async (id: string) => {
    try {
      const res = await fetch("/api/volunteer/swap-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to cancel");
      
      // Reload data to get updated status from server
      await loadData();
      showFeedback("Заявка на замену отменена", "success");
    } catch (e: any) {
      showFeedback("Не удалось отменить заявку", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  const mySwapRequests = swapRequests.filter((r) => r.is_mine);

  return (
    <div className="space-y-8">
      {feedback && (
        <div
          className={`fixed top-6 right-6 z-50 rounded-lg px-4 py-3 shadow-lg border text-sm font-medium ${
            feedback.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {feedback.message}
        </div>
      )}
      {activeTab === "my-shifts" && (
        <>
          {/* My Schedule Section */}
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Моё расписание
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myShifts.length === 0 ? (
                <p className="text-slate-500 italic col-span-full">
                  У вас нет предстоящих смен.
                </p>
              ) : (
                myShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm relative overflow-hidden"
                  >
                    {shift.status === "pending_swap" && (
                      <div className="absolute top-0 right-0 bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-bl-lg">
                        Запрошена замена
                      </div>
                    )}
                    <div className="mb-3">
                      <h3 className="font-semibold text-lg text-slate-900">
                        {shift.eventTitle}
                      </h3>
                      <p className="text-blue-600 font-medium">{shift.role}</p>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600 mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{shift.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>
                          {shift.startTime} - {shift.endTime}
                        </span>
                      </div>
                    </div>
                    {shift.status === "confirmed" && (
                      <button
                        onClick={() => handleSwapRequest(shift.assignmentId)}
                        className="w-full flex items-center justify-center gap-2 border border-slate-300 rounded-lg py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                        Запросить замену
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Swap Requests Section */}
          {mySwapRequests.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-amber-600" />
                Мои заявки на замену
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mySwapRequests.map((req) => {
                  const accepted = req.status === "accepted";
                  return (
                  <div
                    key={req.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm relative overflow-hidden"
                  >
                    {req.status === "open" && (
                      <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-bl-lg">
                        Открыта
                      </div>
                    )}
                    {req.status === "accepted" && (
                      <div className="absolute top-0 right-0 bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-bl-lg">
                        Принята
                      </div>
                    )}
                    <div className="mb-3">
                      <h3 className="font-semibold text-lg text-slate-900">
                        {req.event_title}
                      </h3>
                      <p className="text-blue-600 font-medium">{req.role_name}</p>
                    </div>

                    <div className="space-y-2 text-sm text-slate-600 mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{req.start_time?.slice(0, 10)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>
                          {req.start_time?.slice(11, 16)} - {req.end_time?.slice(11, 16)}
                        </span>
                      </div>
                    </div>

                    {req.status === "open" && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 bg-slate-100 rounded p-2">
                          <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}${req.share_link}`}
                            className="flex-1 bg-transparent text-sm text-slate-600 outline-none"
                          />
                          <button
                            onClick={() => copySwapLink(req.share_link, req.id)}
                            className="p-1 hover:bg-slate-200 rounded transition-colors"
                          >
                            {copiedSwap === req.id ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4 text-slate-600" />
                            )}
                          </button>
                        </div>

                        <button
                          onClick={() => cancelSwapRequest(req.id)}
                          className="w-full text-sm px-3 py-2 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Отменить заявку
                        </button>
                      </div>
                    )}

                    {req.status === "accepted" && (
                      <div className="text-sm text-green-800 font-semibold">✓ Замена принята</div>
                    )}
                  </div>
                );})}
              </div>
            </section>
          )}
        </>
      )}

      {activeTab === "open-shifts" && (
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Свободные смены</h2>
          <VolunteerOpenShifts
            availableByEvent={availableByEvent}
            isOverlapping={isOverlapping}
            onTakeSlots={handleTakeSlots}
            taking={takingSlots}
          />
        </section>
      )}
    </div>
  );
}
