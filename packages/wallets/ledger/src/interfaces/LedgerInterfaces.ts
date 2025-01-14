import type { UTXOType } from '@coinmasters/toolbox-utxo';
import type BitcoinApp from '@ledgerhq/hw-app-btc';
import { toCashAddress } from 'bchaddrjs';
import { type Network as BTCNetwork, networks, type Psbt } from 'bitcoinjs-lib';

import { BinanceApp } from '../clients/binance/lib.ts';
import { THORChainApp } from '../clients/thorchain/lib.ts';
import { getLedgerTransport } from '../helpers/getLedgerTransport.ts';

import type { CreateTransactionArg } from './types.ts';
import { signUTXOTransaction } from './utxo.ts';

export abstract class CommonLedgerInterface {
  public ledgerTimeout: number = 50000;
  public derivationPath: (number | string)[] | string = [];
  public transport: any;
  public ledgerApp: any;
  public chain: 'thor' | 'bnb' | 'sol' | 'cosmos' | 'eth' = 'thor';

  public checkOrCreateTransportAndLedger = async () => {
    if (this.transport && this.ledgerApp) return;

    try {
      this.transport ||= await getLedgerTransport();

      switch (this.chain) {
        case 'bnb': {
          return (this.ledgerApp ||= new BinanceApp(this.transport));
        }

        case 'thor': {
          return (this.ledgerApp ||= new THORChainApp(this.transport));
        }

        case 'cosmos': {
          const { default: CosmosApp } = await import('@ledgerhq/hw-app-cosmos');

          // @ts-expect-error `default` typing is wrong
          return (this.ledgerApp ||= new CosmosApp(this.transport));
        }
      }
    } catch (error: any) {
      console.error(error);
      throw new Error('Cannot create transport or ledger client');
    }
  };
}

export abstract class UTXOLedgerInterface {
  public addressNetwork: BTCNetwork = networks.bitcoin;
  public paths: any;
  // @ts-expect-error `default` typing is wrong
  public btcApp: InstanceType<typeof BitcoinApp> | null = null;
  public chain: 'bch' | 'btc' | 'ltc' | 'doge' = 'btc';
  public derivationPath = '';
  public ledgerApp: any;
  public additionalSignParams?: Partial<CreateTransactionArg>;
  public transport = null as any;
  public walletFormat: 'legacy' | 'bech32' | 'p2sh' = 'bech32';

  public connect = async () => {
    await this.checkBtcAppAndCreateTransportWebUSB(false);

    const { default: BitcoinApp } = await import('@ledgerhq/hw-app-btc');

    // @ts-expect-error `default` typing is wrong
    this.btcApp = new BitcoinApp({ transport: this.transport });
  };

  public signTransaction = async (psbt: Psbt, inputUtxos: UTXOType[]) => {
    await this.checkBtcAppAndCreateTransportWebUSB();

    return signUTXOTransaction(
      { psbt, derivationPath: this.derivationPath, btcApp: this.btcApp, inputUtxos },
      this.additionalSignParams,
    );
  };

  public getAddress = async () => {
    await this.checkBtcAppAndCreateTransportWebUSB();

    const { bitcoinAddress: address } = await this.btcApp!.getWalletPublicKey(this.derivationPath, {
      format: this.walletFormat,
    });

    if (!address) {
      throw new Error(
        `Cannot get ${this.chain} address from ledger derivation path: ${this.derivationPath}`,
      );
    }

    return this.chain === 'bch' && this.walletFormat === 'legacy'
      ? toCashAddress(address).replace(/(bchtest:|bitcoincash:)/, '')
      : address;
  };

  private checkBtcAppAndCreateTransportWebUSB = async (checkBtcApp: boolean = true) => {
    if (checkBtcApp && !this.btcApp) {
      const errorData = JSON.stringify({ checkBtcApp, btcApp: this.btcApp });
      throw new Error(`Ledger connection failed: \n${errorData}`);
    }

    this.transport ||= await getLedgerTransport();
  };

  public getExtendedPublicKey = async (
    path,
    xpubVersion,
  ) => {
    await this.checkBtcAppAndCreateTransportWebUSB();
    console.log("Final: getWalletXpub: ",{
      path,
      xpubVersion,
    })
    return this.btcApp!.getWalletXpub({
      path,
      xpubVersion,
    });
  };
}
