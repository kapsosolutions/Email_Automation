import mongoose from 'mongoose';

/**
 * One uploaded CSV/XLSX file = one ContactList.
 * `columns` is the detected header row, which is exactly what the template
 * builder offers as {placeholders}.
 */
const contactListSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sourceFileName: { type: String, default: '' },
    sourceFileType: { type: String, default: '' },
    sourceFileSize: { type: Number, default: 0 },
    archiveUrl: { type: String, default: '' },
    archivePublicId: { type: String, default: '' },

    columns: { type: [String], default: [] },
    emailColumn: { type: String, default: '' },

    totalRows: { type: Number, default: 0 },
    validCount: { type: Number, default: 0 },
    invalidCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },

    sampleRow: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

contactListSchema.index({ createdAt: -1 });

export default mongoose.model('ContactList', contactListSchema);
