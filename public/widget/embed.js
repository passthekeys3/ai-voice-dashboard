/**
 * BuildVoiceAI Voice Widget — Embed Script
 *
 * Usage:
 * <script src="https://buildvoiceai.com/widget/embed.js"
 *   data-agent-id="agent-uuid-here"
 *   data-color="#0f172a"
 *   data-position="right">
 * </script>
 */
(function () {
    'use strict';

    // Prevent double-init
    if (window.__buildvoiceaiWidget) return;
    window.__buildvoiceaiWidget = true;

    // Read config from script tag attributes
    // Fallback for defer/async contexts where document.currentScript is null
    var script = document.currentScript || document.querySelector('script[src*="widget/embed.js"]');
    if (!script) return;

    var agentId = script.getAttribute('data-agent-id');
    if (!agentId) {
        console.error('[BuildVoiceAI] Missing data-agent-id attribute on embed script.');
        return;
    }

    var color = script.getAttribute('data-color') || '#0f172a';
    var position = script.getAttribute('data-position') || 'right';

    // Determine base URL from the script's src
    var baseUrl = '';
    try {
        var src = script.getAttribute('src');
        if (src) {
            var url = new URL(src, window.location.href);
            baseUrl = url.origin;
        }
    } catch (e) {
        // Fallback: use script src directory
        baseUrl = '';
    }

    var isOpen = false;
    var iframe = null;
    var overlay = null;

    // ── Create floating button ──
    var btn = document.createElement('button');
    btn.id = 'buildvoiceai-widget-btn';
    btn.setAttribute('aria-label', 'Open voice assistant');
    Object.assign(btn.style, {
        position: 'fixed',
        bottom: '20px',
        [position === 'left' ? 'left' : 'right']: '20px',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        backgroundColor: color,
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        zIndex: '2147483646',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        padding: '0',
    });

    // Phone icon SVG
    btn.innerHTML =
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>' +
        '</svg>';

    btn.addEventListener('mouseenter', function () {
        btn.style.transform = 'scale(1.08)';
        btn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)';
    });
    btn.addEventListener('mouseleave', function () {
        if (!isOpen) {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
        }
    });

    document.body.appendChild(btn);

    // ── Open / Close logic ──
    function openWidget() {
        if (isOpen) return;
        isOpen = true;

        // Change button to close icon
        btn.innerHTML =
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
            '</svg>';
        btn.style.transform = 'scale(1)';

        // Create iframe
        iframe = document.createElement('iframe');
        iframe.id = 'buildvoiceai-widget-frame';
        iframe.src = baseUrl + '/widget/' + agentId;
        iframe.setAttribute('allow', 'microphone');
        Object.assign(iframe.style, {
            position: 'fixed',
            bottom: '92px',
            [position === 'left' ? 'left' : 'right']: '20px',
            width: '380px',
            height: '520px',
            maxHeight: 'calc(100vh - 120px)',
            maxWidth: 'calc(100vw - 40px)',
            border: 'none',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: '2147483647',
            opacity: '0',
            transform: 'translateY(12px) scale(0.95)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            backgroundColor: '#ffffff',
        });

        document.body.appendChild(iframe);

        // Animate in
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                iframe.style.opacity = '1';
                iframe.style.transform = 'translateY(0) scale(1)';
            });
        });
    }

    function closeWidget() {
        if (!isOpen) return;
        isOpen = false;

        // Restore phone icon
        btn.innerHTML =
            '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>' +
            '</svg>';
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';

        if (iframe) {
            iframe.style.opacity = '0';
            iframe.style.transform = 'translateY(12px) scale(0.95)';
            var ref = iframe;
            setTimeout(function () {
                if (ref && ref.parentNode) {
                    ref.parentNode.removeChild(ref);
                }
            }, 300);
            iframe = null;
        }
    }

    function minimizeWidget() {
        closeWidget();
    }

    btn.addEventListener('click', function () {
        if (isOpen) {
            closeWidget();
        } else {
            openWidget();
        }
    });

    // Listen for messages from the widget iframe
    window.addEventListener('message', function (event) {
        if (!event.data || event.data.type !== 'buildvoiceai-widget') return;

        switch (event.data.action) {
            case 'close':
                closeWidget();
                break;
            case 'minimize':
                minimizeWidget();
                break;
            case 'call-started':
                // Pulsing animation on button during active call
                btn.style.boxShadow = '0 0 0 4px ' + color + '40, 0 4px 16px rgba(0,0,0,0.2)';
                break;
            case 'call-ended':
                btn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
                break;
        }
    });
})();
