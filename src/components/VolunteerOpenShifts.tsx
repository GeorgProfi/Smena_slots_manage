"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

type AvailableShift = {
  id: string;
  eventId: string;
  eventTitle: string;
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

function formatDateRu(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}.${m}.${y}`;
}

function slotLabel(shift: AvailableShift): string {
  return `${shift.startTime}–${shift.endTime}`;
}

type Props = {
  availableByEvent: EventGroup[];
  isOverlapping: (shift: AvailableShift) => boolean;
  onTakeSlots: (shiftIds: string[]) => Promise<void>;
  taking: boolean;
};

export default function VolunteerOpenShifts({
  availableByEvent,
  isOverlapping,
  onTakeSlots,
  taking,
}: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedByEvent, setSelectedByEvent] = useState<Record<string, Set<string>>>({});

  const datesWithShifts = useMemo(() => {
    const set = new Set<string>();
    availableByEvent.forEach((evt) => {
      evt.subShifts.forEach((s) => {
        if (s.date) set.add(s.date);
      });
    });
    return set;
  }, [availableByEvent]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const eventsOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return availableByEvent
      .map((evt) => ({
        ...evt,
        subShifts: evt.subShifts.filter((s) => s.date === selectedDate),
      }))
      .filter((evt) => evt.subShifts.length > 0);
  }, [availableByEvent, selectedDate]);

  const toggleSlot = (eventId: string, shift: AvailableShift) => {
    if (isOverlapping(shift) || shift.available <= 0) return;
    setSelectedByEvent((prev) => {
      const next = new Set(prev[eventId] ?? []);
      if (next.has(shift.id)) next.delete(shift.id);
      else next.add(shift.id);
      return { ...prev, [eventId]: next };
    });
  };

  const handleTake = async (eventId: string) => {
    const ids = Array.from(selectedByEvent[eventId] ?? []);
    if (!ids.length) return;
    await onTakeSlots(ids);
    setSelectedByEvent((prev) => {
      const copy = { ...prev };
      delete copy[eventId];
      return copy;
    });
  };

  if (availableByEvent.length === 0) {
    return <p className="text-slate-500 italic">Сейчас нет свободных смен.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 capitalize">
            {format(currentMonth, "LLLL yyyy", { locale: ru })}
          </h2>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-slate-100"
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-slate-100"
              aria-label="Следующий месяц"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 mb-2">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, currentMonth);
            const hasShifts = datesWithShifts.has(key);
            const isSelected = selectedDate === key;
            return (
              <button
                key={key}
                type="button"
                disabled={!hasShifts}
                onClick={() => setSelectedDate(key)}
                className={`aspect-square rounded-lg text-sm transition-colors ${
                  !inMonth ? "text-slate-300" : "text-slate-900"
                } ${
                  isSelected
                    ? "bg-slate-900 text-white"
                    : hasShifts
                      ? "bg-blue-50 hover:bg-blue-100 font-semibold"
                      : "hover:bg-slate-50"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Смены на {formatDateRu(selectedDate)}
          </p>

          {eventsOnSelectedDate.length === 0 ? (
            <p className="text-slate-500 italic">На эту дату нет свободных слотов.</p>
          ) : (
            eventsOnSelectedDate.map((evt) => {
              const selected = selectedByEvent[evt.id] ?? new Set<string>();
              const canTake = selected.size > 0 && !taking;
              return (
                <div
                  key={evt.id}
                  className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4"
                >
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{evt.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">{formatDateRu(selectedDate)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {evt.subShifts.map((shift) => {
                      const conflict = isOverlapping(shift);
                      const active = selected.has(shift.id);
                      const disabled = conflict || shift.available <= 0;
                      return (
                        <button
                          key={shift.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleSlot(evt.id, shift)}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            disabled
                              ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                              : active
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-300 bg-white text-slate-800 hover:border-slate-400"
                          }`}
                          title={conflict ? "Пересекается с вашей сменой" : undefined}
                        >
                          {slotLabel(shift)}
                          {conflict ? " · занято" : ""}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={!canTake}
                    onClick={() => handleTake(evt.id)}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
                  >
                    {taking ? "Запись…" : "Взять"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {!selectedDate && (
        <p className="text-sm text-slate-500">Выберите дату в календаре, чтобы увидеть точки и слоты.</p>
      )}
    </div>
  );
}