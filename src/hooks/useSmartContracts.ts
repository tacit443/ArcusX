import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, connectToLiskTestnet } from '../config/liskChain';

export const useSmartContracts = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [autoConnecting, setAutoConnecting] = useState(false);

  // Conectar al contrato
  const connectToContract = async () => {
    try {
      setIsLoading(true);
      
      // Conectar a Lisk Testnet
      const connected = await connectToLiskTestnet();
      if (!connected) {
        throw new Error('No se pudo conectar a Lisk Testnet');
      }

      // Verificar si MetaMask está instalado
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask no está instalado');
      }

      // Solicitar conexión de cuenta
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('No se seleccionó ninguna cuenta');
      }

      // Crear provider y signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signerInstance = await provider.getSigner();
      
      // Crear instancia del contrato
      const contractInstance = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signerInstance
      );

      setSigner(signerInstance);
      setContract(contractInstance);
      setIsConnected(true);
      
      return true;
    } catch (error) {
      console.error('Error al conectar al contrato:', error);
      setIsConnected(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Crear tarea en blockchain
  const createTask = async (
    title: string,
    description: string,
    deadline: number,
    amount: string
  ) => {
    try {
      if (!contract || !signer) {
        throw new Error('No hay conexión al contrato');
      }

      // Debug: Imprimir monto original
      console.log('Monto original:', amount, 'ETH');
      
      // Convertir amount a wei
      const amountWei = ethers.parseEther(amount);
      console.log('Monto en wei:', amountWei.toString());
      
      // Validar que el monto sea mayor a 0
      if (amountWei <= 0n) {
        throw new Error('El monto debe ser mayor a 0');
      }
      
      console.log('Enviando transacción con valor:', amountWei.toString());
      
      // Crear transacción
      const tx = await contract.createTask(title, description, deadline, {
        value: amountWei,
      });

      // Esperar confirmación
      const receipt = await tx.wait();
      
      // Debug: Imprimir información de la transacción
      console.log('Transacción confirmada:', receipt);
      console.log('Logs de la transacción:', receipt.logs);
      
      // Intentar extraer el taskId de diferentes formas
      let taskId = null;
      
      if (receipt.logs && receipt.logs.length > 0) {
        console.log('Primer log:', receipt.logs[0]);
        
        // Intentar acceder al taskId de diferentes maneras
        if (receipt.logs[0].args && receipt.logs[0].args.taskId) {
          taskId = receipt.logs[0].args.taskId.toString();
          console.log('TaskId encontrado en args:', taskId);
        } else if (receipt.logs[0].topics && receipt.logs[0].topics.length > 0) {
          // Si no hay args, intentar extraer de los topics
          console.log('Topics del log:', receipt.logs[0].topics);
        }
      }
      
      // Si no se pudo extraer el taskId, usar el contador actual + 1
      if (!taskId) {
        try {
          const currentCount = await contract.getTaskCount();
          taskId = (currentCount + 1n).toString();
          console.log('TaskId calculado del contador:', taskId);
        } catch (countError) {
          console.error('Error al obtener contador de tareas:', countError);
        }
      }
      
      return {
        success: true,
        transactionHash: receipt.hash,
        taskId: taskId,
      };
    } catch (error) {
      console.error('Error al crear tarea:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  };

  // Asignar worker a tarea
  const assignWorker = async (taskId: number, workerAddress: string) => {
    try {
      if (!contract) {
        throw new Error('No hay conexión al contrato');
      }

      const tx = await contract.assignWorker(taskId, workerAddress);
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (error) {
      console.error('Error al asignar worker:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  };

  // Completar tarea
  const completeTask = async (taskId: number) => {
    try {
      if (!contract) {
        throw new Error('No hay conexión al contrato');
      }

      const tx = await contract.completeTask(taskId);
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (error) {
      console.error('Error al completar tarea:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  };

  // Liberar pago
  const releasePayment = async (taskId: number) => {
    try {
      if (!contract) {
        throw new Error('No hay conexión al contrato');
      }

      const tx = await contract.releasePayment(taskId);
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (error) {
      console.error('Error al liberar pago:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  };

  // Reembolsar tarea
  const refundTask = async (taskId: number) => {
    try {
      if (!contract) {
        throw new Error('No hay conexión al contrato');
      }

      const tx = await contract.refundTask(taskId);
      const receipt = await tx.wait();
      
      return {
        success: true,
        transactionHash: receipt.hash,
      };
    } catch (error) {
      console.error('Error al reembolsar tarea:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  };

  // Obtener tarea
  const getTask = async (taskId: number) => {
    try {
      if (!contract) {
        throw new Error('No hay conexión al contrato');
      }

      const task = await contract.getTask(taskId);
      return {
        success: true,
        task: {
          employer: task.employer,
          worker: task.worker,
          amount: task.amount.toString(),
          isCompleted: task.isCompleted,
          isPaid: task.isPaid,
          deadline: task.deadline.toString(),
          title: task.title,
          description: task.description,
        },
      };
    } catch (error) {
      console.error('Error al obtener tarea:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  };

  // Obtener conteo de tareas
  const getTaskCount = async () => {
    try {
      if (!contract) {
        throw new Error('No hay conexión al contrato');
      }

      const count = await contract.getTaskCount();
      return {
        success: true,
        count: count.toString(),
      };
    } catch (error) {
      console.error('Error al obtener conteo de tareas:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  };

  // Formatear cantidad de ETH
  const formatAmount = (amountWei: string) => {
    try {
      return ethers.formatEther(amountWei);
    } catch {
      return '0';
    }
  };

  // Obtener estado de tarea
  const getTaskStatus = (task: any) => {
    if (task.isPaid) return 'Pagada';
    if (task.isCompleted) return 'Completada';
    if (task.worker !== '0x0000000000000000000000000000000000000000') return 'Asignada';
    return 'Disponible';
  };

  // Función para conectar automáticamente cuando se detecte wallet
  const autoConnect = async () => {
    if (autoConnecting || isConnected) return;
    
    try {
      setAutoConnecting(true);
      const connected = await connectToContract();
      if (connected) {
        console.log('Conexión automática al contrato exitosa');
      }
    } catch (error) {
      console.error('Error en conexión automática:', error);
    } finally {
      setAutoConnecting(false);
    }
  };

  // Escuchar cambios de cuenta
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setIsConnected(false);
          setContract(null);
          setSigner(null);
        } else {
          // Si hay cuenta conectada, conectar al contrato automáticamente
          autoConnect();
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  // Conectar automáticamente cuando se detecte wallet
  useEffect(() => {
    const checkAndConnect = async () => {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0 && !isConnected) {
          autoConnect();
        }
      }
    };
    
    checkAndConnect();
  }, []);

  return {
    isConnected,
    isLoading,
    contract,
    signer,
    connectToContract,
    createTask,
    assignWorker,
    completeTask,
    releasePayment,
    refundTask,
    getTask,
    getTaskCount,
    formatAmount,
    getTaskStatus,
  };
};
