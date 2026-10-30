import { useFlash } from '../context/FlashContext.jsx';

export default function Flash() {
  const { flash, clearFlash } = useFlash();
  if (!flash) return null;
  const cls = flash.type === 'error' ? 'alert-danger' : flash.type === 'success' ? 'alert-success' : 'alert-info';
  return (
    <div className={`alert ${cls} alert-dismissible`} key={flash.id} role="alert">
      <span>{flash.message}</span>
      <button type="button" className="alert-close" onClick={clearFlash} aria-label="Close">&times;</button>
    </div>
  );
}
