import React, { useState, useMemo, useCallback } from 'react';
import { AlertCircle, ShieldCheck, CheckCircle2, Workflow, FileDown } from 'lucide-react';

// Primary brand color for PBE
const PBE_GREEN = '#00a651';

// De‑energise steps. Each step has an id, a tuple of columns and an optional
// requiresLoto flag indicating whether both technicians must confirm their
// locks have been applied after operating the switch.
const DE_STEPS = [
  { id: 'de1', cols: [1, 'HVDB0027 RMU', 'Feeder CB (Q11-1 Incomer)', 'Open feeder breaker to isolate supply to CSS092 and apply lock.', 'Switch key, Cat 3 PPE', 'Yes'], requiresLoto: true },
  { id: 'de2', cols: [2, 'CSS092 RMU', 'Q11-1 Incomer', 'Open incomer; verify VPIS dark and apply lock.', 'HV handle, LOTO', 'Yes'], requiresLoto: true },
  { id: 'de3', cols: [3, 'CSS092 RMU', 'Q11-1E Earth Switch', 'Close earth on incomer; lock & tag.', 'Padlock, tag', 'Yes'] },
  { id: 'de4', cols: [4, 'CSS092 RMU', 'Q11-2 Feeder', 'Open feeder to de-energise transformer and apply lock.', 'HV handle, LOTO', 'Yes'], requiresLoto: true },
  { id: 'de5', cols: [5, 'CSS092 RMU', 'Q11-2E Earth Switch', 'Close earth on transformer feeder; lock & tag.', 'Padlock, tag', 'Yes'] },
  { id: 'de6', cols: [6, 'CSS092 LV Board', 'Main CB 415 V', 'Open & isolate LV main; apply lock.', 'Padlock, tag', 'Yes'], requiresLoto: true },
  { id: 'de7', cols: [7, 'CSS092 RMU', 'All Ways', 'Prove dead with approved 11 kV tester.', 'Proving unit, gloves', 'Yes'] },
  { id: 'de8', cols: [8, 'CSS092 RMU', 'All Panels', 'Fit danger signs; confirm “earthed”.', 'Signage kit', 'Yes'] },
  { id: 'de9', cols: [9, 'CSS092 RMU', 'Permit to Work', 'Issue PTW to competent person.', 'PTW book, key safe', '—'] },
];

// Energise steps. These are performed after the work is complete to return the
// system to service.
const EN_STEPS = [
  { id: 'en1', cols: [1, 'CSS092 RMU', 'Permit to Work', 'Work complete; cancel PTW & retrieve keys.', 'PTW book', '—'] },
  { id: 'en2', cols: [2, 'CSS092 RMU', 'Earth Switches', 'Remove earths in reverse order (Q11-2E, Q11-1E, etc.).', 'Padlock keys, HV handle', 'Yes'] },
  { id: 'en3', cols: [3, 'CSS092 RMU', 'Q11-1 Incomer', 'Close incomer; confirm VPIS lit.', 'HV handle, PPE', 'Yes'] },
  { id: 'en4', cols: [4, 'CSS092 RMU', 'Q11-2 Feeder', 'Close feeder to energise transformer.', 'HV handle, PPE', 'Yes'] },
  { id: 'en5', cols: [5, 'CSS092 LV Board', 'Main CB', 'Close LV main to energise board.', 'Multimeter, PPE', 'Yes'] },
  { id: 'en6', cols: [6, 'HVDB0027 RMU', 'Feeder CB', 'Close feeder breaker to restore supply.', 'Switch key, permit', 'Yes'] },
  { id: 'en7', cols: [7, 'CSS092 RMU', 'All Panels', 'Remove Danger signs; confirm normal operation.', 'Signage kit', 'Yes'] },
];

/**
 * Home component renders the HV switching plan with dual technician verification
 * and optional lock‑out/tag‑out (LOTO) confirmation. The UI is built using
 * Tailwind CSS utility classes and lucide icons, and the PDF export uses the
 * client‑side html2pdf.js library.
 */
export default function Home() {
  // Combine DE and EN steps once on mount. useMemo prevents recalculation on
  // every render.
  const allSteps = useMemo(() => [...DE_STEPS, ...EN_STEPS], []);

  // General form state
  const [siteName, setSiteName] = useState('T2D Precast Facility – CSS092');
  const [wo, setWo] = useState('');
  const [dateStr, setDateStr] = useState(() => new Date().toLocaleString());
  const [sigA, setSigA] = useState('');
  const [sigB, setSigB] = useState('');
  const [activeTab, setActiveTab] = useState('DE');

  // Step state keyed by step id. Each step tracks operator names, whether the
  // operation has been performed, LOTO status and timestamps.
  const [state, setState] = useState(() => {
    const o = {};
    allSteps.forEach(s => {
      o[s.id] = { aName: '', bName: '', aDone: false, bDone: false };
    });
    return o;
  });

  /**
   * Update the name field for technician A or B. useCallback ensures the
   * function reference remains stable across renders, preventing input focus
   * loss when typing.
   */
  const updateName = useCallback((id, who, val) => {
    setState(prev => ({ ...prev, [id]: { ...prev[id], [who === 'a' ? 'aName' : 'bName']: val } }));
  }, []);

  /**
   * Toggle the operated or lock state for a given step and technician. If
   * called with lock=true, it toggles the LOTO confirmation; otherwise it
   * toggles the switch operation. Names must be provided before operation.
   */
  const toggle = (id, who, lock) => {
    setState(prev => {
      const st = { ...prev[id] };
      const now = new Date().toLocaleString();
      if (lock) {
        if (who === 'a') {
          if (!st.aDone) return prev;
          st.aLoto = !st.aLoto;
          st.aLotoTime = st.aLoto ? now : undefined;
        } else {
          if (!st.bDone) return prev;
          st.bLoto = !st.bLoto;
          st.bLotoTime = st.bLoto ? now : undefined;
        }
      } else {
        if (who === 'a') {
          if (!st.aName.trim()) return prev;
          st.aDone = !st.aDone;
          st.aTime = st.aDone ? now : undefined;
          if (!st.aDone) {
            st.aLoto = false;
            st.aLotoTime = undefined;
          }
        } else {
          if (!st.bName.trim()) return prev;
          st.bDone = !st.bDone;
          st.bTime = st.bDone ? now : undefined;
          if (!st.bDone) {
            st.bLoto = false;
            st.bLotoTime = undefined;
          }
        }
      }
      return { ...prev, [id]: st };
    });
  };

  /**
   * Update the optional notes/anomalies field for a step. Memoised via
   * useCallback to keep the reference stable.
   */
  const setNote = useCallback((id, val) => {
    setState(prev => ({ ...prev, [id]: { ...prev[id], note: val } }));
  }, []);

  /**
   * Calculate overall progress as a percentage. Each step counts for two
   * operations (A and B) plus two LOTO confirmations if required.
   */
  const progress = () => {
    const total = allSteps.reduce((acc, st) => acc + 2 + (st.requiresLoto ? 2 : 0), 0);
    const done = allSteps.reduce((acc, st) => {
      const ss = state[st.id];
      const base = (ss.aDone ? 1 : 0) + (ss.bDone ? 1 : 0);
      const loto = st.requiresLoto ? (ss.aLoto ? 1 : 0) + (ss.bLoto ? 1 : 0) : 0;
      return acc + base + loto;
    }, 0);
    return Math.round((done / Math.max(total, 1)) * 100);
  };

  /**
   * Determine if all steps are complete and signatures have been provided. The
   * final PDF export button is disabled until this function returns true.
   */
  const allDone = () => {
    return allSteps.every(st => {
      const s = state[st.id];
      const baseOK = s.aDone && s.bDone;
      const lotoOK = st.requiresLoto ? s.aLoto && s.bLoto : true;
      return baseOK && lotoOK;
    }) && sigA && sigB;
  };

  /**
   * Export the report to a PDF. Uses a dynamic import to load html2pdf.js only
   * on demand, keeping the initial bundle size small.
   */
  const exportPDF = async () => {
    const module = await import('html2pdf.js');
    const html2pdf = module.default;
    const element = document.getElementById('export-content');
    html2pdf().from(element).save(`PBE-CSS092-HV-Switching-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  /**
   * Stable row component to render a single step. We create it using useState
   * with an initializer so that React never reassigns the component on
   * subsequent renders. This avoids losing focus in text inputs while typing.
   */
  const [StepRow] = useState(() => {
    return ({ step }) => {
      const s = state[step.id];
      const both = s.aDone && s.bDone && (!step.requiresLoto || (s.aLoto && s.bLoto));
      const lotoBadge = step.requiresLoto ? (
        <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Locks required</span>
      ) : null;

      return (
        <div className={`grid grid-cols-12 gap-3 p-3 rounded-xl border mb-2 ${both ? 'border-green-500 bg-green-50' : 'border-zinc-200 bg-white'}`}>
          <div className="col-span-12 md:col-span-6 text-sm">
            <div className="font-medium flex items-center">{`${step.cols[0]}. ${step.cols[2]}`} {lotoBadge}</div>
            <div className="text-xs text-zinc-600">Location: {step.cols[1]} • Items: {step.cols[4]} • Safety Person: {step.cols[5]}</div>
            <div className="text-xs mt-1">Reason: {step.cols[3]}</div>
            <textarea
              className="mt-2 w-full p-2 border border-zinc-300 rounded-md text-xs"
              placeholder="Notes / anomalies (optional)"
              value={s.note || ''}
              onChange={(e) => setNote(step.id, e.target.value)}
            />
          </div>
          <div className="col-span-12 md:col-span-3 flex flex-col gap-2">
            <div className="text-xs font-medium">Technician A</div>
            <input
              type="text"
              placeholder="Type name to enable"
              value={s.aName}
              onChange={(e) => updateName(step.id, 'a', e.target.value)}
              className="border border-zinc-300 rounded-md p-2 text-sm"
            />
            <button
              onClick={() => toggle(step.id, 'a')}
              disabled={!s.aName.trim()}
              className={`w-full py-1 rounded-md text-white ${s.aDone ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {s.aDone ? (
                <span className="flex items-center justify-center"><CheckCircle2 className="h-4 w-4 mr-1" /> Open (Checked)</span>
              ) : (
                <span className="flex items-center justify-center"><ShieldCheck className="h-4 w-4 mr-1" /> Closed (Check)</span>
              )}
            </button>
            {step.requiresLoto && (
              <button
                onClick={() => toggle(step.id, 'a', true)}
                disabled={!s.aDone}
                className={`w-full py-1 rounded-md ${s.aLoto ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-white border border-red-300 text-red-700 hover:bg-red-50'}`}
              >
                {s.aLoto ? 'Locks On (A)' : 'Locks Not Applied (A)'}
              </button>
            )}
            <div className="text-[10px] text-zinc-500">{s.aTime ? `A: ${s.aTime}` : ''} {s.aLotoTime ? `• LOTO: ${s.aLotoTime}` : ''}</div>
          </div>
          <div className="col-span-12 md:col-span-3 flex flex-col gap-2">
            <div className="text-xs font-medium">Technician B</div>
            <input
              type="text"
              placeholder="Type name to enable"
              value={s.bName}
              onChange={(e) => updateName(step.id, 'b', e.target.value)}
              className="border border-zinc-300 rounded-md p-2 text-sm"
            />
            <button
              onClick={() => toggle(step.id, 'b')}
              disabled={!s.bName.trim()}
              className={`w-full py-1 rounded-md text-white ${s.bDone ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {s.bDone ? (
                <span className="flex items-center justify-center"><CheckCircle2 className="h-4 w-4 mr-1" /> Open (Checked)</span>
              ) : (
                <span className="flex items-center justify-center"><ShieldCheck className="h-4 w-4 mr-1" /> Closed (Check)</span>
              )}
            </button>
            {step.requiresLoto && (
              <button
                onClick={() => toggle(step.id, 'b', true)}
                disabled={!s.bDone}
                className={`w-full py-1 rounded-md ${s.bLoto ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-white border border-red-300 text-red-700 hover:bg-red-50'}`}
              >
                {s.bLoto ? 'Locks On (B)' : 'Locks Not Applied (B)'}
              </button>
            )}
            <div className="text-[10px] text-zinc-500">{s.bTime ? `B: ${s.bTime}` : ''} {s.bLotoTime ? `• LOTO: ${s.bLotoTime}` : ''}</div>
          </div>
        </div>
      );
    };
  });

  const pct = progress();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow mb-6 border border-zinc-200">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: PBE_GREEN }}>
              <img src="/pbe-logo.png" alt="PBE Logo" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <div className="text-sm text-zinc-500">High Voltage Switching</div>
              <div className="text-xl font-semibold text-zinc-800">Technician Verification – CSS092 RMU</div>
              <div className="text-[11px] text-zinc-500">Site: {siteName} • WO: {wo || '-'} • {dateStr}</div>
            </div>
          </div>
        </div>
        {/* Top form */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-zinc-500">Site Name</label>
              <input value={siteName} onChange={(e) => setSiteName(e.target.value)} className="border border-zinc-300 rounded-md p-2 w-full text-sm" />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Work Order / Permit Ref</label>
              <input value={wo} onChange={(e) => setWo(e.target.value)} className="border border-zinc-300 rounded-md p-2 w-full text-sm" />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Date/Time</label>
              <input value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="border border-zinc-300 rounded-md p-2 w-full text-sm" />
            </div>
          </div>
          <hr className="my-4 border-zinc-200" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-500">Technician A – Signature (type full name)</label>
              <input value={sigA} onChange={(e) => setSigA(e.target.value)} placeholder="Type full legal name" className="border border-zinc-300 rounded-md p-2 w-full text-sm" />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Technician B – Signature (type full name)</label>
              <input value={sigB} onChange={(e) => setSigB(e.target.value)} placeholder="Type full legal name" className="border border-zinc-300 rounded-md p-2 w-full text-sm" />
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-zinc-700">
            <Workflow className="h-5 w-5" />
            <span className="text-sm">Overall Completion</span>
          </div>
          <div className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 border border-zinc-200">
            <div className="text-xs text-zinc-600">{pct}%</div>
            <div className="w-52 h-2 bg-gray-200 rounded">
              <div style={{ width: `${pct}%` }} className="h-2 bg-green-600 rounded"></div>
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-4 mb-4">
          <button onClick={() => setActiveTab('DE')} className={`px-4 py-2 rounded-xl border ${activeTab === 'DE' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-white text-zinc-700 border-zinc-200'}`}>De-energise</button>
          <button onClick={() => setActiveTab('EN')} className={`px-4 py-2 rounded-xl border ${activeTab === 'EN' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-white text-zinc-700 border-zinc-200'}`}>Energise</button>
        </div>
        {/* Step lists */}
        <div id="export-content">
          {activeTab === 'DE' && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow">
              <div className="border-b border-zinc-200 p-4">
                <h2 className="text-lg font-semibold">De-energise – Make Safe</h2>
              </div>
              <div className="p-4">
                {DE_STEPS.map((s) => (
                  <StepRow key={s.id} step={s} />
                ))}
              </div>
            </div>
          )}
          {activeTab === 'EN' && (
            <div className="bg-white border border-zinc-200 rounded-xl shadow">
              <div className="border-b border-zinc-200 p-4">
                <h2 className="text-lg font-semibold">Energise – Return to Service</h2>
              </div>
              <div className="p-4">
                {EN_STEPS.map((s) => (
                  <StepRow key={s.id} step={s} />
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Confirmation and export */}
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-zinc-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs">Final confirmation unlocks only when every step has both technicians checked and locks verified (where required), and both typed signatures are present.</span>
          </div>
          <div>
            <button onClick={exportPDF} disabled={!allDone()} className={`flex items-center px-4 py-2 rounded-2xl ${allDone() ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
              <FileDown className="h-4 w-4 mr-2" />
              CONFIRM & EXPORT PDF (Technician Verification)
            </button>
          </div>
        </div>
        {/* Footer */}
        <div className="mt-8 text-center text-xs text-zinc-400">
          © {new Date().getFullYear()} Pyott Boone Electronics – HV Switching • CSS092 • Dual Technician Verification
        </div>
      </div>
    </div>
  );
}
