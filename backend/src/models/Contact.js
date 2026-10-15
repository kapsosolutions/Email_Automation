import mongoose from 'mongoose';

/**
 * A single recipient row. `data` keeps every column from the spreadsheet so
 * {any_column} can be substituted at send time.
 */
const contactSchema = new mongoose.Schema(
  {
    list: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactList', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: '' },
    data: { type: Object, default: {} },
    rowNumber: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['subscribed', 'unsubscribed', 'bounced'],
      default: 'subscribed',
      index: true,
    },
    unsubscribedAt: { type: Date, default: null },

    lastSentAt: { type: Date, default: null },
    sendCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

contactSchema.index({ list: 1, email: 1 }, { unique: true });

export default mongoose.model('Contact', contactSchema);
