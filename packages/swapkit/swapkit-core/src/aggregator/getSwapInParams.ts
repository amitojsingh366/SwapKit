import { QuoteRoute } from '@thorswap-lib/swapkit-api';

import { AGG_CONTRACT_ADDRESS, lowercasedGenericAbiMappings } from './contracts/index.js';

type Params = {
  calldata: QuoteRoute['calldata'];
  recipient: string;
  contractAddress: AGG_CONTRACT_ADDRESS;
  toChecksumAddress: (address: string) => string;
};

export const getSwapInParams = ({
  contractAddress,
  recipient,
  toChecksumAddress,
  calldata: {
    amount,
    amountOutMin = '',
    data = '',
    deadline,
    router = '',
    tcMemo,
    tcRouter,
    tcVault,
    token,
  },
}: Params) => {
  const isGeneric = !!lowercasedGenericAbiMappings[contractAddress.toLowerCase()];

  if (isGeneric && !router) {
    throw new Error('Router is required on calldata for swapIn with GenericContract');
  }

  /**
   * Data structure for contract calls
   * GENERIC: tcRouter, tcVault, tcMemo, token, amount, router, data, deadline
   * ETH_UNISWAP: tcRouter, tcVault, tcMemo, token, amount, amountOutMin, deadline
   * AVAX_PANGOLIN: tcRouter, tcVault, tcMemo, token, amount, amountOutMin, deadline
   * AVAX_WOOFI: tcRouter, tcVault, tcMemo, token, amount, amountOutMin, deadline
   */

  const baseParams = [
    toChecksumAddress(tcRouter),
    toChecksumAddress(tcVault),
    tcMemo.replace('{recipientAddress}', recipient),
    toChecksumAddress(token),
    amount,
  ];

  const contractParams = isGeneric
    ? [toChecksumAddress(router), data, deadline]
    : [amountOutMin, deadline];

  return [...baseParams, ...contractParams];
};