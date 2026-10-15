import express from 'express';
import mongoose from 'mongoose';
import Campaign from '../models/Campaign.js';
import Contact from '../models/Contact.js';
import ContactList from '../models/ContactList.js';
import EmailLog from '../models/EmailLog.js';
import Template from '../models/Template.js';
import { asyncHandler } from '../middleware/index.js';
import { queueHealth } from '../queue/index.js';
import { getBrevoAccount } from '../services/mailer.js';

const router = express.Router();

const dayKey = (date) => date.toISOString().slice(0, 10);

const startOfDayUTC = (daysAgo) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
};

const rate = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/**
 * GET /api/dashboard/stats
 * Everything the stat cards need, in one round trip.
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const since30 = startOfDayUTC(29);
    const since60 = startOfDayUTC(59);

    const [
      totalContacts,
      subscribedContacts,
      unsubscribedContacts,
      bouncedContacts,
      totalLists,
      totalTemplates,
      campaignCounts,
      statusTotals,
      engagement,
      last30,
      prev30,
    ] = await Promise.all([
      Contact.countDocuments(),
      Contact.countDocuments({ status: 'subscribed' }),
      Contact.countDocuments({ status: 'unsubscribed' }),
      Contact.countDocuments({ status: 'bounced' }),
      ContactList.countDocuments(),
      Template.countDocuments(),
      Campaign.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      EmailLog.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      EmailLog.aggregate([
        { $match: { status: 'sent' } },
        {
          $group: {
            _id: null,
            opened: { $sum: { $cond: [{ $gt: ['$opens', 0] }, 1, 0] } },
            clicked: { $sum: { $cond: [{ $gt: ['$clicks', 0] }, 1, 0] } },
            unsubscribed: { $sum: { $cond: [{ $ne: ['$unsubscribedAt', null] }, 1, 0] } },
            totalOpens: { $sum: '$opens' },
            totalClicks: { $sum: '$clicks' },
          },
        },
      ]),
      EmailLog.countDocuments({ status: 'sent', sentAt: { $gte: since30 } }),
      EmailLog.countDocuments({ status: 'sent', sentAt: { $gte: since60, $lt: since30 } }),
    ]);

    const byStatus = Object.fromEntries(statusTotals.map((row) => [row._id, row.count]));
    const campaignsByStatus = Object.fromEntries(campaignCounts.map((row) => [row._id, row.count]));
    const eng = engagement[0] || { opened: 0, clicked: 0, unsubscribed: 0, totalOpens: 0, totalClicks: 0 };

    const sent = byStatus.sent || 0;
    const failed = byStatus.failed || 0;
    // In-flight rows read as "waiting" from the dashboard's point of view.
    const queued = (byStatus.queued || 0) + (byStatus.sending || 0);
    const skipped = byStatus.skipped || 0;
    const attempted = sent + failed;

    res.json({
      contacts: {
        total: totalContacts,
        subscribed: subscribedContacts,
        unsubscribed: unsubscribedContacts,
        bounced: bouncedContacts,
      },
      lists: totalLists,
      templates: totalTemplates,
      campaigns: {
        total: Object.values(campaignsByStatus).reduce((sum, value) => sum + value, 0),
        byStatus: campaignsByStatus,
        active: (campaignsByStatus.sending || 0) + (campaignsByStatus.queued || 0),
      },
      emails: { sent, failed, queued, skipped, attempted },
      rates: {
        delivery: rate(sent, attempted),
        open: rate(eng.opened, sent),
        click: rate(eng.clicked, sent),
        clickToOpen: rate(eng.clicked, eng.opened),
        bounce: rate(failed, attempted),
        unsubscribe: rate(eng.unsubscribed, sent),
      },
      engagement: {
        uniqueOpens: eng.opened,
        uniqueClicks: eng.clicked,
        totalOpens: eng.totalOpens,
        totalClicks: eng.totalClicks,
        unsubscribes: eng.unsubscribed,
      },
      trend: {
        last30Days: last30,
        previous30Days: prev30,
        changePercent: prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : last30 > 0 ? 100 : 0,
      },
    });
  }),
);

/**
 * GET /api/dashboard/timeseries?days=14
 * Daily sent / opened / clicked / failed series for the area chart.
 */
router.get(
  '/timeseries',
  asyncHandler(async (req, res) => {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 14));
    const since = startOfDayUTC(days - 1);

    const group = (dateField, match) => [
      { $match: { [dateField]: { $gte: since }, ...match } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: `$${dateField}`, timezone: 'UTC' } },
          count: { $sum: 1 },
        },
      },
    ];

    const [sent, failed, opened, clicked] = await Promise.all([
      EmailLog.aggregate(group('sentAt', { status: 'sent' })),
      EmailLog.aggregate(group('updatedAt', { status: 'failed' })),
      EmailLog.aggregate(group('firstOpenedAt', {})),
      EmailLog.aggregate(group('lastClickedAt', {})),
    ]);

    const toMap = (rows) => new Map(rows.map((row) => [row._id, row.count]));
    const sentMap = toMap(sent);
    const failedMap = toMap(failed);
    const openedMap = toMap(opened);
    const clickedMap = toMap(clicked);

    const series = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = startOfDayUTC(i);
      const key = dayKey(date);
      series.push({
        date: key,
        label: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
        sent: sentMap.get(key) || 0,
        failed: failedMap.get(key) || 0,
        opened: openedMap.get(key) || 0,
        clicked: clickedMap.get(key) || 0,
      });
    }

    res.json({ days, series });
  }),
);

/**
 * GET /api/dashboard/breakdown
 * Pie/donut datasets: delivery status, contact status, contacts per list.
 */
router.get(
  '/breakdown',
  asyncHandler(async (req, res) => {
    const [logStatus, contactStatus, perList] = await Promise.all([
      EmailLog.aggregate([{ $group: { _id: '$status', value: { $sum: 1 } } }]),
      Contact.aggregate([{ $group: { _id: '$status', value: { $sum: 1 } } }]),
      Contact.aggregate([
        { $group: { _id: '$list', value: { $sum: 1 } } },
        { $sort: { value: -1 } },
        { $limit: 6 },
        {
          $lookup: {
            from: ContactList.collection.name,
            localField: '_id',
            foreignField: '_id',
            as: 'list',
          },
        },
        { $unwind: { path: '$list', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, name: { $ifNull: ['$list.name', 'Deleted list'] }, value: 1 } },
      ]),
    ]);

    const label = {
      sent: 'Delivered',
      failed: 'Failed',
      queued: 'In queue',
      sending: 'In flight',
      skipped: 'Suppressed',
      bounced: 'Bounced',
      subscribed: 'Subscribed',
      unsubscribed: 'Unsubscribed',
    };

    res.json({
      deliveryStatus: logStatus.map((row) => ({
        key: row._id,
        name: label[row._id] || row._id,
        value: row.value,
      })),
      contactStatus: contactStatus.map((row) => ({
        key: row._id,
        name: label[row._id] || row._id,
        value: row.value,
      })),
      contactsByList: perList,
    });
  }),
);

/**
 * GET /api/dashboard/campaign-performance?limit=6
 * Grouped bar chart: sent vs opened vs clicked per recent campaign.
 */
router.get(
  '/campaign-performance',
  asyncHandler(async (req, res) => {
    const limit = Math.min(20, Math.max(3, Number(req.query.limit) || 6));

    const campaigns = await Campaign.find({ 'stats.total': { $gt: 0 } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('name stats createdAt status')
      .lean();

    const ids = campaigns.map((campaign) => campaign._id);
    const engagement = await EmailLog.aggregate([
      { $match: { campaign: { $in: ids }, status: 'sent' } },
      {
        $group: {
          _id: '$campaign',
          opened: { $sum: { $cond: [{ $gt: ['$opens', 0] }, 1, 0] } },
          clicked: { $sum: { $cond: [{ $gt: ['$clicks', 0] }, 1, 0] } },
        },
      },
    ]);
    const byCampaign = new Map(engagement.map((row) => [String(row._id), row]));

    res.json(
      campaigns
        .map((campaign) => {
          const eng = byCampaign.get(String(campaign._id)) || { opened: 0, clicked: 0 };
          return {
            id: campaign._id,
            name: campaign.name.length > 28 ? `${campaign.name.slice(0, 27)}…` : campaign.name,
            fullName: campaign.name,
            status: campaign.status,
            sent: campaign.stats.sent,
            failed: campaign.stats.failed,
            opened: eng.opened,
            clicked: eng.clicked,
            openRate: rate(eng.opened, campaign.stats.sent),
            createdAt: campaign.createdAt,
          };
        })
        .reverse(),
    );
  }),
);

/** GET /api/dashboard/recent - latest campaigns and the newest log lines. */
router.get(
  '/recent',
  asyncHandler(async (req, res) => {
    const [campaigns, logs] = await Promise.all([
      Campaign.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .populate('list', 'name')
        .select('name status stats createdAt completedAt list ratePerMinute')
        .lean(),
      EmailLog.find({ status: { $in: ['sent', 'failed'] } })
        .sort({ updatedAt: -1 })
        .limit(12)
        .populate('campaign', 'name')
        .select('email status subject error sentAt opens clicks campaign')
        .lean(),
    ]);

    res.json({
      campaigns: campaigns.map((campaign) => {
        const stats = campaign.stats || {};
        const done = (stats.sent || 0) + (stats.failed || 0) + (stats.skipped || 0);
        return {
          ...campaign,
          progress: stats.total
            ? Math.min(100, Math.round((done / stats.total) * 100))
            : 0,
        };
      }),
      activity: logs,
    });
  }),
);

/** GET /api/dashboard/health - sending infrastructure at a glance. */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const [queue, account] = await Promise.all([queueHealth(), getBrevoAccount()]);
    res.json({
      database: {
        state: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        name: mongoose.connection.name || null,
      },
      queue,
      brevo: account
        ? { connected: true, email: account.email, credits: account.credits, company: account.companyName }
        : { connected: false },
    });
  }),
);

export default router;
