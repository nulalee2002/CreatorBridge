export function CircuitBackground({ subdued = false }) {
  return (
    <div className={`cb-motion-field ${subdued ? 'cb-motion-field-subdued' : ''}`} aria-hidden="true">
      <span className="cb-signal cb-signal-a" />
      <span className="cb-signal cb-signal-b" />
      <span className="cb-signal cb-signal-c" />
      <span className="cb-signal-vertical cb-signal-vertical-a" />
      <span className="cb-signal-vertical cb-signal-vertical-b" />
      <span className="cb-pulse cb-pulse-a" />
      <span className="cb-pulse cb-pulse-b" />
      <span className="cb-pulse cb-pulse-c" />
    </div>
  );
}
