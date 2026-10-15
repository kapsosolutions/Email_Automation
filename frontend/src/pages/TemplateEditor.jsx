import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Band } from '../components/Layout.jsx';
import {
  DeliverabilityScore,
  EmailPreview,
  PlaceholderMap,
} from '../components/compose.jsx';
import {
  Card,
  ErrorNote,
  Field,
  SectionHeading,
  Select,
  Spinner,
  useAsync,
  useToast,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatNumber } from '../lib/format.js';

/**
 * Meta Starter templates.
 * Engineered with Meta Cobalt #0064e0 pills and clean geometric typography.
 */
const STARTERS = [
  {
    id: 'welcome',
    label: 'Welcome Onboarding',
    subject: 'Welcome aboard, {name}',
    preheader: 'Everything you need to get going in two minutes.',
    html: `<h1 style="font-family:'Montserrat',-apple-system,sans-serif;font-size:28px;font-weight:600;letter-spacing:-0.5px;color:#0a1317;margin:0 0 16px;">Welcome, {name|there}</h1>
<p style="font-family:'Inter',sans-serif;font-size:16px;line-height:1.6;color:#444950;">We are delighted to have you with us. Your workspace is fully provisioned and ready.</p>
<p style="font-family:'Inter',sans-serif;font-size:16px;line-height:1.6;color:#444950;">If anything needs attention, reply directly to this message for immediate engineering support.</p>
<p style="margin:32px 0;">
  <a href="https://example.com/start" style="display:inline-block;background:#0064e0;color:#ffffff;font-family:'Montserrat',sans-serif;font-size:14px;font-weight:700;letter-spacing:-0.14px;text-decoration:none;padding:14px 30px;border-radius:100px;">Get Started Now</a>
</p>
<p style="font-family:'Inter',sans-serif;font-size:14px;color:#8595a4;">— The {company|Team} Team</p>`,
  },
  {
    id: 'update',
    label: 'Product Changelog',
    subject: '{name}, look forward to what shipped this month',
    preheader: 'Three pivotal architecture updates worth two minutes.',
    html: `<h1 style="font-family:'Montserrat',-apple-system,sans-serif;font-size:28px;font-weight:600;letter-spacing:-0.5px;color:#0a1317;margin:0 0 16px;">What shipped this month</h1>
<p style="font-family:'Inter',sans-serif;font-size:16px;line-height:1.6;color:#444950;">Hi {name|there}, here is a concise recap of recent upgrades:</p>
<ul style="padding-left:20px;font-family:'Inter',sans-serif;font-size:15px;line-height:1.8;color:#444950;">
  <li>High-throughput ingestion for enterprise spreadsheets up to 100k rows</li>
  <li>Dynamic {token} interpolation across subject lines and rich bodies</li>
  <li>Real-time telemetry for primary inbox delivery, opens, and link clicks</li>
</ul>
<p style="margin:32px 0;">
  <a href="https://example.com/changelog" style="display:inline-block;background:#0064e0;color:#ffffff;font-family:'Montserrat',sans-serif;font-size:14px;font-weight:700;letter-spacing:-0.14px;text-decoration:none;padding:14px 30px;border-radius:100px;">Explore Full Changelog</a>
</p>`,
  },
  {
    id: 'outreach',
    label: 'Executive Outreach',
    subject: 'Quick question regarding {company}',
    preheader: 'One concise inquiry, no sales deck attached.',
    html: `<p style="font-family:'Inter',sans-serif;font-size:16px;line-height:1.6;color:#1c1e21;">Hi {name|there},</p>
<p style="font-family:'Inter',sans-serif;font-size:16px;line-height:1.6;color:#444950;">I noticed {company|your team} is scaling rapidly in this domain, and I had one brief question.</p>
<p style="font-family:'Inter',sans-serif;font-size:16px;line-height:1.6;color:#444950;">Would an automated, rate-paced dispatch engine with dedicated SMTP deliverability be valuable to your team this quarter?</p>
<p style="font-family:'Inter',sans-serif;font-size:16px;line-height:1.6;color:#444950;">Either way, thank you for your time.</p>
<p style="font-family:'Inter',sans-serif;font-size:14px;color:#8595a4;margin-top:24px;">Warm regards,<br /><strong>{sender_name|Me}</strong></p>`,
  },
];

const emptyTemplate = {
  name: '',
  subject: '',
  preheader: '',
  html: '',
  fromName: '',
  fromEmail: '',
  replyTo: '',
};

export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = Boolean(id);

  const [draft, setDraft] = useState(emptyTemplate);
  const [defaults, setDefaults] = useState({});
  const [listId, setListId] = useState('');
  const [mapping, setMapping] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [preview, setPreview] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  const bodyRef = useRef(null);
  const lists = useAsync(() => api.lists.all(), []);
  const config = useAsync(() => api.system.config(), []);

  const selectedList = useMemo(
    () => (lists.data || []).find((item) => String(item._id) === String(listId)) || null,
    [lists.data, listId],
  );
  const columns = selectedList?.columns || [];

  // Load an existing template when editing.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    api.templates
      .one(id)
      .then((template) => {
        if (cancelled) return;
        setDraft({
          name: template.name,
          subject: template.subject,
          preheader: template.preheader || '',
          html: template.html,
          fromName: template.fromName || '',
          fromEmail: template.fromEmail || '',
          replyTo: template.replyTo || '',
        });
        setDefaults(template.defaults || {});
      })
      .catch((error) => toast.error(error.message, 'Could not load template'))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Seed default sender config when creating new.
  useEffect(() => {
    if (isEdit || !config.data?.sender) return;
    setDraft((current) => ({
      ...current,
      fromName: current.fromName || config.data.sender.name || '',
      fromEmail: current.fromEmail || config.data.sender.email || '',
      replyTo: current.replyTo || config.data.sender.replyTo || '',
    }));
  }, [config.data, isEdit]);

  // Re-run placeholders, sandboxed preview, and linting when draft changes.
  const previewKey = `${draft.subject}|${draft.preheader}|${draft.html}|${listId}|${JSON.stringify(defaults)}`;

  useEffect(() => {
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
        toast.error(error.message, 'Preview update failed');
      } finally {
        setChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  const insertToken = (token) => {
    const area = bodyRef.current;
    if (!area) return;
    const start = area.selectionStart ?? area.value.length;
    const end = area.selectionEnd ?? area.value.length;
    const next = `${draft.html.slice(0, start)}${token}${draft.html.slice(end)}`;
    setDraft({ ...draft, html: next });
    setTimeout(() => {
      area.focus();
      area.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  const applyStarter = (starter) => {
    setDraft((current) => ({
      ...current,
      name: current.name || starter.label,
      subject: starter.subject,
      preheader: starter.preheader,
      html: starter.html,
    }));
    toast.info(`Loaded starter: “${starter.label}”`);
  };

  const canSave = draft.name.trim() && draft.subject.trim() && draft.html.trim();

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = { ...draft, defaults };
      if (isEdit) {
        await api.templates.update(id, payload);
        toast.success(`“${draft.name}” saved.`);
      } else {
        const created = await api.templates.create(payload);
        toast.success(`“${draft.name}” created.`);
        navigate(`/templates/${created._id}`, { replace: true });
      }
    } catch (error) {
      setSaveError(error);
      toast.error(error.message, 'Could not save template');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testTo.trim()) {
      toast.error('Enter an email address to send the test to.');
      return;
    }
    setTesting(true);
    try {
      // Test sends go through the campaign endpoint; there is no template-level
      // send route on the API.
      await api.campaigns.test({
        to: testTo.trim(),
        subject: draft.subject,
        preheader: draft.preheader,
        html: draft.html,
        fromName: draft.fromName,
        fromEmail: draft.fromEmail,
        replyTo: draft.replyTo,
        listId: listId || undefined,
        defaults,
      });
      toast.success(`Test email sent to ${testTo}.`);
    } catch (error) {
      toast.error(error.message, 'Test send failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <Band tight>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Link
                to="/templates"
                className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Templates
              </Link>
              <span className="text-slate-300">/</span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-[#00a859] border border-emerald-200">
                {isEdit ? 'Editor' : 'New Template'}
              </span>
            </div>
            <h1 className="mt-1 font-display text-[24px] font-bold tracking-tight text-slate-900">
              {draft.name || (isEdit ? 'Edit Template' : 'Create a Mail Design')}
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            <Link to="/templates" className="btn-secondary btn-sm shadow-sm">
              Back to templates
            </Link>
            <button
              type="button"
              className="btn-emerald btn-sm shadow-sm font-medium"
              onClick={save}
              disabled={!canSave || saving}
            >
              {saving ? <Spinner size={14} /> : (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
              )}
              {isEdit ? 'Save Changes' : 'Save Template'}
            </button>
          </div>
        </div>
        {loading ? (
          <Card className="p-8">
            <Spinner size={32} className="mx-auto block" />
          </Card>
        ) : (
          <>
          <div className="grid items-start gap-7 lg:grid-cols-2">
            {/* ----------------------- left column: the composition form */}
            <div className="space-y-6">
              <Card className="p-8">
                <SectionHeading sub="Reusable template definition with full {token} support.">
                  Template Specifications
                </SectionHeading>

                <div className="mb-6 border-b border-control-gray pb-5">
                  <p className="mb-2.5 font-display text-[11px] font-semibold uppercase tracking-wider text-steel">
                    Start from a pattern
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STARTERS.map((starter) => (
                      <button
                        key={starter.id}
                        type="button"
                        className="rounded-full border border-control-gray bg-white px-3.5 py-1.5 font-display text-[12.5px] font-medium text-slate transition-colors hover:border-pricing-blue hover:text-pricing-blue"
                        onClick={() => applyStarter(starter)}
                      >
                        {starter.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-5">
                  <Field label="Template Title" required htmlFor="t-name">
                    <input
                      id="t-name"
                      className="field"
                      placeholder="e.g. Monthly Executive Briefing"
                      value={draft.name}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    />
                  </Field>

                  <Field
                    label="Subject Line"
                    required
                    hint="Placeholders work directly here (e.g. {first_name})."
                    htmlFor="t-subject"
                  >
                    <input
                      id="t-subject"
                      className="field"
                      placeholder="{name}, your updates are ready"
                      value={draft.subject}
                      onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                    />
                  </Field>

                  <Field label="Preview Preheader" htmlFor="t-preheader">
                    <input
                      id="t-preheader"
                      className="field"
                      placeholder="Secondary preview text shown in the inbox snippet"
                      value={draft.preheader}
                      onChange={(event) => setDraft({ ...draft, preheader: event.target.value })}
                    />
                  </Field>

                  <Field
                    label="Email HTML Body"
                    required
                    hint="Inline styling recommended. Use tokens like {name} or fallback syntax like {name|valued client}."
                    htmlFor="t-body"
                  >
                    <textarea
                      id="t-body"
                      ref={bodyRef}
                      rows={18}
                      className="field-mono"
                      placeholder={'<p>Hi {name|there},</p>\n<p>Thanks for being part of {company}.</p>'}
                      value={draft.html}
                      onChange={(event) => setDraft({ ...draft, html: event.target.value })}
                    />
                  </Field>

                  <div className="grid gap-5 sm:grid-cols-3">
                    <Field label="From Name" htmlFor="t-from-name">
                      <input
                        id="t-from-name"
                        className="field"
                        value={draft.fromName}
                        onChange={(event) => setDraft({ ...draft, fromName: event.target.value })}
                      />
                    </Field>
                    <Field label="From Address" htmlFor="t-from-email">
                      <input
                        id="t-from-email"
                        type="email"
                        className="field"
                        value={draft.fromEmail}
                        onChange={(event) => setDraft({ ...draft, fromEmail: event.target.value })}
                      />
                    </Field>
                    <Field label="Reply-To" htmlFor="t-reply">
                      <input
                        id="t-reply"
                        type="email"
                        className="field"
                        value={draft.replyTo}
                        onChange={(event) => setDraft({ ...draft, replyTo: event.target.value })}
                      />
                    </Field>
                  </div>
                </div>

                <ErrorNote error={saveError} />

                <div className="mt-7 flex flex-wrap gap-3 border-t border-control-gray pt-5">
                  <button
                    type="button"
                    className="btn-buy-cta font-medium"
                    onClick={save}
                    disabled={!canSave || saving}
                  >
                    {saving ? <Spinner size={16} /> : null}
                    {isEdit ? 'Save Changes' : 'Save Template'}
                  </button>
                  <Link to="/send" className="btn-secondary font-medium">
                    Use in a Send →
                  </Link>
                </div>
              </Card>
            </div>

            {/* ------------------- right column: nothing but the preview */}
            <div className="lg:sticky lg:top-24">
              <EmailPreview
                html={preview?.html}
                subject={preview?.subject || draft.subject}
                from={preview?.from || { name: draft.fromName, email: draft.fromEmail }}
                to={preview?.usedContact?.email}
                height={900}
                viewport="calc(100vh - 230px)"
              />
              <p className="mt-3 px-1 font-text text-[12.5px] text-steel">
                Scaled to fit the panel so the whole layout is visible. Switch to 100% for actual
                size, or open it in a new tab to inspect the rendering on its own.
              </p>
            </div>
          </div>

          {/* --------------------------- full width: token validation */}
          <Card className="mt-7 p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-control-gray pb-5">
              <div>
                <h3 className="font-display text-[18px] font-medium text-ink-deep">Token Validation</h3>
                <p className="mt-0.5 font-text text-[13px] text-steel">
                  Link against a real audience list to verify every key resolves to a column.
                </p>
              </div>
              {checking ? <Spinner size={16} /> : null}
            </div>

            <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <div className="space-y-4">
                <Field label="Validate with List" htmlFor="t-list">
                  <Select
                    id="t-list"
                    value={listId}
                    onChange={(event) => setListId(event.target.value)}
                  >
                    <option value="">No list selected</option>
                    {(lists.data || []).map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name} ({formatNumber(item.counts?.subscribed || 0)} contacts)
                      </option>
                    ))}
                  </Select>
                </Field>

                {unmatched.length && listId ? (
                  <div className="rounded-[20px] border border-warning/40 bg-warning/10 p-4">
                    <p className="font-display text-[13px] font-bold text-ink-deep">
                      {unmatched.length} key{unmatched.length > 1 ? 's' : ''} unmapped in this list
                    </p>
                    <p className="mt-1 font-text text-[12px] text-steel">
                      Provide a fallback value, or rename the token to match a column header.
                    </p>
                  </div>
                ) : null}

                {listId && !unmatched.length && mapping.length ? (
                  <div className="rounded-[20px] border border-success/40 bg-success-bg p-4">
                    <p className="font-display text-[13px] font-bold text-ink-deep">
                      All {mapping.length} token{mapping.length > 1 ? 's' : ''} resolve
                    </p>
                    <p className="mt-1 font-text text-[12px] text-steel">
                      Every key maps to a column on “{selectedList?.name}”.
                    </p>
                  </div>
                ) : null}
              </div>

              <PlaceholderMap
                mapping={mapping}
                columns={columns}
                onInsert={(column) => insertToken(`{${column}}`)}
                defaults={defaults}
                onDefault={(name, value) => setDefaults({ ...defaults, [name]: value })}
              />
            </div>
          </Card>

          {/* ------------------- full width: deliverability and linting */}
          <Card className="mt-7 p-8">
            <div className="border-b border-control-gray pb-5">
              <h3 className="font-display text-[18px] font-medium text-ink-deep">
                Deliverability &amp; Linting
              </h3>
              <p className="mt-0.5 font-text text-[13px] text-steel">
                Automated checks for spam triggers, link formats, and image weight. Content
                heuristics only — domain authentication still decides most of inbox placement.
              </p>
            </div>

            <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
              <DeliverabilityScore analysis={analysis} loading={checking} />

              <div className="lg:border-l lg:border-control-gray lg:pl-7">
                <p className="font-display text-[13px] font-semibold text-ink-deep">
                  Send yourself a test
                </p>
                <p className="mt-1 font-text text-[12.5px] text-steel">
                  Rendered with a real row from the selected list, so token substitution is proven
                  before you save.
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  <input
                    className="field"
                    type="email"
                    placeholder="you@yourdomain.com"
                    value={testTo}
                    onChange={(event) => setTestTo(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-secondary font-medium"
                    onClick={sendTest}
                    disabled={testing || !canSave}
                  >
                    {testing ? <Spinner size={16} /> : null}
                    {testing ? 'Sending…' : 'Send Test Email'}
                  </button>
                </div>
              </div>
            </div>
          </Card>
          </>
        )}
      </Band>
    </>
  );
}
