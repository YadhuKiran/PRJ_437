import { LogOut } from 'lucide-react';

/* Persistent safety control for the victim-facing side.
   Leaves this site immediately without any frightening language. */
export default function QuickExit() {
  function exit() {
    try {
      window.location.replace('https://www.google.com');
    } catch {
      window.location.href = 'https://www.google.com';
    }
  }
  return (
    <button className="quick-exit" onClick={exit} aria-label="Quick exit — leave this site immediately">
      <LogOut size={16} aria-hidden="true" /> Quick Exit
    </button>
  );
}
