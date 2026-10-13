// A spinning gold coin, shown while something is still being worked out.
export const Spinner = () => <span className="coin-spin" aria-hidden="true" />;

/** Sits over the results on show while the setup for what is picked now is still being found. */
export const Updating = ({ monster }: { monster: string }) => (
  <div className="updating" role="status">
    <Spinner />
    Updating for {monster}
  </div>
);
