'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Pause, Play} from 'lucide-react';

type Connection = EventTarget & {saveData?: boolean};

/** Decorative film only. Business content and the entry action stay server-rendered. */
export default function WelcomeMotion({children}: {children: ReactNode}) {
  const stage = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & {connection?: Connection}).connection;
    const preference = () => {
      let paused = false;
      try { paused = sessionStorage.getItem('bizproof-welcome-motion') === 'paused'; } catch { /* Storage may be unavailable. */ }
      setEnabled(!reduced.matches && !connection?.saveData && !paused);
    };
    preference();
    reduced.addEventListener('change', preference);
    connection?.addEventListener('change', preference);
    let visible = true;
    const syncVisibility = () => setActive(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncVisibility();
    }, {threshold: 0});
    if (stage.current) observer.observe(stage.current);
    document.addEventListener('visibilitychange', syncVisibility);
    syncVisibility();
    return () => {
      reduced.removeEventListener('change', preference);
      connection?.removeEventListener('change', preference);
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);

  useEffect(() => {
    const player = video.current;
    if (!player) return;
    let cancelled = false;
    if (enabled && active && !failed) {
      if (!player.getAttribute('src')) {
        player.src = window.matchMedia('(max-width: 850px)').matches
          ? '/media/credential-network-mobile.mp4?v=1'
          : '/media/credential-network.mp4?v=1';
        player.load();
      }
      player.play().catch(() => {
        if (!cancelled) setEnabled(false);
      });
    } else player.pause();
    return () => { cancelled = true; player.pause(); };
  }, [enabled, active, failed]);

  function toggle() {
    const next = !enabled;
    try { sessionStorage.setItem('bizproof-welcome-motion', next ? 'playing' : 'paused'); } catch { /* Nonessential preference. */ }
    setEnabled(next);
  }

  return <section ref={stage} className="welcome-stage" data-motion={enabled && active ? 'playing' : 'paused'} aria-label="BizProof 공개 체험 소개">
    <div className="welcome-backdrop" aria-hidden="true">
      <video ref={video} className={ready && !failed ? 'is-ready' : ''}
        poster="/media/credential-network-poster.webp" muted loop playsInline preload="none" tabIndex={-1}
        disablePictureInPicture onPlaying={() => setReady(true)}
        onError={() => {setFailed(true); setEnabled(false);}}/>
      <div className="welcome-aurora welcome-aurora-blue"/>
      <div className="welcome-aurora welcome-aurora-teal"/>
      <div className="welcome-backdrop-veil"/>
    </div>
    {children}
    <div className="welcome-motion-bar">
      <span><i aria-hidden="true"/> 하나의 자격에서, 새로운 연결로.</span>
      <button type="button" onClick={toggle} aria-pressed={!enabled} aria-label={enabled ? '배경 애니메이션 일시정지' : '배경 애니메이션 재생'}>
        {enabled ? <Pause size={13} aria-hidden="true"/> : <Play size={13} aria-hidden="true"/>}
        {enabled ? '움직임 멈추기' : '움직임 켜기'}
      </button>
    </div>
  </section>;
}
