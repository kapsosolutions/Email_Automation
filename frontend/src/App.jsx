import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Layout, { Band } from './components/Layout.jsx';
import { EmptyState } from './components/ui.jsx';
import CampaignDetail from './pages/CampaignDetail.jsx';
import Campaigns from './pages/Campaigns.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Send from './pages/Send.jsx';
import TemplateEditor from './pages/TemplateEditor.jsx';
import Templates from './pages/Templates.jsx';

function NotFound() {
  return (
    <Band>
      <EmptyState
        title="Page not found"
        body="That route does not exist in this console."
        action={
          <Link to="/" className="btn-buy-cta">
            Back to dashboard
          </Link>
        }
      />
    </Band>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/send" element={<Send />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/templates/new" element={<TemplateEditor />} />
        <Route path="/templates/:id" element={<TemplateEditor />} />
        <Route path="/contacts" element={<Navigate to="/send" replace />} />
        <Route path="/contacts/:id" element={<Navigate to="/send" replace />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
