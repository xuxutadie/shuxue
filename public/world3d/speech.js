'use strict';
// 仅在用户点击后启动浏览器识别；本站不接收或保存音频。
globalThis.createThinkingSpeech = function ({Recognition, read, write, notify}) {
  let session = null;
  const errors = {
    'not-allowed': '麦克风权限未开启，请在浏览器的网站设置中允许后重试。',
    'service-not-allowed': '浏览器未允许语音识别服务，可以改用键盘输入。',
    'audio-capture': '没有找到可用的麦克风，请检查设备连接。',
    'no-speech': '没有听清，点击语音输入再试一次吧。',
    network: '语音识别服务连接失败，请检查网络，或使用系统语音输入。',
    'language-not-supported': '当前识别服务不支持普通话，请使用系统语音输入。'
  };
  function cancel() {
    const old = session;
    session = null; // 先解除会话，忽略离开页面后迟到的识别结果。
    if (old) { clearTimeout(old.timer); clearTimeout(old.watchdog); try { old.engine.abort(); } catch {} }
    notify({active:false, message:old ? '语音输入已停止，已识别文字保留。' : ''});
  }
  function start() {
    if (session) return;
    if (!Recognition) { notify({active:false, message:'当前浏览器不支持语音识别，可在文字框中使用系统语音输入（Windows：Win + H）。'}); return; }
    let engine;
    try { engine = new Recognition(); } catch {
      notify({active:false, message:'当前浏览器无法创建语音服务，请使用设备自带的语音输入。'}); return;
    }
    const current = {engine, seen:new Set(), message:'', stopping:false};
    session = current;
    // 不能只凭接口存在判断可用：部分内嵌浏览器会启动后一直无回调。
    function watch(milliseconds, message) {
      clearTimeout(current.watchdog);
      current.watchdog = setTimeout(() => {
        if (session !== current) return;
        cancel(); notify({active:false, message});
      }, milliseconds);
    }
    const waiting = '20秒没有收到识别文字，已停止等待。请检查麦克风和网络，或使用设备自带的语音输入。';
    engine.onstart = () => {
      if (session !== current || current.stopping) return;
      notify({active:true, message:'识别服务已启动，等待麦克风声音……'});
    };
    engine.onaudiostart = () => {
      if (session !== current || current.stopping) return;
      watch(20000, waiting);
      notify({active:true, message:'麦克风已开始接收，请用普通话说说你的思路……'});
    };
    engine.lang = 'zh-CN'; engine.continuous = true; engine.interimResults = true;
    engine.onresult = event => {
      if (session !== current) return;
      if (!current.stopping) watch(20000, waiting);
      let interim = '';
      for (let i=event.resultIndex; i<event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) { interim += result[0].transcript; continue; }
        if (current.seen.has(i)) continue;
        current.seen.add(i);
        const existing = read(), words = result[0].transcript.trim();
        if (!words) continue;
        const combined = existing + (existing && !/\s$/.test(existing) ? '\n' : '') + words;
        write(combined.slice(0,1000));
        if (combined.length >= 1000) { current.message = '思路已达到1000字上限，请先整理文字。'; stop(); return; }
      }
      notify({active:true, stopping:current.stopping, message:interim ? '正在识别：' + interim : '正在听，请用普通话说说你的思路……'});
    };
    engine.onerror = event => {
      if (session !== current) return;
      current.message = errors[event.error] || (event.error === 'aborted' ? '语音输入已结束。' : '语音识别暂时不可用，请稍后重试或键盘输入。');
      const message = current.message;
      cancel(); notify({active:false, message});
    };
    engine.onend = () => {
      if (session !== current) return;
      clearTimeout(current.timer); clearTimeout(current.watchdog); session = null;
      notify({active:false, message:current.message || (current.seen.size ? '语音输入已结束，请检查识别文字，特别是数字和数学符号。' : '识别已结束，但没有收到文字。请重试或使用设备自带的语音输入。')});
    };
    notify({active:true, message:'正在请求麦克风，请允许浏览器使用麦克风。'});
    watch(12000, '12秒内未能启动语音采集，已停止等待。请检查麦克风授权；内嵌浏览器可能无法提供识别服务，也可以使用系统语音输入。');
    try { engine.start(); } catch { cancel(); notify({active:false, message:'无法启动语音识别，请检查浏览器权限后重试。'}); }
  }
  function stop() {
    if (!session || session.stopping) return;
    const current = session; current.stopping = true; clearTimeout(current.watchdog);
    notify({active:true, stopping:true, message:'正在收尾，等待最后一句识别完成……'});
    // 部分浏览器不触发结束事件，超时后仍允许继续编辑已识别文字。
    current.timer = setTimeout(() => {
      if (session !== current) return;
      cancel(); notify({active:false, message:'识别已结束，请检查最后一句是否完整。'});
    },4000);
    try { current.engine.stop(); } catch { cancel(); }
  }
  return {start, stop, cancel, get active() { return !!session; }};
};
