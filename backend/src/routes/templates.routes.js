import express from 'express';
import Contact from '../models/Contact.js';
import ContactList from '../models/ContactList.js';
import Template from '../models/Template.js';
import env from '../config/env.js';
import { asyncHandler, badRequest, notFound } from '../middleware/index.js';
import { analyzeContent } from '../services/deliverability.js';
import {
  composeMessage,
  extractPlaceholders,
  mapPlaceholders,
} from '../services/templateEngine.js';

const router = express.Router();

const pick = (body) => ({
  name: (body.name || '').trim(),
  subject: (body.subject || '').trim(),
  preheader: (body.preheader || '').trim(),
  html: body.html || '',
  fromName: (body.fromName || '').trim(),
  fromEmail: (body.fromEmail || '').trim().toLowerCase(),
  replyTo: (body.replyTo || '').trim().toLowerCase(),
  defaults: body.defaults && typeof body.defaults === 'object' ? body.defaults : {},
});

/** GET /api/templates */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const templates = await Template.find().sort({ updatedAt: -1 }).limit(200).lean();
    res.json(templates);
  }),
);

/** GET /api/templates/:id */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const template = await Template.findById(req.params.id).lean();
    if (!template) throw notFound('Template not found');
    res.json(template);
  }),
);

/**
 * POST /api/templates
 * Placeholders are derived from the saved content, so the Send page always
 * knows which spreadsheet columns a template needs.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pick(req.body);
    if (!data.name) throw badRequest('Give the template a name.');
    if (!data.subject) throw badRequest('Subject is required.');
    if (!data.html.trim()) throw badRequest('The email body is empty.');

    data.placeholders = extractPlaceholders(data.subject, data.preheader, data.html);
    const template = await Template.create(data);
    res.status(201).json(template);
  }),
);

/** PUT /api/templates/:id */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pick(req.body);
    if (!data.name) throw badRequest('Give the template a name.');
    if (!data.subject) throw badRequest('Subject is required.');
    if (!data.html.trim()) throw badRequest('The email body is empty.');

    data.placeholders = extractPlaceholders(data.subject, data.preheader, data.html);

    const template = await Template.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!template) throw notFound('Template not found');
    res.json(template);
  }),
);

/** DELETE /api/templates/:id */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const template = await Template.findByIdAndDelete(req.params.id);
    if (!template) throw notFound('Template not found');
    res.json({ deleted: true, id: req.params.id });
  }),
);

/**
 * POST /api/templates/placeholders
 * Live placeholder extraction while the user types, plus - when a list is
 * supplied - which placeholders that list can actually fill.
 *
 * Body: { subject, preheader, html, listId?, defaults? }
 */
router.post(
  '/placeholders',
  asyncHandler(async (req, res) => {
    const { subject = '', preheader = '', html = '', listId, defaults = {} } = req.body;
    const placeholders = extractPlaceholders(subject, preheader, html);

    let columns = [];
    let list = null;
    if (listId) {
      list = await ContactList.findById(listId).lean();
      if (!list) throw notFound('List not found');
      columns = list.columns || [];
    }

    const mapping = mapPlaceholders(placeholders, columns, defaults);

    res.json({
      placeholders,
      columns,
      mapping,
      unmatched: mapping.filter((item) => item.status === 'unmatched').map((item) => item.placeholder),
      list: list ? { id: list._id, name: list.name } : null,
    });
  }),
);

/**
 * POST /api/templates/preview
 * Renders the template against a real contact row (or supplied sample data) so
 * the user sees the exact message a recipient will get, placeholders resolved.
 *
 * Body: { subject, preheader, html, fromName?, listId?, contactId?, sample? }
 */
router.post(
  '/preview',
  asyncHandler(async (req, res) => {
    const {
      subject = '',
      preheader = '',
      html = '',
      fromName = '',
      fromEmail = '',
      listId,
      contactId,
      sample,
      defaults = {},
    } = req.body;

    if (!subject && !html) throw badRequest('Nothing to preview yet.');

    let contact = null;
    if (contactId) {
      contact = await Contact.findById(contactId).lean();
    } else if (listId) {
      contact = await Contact.findOne({ list: listId, status: 'subscribed' })
        .sort({ rowNumber: 1 })
        .lean();
    }

    if (!contact) {
      const data = sample && typeof sample === 'object' ? sample : { name: 'Alex Morgan' };
      contact = {
        email: data.email || 'alex.morgan@example.com',
        name: data.name || 'Alex Morgan',
        data,
      };
    }

    const message = composeMessage({
      template: { subject, preheader, html, fromName },
      contact,
      trackId: 'preview-track-id',
      defaults,
      tracking: false,
    });

    const placeholders = extractPlaceholders(subject, preheader, html);
    const columns = Object.keys(contact.data || {});

    res.json({
      subject: message.subject,
      html: message.html,
      text: message.text,
      preheader: message.preheader,
      bodyOnly: composeMessage({
        template: { subject, preheader, html, fromName },
        contact,
        trackId: 'preview-track-id',
        defaults,
        wrap: false,
        tracking: false,
      }).html,
      usedContact: { email: contact.email, name: contact.name, data: contact.data },
      mapping: mapPlaceholders(placeholders, columns, defaults),
      from: {
        name: fromName || env.mail.fromName,
        email: fromEmail || env.mail.fromEmail,
      },
    });
  }),
);

/**
 * POST /api/templates/analyze
 * Spam / deliverability lint for the draft in the editor.
 */
router.post(
  '/analyze',
  asyncHandler(async (req, res) => {
    const { subject = '', html = '', preheader = '', fromEmail = '' } = req.body;
    res.json(
      analyzeContent({
        subject,
        html,
        preheader,
        fromEmail: fromEmail || env.mail.fromEmail,
      }),
    );
  }),
);

export default router;
