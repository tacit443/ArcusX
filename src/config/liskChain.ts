// Configuración para Lisk Sepolia Testnet
export const LISK_CHAIN_CONFIG = {
  chainId: '0x106a', // 4202 decimal
  chainName: 'Lisk Sepolia Testnet',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.sepolia-api.lisk.com'],
  blockExplorerUrls: ['https://sepolia-blockscout.lisk.com'],
};

// Dirección del smart contract ArcusXEscrow desplegado
export const CONTRACT_ADDRESS = '0xa67659C90aB441E232FA11aD86E87B257F5D0551';

// ABI del smart contract ArcusXEscrow
export const CONTRACT_ABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_title",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_description",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "_deadline",
        "type": "uint256"
      }
    ],
    "name": "createTask",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_taskId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_worker",
        "type": "address"
      }
    ],
    "name": "assignWorker",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_taskId",
        "type": "uint256"
      }
    ],
    "name": "completeTask",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_taskId",
        "type": "uint256"
      }
    ],
    "name": "releasePayment",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_taskId",
        "type": "uint256"
      }
    ],
    "name": "refundTask",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_taskId",
        "type": "uint256"
      }
    ],
    "name": "getTask",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "employer",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "worker",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isCompleted",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "isPaid",
            "type": "bool"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "title",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "description",
            "type": "string"
          }
        ],
        "internalType": "struct ArcusXEscrow.Task",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTaskCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "employer",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "title",
        "type": "string"
      }
    ],
    "name": "TaskCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "worker",
        "type": "address"
      }
    ],
    "name": "TaskAssigned",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      }
    ],
    "name": "TaskCompleted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "worker",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "PaymentReleased",
    "type": "event"
  }
];

// Función para agregar Lisk Chain a MetaMask
export const addLiskChainToMetaMask = async (): Promise<boolean> => {
  try {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask no está instalado');
    }

    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [LISK_CHAIN_CONFIG],
    });

    return true;
  } catch (error: any) {
    if (error.code === 4902) {
      // La red ya existe, intentar cambiar a ella
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: LISK_CHAIN_CONFIG.chainId }],
        });
        return true;
      } catch (switchError: any) {
        console.error('Error al cambiar a Lisk Chain:', switchError);
        return false;
      }
    }
    console.error('Error al agregar Lisk Chain:', error);
    return false;
  }
};

// Función para verificar si está conectado a Lisk Chain
export const isConnectedToLiskChain = async (): Promise<boolean> => {
  try {
    if (typeof window.ethereum === 'undefined') {
      return false;
    }

    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    return chainId === LISK_CHAIN_CONFIG.chainId;
  } catch (error) {
    console.error('Error al verificar la cadena:', error);
    return false;
  }
};

// Función para conectar a Lisk Testnet
export const connectToLiskTestnet = async (): Promise<boolean> => {
  try {
    // Primero intentar cambiar a la cadena existente
    if (await isConnectedToLiskChain()) {
      return true;
    }

    // Si no está conectado, agregar/cambiar a Lisk Chain
    return await addLiskChainToMetaMask();
  } catch (error) {
    console.error('Error al conectar a Lisk Testnet:', error);
    return false;
  }
};

// Declaración global para window.ethereum
declare global {
  interface Window {
    ethereum: any;
  }
}
