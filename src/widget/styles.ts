export const widgetStyles = `
:host{all:initial;font-family:var(--font-geist-sans,"Chat Geist"),ui-sans-serif,system-ui,-apple-system,sans-serif;color:#f9fbff;color-scheme:dark;--surface:var(--obsidian-dashboard-shell-background,#161616);--control:var(--obsidian-dashboard-shell-control,#1e1e1e);--muted:var(--obsidian-dashboard-shell-muted,#2a2a2a);--muted-hover:var(--obsidian-dashboard-shell-muted-hover,#333333);--border:var(--obsidian-dashboard-shell-border,#232323);--strong:var(--obsidian-dashboard-shell-border-strong,#393939);--text-muted:var(--obsidian-dashboard-shell-text-muted,#9a9a9a);--blue:#2563eb;--accent-fill:var(--blue)}
*,*::before,*::after{box-sizing:border-box}button,textarea{font:inherit}button{cursor:pointer;color:inherit;-webkit-tap-highlight-color:transparent}button:disabled{cursor:default}button:focus-visible,textarea:focus-visible{outline:2px solid #93b4ff;outline-offset:4px}button:active:not(:disabled){transform:scale(.97)}[hidden]{display:none!important}svg{width:20px;height:20px;flex-shrink:0;pointer-events:none}p{margin:0}
.widget{position:fixed;right:max(24px,env(safe-area-inset-right));bottom:max(24px,env(safe-area-inset-bottom));z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;gap:8px;font-size:13px;line-height:1.5;-webkit-font-smoothing:antialiased}
.launcher{position:relative;display:grid;place-items:center;width:56px;height:56px;padding:0;border:1px solid color-mix(in srgb,var(--blue) 62%,white);border-radius:50%;background:var(--blue);box-shadow:0 3px 12px #0003;isolation:isolate;overflow:hidden}.launcher svg{width:22px;height:22px}.art{display:block;width:100%;height:100%;object-fit:contain;transform:translate(-2.0734%,-2.0734%);pointer-events:none}.art-pending{background:var(--blue);border-radius:50%}.art-pending-img{opacity:0}.art-fallback{display:grid;place-items:center;width:100%;height:100%;pointer-events:none;color:#fff}.art-fallback svg{width:55%;height:55%}.launcher .art,.launcher .art-fallback{width:76%;height:76%;min-width:0;min-height:0}.launcher[data-loading=true] .art{animation:breathe 900ms ease-in-out infinite alternate}
.launcher-wrap{position:relative;display:flex}
.badge{position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;padding:0 5px;display:grid;place-items:center;border-radius:99px;background:#e5484d;color:#fff;font-size:10.5px;font-weight:600;line-height:1;box-shadow:0 0 0 2px var(--surface);font-variant-numeric:tabular-nums}
.notices{display:flex;flex-direction:column;align-items:flex-end;gap:8px;width:196px;max-width:calc(100vw - 48px)}
.notice{position:relative;width:100%;border:1px solid var(--strong);border-radius:12px;background:var(--control);box-shadow:0 10px 28px -10px #000a}
.notice-open{display:flex;flex-direction:column;gap:2px;width:100%;padding:7px 9px 8px;border:0;background:transparent;text-align:left}
.notice-name{font-size:10.5px;font-weight:600;color:#fff}
.notice-body{font-size:10.5px;line-height:1.35;color:var(--text-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.notice-close{position:absolute;top:-8px;right:-8px;width:20px;height:20px;display:grid;place-items:center;padding:0;border:1px solid var(--strong);border-radius:50%;background:#333338;color:#fff;box-shadow:0 2px 8px #0007;opacity:0;transition:opacity 150ms ease,background-color 150ms ease}.notice-close svg{width:10px;height:10px}
.notice:hover .notice-close,.notice-close:focus-visible{opacity:1}
@media(hover:none){.notice-close{opacity:1}}
.panel{display:flex;flex-direction:column;width:300px;height:min(480px,calc(100dvh - 112px));min-height:280px;overflow:hidden;border:1px solid var(--strong);border-radius:18px;background:var(--surface);box-shadow:0 0 0 1px #0003,0 16px 48px -12px #0009;isolation:isolate}
.header{position:relative;z-index:5;flex-shrink:0;padding:13px 14px;background:var(--accent-fill);border-radius:0 0 16px 16px;box-shadow:inset 0 1px 0 #ffffff1f}
.topline{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px}
.identity-text{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;text-align:center;max-width:calc(100% - 132px)}
.actions{position:relative;display:flex;align-items:center;gap:2px}
.icon-btn{display:grid;place-items:center;width:26px;height:26px;min-width:26px;min-height:26px;padding:0;border:0;background:transparent;border-radius:7px;color:#fff}.icon-btn svg{width:16px;height:16px;flex-shrink:0}
.header-art{width:40px;height:40px;flex:0 0 40px;padding:0;display:grid;place-items:center;border-radius:50%;background:var(--blue);border:1px solid #ffffff25;overflow:hidden}.header-art img{width:74%;height:74%;min-width:0;min-height:0}.header-art .art-pending{width:74%;height:74%;min-width:0;min-height:0}
.title{font-size:17px;font-weight:600;letter-spacing:-.3px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.subtitle{margin-top:2px;font-size:11px;color:#e1eaff;line-height:1.4;display:flex;align-items:center;justify-content:center;gap:5px}
.status-avatar-wrap{position:relative;width:14px;height:14px;flex:0 0 14px;display:inline-grid;place-items:center;border-radius:50%}
.status-avatar-wrap img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.status-avatar-wrap .art{width:100%;height:100%}
.status-initial{display:inline-grid;place-items:center;width:100%;height:100%;border-radius:50%;background:var(--blue);color:#fff;font-size:8px;font-weight:600;line-height:1}
.presence-dot{position:absolute;right:-2px;bottom:-2px;width:6px;height:6px;border-radius:50%;border:1.5px solid var(--surface);box-sizing:content-box;pointer-events:none}
.presence-dot.online{background:#22c55e}.presence-dot.offline{background:#6b7280}
.status-text{min-width:0;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.body{position:relative;z-index:1;flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:14px 18px;scrollbar-width:thin;scrollbar-color:var(--strong) transparent}
.messages{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px}
.presets{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;margin-top:12px}
.preset{max-width:100%;padding:7px 10px;border:1px solid var(--strong);border-radius:999px;background:var(--control);font-size:11.5px;text-align:left;white-space:normal}
.preset:hover{border-color:var(--blue)}
.first-chat{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:13px 16px;border:0;border-radius:12px;background:var(--accent-fill);color:#fff;font-size:13px;font-weight:600;box-shadow:inset 0 1px 0 #ffffff1f}
.first-chat:disabled{opacity:.6}
.topic-prompt{display:flex;width:100%}
.topic-prompt-card{width:100%;padding:11px 12px;border:1px solid var(--strong);border-radius:12px;background:var(--control)}
.topic-prompt-title{font-size:12.5px;font-weight:600;line-height:1.4;color:#fff}
.topic-prompt-help{margin-top:2px;font-size:11px;line-height:1.4;color:var(--text-muted)}
.topic-picker{position:relative;margin-top:9px}
.topic-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:8px 10px;border:1px solid var(--strong);border-radius:8px;background:var(--surface);color:inherit;font-size:12.5px;line-height:1.4;text-align:left}
.topic-trigger:hover{border-color:#626262}
.topic-trigger-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted)}
.topic-trigger[aria-expanded=true] .topic-trigger-label{color:#fff}
.topic-chevron{display:flex;flex:0 0 auto;color:var(--text-muted);transform:rotate(90deg);transition:transform .16s ease}
.topic-chevron svg{width:14px;height:14px}
.topic-trigger[aria-expanded=true] .topic-chevron{transform:rotate(-90deg);color:#fff}
.topic-menu{position:fixed;z-index:60;left:0;top:0;max-height:168px;overflow:auto;padding:4px;border:1px solid var(--strong);border-radius:10px;background:var(--control);box-shadow:0 12px 28px #000a}
.topic-option{display:block;width:100%;padding:7px 9px;border:0;border-radius:6px;background:transparent;color:var(--text-muted);font-size:12px;line-height:1.4;text-align:left}
.topic-option:hover,.topic-option:focus-visible{background:var(--muted);color:#fff;outline:none}
.message{display:flex;align-items:flex-start;gap:6px}.message[data-same-author=true]{margin-top:-6px}
.avatar{position:relative;flex:0 0 22px;height:22px;background:var(--blue);border-radius:50%;display:grid;place-items:center}.avatar img{width:74%;height:74%;min-width:0;min-height:0}.avatar-photo{width:100%;height:100%;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:var(--blue)}.avatar .avatar-img{width:100%;height:100%;object-fit:cover}
.avatar-spacer{flex:0 0 22px}
.avatar-initial{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;color:#fff;font-size:9px;font-weight:600;line-height:1;letter-spacing:.2px;box-shadow:inset 0 0 0 1px #ffffff24}
.bubble-wrap{max-width:86%;min-width:0}
.bubble{padding:8px 11px;border-radius:13px 13px 13px 4px;background:var(--muted);font-size:12.5px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}
.bubble a{color:inherit;text-decoration-line:underline;text-decoration-style:solid;text-decoration-color:color-mix(in srgb,var(--blue) 45%,white);text-decoration-thickness:1.5px;text-underline-offset:3px;transition:text-decoration-color 150ms ease,text-decoration-thickness 150ms ease;overflow-wrap:anywhere}
.bubble a:hover{text-decoration-color:currentColor;text-decoration-thickness:2px}
.bubble a:focus-visible{outline:2px solid #93b4ff;outline-offset:3px;border-radius:2px}
.message[data-author=visitor]{justify-content:flex-end}.message[data-author=visitor] .bubble{border-radius:13px 13px 4px 13px;background:var(--blue);color:white}
.message[data-automated=true] .bubble{background:var(--muted)}
.meta{display:flex;align-items:center;justify-content:flex-end;gap:3px;margin-top:3px;padding:0 3px;color:var(--text-muted);font-size:9.5px;font-variant-numeric:tabular-nums}
.tick{display:inline-flex;color:#dfe7ff99}.tick[data-read=true]{color:#9db8ff}.tick svg{width:12px;height:12px}
.delivery{display:block;font-size:9.5px;color:var(--text-muted);text-align:right;padding:3px}
.retry{border:0;background:transparent;font-size:10.5px;color:#fca5a5;padding:3px 0;text-decoration:underline;text-underline-offset:3px}
.loading{height:100%;min-height:110px;display:grid;place-content:center}
.loading-art{width:84px;height:84px;display:grid;place-items:center}.loading-art img{width:100%;height:100%;object-fit:contain;animation:breathe 900ms ease-in-out infinite alternate}
.error{display:grid;place-content:center;gap:8px;text-align:center;min-height:140px;font-size:12.5px;color:var(--text-muted)}.error button{justify-self:center;padding:6px 11px;border:1px solid var(--strong);background:var(--control);border-radius:8px;font-size:11.5px}
.composer-wrap{position:relative;z-index:1;padding:8px 12px 12px;flex-shrink:0}
.email-trigger{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin:0;padding:8px 11px;border:1px solid var(--blue);border-radius:11px 11px 5px 5px;background:var(--blue);color:#fff;font-size:11.5px;font-weight:600;line-height:1.35;text-align:center;box-shadow:inset 0 1px 0 #ffffff14}
.email-trigger:hover{background:color-mix(in srgb,var(--blue) 84%,white);border-color:color-mix(in srgb,var(--blue) 84%,white)}
.email-trigger svg{width:15px;height:15px}
.email-trigger span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.email-card{display:flex;flex-direction:column;gap:10px;margin:0;padding:14px;border:1px solid var(--strong);border-radius:14px 14px 5px 5px;background:var(--control);box-shadow:0 12px 30px -16px #000c}
.email-title{font-size:14px;font-weight:700;line-height:1.3;color:#fff;text-align:center}
.email-help{font-size:11.5px;line-height:1.45;color:var(--text-muted);text-align:center}
.email-input{width:100%;padding:9px 11px;border:1px solid var(--strong);border-radius:9px;background:var(--surface);color:inherit;font-size:12px;line-height:1.4;outline:none}
.email-input::placeholder{color:var(--text-muted)}
.email-input:focus-visible{outline:2px solid color-mix(in srgb,var(--blue) 70%,white);outline-offset:2px}
.email-actions{display:flex;gap:8px;margin-top:2px}
.email-save{flex:1;padding:9px 12px;border:0;border-radius:9px;background:var(--blue);color:#fff;font-size:12px;font-weight:600;box-shadow:inset 0 1px 0 #ffffff24}
.email-save:hover:not(:disabled){background:color-mix(in srgb,var(--blue) 84%,white)}
.email-skip{flex:0 0 auto;padding:9px 16px;border:1px solid var(--strong);border-radius:9px;background:var(--muted);color:inherit;font-size:12px;font-weight:600}
.email-skip:hover{background:var(--muted-hover,#333)}
.composer{position:relative;background:var(--control);border:1px solid var(--strong);border-radius:12px;box-shadow:inset 0 1px 0 #ffffff06}.composer:focus-within{border-color:#626262}
.email-trigger:not([hidden])~.composer,.email-card:not([hidden])~.composer{border-top:0;border-radius:5px 5px 12px 12px}
.input{display:block;resize:none;width:100%;max-height:96px;min-height:40px;padding:10px 12px 2px;border:0;outline:none!important;color:#f9fbff;background:transparent;font-size:13px;line-height:1.5}.input::placeholder{color:var(--text-muted)}.input:disabled{opacity:.5}
.composer-bar{display:flex;align-items:center;justify-content:space-between;padding:4px 7px 7px}
.preset-menu{position:absolute;left:0;right:0;bottom:calc(100% + 6px);z-index:12;max-height:180px;overflow:auto;padding:4px;border:1px solid var(--strong);border-radius:12px;background:var(--control);box-shadow:0 12px 28px #000a}
.preset-menu-item{display:block;width:100%;padding:8px 9px;border:0;border-radius:7px;background:transparent;color:var(--text-muted);font-size:12px;line-height:1.4;text-align:left}
.preset-menu-item[data-active=true]{background:var(--muted);color:#fff}
.send{width:26px;height:26px;display:grid;place-items:center;border:1px solid #ffffff17;border-radius:7px;padding:0;background:var(--blue);box-shadow:inset 0 2px 4px #ffffff24}.send:disabled{background:#303033;border-color:transparent;color:#67676b;box-shadow:none}.send svg{width:15px;height:15px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@keyframes breathe{from{filter:brightness(.92)}to{filter:brightness(1.08)}}
.widget[data-maximized=true] .launcher-wrap,.widget[data-maximized=true] .notices{display:none}
.widget[data-maximized=true] .panel{position:fixed;inset:0;width:100%;height:100%;min-height:0;max-height:none;border:0;border-radius:0;box-shadow:none}
.widget[data-maximized=true] .header{padding:calc(10px + env(safe-area-inset-top)) calc(18px + env(safe-area-inset-right)) 10px calc(18px + env(safe-area-inset-left));border-radius:0 0 14px 14px}
.widget[data-maximized=true] .topline{min-height:44px;justify-content:space-between}
.widget[data-maximized=true] .identity-text{display:flex;top:50%;max-width:calc(100% - 160px)}
.widget[data-maximized=true] .body{padding:20px calc(24px + env(safe-area-inset-right)) 20px calc(24px + env(safe-area-inset-left))}
.widget[data-maximized=true] .messages{width:100%;max-width:720px;margin:0 auto;gap:14px}
.widget[data-maximized=true] .message{gap:8px}
.widget[data-maximized=true] .message[data-same-author=true]{margin-top:-8px}
.widget[data-maximized=true] .avatar{flex-basis:28px;height:28px}
.widget[data-maximized=true] .avatar-spacer{flex-basis:28px}
.widget[data-maximized=true] .bubble{padding:10px 14px;font-size:14.5px;line-height:1.55;border-radius:15px 15px 15px 5px}
.widget[data-maximized=true] .message[data-author=visitor] .bubble{border-radius:15px 15px 5px 15px}
.widget[data-maximized=true] .meta{margin-top:4px;font-size:11px}
.widget[data-maximized=true] .tick svg{width:14px;height:14px}
.widget[data-maximized=true] .composer-wrap{padding:8px calc(18px + env(safe-area-inset-right)) calc(14px + env(safe-area-inset-bottom)) calc(18px + env(safe-area-inset-left))}
.widget[data-maximized=true] .presets{width:100%;max-width:720px;margin:12px auto 0}
.widget[data-maximized=true] .topic-prompt-card{padding:13px 15px}
.widget[data-maximized=true] .topic-prompt-title{font-size:14.5px}
.widget[data-maximized=true] .topic-prompt-help{font-size:12px}
.widget[data-maximized=true] .topic-trigger{padding:10px 12px;font-size:14px}
.widget[data-maximized=true] .topic-option{padding:9px 11px;font-size:13.5px}
.widget[data-maximized=true] .composer{max-width:720px;margin:0 auto}
.widget[data-maximized=true] .first-chat{max-width:720px;margin:0 auto}
.widget[data-maximized=true] .email-trigger{width:100%;max-width:720px;margin:0 auto;padding:8px 12px}
.widget[data-maximized=true] .email-card{width:100%;max-width:720px;margin:0 auto}
.widget[data-maximized=true] .input{min-height:36px;max-height:120px;padding:8px 12px 2px;font-size:14px}
@media(hover:hover) and (pointer:fine){.icon-btn:hover{background:#ffffff16}.header-art:hover{background:#ffffff20}.menu-item:hover{background:#ffffff12}.notice-close:hover{background:#ffffff16;color:#fff}.notice-open:hover .notice-body{color:#c9c9c9}.send:hover:not(:disabled){background:color-mix(in srgb,var(--blue) 84%,white)}.launcher:hover{background:color-mix(in srgb,var(--blue) 88%,black)}}
@media(max-width:480px){.widget{right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));left:12px;gap:10px}.panel{width:100%;height:min(520px,calc(100dvh - 86px));min-height:220px;border-radius:16px}.launcher{width:52px;height:52px}.header{padding:9px 12px;border-radius:0 0 14px 14px}.input{font-size:16px;min-height:44px}}
@media(prefers-reduced-motion:reduce){.loading-art img,.launcher[data-loading=true] .art{animation:none;filter:brightness(.95)}button:active:not(:disabled){transform:none}}
.typing-row{display:flex;align-items:center;gap:8px;padding:10px 2px 0;font-size:10.5px;color:var(--text-muted)}
.typing-avatar{position:relative;display:inline-grid;place-items:center;width:18px;height:18px;flex:0 0 18px}
.typing-avatar-wrap{position:relative;display:inline-grid;place-items:center;width:100%;height:100%;border-radius:50%}
.typing-avatar-wrap img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.typing-bubble{display:inline-flex;align-items:center;gap:3px;padding:9px 12px;border-radius:13px 13px 13px 4px;background:var(--muted)}
.typing-dot{width:4px;height:4px;border-radius:50%;background:currentColor;animation:typing-bounce .9s ease-in-out infinite}
@keyframes typing-bounce{0%,80%,100%{transform:translateY(0);opacity:.55}40%{transform:translateY(-3px);opacity:1}}
.history{display:flex;flex-direction:column;height:100%;min-height:110px;gap:10px}
.history-list{display:flex;flex-direction:column;flex:1;min-height:0;overflow:auto}
.history-item{display:flex;align-items:center;gap:10px;width:100%;padding:10px 2px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}
.history-item:hover{background:#ffffff08}
.history-avatar{flex:0 0 30px;width:30px;height:30px;display:grid;place-items:center;border-radius:50%;background:var(--blue);overflow:hidden}
.history-avatar img{width:74%;height:74%;min-width:0;min-height:0}
.history-text{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
.history-who{font-size:12.5px;font-weight:500;color:#fff}
.history-msg{font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.history-chevron{flex:0 0 auto;display:flex;color:var(--text-muted)}
.history-chevron svg{width:14px;height:14px}
.history-new{display:flex;align-items:center;justify-content:center;gap:6px;margin:4px auto 0;padding:10px 18px;border:0;border-radius:999px;background:var(--blue);color:#fff;font-size:12px;font-weight:600;align-self:center}
.history-new svg{width:15px;height:15px}
.history-new:disabled{opacity:.6}
.history-empty{padding:18px 8px;text-align:center;font-size:11.5px;color:var(--text-muted)}
.ended{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:100%;min-height:180px;padding:0 12px;text-align:center}
.ended-avatar{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:var(--blue);overflow:hidden;margin-bottom:2px}
.ended-avatar-img{width:100%;height:100%;object-fit:cover}
.ended-avatar .art{width:74%;height:74%}
.ended-avatar-initial{font-size:16px;font-weight:600;line-height:1;color:#fff}
.ended-title{font-size:13px;font-weight:600;color:#fff}
.ended-text{font-size:11.5px;color:var(--text-muted)}
.ended-new{display:inline-flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;padding:10px 18px;border:0;border-radius:999px;background:var(--blue);color:#fff;font-size:12px;font-weight:600;align-self:center}
.ended-new svg{width:15px;height:15px}
.ended-new:disabled{opacity:.6}
.csat-actions{display:flex;gap:6px}
.csat-btn{display:grid;place-items:center;width:32px;height:32px;padding:0;border:1px solid var(--strong);border-radius:8px;background:var(--control);color:inherit}
.csat-btn[data-active=true]{border-color:var(--blue);background:var(--blue);color:#fff}
.bar-left{display:flex;align-items:center;gap:4px;min-width:0}
.attach{display:grid;place-items:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--text-muted)}
.attach svg{width:14px;height:14px}
.attach:disabled{opacity:.4}
.attach-input{display:none}
.attach-chip{display:flex;align-items:center;gap:6px;margin:0 10px 6px;padding:5px 8px;border:1px solid var(--strong);border-radius:8px;background:var(--control);font-size:10.5px;color:var(--text-muted)}
.attach-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.attach-remove{display:grid;place-items:center;width:16px;height:16px;margin-left:auto;padding:0;border:0;background:transparent;color:inherit}
.attach-remove svg{width:9px;height:9px}
.attachment-image{display:block;max-width:100%;max-height:180px;margin-top:6px;border-radius:8px}
.attachment-file{display:block;margin-top:6px;padding:5px 8px;border-radius:7px;background:#0003;font-size:10.5px;text-decoration:underline;overflow-wrap:anywhere}
`;
