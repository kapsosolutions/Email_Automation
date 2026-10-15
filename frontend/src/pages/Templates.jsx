import { Link } from 'react-router-dom';
import { Band } from '../components/Layout.jsx';
import {
  Card,
  EmptyState,
  ErrorNote,
  LoadingBlock,
  SectionHeading,
  useAsync,
  useToast,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatRelative } from '../lib/format.js';

export default function Templates() {
  const toast = useToast();
  const templates = useAsync(() => api.templates.all(), []);

  const remove = async (template) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete “${template.name}”? Campaigns already sent keep their own copy.`)) {
      return;
    }
    try {
      await api.templates.remove(template._id);
      toast.success(`“${template.name}” deleted.`);
      templates.refetch();
    } catch (error) {
      toast.error(error.message, 'Delete failed');
    }
  };

  return (
    <>
      <Band tight>
        <SectionHeading
          sub="Pre-configured mail designs with variable token support."
          action={
            <Link to="/templates/new" className="btn-buy-cta btn-sm">
              + New Template
            </Link>
          }
        >
          Saved Mail Templates
        </SectionHeading>

        <ErrorNote error={templates.error} onRetry={templates.refetch} />

        {templates.loading && !templates.data ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="p-7">
                <LoadingBlock rows={3} />
              </Card>
            ))}
          </div>
        ) : !templates.data?.length ? (
          <Card className="p-8">
            <EmptyState
              title="No mail templates yet"
              body="Create your first message design and use tokens like {name} or {company} to personalize each recipient's email."
              action={
                <Link to="/templates/new" className="btn-buy-cta">
                  Create a mail
                </Link>
              }
              icon="✎"
            />
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {templates.data.map((template) => (
              <div
                key={template._id}
                className="group flex flex-col rounded-[28px] border border-control-gray bg-white p-6 transition-colors duration-150 hover:border-hairline-silver"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-[18px] font-semibold text-ink group-hover:text-apple-blue transition-colors">
                    {template.name}
                  </h3>
                  <span className="shrink-0 font-text text-[12px] text-steel">
                    {formatRelative(template.updatedAt)}
                  </span>
                </div>

                <p className="mt-2.5 font-text text-[13.5px] leading-relaxed text-slate line-clamp-2">
                  <span className="font-semibold text-ink">Subject: </span>
                  {template.subject}
                </p>

                {template.placeholders?.length ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {template.placeholders.slice(0, 5).map((key) => (
                      <span key={key} className="chip !text-[11.5px] !py-0.5">{`{${key}}`}</span>
                    ))}
                    {template.placeholders.length > 5 ? (
                      <span className="chip !text-[11.5px] !py-0.5">+{template.placeholders.length - 5}</span>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-4 font-text text-[12px] text-steel">No placeholders</p>
                )}

                <div className="mt-5 flex items-center justify-between border-t border-control-gray pt-3.5 font-text text-[12px] text-steel">
                  <span>
                    Used {template.usageCount || 0} time{template.usageCount === 1 ? '' : 's'}
                  </span>
                  {template.fromEmail ? <span className="truncate max-w-[140px]">{template.fromEmail}</span> : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
                  <Link to={`/templates/${template._id}`} className="btn-secondary btn-sm flex-1 text-center font-medium">
                    Edit
                  </Link>
                  <Link to="/send" className="btn-buy-cta btn-sm flex-1 text-center font-medium">
                    Send
                  </Link>
                  <button
                    type="button"
                    className="button-icon-circular text-steel hover:text-critical hover:bg-critical/5 transition-colors"
                    title="Delete template"
                    onClick={() => remove(template)}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Band>
    </>
  );
}
