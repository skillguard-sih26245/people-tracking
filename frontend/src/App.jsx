import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, Archive, ArrowRight, CheckCircle2, ChevronDown, CircleHelp, Clock3, Database, FileUp, Filter, LayoutDashboard, LockKeyhole, MapPin, Play, RefreshCw, Search, Settings, ShieldAlert, ShieldCheck, Upload, Users, X } from 'lucide-react';
import { api, evidenceUrl } from './api';
import EvidenceLightbox from './components/EvidenceLightbox';

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'centres', label: 'Training centres', icon: MapPin },
  { id: 'analysis', label: 'Session analysis', icon: Activity },
  { id: 'alerts', label: 'Compliance alerts', icon: ShieldAlert },
  { id: 'evidence', label: 'Evidence archive', icon: Archive },
  { id: 'admin', label: 'Administration', icon: Settings },
];

const fmt = (n) => Number.isFinite(Number(n)) ? Number(n).toLocaleString() : '—';
const dateLabel = (value) => value ? String(value).replace('T', ' ').slice(0, 16) : 'Timestamp unavailable';
const severity = (value) => ['critical', 'warning'].includes(String(value).toLowerCase()) ? String(value).toLowerCase() : 'healthy';
const alertRuleText = (alert) => ({
  attendance: 'Observed attendance differs from the reported count.',
  infrastructure: 'A persistent equipment shortfall was found across sampled observations.',
  operability: 'The apparent operability estimate fell below the configured threshold.',
}[String(alert.type || alert.alert_type || '').toLowerCase()] || 'A configured compliance threshold was triggered during session analysis.');

function App() {
  const [page, setPage] = useState('overview');
  const [centres, setCentres] = useState([]);
  const [alertsByCentre, setAlertsByCentre] = useState({});
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [samples, setSamples] = useState([]);
  const [health, setHealth] = useState('checking');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [file, setFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [reportedAttendance, setReportedAttendance] = useState('');
  const [requiredInventory, setRequiredInventory] = useState('');
  const [analysisJobId, setAnalysisJobId] = useState('');
  const [analysisJob, setAnalysisJob] = useState(null);
  const [analysisCentre, setAnalysisCentre] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [evidencePreview, setEvidencePreview] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const [list] = await Promise.all([api.getCentres(), api.getHealth().then(() => setHealth('connected')).catch(() => setHealth('unavailable'))]);
      const riskOrder = { critical: 0, warning: 1, normal: 2 };
      const ordered = [...list].sort((a, b) => riskOrder[a.risk_level] - riskOrder[b.risk_level] || (b.alert_count || 0) - (a.alert_count || 0));
      setCentres(ordered);
      setAnalysisCentre((current) => ordered.some((centre) => String(centre.id) === current) ? current : String(ordered[0]?.id || ''));
      const alertPairs = await Promise.all(ordered.map(async (c) => [c.id, await api.getCentreAlerts(c.id).catch(() => [])]));
      setAlertsByCentre(Object.fromEntries(alertPairs));
    } catch (err) {
      setLoadError(err?.response?.data?.detail || 'Unable to reach the analytics API. Check that the service is running, then refresh.');
      setHealth('unavailable');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!analysisJobId) return undefined;
    let cancelled = false;
    let timer;
    const poll = async () => {
      try {
        const job = await api.getAnalysisJob(analysisJobId);
        if (cancelled) return;
        setAnalysisJob(job);
        if (['completed', 'failed'].includes(job.status)) {
          setAnalysisJobId('');
          setNotice({ kind: job.status === 'completed' ? 'success' : 'error', text: job.message });
          if (job.status === 'completed') await refresh();
          return;
        }
      } catch (err) {
        if (cancelled) return;
        setAnalysisJobId('');
        setNotice({ kind: 'error', text: err?.response?.data?.detail || 'Unable to check video analysis progress.' });
        return;
      }
      timer = setTimeout(poll, 1000);
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [analysisJobId, refresh]);

  async function inspect(centre) {
    setSelected(centre); setDetail(null); setSamples([]);
    try {
      const [summary, sampleRows, alertRows] = await Promise.all([api.getCentreSummary(centre.id), api.getCentreSamples(centre.id), api.getCentreAlerts(centre.id)]);
      setDetail({ ...summary, alerts: alertRows }); setSamples(sampleRows || []);
    } catch (err) { setDetail({ error: err?.response?.data?.detail || 'Centre details could not be loaded.' }); }
  }

  const alerts = useMemo(() => Object.entries(alertsByCentre).flatMap(([id, rows]) => rows.map((a) => ({ ...a, centre_id: Number(id), centre: centres.find((c) => c.id === Number(id)) }))).sort((a, b) => Number(Boolean(a.resolved)) - Number(Boolean(b.resolved)) || String(b.ts || b.timestamp || '').localeCompare(String(a.ts || a.timestamp || ''))), [alertsByCentre, centres]);
  const availableDates = [...new Set(alerts.map((alert) => String(alert.ts || alert.timestamp || alert.created_at || '').slice(0, 10)).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort().reverse();
  const filteredAlerts = dateFilter === 'all' ? alerts : alerts.filter((alert) => String(alert.ts || alert.timestamp || alert.created_at || '').startsWith(dateFilter));
  const openAlerts = filteredAlerts.filter((a) => !a.resolved);
  const attention = centres.filter((c) => c.risk_level !== 'normal').length;
  const attendanceVariance = centres.filter((c) => Number(c.reported_attendance) !== Number(c.observed_attendance)).length;
  const matchingCentres = centres.filter((c) => `${c.name} ${c.region}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || c.risk_level === filter));
  const title = navItems.find((item) => item.id === page)?.label || 'Overview';
  const sourceKinds = [...new Set(centres.map((centre) => centre.source_type).filter(Boolean))];
  const sourceLabel = sourceKinds.length === 0 ? 'Waiting for source data'
    : sourceKinds.length > 1 ? 'Mixed configured sources'
      : sourceKinds[0] === 'synthetic' ? 'Simulated demo data'
        : sourceKinds[0] === 'video' ? 'Processed video data' : 'Configured session data';

  async function runAnalysis(e) {
    e?.preventDefault();
    if (!analysisCentre || !videoFile || reportedAttendance === '' || requiredInventory === '') return;
    setBusy(true); setNotice(null);
    try {
      const job = await api.uploadVideoForAnalysis({ file: videoFile, centreId: analysisCentre, reportedAttendance: Number(reportedAttendance), requiredInventory: Number(requiredInventory) });
      setAnalysisJob(job);
      setAnalysisJobId(job.job_id);
      setNotice({ kind: 'success', text: 'Video uploaded. Analysis is queued.' });
    }
    catch (err) { setNotice({ kind: 'error', text: err?.response?.data?.detail || 'Analysis could not be started.' }); }
    finally { setBusy(false); }
  }
  async function uploadCsv(e) {
    e.preventDefault(); if (!file) return;
    setBusy(true); setNotice(null);
    try { const result = await api.uploadAttendanceCsv(file); setNotice({ kind: 'success', text: result.message || 'Attendance records imported.' }); setFile(null); e.target.reset(); await refresh(); }
    catch (err) { setNotice({ kind: 'error', text: err?.response?.data?.detail || 'Upload failed. Check the CSV columns and values.' }); }
    finally { setBusy(false); }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Activity size={19}/></span><span>FIELD<span className="brand-light">SIGHT</span><small>OPERATIONS CONSOLE</small></span></div>
      <div className="side-label">WORKSPACE</div>
      <nav>{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setPage(id)} className={`nav-item ${page === id ? 'active' : ''}`}><Icon size={17}/><span>{label}</span>{id === 'alerts' && openAlerts.length > 0 && <b className="nav-count">{openAlerts.length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="privacy-chip"><LockKeyhole size={15}/><span><strong>Privacy by design</strong><small>Anonymous detections only</small></span></div><div className="profile"><div className="avatar">FO</div><span><strong>Field Operations</strong><small>Operations team</small></span><ChevronDown size={15}/></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div><div className="breadcrumbs">Operations <span>/</span> {title}</div><h1>{title}</h1></div><div className="top-controls"><label className="select-wrap"><MapPin size={15}/><select aria-label="Centre selector" value={selected?.id || ''} onChange={(e) => { const c = centres.find((x) => String(x.id) === e.target.value); if (c) inspect(c); else setSelected(null); }}><option value="">All centres</option>{centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown size={14}/></label><label className="select-wrap date-select"><select aria-label="Session date filter" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}><option value="all">All session dates</option>{availableDates.map((date) => <option key={date} value={date}>{date}</option>)}</select><ChevronDown size={14}/></label><button className="icon-button" aria-label="Refresh data" onClick={refresh}><RefreshCw size={16}/></button><div className="source-status"><span className={`status-dot ${health === 'connected' ? 'online' : health === 'checking' ? 'checking' : ''}`}/><span>{health === 'connected' ? 'API connected' : health === 'checking' ? 'Checking source' : 'Source unavailable'}</span></div></div></header>

      <div className="content">
        {notice && <div className={`notice ${notice.kind}`}><span>{notice.kind === 'success' ? <CheckCircle2 size={17}/> : <AlertCircle size={17}/>}</span>{notice.text}<button aria-label="Dismiss" onClick={() => setNotice(null)}><X size={16}/></button></div>}
        <div className="data-banner"><span className="banner-icon"><Database size={16}/></span><span><strong>{sourceLabel}</strong><span className="banner-copy">Results reflect completed analysis from configured centre sources. No live camera feeds are displayed.</span></span><button onClick={refresh} className="text-action"><RefreshCw size={14}/> Refresh</button></div>

        {page === 'overview' && <>
          <section className="metric-grid">
            <Metric icon={MapPin} label="Monitored centres" value={fmt(centres.length)} sub="Across all configured regions" />
            <Metric icon={AlertCircle} label="Require attention" value={fmt(attention)} sub="Warning or critical status" tone={attention ? 'warning' : 'healthy'} />
            <Metric icon={Users} label="Attendance variances" value={fmt(attendanceVariance)} sub="Reported and observed differ" tone={attendanceVariance ? 'warning' : 'healthy'} />
            <Metric icon={ShieldCheck} label="Open compliance alerts" value={fmt(openAlerts.length)} sub={`${centres.length - attention} centres within thresholds`} tone={openAlerts.length ? 'critical' : 'healthy'} />
          </section>
          <section className="section-block"><div className="section-heading"><div><div className="eyebrow">CENTRE MONITORING</div><h2>Operational status</h2><p>Centres ordered by current risk severity</p></div><button className="button-secondary" onClick={() => setPage('centres')}>View all centres <ArrowRight size={15}/></button></div>
            <CentreTable centres={centres.slice(0, 5)} onInspect={inspect}/>
          </section>
          <section className="section-block"><div className="section-heading compact"><div><div className="eyebrow">NEEDS REVIEW</div><h2>Recent unresolved alerts</h2></div><button className="text-action" onClick={() => setPage('alerts')}>View alert queue <ArrowRight size={14}/></button></div><AlertTable alerts={openAlerts.slice(0, 4)} onInspect={(a) => { const c = centres.find((x) => x.id === a.centre_id); if (c) inspect(c); }}/></section>
        </>}

        {page === 'centres' && <section className="section-block page-panel"><div className="section-heading"><div><div className="eyebrow">NETWORK DIRECTORY</div><h2>Training centres</h2><p>Review attendance, infrastructure compliance and risk by location.</p></div></div><div className="table-tools"><label className="search-box"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search centres or regions"/></label><label className="filter-box"><Filter size={15}/><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All risk levels</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="normal">Compliant</option></select></label></div><CentreTable centres={matchingCentres} onInspect={inspect}/></section>}

        {page === 'analysis' && <section className="section-block page-panel">
          <div className="eyebrow">VIDEO SESSION WORKFLOW</div>
          <h2>Analyze an MP4 session</h2>
          <p className="intro-copy">Upload the session video and enter the attendance and inventory counts to compare against the detected results.</p>
          <form className="analysis-form" onSubmit={runAnalysis}>
            <label>Training centre
              <select value={analysisCentre} onChange={(e) => setAnalysisCentre(e.target.value)} required>
                <option value="">Select a centre</option>
                {centres.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.region})</option>)}
              </select>
            </label>
            <label className="video-file-picker">
              <Upload size={20}/>
              <strong>{videoFile?.name || 'Choose an MP4 video'}</strong>
              <span>Video is processed for aggregate attendance and inventory counts.</span>
              <input type="file" accept="video/mp4,.mp4" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} required />
            </label>
            <div className="analysis-inputs">
              <label>Reported attendance
                <input type="number" min="0" step="1" value={reportedAttendance} onChange={(e) => setReportedAttendance(e.target.value)} placeholder="Enter reported people" required />
              </label>
              <label>Required inventory count
                <input type="number" min="0" step="1" value={requiredInventory} onChange={(e) => setRequiredInventory(e.target.value)} placeholder="Enter required items" required />
              </label>
            </div>
            <div className="source-summary"><Database size={19}/><div><strong>Uploaded video source</strong><span>Analysis runs on this MP4. Only sampled frames are analyzed; no live camera feed is started.</span></div></div>
            {analysisJob && ['queued', 'processing'].includes(analysisJob.status) && <div className="analysis-progress" role="status"><div><strong>{analysisJob.status === 'queued' ? 'Queued for analysis' : 'Analyzing video'}</strong><span>{analysisJob.processed_samples || 0}{analysisJob.total_samples ? ` of ${analysisJob.total_samples}` : ''} sampled frames processed</span></div><progress value={analysisJob.processed_samples || 0} max={analysisJob.total_samples || 1}/></div>}
            <button className="button-primary" type="submit" disabled={!analysisCentre || !videoFile || reportedAttendance === '' || requiredInventory === '' || busy || Boolean(analysisJobId) || health !== 'connected'}>{busy || analysisJobId ? <><RefreshCw size={16} className="spin"/> Analyzing video...</> : <><Play size={15} fill="currentColor"/> Upload and analyze</>}</button>
          </form>
          <p className="helper-line"><CircleHelp size={14}/> Enter the attendance reported for this session and the expected total inventory count.</p>
        </section>}

        {page === 'alerts' && <section className="section-block page-panel"><div className="section-heading"><div><div className="eyebrow">AUDIT QUEUE</div><h2>Compliance alerts</h2><p>{openAlerts.length} unresolved · {filteredAlerts.length - openAlerts.length} resolved</p></div><div className="alert-legend"><span className="status critical">Critical</span><span className="status warning">Warning</span></div></div><AlertTable alerts={filteredAlerts} onInspect={(a) => { const c = centres.find((x) => x.id === a.centre_id); if (c) inspect(c); }}/></section>}

        {page === 'evidence' && <section className="section-block page-panel"><div className="eyebrow">PRIVACY-SENSITIVE RECORDS</div><h2>Evidence archive</h2><p className="intro-copy">Evidence is linked to processed alerts and should be accessed only for operational review. Person detections are anonymous; faces are not retained.</p><div className="evidence-grid">{filteredAlerts.filter((a) => a.evidence_url || a.evidence_path).map((a, i) => { const src = evidenceUrl(a.evidence_url, a.evidence_path); const centre = centres.find((x) => x.id === a.centre_id); return <article className="evidence-card" key={a.id || `${a.centre_id}-${i}`}><div className="evidence-image"><button type="button" className="evidence-image-button" aria-label="Open evidence image to zoom" onClick={() => setEvidencePreview({ src, alt: 'Processed alert evidence' })}><img src={src} alt="Processed alert evidence"/></button><span className={`status ${severity(a.level)}`}>{a.level || 'Alert'}</span></div><div className="evidence-info"><strong>{a.type || a.alert_type || 'Compliance alert'}</strong><span>{a.centre?.name || `Centre ${a.centre_id}`} · {dateLabel(a.ts || a.timestamp)}</span><button className="evidence-open-related" type="button" onClick={() => centre && inspect(centre)}>Open related centre record <ArrowRight size={12}/></button></div></article>; })}</div>{filteredAlerts.filter((a) => a.evidence_url || a.evidence_path).length === 0 && <EmptyState text="No evidence records are available for the loaded alerts."/>}</section>}

        {page === 'admin' && <div className="admin-grid"><section className="section-block page-panel"><div className="eyebrow">ATTENDANCE RECORDS</div><h2>Import reported attendance</h2><p className="intro-copy">Upload the session attendance CSV to compare reported counts with observed session results.</p><form className="upload-form" onSubmit={uploadCsv}><label className="file-drop"><Upload size={22}/><strong>{file?.name || 'Choose a CSV file'}</strong><span>Required columns: centre_id, session_start, session_end, reported_count</span><input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)}/></label><button type="submit" className="button-primary" disabled={!file || busy || health !== 'connected'}>{busy ? <><RefreshCw size={16} className="spin"/> Uploading…</> : <><FileUp size={16}/> Upload attendance</>}</button></form></section><section className="section-block page-panel"><div className="eyebrow">PROCESSING</div><h2>Run analysis</h2><p className="intro-copy">Select the centre whose configured session source should be processed.</p><label className="standalone-select">Training centre<select value={analysisCentre} onChange={(e) => setAnalysisCentre(e.target.value)}><option value="">Select a centre</option>{centres.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.region}</option>)}</select></label><button className="button-secondary" type="button" onClick={() => setPage('analysis')}><Play size={15} fill="currentColor"/> Upload video and analyze</button><div className="admin-note"><Clock3 size={16}/> Choose the MP4 and enter reported attendance and required inventory on Session analysis.</div></section></div>}

        {loading && <div className="loading-line"><RefreshCw size={16} className="spin"/> Loading centre and alert records…</div>}
        {!loading && loadError && <div className="error-state"><AlertCircle size={21}/><div><strong>Data source unavailable</strong><p>{loadError}</p></div><button className="button-secondary" onClick={refresh}>Retry</button></div>}
        {!loading && !loadError && page === 'overview' && centres.length === 0 && <EmptyState text="No centres are configured yet. Add centre records to begin monitoring."/>}
      </div>
    </main>
    {selected && <CentreDrawer centre={selected} data={detail} samples={samples} onClose={() => setSelected(null)} onOpenEvidence={(preview) => setEvidencePreview(preview)}/>}
    {evidencePreview && <EvidenceLightbox src={evidencePreview.src} alt={evidencePreview.alt} onClose={() => setEvidencePreview(null)}/>}
  </div>;
}

function Metric({ icon: Icon, label, value, sub, tone }) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><Icon size={17}/></div><strong className={tone ? `metric-value ${tone}` : 'metric-value'}>{value}</strong><small>{sub}</small></div>; }

function Status({ level }) { const s = severity(level); return <span className={`status ${s}`}><i/>{s === 'healthy' ? 'Compliant' : s}</span>; }

function CentreTable({ centres, onInspect }) { return <div className="table-wrap"><table><thead><tr><th>Training centre</th><th className="numeric">Reported</th><th className="numeric">Observed p90</th><th className="numeric">Variance</th><th>Infrastructure</th><th className="numeric">Open alerts</th><th>Risk</th><th/></tr></thead><tbody>{centres.map((c) => { const diff = Number(c.observed_attendance || 0) - Number(c.reported_attendance || 0); return <tr key={c.id}><td><strong>{c.name}</strong><small>{c.region} · Centre {String(c.id).padStart(2, '0')}</small></td><td className="numeric">{fmt(c.reported_attendance)}</td><td className="numeric">{fmt(c.observed_attendance)}</td><td className={`numeric variance ${diff !== 0 ? 'flagged' : ''}`}>{diff > 0 ? '+' : ''}{fmt(diff)}</td><td><div className="compliance-cell"><div className="compliance-track"><i style={{ width: `${Math.max(0, Math.min(100, Number(c.infra_compliance_score || 0) * 100))}%` }}/></div><span>{Math.round(Number(c.infra_compliance_score || 0) * 100)}%</span></div></td><td className="numeric">{fmt(c.alert_count || 0)}</td><td><Status level={c.risk_level}/></td><td><button className="inspect-button" onClick={() => onInspect(c)}>Inspect <ArrowRight size={14}/></button></td></tr>; })}</tbody></table>{centres.length === 0 && <EmptyState text="No centres match the selected filters."/>}</div>; }

function AlertTable({ alerts, onInspect }) { return <div className="table-wrap"><table className="alert-table"><thead><tr><th>Alert</th><th>Centre / session</th><th>Recorded</th><th>Measurement</th><th>Recurrence</th><th>Status</th><th/></tr></thead><tbody>{alerts.map((a, i) => <tr key={a.id || `${a.centre_id}-${i}`}><td><div className="alert-title"><Status level={a.level}/><strong>{a.type || a.alert_type || a.rule || 'Compliance threshold'}</strong></div><small>{a.message || a.description || alertRuleText(a)}</small></td><td>{a.centre?.name || `Centre ${a.centre_id}`}<small>{a.session_start ? dateLabel(a.session_start) : 'Processed session'}</small></td><td>{dateLabel(a.ts || a.timestamp || a.created_at)}</td><td>{a.value != null ? `${a.value}${a.threshold != null ? ` / ${a.threshold}` : ''}` : 'See alert details'}</td><td>{a.persistence || a.recurrence || a.occurrences ? `${a.persistence || a.recurrence || a.occurrences} occurrences` : 'Single observation'}</td><td><span className={`resolution ${a.resolved ? 'resolved' : 'unresolved'}`}>{a.resolved ? 'Resolved' : 'Unresolved'}</span></td><td><button className="inspect-button" onClick={() => onInspect(a)}>Details <ArrowRight size={14}/></button></td></tr>)}</tbody></table>{alerts.length === 0 && <EmptyState text="No alerts are recorded for this view."/>}</div>; }

function EmptyState({ text }) { return <div className="empty-state"><CheckCircle2 size={19}/><span>{text}</span></div>; }

function CentreDrawer({ centre, data, samples, onClose, onOpenEvidence }) {
  const [tab, setTab] = useState('summary');
  return <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><aside className="centre-drawer"><div className="drawer-head"><div><div className="eyebrow">CENTRE RECORD · {String(centre.id).padStart(2, '0')}</div><h2>{centre.name}</h2><p><MapPin size={14}/>{centre.region}</p></div><button className="icon-button" onClick={onClose} aria-label="Close centre details"><X size={18}/></button></div><div className="drawer-tabs"><button className={tab === 'summary' ? 'selected' : ''} onClick={() => setTab('summary')}>Session summary</button><button className={tab === 'alerts' ? 'selected' : ''} onClick={() => setTab('alerts')}>Alerts & evidence</button></div>{!data ? <div className="drawer-loading"><RefreshCw size={17} className="spin"/> Loading centre details</div> : data.error ? <div className="drawer-error">{data.error}</div> : tab === 'summary' ? <div className="drawer-content"><div className="detail-source"><Database size={15}/> Processed session data</div><div className="detail-stats"><div><span>Reported attendance</span><strong>{fmt(data.reported_attendance)}</strong></div><div><span>Observed attendance p90</span><strong>{fmt(data.observed_attendance_p90)}</strong></div><div><span>Attendance variance</span><strong>{Math.round(Number(data.attendance_deviation_ratio || 0) * 100)}%</strong></div><div><span>Infrastructure compliance</span><strong>{Math.round(Number(data.infra_compliance_score || 0) * 100)}%</strong></div></div><h3>Equipment inventory compliance</h3><div className="inventory-list">{(data.inventory || []).map((item) => <div className="inventory-row" key={item.class}><div><strong>{item.class}</strong><span>{fmt(item.observed_p90)} observed of {fmt(item.required)} required · {fmt(item.missing)} missing</span></div><Status level={item.status}/><small className="operability">Apparent operability <b>{Math.round(Number(item.apparent_operability || 0) * 100)}%</b></small></div>)}{!data.inventory?.length && <p className="quiet">No inventory records are available.</p>}</div><p className="probability-note"><CircleHelp size={15}/> Apparent operability is a probabilistic visual estimate. Presence or proximity does not establish that equipment is mechanically functional.</p><h3>Person-count trend</h3><div className="trend-chart">{samples.slice(-36).map((s, i) => <span key={s.ts || i} title={`${s.person_count} persons`} style={{ height: `${Math.max(7, Math.min(100, Number(s.person_count || 0) * 4))}%` }}/>)}</div><div className="chart-caption"><span>Session samples</span><span>{samples.length} processed observations</span></div></div> : <div className="drawer-content"><AlertTable alerts={(data.alerts || []).map((a) => ({ ...a, centre }))} onInspect={() => {}}/>{(data.alerts || []).map((a, i) => { const src = evidenceUrl(a.evidence_url, a.evidence_path); return (a.evidence_url || a.evidence_path) && <div className="detail-evidence" key={a.id || i}><button type="button" className="detail-evidence-image" aria-label="Open evidence image to zoom" onClick={() => onOpenEvidence({ src, alt: 'Processed alert evidence' })}><img src={src} alt="Processed alert evidence"/></button><div><strong>{a.type || a.alert_type || 'Alert evidence'}</strong><span>{dateLabel(a.ts || a.timestamp)}</span><small>Privacy-sensitive processed evidence</small></div></div>; })}<div className="privacy-note"><LockKeyhole size={16}/> Person detections are anonymous. Faces must not be retained; evidence access is restricted to review.</div></div>}</aside></div>;
}

export default App;
