(() => {
  'use strict';

  const data = window.videoReportData || {};
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const video = $('#source-video');
  const shots = Array.isArray(data.shots) ? data.shots : [];
  const transcript = Array.isArray(data.transcript) ? data.transcript : [];

  const escapeHtml = (value = '') => String(value).replace(/[&<>"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  })[char]);

  const formatTime = (seconds = 0) => {
    const value = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const secs = Math.floor(value % 60);
    return hours > 0
      ? [hours, minutes, secs].map((n) => String(n).padStart(2, '0')).join(':')
      : [minutes, secs].map((n) => String(n).padStart(2, '0')).join(':');
  };

  const jumpTo = (seconds) => {
    if (!video.src) return;
    video.currentTime = Math.max(0, Number(seconds) || 0);
    video.play().catch(() => {});
  };

  document.title = data.title ? `${data.title} / 拉片报告` : '视频拉片报告';
  $('#report-title').textContent = data.title || '视频拉片报告';
  $('#report-kicker').textContent = data.kicker || '参考视频拆解';
  $('#report-summary').textContent = data.summary || '暂无已验证结论。';
  $('#source-note').textContent = data.sourceNote || '证据来自原片、关键帧和字幕。';
  $('#generated-at').textContent = data.generatedAt ? `生成于 ${data.generatedAt}` : '';

  const metrics = data.metrics || {};
  const metricItems = [
    ['时长', metrics.duration || formatTime(data.duration)],
    ['画幅', metrics.resolution || '未记录'],
    ['镜头', `${shots.length} 个`],
    ['取证', metrics.evidence || `${shots.reduce((sum, shot) => sum + (shot.frames?.length || 0), 0)} 帧`]
  ];
  $('#report-metrics').innerHTML = metricItems.map(([label, value]) =>
    `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
  ).join('');

  if (data.video?.src) {
    video.src = data.video.src;
    if (data.video.poster) video.poster = data.video.poster;
  } else {
    video.hidden = true;
    $('#video-empty').hidden = false;
  }

  const chapters = Array.isArray(data.chapters) && data.chapters.length
    ? data.chapters
    : shots.map((shot) => ({ id: shot.id, title: shot.title, start: shot.start }));
  $('#chapter-nav').innerHTML = chapters.map((chapter) => `
    <button class="chapter-button" type="button" data-shot="${escapeHtml(chapter.id)}" data-time="${Number(chapter.start) || 0}">
      <span class="chapter-time">${formatTime(chapter.start)}</span>
      <span>${escapeHtml(chapter.title)}</span>
    </button>
  `).join('');

  const frameMarkup = (frame, shot) => {
    const src = escapeHtml(frame.src);
    const label = escapeHtml(frame.label || '关键帧');
    const seconds = Number(frame.time ?? shot.start) || 0;
    return `
      <figure class="frame">
        <button class="frame-button" type="button" data-time="${seconds}" aria-label="播放到 ${formatTime(seconds)}">
          <img src="${src}" alt="${escapeHtml(frame.alt || `${shot.title} ${label}`)}" loading="lazy">
        </button>
        <figcaption class="frame-caption">
          <span>${label} · ${formatTime(seconds)}</span>
          <a class="frame-download" href="${src}" download="${escapeHtml(frame.downloadName || frame.src.split('/').pop())}" data-src="${src}">下载</a>
        </figcaption>
      </figure>
    `;
  };

  $('#shot-list').innerHTML = shots.length ? shots.map((shot, index) => `
    <article class="shot-card" id="${escapeHtml(shot.id || `shot-${index + 1}`)}" data-key="${Boolean(shot.key)}">
      <div class="shot-head">
        <span class="shot-index">${String(index + 1).padStart(2, '0')}</span>
        <div>
          <h3 class="shot-title">${escapeHtml(shot.title || `镜头 ${index + 1}`)}</h3>
          <p class="shot-purpose">${escapeHtml(shot.purpose || '')}</p>
          ${shot.key ? '<span class="key-badge">关键镜头</span>' : ''}
        </div>
        <span class="shot-time">${formatTime(shot.start)}–${formatTime(shot.end)}</span>
      </div>
      <div class="frame-pair">${(shot.frames || []).map((frame) => frameMarkup(frame, shot)).join('')}</div>
      ${shot.note ? `<p class="shot-note">${escapeHtml(shot.note)}</p>` : ''}
    </article>
  `).join('') : '<p class="empty-state">当前报告没有可显示的镜头证据。</p>';

  const renderTranscript = (query = '') => {
    const normalized = query.trim().toLocaleLowerCase();
    const rows = transcript.filter((item) => !normalized || String(item.text || '').toLocaleLowerCase().includes(normalized));
    $('#transcript-list').innerHTML = rows.length ? rows.map((item, index) => `
      <button class="transcript-row" type="button" data-time="${Number(item.start) || 0}" data-end="${Number(item.end ?? item.start) || 0}" data-index="${index}">
        <span class="transcript-time">${formatTime(item.start)}</span>
        <span>${escapeHtml(item.text)}</span>
      </button>
    `).join('') : '<p class="empty-state">没有匹配的字幕或口播。</p>';
    $$('.transcript-row').forEach((row) => row.addEventListener('click', () => jumpTo(row.dataset.time)));
  };
  renderTranscript();

  const findings = Array.isArray(data.findings) ? data.findings : [];
  $('#finding-list').innerHTML = findings.length
    ? findings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>暂无可复用结论。</li>';

  const uncertainties = Array.isArray(data.uncertainties) ? data.uncertainties : [];
  if (uncertainties.length) {
    $('#uncertainties').hidden = false;
    $('#uncertainty-list').innerHTML = uncertainties.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  }

  $$('.frame-button').forEach((button) => button.addEventListener('click', () => jumpTo(button.dataset.time)));
  $$('.chapter-button').forEach((button) => button.addEventListener('click', () => {
    document.getElementById(button.dataset.shot)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    jumpTo(button.dataset.time);
  }));
  $$('.segment').forEach((button) => button.addEventListener('click', () => {
    $$('.segment').forEach((item) => item.classList.toggle('active', item === button));
    $$('.shot-card').forEach((card) => { card.hidden = button.dataset.filter === 'key' && card.dataset.key !== 'true'; });
  }));
  $('#transcript-search').addEventListener('input', (event) => renderTranscript(event.target.value));
  $('#print-report').addEventListener('click', () => window.print());
  $('#copy-summary').addEventListener('click', async (event) => {
    try {
      await navigator.clipboard.writeText(data.summary || '');
      event.currentTarget.textContent = '已复制';
      setTimeout(() => { event.currentTarget.textContent = '复制结论'; }, 1200);
    } catch {
      event.currentTarget.textContent = '复制失败';
    }
  });

  $$('.frame-download').forEach((link) => link.addEventListener('click', (event) => {
    const payload = window.frameDownloadData?.[link.dataset.src];
    if (!payload) return;
    event.preventDefault();
    event.stopPropagation();
    const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
    const extension = link.dataset.src.split('.').pop().toLowerCase();
    const mime = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = link.getAttribute('download');
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }));

  const widthControl = $('#viewer-width');
  const storedWidth = localStorage.getItem('dumik-video-report-viewer-width');
  if (storedWidth) widthControl.value = storedWidth;
  const applyViewerWidth = () => document.documentElement.style.setProperty('--viewer-width', `${widthControl.value}px`);
  applyViewerWidth();
  widthControl.addEventListener('input', () => {
    applyViewerWidth();
    localStorage.setItem('dumik-video-report-viewer-width', widthControl.value);
  });

  const setActiveShot = (id) => {
    $$('.shot-card').forEach((card) => card.classList.toggle('active', card.id === id));
    $$('.chapter-button').forEach((button) => button.classList.toggle('active', button.dataset.shot === id));
    const shot = shots.find((item) => item.id === id);
    $('#current-shot').textContent = shot?.title || '等待定位';
  };

  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setActiveShot(visible.target.id);
  }, { rootMargin: '-20% 0px -55% 0px', threshold: [0.1, 0.5] });
  $$('.shot-card').forEach((card) => observer.observe(card));

  video.addEventListener('timeupdate', () => {
    const row = $$('.transcript-row').find((item) => video.currentTime >= Number(item.dataset.time) && video.currentTime <= Number(item.dataset.end));
    $$('.transcript-row').forEach((item) => item.classList.toggle('active', item === row));
  });
})();
