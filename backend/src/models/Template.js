import mongoose from 'mongoose';

/**
 * A reusable mail template. `subject` and `html` may contain {placeholders}
 * such as {name} or {company}; those keys are matched against the uploaded
 * spreadsheet columns at send time.
 */
const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    preheader: { type: String, default: '' },
    html: { type: String, required: true },

    fromName: { type: String, default: '' },
    fromEmail: { type: String, default: '' },
    replyTo: { type: String, default: '' },

    // Cached list of placeholder keys found in subject + body.
    placeholders: { type: [String], default: [] },
    // Fallback values used when a spreadsheet row has no value for a key.
    defaults: { type: Object, default: {} },

    usageCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

templateSchema.index({ createdAt: -1 });

export default mongoose.model('Template', templateSchema);
