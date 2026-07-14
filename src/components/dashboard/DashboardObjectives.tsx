'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { TrendingUp, Target, Zap, Trophy, Info, Edit3 } from "lucide-react";

interface DashboardObjectivesProps {
  currentTotal: number;
  targets: { target1: number; target2: number; target3: number } | null;
  dolarBlue: number | null;
  isAdmin: boolean;
  periodLabel: string;
  todaySold?: number;
  weekSold?: number;
}

// Helper functions for business days calculation
function countBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const curDate = new Date(startDate.getTime());
  curDate.setHours(0, 0, 0, 0);
  const normalizedEnd = new Date(endDate.getTime());
  normalizedEnd.setHours(0, 0, 0, 0);

  while (curDate <= normalizedEnd) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 is Sunday, 6 is Saturday
      count++;
    }
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
}

function getPeriodMonthAndYear(periodLabel: string): { year: number; month: number; isCurrent: boolean; day: number } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentDay = now.getDate();

  if (!periodLabel || periodLabel === 'Este Mes') {
    return { year: currentYear, month: currentMonth, isCurrent: true, day: currentDay };
  }

  if (periodLabel === 'Mes Anterior') {
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastDayOfPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
    return {
      year: prevMonthDate.getFullYear(),
      month: prevMonthDate.getMonth(),
      isCurrent: false,
      day: lastDayOfPrevMonth
    };
  }

  // Handle case where it might be a date range string or format like "YYYY-MM-DD"
  const rangeMatch = periodLabel.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (rangeMatch) {
    const year = parseInt(rangeMatch[1], 10);
    const month = parseInt(rangeMatch[2], 10) - 1; // 0-indexed
    const isCurrent = (year === currentYear && month === currentMonth);
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      year,
      month,
      isCurrent,
      day: isCurrent ? currentDay : lastDay
    };
  }

  return { year: currentYear, month: currentMonth, isCurrent: true, day: currentDay };
}

export default function DashboardObjectives({
  currentTotal,
  targets,
  dolarBlue,
  isAdmin,
  periodLabel,
  todaySold = 0,
  weekSold = 0
}: DashboardObjectivesProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Los targets llegan del server ya resueltos en ARS (configurados en USD
  // y convertidos con el blue del día). Fallback ARS por si no hay datos.
  const t1 = targets?.target1 || 18000000;
  const t2 = targets?.target2 || 24000000;
  const t3 = targets?.target3 || 30000000;

  const progress1 = t1 > 0 ? Math.min((currentTotal / t1) * 100, 100) : 0;
  const progress2 = t2 > 0 ? Math.min((currentTotal / t2) * 100, 100) : 0;
  const progress3 = t3 > 0 ? Math.min((currentTotal / t3) * 100, 100) : 0;

  const toUSD = (ars: number) => (dolarBlue && ars) ? (ars / dolarBlue) : null;

  // Pace / Projection Logic using Business Days
  const { year, month, isCurrent, day } = getPeriodMonthAndYear(periodLabel);
  const totalBusinessDays = countBusinessDays(
    new Date(year, month, 1),
    new Date(year, month + 1, 0)
  );
  const elapsedBusinessDays = isCurrent
    ? Math.max(countBusinessDays(new Date(year, month, 1), new Date(year, month, day)), 1)
    : totalBusinessDays;
  const remainingBusinessDays = Math.max(totalBusinessDays - elapsedBusinessDays, 0);

  const paceTotal = (currentTotal / elapsedBusinessDays) * totalBusinessDays;
  const expectedPacePct = (elapsedBusinessDays / totalBusinessDays) * 100;
  const paceStatus = paceTotal >= t1 ? 'EXCELENTE' : paceTotal >= (t1 * 0.8) ? 'EN CAMINO' : 'CONSTRUYENDO';

  const getDailyRequired = (target: number) => {
    const remaining = target - currentTotal;
    if (remaining <= 0) return 0;
    return remaining / Math.max(remainingBusinessDays, 1);
  };

  const formatCurrency = (val: number) => val.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

  if (!isMounted) return <div className="h-[400px] bg-stone-900 rounded-[2.5rem] animate-pulse" />;

  return (
    <section className="bg-gradient-to-b from-[#141211] to-[#0a0908] rounded-[2.5rem] p-6 lg:p-10 shadow-2xl relative overflow-hidden text-white border border-[#2c2724]">
      {/* Cinematic ambient background glow flares */}
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-gradient-to-br from-[#c2a38a]/15 via-transparent to-transparent rounded-full blur-[140px] opacity-70 pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-[450px] h-[450px] bg-gradient-to-tr from-blue-500/10 via-transparent to-transparent rounded-full blur-[100px] opacity-40 pointer-events-none" />
      
      <div className="relative z-10">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#c2a38a] rounded-full animate-pulse shadow-[0_0_8px_#c2a38a]" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-500">Objetivos Estratégicos</h2>
            </div>
            <p className="text-2xl lg:text-3xl font-black tracking-tight italic">
              Rendimiento <span className="text-[#c2a38a] not-italic">{periodLabel}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {isAdmin && dolarBlue && (
              <div className="bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 hover:border-white/20 flex flex-col shadow-inner">
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-400">Dólar Blue Venta</span>
                <span className="text-xl font-black text-emerald-400 leading-none mt-1 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">${dolarBlue.toLocaleString()}</span>
              </div>
            )}
            <div className="bg-[#c2a38a]/10 backdrop-blur-xl px-5 py-3 rounded-2xl border border-[#c2a38a]/20 flex flex-col shadow-inner">
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#c2a38a]/85">Días Hábiles Restantes</span>
              <span className="text-xl font-black text-white leading-none mt-1">{remainingBusinessDays} <span className="text-xs font-bold text-white/40">/ {totalBusinessDays}</span></span>
            </div>
            {isAdmin && (
              <Link
                href="/admin/configuracion/objetivos"
                className="bg-white/5 hover:bg-white/10 transition-all duration-300 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 flex items-center gap-2 font-bold hover:scale-102"
              >
                <Edit3 className="w-4 h-4 text-[#c2a38a]" />
                <span className="text-xs font-black uppercase tracking-widest text-white">Editar</span>
              </Link>
            )}
          </div>
        </div>

        {/* Command Center / Projection Bar - Only for Admin */}
        {isAdmin && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 p-8 bg-[#181514]/60 rounded-3.5xl border border-[#c2a38a]/10 backdrop-blur-2xl relative overflow-hidden shadow-inner"
          >
            {/* Glowing separator header bar */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#c2a38a]/45 to-transparent" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Proyección de Cierre</p>
                <p className="text-3xl font-black tracking-tighter text-white">
                  {formatCurrency(paceTotal)}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${paceTotal >= t1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {paceTotal >= t1 ? '▲ Sobre Meta' : '▼ Bajo Meta'}
                  </span>
                  <span className="text-[10px] text-stone-400 font-bold">vs Objetivo Base</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Estado de Ritmo</p>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${paceTotal >= t1 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <p className="text-xl lg:text-2xl font-black italic tracking-tighter uppercase">
                    {paceStatus}
                  </p>
                </div>
                <p className="text-[10px] text-stone-400 font-medium leading-tight">
                  {paceTotal >= t1 ? 'Continuar así garantiza superar los objetivos.' : 'Se requiere un impulso adicional para alcanzar la meta.'}
                </p>
              </div>

              <div className="lg:col-span-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white/10 rounded-lg shrink-0">
                    <Info className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-xs font-medium text-stone-300 leading-relaxed italic">
                    {paceTotal >= t3 ? '🚀 NIVEL ELITE: Mantengan este ritmo y pulverizarán todos los récords.' :
                     paceTotal >= t2 ? '⭐ EXCELENTE: Están en camino de superar el Objetivo Stretch.' :
                     paceTotal >= t1 ? '✅ CUMPLIENDO: Van por buen camino para el objetivo del mes.' :
                     '💪 MOTIVACIÓN: "Dejarse dominar por los pequeños anhelos que resultan fuertes". ¡Cada venta suma!'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Goals Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Base Goal */}
          <ObjectiveCard 
            title="Base" 
            subtitle="Objetivo Mínimo"
            target={t1} 
            progress={progress1} 
            current={currentTotal} 
            dolar={toUSD(t1)}
            daily={getDailyRequired(t1)}
            icon={Target}
            color="base"
            expected={expectedPacePct}
            isAdmin={isAdmin}
            totalBusinessDays={totalBusinessDays}
            elapsedBusinessDays={elapsedBusinessDays}
            todaySold={todaySold}
            weekSold={weekSold}
          />

          {/* Stretch Goal */}
          <ObjectiveCard 
            title="Stretch" 
            subtitle="Expansión"
            target={t2} 
            progress={progress2} 
            current={currentTotal} 
            dolar={toUSD(t2)}
            daily={getDailyRequired(t2)}
            icon={Zap}
            color="stretch"
            expected={expectedPacePct}
            isAdmin={isAdmin}
            totalBusinessDays={totalBusinessDays}
            elapsedBusinessDays={elapsedBusinessDays}
            todaySold={todaySold}
            weekSold={weekSold}
          />

          {/* Elite Goal */}
          <ObjectiveCard 
            title="Elite" 
            subtitle="Dominio"
            target={t3} 
            progress={progress3} 
            current={currentTotal} 
            dolar={toUSD(t3)}
            daily={getDailyRequired(t3)}
            icon={Trophy}
            color="elite"
            expected={expectedPacePct}
            isAdmin={isAdmin}
            isElite
            totalBusinessDays={totalBusinessDays}
            elapsedBusinessDays={elapsedBusinessDays}
            todaySold={todaySold}
            weekSold={weekSold}
          />
        </div>
      </div>

    </section>
  );
}

function ObjectiveCard({ 
  title, 
  subtitle, 
  target, 
  progress, 
  current, 
  dolar, 
  daily, 
  icon: Icon, 
  color, 
  expected, 
  isAdmin, 
  isElite,
  totalBusinessDays,
  elapsedBusinessDays,
  todaySold,
  weekSold
}: any) {
  const isAhead = progress >= expected;
  
  const colorClasses: any = {
    base: 'bg-gradient-to-r from-[#c2a38a] to-[#a38067] shadow-[0_0_15px_rgba(194,163,138,0.35)]',
    stretch: 'bg-gradient-to-r from-[#d4bca6] to-[#bfa08a] shadow-[0_0_15px_rgba(212,188,166,0.35)]',
    elite: 'bg-gradient-to-r from-[#c2a38a] via-[#e8dccf] to-[#d4bca6] bg-[length:200%_auto] animate-shimmer shadow-[0_0_20px_rgba(232,220,207,0.45)]'
  };

  const borderClasses: any = {
    base: 'border-stone-850 hover:border-[#c2a38a]/40',
    stretch: 'border-stone-850 hover:border-[#d4bca6]/40',
    elite: 'border-[#c2a38a]/20 hover:border-[#e8dccf]/40'
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  const dailyTarget = target / totalBusinessDays;
  const weeklyTarget = dailyTarget * 5;

  return (
    <motion.div 
      whileHover={{ y: -6 }}
      onMouseMove={handleMouseMove}
      className={`relative p-8 rounded-[2.2rem] bg-white/[0.02] dark:bg-[#12100f]/40 border ${borderClasses[color]} transition-all duration-500 shadow-lg hover:shadow-2xl group overflow-hidden`}
    >
      {/* Cinematic aura background glow */}
      <div 
        className="pointer-events-none absolute -inset-px rounded-[2.2rem] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(450px circle at var(--mouse-x) var(--mouse-y), ${
            color === 'elite' 
              ? 'rgba(232,220,207,0.06)' 
              : color === 'stretch' 
                ? 'rgba(212,188,166,0.05)' 
                : 'rgba(194,163,138,0.05)'
          }, transparent 50%)`
        }}
      />

      {/* Background Icon */}
      <Icon className={`absolute -right-4 -bottom-4 w-32 h-32 opacity-[0.025] group-hover:opacity-[0.065] transition-opacity duration-500 -rotate-12`} />
      
      {/* Card Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-1.5 h-1.5 rounded-full ${color === 'elite' ? 'bg-[#e8dccf] shadow-[0_0_6px_#e8dccf]' : color === 'stretch' ? 'bg-[#d4bca6] shadow-[0_0_6px_#d4bca6]' : 'bg-[#c2a38a] shadow-[0_0_6px_#c2a38a]'}`} />
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-500">{subtitle}</p>
          </div>
          <h3 className={`text-2xl font-black italic tracking-tight ${isElite ? 'text-transparent bg-clip-text bg-gradient-to-r from-[#d4bca6] via-white to-[#d4bca6]' : 'text-white'}`}>
            {title}
          </h3>
        </div>
        <div className={`p-3 rounded-2xl transition-all duration-300 ${color === 'elite' ? 'bg-[#c2a38a]/10 text-[#e8dccf] group-hover:bg-[#c2a38a]/20' : color === 'stretch' ? 'bg-[#d4bca6]/10 text-[#d4bca6] group-hover:bg-[#d4bca6]/20' : 'bg-[#c2a38a]/10 text-[#c2a38a] group-hover:bg-[#c2a38a]/20'}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {/* Main Metric */}
      <div className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-500 mb-1.5">
          {isAdmin ? 'Facturado a la Fecha' : 'Progreso de la Meta'}
        </p>
        <p className={`text-3xl lg:text-4xl font-black tracking-tighter transition-all duration-300 ${progress >= 100 ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.45)]' : 'text-white'}`}>
          {isAdmin ? `$${current.toLocaleString()}` : `${progress.toFixed(1)}%`}
        </p>
        {isAdmin && (
          <p className="text-xs font-bold text-stone-400 mt-1">
            Meta: ${target.toLocaleString()} {dolar ? `(≈ USD ${Math.round(dolar).toLocaleString()})` : ''}
          </p>
        )}
      </div>

      {/* Reference Targets */}
      <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-[#141211]/35 dark:bg-black/25 border border-white/[0.03] rounded-2.5xl backdrop-blur-md">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">Obj. Diario</span>
            <span className="text-[9px] font-bold text-stone-400">{Math.min((todaySold / dailyTarget) * 100, 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden p-[1px]">
            <div className={`h-full rounded-full ${colorClasses[color]}`} style={{ width: `${Math.min((todaySold / dailyTarget) * 100, 100)}%` }} />
          </div>
          {isAdmin && (
            <span className="text-sm font-black text-stone-250 mt-1 block">
              ${Math.round(todaySold).toLocaleString()} <span className="text-[10px] text-stone-500 font-normal">/ ${Math.round(dailyTarget).toLocaleString()}</span>
            </span>
          )}
        </div>
        
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">Obj. Semanal</span>
            <span className="text-[9px] font-bold text-stone-400">{Math.min((weekSold / weeklyTarget) * 100, 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden p-[1px]">
            <div className={`h-full rounded-full ${colorClasses[color]}`} style={{ width: `${Math.min((weekSold / weeklyTarget) * 100, 100)}%` }} />
          </div>
          {isAdmin && (
            <span className="text-sm font-black text-stone-250 mt-1 block">
              ${Math.round(weekSold).toLocaleString()} <span className="text-[10px] text-stone-500 font-normal">/ ${Math.round(weeklyTarget).toLocaleString()}</span>
            </span>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <div className="space-y-3.5 mb-8">
        <div className="flex justify-between items-end">
          <span className={`text-2xl lg:text-3xl font-black tracking-tighter transition-all duration-300 ${progress >= 100 ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.35)]' : isAhead ? 'text-white' : 'text-stone-400'}`}>
            {isAdmin ? `${progress.toFixed(progress >= 100 ? 0 : 1)}%` : 'Avance'}
          </span>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${isAhead ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.25)]' : 'bg-amber-500/20 text-amber-400'}`}>
              {isAhead ? '▲ ADELANTADO' : '▼ ATRASADO'}
            </span>
            <span className="text-[9px] font-bold text-stone-500">Esperado hoy: {expected.toFixed(1)}%</span>
          </div>
        </div>
        
        <div className="relative h-4 bg-[#141211]/45 dark:bg-black/45 rounded-full overflow-hidden p-[3px] backdrop-blur-md border border-white/[0.05] shadow-inner">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className={`h-full rounded-full ${colorClasses[color]} ${progress >= 100 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(52,211,153,0.55)]' : ''}`}
          />
          {/* Pace Marker */}
          <div 
            className="absolute top-0 h-full flex flex-col items-center z-10"
            style={{ left: `${Math.min(expected, 100)}%` }}
          >
            <div className="w-px h-full bg-white/40 border-l border-dashed border-white/40" />
            <div className="absolute -top-1 w-2 h-2 bg-white rounded-full shadow-[0_0_10px_white]" />
          </div>
        </div>
      </div>

      {/* Weekly Milestones Progress Timeline */}
      {(() => {
        const milestones = [
          { label: 'Sem 1', days: 5 },
          { label: 'Sem 2', days: 10 },
          { label: 'Sem 3', days: 15 },
          { label: 'Sem 4', days: 20 },
        ];
        if (totalBusinessDays > 20) {
          milestones.push({ label: 'Sem 5', days: totalBusinessDays });
        }

        // Find active milestone index in terms of days elapsed
        let activeIndex = -1;
        for (let i = 0; i < milestones.length; i++) {
          const prevDays = i === 0 ? 0 : milestones[i - 1].days;
          if (elapsedBusinessDays > prevDays && elapsedBusinessDays <= milestones[i].days) {
            activeIndex = i;
            break;
          }
        }
        if (activeIndex === -1 && elapsedBusinessDays > 0) {
          activeIndex = milestones.length - 1;
        }

        return (
          <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-stone-500">Hitos Semanales</span>
              <span className="text-[9px] font-bold text-stone-500 uppercase">Progreso Acumulado</span>
            </div>
            
            <div className="relative py-2 flex items-center justify-between">
              {/* Timeline Connector Line */}
              <div className="absolute left-3 right-3 top-[18px] h-[3px] bg-white/5 rounded-full z-0">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    progress >= 100 
                      ? 'bg-emerald-500/50' 
                      : color === 'elite' 
                        ? 'bg-[#e8dccf]/30' 
                        : color === 'stretch' 
                          ? 'bg-[#d4bca6]/30' 
                          : 'bg-[#c2a38a]/30'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              {/* Milestones Dots */}
              {milestones.map((ms, idx) => {
                const msTarget = dailyTarget * ms.days;
                const isCompleted = current >= msTarget;
                const isActiveWeek = idx === activeIndex;
                
                return (
                  <div key={ms.label} className="relative flex flex-col items-center z-10 group/ms">
                    {/* Circle */}
                    <div 
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 text-[9px] font-black cursor-pointer ${
                        isCompleted 
                          ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(52,211,153,0.5)] border border-emerald-400' 
                          : isActiveWeek 
                            ? 'bg-stone-900 border-2 border-[#c2a38a] text-[#c2a38a] animate-pulse shadow-[0_0_8px_rgba(194,163,138,0.3)]' 
                            : 'bg-stone-900 border border-white/10 text-stone-500 hover:border-white/20'
                      }`}
                    >
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    
                    {/* Week Label */}
                    <span className="text-[8px] font-black uppercase tracking-wider text-stone-500 mt-1.5">
                      {ms.label}
                    </span>

                    {/* Hover Tooltip */}
                    <div className="absolute bottom-8 scale-75 group-hover/ms:scale-100 opacity-0 pointer-events-none group-hover/ms:opacity-100 transition-all duration-300 bg-stone-950 text-white text-[9px] font-bold py-1.5 px-2.5 rounded-xl shadow-xl border border-white/10 whitespace-nowrap z-30">
                      Meta acum.: ${Math.round(msTarget).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Footer Info */}
      <div className="pt-6 border-t border-white/5 space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Meta Diaria Restante</p>
          <p className={`text-sm font-black ${progress >= 100 ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'text-white'}`}>
            {daily > 0 ? `$${Math.round(daily).toLocaleString()} / día` : '¡LOGRADO! 🏆'}
          </p>
        </div>
        {isAdmin && (
          <p className="text-[9px] font-bold text-stone-600 tracking-tight leading-none uppercase">
            {progress >= 100 ? 'Objetivo alcanzado 🏆' : `Faltan $${Math.max(target - current, 0).toLocaleString()} para la meta.`}
          </p>
        )}
      </div>
    </motion.div>
  );
}
