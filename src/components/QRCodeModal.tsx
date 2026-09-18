import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Smartphone, ExternalLink, Copy, Check, ChevronDown, ChevronUp, Keyboard, Gamepad2, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';

interface QRCodeModalProps {
  roomId: string;
  isControllerConnected: boolean;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onSimulateConnect?: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  roomId,
  isControllerConnected,
  isMinimized,
  onToggleMinimize,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [publicOrigin, setPublicOrigin] = useState<string>('');

  useEffect(() => {
    // 1. Fetch server config to obtain the publicly accessible preview URL (ais-pre)
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        if (data.publicUrl) {
          setPublicOrigin(data.publicUrl);
        }
      })
      .catch(() => {});

    // Fallback: If window.location contains ais-dev-, the public URL for other family/friends without owner auth is ais-pre-
    if (typeof window !== 'undefined') {
      const currentOrigin = window.location.origin;
      if (currentOrigin.includes('ais-dev-')) {
        setPublicOrigin(currentOrigin.replace('ais-dev-', 'ais-pre-'));
      } else {
        setPublicOrigin(currentOrigin);
      }
    }
  }, []);

  // Use public preview origin if available, avoiding the 403 Forbidden on dev container
  const baseOrigin = publicOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
  const controllerUrl = `${baseOrigin}/?mode=controller&room=${roomId}`;
  const isDevUrl = typeof window !== 'undefined' && window.location.origin.includes('ais-dev-');

  const copyToClipboard = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(controllerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openControllerTab = () => {
    window.open(controllerUrl, '_blank');
  };

  return (
    <div
      id="qr-connect-panel"
      className="absolute top-4 left-4 z-30 transition-all duration-300 max-w-sm w-full"
    >
      <div className="bg-neutral-900/95 backdrop-blur-md border border-neutral-800 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] overflow-hidden">
        {/* Header Bar */}
        <div
          id="qr-panel-header"
          onClick={onToggleMinimize}
          className="p-3.5 bg-neutral-800/80 border-b border-neutral-700/60 flex items-center justify-between cursor-pointer hover:bg-neutral-800 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${isControllerConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'}`}>
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wide text-neutral-200">스마트폰 조이스틱 연결</span>
                {isControllerConnected ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    연결됨
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium border border-amber-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    대기 중
                  </span>
                )}
              </div>
              <span className="text-[11px] text-neutral-400 font-mono">
                ROOM: <strong className="text-amber-400 tracking-wider">{roomId}</strong>
              </span>
            </div>
          </div>

          <button
            id="btn-toggle-qr"
            className="p-1 rounded-lg text-neutral-400 hover:text-white"
            title={isMinimized ? '패널 열기' : '패널 접기'}
          >
            {isMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Panel Body (Collapsible) */}
        {!isMinimized && (
          <div id="qr-panel-body" className="p-4 flex flex-col items-center gap-3.5 text-neutral-200">
            {/* Connection state banner */}
            {isControllerConnected ? (
              <div
                id="controller-ready-banner"
                className="w-full p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300"
              >
                <Gamepad2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="font-bold">스마트폰이 연결되었습니다!</div>
                  <div className="text-[11px] text-emerald-400/80">휴대폰 화면의 조이스틱과 페달로 자동차를 조작하세요.</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-neutral-400 text-center leading-relaxed">
                스마트폰의 <span className="text-amber-400 font-bold">기본 카메라 앱</span>으로 아래 QR 코드를 비추면 즉시 조이스틱 화면이 열립니다.
              </div>
            )}

            {/* QR Code Container */}
            <div
              id="qr-svg-wrapper"
              className="p-3 bg-white rounded-xl shadow-lg flex items-center justify-center border-2 border-amber-400/80"
            >
              <QRCodeSVG
                value={controllerUrl}
                size={168}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Link Copy & Open Tab */}
            <div className="w-full flex items-center gap-2">
              <button
                id="btn-copy-link"
                onClick={copyToClipboard}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-medium text-neutral-200 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-neutral-400" />}
                <span>{copied ? '복사 완료!' : 'URL 복사'}</span>
              </button>

              <button
                id="btn-open-tab"
                onClick={openControllerTab}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-medium text-amber-400 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>새 탭으로 열기</span>
              </button>
            </div>

            {/* 403 Forbidden Guidance Box for family/external phones */}
            <div
              id="notice-403-guide"
              className="w-full p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 flex flex-col gap-1.5 text-[11px] text-amber-200/90"
            >
              <div className="flex items-center gap-1.5 font-bold text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>스마트폰에서 403 에러가 뜰 때 해결법:</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[10.5px] text-neutral-300">
                <li>
                  현재 QR 코드를 <strong className="text-emerald-400">공개 프리뷰 주소(ais-pre)</strong>로 자동 변경 적용했습니다.
                </li>
                <li>
                  가장 확실한 방법: 상단 AI Studio 화면 우측 상단의 <strong className="text-white">공유(Share)</strong> 버튼을 눌러 링크를 열어두거나, 작성자 계정으로 로그인된 폰 또는 <strong>동일한 Wi-Fi</strong> 환경에서 접속하시면 즉시 연결됩니다!
                </li>
              </ul>
            </div>

            {/* Keyboard Control Fallback */}
            <div
              id="keyboard-hint"
              className="w-full pt-2 border-t border-neutral-800 flex flex-col gap-1.5 text-[11px] text-neutral-400"
            >
              <div className="flex items-center gap-1.5 font-semibold text-neutral-300">
                <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
                <span>PC 키보드로도 조작 가능</span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-neutral-400 pl-1">
                <span>• <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-300">W</kbd> <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-300">↑</kbd> 가속</span>
                <span>• <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-300">S</kbd> <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-300">↓</kbd> 브레이크/후진</span>
                <span>• <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-300">A</kbd> <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-300">D</kbd> 방향 조향</span>
                <span>• <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-300">Space</kbd> 터보 부스터</span>
                <span>• <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-300">H</kbd> 경적</span>
                <span>• <kbd className="px-1 py-0.5 bg-neutral-800 rounded text-neutral-300">L</kbd> 전조등 ON/OFF</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
