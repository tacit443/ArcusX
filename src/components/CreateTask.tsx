import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowLeft, FaWallet, FaSpinner } from 'react-icons/fa';
import '../css/CreateTask.css';
import axios from 'axios';
import { API_URL } from '../config/database';
import { useSmartContracts } from '../hooks/useSmartContracts';
import WalletConnect from './WalletConnect';
import { useWallet } from '../contexts/WalletContext';

const CreateTask = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    currency: 'USDC', // Cambiado de vuelta a USDC para la API
    difficulty: 'Fácil',
    category: 'Desarrollo',
    subtitle: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'confirmed' | 'failed'>('idle');
  
  // Hook para smart contracts
  const { createTask: createTaskOnChain, isConnected: isContractConnected } = useSmartContracts();
  
  // Hook para wallet (contexto global)
  const { isConnected } = useWallet();

  // Obtener el usuario logeado para obtener su ID
  const storedUser = localStorage.getItem('user');
  const user = storedUser ? JSON.parse(storedUser) : null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    setPaymentStatus('idle');

    // Validar que el usuario está logeado
    if (!user || !user.id) {
      setError('Debes estar logeado para crear una tarea.');
      setLoading(false);
      return;
    }

    // Validar que la wallet esté conectada
    if (!isConnected) {
      setError('Debes conectar tu wallet para crear una tarea.');
      setLoading(false);
      return;
    }

    // Validar que esté conectado al contrato
    if (!isContractConnected) {
      setError('Conectando al contrato... Intenta de nuevo en unos segundos.');
      setLoading(false);
      return;
    }

    // Validar el monto
    const amount = parseFloat(formData.price);
    if (isNaN(amount) || amount <= 0) {
      setError('El monto debe ser un número mayor a 0');
      setLoading(false);
      return;
    }

    if (amount < 0.0001) {
      setError('El monto mínimo es 0.0001 ETH');
      setLoading(false);
      return;
    }

    // Validar campos obligatorios
    if (!formData.title.trim()) {
      setError('El título es obligatorio');
      setLoading(false);
      return;
    }

    if (!formData.description.trim()) {
      setError('La descripción es obligatoria');
      setLoading(false);
      return;
    }

    if (!formData.category || !formData.difficulty) {
      setError('La categoría y dificultad son obligatorias');
      setLoading(false);
      return;
    }

    try {
      // PASO 1: Crear tarea en blockchain (pago primero)
      setPaymentStatus('processing');
      const blockchainResult = await createTaskOnChain(
        formData.title,
        formData.description,
        Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 días desde ahora
        formData.price
      );

      if (!blockchainResult.success) {
        setPaymentStatus('failed');
        setError(`Error en blockchain: ${blockchainResult.error}`);
        setLoading(false);
        return;
      }

      // Debug: Imprimir resultado de blockchain
      console.log('Resultado de blockchain:', blockchainResult);
      
      if (!blockchainResult.taskId) {
        setPaymentStatus('failed');
        setError('Pago exitoso pero no se pudo obtener el ID de la tarea. Revisa la consola para más detalles.');
        setLoading(false);
        return;
      }

      // PASO 2: Pago confirmado, crear tarea en base de datos
      setPaymentStatus('confirmed');
      
      // Debug: Imprimir datos que se envían a la API
      const apiData = {
        ...formData,
        user_id: user.id,
        blockchain_task_id: blockchainResult.taskId,
        transaction_hash: blockchainResult.transactionHash
      };
      console.log('Datos enviados a la API:', apiData);
      
      const response = await axios.post(`${API_URL}/auth/create_task.php`, apiData);

      if (response.data && response.data.message) {
        setMessage('¡Tarea creada exitosamente! Pago confirmado en blockchain.');
        setFormData({
          title: '',
          description: '',
          price: '',
          currency: 'USDC',
          difficulty: 'Fácil',
          category: 'Desarrollo',
          subtitle: ''
        });
      } else {
        setError('Tarea creada en blockchain pero error al guardar en base de datos.');
      }

    } catch (err: any) {
      setPaymentStatus('failed');
      
      // Mostrar error más específico
      if (err.message && err.message.includes('Amount must be greater than 0')) {
        setError('Error: El monto debe ser mayor a 0. Intenta con un monto mayor.');
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.message) {
        setError(`Error: ${err.message}`);
      } else {
        setError('Error al crear la tarea.');
      }
      
      console.error('Error completo:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-task-container">
      <Link to="/dashboard" className="back-button">
        <FaArrowLeft />
        <span>Volver al Dashboard</span>
      </Link>

      <div className="create-task-form-card">
        <h2>Crear Nueva Tarea</h2>
        
        {/* WalletConnect */}
        <div className="wallet-section">
          <h3>Conectar Wallet</h3>
          <WalletConnect />
          {!isConnected && (
            <p className="wallet-warning">
              ⚠️ Debes conectar tu wallet para crear tareas con pago en blockchain
            </p>
          )}
          {isConnected && !isContractConnected && (
            <p className="contract-connecting">
              🔄 Conectando al contrato inteligente...
            </p>
          )}
          {isConnected && isContractConnected && (
            <p className="contract-connected">
              ✅ Conectado al contrato inteligente
            </p>
          )}
        </div>

        {/* Estado de Pago */}
        {paymentStatus !== 'idle' && (
          <div className={`payment-status payment-${paymentStatus}`}>
            {paymentStatus === 'processing' && (
              <>
                <FaSpinner className="spinner" />
                <span>💰 Procesando pago en blockchain...</span>
              </>
            )}
            {paymentStatus === 'confirmed' && (
              <>
                <FaWallet />
                <span>✅ Pago confirmado en blockchain</span>
              </>
            )}
                    {paymentStatus === 'failed' && (
          <>
            <FaWallet />
            <span>❌ Error en el pago</span>
            <button 
              className="retry-button" 
              onClick={() => setPaymentStatus('idle')}
              style={{ marginLeft: '10px', padding: '5px 10px', fontSize: '12px' }}
            >
              Reintentar
            </button>
          </>
        )}
        
        {paymentStatus === 'confirmed' && error && (
          <>
            <FaWallet />
            <span>✅ Pago confirmado pero error al guardar tarea</span>
            <button 
              className="retry-button" 
              onClick={() => {
                setError('');
                setPaymentStatus('idle');
              }}
              style={{ marginLeft: '10px', padding: '5px 10px', fontSize: '12px' }}
            >
              Reintentar
            </button>
          </>
        )}
          </div>
        )}

        {/* Mensajes de estado */}
        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="create-task-form">
          {/* Campos del formulario (Título, Subtítulo, Descripción, Precio, Moneda) */}
          <div className="form-group">
            <label htmlFor="title">Título</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          {/* Nuevo Campo de Subtítulo */}
          <div className="form-group">
            <label htmlFor="subtitle">Subtítulo (máx. 255 caracteres)</label>
            <input
              type="text"
              id="subtitle"
              name="subtitle"
              value={formData.subtitle}
              onChange={handleChange}
              maxLength={255} // Limitar longitud según la base de datos
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Descripción</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
            ></textarea>
          </div>

          <div className="form-group">
            <label htmlFor="price">Precio a Pagar (ETH)</label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              required
              min="0.0001"
              step="0.0001"
              placeholder="0.001"
            />
            <small className="price-help">
              Monto mínimo: 0.0001 ETH
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="currency">Moneda</label>
            <select
              id="currency"
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              required
            >
              <option value="USDC">USDC</option>
              <option value="ARCX">ARCX</option>
            </select>
            <small className="price-help">
              El pago se realiza en ETH en Lisk Testnet, pero se registra en {formData.currency}
            </small>
          </div>

          {/* Campos de selección (Categoría, Dificultad) */}
           <div className="form-group">
            <label htmlFor="category">Categoría</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="Desarrollo">Desarrollo</option>
              <option value="Diseño">Diseño</option>
              <option value="Marketing">Marketing</option>
              <option value="Blockchain">Blockchain</option>
              <option value="Contenido">Contenido</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="difficulty">Dificultad</label>
            <select
              id="difficulty"
              name="difficulty"
              value={formData.difficulty}
              onChange={handleChange}
              required
            >
              <option value="Fácil">Fácil</option>
              <option value="Intermedio">Intermedio</option>
              <option value="Difícil">Difícil</option>
            </select>
          </div>

          {/* Botón de envío */}
          <button type="submit" disabled={loading}>
            {loading ? 'Creando...' : 'Crear Tarea'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateTask;