import mongoose from 'mongoose';

/**
 * One row per recipient per campaign. This table is the source of truth for
 * every dashboard number and chart.
 */
const emailLogSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', index: true },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', index: true },
    list: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactList', index: true },

    email: { type: String, required: true, lowercase: true, index: true },
    subject: { type: String, default: '' },

    status: {
      type: String,
      // `sending` is the in-flight state. A worker claims a row by moving it
      // out of `queued`, which is what makes concurrent dispatch safe.
      enum: ['queued', 'sending', 'sent', 'failed', 'skipped', 'bounced'],
      default: 'queued',
      index: true,
    },

    messageId: { type: String, default: '' },
    // Opaque id embedded in the tracking pixel / click + unsubscribe links.
    trackId: { type: String, index: true },

    opens: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    firstOpenedAt: { type: Date, default: null },
    lastClickedAt: { type: Date, default: null },
    unsubscribedAt: { type: Date, default: null },

    error: { type: String, default: '' },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

emailLogSchema.index({ campaign: 1, status: 1 });
emailLogSchema.index({ createdAt: -1 });

export default mongoose.model('EmailLog', emailLogSchema);
