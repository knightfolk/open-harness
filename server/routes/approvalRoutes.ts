import type express from 'express';
import {
  approveApprovalTransaction,
  listApprovalTransactions,
  rejectApprovalTransaction,
} from '../actionApprovals';

type ControlResult = { ok: true } | { ok: false; status: number; error: string };

interface ApprovalRouteDeps {
  ensureLocalControl: (req: express.Request) => ControlResult;
}

export function registerApprovalRoutes(app: express.Express, deps: ApprovalRouteDeps) {
  app.get('/api/approvals', (req, res) => {
    const control = deps.ensureLocalControl(req);
    if (!control.ok) return res.status(control.status).json({ error: control.error });
    res.json({ approvals: listApprovalTransactions() });
  });

  app.post('/api/approvals/:id/approve', (req, res) => {
    const control = deps.ensureLocalControl(req);
    if (!control.ok) return res.status(control.status).json({ error: control.error });
    const approval = approveApprovalTransaction(req.params.id);
    if (!approval) return res.status(404).json({ error: 'Pending approval transaction not found' });
    res.json({ approval });
  });

  app.post('/api/approvals/:id/reject', (req, res) => {
    const control = deps.ensureLocalControl(req);
    if (!control.ok) return res.status(control.status).json({ error: control.error });
    const approval = rejectApprovalTransaction(req.params.id);
    if (!approval) return res.status(404).json({ error: 'Pending approval transaction not found' });
    res.json({ approval });
  });
}
