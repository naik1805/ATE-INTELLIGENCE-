import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import { OverviewTab } from './tabs/OverviewTab';
import { SingleEventTab } from './tabs/SingleEventTab';
import { BatchInferenceTab } from './tabs/BatchInferenceTab';
import { HistoricalValidationTab } from './tabs/HistoricalValidationTab';
import { ReferenceAuditTab } from './tabs/ReferenceAuditTab';
import { getMonth12Batch, getHistoricalValidation, validateOutcomes } from './services/api';
import {
  ackCacheRestore,
  readAgentCache,
  writeAgentCache,
} from '../../../shared/verilumenCache.js';

const RETEST_AGENT_ID = 'retest_reduction';

export default function App() {
  const [currentPage, setCurrentPage] = useState('overview');
  const [costPerHour, setCostPerHour] = useState(350.0);
  
  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('retest_ai_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('retest_ai_theme', theme);
  }, [theme]);

  // Data state
  const [dfM12, setDfM12] = useState([]);
  const [costImpact, setCostImpact] = useState(null);
  const [predictionSourceLabel, setPredictionSourceLabel] = useState('Month 12 (unseen inference)');
  const [activeOutcomes, setActiveOutcomes] = useState(null);
  const [outcomesLoaded, setOutcomesLoaded] = useState(false);
  const [validationData, setValidationData] = useState(null);
  const [histValidation, setHistValidation] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyRetestBootstrap = (boot) => {
    if (boot.records?.length) {
      setDfM12(boot.records);
      setCostImpact(boot.cost_impact ?? null);
      setPredictionSourceLabel(`Default data (${boot.source_file || 'uploaded'})`);
      return true;
    }
    return false;
  };

  const findOutcomesPayload = (boot, injectedFiles = []) => {
    if (!boot?.outcomes_file) {
      return injectedFiles.find((f) => /post_retest|outcome|validation/i.test(f.name));
    }
    return (
      injectedFiles.find(
        (f) =>
          f.name === boot.outcomes_file ||
          f.name.endsWith(`/${boot.outcomes_file}`) ||
          f.name.split('/').pop() === boot.outcomes_file,
      ) ||
      injectedFiles.find((f) => /post_retest|outcome|validation/i.test(f.name))
    );
  };

  const applyOutcomesValidation = (res, boot) => {
    setValidationData(res);
    setOutcomesLoaded(true);
    if (boot?.outcomes_file) {
      setPredictionSourceLabel((prev) => `${prev} + outcomes (${boot.outcomes_file})`);
    }
  };

  const saveRetestCache = (boot, records, validation, outcomesLoadedFlag, sourceLabel) => {
    writeAgentCache(RETEST_AGENT_ID, {
      records,
      cost_impact: boot?.cost_impact ?? null,
      source_file: boot?.source_file,
      outcomes_available: boot?.outcomes_available,
      outcomes_file: boot?.outcomes_file,
      validationData: validation ?? null,
      outcomesLoaded: outcomesLoadedFlag,
      predictionSourceLabel: sourceLabel,
    });
  };

  const restoreRetestCache = (payload) => {
    if (!payload?.records?.length) return false;
    setDfM12(payload.records);
    setCostImpact(payload.cost_impact ?? null);
    setPredictionSourceLabel(
      payload.predictionSourceLabel ||
        `Default data (${payload.source_file || 'cached'})`,
    );
    if (payload.validationData) {
      setValidationData(payload.validationData);
      setOutcomesLoaded(Boolean(payload.outcomesLoaded));
    }
    setLoading(false);
    return true;
  };

  const persistRetestCache = (boot, records, validation, outcomesLoadedFlag) => {
    const label =
      outcomesLoadedFlag && boot?.outcomes_file
        ? `Default data (${boot.source_file || 'uploaded'}) + outcomes (${boot.outcomes_file})`
        : `Default data (${boot?.source_file || 'uploaded'})`;
    saveRetestCache(boot, records, validation, outcomesLoadedFlag, label);
  };

  const loadDefaultOutcomes = async (boot, records, injectedFiles = []) => {
    if (!boot?.outcomes_available || !records?.length) return null;
    const predsJson = JSON.stringify(records);
    const dataBase =
      new URLSearchParams(window.location.search).get('dataBase') ||
      'http://127.0.0.1:3000/api/default-data';

    const payload = findOutcomesPayload(boot, injectedFiles);
    if (payload?.buffer) {
      try {
        const file = new File(
          [payload.buffer],
          payload.name.split('/').pop() || boot.outcomes_file || 'outcomes.xlsx',
          { type: payload.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        );
        const res = await validateOutcomes(file, false, predsJson);
        applyOutcomesValidation(res, boot);
        persistRetestCache(boot, records, res, true);
        return res;
      } catch (err) {
        console.warn('retest_reduction outcomes upload autoload failed', err);
      }
    }

    if (boot.outcomes_file) {
      try {
        const blob = await fetch(
          `${dataBase}/agents/retest_reduction/files/${encodeURIComponent(boot.outcomes_file)}`,
        ).then((r) => r.blob());
        const file = new File([blob], boot.outcomes_file, {
          type: blob.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const res = await validateOutcomes(file, false, predsJson);
        applyOutcomesValidation(res, boot);
        persistRetestCache(boot, records, res, true);
        return res;
      } catch (err) {
        console.warn('retest_reduction outcomes fetch autoload failed', err);
      }
    }

    try {
      const res = await validateOutcomes(null, true, predsJson);
      applyOutcomesValidation(res, boot);
      persistRetestCache(boot, records, res, true);
      return res;
    } catch (err) {
      console.warn('retest_reduction outcomes local autoload failed', err);
      return null;
    }
  };

  const hydrateFromBootstrap = async (boot, injectedFiles = []) => {
    if (!applyRetestBootstrap(boot)) return false;
    await loadDefaultOutcomes(boot, boot.records, injectedFiles);
    if (!boot.outcomes_available) {
      persistRetestCache(boot, boot.records, null, false);
    }
    return true;
  };

  // Initial load (skip API when dashboard autoload will inject default data)
  useEffect(() => {
    const autoload = new URLSearchParams(window.location.search).has('autoload');
    const dataBase =
      new URLSearchParams(window.location.search).get('dataBase') ||
      'http://127.0.0.1:3000/api/default-data';

    const cached = readAgentCache(RETEST_AGENT_ID);
    if (autoload && cached && restoreRetestCache(cached)) {
      ackCacheRestore(RETEST_AGENT_ID);
      return;
    }

    const onMessage = async (ev) => {
      if (ev.data?.type === 'verilumen-cache-restore' && ev.data.agentId === RETEST_AGENT_ID) {
        if (restoreRetestCache(ev.data.payload || {})) ackCacheRestore(RETEST_AGENT_ID);
        return;
      }
      if (ev.data?.type !== 'verilumen-autoload' || ev.data.agentId !== RETEST_AGENT_ID) return;
      const boot = ev.data.bootstrap || {};
      if (await hydrateFromBootstrap(boot, ev.data.files || [])) {
        setLoading(false);
      }
    };
    window.addEventListener('message', onMessage);

    if (autoload) {
      fetch(`${dataBase}/agents/retest_reduction/bootstrap`)
        .then((r) => r.json())
        .then(async (boot) => {
          if (await hydrateFromBootstrap(boot)) return;
          const res = await getMonth12Batch(costPerHour);
          setDfM12(res.records || []);
          setCostImpact(res.cost_impact);
        })
        .catch(async () => {
          const res = await getMonth12Batch(costPerHour);
          setDfM12(res.records || []);
          setCostImpact(res.cost_impact);
        })
        .finally(() => setLoading(false));

      return () => window.removeEventListener('message', onMessage);
    }

    Promise.all([
      getMonth12Batch(costPerHour).then(res => {
        setDfM12(res.records || []);
        setCostImpact(res.cost_impact);
      }),
      getHistoricalValidation().then(res => {
        setHistValidation(res);
      }),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));

    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    getHistoricalValidation().then(setHistValidation).catch(console.error);
  }, []);

  // Recalculate cost impact when costPerHour changes
  useEffect(() => {
    if (dfM12 && dfM12.length > 0) {
      getMonth12Batch(costPerHour).then(res => {
        setCostImpact(res.cost_impact);
      }).catch(console.error);
    }
  }, [costPerHour]);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-main)' }}>
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />

      <main style={{ flex: 1, height: '100vh', overflowY: 'auto', padding: '1.5rem 2rem 2rem 2rem' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
          <TopHeader theme={theme} setTheme={setTheme} />

          {currentPage === 'overview' && (
            <OverviewTab
              dfM12={dfM12}
              setDfM12={setDfM12}
              costImpact={costImpact}
              setCostImpact={setCostImpact}
              costPerHour={costPerHour}
              predictionSourceLabel={predictionSourceLabel}
              setPredictionSourceLabel={setPredictionSourceLabel}
              activeOutcomes={activeOutcomes}
              setActiveOutcomes={setActiveOutcomes}
              outcomesLoaded={outcomesLoaded}
              setOutcomesLoaded={setOutcomesLoaded}
              validationData={validationData}
              setValidationData={setValidationData}
              histValidation={histValidation}
            />
          )}

          {currentPage === 'single' && (
            <SingleEventTab costPerHour={costPerHour} />
          )}

          {currentPage === 'batch' && (
            <BatchInferenceTab dfM12={dfM12} costPerHour={costPerHour} />
          )}

          {currentPage === 'models' && (
            <HistoricalValidationTab histValidation={histValidation} />
          )}

          {currentPage === 'info' && (
            <ReferenceAuditTab costPerHour={costPerHour} setCostPerHour={setCostPerHour} mode="info" />
          )}

          {currentPage === 'settings' && (
            <ReferenceAuditTab costPerHour={costPerHour} setCostPerHour={setCostPerHour} mode="settings" />
          )}

          {currentPage === 'reference' && (
            <ReferenceAuditTab costPerHour={costPerHour} setCostPerHour={setCostPerHour} mode="audit" />
          )}
        </div>
      </main>
    </div>
  );
}
