import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Delete, Equal } from 'lucide-react';

interface PosCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PosCalculatorModal({ isOpen, onClose }: PosCalculatorModalProps) {
  const [display, setDisplay] = useState('0');
  const [prevVal, setPrevVal] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const handleDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPrevVal(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const handleBackspace = () => {
    if (display.length === 1 || (display.length === 2 && display.startsWith('-'))) {
      setDisplay('0');
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const handleOperator = (nextOp: string) => {
    const inputValue = parseFloat(display);

    if (prevVal === null) {
      setPrevVal(inputValue);
    } else if (operation) {
      const current = prevVal || 0;
      let result = current;
      if (operation === '+') result = current + inputValue;
      else if (operation === '-') result = current - inputValue;
      else if (operation === '×') result = current * inputValue;
      else if (operation === '÷') result = inputValue !== 0 ? current / inputValue : 0;

      setPrevVal(result);
      setDisplay(String(Number(result.toFixed(6))));
    }

    setWaitingForOperand(true);
    setOperation(nextOp);
  };

  const handleEquals = () => {
    const inputValue = parseFloat(display);
    if (prevVal !== null && operation) {
      let result = prevVal;
      if (operation === '+') result = prevVal + inputValue;
      else if (operation === '-') result = prevVal - inputValue;
      else if (operation === '×') result = prevVal * inputValue;
      else if (operation === '÷') result = inputValue !== 0 ? prevVal / inputValue : 0;

      setDisplay(String(Number(result.toFixed(6))));
      setPrevVal(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-80 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-base">🧮</span>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Calculadora Rápida</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Display */}
        <div className="p-4 bg-slate-100 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-right">
          <div className="h-4 text-[11px] font-bold text-slate-400">
            {prevVal !== null && operation ? `${prevVal} ${operation}` : ''}
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight overflow-x-auto">
            {display}
          </div>
        </div>

        {/* Buttons Grid */}
        <div className="grid grid-cols-4 gap-1.5 p-3 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={handleClear}
            className="h-12 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-black text-sm transition-colors"
          >
            C
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-sm flex items-center justify-center transition-colors"
          >
            <Delete size={18} />
          </button>
          <button
            type="button"
            onClick={() => handleOperator('÷')}
            className={`h-12 rounded-xl font-black text-sm transition-colors ${
              operation === '÷' ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400'
            }`}
          >
            ÷
          </button>
          <button
            type="button"
            onClick={() => handleOperator('×')}
            className={`h-12 rounded-xl font-black text-sm transition-colors ${
              operation === '×' ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400'
            }`}
          >
            ×
          </button>

          <button
            type="button"
            onClick={() => handleDigit('7')}
            className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 font-bold text-base transition-colors"
          >
            7
          </button>
          <button
            type="button"
            onClick={() => handleDigit('8')}
            className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 font-bold text-base transition-colors"
          >
            8
          </button>
          <button
            type="button"
            onClick={() => handleDigit('9')}
            className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 font-bold text-base transition-colors"
          >
            9
          </button>
          <button
            type="button"
            onClick={() => handleOperator('-')}
            className={`h-12 rounded-xl font-black text-sm transition-colors ${
              operation === '-' ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400'
            }`}
          >
            −
          </button>

          <button
            type="button"
            onClick={() => handleDigit('4')}
            className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 font-bold text-base transition-colors"
          >
            4
          </button>
          <button
            type="button"
            onClick={() => handleDigit('5')}
            className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 font-bold text-base transition-colors"
          >
            5
          </button>
          <button
            type="button"
            onClick={() => handleDigit('6')}
            className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 font-bold text-base transition-colors"
          >
            6
          </button>
          <button
            type="button"
            onClick={() => handleOperator('+')}
            className={`h-12 rounded-xl font-black text-sm transition-colors ${
              operation === '+' ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400'
            }`}
          >
            +
          </button>

          <button
            type="button"
            onClick={() => handleDigit('1')}
            className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 font-bold text-base transition-colors"
          >
            1
          </button>
          <button
            type="button"
            onClick={() => handleDigit('2')}
            className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 font-bold text-base transition-colors"
          >
            2
          </button>
          <button
            type="button"
            onClick={() => handleDigit('3')}
            className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 font-bold text-base transition-colors"
          >
            3
          </button>
          <button
            type="button"
            onClick={handleEquals}
            className="row-span-2 h-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base flex items-center justify-center shadow-md transition-colors"
          >
            <Equal size={20} />
          </button>

          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="col-span-2 h-12 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 font-bold text-base transition-colors"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDecimal}
            className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 font-bold text-base transition-colors"
          >
            .
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
