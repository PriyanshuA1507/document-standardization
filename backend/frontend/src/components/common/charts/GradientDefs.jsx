import React from 'react';

export default function GradientDefs() {
  return (
    <defs>
      {/* Primary Cyan (Dark) */}
      <linearGradient id="cyberCyanGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.85} />
        <stop offset="100%" stopColor="#007799" stopOpacity={0.05} />
      </linearGradient>

      {/* Primary Cyan (Light) */}
      <linearGradient id="cyberCyanGradientLight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0284C7" stopOpacity={0.5} />
        <stop offset="100%" stopColor="#0284C7" stopOpacity={0.03} />
      </linearGradient>

      {/* Mint Success (Dark) */}
      <linearGradient id="cyberMintGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#00E676" stopOpacity={0.85} />
        <stop offset="100%" stopColor="#009944" stopOpacity={0.05} />
      </linearGradient>

      {/* Mint Success (Light) */}
      <linearGradient id="cyberMintGradientLight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#059669" stopOpacity={0.5} />
        <stop offset="100%" stopColor="#059669" stopOpacity={0.03} />
      </linearGradient>

      {/* Critical Red */}
      <linearGradient id="cyberRedGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FF1744" stopOpacity={0.85} />
        <stop offset="100%" stopColor="#990011" stopOpacity={0.05} />
      </linearGradient>

      {/* Warning Amber */}
      <linearGradient id="cyberAmberGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FF9100" stopOpacity={0.85} />
        <stop offset="100%" stopColor="#B35500" stopOpacity={0.05} />
      </linearGradient>

      {/* Info Purple */}
      <linearGradient id="cyberPurpleGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7C4DFF" stopOpacity={0.85} />
        <stop offset="100%" stopColor="#4A148C" stopOpacity={0.05} />
      </linearGradient>

      {/* Radial highlight for donut / pie */}
      <radialGradient id="cyberRadialGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.25} />
        <stop offset="70%" stopColor="#00D4FF" stopOpacity={0.05} />
        <stop offset="100%" stopColor="#00D4FF" stopOpacity={0} />
      </radialGradient>
    </defs>
  );
}
