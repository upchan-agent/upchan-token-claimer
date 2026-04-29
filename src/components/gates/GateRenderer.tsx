'use client';

import { TokenConfig, getGateInfo } from '@/config/tokens';
import { TokenStatus } from '@/lib/useToken';
import { NoGate } from './NoGate';
import { FollowGate } from './FollowGate';
import { UnknownGate } from './UnknownGate';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  onRefetch: () => void;
}

/**
 * Renders the appropriate eligibility gate component based on the token's gate type.
 * Each gate component handles its own connected/following/loading states internally.
 * All gates operate within card-block--lg (130px min-height) for stable layout.
 */
export function GateRenderer({ token, status, onRefetch }: Props) {
  const hasGate = status.mintGate !== '0x0000000000000000000000000000000000000000';

  if (!hasGate) {
    return <NoGate />;
  }

  const gateInfo = getGateInfo(status.mintGate);

  switch (gateInfo.type) {
    case 'lsp26-follow':
      return <FollowGate token={token} status={status} onRefetch={onRefetch} />;
    default:
      return <UnknownGate />;
  }
}
