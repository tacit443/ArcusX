import React from 'react';
import { FaWallet, FaSpinner } from 'react-icons/fa';
import { useWallet } from '../contexts/WalletContext';
import '../css/WalletConnect.css';

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

const WalletConnect: React.FC<WalletConnectProps> = ({ onConnect, onDisconnect }) => {
  const { 
    isConnected, 
    isConnecting, 
    walletAddress, 
    isCorrectChain, 
    connectWallet 
  } = useWallet();

  // Formatear dirección de wallet
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isConnecting) {
    return (
      <button className="wallet-connect-btn connecting" disabled>
        <FaSpinner className="spinner" />
        Conectando...
      </button>
    );
  }

  if (isConnected && isCorrectChain) {
    return (
      <div className="wallet-connected">
        <FaWallet className="wallet-icon" />
        <span className="wallet-address">
          {formatAddress(walletAddress)}
        </span>
        <span className="chain-badge">Lisk Testnet</span>
      </div>
    );
  }

  if (isConnected && !isCorrectChain) {
    return (
      <button className="wallet-connect-btn wrong-chain" onClick={connectWallet}>
        <FaWallet />
        Cambiar a Lisk Testnet
      </button>
    );
  }

  return (
    <button className="wallet-connect-btn" onClick={connectWallet}>
      <FaWallet />
      Conectar Wallet
    </button>
  );
};

export default WalletConnect;
