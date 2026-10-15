import express from 'express';
import Campaign from '../models/Campaign.js';
import Contact from '../models/Contact.js';
import ContactList from '../models/ContactList.js';
import EmailLog from '../models/EmailLog.js';
import { archiveSourceFile } from '../config/cloudinary.js';
import { asyncHandler, badRequest, notFound, uploadSpreadsheet } from '../middleware/index.js';
import {
  buildContacts,
  detectEmailColumn,
  detectNameColumn,
  parseSpreadsheet,
} from '../services/spreadsheet.js';

const router = express.Router();

/**
 * POST /api/lists/upload
 * Accepts a CSV / XLS / XLSX file, extracts every address, and stores the full
 * row so any column can be used as a {placeholder} later.
 *
 * Body (multipart): file, name?, emailColumn?
 */
router.post(
  '/upload',
  uploadSpreadsheet,
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No file received. Send it as the "file" field.');

    const { originalname, buffer, size, mimetype } = req.file;
    const { columns, rows, extension } = parseSpreadsheet(buffer, originalname);

    if (!rows.length) throw badRequest('The file has a header row but no data rows.');

    const requested = (req.body.emailColumn || '').trim();
    if (requested && !columns.includes(requested)) {
      throw badRequest(`Column "${requested}" is not in this file.`, { columns });
    }

    const emailColumn = requested || detectEmailColumn(columns, rows);
    if (!emailColumn) {
      throw badRequest(
        'Could not work out which column holds the email addresses. Pass "emailColumn" with one of the detected columns.',
        { columns, sample: rows.slice(0, 5) },
      );
    }

    const nameColumn = detectNameColumn(columns);
    const { contacts, invalid, duplicates } = buildContacts(rows, columns, emailColumn, nameColumn);

    if (!contacts.length) {
      throw badRequest('No valid email addresses found in that file.', {
        emailColumn,
        invalidSample: invalid.slice(0, 10),
      });
    }

    const archive = await archiveSourceFile(buffer, originalname);

    const list = await ContactList.create({
      name: (req.body.name || '').trim() || originalname.replace(/\.[^.]+$/, ''),
      sourceFileName: originalname,
      sourceFileType: extension || mimetype,
      sourceFileSize: size,
      archiveUrl: archive?.url || '',
      archivePublicId: archive?.publicId || '',
      columns,
      emailColumn,
      totalRows: rows.length,
      validCount: contacts.length,
      invalidCount: invalid.length,
      duplicateCount: duplicates.length,
      sampleRow: contacts[0]?.data || {},
    });

    // Carry over any prior opt-out so a re-upload cannot resurrect it.
    const suppressed = new Set(
      (
        await Contact.find({
          email: { $in: contacts.map((contact) => contact.email) },
          status: { $in: ['unsubscribed', 'bounced'] },
        })
          .select('email status')
          .lean()
      ).map((contact) => contact.email),
    );

    const docs = contacts.map((contact) => ({
      ...contact,
      list: list._id,
      status: suppressed.has(contact.email) ? 'unsubscribed' : 'subscribed',
    }));

    for (let i = 0; i < docs.length; i += 500) {
      await Contact.insertMany(docs.slice(i, i + 500), { ordered: false }).catch((error) => {
        if (error?.code !== 11000) throw error; // tolerate duplicate-key races only
      });
    }

    const suppressedCount = docs.filter((doc) => doc.status !== 'subscribed').length;

    res.status(201).json({
      list,
      summary: {
        totalRows: rows.length,
        valid: contacts.length,
        invalid: invalid.length,
        duplicates: duplicates.length,
        suppressed: suppressedCount,
        readyToSend: contacts.length - suppressedCount,
        emailColumn,
        nameColumn,
        columns,
      },
      // Everything the UI needs to render the mapping + preview step.
      preview: contacts.slice(0, 25).map((contact) => ({
        email: contact.email,
        name: contact.name,
        rowNumber: contact.rowNumber,
        data: contact.data,
      })),
      rejected: [...invalid, ...duplicates].slice(0, 50),
    });
  }),
);

/** GET /api/lists - newest first, with live subscriber counts. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const lists = await ContactList.find().sort({ createdAt: -1 }).limit(200).lean();

    const counts = await Contact.aggregate([
      { $group: { _id: { list: '$list', status: '$status' }, count: { $sum: 1 } } },
    ]);

    const byList = new Map();
    counts.forEach((row) => {
      const key = String(row._id.list);
      const entry = byList.get(key) || { subscribed: 0, unsubscribed: 0, bounced: 0 };
      entry[row._id.status] = row.count;
      byList.set(key, entry);
    });

    res.json(
      lists.map((list) => ({
        ...list,
        counts: byList.get(String(list._id)) || { subscribed: 0, unsubscribed: 0, bounced: 0 },
      })),
    );
  }),
);

/** GET /api/lists/:id - list plus a page of contacts. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const list = await ContactList.findById(req.params.id).lean();
    if (!list) throw notFound('List not found');

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const search = (req.query.search || '').trim();

    const filter = { list: list._id };
    if (search) filter.email = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    if (req.query.status) filter.status = req.query.status;

    const [contacts, total] = await Promise.all([
      Contact.find(filter)
        .sort({ rowNumber: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Contact.countDocuments(filter),
    ]);

    res.json({ list, contacts, page, limit, total, pages: Math.ceil(total / limit) });
  }),
);

/** GET /api/lists/:id/emails - flat address array, for a quick sanity check. */
router.get(
  '/:id/emails',
  asyncHandler(async (req, res) => {
    const contacts = await Contact.find({ list: req.params.id, status: 'subscribed' })
      .select('email')
      .sort({ rowNumber: 1 })
      .lean();
    res.json({ count: contacts.length, emails: contacts.map((contact) => contact.email) });
  }),
);

/** DELETE /api/lists/:id - removes the list, its contacts and its logs. */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const list = await ContactList.findById(req.params.id);
    if (!list) throw notFound('List not found');

    const active = await Campaign.countDocuments({
      list: list._id,
      status: { $in: ['queued', 'sending'] },
    });
    if (active) throw badRequest('A campaign is currently sending to this list.');

    await Promise.all([
      Contact.deleteMany({ list: list._id }),
      EmailLog.deleteMany({ list: list._id }),
    ]);
    await list.deleteOne();

    res.json({ deleted: true, id: req.params.id });
  }),
);

export default router;
