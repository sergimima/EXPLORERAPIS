/**
 * Tipos de redes blockchain soportadas
 */
export type Network = 'base' | 'base-testnet';

/**
 * Información de un token
 */
export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  address: string;
}

/**
 * Información de un schedule de vesting
 */
export interface VestingSchedule {
  vestingId?: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  totalAmount: string;
  vestedAmount: string;
  claimableAmount: string;
  remainingAmount: string;
  releasedAmount: string;
  startTime: number;
  endTime: number;
  cliff?: number;
  cliffEndTime?: number;
  slicePeriodSeconds?: number;
  revocable?: boolean;
  nextUnlockTime?: number;
  nextUnlockAmount?: string;
}
