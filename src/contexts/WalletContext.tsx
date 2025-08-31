import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { connectToLiskTestnet, isConnectedToLiskChain } from '../config/liskChain';

interface WalletContextType {
  isConnected: boolean;
  isConnecting: boolean;
  walletAddress: string;
  isCorrectChain: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [isCorrectChain, setIsCorrectChain] = useState(false);

  // Verificar estado de conexión al cargar
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  // Verificar estado de conexión
  const checkConnectionStatus = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        return;
      }

      // Verificar si hay cuentas conectadas
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        const address = accounts[0];
        setWalletAddress(address);
        setIsConnected(true);
        
        // Verificar si está en la cadena correcta
        const correctChain = await isConnectedToLiskChain();
        setIsCorrectChain(correctChain);
      }
    } catch (error) {
      console.error('Error al verificar estado de conexión:', error);
    }
  };

  // Conectar wallet
  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      
      // Conectar a Lisk Testnet
      const connected = await connectToLiskTestnet();
      if (!connected) {
        throw new Error('No se pudo conectar a Lisk Testnet');
      }

      // Solicitar conexión de cuenta
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('No se seleccionó ninguna cuenta');
      }

      const address = accounts[0];
      setWalletAddress(address);
      setIsConnected(true);
      setIsCorrectChain(true);
    } catch (error) {
      console.error('Error al conectar wallet:', error);
      alert('Error al conectar wallet: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsConnecting(false);
    }
  };

  // Desconectar wallet
  const disconnectWallet = () => {
    setIsConnected(false);
    setWalletAddress('');
    setIsCorrectChain(false);
  };

  // Escuchar cambios de cuenta y cadena
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setIsConnected(false);
          setWalletAddress('');
          setIsCorrectChain(false);
        } else {
          setWalletAddress(accounts[0]);
          checkConnectionStatus();
        }
      };

      const handleChainChanged = () => {
        checkConnectionStatus();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const value: WalletContextType = {
    isConnected,
    isConnecting,
    walletAddress,
    isCorrectChain,
    connectWallet,
    disconnectWallet,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
