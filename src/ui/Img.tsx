// A picture that stays hidden until it has loaded, so a half-loaded, broken or previous picture is
// never on screen. A small spinner holds its place if it's slow. One that fails is tried again
// twice, then from the Wiki, and then left blank.
import { type ImgHTMLAttributes, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { backupOf } from '../catalog';

// How long to wait before each new try, in milliseconds.
const WAITS = [500, 2000, 0];
// A blank picture, shown between tries so the browser has no broken picture to draw.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string };

const Picture = ({ src, className, ...rest }: Props) => {
  const backup = backupOf(src);
  // A query string makes the server fetch the picture afresh rather than repeat a failed reply.
  const tries = [src, `${src}?try=2`, `${src}?try=3`, ...(backup ? [backup] : [])];
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [waiting, setWaiting] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A picture already in the browser's cache can finish before React listens for it.
  useLayoutEffect(() => {
    if (image.current?.complete && image.current.naturalWidth > 0) setState('loaded');
  }, [attempt]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const failed = () => {
    if (attempt + 1 >= tries.length) {
      setState('failed');
      return;
    }
    setWaiting(true);
    timer.current = setTimeout(() => {
      setWaiting(false);
      setAttempt(attempt + 1);
    }, WAITS[attempt]);
  };

  return (
    <img
      {...rest}
      ref={image}
      src={waiting ? BLANK : tries[attempt]}
      className={[className, `pic-${state}`].filter(Boolean).join(' ')}
      onLoad={(e) => { if (e.currentTarget.src !== BLANK) setState('loaded'); }}
      onError={(e) => { if (e.currentTarget.src !== BLANK) failed(); }}
    />
  );
};

/** An <img> that hides itself until loaded and retries when it fails. */
export const Img = (props: Props) => <Picture key={props.src} {...props} />;
