import mongoose from 'mongoose';

const statsSchema = new mongoose.Schema(
  {
    total: { type: Number, default: 0 },
    queued: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    unsubscribed: { type: Number, default: 0 },
  },
  { _id: false },
);

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Optional: ad-hoc sends compose inline without saving a template first.
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', default: null },
    list: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactList', required: true },

    // Snapshot of the template at dispatch time so later edits don't rewrite history.
    subject: { type: String, default: '' },
    preheader: { type: String, default: '' },
    html: { type: String, default: '' },
    fromName: { type: String, default: '' },
    fromEmail: { type: String, default: '' },
    replyTo: { type: String, default: '' },
    placeholders: { type: [String], default: [] },
    defaults: { type: Object, default: {} },

    status: {
      type: String,
      enum: ['draft', 'queued', 'sending', 'paused', 'completed', 'failed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    driver: { type: String, enum: ['bullmq', 'inline'], default: 'inline' },
    ratePerMinute: { type: Number, default: 60 },

    stats: { type: statsSchema, default: () => ({}) },

    error: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

campaignSchema.index({ createdAt: -1 });

campaignSchema.virtual('progress').get(function progress() {
  const done = this.stats.sent + this.stats.failed + this.stats.skipped;
  return this.stats.total ? Math.round((done / this.stats.total) * 100) : 0;
});

campaignSchema.set('toJSON', { virtuals: true });
campaignSchema.set('toObject', { virtuals: true });

export default mongoose.model('Campaign', campaignSchema);
