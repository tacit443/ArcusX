import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/database';
import '../css/SuperviseTask.css';
import { jwtDecode } from "jwt-decode";
import { useSmartContracts } from '../hooks/useSmartContracts';
import { useWallet } from '../contexts/WalletContext';
import WalletConnect from './WalletConnect';

interface TaskDetails {
    id: string;
    title: string;
    description: string;
    price: string;
    currency: string;
    difficulty: string;
    category: string;
    creator_username: string;
    created_at: string;
    user_id: string; // Aseguramos que es string como en el backend
    status: string;
    client_accepted_completion: number; // Nueva columna: 0 o 1
    worker_accepted_completion: number;  // Nueva columna: 0 o 1
}

interface UserDetails {
    id: string; // Aseguramos que es string como en el backend
    username: string;
    // Agrega otros campos relevantes del trabajador que get_user_details.php devuelva
}

// Definir la interfaz Message - IDs como string para coincidir con el backend
interface Message {
    id: string;
    task_id: string;
    sender_id: string;
    receiver_id: string;
    message: string;
    created_at: string;
    is_read: number; // O boolean si tu backend devuelve 0/1 o true/false
}

// Interfaz para el token JWT decodificado (refleja la estructura del payload)
interface DecodedToken {
    iat: number; // Issued at: time when the token was generated
    exp: number; // Expire
    iss: string; // Issuer
    data: { // Información del usuario
        id: number; // El ID del usuario en el payload (probablemente number)
        username: string; // El username
        // Agrega otros campos que tu token JWT contenga dentro de data
    };
    // Si hay otros campos fuera de data en tu payload, agrégalos aquí
}

// Interfaz para los detalles del usuario logueado (lo que almacenaremos en el estado currentUser)
interface CurrentUser {
    id: string; // ID del usuario logueado como string para comparación
    username: string;
    // Agrega otros campos del usuario si los necesitas frecuentemente en el frontend
}

const SuperviseTask: React.FC = () => {
    const { taskId, acceptedApplicantId } = useParams<{ taskId: string, acceptedApplicantId: string }>();
    const [task, setTask] = useState<TaskDetails | null>(null);
    const [worker, setWorker] = useState<UserDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Estados para el chat
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sendingMessage, setSendingMessage] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    // Estado para el usuario actual logueado (usamos la nueva interfaz CurrentUser)
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    
    // Hooks para blockchain
    const { completeTask: completeTaskOnChain, releasePayment: releasePaymentOnChain, assignWorker, isConnected: isContractConnected } = useSmartContracts();
    const { isConnected: isWalletConnected } = useWallet();
    
    // Estados para blockchain
    const [blockchainStatus, setBlockchainStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [blockchainError, setBlockchainError] = useState<string>('');

    // Cargar usuario actual desde localStorage al montar el componente
    useEffect(() => {
        const token = localStorage.getItem('token');
        console.log('>>> Valor del token obtenido de localStorage:', token, '(Tipo:', typeof token, ')');
        if (token && typeof token === 'string' && token !== '') {
            try {
                const decodedToken = jwtDecode<DecodedToken>(token);
                // Asegurarse de que el ID del usuario logueado es string y se guarda en el estado
                // Creamos un objeto CurrentUser a partir de los datos del token decodificado
                setCurrentUser({
                    id: String(decodedToken.data.id), // Obtener el ID de 'data.id' y asegurar que es string
                    username: decodedToken.data.username // Obtener el username de 'data.data.username'
                });
                console.log('Token decodificado (raw):', decodedToken); // Este log muestra el token decodificado original
                console.log('currentUser estado después de set:', currentUser); // Añade este log para ver el estado guardado

            } catch (err) {
                console.error('Error decodificando token (token encontrado pero inválido):', err);
                setCurrentUser(null); // Asegurarse de que currentUser es null si el token es inválido
            }
        } else {
            console.log('No se encontró token en localStorage o estaba vacío.');
            setCurrentUser(null); // Asegurarse de que currentUser es null si no hay token
        }
    }, []); // Se ejecuta solo una vez al montar

    // Logs para rastrear cambios en el estado task y worker (para depuración)
    useEffect(() => {
        console.log('>>> Estado task actualizado:', task);
        if (task) {
            console.log('>>> task.user_id en estado task:', task.user_id, '(' + typeof task.user_id + ')');
        }
    }, [task]);

    useEffect(() => {
        console.log('>>> Estado worker actualizado:', worker);
        if (worker) {
            console.log('>>> worker.id en estado worker:', worker.id, '(' + typeof worker.id + ')');
        }
    }, [worker]);

    useEffect(() => {
        const fetchData = async () => {
            console.log('Iniciando fetchData...');
            setLoading(true);
            setError(null);
            try {
                // **Llamada al backend para obtener detalles de la tarea**
                console.log('Obteniendo detalles de la tarea:', taskId);
                const taskResponse = await axios.get(`${API_URL}/auth/get_task_details.php?task_id=${taskId}`);
                console.log('Respuesta completa de detalles de tarea RAW:', taskResponse.data);
                console.log('Respuesta completa de detalles de tarea JSON:', JSON.stringify(taskResponse.data, null, 2));
                
                if (taskResponse.data) {
                    // Validar y usar taskResponse.data.user_id que viene del backend
                    if (taskResponse.data.user_id === undefined || taskResponse.data.user_id === null || typeof taskResponse.data.user_id !== 'string') {
                         console.error('user_id falta o es inválido en la respuesta de detalles de tarea:', taskResponse.data);
                         setError('Error: Los detalles de la tarea no incluyen un ID de usuario creador válido.');
                         setLoading(false);
                         return;
                    }
                    // Validar y asegurar que los nuevos campos existen y son números
                    if (taskResponse.data.client_accepted_completion === undefined || typeof taskResponse.data.client_accepted_completion !== 'number' ||
                        taskResponse.data.worker_accepted_completion === undefined || typeof taskResponse.data.worker_accepted_completion !== 'number') {
                        console.error('Campos de aceptación de finalización faltan o son inválidos en la respuesta:', taskResponse.data);
                        setError('Error: Los detalles de la tarea no incluyen los campos de aceptación de finalización.');
                        setLoading(false);
                        return;
                    }

                    // Establecer la respuesta tal como viene (user_id debe ser string)
                    setTask(taskResponse.data);
                    console.log('setTask llamado con data que incluye user_id (string) y campos de aceptación:', taskResponse.data.user_id, taskResponse.data.client_accepted_completion, taskResponse.data.worker_accepted_completion);

                } else {
                    setError('No se pudieron cargar los detalles de la tarea.');
                    setLoading(false);
                    return;
                }

                // **Llamada al backend para obtener detalles del trabajador**
                console.log('Obteniendo detalles del trabajador:', acceptedApplicantId);
                const workerResponse = await axios.get(`${API_URL}/auth/get_user_details.php?user_id=${acceptedApplicantId}`);
                console.log('Respuesta completa de detalles del trabajador RAW:', workerResponse.data);
                console.log('Respuesta completa de detalles del trabajador JSON:', JSON.stringify(workerResponse.data, null, 2));
                
                if (workerResponse.data) {
                    // Validar y asegurar que worker.id es un string
                    if (workerResponse.data.id === undefined || workerResponse.data.id === null || typeof workerResponse.data.id !== 'string') {
                         console.error('ID del trabajador falta o es inválido en la respuesta:', workerResponse.data);
                         setError('Error: Los detalles del trabajador no incluyen un ID válido.');
                         setLoading(false);
                         return;
                    }
                     const workerDetails: UserDetails = {
                         ...workerResponse.data,
                         id: workerResponse.data.id // Usar el ID directamente (debería ser string)
                     };
                    setWorker(workerDetails);
                     console.log('setWorker llamado con data que incluye id (string):', workerDetails.id);
                } else {
                    setError('No se pudieron cargar los detalles del trabajador.');
                    setLoading(false);
                    return;
                }

            } catch (err: any) {
                console.error('Error en fetchData:', err);
                setError('Error al cargar los detalles: ' + (err.response?.data?.message || err.message));
            } finally {
                setLoading(false);
            }
        };

        if (taskId && acceptedApplicantId) {
            fetchData();
        } else {
            setError('IDs de tarea o trabajador faltantes en la URL.');
            setLoading(false);
        }

    }, [taskId, acceptedApplicantId]); // Dependencias del useEffect

    // Función para cargar mensajes
    const fetchMessages = async () => {
        console.log('Iniciando fetchMessages...');
        if (!taskId) {
             console.log('fetchMessages: taskId no definido.');
             return;
        }

        setLoadingMessages(true);
        try {
            const response = await axios.get(`${API_URL}/auth/get_messages.php?task_id=${taskId}`);
            console.log('Respuesta de get_messages.php RAW:', response.data);
            
            if (response.data && Array.isArray(response.data)) {
                 // Asegurar que los IDs de sender_id y receiver_id son strings
                const formattedMessages: Message[] = response.data.map(msg => ({
                    ...msg,
                    id: String(msg.id),
                    task_id: String(msg.task_id),
                    sender_id: String(msg.sender_id),
                    receiver_id: String(msg.receiver_id)
                }));
                setMessages(formattedMessages);
                 console.log('Mensajes formateados y establecidos:', formattedMessages);
            } else {
                 console.log('get_messages.php no devolvió un array válido:', response.data);
                 setMessages([]); // Asegurar que messages es un array vacío si la respuesta no es válida
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
             setError('Error al cargar mensajes.'); // Mostrar error al usuario si falla la carga de mensajes
        } finally {
            setLoadingMessages(false);
             console.log('fetchMessages finalizado.');
        }
    };

    // Cargar mensajes al obtener los detalles de la tarea, trabajador y usuario actual
    useEffect(() => {
        console.log('useEffect para fetchMessages - task, worker, currentUser:', { task: !!task, worker: !!worker, currentUser: !!currentUser });
        if (task && worker && currentUser) {
            fetchMessages();
            // Opcional: Implementar polling para nuevos mensajes
            const interval = setInterval(fetchMessages, 5000); // Cargar mensajes cada 5 segundos
            return () => clearInterval(interval); // Limpiar el intervalo al desmontar
        }
    }, [task, worker, currentUser, taskId]); // Depende de que task, worker y currentUser estén cargados, y taskId (aunque taskId no cambiará)

    // Scroll al último mensaje
    useEffect(() => {
        console.log('useEffect para scroll - messages:', messages.length);
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]); // Scroll cada vez que los mensajes cambian

    // Función para enviar mensaje
    const sendMessage = async () => {
        console.log('Iniciando sendMessage...');
        console.log('Estado actual en sendMessage (inicio):', { currentUser, task, worker, newMessage });

        // Asegurarse de que newMessage no está vacío
        if (!newMessage.trim()) {
            console.log('Mensaje vacío, no se envía.');
             return;
        }

        // Validar que tenemos toda la información necesaria
        if (!currentUser || !task || !worker || !taskId || !acceptedApplicantId) {
            console.error('Faltan datos necesarios para enviar el mensaje.', { currentUser, task, worker, taskId, acceptedApplicantId });
            setError('Error: Faltan datos necesarios para enviar el mensaje.');
            return;
        }

        setSendingMessage(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No se encontró el token de autenticación.');
                setSendingMessage(false);
                return;
            }

            // Asegurarse de que los IDs son números para el backend
            const senderIdNum = parseInt(currentUser.id, 10);
            const taskIdNum = parseInt(taskId, 10); // Asegurarse de que el taskId es un número

            // Determinar el receiver_id dinámicamente
            // Si el current user es el creador de la tarea, el receptor es el trabajador
            // Si el current user es el trabajador, el receptor es el creador
            let actualReceiverId = 0;
            if (currentUser.id === task.user_id) { // Si el usuario actual es el creador de la tarea
                actualReceiverId = parseInt(acceptedApplicantId, 10); // El receptor es el trabajador aceptado
            } else if (currentUser.id === worker.id) { // Si el usuario actual es el trabajador
                actualReceiverId = parseInt(task.user_id, 10); // El receptor es el creador de la tarea
            } else {
                // Este caso no debería ocurrir si los roles están bien definidos
                console.error('Error: El usuario actual no es ni el creador ni el trabajador asignado.');
                setError('No autorizado para enviar mensajes en esta tarea.');
                setSendingMessage(false);
                return;
            }
            
            const response = await axios.post(`${API_URL}/auth/send_message.php`, 
                {
                    task_id: taskIdNum,
                    sender_id: senderIdNum,
                    receiver_id: actualReceiverId, // Usar el ID del receptor determinado dinámicamente
                message: newMessage.trim()
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            console.log('Respuesta de send_message.php:', response.data);
            if (response.data.success) {
                setNewMessage(''); // Limpiar el input
                fetchMessages(); // Recargar mensajes para ver el nuevo
            } else {
                setError('Error: ' + (response.data.message || 'Mensaje no enviado.'));
            }
        } catch (err: any) {
            console.error('Error enviando mensaje:', err);
            setError('Error al enviar mensaje: ' + (err.response?.data?.message || err.message));
        } finally {
            setSendingMessage(false);
        }
    };

    // Determinar si el usuario actual es el creador de la tarea o el trabajador asignado
    const isClient = currentUser?.id === task?.user_id;
    const isWorker = currentUser?.id === worker?.id;

    // **Función para marcar la tarea como completada (integración blockchain)**
    const handleCompleteTask = async () => {
        console.log('Iniciando handleCompleteTask para taskId:', taskId);
        if (!taskId) {
            setError('Error: ID de tarea no disponible.');
            return;
        }

        // Validar conexión blockchain
        if (!isWalletConnected) {
            setError('Debes conectar tu wallet para completar tareas.');
            return;
        }

        if (!isContractConnected) {
            setError('Conectando al contrato... Intenta de nuevo en unos segundos.');
            return;
        }

        setLoading(true);
        setError(null);
        setBlockchainStatus('processing');

        try {
            // PASO 1: Completar tarea en blockchain
            const blockchainResult = await completeTaskOnChain(parseInt(taskId, 10));
            
            if (!blockchainResult.success) {
                setBlockchainStatus('error');
                setBlockchainError(`Error en blockchain: ${blockchainResult.error}`);
                setError(`Error en blockchain: ${blockchainResult.error}`);
                setLoading(false);
                return;
            }

            console.log('Tarea completada en blockchain:', blockchainResult);
            setBlockchainStatus('success');

            // PASO 2: Actualizar en base de datos
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No se encontró el token de autenticación.');
                setLoading(false);
                return;
            }

            const response = await axios.post(`${API_URL}/auth/complete_task.php`, 
                {
                    task_id: parseInt(taskId, 10),
                    blockchain_transaction_hash: blockchainResult.transactionHash
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            console.log('Respuesta de complete_task.php:', response.data);
            if (response.data.success) {
                setTask(prevTask => {
                    if (!prevTask) return null;
                    return { 
                        ...prevTask, 
                        status: response.data.status || prevTask.status,
                        client_accepted_completion: response.data.client_accepted_completion !== undefined ? response.data.client_accepted_completion : prevTask.client_accepted_completion,
                        worker_accepted_completion: response.data.worker_accepted_completion !== undefined ? response.data.worker_accepted_completion : prevTask.worker_accepted_completion
                    };
                });
              
            } else {
                setError('Tarea completada en blockchain pero error al actualizar en base de datos: ' + (response.data.message || 'Error desconocido.'));
            }
        } catch (err: any) {
            console.error('Error marcando tarea como completada:', err);
            setBlockchainStatus('error');
            setBlockchainError(err.message || 'Error desconocido');
            setError('Error al marcar tarea como completada: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    // **Función para asignar worker (solo para el cliente)**
    const handleAssignWorker = async () => {
        if (!taskId) {
            setError('Error: ID de tarea no disponible.');
            return;
        }

        // Solo el cliente puede asignar worker
        if (!isClient) {
            setError('Solo el cliente puede asignar worker.');
            return;
        }

        // Validar conexión blockchain
        if (!isWalletConnected) {
            setError('Debes conectar tu wallet para asignar worker.');
            return;
        }

        if (!isContractConnected) {
            setError('Conectando al contrato... Intenta de nuevo en unos segundos.');
            return;
        }

        setLoading(true);
        setError(null);
        setBlockchainStatus('processing');

        try {
            // PASO 1: Asignar worker en blockchain
            if (!worker) {
                setError('No se encontró información del worker.');
                setLoading(false);
                return;
            }
            const blockchainResult = await assignWorker(parseInt(taskId, 10), worker.id);
            
            if (!blockchainResult.success) {
                setBlockchainStatus('error');
                setBlockchainError(`Error en blockchain: ${blockchainResult.error}`);
                setError(`Error en blockchain: ${blockchainResult.error}`);
                setLoading(false);
                return;
            }

            console.log('Worker asignado en blockchain:', blockchainResult);
            setBlockchainStatus('success');

            // PASO 2: Actualizar estado en base de datos
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No se encontró el token de autenticación.');
                setLoading(false);
                return;
            }

            const response = await axios.post(`${API_URL}/auth/assign_worker.php`, 
                {
                    task_id: parseInt(taskId, 10),
                    worker_id: worker.id,
                    blockchain_transaction_hash: blockchainResult.transactionHash
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (response.data.success) {
                setError('¡Worker asignado exitosamente! Ahora puede completar la tarea.');
            } else {
                setError('Worker asignado en blockchain pero error al actualizar en base de datos: ' + (response.data.message || 'Error desconocido.'));
            }
        } catch (err: any) {
            console.error('Error asignando worker:', err);
            setBlockchainStatus('error');
            setBlockchainError(err.message || 'Error desconocido');
            setError('Error al asignar worker: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    // **Función para liberar pago al worker (solo para el cliente)**
    const handleReleasePayment = async () => {
        if (!taskId) {
            setError('Error: ID de tarea no disponible.');
            return;
        }

        // Solo el cliente puede liberar el pago
        if (!isClient) {
            setError('Solo el cliente puede liberar el pago.');
            return;
        }

        // Validar conexión blockchain
        if (!isWalletConnected) {
            setError('Debes conectar tu wallet para liberar pagos.');
            return;
        }

        if (!isContractConnected) {
            setError('Conectando al contrato... Intenta de nuevo en unos segundos.');
            return;
        }

        setLoading(true);
        setError(null);
        setBlockchainStatus('processing');

        try {
            // PASO 1: Liberar pago en blockchain
            const blockchainResult = await releasePaymentOnChain(parseInt(taskId, 10));
            
            if (!blockchainResult.success) {
                setBlockchainStatus('error');
                setBlockchainError(`Error en blockchain: ${blockchainResult.error}`);
                setError(`Error en blockchain: ${blockchainResult.error}`);
                setLoading(false);
                return;
            }

            console.log('Pago liberado en blockchain:', blockchainResult);
            setBlockchainStatus('success');

            // PASO 2: Actualizar estado en base de datos
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No se encontró el token de autenticación.');
                setLoading(false);
                return;
            }

            const response = await axios.post(`${API_URL}/auth/release_payment.php`, 
                {
                    task_id: parseInt(taskId, 10),
                    blockchain_transaction_hash: blockchainResult.transactionHash
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (response.data.success) {
                setTask(prevTask => {
                    if (!prevTask) return null;
                    return { 
                        ...prevTask, 
                        status: 'paid'
                    };
                });
                // Mostrar mensaje de éxito (usar el estado de error para mostrar éxito)
                setError('¡Pago liberado exitosamente! El worker ha recibido su pago.');
            } else {
                setError('Pago liberado en blockchain pero error al actualizar en base de datos: ' + (response.data.message || 'Error desconocido.'));
            }
        } catch (err: any) {
            console.error('Error liberando pago:', err);
            setBlockchainStatus('error');
            setBlockchainError(err.message || 'Error desconocido');
            setError('Error al liberar pago: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    // Componentes de carga/error (restaurados a p tags)
    if (loading) return <div className="supervise-task-container"><p>Cargando detalles de la tarea...</p></div>;
    if (error) return <div className="supervise-task-container"><p className="error-message">Error: {error}</p></div>;
    if (!task || !worker || !currentUser) return <div className="supervise-task-container"><p>No se encontraron los detalles de la tarea o del trabajador.</p></div>;

    // Lógica para mostrar los nombres según el rol. Ahora es seguro acceder a task y worker.
    const chatPartnerName = isClient ? worker.username : task.creator_username;

    // Determinar el mensaje del botón y si está deshabilitado
    let buttonText = 'Marcar como Completada';
    let isButtonDisabled: boolean = loading;

    if (task.status === 'completed') {
        buttonText = 'Tarea Completada';
        isButtonDisabled = true;
    } else if (isClient && task.client_accepted_completion === 1) {
        buttonText = 'Esperando confirmación del trabajador';
        isButtonDisabled = true;
    } else if (isWorker && task.worker_accepted_completion === 1) {
        buttonText = 'Esperando confirmación del cliente';
        isButtonDisabled = true;
    }

    return (
        <div className="supervise-task-container">
            {/* Encabezado restaurado a la estructura original */}
            <div className="supervise-task-header">
                <h1>{isClient ? 'Supervisar Tarea' : 'Progresando Tarea'}: {task.title}</h1>
                <p className="assigned-worker-info">{isClient ? 'Trabajador Asignado' : 'Creador de Tarea'}: {worker.username}</p>
            </div>

            {/* Sección de Detalles de la Tarea - Restaurado a la clase definida en CSS */}
            <div className="task-details-section">
                <h2>Detalles de la Tarea</h2>
                <p><span className="detail-label">Descripción:</span> {task.description}</p>
                <p><span className="detail-label">Recompensa:</span> {task.price} {task.currency}</p>
                <p><span className="detail-label">Categoría:</span> {task.category}</p>
                <p><span className="detail-label">Dificultad:</span> {task.difficulty}</p>
            </div>

            {/* Sección de WalletConnect y Estado Blockchain */}
            <div className="blockchain-section">
                <h2>Conectividad Blockchain</h2>
                <WalletConnect />
                
                {!isWalletConnected && (
                    <p className="wallet-warning">
                        ⚠️ Debes conectar tu wallet para realizar operaciones blockchain
                    </p>
                )}
                
                {isWalletConnected && !isContractConnected && (
                    <p className="contract-connecting">
                        🔄 Conectando al contrato inteligente...
                    </p>
                )}
                
                {isWalletConnected && isContractConnected && (
                    <p className="contract-connected">
                        ✅ Conectado al contrato inteligente
                    </p>
                )}

                {/* Estado de operaciones blockchain */}
                {blockchainStatus !== 'idle' && (
                    <div className={`blockchain-status blockchain-${blockchainStatus}`}>
                        {blockchainStatus === 'processing' && (
                            <>
                                <span className="spinner">🔄</span>
                                <span>Procesando en blockchain...</span>
                            </>
                        )}
                        {blockchainStatus === 'success' && (
                            <>
                                <span>✅ Operación exitosa en blockchain</span>
                            </>
                        )}
                        {blockchainStatus === 'error' && (
                            <>
                                <span>❌ Error en blockchain: {blockchainError}</span>
                            </>
                        )}
                    </div>
                )}
            </div>
                
            {/* Sección de Chat - Restaurado a las clases definidas en CSS */}
            <div className="chat-section">
                <h2>Chat con {chatPartnerName}</h2>
                <div className="messages-area">
                    {loadingMessages ? (
                        <p>Cargando mensajes...</p>
                    ) : messages.length === 0 ? (
                        <p>Aún no hay mensajes.</p>
                    ) : (
                        messages.map(msg => (
                            <div 
                                key={msg.id} 
                                className={msg.sender_id === currentUser.id ? 'message-container my-message' : 'message-container other-message'}
                            >
                                <div className="message-bubble">
                                    {msg.message}
                                </div>
                                <span className="message-time">{new Date(msg.created_at).toLocaleTimeString()}</span>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="message-input-area">
                    {/* Restaurado a input type="text" para coincidir con el CSS */}
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escribe un mensaje..."
                        disabled={sendingMessage}
                         onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                sendMessage();
                            }
                         }}
                    />
                    <button
                        onClick={sendMessage}
                         disabled={sendingMessage || !newMessage.trim()}
                    >
                        {sendingMessage ? 'Enviando...' : 'Enviar'}
                    </button>
                </div>
            </div>

            {/* Sección de Intercambio de Archivos - Restaurado a la clase definida en CSS */}
            <div className="file-exchange-section">
                <h2>Intercambio de Archivos</h2>
                <p>Archivos compartidos irán aquí...</p>
            </div>

            {/* Botones de Acción Blockchain */}
            <div className="blockchain-actions">
                {/* Botón para marcar tarea como completada (visible para AMBOS roles si no está completada) */}
                {(isWorker || isClient) && (
                    <div className="completion-buttons">
                        <button 
                            className="btn-success"
                            onClick={handleCompleteTask}
                            disabled={isButtonDisabled || !isWalletConnected || !isContractConnected} 
                        >
                            {buttonText}
                        </button>
                    </div>
                )}

                {/* Botón para asignar worker (solo para el cliente, solo si no hay worker asignado) */}
                {isClient && task.status !== 'assigned' && (
                    <div className="assignment-buttons">
                        <button 
                            className="btn-primary"
                            onClick={handleAssignWorker}
                            disabled={loading || !isWalletConnected || !isContractConnected}
                        >
                            {loading ? 'Asignando Worker...' : 'Asignar Worker'}
                        </button>
                    </div>
                )}

                {/* Botón para liberar pago (solo para el cliente, solo si la tarea está completada) */}
                {isClient && task.status === 'completed' && (
                    <div className="payment-buttons">
                        <button 
                            className="btn-primary"
                            onClick={handleReleasePayment}
                            disabled={loading || !isWalletConnected || !isContractConnected}
                        >
                            {loading ? 'Liberando Pago...' : 'Liberar Pago al Worker'}
                        </button>
                    </div>
                )}

                {/* Mensajes de error */}
                {error && <p className="error-message">{error}</p>}
            </div>
        </div>
    );
};

export default SuperviseTask;