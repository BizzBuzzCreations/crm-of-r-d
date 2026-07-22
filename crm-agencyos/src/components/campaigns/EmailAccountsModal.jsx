import { Modal } from '../ui';
import EmailAccountsManager from './EmailAccountsManager';

// Thin modal wrapper around EmailAccountsManager — used from the Campaign
// Settings tab ("Manage accounts"). The same manager UI also renders inline
// (no modal) in Settings → Connected Mailboxes.
export default function EmailAccountsModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Connected Mailboxes" size="md">
      <div className="px-6 py-5">
        <EmailAccountsManager />
      </div>
    </Modal>
  );
}
