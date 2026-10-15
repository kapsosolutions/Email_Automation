import express from 'express';
import campaignRoutes from './campaigns.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import listRoutes from './lists.routes.js';
import systemRoutes from './system.routes.js';
import templateRoutes from './templates.routes.js';

const router = express.Router();

router.use('/dashboard', dashboardRoutes);
router.use('/lists', listRoutes);
router.use('/templates', templateRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/system', systemRoutes);

router.get('/', (req, res) => {
  res.json({
    name: 'Email Automation API',
    endpoints: {
      dashboard: ['/api/dashboard/stats', '/api/dashboard/timeseries', '/api/dashboard/breakdown', '/api/dashboard/campaign-performance', '/api/dashboard/recent', '/api/dashboard/health'],
      lists: ['POST /api/lists/upload', 'GET /api/lists', 'GET /api/lists/:id', 'GET /api/lists/:id/emails', 'DELETE /api/lists/:id'],
      templates: ['GET/POST /api/templates', 'PUT/DELETE /api/templates/:id', 'POST /api/templates/placeholders', 'POST /api/templates/preview', 'POST /api/templates/analyze'],
      campaigns: ['POST /api/campaigns/send', 'POST /api/campaigns/test', 'GET /api/campaigns', 'GET /api/campaigns/:id', 'GET /api/campaigns/:id/logs', 'POST /api/campaigns/:id/pause|resume|cancel|retry-failed'],
      tracking: ['GET /t/o/:trackId.png', 'GET /t/c/:trackId', 'GET|POST /t/u/:trackId'],
      system: ['/api/system/config', '/api/system/smtp-check', '/api/system/health'],
    },
  });
});

export default router;
