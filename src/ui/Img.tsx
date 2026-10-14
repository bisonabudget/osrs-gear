// A picture that stays hidden until it has loaded, so a half-loaded, broken or previous picture is
// never on screen. A small spinner holds its place if it's slow. One that fails keeps being tried
// again from this site, less often as time goes on and at once when the connection comes back, so
// it turns up in the end. Pictures never load from the Wiki, so visitors add nothing to its load.
import { type ImgHTMLAttributes, useEffect, useLayoutEffect, useRef, useState } from 'react';

// How long to wait before each new try, in milliseconds. After the last, it tries once a minute.
const WAITS = [500, 2000, 5000, 15000, 30000];
const LAST_WAIT = 60000;
// After this many failed tries the spinner goes, leaving a blank space while it keeps trying.
const SPINNER_TRIES = 3;
// A blank picture, shown between tries so the browser has no broken picture to draw.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string };

const Picture = ({ src, className, ...rest }: Props) => {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [waiting, setWaiting] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // A query string makes the server fetch the picture afresh rather than repeat a failed reply.
  const current = attempt === 0 ? src : `${src}?try=${attempt + 1}`;

  // A picture already in the browser's cache can finish before React listens for it.
  useLayoutEffect(() => {
    if (image.current?.complete && image.current.naturalWidth > 0) setState('loaded');
  }, [attempt]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const tryAgain = () => {
    clearTimeout(timer.current);
    setWaiting(false);
    setAttempt((a) => a + 1);
  };

  // Back online, a picture that is waiting to try again tries at once.
  useEffect(() => {
    if (!waiting) return undefined;
    window.addEventListener('online', tryAgain);
    return () => window.removeEventListener('online', tryAgain);
  }, [waiting]);

  const failed = () => {
    if (attempt + 1 >= SPINNER_TRIES) setState('failed');
    setWaiting(true);
    timer.current = setTimeout(tryAgain, WAITS[attempt] ?? LAST_WAIT);
  };

  return (
    <img
      {...rest}
      ref={image}
      src={waiting ? BLANK : current}
      className={[className, `pic-${state}`].filter(Boolean).join(' ')}
      onLoad={(e) => { if (e.currentTarget.src !== BLANK) setState('loaded'); }}
      onError={(e) => {
        if (e.currentTarget.src === BLANK) return;
        // Blanked at once, so the browser never draws its broken picture icon before React catches up.
        e.currentTarget.src = BLANK;
        failed();
      }}
    />
  );
};

/** An <img> that hides itself until loaded and keeps trying when it fails. */
export const Img = (props: Props) => <Picture key={props.src} {...props} />;
