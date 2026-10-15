import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Band, Hero } from '../components/Layout.jsx';
import {
  DeliverabilityScore,
  EmailPreview,
  FileDrop,
  PlaceholderMap,
  StepRail,
} from '../components/compose.jsx';
import {
  Badge,
  Card,
  ErrorNote,
  Field,
  ProgressBar,
  SectionHeading,
  Select,
  SpeederModal,
  Spinner,
  Table,
  useAsync,
  useInterval,
  useToast,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { CHART_COLORS, formatNumber, formatRelative, toneFor } from '../lib/format.js';

const STEPS = [
  { id: 'audience', label: 'Upload recipients' },
  { id: 'message', label: 'Compose message' },
  { id: 'review', label: 'Review and send' },
];

const emptyDraft = {
  name: '',
  subject: '',
  preheader: '',
  html: '',
  fromName: '',
  fromEmail: '',
  replyTo: '',
};

export default function Send() {
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);

  // audience
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [listId, setListId] = useState('');
  const [emailColumnOverride, setEmailColumnOverride] = useState('');

  // message
  const [templateId, setTemplateId] = useState('');
  const [draft, setDraft] = useState(emptyDraft);
  const [defaults, setDefaults] = useState({});
  const [mapping, setMapping] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [preview, setPreview] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [checking, setChecking] = useState(false);

  // review
  const [ratePerMinute, setRatePerMinute] = useState(60);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const [sendError, setSendError] = useState(null);

  const bodyRef = useRef(null);

  const lists = useAsync(() => api.lists.all(), []);
  const templates = useAsync(() => api.templates.all(), []);
  const config = useAsync(() => api.system.config(), []);

  const selectedList = useMemo(
    () => (lists.data || []).find((item) => String(item._id) === String(listId)) || null,
    [lists.data, listId],
  );

  const columns = selectedList?.columns || uploadResult?.summary?.columns || [];
  const recipientCount =
    selectedList?.counts?.subscribed ?? uploadResult?.summary?.readyToSend ?? 0;

  // Seed sender identity from the server config once.
  useEffect(() => {
    if (!config.data) return;
    setDraft((current) => ({
      ...current,
      fromName: current.fromName || config.data.sender.name || '',
      fromEmail: current.fromEmail || config.data.sender.email || '',
      replyTo: current.replyTo || config.data.sender.replyTo || '',
    }));
    setRatePerMinute((current) => config.data.sending?.ratePerMinute || current);
  }, [config.data]);

  /* ------------------------------------------------------------- upload */

  const runUpload = useCallback(
    async (picked, overrideColumn) => {
      setUploading(true);
      setUploadError(null);
      setUploadProgress(0);
      try {
        const result = await api.lists.upload(picked, {
          emailColumn: overrideColumn || undefined,
          onProgress: setUploadProgress,
        });
        setUploadResult(result);
        setListId(String(result.list._id));
        setEmailColumnOverride(result.summary.emailColumn);
        lists.refetch();
        toast.success(
          `${formatNumber(result.summary.readyToSend)} recipients ready from ${result.summary.totalRows} rows.`,
          'File processed',
        );
      } catch (error) {
        setUploadError(error);
        setUploadResult(null);
        toast.error(error.message, 'Upload failed');
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast, lists.refetch],
  );

  const onFile = (picked) => {
    setFile(picked);
    setEmailColumnOverride('');
    runUpload(picked, '');
  };

  /* ------------------------------------------- live mapping and preview */

  const draftKey = `${draft.subject}|${draft.preheader}|${draft.html}|${listId}|${JSON.stringify(defaults)}`;

  useEffect(() => {
    if (step !== 1 && step !== 2) return undefined;
    if (!draft.subject && !draft.html) {
      setMapping([]);
      setPreview(null);
      setAnalysis(null);
      return undefined;
    }

    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const payload = {
          subject: draft.subject,
          preheader: draft.preheader,
          html: draft.html,
          fromName: draft.fromName,
          fromEmail: draft.fromEmail,
          listId: listId || undefined,
          defaults,
        };
        const [placeholderResult, previewResult, analysisResult] = await Promise.all([
          api.templates.placeholders(payload),
          api.templates.preview(payload),
          api.templates.analyze(payload),
        ]);
        setMapping(placeholderResult.mapping);
        setUnmatched(placeholderResult.unmatched);
        setPreview(previewResult);
        setAnalysis(analysisResult);
      } catch (error) {
        toast.error(error.message, 'Preview failed');
      } finally {
        setChecking(false);
      }
    }, 600);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, step]);

  const loadTemplate = async (id) => {
    setTemplateId(id);
    if (!id) return;
    try {
      const template = await api.templates.one(id);
      setDraft((current) => ({
        ...current,
        name: current.name || template.name,
        subject: template.subject,
        preheader: template.preheader || '',
        html: template.html,
        fromName: template.fromName || current.fromName,
        fromEmail: template.fromEmail || current.fromEmail,
        replyTo: template.replyTo || current.replyTo,
      }));
      setDefaults(template.defaults || {});
    } catch (error) {
      toast.error(error.message, 'Could not load template');
    }
  };

  const insertToken = (column) => {
    const token = `{${column}}`;
    const textarea = bodyRef.current;
    if (!textarea) {
      setDraft((current) => ({ ...current, html: `${current.html}${token}` }));
      return;
    }
    const start = textarea.selectionStart ?? draft.html.length;
    const end = textarea.selectionEnd ?? start;
    const next = `${draft.html.slice(0, start)}${token}${draft.html.slice(end)}`;
    setDraft((current) => ({ ...current, html: next }));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    });
  };

  /* ---------------------------------------------------------- send flow */

  const sendTest = async () => {
    if (!testTo.trim()) {
      toast.error('Enter an address to send the test to.');
      return;
    }
    setTesting(true);
    try {
      const result = await api.campaigns.test({
        to: testTo.trim(),
        listId: listId || undefined,
        subject: draft.subject,
        preheader: draft.preheader,
        html: draft.html,
        fromName: draft.fromName,
        fromEmail: draft.fromEmail,
        replyTo: draft.replyTo,
        defaults,
      });
      toast.success(
        `Sent to ${result.to}${result.viaApiFallback ? ' via fallback relay' : ''}.`,
        'Test delivered',
      );
    } catch (error) {
      toast.error(error.message, 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const sendCampaign = async ({ allowUnmatched = false } = {}) => {
    setSending(true);
    setSendError(null);
    try {
      const result = await api.campaigns.send({
        name: draft.name || undefined,
        listId,
        templateId: templateId || undefined,
        subject: draft.subject,
        preheader: draft.preheader,
        html: draft.html,
        fromName: draft.fromName,
        fromEmail: draft.fromEmail,
        replyTo: draft.replyTo,
        defaults,
        ratePerMinute,
        allowUnmatched,
      });
      setCampaign(result.campaign);
      toast.success(result.message, 'Campaign started');
    } catch (error) {
      setSendError(error);
      toast.error(error.message, 'Could not start the campaign');
    } finally {
      setSending(false);
    }
  };

  const liveCampaign = useCallback(async () => {
    if (!campaign?._id) return;
    try {
      const fresh = await api.campaigns.one(campaign._id);
      setCampaign(fresh);
    } catch {
      /* keep the last known state */
    }
  }, [campaign?._id]);

  const isRunning = campaign && ['sending', 'queued', 'paused'].includes(campaign.status);
  useInterval(liveCampaign, 3000, Boolean(isRunning));

  const canLeaveAudience = Boolean(listId) && recipientCount > 0;
  const canLeaveMessage = Boolean(draft.subject.trim() && draft.html.trim());

  /* -------------------------------------------------- live progress view */

  if (campaign) {
    const stats = campaign.stats || {};
    return (
      <>
        <Hero
          eyebrow={`Campaign ${campaign.status}`}
          title={campaign.name}
          lead={`Dispatching one message per recipient at ${campaign.ratePerMinute} per minute through the dedicated SMTP relay pool.`}
          cta={
            <Link to={`/campaigns/${campaign._id}`} className="btn-buy-cta font-medium">
              Open campaign telemetry
            </Link>
          }
          secondary={
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setCampaign(null);
                setStep(0);
                setFile(null);
                setUploadResult(null);
                setDraft(emptyDraft);
                setTemplateId('');
                setListId('');
              }}
            >
              Start another send
            </button>
          }
        />
        <Band>
          <Card className="p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge status={campaign.status} />
                {isRunning ? <Spinner size={18} /> : null}
              </div>
              <p className="font-text text-[14px] text-steel">
                {formatNumber(stats.sent || 0)} delivered · {formatNumber(stats.failed || 0)} failed ·{' '}
                {formatNumber(stats.queued || 0)} in queue
              </p>
            </div>
            <div className="mt-6">
              <ProgressBar value={campaign.progress || 0} tone={toneFor(campaign.status).color} />
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-4">
              {[
                { label: 'Recipients', value: stats.total || 0, tone: '#0a1317' },
                { label: 'Delivered', value: stats.sent || 0, tone: '#31a24c' },
                { label: 'Failed', value: stats.failed || 0, tone: '#e41e3f' },
                { label: 'Suppressed', value: stats.skipped || 0, tone: '#5d6c7b' },
              ].map((cell) => (
                <div key={cell.label} className="rounded-[20px] border border-hairline-soft bg-surface-soft/40 p-5">
                  <p className="font-display text-[12px] font-bold uppercase tracking-wider text-steel">
                    {cell.label}
                  </p>
                  <p
                    className="mt-2 font-display text-[30px] font-bold leading-none"
                    style={{ color: cell.tone }}
                  >
                    {formatNumber(cell.value)}
                  </p>
                </div>
              ))}
            </div>
            {campaign.error ? (
              <p className="mt-4 font-text text-[14px] text-critical">{campaign.error}</p>
            ) : null}
          </Card>
        </Band>
      </>
    );
  }

  /* ----------------------------------------------------------- wizard UI */

  return (
    <>
      <SpeederModal
        active={sending || testing}
        message={sending ? 'Launching campaign at supersonic speed…' : 'Delivering test email via Brevo relay…'}
      />
      <div className="bg-white border-b border-control-gray px-6 py-6 sm:px-8">
        <div className="mx-auto max-w-content flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-[22px] sm:text-[26px] font-semibold text-ink">
              New Campaign Send
            </h1>
            <p className="font-text text-[13.5px] text-slate mt-0.5">
              Upload recipients, personalize message content, and launch dispatch.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/campaigns" className="btn-secondary btn-sm font-medium">
              View Campaigns
            </Link>
          </div>
        </div>
      </div>

      <Band tight>
        <div className="mb-8 flex items-center justify-between border-b border-control-gray pb-5">
          <StepRail
            steps={STEPS.map((item, index) => ({
              ...item,
              reachable:
                index === 0 || (index === 1 && canLeaveAudience) || (index === 2 && canLeaveMessage),
            }))}
            current={step}
            onSelect={(index) => {
              if (index === 1 && !canLeaveAudience) return;
              if (index === 2 && !canLeaveMessage) return;
              setStep(index);
            }}
          />

          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-surface-soft px-3 py-1 font-display text-[12px] font-bold text-steel border border-hairline-soft">
            Step {step + 1} of 3
          </span>
        </div>

        {/* ------------------------------------------------ step 1: audience */}
        {/* ------------------------------------------------ step 1: audience */}
        {step === 0 ? (
          <div className="space-y-8 w-full">
            <Card className="p-8 w-full">
              <SectionHeading sub="CSV, XLS, or XLSX. Column headers automatically become {placeholder} keys.">
                Upload Recipient Audience
              </SectionHeading>
              <FileDrop
                file={file}
                onFile={onFile}
                disabled={uploading}
                progress={uploadProgress}
              />
              {uploading ? (
                <div className="mt-6 flex flex-col items-center justify-center rounded-[24px] border border-control-gray bg-studio-mist/70 py-8 px-6 text-center">
                  <Spinner size={36} />
                  <p className="mt-4 font-display text-[15px] font-semibold text-ink">
                    Parsing spreadsheet and validating syntax…
                  </p>
                  <p className="mt-1 font-text text-[13px] text-slate">
                    Reading columns, verifying email format, and removing duplicates
                  </p>
                  {uploadProgress > 0 && uploadProgress < 100 ? (
                    <div className="mt-4 w-48">
                      <ProgressBar value={uploadProgress} />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <ErrorNote error={uploadError} />
            </Card>

            {uploadResult ? (
              <Card className="overflow-hidden p-0 border border-control-gray rounded-[28px] bg-white w-full">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-control-gray px-7 py-5 bg-white">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#107c41]/10 text-[#107c41]">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="8" y1="13" x2="16" y2="13" />
                        <line x1="8" y1="17" x2="16" y2="17" />
                        <line x1="10" y1="9" x2="8" y2="9" />
                      </svg>
                    </span>
                    <div>
                      <h3 className="font-display text-[17px] font-semibold text-ink">
                        Recipient Preview
                      </h3>
                      <p className="font-text text-[13px] text-slate">
                        Showing first {uploadResult.preview.length} of {formatNumber(uploadResult.summary.valid)} valid records ({uploadResult.summary.columns?.length || 0} columns detected)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-control-gray bg-studio-mist px-3 py-1 font-display text-[12px] font-medium text-slate">
                      {uploadResult.summary.columns?.length || 0} Columns
                    </span>
                    <span className="rounded-full border border-[#107c41]/20 bg-[#107c41]/10 px-3 py-1 font-display text-[12px] font-semibold text-[#107c41]">
                      Excel Grid
                    </span>
                    <button
                      type="button"
                      className="btn-emerald btn-sm shadow-sm font-medium px-5 py-2 flex items-center gap-1.5"
                      disabled={!canLeaveAudience}
                      onClick={() => setStep(1)}
                    >
                      Continue to Message →
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-studio-mist border-b border-control-gray">
                        <th className="w-14 border-r border-control-gray px-3 py-2.5 text-center font-mono text-[11px] font-bold uppercase tracking-wider text-steel select-none bg-studio-mist">
                          #
                        </th>
                        {(uploadResult.summary.columns || []).map((col, idx) => {
                          const isEmailCol = col === uploadResult.summary.emailColumn;
                          const colLetter = idx < 26 ? String.fromCharCode(65 + idx) : `${String.fromCharCode(65 + Math.floor(idx / 26) - 1)}${String.fromCharCode(65 + (idx % 26))}`;
                          return (
                            <th
                              key={col}
                              className="border-r border-control-gray px-4 py-2.5 font-display text-[12px] font-semibold text-ink whitespace-nowrap bg-studio-mist"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-steel select-none">
                                  {colLetter}
                                </span>
                                <span>{col}</span>
                                {isEmailCol ? (
                                  <span className="rounded bg-pricing-blue/10 px-1.5 py-0.5 font-display text-[10px] font-semibold text-pricing-blue">
                                    Email
                                  </span>
                                ) : null}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-control-gray">
                      {uploadResult.preview.map((row, rowIndex) => (
                        <tr
                          key={row.email || rowIndex}
                          className="hover:bg-studio-mist/60 transition-colors"
                        >
                          <td className="border-r border-control-gray bg-studio-mist/30 px-3 py-2.5 text-center font-mono text-[11.5px] font-medium text-steel select-none">
                            {row.rowNumber ?? rowIndex + 1}
                          </td>
                          {(uploadResult.summary.columns || []).map((col) => {
                            const isEmailCol = col === uploadResult.summary.emailColumn;
                            const val =
                              row.data?.[col] !== undefined && row.data?.[col] !== null && String(row.data[col]).trim() !== ''
                                ? String(row.data[col])
                                : (isEmailCol ? row.email : '—');
                            return (
                              <td
                                key={col}
                                className={`border-r border-control-gray px-4 py-2.5 font-text text-[13px] whitespace-nowrap max-w-[280px] truncate ${
                                  isEmailCol ? 'font-medium text-ink' : 'text-slate'
                                }`}
                                title={val}
                              >
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}

        {/* ------------------------------------------------- step 2: message */}
        {step === 1 ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-8">
              <Card className="p-8">
                <SectionHeading sub="Compose your email with inline {tokens} or choose from existing templates.">
                  Message Content
                </SectionHeading>

                <div className="space-y-5">
                  <Field label="Choose Saved Template" htmlFor="template-select">
                    <Select
                      id="template-select"
                      value={templateId}
                      onChange={(event) => loadTemplate(event.target.value)}
                    >
                      <option value="">Write a new custom message</option>
                      {(templates.data || []).map((template) => (
                        <option key={template._id} value={template._id}>
                          {template.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Internal Campaign Name" hint="For internal organization only." htmlFor="campaign-name">
                    <input
                      id="campaign-name"
                      className="field"
                      placeholder="e.g. Product Launch Announcement"
                      value={draft.name}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    />
                  </Field>

                  <Field label="Subject Line" required htmlFor="subject">
                    <input
                      id="subject"
                      className="field"
                      placeholder="Hi {name}, look forward to what's next"
                      value={draft.subject}
                      onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                    />
                  </Field>

                  <Field
                    label="Preview Preheader"
                    hint="Displays alongside the subject in modern email clients."
                    htmlFor="preheader"
                  >
                    <input
                      id="preheader"
                      className="field"
                      placeholder="Concise secondary highlight that drives open engagement"
                      value={draft.preheader}
                      onChange={(event) => setDraft({ ...draft, preheader: event.target.value })}
                    />
                  </Field>

                  <Field
                    label="Email HTML Body"
                    required
                    hint="Insert tokens like {first_name}. Use fallbacks like {name|there} for missing rows."
                    htmlFor="body"
                  >
                    <textarea
                      id="body"
                      ref={bodyRef}
                      rows={14}
                      className="field-mono"
                      placeholder={'<p>Hi {name},</p>\n<p>We are delighted to share our latest updates with {company}.</p>'}
                      value={draft.html}
                      onChange={(event) => setDraft({ ...draft, html: event.target.value })}
                    />
                  </Field>
                </div>
              </Card>

              <Card className="p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-display text-[18px] font-medium text-ink-deep">Placeholder Token Resolution</h3>
                    <p className="mt-0.5 font-text text-[13px] text-steel">
                      Tokens are resolved fuzzy against spreadsheet columns (e.g. {'{first_name}'} matches “First Name”).
                    </p>
                  </div>
                  {checking ? <Spinner size={18} /> : null}
                </div>
                <div className="mt-5">
                  <PlaceholderMap
                    mapping={mapping}
                    columns={columns}
                    onInsert={insertToken}
                    defaults={defaults}
                    onDefault={(key, value) => setDefaults({ ...defaults, [key]: value })}
                  />
                </div>
              </Card>
            </div>

            <div className="space-y-8">
              <EmailPreview
                html={preview?.html}
                subject={preview?.subject || draft.subject}
                from={preview?.from || { name: draft.fromName, email: draft.fromEmail }}
                to={preview?.usedContact?.email}
              />

              <Card className="p-8">
                <h3 className="font-display text-[18px] font-medium text-ink-deep">Deliverability & Spam Heuristics</h3>
                <p className="mb-4 mt-0.5 font-text text-[13px] text-steel">
                  Syntactic inspection of content, links, images, and trigger words.
                </p>
                <DeliverabilityScore analysis={analysis} loading={checking} />
              </Card>

              <div className="flex flex-wrap gap-4 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setStep(0)}>
                  ← Back to Audience
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={!canLeaveMessage}
                  onClick={() => setStep(2)}
                >
                  Review and Configure →
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* -------------------------------------------------- step 3: review */}
        {step === 2 ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div className="space-y-8">
              <Card className="p-8">
                <SectionHeading sub="Verified sender identity required for DKIM and DMARC alignment.">
                  Sender Identity Configuration
                </SectionHeading>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="From Name" htmlFor="from-name">
                    <input
                      id="from-name"
                      className="field"
                      value={draft.fromName}
                      onChange={(event) => setDraft({ ...draft, fromName: event.target.value })}
                    />
                  </Field>
                  <Field
                    label="From Address"
                    required
                    hint="Must correspond to your authenticated sending domain."
                    htmlFor="from-email"
                  >
                    <input
                      id="from-email"
                      type="email"
                      className="field"
                      value={draft.fromEmail}
                      onChange={(event) => setDraft({ ...draft, fromEmail: event.target.value })}
                    />
                  </Field>
                  <Field label="Reply-To Address" htmlFor="reply-to">
                    <input
                      id="reply-to"
                      type="email"
                      className="field"
                      value={draft.replyTo}
                      onChange={(event) => setDraft({ ...draft, replyTo: event.target.value })}
                    />
                  </Field>
                  <Field
                    label="Transmission Rate (per min)"
                    hint="Throttling rate to maintain domain reputation."
                    htmlFor="rate"
                  >
                    <input
                      id="rate"
                      type="number"
                      min={1}
                      max={600}
                      className="field"
                      value={ratePerMinute}
                      onChange={(event) => setRatePerMinute(Number(event.target.value))}
                    />
                  </Field>
                </div>
              </Card>

              <EmailPreview
                html={preview?.html}
                subject={preview?.subject || draft.subject}
                from={preview?.from || { name: draft.fromName, email: draft.fromEmail }}
                to={preview?.usedContact?.email}
                height={400}
              />
            </div>

            <div className="space-y-8">
              <div className="rounded-[28px] border border-control-gray bg-white p-8">
                <div className="flex items-center justify-between border-b border-control-gray pb-4">
                  <h3 className="font-display text-[18px] font-semibold text-ink">Campaign Review</h3>
                  <Badge tone="#0071e3">Ready to Launch</Badge>
                </div>

                <dl className="mt-5 space-y-3.5 border-b border-control-gray pb-5">
                  {[
                    ['Audience List', selectedList?.name || uploadResult?.list?.name || '—'],
                    ['Total Recipients', formatNumber(recipientCount)],
                    ['Subject Line', draft.subject || '—'],
                    ['Placeholders', mapping.length ? `${mapping.length} active` : 'none'],
                    ['Paced Rate', `${ratePerMinute} / minute`],
                    [
                      'Estimated Runtime',
                      recipientCount && ratePerMinute
                        ? `${Math.max(1, Math.ceil(recipientCount / ratePerMinute))} min`
                        : '—',
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className="shrink-0 font-text text-[13px] text-slate">{label}</dt>
                      <dd className="truncate text-right font-display text-[14px] font-semibold text-ink">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>

                {unmatched.length ? (
                  <div className="mt-5 rounded-[20px] border border-warning/40 bg-warning/10 p-4">
                    <p className="font-display text-[13px] font-semibold text-ink">
                      {unmatched.length} placeholder{unmatched.length > 1 ? 's' : ''} unmapped
                    </p>
                    <p className="mt-1 font-text text-[12px] leading-relaxed text-slate">
                      {unmatched.map((key) => `{${key}}`).join(', ')} — ensure fallbacks are provided, or empty strings will be injected.
                    </p>
                  </div>
                ) : null}

                <ErrorNote error={sendError} />

                {/* Primary Launch Action */}
                <button
                  type="button"
                  className="btn-buy-cta mt-6 w-full !py-3.5 !text-[14px] font-medium"
                  disabled={sending || !canLeaveMessage || !recipientCount}
                  onClick={() => sendCampaign({ allowUnmatched: unmatched.length > 0 })}
                >
                  {sending ? <Spinner size={18} /> : null}
                  {sending ? 'Initiating Dispatch…' : `Launch Campaign (${formatNumber(recipientCount)} Recipients)`}
                </button>

                <div className="mt-4 flex gap-3">
                  <button type="button" className="btn-ghost flex-1 text-center" onClick={() => setStep(1)}>
                    ← Back
                  </button>
                  <button
                    type="button"
                    className="btn-ghost flex-1 text-center"
                    onClick={() => navigate('/templates/new')}
                  >
                    Save Template
                  </button>
                </div>
              </div>

              <div className="rounded-[28px] border border-hairline-soft bg-surface-soft/60 p-7">
                <h3 className="font-display text-[16px] font-bold text-ink-deep">Included Telemetry & Compliance</h3>
                <ul className="mt-4 space-y-3">
                  {[
                    'Automatic List-Unsubscribe header + compliant opt-out',
                    'Clean HTML and plaintext multipart bundle',
                    'Cryptographically unique Message-ID',
                    'Per-recipient open & click telemetry tracking',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 font-text text-[13px] text-steel">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </Band>
    </>
  );
}
