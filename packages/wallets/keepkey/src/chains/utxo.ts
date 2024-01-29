import type { BaseUTXOToolbox, UTXOToolbox, UTXOTransferParams } from '@coinmasters/toolbox-utxo';
import {
  BCHToolbox,
  BTCToolbox,
  DASHToolbox,
  DOGEToolbox,
  LTCToolbox,
  ZCASHToolbox,
} from '@coinmasters/toolbox-utxo';
import type { UTXOChain } from '@coinmasters/types';
import { Chain, DerivationPath, FeeOption } from '@coinmasters/types';
import { toCashAddress } from 'bchaddrjs';
import type { Psbt } from 'bitcoinjs-lib';

import { bip32ToAddressNList, ChainToKeepKeyName } from '../helpers/coins.ts';

type Params = {
  sdk: any;
  chain: UTXOChain;
  apiKey?: string;
  apiClient?: ReturnType<typeof BaseUTXOToolbox>['apiClient'];
};

interface psbtTxOutput {
  address: string;
  script: Uint8Array;
  value: number;
  change?: boolean; // Optional, assuming it indicates if the output is a change
}
interface ExtendedPsbt extends Psbt {
  txOutputs: psbtTxOutput[];
}
interface KeepKeyInputObject {
  addressNList: number[];
  scriptType: string;
  amount: string;
  vout: number;
  txid: string;
  hex: string;
}

const getToolbox = ({ chain, apiClient, apiKey }: Omit<Params, 'sdk'>) => {
  switch (chain) {
    case Chain.Bitcoin:
      return { toolbox: BTCToolbox({ apiClient, apiKey }), segwit: true };
    case Chain.Litecoin:
      return { toolbox: LTCToolbox({ apiClient, apiKey }), segwit: true };
    case Chain.Dash:
      return { toolbox: DASHToolbox({ apiClient, apiKey }), segwit: false };
    case Chain.Zcash:
      return { toolbox: ZCASHToolbox({ apiClient, apiKey }), segwit: false };
    case Chain.Dogecoin:
      return { toolbox: DOGEToolbox({ apiClient, apiKey }), segwit: false };
    case Chain.BitcoinCash:
      return { toolbox: BCHToolbox({ apiClient, apiKey }), segwit: false };
  }
};

export const utxoWalletMethods = async ({
  sdk,
  paths,
  chain,
  apiKey,
  apiClient,
}: Params): Promise<
  UTXOToolbox & {
    getAddress: () => string;
    signTransaction: (
      psbt: ExtendedPsbt,
      inputs: KeepKeyInputObject[],
      memo?: string,
    ) => Promise<string>;
    transfer: (params: UTXOTransferParams) => Promise<string>;
  }
> => {
  if (!apiKey) throw new Error('UTXO API key not found');
  const { toolbox, segwit } = getToolbox({ chain, apiClient, apiKey });

  const scriptType = segwit ? 'p2wpkh' : 'p2pkh';
  if (!ChainToKeepKeyName[chain]) throw Error('ChainToKeepKeyName: unknown chain: ' + chain);
  const addressInfo = {
    coin: ChainToKeepKeyName[chain],
    script_type: scriptType,
    address_n: bip32ToAddressNList(DerivationPath[chain]),
  };
  //console.log('addressInfo: ', addressInfo);
  const { address: walletAddress } = await sdk.address.utxoGetAddress(addressInfo);

  // @ts-ignore
  const _getPubkeys = async (paths: any) => {
    try {
      //console.log('paths: ', paths);

      console.time('getPubkeys Duration' + chain); // Starts the timer
      const pubkeys = await Promise.all(
        paths.map((path: any) => {
          // Create the path query from the original path object
          const pathQuery = {
            symbol: 'BTC',
            coin: 'Bitcoin',
            script_type: 'p2pkh',
            address_n: path.addressNList,
            showDisplay: false,
          };

          //console.log('pathQuery: ', pathQuery);
          return sdk.system.info.getPublicKey(pathQuery).then((response: any) => {
            //console.log('response: ', response);
            // Combine the original path object with the xpub from the response
            const combinedResult = {
              ...path, // Contains all fields from the original path
              xpub: response.xpub, // Adds the xpub field from the response
            };
            //console.log('combinedResult: ', combinedResult);
            return combinedResult;
          });
        }),
      );
      console.timeEnd('getPubkeys Duration' + chain); // Ends the timer and logs the duration

      return pubkeys;
    } catch (e) {
      console.error(e);
      console.timeEnd('getPubkeys Duration' + chain); // Ensure the timer is ended in case of error
    }
  };
  const pubkeys = await _getPubkeys(paths);
  const getPubkeys = async () => pubkeys;
  //console.log('pubkeys: ', pubkeys);

  const signTransaction = async (psbt: Psbt, inputs: KeepKeyInputObject[], memo: string = '') => {
    //console.log('psbt.txOutputs: ', psbt.txOutputs);
    const outputs = psbt.txOutputs
      .map((output) => {
        const { value, address, change } = output as psbtTxOutput;

        const outputAddress =
          chain === Chain.BitcoinCash && address
            ? (toolbox as ReturnType<typeof BCHToolbox>).stripPrefix(toCashAddress(address))
            : address;

        if (change || address === walletAddress) {
          return {
            addressNList: addressInfo.address_n,
            isChange: true,
            addressType: 'change',
            amount: value,
            scriptType,
          };
        } else {
          if (outputAddress) {
            return { address: outputAddress, amount: value, addressType: 'spend' };
          } else {
            return null;
          }
        }
      })
      .filter(Boolean);

    function removeNullAndEmptyObjectsFromArray(arr: any[]): any[] {
      return arr.filter(
        (item) => item !== null && typeof item === 'object' && Object.keys(item).length !== 0,
      );
    }
    // console.log({
    //   coin: ChainToKeepKeyName[chain],
    //   inputs,
    //   outputs: removeNullAndEmptyObjectsFromArray(outputs),
    //   version: 1,
    //   locktime: 0,
    // });
    try {
      const responseSign = await sdk.utxo.utxoSignTransaction({
        coin: ChainToKeepKeyName[chain],
        inputs,
        outputs: removeNullAndEmptyObjectsFromArray(outputs),
        version: 1,
        locktime: 0,
        opReturnData: memo,
      });
      //console.log('responseSign: ', responseSign);
      return responseSign.serializedTx;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const transfer = async ({
    from,
    recipient,
    feeOptionKey,
    feeRate,
    memo,
    ...rest
  }: UTXOTransferParams) => {
    if (!from) throw new Error('From address must be provided');
    if (!recipient) throw new Error('Recipient address must be provided');

    const { psbt, inputs: rawInputs } = await toolbox.buildTx({
      ...rest,
      pubkeys: await getPubkeys(),
      memo,
      feeOptionKey,
      recipient,
      feeRate: feeRate || (await toolbox.getFeeRates())[feeOptionKey || FeeOption.Fast],
      sender: from,
      fetchTxHex: chain,
    });

    const inputs = rawInputs.map(({ value, index, hash, txHex }) => ({
      //@TODO don't hardcode master, lookup on blockbook what input this is for and what path that address is!
      addressNList: addressInfo.address_n,
      scriptType,
      amount: value.toString(),
      vout: index,
      txid: hash,
      hex: txHex || '',
    }));
    //console.log('transfer inputs: ', inputs);
    const txHex = await signTransaction(psbt, inputs, memo);
    //console.log('txHex: ', txHex);
    return toolbox.broadcastTx(txHex);
  };

  return {
    ...toolbox,
    getPubkeys,
    getAddress: () => walletAddress as string,
    signTransaction,
    transfer,
  };
};
