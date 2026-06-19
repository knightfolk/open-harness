import { strict as assert } from 'node:assert';
import {
  approveApprovalTransaction,
  clearApprovalTransactionsForTests,
  consumeApprovedApprovalTransaction,
  createApprovalTransaction,
  listApprovalTransactions,
  rejectApprovalTransaction,
  type ApprovalAction,
} from '../server/actionApprovals';

clearApprovalTransactionsForTests();

const action: ApprovalAction = {
  kind: 'command',
  route: '/api/terminal/exec',
  description: 'Run terminal command',
  cwd: '/tmp/project',
  command: 'npm test',
};

const approval = createApprovalTransaction(action);
assert.equal(approval.status, 'pending', 'new approval should start pending');
assert.equal(approval.action.command, 'npm test', 'approval should describe the command');
assert.equal(listApprovalTransactions().length, 1, 'approval should be listed');

const duplicate = createApprovalTransaction({ ...action });
assert.equal(duplicate.id, approval.id, 'duplicate pending action should reuse the pending transaction');

assert.equal(
  consumeApprovedApprovalTransaction(approval.id, action).ok,
  false,
  'pending approval should not be consumable',
);

const approved = approveApprovalTransaction(approval.id);
assert.equal(approved?.status, 'approved', 'approval should become approved');

const differentAction: ApprovalAction = {
  ...action,
  command: 'npm run build',
};
assert.equal(
  consumeApprovedApprovalTransaction(approval.id, differentAction).ok,
  false,
  'approval should not be reusable for a different command',
);

const consumed = consumeApprovedApprovalTransaction(approval.id, action);
assert.equal(consumed.ok, true, 'approved matching action should be consumable');
if (consumed.ok) assert.equal(consumed.approval.status, 'consumed', 'consumed approval should be marked consumed');
assert.equal(
  consumeApprovedApprovalTransaction(approval.id, action).ok,
  false,
  'approval should be single-use',
);

const rejectable = createApprovalTransaction({
  kind: 'write',
  route: '/api/patches/apply',
  description: 'Apply patch',
  cwd: '/tmp/project',
  paths: ['src/App.tsx'],
});
assert.equal(rejectApprovalTransaction(rejectable.id)?.status, 'rejected', 'pending approval should be rejectable');
assert.equal(
  consumeApprovedApprovalTransaction(rejectable.id, rejectable.action).ok,
  false,
  'rejected approval should not be consumable',
);

clearApprovalTransactionsForTests();
console.log('Action approval tests passed.');
