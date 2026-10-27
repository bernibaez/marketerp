import React from 'react';
import { Calendar } from 'lucide-react';

interface ComboValidityCardProps {
  formId: string;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  startTime: string;
  setStartTime: (val: string) => void;
  endTime: string;
  setEndTime: (val: string) => void;
}

export const ComboValidityCard: React.FC<ComboValidityCardProps> = ({
  formId,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
}) => {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Calendar size={18} className="text-primary" />
        <h3 className="font-semibold text-foreground">5. Vigencia y Horario</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label htmlFor={`${formId}-start-date`} className="text-xs font-bold text-muted-foreground mb-1 block">
            Fecha Inicio
          </label>
          <input
            id={`${formId}-start-date`}
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input-field text-xs font-semibold"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-end-date`} className="text-xs font-bold text-muted-foreground mb-1 block">
            Fecha Fin
          </label>
          <input
            id={`${formId}-end-date`}
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input-field text-xs font-semibold"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-start-time`} className="text-xs font-bold text-muted-foreground mb-1 block">
            Hora Inicio
          </label>
          <input
            id={`${formId}-start-time`}
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="input-field text-xs font-semibold"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-end-time`} className="text-xs font-bold text-muted-foreground mb-1 block">
            Hora Fin
          </label>
          <input
            id={`${formId}-end-time`}
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="input-field text-xs font-semibold"
          />
        </div>
      </div>
    </div>
  );
};
