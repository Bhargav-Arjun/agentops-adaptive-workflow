import { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Command,
  Copy,
  Database,
  FileWarning,
  FlaskConical,
  Gauge,
  History,
  Loader2,
  LockKeyhole,
  Menu,
  Play,
  RotateCcw,
  ScanSearch,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  UserRoundCheck,
  X,
  XCircle,
} from 'lucide-react';
import {
  getGetMemoryLogsQueryKey,
  useApproveHitl,
  useGetMemoryLogs,
  useHealthCheck,
  useRunTask,
} from '@workspace/api-client-react';
import type { MemoryLog, TaskRunResponse } from '@workspace/api-client-react';

import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Router as WouterRouter, Switch } from 'wouter';

const queryClient = new QueryClient();

type StepState = 'complete' | 'active' | 'waiting' | 'blocked';

function formatTime(value: string | null | undefined) {
  if (!value) return 'just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function shortError(error: unknown) {
  if (!error) return 'The service returned an unknown error.';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) return String(error.message);
  return 'The service returned an unknown error.';
}

function parseBatchSize(value: string): number | string | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'full') return 'full';
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric >= 1 ? numeric : null;
}

function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const styles = {
    good: 'bg-[hsl(158_35%_90%)] text-[hsl(162_45%_27%)] border-[hsl(158_30%_76%)]',
    warn: 'bg-[hsl(38_86%_90%)] text-[hsl(29_63%_31%)] border-[hsl(38_70%_72%)]',
    bad: 'bg-[hsl(4_66%_93%)] text-[hsl(4_58%_39%)] border-[hsl(4_52%_80%)]',
    neutral: 'bg-[hsl(39_24%_91%)] text-[hsl(217_13%_44%)] border-[hsl(39_20%_82%)]',
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-[.12em] ${styles[tone]}`}>{label}</span>;
}

function BrandMark() {
  return (
    <div className="relative grid size-9 place-items-center overflow-hidden rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-[0_4px_12px_hsl(31_92%_51%/.24)]">
      <span className="absolute inset-1 rounded border border-[hsl(var(--accent-foreground)/.3)]" />
      <span className="relative font-mono text-sm font-bold">AO</span>
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <button type="button" aria-label="Close navigation" data-testid="button-close-navigation" onClick={onClose} className="fixed inset-0 z-30 bg-[hsl(219_31%_15%/.3)] md:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[76px] items-center gap-3 border-b border-[hsl(var(--sidebar-border))] px-6">
          <BrandMark />
          <div>
            <div className="font-mono text-[13px] font-bold tracking-[.16em]">AGENTOPS</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.52)]">recovery control</div>
          </div>
          <button type="button" onClick={onClose} data-testid="button-dismiss-sidebar" className="ml-auto rounded p-1 text-[hsl(var(--sidebar-foreground)/.6)] hover:bg-[hsl(var(--sidebar-accent))] md:hidden"><X size={17} /></button>
        </div>
        <div className="px-4 py-6">
          <div className="mb-3 px-3 font-mono text-[9px] font-bold uppercase tracking-[.2em] text-[hsl(var(--sidebar-foreground)/.4)]">Operations</div>
          <nav className="space-y-1">
            <a href="#console" data-testid="link-console" className="flex items-center gap-3 rounded-lg bg-[hsl(var(--sidebar-accent))] px-3 py-2.5 text-sm font-semibold text-[hsl(var(--sidebar-foreground))]"><Gauge size={17} className="text-[hsl(var(--sidebar-primary))]" />Run console<span className="ml-auto size-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]" /></a>
            <a href="#memory" data-testid="link-memory" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[hsl(var(--sidebar-foreground)/.7)] transition-colors hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]"><History size={17} />Memory bank</a>
          </nav>
        </div>
        <div className="mt-auto border-t border-[hsl(var(--sidebar-border))] px-6 py-5">
          <div className="flex items-center gap-2 text-[11px] text-[hsl(var(--sidebar-foreground)/.62)]"><span className="size-1.5 rounded-full bg-[hsl(158_52%_53%)] animate-pulse-dot" />environment: production</div>
          <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-[hsl(var(--sidebar-foreground)/.38)]"><LockKeyhole size={12} />local operator session</div>
        </div>
      </aside>
    </>
  );
}

function TopBar({ onOpen }: { onOpen: () => void }) {
  return (
    <header className="flex h-[76px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.88)] px-5 backdrop-blur md:px-9">
      <div className="flex items-center gap-3">
        <button type="button" data-testid="button-open-navigation" aria-label="Open navigation" onClick={onOpen} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] md:hidden"><Menu size={20} /></button>
        <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))] sm:flex"><Command size={13} />control room <span className="text-[hsl(var(--border))]">/</span> run console</div>
        <div className="flex items-center gap-2 sm:hidden"><Activity size={16} className="text-[hsl(var(--accent))]" /><span className="font-mono text-[11px] font-bold tracking-[.14em]">RUN CONSOLE</span></div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))] sm:flex"><span className="size-2 rounded-full bg-[hsl(158_52%_48%)]" />API reachable</div>
        <div className="grid size-8 place-items-center rounded-full bg-[hsl(var(--primary))] font-mono text-[10px] font-bold text-[hsl(var(--primary-foreground))]" data-testid="avatar-operator">OP</div>
      </div>
    </header>
  );
}

function StepRail({ run }: { run: TaskRunResponse | null }) {
  const status = run?.status;
  const hitl = status === 'HITL_REQUIRED' || (status === 'FAILURE' && Boolean(run?.review_id));
  const executed = Boolean(run?.execution);
  const retained = Boolean(run?.retained);
  const steps: { label: string; caption: string; state: StepState; icon: typeof ScanSearch }[] = [
    { label: 'Recall', caption: run ? (run.recall.found ? `${run.recall.memories.length} match${run.recall.memories.length === 1 ? '' : 'es'} found` : 'No prior failure') : 'Mandatory first gate', state: run ? 'complete' : 'active', icon: ScanSearch },
    { label: 'Human review', caption: hitl ? 'Decision required' : run ? 'Not required' : 'Only if recall finds risk', state: hitl ? 'active' : run ? 'complete' : 'waiting', icon: UserRoundCheck },
    { label: 'Tool execution', caption: executed ? run?.execution?.status ?? 'Completed' : hitl ? 'Paused at gate' : 'Awaiting run', state: executed ? 'complete' : hitl ? 'blocked' : 'waiting', icon: Terminal },
    { label: 'Retain', caption: retained ? 'Experience recorded' : executed ? 'Writing to memory' : 'After execution', state: retained ? 'complete' : executed ? 'active' : 'waiting', icon: Database },
  ];
  return (
    <section className="card-surface overflow-hidden rounded-xl" data-testid="workflow-step-rail">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
        <div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Workflow trace</p><h2 className="mt-1 text-sm font-semibold">Recovery protocol</h2></div>
        <span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">01 — 04</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-[hsl(var(--border))] md:grid-cols-4 md:divide-y-0">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const color = step.state === 'complete' ? 'text-[hsl(162_45%_32%)] bg-[hsl(158_35%_90%)]' : step.state === 'active' ? 'text-[hsl(var(--accent-foreground))] bg-[hsl(var(--accent))]' : step.state === 'blocked' ? 'text-[hsl(var(--destructive))] bg-[hsl(4_66%_93%)]' : 'text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]';
          return <div key={step.label} className={`relative p-4 ${step.state === 'active' ? 'bg-[hsl(var(--accent)/.07)]' : ''}`} data-testid={`step-${step.label.toLowerCase().replace(' ', '-')}`}>
            <div className="flex items-start justify-between"><span className={`grid size-7 place-items-center rounded-md ${color}`}>{step.state === 'complete' ? <Check size={15} strokeWidth={2.5} /> : <Icon size={15} />}</span><span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">0{index + 1}</span></div>
            <p className="mt-3 text-xs font-semibold">{step.label}</p><p className="mt-1 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">{step.caption}</p>
          </div>;
        })}
      </div>
    </section>
  );
}

function FieldLabel({ children, hint }: { children: string; hint?: string }) {
  return <label className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]"><span>{children}</span>{hint && <span className="font-mono text-[9px] font-normal normal-case tracking-normal">{hint}</span>}</label>;
}

function RunForm({ onRun, pending }: { onRun: (task: string, records: number, batchSize: number | string) => void; pending: boolean }) {
  const [task, setTask] = useState('Backfill customer records');
  const [records, setRecords] = useState('100000');
  const [batchSize, setBatchSize] = useState('full');
  const [error, setError] = useState('');
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const recordCount = Number(records);
    const batch = parseBatchSize(batchSize);
    if (!task.trim()) return setError('Describe the task before running it.');
    if (!Number.isFinite(recordCount) || recordCount < 1) return setError('Records must be at least 1.');
    if (batch === null) return setError('Batch size must be a positive number or “full”.');
    setError('');
    onRun(task.trim(), recordCount, batch);
  };
  return <section className="card-surface rounded-xl p-5 md:p-6" data-testid="run-task-panel">
    <div className="mb-6 flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--accent))]">New operation</p><h2 className="mt-1 text-lg font-semibold tracking-tight">Prepare a controlled run</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Every run begins with a recall. Nothing is hidden.</p></div><div className="hidden size-9 place-items-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))] sm:grid"><SlidersHorizontal size={17} /></div></div>
    <form onSubmit={submit} className="space-y-5">
      <div><FieldLabel hint="required">Task description</FieldLabel><textarea value={task} onChange={(event) => setTask(event.target.value)} rows={3} data-testid="input-task-description" className="w-full resize-none rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3.5 py-3 text-sm outline-none transition focus:border-[hsl(var(--accent))] focus:ring-2 focus:ring-[hsl(var(--accent)/.16)]" placeholder="What should the agent do?" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel hint="integer">Records</FieldLabel><input type="number" min="1" value={records} onChange={(event) => setRecords(event.target.value)} data-testid="input-record-count" className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3.5 py-2.5 font-mono text-sm outline-none transition focus:border-[hsl(var(--accent))] focus:ring-2 focus:ring-[hsl(var(--accent)/.16)]" /></div>
        <div><FieldLabel hint="number or full">Batch size</FieldLabel><input type="text" inputMode="numeric" value={batchSize} onChange={(event) => setBatchSize(event.target.value)} data-testid="input-batch-size" className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3.5 py-2.5 font-mono text-sm outline-none transition focus:border-[hsl(var(--accent))] focus:ring-2 focus:ring-[hsl(var(--accent)/.16)]" /></div>
      </div>
      {error && <div className="flex items-center gap-2 rounded-lg border border-[hsl(4_52%_80%)] bg-[hsl(4_66%_93%)] px-3 py-2 text-xs text-[hsl(4_58%_39%)]" data-testid="error-run-form"><AlertCircle size={14} />{error}</div>}
      <button type="submit" disabled={pending} data-testid="button-run-task" className="group flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-3 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-[0_5px_12px_hsl(var(--primary)/.18)] transition hover:-translate-y-0.5 hover:bg-[hsl(218_42%_20%)] disabled:cursor-wait disabled:opacity-70">
        {pending ? <><Loader2 size={16} className="animate-spin" />Running recall gate…</> : <><Play size={15} fill="currentColor" />Run with recall</>}<ArrowRight size={15} className="ml-1 transition-transform group-hover:translate-x-0.5" />
      </button>
    </form>
  </section>;
}

function RecallCard({ run }: { run: TaskRunResponse }) {
  return <section className="card-surface rounded-xl p-5 md:p-6" data-testid="recall-result-card">
    <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className={`grid size-9 place-items-center rounded-lg ${run.recall.found ? 'bg-[hsl(38_86%_90%)] text-[hsl(29_63%_31%)]' : 'bg-[hsl(158_35%_90%)] text-[hsl(162_45%_27%)]'}`}><ScanSearch size={18} /></div><div><div className="flex items-center gap-2"><h2 className="text-sm font-semibold">Recall gate</h2><StatusPill label="mandatory" tone="neutral" /></div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Hindsight searched before any tool call.</p></div></div><span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">RECALL / 01</span></div>
    <div className="mt-5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background)/.64)] p-3.5"><p className="font-mono text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Query</p><p className="mt-2 text-xs leading-5 text-[hsl(var(--foreground)/.78)]" data-testid="text-recall-query">“{run.recall.query}”</p></div>
    {run.recall.found ? <div className="mt-4 space-y-2">{run.recall.memories.map((memory, index) => <div key={`${memory.id ?? 'memory'}-${index}`} className="rounded-lg border-l-2 border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.08)] px-3.5 py-3" data-testid={`memory-recall-${index}`}><div className="flex items-center justify-between gap-3"><span className="font-mono text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(29_63%_31%)]">{memory.type ?? 'prior experience'}</span><span className="font-mono text-[9px] text-[hsl(var(--muted-foreground))]">{formatTime(memory.occurred_at)}</span></div><p className="mt-1.5 text-xs leading-5">{memory.text}</p></div>)}</div> : <div className="mt-4 flex items-center gap-2 rounded-lg bg-[hsl(158_35%_90%)] px-3 py-2.5 text-xs text-[hsl(162_45%_27%)]" data-testid="status-recall-clear"><CheckCircle2 size={15} />No matching failures found. Safe to continue to execution.</div>}
  </section>;
}

function ReviewCard({ run, onApprove, pending, onAbort }: { run: TaskRunResponse; onApprove: (parameters: { records: number; batch_size: number | string }, action: string) => void; pending: boolean; onAbort: () => void }) {
  const failure = run.previous_failure;
  const [records, setRecords] = useState(String(failure?.recovery_parameters?.records ?? run.parameters.records));
  const [batch, setBatch] = useState(String(failure?.recovery_parameters?.batch_size ?? run.parameters.batch_size));
  const [useFix, setUseFix] = useState(true);
  if (!failure) return null;
  const recoveryBatch = parseBatchSize(batch);
  const recoveryParameters = { records: Number(records), batch_size: recoveryBatch ?? batch };
  return <section className="relative overflow-hidden rounded-xl border border-[hsl(38_70%_72%)] bg-[hsl(38_86%_94%)] p-5 md:p-6" data-testid="hitl-review-card">
    <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-[hsl(var(--accent)/.1)]" />
    <div className="relative flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="grid size-9 place-items-center rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"><UserRoundCheck size={18} /></div><div><div className="flex items-center gap-2"><h2 className="text-sm font-semibold">Human review required</h2><StatusPill label="paused" tone="warn" /></div><p className="mt-1 max-w-lg text-xs leading-5 text-[hsl(29_63%_31%)/.78]">Recall found a previous failure for this task. Approve the recorded fix, adjust it, or abort before any tool execution.</p></div></div><span className="font-mono text-[10px] text-[hsl(29_63%_31%)/.62]">HITL / 02</span></div>
      <div className="relative mt-5 grid gap-3 md:grid-cols-[1fr_1.15fr]">
      <div className="rounded-lg border border-[hsl(38_70%_72%)] bg-[hsl(var(--card)/.55)] p-4"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em] text-[hsl(4_58%_39%)]"><FileWarning size={14} />Previous failure</div><p className="mt-3 text-xs font-semibold">{failure.task}</p><p className="mt-2 rounded bg-[hsl(4_66%_93%)/.75] px-2.5 py-2 font-mono text-[10px] leading-4 text-[hsl(4_58%_39%)]">{failure.error}</p><div className="mt-3 text-[10px] text-[hsl(29_63%_31%)/.72]">Failed with records {failure.failed_parameters.records} · batch {failure.failed_parameters.batch_size}</div></div>
       <div className="rounded-lg border border-[hsl(38_70%_72%)] bg-[hsl(var(--card)/.55)] p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em] text-[hsl(29_63%_31%)]"><FlaskConical size={14} />Recovery proposal</div><button type="button" data-testid="button-toggle-recovery-fix" onClick={() => setUseFix((current) => { if (!current) { setRecords(String(failure.recovery_parameters?.records ?? run.parameters.records)); setBatch(String(failure.recovery_parameters?.batch_size ?? run.parameters.batch_size)); } return !current; })} className="flex items-center gap-1.5 text-[10px] font-semibold text-[hsl(29_63%_31%)] hover:underline">{useFix ? 'Use fix' : 'Manual'}<ChevronDown size={13} /></button></div><p className="mt-2 text-xs leading-5 text-[hsl(29_63%_31%)/.8]">{failure.winning_recovery_fix ?? 'No recorded fix. Set safe parameters manually.'}</p><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[10px] font-semibold text-[hsl(29_63%_31%)/.76]">Records<input type="number" min="1" value={useFix ? String(failure.recovery_parameters?.records ?? records) : records} onChange={(event) => { setUseFix(false); setRecords(event.target.value); }} data-testid="input-review-records" className="mt-1 w-full rounded border border-[hsl(38_70%_72%)] bg-[hsl(var(--card)/.8)] px-2.5 py-2 font-mono text-xs outline-none focus:border-[hsl(var(--accent))]" /></label><label className="text-[10px] font-semibold text-[hsl(29_63%_31%)/.76]">Batch size<input type="text" inputMode="numeric" value={useFix ? String(failure.recovery_parameters?.batch_size ?? batch) : batch} onChange={(event) => { setUseFix(false); setBatch(event.target.value); }} data-testid="input-review-batch-size" className="mt-1 w-full rounded border border-[hsl(38_70%_72%)] bg-[hsl(var(--card)/.8)] px-2.5 py-2 font-mono text-xs outline-none focus:border-[hsl(var(--accent))]" /></label></div></div>
    </div>
    <div className="relative mt-4 flex flex-col-reverse gap-2 border-t border-[hsl(38_70%_72%)] pt-4 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={onAbort} data-testid="button-abort-review" className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[hsl(4_58%_39%)] hover:bg-[hsl(4_66%_93%)]"><XCircle size={15} />Abort run</button><button type="button" disabled={pending} onClick={() => onApprove(recoveryParameters, useFix ? 'Approved recorded recovery fix' : 'Modified recovery parameters')} data-testid="button-approve-review" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 disabled:opacity-60">{pending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}{pending ? 'Approving…' : useFix ? 'Approve recovery fix' : 'Approve modified run'}</button></div>
  </section>;
}

function ExecutionCard({ run }: { run: TaskRunResponse }) {
  const execution = run.execution;
  if (!execution) return null;
  const success = execution.status === 'SUCCESS';
  return <section className="card-surface rounded-xl p-5 md:p-6" data-testid="execution-result-card"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className={`grid size-9 place-items-center rounded-lg ${success ? 'bg-[hsl(158_35%_90%)] text-[hsl(162_45%_27%)]' : 'bg-[hsl(4_66%_93%)] text-[hsl(4_58%_39%)]'}`}>{success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}</div><div><div className="flex items-center gap-2"><h2 className="text-sm font-semibold">Tool execution</h2><StatusPill label={execution.status} tone={success ? 'good' : 'bad'} /></div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{execution.message}</p></div></div><span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">TOOL / 03</span></div><div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4"><div className="rounded-lg bg-[hsl(var(--muted)/.55)] p-3"><p className="font-mono text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">HTTP</p><p className="mt-1 font-mono text-lg font-bold">{execution.http_status}</p></div><div className="rounded-lg bg-[hsl(var(--muted)/.55)] p-3"><p className="font-mono text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Records</p><p className="mt-1 font-mono text-lg font-bold">{execution.parameters.records.toLocaleString()}</p></div><div className="rounded-lg bg-[hsl(var(--muted)/.55)] p-3"><p className="font-mono text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Batch</p><p className="mt-1 font-mono text-lg font-bold">{execution.parameters.batch_size}</p></div><div className="rounded-lg bg-[hsl(var(--muted)/.55)] p-3"><p className="font-mono text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Retain</p><p className="mt-1 font-mono text-lg font-bold">{run.retained ? 'yes' : 'pending'}</p></div></div>{execution.error && <p className="mt-4 rounded-lg bg-[hsl(4_66%_93%)] px-3 py-2 font-mono text-[10px] text-[hsl(4_58%_39%)]">{execution.error}</p>}</section>;
}

function MemoryLogs() {
  const { data, isLoading, isError, refetch } = useGetMemoryLogs();
  const logs = data?.logs ?? [];
  return <section id="memory" className="card-surface rounded-xl" data-testid="memory-logs-panel"><div className="flex flex-col gap-3 border-b border-[hsl(var(--border))] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Database size={16} className="text-[hsl(var(--accent))]" /><h2 className="text-sm font-semibold">Retained memory</h2></div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">The operational record left by each completed workflow.</p></div><div className="flex items-center gap-3"><span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{data?.bank_id ? `bank ${data.bank_id.slice(0, 10)}` : 'memory bank'}</span><button type="button" onClick={() => refetch()} data-testid="button-refresh-memory" className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]" aria-label="Refresh memory logs"><RotateCcw size={14} /></button></div></div>
    {isLoading ? <div className="space-y-3 p-5" data-testid="loading-memory-logs">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-[hsl(var(--muted))]" />)}</div> : isError ? <div className="flex flex-col items-center gap-3 px-5 py-12 text-center" data-testid="error-memory-logs"><AlertCircle size={20} className="text-[hsl(var(--destructive))]" /><p className="text-xs text-[hsl(var(--muted-foreground))]">Memory logs could not be loaded.</p><button type="button" onClick={() => refetch()} data-testid="button-retry-memory" className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold hover:bg-[hsl(var(--muted))]">Retry</button></div> : logs.length === 0 ? <div className="flex flex-col items-center gap-2 px-5 py-12 text-center" data-testid="empty-memory-logs"><div className="grid size-10 place-items-center rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><History size={18} /></div><p className="mt-1 text-sm font-semibold">No retained experiences yet</p><p className="max-w-xs text-xs leading-5 text-[hsl(var(--muted-foreground))]">Run a task to create the first durable operational trace.</p></div> : <div className="divide-y divide-[hsl(var(--border))]">{logs.map((log, index) => <LogRow key={`${log.id ?? 'log'}-${index}`} log={log} index={index} />)}</div>}
  </section>;
}

function LogRow({ log, index }: { log: MemoryLog; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const success = log.outcome === 'SUCCESS';
  return <div className="px-5 py-4 transition-colors hover:bg-[hsl(var(--muted)/.3)]" data-testid={`memory-log-${log.id ?? index}`}><button type="button" onClick={() => setExpanded(!expanded)} data-testid={`button-expand-memory-${log.id ?? index}`} className="flex w-full items-start gap-3 text-left"><span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ${success ? 'bg-[hsl(158_35%_90%)] text-[hsl(162_45%_27%)]' : 'bg-[hsl(4_66%_93%)] text-[hsl(4_58%_39%)]'}`}>{success ? <Check size={14} /> : <AlertCircle size={14} />}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="truncate text-xs font-semibold">{log.task}</span><StatusPill label={log.outcome} tone={success ? 'good' : 'bad'} /></span><span className="mt-1 block truncate text-[11px] text-[hsl(var(--muted-foreground))]">{log.text}</span></span><span className="flex shrink-0 items-center gap-3 text-[10px] text-[hsl(var(--muted-foreground))]"><span className="hidden font-mono sm:inline">{formatTime(log.timestamp)}</span><ChevronDown size={15} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} /></span></button>{expanded && <div className="ml-10 mt-3 grid gap-3 rounded-lg bg-[hsl(var(--muted)/.55)] p-3 text-xs md:grid-cols-3" data-testid={`memory-detail-${log.id ?? index}`}><div><p className="font-mono text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Parameters</p><p className="mt-1 font-mono text-[10px]">records {log.parameters.records} · batch {log.parameters.batch_size}</p></div><div><p className="font-mono text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Human action</p><p className="mt-1">{log.human_action ?? 'none'}</p></div><div><p className="font-mono text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Error</p><p className="mt-1">{log.error ?? 'none'}</p></div></div>}</div>;
}

function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [run, setRun] = useState<TaskRunResponse | null>(null);
  const [actionError, setActionError] = useState('');
  const queryClient = useQueryClient();
  const health = useHealthCheck();
  const runTask = useRunTask();
  const approveHitl = useApproveHitl();
  const memoryKey = useMemo(() => getGetMemoryLogsQueryKey(), []);

  const handleRun = (task: string, records: number, batch_size: number | string) => {
    setActionError('');
    setRun(null);
    runTask.mutate({ data: { task, parameters: { records, batch_size } } }, {
      onSuccess: (result) => {
        setRun(result);
        queryClient.invalidateQueries({ queryKey: memoryKey });
      },
      onError: (error) => setActionError(shortError(error)),
    });
  };
  const handleApprove = (parameters: { records: number; batch_size: number | string }, human_action: string) => {
    if (!run?.review_id) return setActionError('This review has expired. Start a new run.');
    setActionError('');
    approveHitl.mutate({ data: { review_id: run.review_id, parameters, human_action } }, {
      onSuccess: (result) => {
        setRun(result);
        queryClient.invalidateQueries({ queryKey: memoryKey });
      },
      onError: (error) => setActionError(shortError(error)),
    });
  };
  const isReview = Boolean(run?.review_id) && (run?.status === 'HITL_REQUIRED' || run?.status === 'FAILURE');
  return <div className="flex min-h-[100dvh] bg-[hsl(var(--background))]">
    <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <div className="min-w-0 flex-1"><TopBar onOpen={() => setSidebarOpen(true)} /><main id="console" className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 md:px-9 md:py-8">
      <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div className="animate-rise-in"><div className="mb-3 flex items-center gap-2"><span className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--accent))]">Live operations</span><span className="h-px w-8 bg-[hsl(var(--accent))]" /></div><h1 className="max-w-2xl text-3xl font-bold tracking-[-.04em] text-[hsl(var(--primary))] sm:text-4xl">Make the next run<br /><span className="text-[hsl(var(--muted-foreground))]">the informed one.</span></h1><p className="mt-3 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">AgentOps surfaces what happened before your agent touches a tool again.</p></div><div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card)/.68)] px-3 py-2.5 text-xs shadow-[var(--shadow-sm)]" data-testid="health-status"><span className={`size-2 rounded-full ${health.isLoading ? 'bg-[hsl(var(--accent))] animate-pulse-dot' : health.isError ? 'bg-[hsl(var(--destructive))]' : 'bg-[hsl(158_52%_48%)]'}`} /><span className="text-[hsl(var(--muted-foreground))]">Service health</span><span className="font-mono font-bold">{health.isLoading ? 'checking' : health.isError ? 'degraded' : health.data?.status ?? 'online'}</span></div></div>
      <StepRail run={run} />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <div className="space-y-5"><RunForm onRun={handleRun} pending={runTask.isPending} />{actionError && <div className="flex items-start gap-2 rounded-xl border border-[hsl(4_52%_80%)] bg-[hsl(4_66%_93%)] px-4 py-3 text-xs text-[hsl(4_58%_39%)]" data-testid="error-action"><AlertCircle size={15} className="mt-0.5 shrink-0" /><span><strong className="font-semibold">Action failed.</strong> {actionError}</span></div>}<div className="panel-grid relative hidden overflow-hidden rounded-xl border border-[hsl(var(--border))] p-5 lg:block"><div className="relative z-10"><div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]"><Copy size={13} />Operator notes</div><p className="mt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">A recall is a pause, not a prediction. Review the evidence, then choose the smallest safe change.</p></div></div></div>
         <div className="min-w-0 space-y-5">{run ? <><RecallCard run={run} />{run.execution && <ExecutionCard run={run} />}{isReview && <ReviewCard run={run} onApprove={handleApprove} pending={approveHitl.isPending} onAbort={() => { setRun(null); setActionError('Run aborted before tool execution.'); }} />}{run.retained && <div className="flex items-center gap-3 rounded-xl border border-[hsl(158_30%_76%)] bg-[hsl(158_35%_90%)] px-4 py-3 text-xs text-[hsl(162_45%_27%)]" data-testid="status-retained"><CheckCircle2 size={17} /><span><strong className="font-semibold">Retain confirmed.</strong> This run is now available in the memory bank below.</span></div>}</> : <div className="card-surface flex min-h-[320px] flex-col items-center justify-center rounded-xl p-8 text-center" data-testid="empty-run-state"><div className="relative grid size-16 place-items-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.5)] text-[hsl(var(--muted-foreground))]"><div className="absolute inset-2 rounded-xl border border-dashed border-[hsl(var(--border))]" /><Activity size={24} /></div><h2 className="mt-5 text-base font-semibold">No active run</h2><p className="mt-2 max-w-xs text-xs leading-5 text-[hsl(var(--muted-foreground))]">Set your task parameters, then launch a recall-first operation to see the full recovery path.</p></div>}</div>
      </div>
      <div className="mt-5"><MemoryLogs /></div>
      <footer className="flex flex-col gap-2 border-t border-[hsl(var(--border))] py-6 text-[10px] text-[hsl(var(--muted-foreground))] sm:flex-row sm:items-center sm:justify-between"><span className="font-mono tracking-[.12em]">AGENTOPS / ADAPTIVE WORKFLOW RECOVERY</span><span className="flex items-center gap-1.5"><Settings2 size={12} />Operator surface · all actions auditable</span></footer>
    </main></div>
  </div>;
}

function Router() {
  return <Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary resetKey="/"><Router /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;