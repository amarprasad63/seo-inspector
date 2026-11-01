const FEATURE_EMAIL = 'dev.amarprasad63@gmail.com';

export function AppFooter() {
  const mailto = `mailto:${FEATURE_EMAIL}?subject=${encodeURIComponent('SEO Inspector feature request')}`;

  return (
    <footer className="app-footer">
      <p>
        For feature requests, email{' '}
        <a href={mailto} rel="noreferrer">
          {FEATURE_EMAIL}
        </a>{' '}
        with a detailed proposal. If the request is feasible, we aim to roll it out within approximately a month.
      </p>
    </footer>
  );
}
